import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import { getView, poem, type ViewId, verses } from './poem';
import type { WorldController } from './world';

export function App() {
  const [viewId, setViewId] = useState<ViewId>('overview');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const [exploring, setExploring] = useState(false);
  const [retry, setRetry] = useState(0);
  const reducedMotion = motionOverride ?? systemReduced;
  const hostRef = useRef<HTMLDivElement>(null);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<WorldController | null>(null);
  const viewRef = useRef(viewId);
  const motionRef = useRef({ paused, reducedMotion });
  const view = getView(viewId);
  const currentIndex = verses.findIndex((verse) => verse.id === viewId);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry intentionally rebuilds graphics resources.
  useEffect(() => {
    let canceled = false;
    let world: WorldController | null = null;
    setPhase('loading');
    setError('');
    const initialize = async () => {
      try {
        const { createWorld } = await import('./world');
        if (canceled || !hostRef.current) return;
        world = createWorld(hostRef.current, {
          view: viewRef.current,
          ...motionRef.current,
          onReady: () => {
            if (!canceled) {
              setPhase('ready');
              setError('');
            }
          },
          onFailure: (message) => {
            if (!canceled) {
              setPhase('error');
              setError(message);
            }
          },
          onExplore: () => {
            if (!canceled) setExploring(true);
          },
          onArrive: () => {
            if (!canceled) setExploring(false);
          },
        });
        controllerRef.current = world;
      } catch {
        if (!canceled) {
          setPhase('error');
          setError('暂时无法展开这片山水。可以尝试重新载入；四句诗仍可完整阅读。');
        }
      }
    };
    void initialize();
    return () => {
      canceled = true;
      world?.dispose();
      controllerRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    motionRef.current = { paused, reducedMotion };
    controllerRef.current?.setMotion(paused, reducedMotion);
  }, [paused, reducedMotion]);

  function selectView(id: ViewId) {
    viewRef.current = id;
    setViewId(id);
    setExploring(false);
    controllerRef.current?.selectView(id);
    if (window.innerWidth <= 760) {
      hostRef.current?.parentElement?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start',
      });
    }
  }

  function nextVerse() {
    selectView(verses[currentIndex + 1]?.id ?? 'overview');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="诗中山水首页">
          <span className="brand-symbol">
            <Icon name="overview" />
          </span>
          <span className="brand-type">
            诗中山水<span>POETRY INTO WORLDS</span>
          </span>
        </a>
        <div className="header-caption">
          <span>一首诗，一次旅行</span>
          <span className="season">
            <span />
            春日篇
          </span>
        </div>
      </header>

      <main className="experience">
        <aside className="poem-panel" aria-label="诗文与景观导航">
          <div className="poem-heading">
            <div className="eyebrow">
              <span className="chapter-number">卷 〇 一</span>
              <span className="title-rule" />
              草堂里的春天
            </div>
            <div className="title-row">
              <h1>{poem.title}</h1>
              <span className="poet-seal" aria-hidden="true">
                春<br />望
              </span>
            </div>
            <p className="poet">
              {poem.dynasty}
              <span>·</span>
              {poem.author}
              <span className="poem-form">七言绝句</span>
            </p>
            <p className="intro">
              四句诗，一扇窗。
              <br />
              在草堂里，望见整个春天。
            </p>
          </div>

          <nav className="verse-nav" aria-label="逐句入境">
            <div className="nav-heading">
              <span>循诗入境</span>
              <span>四句 · 四景</span>
            </div>
            {verses.map((verse, index) => (
              <button
                type="button"
                key={verse.id}
                className={`verse ${viewId === verse.id ? 'selected' : ''}`}
                data-view={verse.id}
                aria-pressed={viewId === verse.id}
                onClick={() => selectView(verse.id)}
              >
                <span className="verse-icon">
                  <Icon name={verse.id} />
                </span>
                <span className="verse-copy">
                  <span className="verse-meta">
                    <span>0{index + 1}</span>
                    {verse.label}
                  </span>
                  <span className="verse-text">{verse.verse}</span>
                </span>
                <Icon name="arrow" className="verse-arrow" />
              </button>
            ))}
          </nav>

          <div className="poem-footer">
            <button type="button" className="journey-button" onClick={nextVerse}>
              {viewId === 'overview'
                ? '从第一句，走进春天'
                : currentIndex === 3
                  ? '回望整个春天'
                  : '再向下一句走走'}
              <Icon name="arrow" />
            </button>
            <button
              type="button"
              className="source-button"
              onClick={() => sourceDialog.current?.showModal()}
            >
              <Icon name="book" />
              诗词与出处
            </button>
          </div>
        </aside>

        <section className="world-column" aria-label="交互山水">
          <div className="world-frame" data-phase={phase}>
            <div className="world-host" ref={hostRef} />
            <div className="scene-header">
              <div className="scene-tag">
                <span className="live-dot" />
                <span>
                  {exploring ? '自在环顾' : viewId === 'overview' ? '全景漫游' : '诗句漫游'}
                </span>
              </div>
              <div className="motion-controls">
                <button
                  type="button"
                  className="icon-button motion-button"
                  aria-label="减少动态"
                  aria-pressed={reducedMotion}
                  title={
                    reducedMotion
                      ? '恢复镜头过渡与风物动画'
                      : '减少动态：镜头直接切换，风物保持静止'
                  }
                  onClick={() => setMotionOverride(!reducedMotion)}
                >
                  <Icon name="motion" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={paused ? '继续风物动画' : '暂停风物动画'}
                  aria-pressed={paused}
                  disabled={reducedMotion}
                  title={
                    reducedMotion
                      ? '减少动态时风物保持静止'
                      : paused
                        ? '继续风物动画'
                        : '暂停风物动画'
                  }
                  onClick={() => setPaused(!paused)}
                >
                  <Icon name={paused ? 'play' : 'pause'} />
                </button>
              </div>
            </div>

            <div className="scene-signature" aria-hidden="true">
              <span>蜀 地</span>
              <span className="vertical-rule" />
              <span>春 光</span>
            </div>

            {phase !== 'ready' && (
              <div className={`state-overlay ${phase === 'error' ? 'error-state' : ''}`}>
                <div className="state-card" role={phase === 'error' ? 'alert' : 'status'}>
                  <Icon name="overview" />
                  <h2>{phase === 'error' ? '山水稍候，诗意仍在' : '正在铺开春日山水'}</h2>
                  <p>{phase === 'error' ? error : '柳色、江水与远山，就要来到眼前。'}</p>
                  {phase === 'error' ? (
                    <button
                      type="button"
                      className="retry-button"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      重新载入山水
                    </button>
                  ) : (
                    <span className="loading-line" />
                  )}
                </div>
              </div>
            )}

            <div className="scene-bottom">
              <span className="interaction-hint">
                <Icon name="mouse" />
                <span className="desktop-hint">
                  拖动环顾
                  <span className="hint-separator" aria-hidden="true">
                    ·
                  </span>
                  滚轮缩放
                </span>
                <span className="mobile-hint">
                  单指环顾
                  <span className="hint-separator" aria-hidden="true">
                    ·
                  </span>
                  双指缩放
                </span>
              </span>
              <button
                type="button"
                className="overview-button"
                data-testid="overview"
                aria-pressed={viewId === 'overview'}
                onClick={() => selectView('overview')}
              >
                <Icon name="overview" />
                回到全景
              </button>
            </div>
          </div>

          <div className="scene-caption" aria-live="polite" aria-atomic="true">
            <div>
              <span className="caption-number">
                {viewId === 'overview' ? '序' : `0${currentIndex + 1}`}
              </span>
              <div>
                <h2>{view.label}</h2>
                <p>{view.description}</p>
              </div>
            </div>
            <span className="view-counter">
              {viewId === 'overview' ? '全景' : `0${currentIndex + 1}`}
              <span>/</span>04
            </span>
          </div>
          <div className="world-footnote">
            <span>一窗收远近，一眼见春秋。</span>
            <span>DU FU · A SPRING BY THE COTTAGE</span>
          </div>
        </section>
      </main>

      <dialog
        className="source-dialog"
        ref={sourceDialog}
        aria-labelledby="source-title"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) sourceDialog.current?.close();
        }}
      >
        <button
          type="button"
          className="dialog-close icon-button"
          aria-label="关闭诗词说明"
          onClick={() => sourceDialog.current?.close()}
        >
          <Icon name="close" />
        </button>
        <div className="eyebrow">诗词与出处</div>
        <h2 id="source-title">
          绝句 <span>唐 · 杜甫</span>
        </h2>
        <div className="source-verses">
          {verses.map((verse) => (
            <p key={verse.id}>{verse.verse}</p>
          ))}
        </div>
        <p>{poem.interpretation}</p>
        <a href={poem.sourceUrl} target="_blank" rel="noreferrer">
          {poem.sourceName}
          <Icon name="arrow" />
        </a>
      </dialog>
    </div>
  );
}
