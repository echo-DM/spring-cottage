import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLandscape } from './landscape';
import { getView, type View, type ViewId } from './poem';

interface WorldOptions {
  view: ViewId;
  paused: boolean;
  reducedMotion: boolean;
  onReady: () => void;
  onFailure: (message: string) => void;
  onExplore: () => void;
  onArrive: () => void;
}

export interface WorldSnapshot {
  sceneId: string;
  ready: boolean;
  view: ViewId;
  flying: boolean;
  paused: boolean;
  reducedMotion: boolean;
  contextLost: boolean;
  compact: boolean;
  frameCount: number;
  animationTime: number;
  drawCalls: number;
  triangles: number;
  fps: number;
  pixelRatio: number;
  camera: number[];
  target: number[];
}

export interface WorldController {
  selectView: (id: ViewId) => void;
  setMotion: (paused: boolean, reducedMotion: boolean) => void;
  snapshot: () => WorldSnapshot;
  dispose: () => void;
}

declare global {
  interface Window {
    readonly __springCottage?: WorldSnapshot;
  }
}

interface Flight {
  start: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  destination: View;
  lift: number;
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((mat) => {
        materials.add(mat);
      });
      if (object instanceof THREE.InstancedMesh) object.dispose();
    }
    if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
  });
  geometries.forEach((geometry) => {
    geometry.dispose();
  });
  materials.forEach((material) => {
    material.dispose();
  });
  scene.clear();
}

export function createWorld(host: HTMLDivElement, options: WorldOptions): WorldController {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1600);
  const canvas = renderer.domElement;
  canvas.className = 'world-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    '草堂春日山水。拖动环顾，滚轮或双指缩放；使用诗句按钮抵达各处景观。',
  );
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color('#d2e5df');
  scene.fog = new THREE.Fog('#d2e5df', 170, 490);
  scene.add(new THREE.HemisphereLight('#fff3d5', '#657d65', 2.4));
  const sun = new THREE.DirectionalLight('#fff0cb', 3.1);
  sun.position.set(-65, 115, 60);
  sun.target.position.set(-6, 0, -5);
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, {
    left: -95,
    right: 95,
    top: 100,
    bottom: -90,
    near: 2,
    far: 290,
  });
  sun.shadow.normalBias = 0.12;
  sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target);

  let compact = host.clientWidth < 640 || window.matchMedia('(pointer: coarse)').matches;
  let landscape: ReturnType<typeof createLandscape>;
  try {
    landscape = createLandscape(scene, compact);
  } catch (error) {
    disposeScene(scene);
    renderer.dispose();
    canvas.remove();
    throw error;
  }
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !options.reducedMotion;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.75;
  controls.minPolarAngle = 0.06;

  let currentView = options.view;
  let paused = options.paused;
  let reducedMotion = options.reducedMotion;
  let flight: Flight | null = null;
  let ready = false;
  let contextLost = false;
  let disposed = false;
  let frameId = 0;
  let frameCount = 0;
  let animationTime = 0;
  let lastFrame = 0;
  let fpsStart = 0;
  let fpsFrames = 0;
  let fps = 0;
  const destinationPosition = new THREE.Vector3();
  const destinationTarget = new THREE.Vector3();

  function applyLimits(view: View) {
    controls.minDistance = view.minDistance;
    controls.maxDistance = view.maxDistance;
    controls.maxPolarAngle = view.maxPolarAngle;
  }

  function arrive(view: View) {
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    applyLimits(view);
    controls.update();
    flight = null;
    options.onArrive();
  }
  arrive(getView(currentView));

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    compact = width < 640 || window.matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !compact;
    sun.castShadow = !compact;
    camera.aspect = width / height;
    camera.fov = compact ? 53 : 43;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function selectView(id: ViewId) {
    if (disposed) return;
    currentView = id;
    const destination = getView(id);
    // Flush residual damping before capturing the new flight's actual start.
    controls.minDistance = 0.5;
    controls.maxDistance = 350;
    controls.maxPolarAngle = Math.PI * 0.94;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = !reducedMotion;
    if (reducedMotion) {
      arrive(destination);
      return;
    }
    destinationPosition.set(...destination.position);
    flight = {
      start: performance.now(),
      position: camera.position.clone(),
      target: controls.target.clone(),
      destination,
      lift: Math.min(32, camera.position.distanceTo(destinationPosition) * 0.15),
    };
  }

  function startExploring() {
    flight = null;
    // Broad limits avoid snapping the interrupted flight to a preset's limits.
    controls.minDistance = 4;
    controls.maxDistance = 220;
    controls.maxPolarAngle = Math.PI * 0.78;
    options.onExplore();
  }
  controls.addEventListener('start', startExploring);

  function render(now: number) {
    frameId = 0;
    if (disposed || contextLost || document.hidden) return;
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.06) : 0;
    lastFrame = now;
    if (!paused && !reducedMotion) animationTime += delta;
    landscape.animate(animationTime);
    if (flight) {
      const progress = Math.min(1, Math.max(0, (now - flight.start) / 2100));
      const eased = progress * progress * (3 - 2 * progress);
      destinationPosition.set(...flight.destination.position);
      destinationTarget.set(...flight.destination.target);
      camera.position.lerpVectors(flight.position, destinationPosition, eased);
      camera.position.y += Math.sin(progress * Math.PI) * flight.lift;
      controls.target.lerpVectors(flight.target, destinationTarget, eased);
      if (progress === 1) arrive(flight.destination);
    }
    controls.update();
    renderer.render(scene, camera);
    frameCount++;
    fpsFrames++;
    if (now - fpsStart >= 1000) {
      fps = Math.round((fpsFrames * 1000) / (now - fpsStart));
      fpsStart = now;
      fpsFrames = 0;
    }
    if (!ready) {
      ready = true;
      options.onReady();
    }
    frameId = requestAnimationFrame(render);
  }

  function schedule() {
    if (!disposed && !contextLost && !document.hidden && !frameId) {
      lastFrame = 0;
      fpsStart = performance.now();
      fpsFrames = 0;
      frameId = requestAnimationFrame(render);
    }
  }

  function loseContext(event: Event) {
    event.preventDefault();
    contextLost = true;
    ready = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
    options.onFailure('画面暂时中断，诗还在这里。图形连接恢复后将继续，也可以重新载入山水。');
  }

  function restoreContext() {
    contextLost = false;
    resize();
    schedule();
  }

  function visibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else {
      schedule();
    }
  }

  canvas.addEventListener('webglcontextlost', loseContext);
  canvas.addEventListener('webglcontextrestored', restoreContext);
  document.addEventListener('visibilitychange', visibilityChange);
  schedule();

  const controller: WorldController = {
    selectView,
    setMotion(nextPaused, nextReducedMotion) {
      paused = nextPaused;
      reducedMotion = nextReducedMotion;
      controls.enableDamping = !reducedMotion;
      if (reducedMotion && flight) arrive(flight.destination);
    },
    snapshot: () => ({
      sceneId: scene.uuid,
      ready,
      view: currentView,
      flying: Boolean(flight),
      paused,
      reducedMotion,
      contextLost,
      compact,
      frameCount,
      animationTime,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      fps,
      pixelRatio: renderer.getPixelRatio(),
      camera: camera.position.toArray(),
      target: controls.target.toArray(),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      ready = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', startExploring);
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      document.removeEventListener('visibilitychange', visibilityChange);
      disposeScene(scene);
      renderer.dispose();
      if (!contextLost) renderer.forceContextLoss();
      canvas.remove();
      Reflect.deleteProperty(window, '__springCottage');
    },
  };
  Object.defineProperty(window, '__springCottage', {
    configurable: true,
    get: controller.snapshot,
  });
  return controller;
}
