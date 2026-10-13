import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const url = process.argv[2] ?? 'http://127.0.0.1:4175/';
const devUrl = process.argv[3];
const session = `spring-cottage-qa-${process.pid}`;
const fallbackSession = `${session}-fallback`;
const screenshots = path.join(root, 'docs/screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const checks = [];
const metrics = [];
const results = { date: new Date().toISOString(), url, checks, metrics, realDevice: false };

function browserIn(name, args, input) {
  const result = spawnSync('agent-browser', ['--session', name, ...args], {
    encoding: 'utf8',
    timeout: 35000,
    input,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
const browser = (...args) => browserIn(session, args);
function evaluate(source, name = session) {
  const value = browserIn(name, ['eval', '--stdin'], `JSON.stringify(${source})`);
  return JSON.parse(JSON.parse(value));
}
const state = () => evaluate('window.__springCottage');
const wait = (condition) => browser('wait', '--fn', condition);
const settled = (id) =>
  wait(`window.__springCottage?.view === '${id}' && !window.__springCottage.flying`);
const near = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 0.08);
const distance = (s) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log(`PASS ${name}`);
}
const shot = (name, full = true) =>
  browser('screenshot', ...(full ? ['--full'] : []), path.join(screenshots, `${name}.png`));
function frames(count = 10) {
  const frame = state().frameCount;
  wait(`window.__springCottage.frameCount > ${frame + count}`);
}
function selected(id) {
  return evaluate(
    `document.querySelectorAll('.verse[aria-pressed="true"]').length === 1 && document.querySelector('[data-view="${id}"]').getAttribute('aria-pressed') === 'true'`,
  );
}
function inputPoint() {
  return evaluate(
    `(() => { const box = document.querySelector('canvas').getBoundingClientRect(); return { x: Math.round(box.x + box.width * 0.5), y: Math.round(box.y + box.height * 0.5) }; })()`,
  );
}
function loseContext() {
  return evaluate(`(() => {
    const extension = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) return false;
    window.restoreTestContext = () => extension.restoreContext();
    extension.loseContext(); return true;
  })()`);
}

// agent-browser owns the session and navigation. CDP supplements it with touch
// gestures and wheel coordinates (this CLI version sends wheel input at 0, 0).
async function cdpInput(action) {
  const socket = new WebSocket(browser('get', 'cdp-url'));
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      clearTimeout(entry.timeout);
      message.error
        ? entry.reject(new Error(JSON.stringify(message.error)))
        : entry.resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find((item) => item.type === 'page' && item.url.startsWith(url));
    assert.ok(target, 'Touch input must target the isolated production page');
    const { sessionId } = await send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    });
    await action((method, params) => send(method, params, sessionId));
  } finally {
    socket.close();
  }
}

const wheelAt = (point, deltaY) =>
  cdpInput((send) =>
    send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: point.x,
      y: point.y,
      deltaY,
      deltaX: 0,
    }),
  );
const touchGesture = (points) =>
  cdpInput(async (send) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points[0] });
    for (const touchPoints of points.slice(1)) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints });
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });

try {
  browser('open', url);
  browser('set', 'viewport', '1440', '960');
  wait('window.__springCottage?.ready && !document.querySelector(".state-overlay")');
  const first = state();
  check('First real frame is rendered and loading overlay is gone', first.triangles > 10000);
  check(
    'First mount leaves one canvas',
    evaluate('document.querySelectorAll("canvas").length === 1'),
  );
  check(
    'Poem has four separate, ordered entries with original punctuation',
    evaluate(
      `Array.from(document.querySelectorAll('.verse-text'), x => x.textContent).join('') === '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。'`,
    ),
  );
  shot('01-overview');
  results.environment = evaluate(`(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  })()`);
  const views = [
    ['orioles', [12, 11.5, 38], '02-orioles'],
    ['egrets', [21, 11, 43], '03-egrets'],
    ['window', [-22, 6.8, -8], '04-window'],
    ['boats', [-5, 13, 43], '05-boats'],
  ];
  for (const [id, camera, filename] of views) {
    browser('click', `[data-view="${id}"]`);
    settled(id);
    const current = state();
    check(
      `${id}: authored camera, matching selection, and same scene`,
      near(current.camera, camera) && selected(id) && current.sceneId === first.sceneId,
    );
    shot(filename);
    metrics.push({
      view: id,
      fps: current.fps,
      drawCalls: current.drawCalls,
      triangles: current.triangles,
    });
  }

  browser('click', '[data-view="orioles"]');
  browser('click', '[data-view="egrets"]');
  browser('click', '[data-view="boats"]');
  settled('boats');
  check(
    'Rapid switching settles at the latest requested view',
    near(state().camera, views[3][1]) && selected('boats'),
  );

  browser('click', '[data-view="egrets"]');
  wait('window.__springCottage.flying');
  let point = inputPoint();
  browser('mouse', 'move', String(point.x), String(point.y));
  browser('mouse', 'down');
  browser('mouse', 'move', String(point.x + 55), String(point.y + 10));
  check('Starting a drag interrupts camera flight', !state().flying);
  // Select while the pointer is held, then release; newest destination survives.
  evaluate('document.querySelector("[data-view=window]").click()');
  browser('mouse', 'up');
  settled('window');
  check(
    'Selecting a verse during a drag reaches the latest destination',
    near(state().camera, views[2][1]),
  );
  browser('click', '[data-view="egrets"]');
  settled('egrets');
  check('Upward view remains above the horizon', state().camera[1] < state().target[1]);
  browser('click', '[data-view="boats"]');
  settled('boats');
  check('Leaving an upward view restores the boat framing', near(state().camera, views[3][1]));
  const beforeDrag = state().camera;
  browser('mouse', 'move', String(point.x), String(point.y));
  browser('mouse', 'down');
  browser('mouse', 'move', String(point.x + 85), String(point.y + 20));
  browser('mouse', 'up');
  frames(20);
  check('Manual dragging rotates the camera', !near(state().camera, beforeDrag));
  const beforeWheel = distance(state());
  await wheelAt(point, 240);
  frames(20);
  check('Wheel input changes viewing distance', Math.abs(distance(state()) - beforeWheel) > 0.5);

  browser('click', '[aria-label="暂停风物动画"]');
  frames();
  const pausedTime = state().animationTime;
  frames(20);
  check('Pause freezes scenery animation', state().paused && state().animationTime === pausedTime);
  browser('click', '[data-view="orioles"]');
  settled('orioles');
  check(
    'Paused scenery still permits camera navigation',
    near(state().camera, views[0][1]) && state().animationTime === pausedTime,
  );
  browser('click', '[aria-label="继续风物动画"]');
  frames();
  check('Resume restarts scenery animation', state().animationTime > pausedTime);

  browser('focus', '[data-view="egrets"]');
  browser('press', 'Enter');
  settled('egrets');
  check('Verse buttons support keyboard activation', selected('egrets'));
  browser('focus', '[data-view="orioles"]');
  browser('press', 'Tab');
  check(
    'Tab moves through verses in original order',
    evaluate('document.activeElement.dataset.view === "egrets"'),
  );
  browser('click', '.source-button');
  check(
    'Source dialog names the edition and keeps the full poem',
    evaluate(
      'document.querySelector("dialog").open && document.querySelectorAll(".source-verses p").length === 4',
    ),
  );
  browser('press', 'Escape');
  check('Escape closes the source dialog', evaluate('!document.querySelector("dialog").open'));
  browser('click', '[data-testid="overview"]');
  settled('overview');
  check(
    'Overview clears verse selection and preserves the scene',
    state().sceneId === first.sceneId &&
      evaluate('document.querySelectorAll(".verse[aria-pressed=true]").length === 0'),
  );
  browser('set', 'viewport', '1024', '768');
  frames();
  check(
    'Tablet-width resizing fits the page without overflow',
    evaluate('document.documentElement.scrollWidth <= innerWidth'),
  );
  browser('set', 'viewport', '1440', '960');
  frames();

  browser('set', 'media', 'light', 'reduced-motion');
  wait('window.__springCottage.reducedMotion');
  const reducedTime = state().animationTime;
  browser('click', '[data-view="window"]');
  check(
    'System reduced motion directly selects the destination',
    !state().flying && near(state().camera, views[2][1]),
  );
  frames(15);
  check('Reduced motion freezes nonessential scenery', state().animationTime === reducedTime);
  browser('set', 'media', 'light');
  wait('!window.__springCottage.reducedMotion');
  browser('click', '[aria-label="减少动态"]');
  wait('window.__springCottage.reducedMotion');
  browser('click', '[data-view="boats"]');
  check(
    'Manual reduced-motion control updates both behavior and state',
    !state().flying &&
      near(state().camera, views[3][1]) &&
      evaluate(
        'document.querySelector("[aria-label=减少动态]").getAttribute("aria-pressed") === "true"',
      ),
  );
  browser('click', '[aria-label="减少动态"]');
  wait('!window.__springCottage.reducedMotion');

  check('Context-loss simulation is supported', loseContext());
  wait(
    'window.__springCottage.contextLost && !window.__springCottage.ready && Boolean(document.querySelector(".error-state"))',
  );
  check(
    'Graphics interruption shows recovery guidance and readable poetry',
    evaluate(
      'Boolean(document.querySelector(".error-state")) && document.querySelectorAll(".verse-text").length === 4',
    ),
  );
  evaluate('window.restoreTestContext()');
  wait('window.__springCottage.ready && !document.querySelector(".state-overlay")');
  check(
    'Restoring graphics resumes the same scene',
    state().sceneId === first.sceneId && !state().contextLost,
  );
  check('Retry simulation can lose graphics again', loseContext());
  wait('window.__springCottage.contextLost && Boolean(document.querySelector(".retry-button"))');
  browser('click', '.retry-button');
  wait('window.__springCottage.ready && !document.querySelector(".state-overlay")');
  check(
    'Retry disposes the old scene and leaves one canvas',
    state().sceneId !== first.sceneId &&
      evaluate('document.querySelectorAll("canvas").length === 1'),
  );

  browser('set', 'device', 'iPhone 14');
  browser('reload');
  wait('window.__springCottage?.ready');
  check(
    'Simulated mobile uses capped density and compact quality',
    state().compact && state().pixelRatio <= 1,
  );
  check(
    'Simulated mobile has no horizontal overflow',
    evaluate('document.documentElement.scrollWidth <= innerWidth'),
  );
  shot('06-mobile-overview');
  frames(3);
  for (const [id] of views) {
    browser('scrollintoview', `[data-view="${id}"]`);
    frames(3);
    browser('click', `[data-view="${id}"]`);
    settled(id);
    check(`Mobile ${id}: matching verse and valid rendering`, selected(id) && state().ready);
    check(
      `Mobile ${id}: choosing the verse returns the landscape to view`,
      evaluate(
        '(() => { const box = document.querySelector(".world-frame").getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight; })()',
      ),
    );
    browser('scrollintoview', '.world-frame');
    shot(`mobile-${id}`, false);
  }
  point = inputPoint();
  const beforeTouch = state().camera;
  await touchGesture([
    [{ x: point.x, y: point.y, id: 0 }],
    [{ x: point.x + 50, y: point.y + 15, id: 0 }],
  ]);
  frames(15);
  check('Simulated single-finger touch rotates the scene', !near(state().camera, beforeTouch));
  const beforePinch = distance(state());
  await touchGesture([
    [
      { x: point.x - 30, y: point.y, id: 0 },
      { x: point.x + 30, y: point.y, id: 1 },
    ],
    [
      { x: point.x - 50, y: point.y, id: 0 },
      { x: point.x + 50, y: point.y, id: 1 },
    ],
  ]);
  frames(15);
  check(
    'Simulated two-finger pinch changes viewing distance',
    Math.abs(distance(state()) - beforePinch) > 0.5,
  );
  browser('click', '[data-testid="overview"]');
  settled('overview');
  browser('set', 'viewport', '320', '740');
  frames();
  check(
    'Narrow mobile width keeps all poem text within the page',
    evaluate('document.documentElement.scrollWidth <= innerWidth'),
  );

  results.console = browser('console');
  results.errors = browser('errors');
  check(
    'Final production page has no uncaught exceptions or console errors',
    !results.errors && !/\[error\]/i.test(results.console),
  );
  results.accessibility = JSON.parse(browser('a11y', '--json'));
  check(
    'Automated accessibility audit has no confirmed violations',
    results.accessibility.data.counts.violations === 0,
  );

  browserIn(fallbackSession, [
    'open',
    '--init-script',
    path.join(root, 'scripts/fixtures/disable-webgl.js'),
    url,
  ]);
  browserIn(fallbackSession, ['wait', '--fn', 'Boolean(document.querySelector(".error-state"))']);
  check(
    'Unavailable WebGL preserves all poem text and a retry button',
    evaluate(
      'document.querySelectorAll(".verse-text").length === 4 && Boolean(document.querySelector(".retry-button"))',
      fallbackSession,
    ),
  );
  browserIn(fallbackSession, ['screenshot', path.join(screenshots, '07-graphics-fallback.png')]);

  if (devUrl) {
    browser('set', 'viewport', '1440', '960');
    browser('open', devUrl);
    wait('window.__springCottage?.ready');
    check(
      'React StrictMode remount leaves a single canvas',
      evaluate('document.querySelectorAll("canvas").length === 1'),
    );
    const initialFrames = state().frameCount;
    frames(15);
    check('StrictMode scene continues rendering', state().frameCount > initialFrames);
    check('Development lifecycle has no uncaught exceptions', !browser('errors'));
  }
  results.success = true;
} catch (error) {
  results.success = false;
  results.failure = String(error);
  try {
    results.failureState = state();
    results.failureUI = evaluate(
      '({selected:document.querySelector(".verse.selected")?.dataset.view, phase:document.querySelector(".world-frame").dataset.phase, visibility:document.visibilityState, scrollY})',
    );
    shot('failure');
  } catch {
    // Preserve the original failure if the browser itself is no longer available.
  }
  throw error;
} finally {
  fs.writeFileSync(
    path.join(root, 'docs/qa-results.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  browserIn(session, ['close']);
  browserIn(fallbackSession, ['close']);
}
