import * as THREE from 'three';

type Vec3 = readonly [number, number, number];
interface Block {
  position: Vec3;
  size: Vec3;
  color: string;
  rotation?: number;
}

// A fixed seed keeps every visit and camera view in the same landscape.
function randomGenerator(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function riverCenter(z: number): number {
  return 12 + Math.sin(z * 0.025) * 12 + Math.sin(z * 0.01 + 1) * 6;
}

function riverWidth(z: number): number {
  return 11.5 + Math.sin(z * 0.027 + 2) * 2;
}

export function groundHeight(x: number, z: number): number {
  const bank = Math.abs(x - riverCenter(z)) - riverWidth(z);
  if (bank < 0) return -0.4;
  if (bank < 3) return 1;
  if (x > -38 && x < -8 && z > -24 && z < 5) return 3;
  const rise = Math.max(0, Math.abs(x + 10) - 45) * 0.085;
  const rolling = Math.sin(x * 0.047) * Math.cos(z * 0.037) * 1.9;
  return Math.max(1.5, Math.round((3.8 + rise + rolling) * 2) / 2);
}

class Blocks {
  private entries: Block[] = [];

  add(position: Vec3, size: Vec3, color: string, rotation = 0) {
    this.entries.push({ position, size, color, rotation });
  }

  build(
    parent: THREE.Object3D,
    geometry: THREE.BoxGeometry,
    material: THREE.Material,
    shadows = true,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.entries.length);
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    this.entries.forEach((entry, index) => {
      transform.position.set(...entry.position);
      transform.scale.set(...entry.size);
      transform.rotation.set(0, entry.rotation ?? 0, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, color.set(entry.color));
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
    return mesh;
  }
}

interface Bird {
  body: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
}

export interface Landscape {
  animate: (time: number) => void;
}

export function createLandscape(scene: THREE.Scene, compact: boolean): Landscape {
  const random = randomGenerator(764);
  const choose = (colors: readonly string[]) => colors[Math.floor(random() * colors.length)];
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.93,
    flatShading: true,
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.35,
    metalness: 0.18,
  });
  const grass = ['#9ab879', '#a6bd82', '#aec58d', '#91af72', '#b2c88e', '#9db87a'];
  const sand = ['#cfca9a', '#c8c699', '#d7d1a3'];
  const water = ['#5ca89c', '#66b0a3', '#74b8aa', '#67ada1', '#80c0ae'];
  const earth = new Blocks();
  const river = new Blocks();
  const mountains = new Blocks();
  const planting = new Blocks();
  const buildings = new Blocks();

  // Contiguous stepped ground and a curved, tiled river; no detached scene islands.
  for (let z = -134; z <= 130; z += 2) {
    for (let x = -144; x <= 144; x += 2) {
      const bank = Math.abs(x - riverCenter(z)) - riverWidth(z);
      const height = groundHeight(x, z);
      earth.add(
        [x, (height - 2) / 2, z],
        [2, height + 2, 2],
        bank < 5 ? choose(sand) : choose(grass),
      );
      if (bank < 0) river.add([x, 0.46, z], [2, 0.12, 2], choose(water));
    }
  }
  earth.build(scene, geometry, material, false).receiveShadow = true;
  river.build(scene, geometry, waterMaterial, false);

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ color: '#a1b492', roughness: 1 }),
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.y = -2.2;
  scene.add(horizon);

  const peaks = [
    [-28, -151, 74, 43],
    [22, -164, 61, 35],
    [-79, -150, 54, 38],
    [71, -179, 58, 44],
    [-126, -183, 57, 49],
    [127, -186, 45, 45],
  ];
  for (let z = -242; z < -78; z += 3.8) {
    for (let x = -174; x < 174; x += 3.8) {
      let height = 0;
      for (const [px, pz, peak, radius] of peaks) {
        const distance = Math.hypot((x - px) * 0.85, z - pz);
        height = Math.max(height, peak * Math.max(0, 1 - distance / radius));
      }
      if (height < 1) continue;
      height = Math.max(1, Math.round((height + Math.sin(x * 0.12 + z * 0.22) * 2) / 2) * 2);
      const snowy = height > 41 + Math.sin(x * 0.15) * 4;
      // Stacked sections preserve a rocky foothill beneath the bright snow cap.
      const base = snowy ? 36 : height;
      mountains.add(
        [x, base / 2, z],
        [3.8, base, 3.8],
        choose(['#6a8c80', '#7b9788', '#78978b', '#86a197']),
      );
      if (snowy) {
        mountains.add(
          [x, 36 + (height - 36) / 2, z],
          [3.8, height - 36, 3.8],
          choose(['#f4f5e9', '#e5eee6', '#edf3ee', '#d7e8e1']),
        );
      }
    }
  }
  mountains.build(scene, geometry, material, false).receiveShadow = true;

  function trunk(x: number, z: number, height: number, width: number) {
    const y = groundHeight(x, z);
    planting.add([x, y + height / 2, z], [width, height, width], '#776547');
    return y;
  }

  function tree(x: number, z: number, scale: number, pink = false) {
    const y = trunk(x, z, 5 * scale, 0.85 * scale);
    const leaves = pink
      ? ['#e7bdb1', '#edcbb7', '#dba8a4', '#f3d4c0']
      : ['#5f956c', '#719f70', '#85ac75', '#5e8f65', '#94b77e'];
    for (let i = 0; i < 25; i++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 3.4 * scale;
      planting.add(
        [
          x + Math.cos(angle) * radius,
          y + (5.3 + random() * 2.4) * scale,
          z + Math.sin(angle) * radius,
        ],
        [2.2 * scale, 2.1 * scale, 2.2 * scale],
        choose(leaves),
      );
    }
  }

  // Keep the four camera sightlines clear. Higher groves sit along the valley edges.
  const treeCount = compact ? 145 : 225;
  for (let i = 0; i < treeCount; i++) {
    const x = -122 + random() * 245;
    const z = -115 + random() * 224;
    if (Math.abs(x - riverCenter(z)) < riverWidth(z) + 7) continue;
    if (x > -43 && x < 43 && z > -38 && z < 65) continue;
    if (x > 50 && z > 45) continue;
    tree(x, z, 0.65 + random() * 0.7);
  }
  tree(-45, 11, 1.05, true);
  tree(-48, 31, 0.95, true);
  tree(-39, -36, 1.05);
  tree(48, -22, 1.1);
  tree(53, 20, 0.9);

  function willow(x: number, z: number, scale: number, hero = false) {
    const base = groundHeight(x, z);
    const b = (
      dx: number,
      dy: number,
      dz: number,
      sx: number,
      sy: number,
      sz: number,
      color: string,
    ) =>
      planting.add(
        [x + dx * scale, base + dy * scale, z + dz * scale],
        [sx * scale, sy * scale, sz * scale],
        color,
      );
    b(0, 4, 0, 1.1, 8, 1.1, '#84704e');
    b(-1.3, 7.5, 0, 3.7, 0.7, 0.8, '#84704e');
    b(1.8, 8, 0.5, 4.2, 0.7, 0.7, '#84704e');
    b(-2.6, 7.3, 2.9, 3, 0.35, 0.4, '#786345');
    b(2, 7.9, 1.9, 2.7, 0.35, 0.4, '#786345');
    const leafColors = ['#87b15c', '#9abe68', '#b2cb70', '#73a05b', '#a4c570'];
    for (let i = 0; i < 90; i++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 6;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      b(dx, 10 + random() * 1.8 - radius * 0.18, dz, 1.7, 1.35, 1.7, choose(leafColors));
    }
    const strands = compact ? 70 : 110;
    for (let i = 0; i < strands; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 3.1 + random() * 2.8;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      if (hero && dz > 1 && Math.abs(dx) < 4.1) continue;
      const length = 2 + random() * 4.8;
      const start = 10.1 - radius * 0.1;
      for (let j = 0; j < length; j += 0.5) {
        b(
          dx + Math.sin(j * 0.28) * 0.6,
          start - j,
          dz + j * 0.09,
          0.36,
          0.6,
          0.38,
          choose(leafColors),
        );
      }
    }
  }
  willow(1, 18, 1, true);
  willow(-1, -31, 0.8);
  willow(43, 54, 1.08);
  willow(1, 69, 0.7);

  // A worn path runs from the cottage door to the landing.
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const x = -22 + t * 32;
    const z = -1 + Math.sin(t * 1.7) * 23;
    buildings.add(
      [x, groundHeight(x, z) + 0.04, z],
      [2.3, 0.14, 2.7],
      choose(['#d9cfaa', '#d0c4a1', '#c7b996']),
      -0.5,
    );
  }

  // The northern wall contains an actual open window onto the snow mountains.
  const homeX = -22;
  const homeZ = -10;
  const floor = 3.45;
  buildings.add([homeX, floor, homeZ], [15, 0.9, 13], '#baa783');
  buildings.add([homeX, floor + 0.6, homeZ], [13.7, 0.35, 11.9], '#d5bf91');
  for (const x of [-29, -15]) {
    buildings.add([x, 7.8, homeZ], [0.5, 8.7, 13], '#ebe2bc');
  }
  buildings.add([homeX, 5.2, -16.3], [14, 3.4, 0.48], '#e8ddb6');
  buildings.add([homeX, 12.65, -16.3], [14, 0.8, 0.48], '#e8ddb6');
  for (const x of [-28, -16]) buildings.add([x, 9.5, -16.3], [2, 5.5, 0.48], '#e8ddb6');
  for (const x of [-27, -17]) buildings.add([x, 9.45, -16.5], [0.5, 5.8, 0.75], '#75563c');
  buildings.add([homeX, 6.8, -16.5], [10.5, 0.5, 0.85], '#75563c');
  buildings.add([homeX, 12.15, -16.5], [10.5, 0.5, 0.85], '#75563c');
  // Door and front facade; the doorway remains open.
  buildings.add([-27, 7.5, -3.7], [4, 7.5, 0.55], '#ece1bb');
  buildings.add([-17.5, 7.5, -3.7], [5, 7.5, 0.55], '#ece1bb');
  buildings.add([-22.5, 11.1, -3.7], [5, 0.7, 0.7], '#71593f');
  for (const x of [-29.3, -24.6, -20.1, -14.7]) {
    buildings.add([x, 8.2, -3.3], [0.55, 9.3, 0.55], '#795c3d');
  }
  for (let z = -18.5; z <= -1.5; z += 0.85) {
    for (let x = -30.5; x < -13.5; x += 1.7) {
      const y = 16.5 - Math.abs(z - homeZ) * 0.44;
      buildings.add(
        [x, y, z],
        [1.72, 0.52, 1.0],
        choose(['#a99465', '#b7a070', '#bba579', '#c5ae7f', '#b29a66']),
      );
    }
  }
  buildings.add([homeX, 16.7, homeZ], [18.3, 0.55, 0.75], '#8e774f');
  buildings.add([-22.4, 3.5, -1.8], [5.2, 0.6, 2.2], '#b0a17e');
  buildings.add([-22.4, 3.1, -0.6], [5.6, 0.4, 1], '#c9b58a');
  // Sparse interior detail helps the window view feel inhabited.
  buildings.add([-27, 5.2, -10], [2.4, 0.3, 3.6], '#a07d52');
  for (const z of [-11.3, -8.7]) buildings.add([-27, 4.5, z], [0.3, 1.5, 0.3], '#886442');
  buildings.add([-27, 5.45, -10], [1.1, 0.13, 1.5], '#f2e7cf');

  // Bamboo fence around the garden, with a clear route to the river.
  for (let x = -37; x < -9; x += 2) {
    const y = groundHeight(x, -25);
    buildings.add([x, y + 1, -25], [0.23, 2, 0.23], '#a99e67');
    buildings.add([x + 1, y + 1.4, -25], [2, 0.22, 0.22], '#b7ad78');
    buildings.add([x + 1, y + 0.7, -25], [2, 0.22, 0.22], '#b7ad78');
  }

  const dockY = 2.5;
  for (let x = 8; x < 20; x += 0.75) {
    buildings.add([x, dockY, 22], [0.72, 0.35, 4], choose(['#b29469', '#bfa278', '#aa8c61']));
  }
  for (const x of [8, 13, 18.5]) {
    for (const z of [20.1, 23.9]) {
      buildings.add([x, 1.2, z], [0.4, 3.5, 0.4], '#8c7452');
    }
  }
  buildings.add([18.3, 3.4, 23.8], [0.65, 1.3, 0.65], '#756040');
  buildings.add([20, 2.8, 23.8], [3.4, 0.1, 0.1], '#bba885');

  // Reeds and small flowers, sampled outside the house and water.
  for (let i = 0; i < (compact ? 1200 : 2100); i++) {
    const x = -95 + random() * 184;
    const z = -95 + random() * 204;
    const bank = Math.abs(x - riverCenter(z)) - riverWidth(z);
    if (bank < 2 || (x > -33 && x < -11 && z > -23 && z < 4)) continue;
    const y = groundHeight(x, z);
    const h = 0.35 + random() * 0.7;
    planting.add([x, y + h / 2, z], [0.15, h, 0.15], choose(['#719854', '#759f5a', '#87a565']));
    if (i % 4 === 0)
      planting.add(
        [x, y + h, z],
        [0.4, 0.23, 0.4],
        choose(['#f3e9b0', '#e6cf79', '#f1ddc6', '#f0efe1']),
      );
    if (bank < 6 && i % 3 === 0) {
      planting.add([x + 0.3, y + 0.7, z], [0.16, 1.4, 0.16], '#90a66e');
      planting.add([x + 0.3, y + 1.5, z], [0.28, 0.45, 0.28], '#b9b785');
    }
  }
  planting.build(scene, geometry, material);
  buildings.build(scene, geometry, material);

  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function box(parent: THREE.Object3D, position: Vec3, size: Vec3, color: string) {
    let mat = materials.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
      materials.set(color, mat);
    }
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function oriole(position: Vec3, rotation: number) {
    const bird = new THREE.Group();
    bird.position.set(...position);
    bird.rotation.y = rotation;
    bird.scale.setScalar(1.45);
    box(bird, [0, 0.2, 0], [0.8, 0.65, 1.15], '#f3c343');
    const head = new THREE.Group();
    head.position.set(0, 0.7, 0.45);
    bird.add(head);
    box(head, [0, 0, 0], [0.68, 0.65, 0.66], '#ffd455');
    box(head, [0, -0.03, 0.52], [0.24, 0.18, 0.45], '#da8b2d');
    for (const x of [-0.35, 0.35]) {
      box(head, [x, 0.04, 0.16], [0.03, 0.14, 0.18], '#343d2f');
      box(bird, [x * 1.1, 0.24, -0.14], [0.18, 0.38, 0.82], '#625745');
      box(bird, [x * 0.6, -0.24, 0.15], [0.07, 0.3, 0.08], '#78603a');
    }
    box(bird, [0, 0.06, -0.89], [0.48, 0.2, 0.9], '#89734a');
    scene.add(bird);
    return { bird, head, baseY: position[1] };
  }
  const orioles = [oriole([-1.6, 10.7, 20.9], 0.45), oriole([3.1, 11.3, 19.9], -0.6)];

  function egret(position: Vec3): Bird {
    const body = new THREE.Group();
    body.position.set(...position);
    body.rotation.y = 0.3;
    box(body, [0, 0, 0], [0.72, 0.62, 2.2], '#fffdf1');
    box(body, [0, 0.22, 1.1], [0.34, 0.38, 1.8], '#f8f7ee');
    box(body, [0, 0.46, 1.95], [0.46, 0.4, 0.65], '#fffdf1');
    box(body, [0, 0.43, 2.53], [0.17, 0.15, 0.72], '#bd963f');
    box(body, [0.245, 0.5, 2.1], [0.035, 0.11, 0.12], '#354347');
    for (const x of [-0.18, 0.18]) box(body, [x, -0.25, -1.65], [0.09, 0.1, 1.9], '#596762');
    const leftWing = new THREE.Group();
    const rightWing = new THREE.Group();
    leftWing.position.x = -0.27;
    rightWing.position.x = 0.27;
    body.add(leftWing, rightWing);
    for (const [wing, sign] of [
      [leftWing, -1],
      [rightWing, 1],
    ] as const) {
      box(wing, [sign * 0.85, 0.05, -0.15], [1.8, 0.22, 1.4], '#fdfcf3');
      box(wing, [sign * 2.1, -0.03, -0.48], [1.1, 0.18, 0.9], '#e4eee5');
      box(wing, [sign * 2.8, -0.07, -0.65], [0.6, 0.15, 0.57], '#f2f4e9');
    }
    scene.add(body);
    return { body, leftWing, rightWing };
  }
  const egrets: Bird[] = [];
  for (let i = 0; i < 7; i++) egrets.push(egret([-15 + i * 6.5, 27 + i * 0.95, -12 - i * 1.3]));

  function boat(x: number, z: number, scale: number, sail: boolean) {
    const group = new THREE.Group();
    group.position.set(x, 0.7, z);
    group.scale.setScalar(scale);
    group.rotation.y = 0.14;
    const planks = new Blocks();
    planks.add([0, 0, 0], [3.6, 0.7, 11.2], '#725a42');
    planks.add([0, 0.6, 0], [4.6, 0.6, 12.2], '#92714a');
    planks.add([0, 1, 0], [4.4, 0.23, 11.8], '#c0a476');
    for (const side of [-1, 1]) {
      planks.add([side * 2.2, 1.3, 0], [0.3, 0.8, 11.7], '#98764e');
      for (let j = 0; j < 3; j++) {
        planks.add(
          [0, 0.65 + j * 0.28, side * (6 + j * 0.55)],
          [3.6 - j * 0.9, 0.5, 0.75],
          '#a47f52',
        );
      }
    }
    for (let j = -5; j < 5; j += 0.7) planks.add([0, 1.15, j], [4.05, 0.08, 0.07], '#aa8d63');
    planks.add([0, 2.3, -2], [3.35, 2.2, 3.4], '#baaa7c');
    planks.add([0, 3.55, -2], [3.7, 0.45, 4], '#8b8d61');
    planks.add([0, 3.95, -2], [2.9, 0.4, 4], '#a0a074');
    planks.add([0, 4.3, -2], [1.7, 0.3, 4], '#b0ab7d');
    planks.add([0, 2.3, -0.25], [1.25, 1.6, 0.08], '#504e3d');
    if (sail) {
      planks.add([0, 6, 2], [0.26, 10.2, 0.26], '#937550');
      for (let j = 0; j < 7; j++) {
        const width = 4.9 - Math.abs(j - 3) * 0.42;
        planks.add([0.2, 4.4 + j * 0.85, 2.1], [width, 0.84, 0.14], '#eee3bc');
        planks.add([0.2, 4.0 + j * 0.85, 2.18], [width + 0.2, 0.08, 0.12], '#bdad80');
      }
      planks.add([0.1, 10.4, 2], [4.2, 0.15, 0.15], '#b19969');
    }
    planks.build(group, geometry, material);
    scene.add(group);
    return group;
  }
  const boats = [
    boat(23, 23, 1, true),
    boat(riverCenter(-30), -30, 0.7, true),
    boat(29.5, 42, 0.5, false),
  ];

  const shimmerGroup = new THREE.Group();
  const shimmer = new Blocks();
  for (let i = 0; i < 260; i++) {
    const z = -110 + random() * 230;
    const x = riverCenter(z) + (random() - 0.5) * riverWidth(z) * 1.5;
    shimmer.add([x, 0.54, z], [0.8 + random() * 1.9, 0.025, 0.12], '#d9efcb');
  }
  shimmer.build(
    shimmerGroup,
    geometry,
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
    false,
  );
  scene.add(shimmerGroup);

  const clouds = new THREE.Group();
  const cloudBlocks = new Blocks();
  for (const [x, y, z] of [
    [-85, 79, -135],
    [49, 89, -194],
    [98, 62, -84],
    [-145, 67, -115],
  ]) {
    for (let i = 0; i < 10; i++) {
      cloudBlocks.add(
        [x + random() * 24, y + random() * 3, z + random() * 9],
        [9 + random() * 8, 2.3 + random() * 2, 5 + random() * 5],
        '#fcf7e8',
      );
    }
  }
  cloudBlocks.build(
    clouds,
    geometry,
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    false,
  );
  scene.add(clouds);

  return {
    animate(time) {
      orioles.forEach(({ bird, head, baseY }, i) => {
        bird.position.y = baseY + Math.sin(time * 2 + i) * 0.035;
        head.rotation.y = Math.sin(time * 0.8 + i * 2) * 0.18;
        head.rotation.x = Math.sin(time * 1.4 + i) * 0.08;
      });
      egrets.forEach(({ body, leftWing, rightWing }, i) => {
        const flap = Math.sin(time * 2.4 + i * 0.55) * 0.38;
        leftWing.rotation.z = flap;
        rightWing.rotation.z = -flap;
        body.position.y = 27 + i * 0.95 + Math.sin(time * 1.1 + i) * 0.24;
        body.position.x = -15 + i * 6.5 + Math.sin(time * 0.16) * 2;
      });
      boats.forEach((group, i) => {
        group.position.y = 0.7 + Math.sin(time * 1.2 + i) * 0.055;
        group.rotation.z = Math.sin(time * 0.9 + i) * 0.008;
      });
      shimmerGroup.position.z = Math.sin(time * 0.4) * 0.35;
      clouds.position.x = Math.sin(time * 0.022) * 4;
    },
  };
}
