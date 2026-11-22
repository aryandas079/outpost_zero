import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { buildWestTownArena } from '../src/game/arena';
import { batchDecoration, craftedBox } from '../src/game/geometry';
import { AdaptiveRenderQuality } from '../src/game/renderQuality';
import type { ProceduralTextures } from '../src/game/textures';
import { FrameMetrics, GpuFrameTimer } from '../src/game/frameMetrics';
import { StaticSceneBatches } from '../src/game/staticBatches';
import { PerformanceMaterials } from '../src/game/performanceMaterials';
import { CachedSky } from '../src/game/cachedSky';
import { FirstPersonWeaponRig } from '../src/game/weapon';
import { EnemyFactory } from '../src/game/enemies';
import { GRAPHICS_PRESETS, normalizeGameSettings } from '../src/game/graphicsSettings';
import { tailoredLimb } from '../src/game/operatorModels';

test('tailored glove surfaces face outward along their length and close at both ends',()=>{
  const g=tailoredLimb([[0,0,0],[0,.5,0],[0,1,0]],[[.1,.1],[.1,.1],[.1,.1]],12,12);
  const p=g.attributes.position,index=g.index!;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.count;i+=3) {
    a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));
    const center=a.clone().add(b).add(c).divideScalar(3),normal=b.clone().sub(a).cross(c.clone().sub(a));
    const outward=center.clone().sub(new THREE.Vector3(0,.5,0));
    assert.ok(normal.dot(outward)>0,'Gloves must render their exterior rather than hollow backfaces');
  }
  g.dispose();
});

test('grenade presentation releases and restores the weapon without exposing a scoped viewmodel',()=>{
  const texture=new THREE.CanvasTexture({width:1,height:1} as HTMLCanvasElement);
  const rig=new FirstPersonWeaponRig(new Proxy({},{get:()=>texture}) as ProceduralTextures);
  const parts=rig as unknown as {weaponPivot:THREE.Group;activeThrowable:THREE.Group};
  rig.triggerGrenadeThrow('frag');
  rig.update(.15,0,true,false,false,0,1);
  assert.equal(parts.weaponPivot.visible,false);
  assert.equal(parts.activeThrowable.visible,true);
  assert.ok(!new THREE.Box3().setFromObject(parts.activeThrowable).isEmpty());
  rig.update(.6,0,true,false,false,0,1);
  assert.equal(parts.weaponPivot.visible,true);
  assert.equal(parts.activeThrowable.visible,false);
  rig.setScopeOverlayHidden(true);
  rig.update(.016,0,true,true,false,0,1);
  assert.equal(parts.weaponPivot.visible,false,'Scope visibility survives subsequent animation updates');
  rig.setScopeOverlayHidden(false);
  rig.triggerGrenadeThrow('smoke');
  rig.cancelGrenadeThrow();
  assert.equal(parts.activeThrowable.visible,false);
  assert.equal(parts.weaponPivot.visible,true);
  rig.dispose();texture.dispose();
});

test('crafted geometry has finite attributes and preserves collision extents', () => {
  for (const dimensions of [[1, 2, 0.44], [0.055, 0.072, 0.042], [2, 0.012, 0.4]]) {
    const geometry = craftedBox(...dimensions as [number, number, number]);
    geometry.computeBoundingBox();
    assert.equal((geometry.index?.count ?? geometry.attributes.position.count) / 3,
      Math.min(...dimensions) < 0.06 ? 12 : 44);
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    dimensions.forEach((expected, axis) => assert.ok(Math.abs(size.getComponent(axis) - expected) < 0.00001));
    for (const attribute of Object.values(geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite));
    }
    geometry.dispose();
  }
});

test('crafted box triangles form a closed outward-facing surface', () => {
  const geometry = craftedBox(1, 2, 0.44);
  const positions = geometry.attributes.position;
  const edges = new Map<string, number>();
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < positions.count; i += 3) {
    vertices.forEach((vertex, index) => vertex.fromBufferAttribute(positions, i + index));
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
    assert.ok(normal.dot(vertices[0]) > 0, 'Every triangle must face away from the center');
    const keys = vertices.map(vertex => vertex.toArray().map(value => value.toFixed(6)).join(','));
    for (let edge = 0; edge < 3; edge++) {
      const key = [keys[edge], keys[(edge + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) assert.equal(count, 2, 'Every edge must meet exactly two triangles');
  geometry.dispose();
});

test('batching preserves collision, ray targets, transforms and animation boundaries', () => {
  const root = new THREE.Group();
  const moving = new THREE.Group();
  root.add(moving);
  const material = new THREE.MeshStandardMaterial();
  const targets: THREE.Object3D[] = [];
  for (let i = 0; i < 7; i++) {
    const mesh = new THREE.Mesh(craftedBox(0.1, 0.2, 0.3), material);
    mesh.position.x = i;
    mesh.userData.noCollide = i !== 5;
    root.add(mesh);
    targets.push(mesh);
  }
  const animated = targets[6];
  moving.add(animated);
  const before = new THREE.Box3().setFromObject(root);
  const owned: THREE.BufferGeometry[] = [];
  const result = batchDecoration(root, new Set([targets[4]]), new Set([moving]), owned);
  assert.deepEqual(result, { before: 4, after: 1 });
  assert.equal(targets[4].parent, root);
  assert.equal(targets[5].parent, root);
  assert.equal(animated.parent, moving);
  const after = new THREE.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < 0.00001);
  assert.ok(before.max.distanceTo(after.max) < 0.00001);
});

test('complete arena builds with valid geometry and retained gameplay targets', () => {
  // Geometry-only fixture; the browser owns the canvas texture generation.
  const texture = new THREE.CanvasTexture({ width: 1, height: 1 } as HTMLCanvasElement);
  const textures = new Proxy({}, {
    get: (_, key) => key === 'createSignTexture' ? () => texture : texture,
  }) as ProceduralTextures;
  const arena = buildWestTownArena(textures);
  const members = new Set<THREE.Object3D>();
  let meshes = 0;
  arena.group.traverse(object => {
    members.add(object);
    if (object instanceof THREE.Mesh) {
      meshes++;
      assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
    }
  });
  for (const target of [...arena.shootableMeshes, ...arena.walkableMeshes]) assert.ok(members.has(target));
  const { before, after } = arena.group.userData.decorationBatching;
  assert.ok(before > after * 3, `Expected substantial batching, got ${before} -> ${after}`);
  console.log(`Arena: ${meshes} meshes; decoration draws ${before} -> ${after}; ${arena.colliders.length} colliders`);
  arena.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-15, 1.6, 1.4), new THREE.Vector3(0, 0, -1));
  const hitsBefore = ray.intersectObjects(arena.shootableMeshes, false);
  const batching = arena.optimizeRendering();
  const hitsAfter = ray.intersectObjects(arena.shootableMeshes, false);
  assert.deepEqual(hitsAfter.map(hit => [hit.object.uuid, hit.distance]), hitsBefore.map(hit => [hit.object.uuid, hit.distance]));
  assert.ok(batching.before > batching.after * 1.5);
  const animated = arena.animatedProps.windmillWheel!;
  const previous = animated.matrixWorld.clone();
  animated.rotation.z += 0.5;
  arena.group.updateMatrixWorld(true);
  assert.ok(!animated.matrixWorld.equals(previous), 'Windmill must keep animating under frozen parents');
  let optimizedMeshes = 0;
  arena.group.traverse(object => { if (object instanceof THREE.Mesh) optimizedMeshes++; });
  console.log(`Static draws: ${batching.before} -> ${batching.after}; total scene meshes ${meshes} -> ${optimizedMeshes}`);
  const animatedRoots = new Set<THREE.Object3D>(arena.animatedProps.tumbleweeds.map(item => item.mesh));
  animatedRoots.add(animated);
  if (arena.animatedProps.flagMesh) animatedRoots.add(arena.animatedProps.flagMesh);
  const multiDraw = new StaticSceneBatches(arena.group, animatedRoots);
  assert.ok(multiDraw.sourceCount > multiDraw.batchCount * 3);
  ray.layers.enable(31);
  assert.deepEqual(ray.intersectObjects(arena.shootableMeshes, false).map(hit => [hit.object.uuid, hit.distance]),
    hitsBefore.map(hit => [hit.object.uuid, hit.distance]));
  console.log(`Multi-draw: ${multiDraw.sourceCount} static meshes -> ${multiDraw.batchCount} submission groups`);
  multiDraw.dispose();
  arena.dispose();
  texture.dispose();
});

test('200 FPS quality uses rendering work independently of refresh timing', () => {
  const quality = new AdaptiveRenderQuality(1, 200);
  let ratio = 1;
  for (let i = 0; i < 900; i++) ratio = quality.sample(2, 16.67) ?? ratio;
  assert.equal(ratio, 1, 'A 60 Hz display must not trigger downscaling when rendering is fast');
  for (let i = 0; i < 900; i++) ratio = quality.sample(10, 16.67) ?? ratio;
  assert.ok(Math.abs(ratio - 0.7) < 0.00001);
});

test('multi-draw batches retain ray targets and follow parent visibility', () => {
  const root = new THREE.Group();
  const room = new THREE.Group();
  room.position.z = -5;
  root.add(room);
  const material = new THREE.MeshStandardMaterial();
  const sources: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(craftedBox(1, 1, 1), material);
    mesh.position.x = i * 2;
    room.add(mesh);
    sources.push(mesh);
  }
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
  const before = ray.intersectObjects(sources, false);
  const batches = new StaticSceneBatches(root, new Set());
  assert.equal(batches.sourceCount, 4);
  assert.equal(batches.batchCount, 1);
  for (const source of sources) assert.equal(source.parent, null, 'Masked originals should not be traversed by the renderer');
  ray.layers.enable(31);
  const after = ray.intersectObjects(sources, false);
  assert.deepEqual(after.map(hit => hit.distance), before.map(hit => hit.distance));
  const batch = root.children.find(child => child instanceof THREE.BatchedMesh) as THREE.BatchedMesh;
  room.visible = false;
  batches.updateVisibility();
  for (let i = 0; i < 4; i++) assert.equal(batch.getVisibleAt(i), false);
  room.visible = true;
  batches.updateVisibility();
  for (let i = 0; i < 4; i++) assert.equal(batch.getVisibleAt(i), true);
  batches.dispose();
  for (const source of sources) {
    assert.equal(source.layers.mask, 1);
    assert.equal(source.parent, room);
  }
});

test('frame metrics report measured FPS and worst frame time', () => {
  const metrics = new FrameMetrics();
  for (let i = 0; i < 200; i++) metrics.sample(5);
  assert.equal(metrics.fps, 200);
  assert.equal(metrics.frameMs, 5);
  assert.equal(metrics.averageFps, 200);
  assert.equal(metrics.peakFps, 200);
  for (let i = 0; i < 99; i++) metrics.sample(10);
  metrics.sample(20);
  assert.equal(metrics.worstFrameMs, 20);
  assert.equal(metrics.fps, 99);
  metrics.sample(1000);
  assert.equal(metrics.worstFrameMs, 1000, 'Foreground stalls must be visible in the statistics');
  metrics.reset();
  assert.equal(metrics.averageFps, 0);
  assert.equal(metrics.peakFps, 0);
});

test('prepared enemy rigs share geometry but isolate hits, health, materials and animation', () => {
  const texture = new THREE.Texture();
  const textures = new Proxy({}, { get: () => texture }) as ProceduralTextures;
  const factory = new EnemyFactory(textures);
  const warmup = factory.createWarmupGroup();
  assert.equal(warmup.children.length, 3);
  for (const kind of ['striker', 'sentinel', 'wasp'] as const) {
    const a = factory.createEnemy(kind, new THREE.Vector3(1, 0, 2), 1);
    const b = factory.createEnemy(kind, new THREE.Vector3(3, 0, 4), 1.5);
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.root, b.root);
    assert.ok(a.root.position.equals(new THREE.Vector3(1, 0, 2)));
    assert.equal(b.maxHp, Math.round(a.maxHp * 1.5));
    assert.notEqual(a.bodyMaterials[0], b.bodyMaterials[0]);
    assert.notEqual(a.coreMaterial, b.coreMaterial);
    assert.equal((a.hitMeshes[0] as THREE.Mesh).geometry, (b.hitMeshes[0] as THREE.Mesh).geometry);
    const members = new Set<THREE.Object3D>();
    a.root.traverse(object => members.add(object));
    for (const hit of a.hitMeshes) {
      assert.ok(members.has(hit));
      assert.equal(hit.userData.enemyId, a.id);
    }
    if (a.leftKnee) {
      assert.ok(members.has(a.leftKnee));
      const rotation = b.leftKnee!.rotation.x;
      a.leftKnee.rotation.x = 1;
      assert.equal(b.leftKnee!.rotation.x, rotation);
    }
    factory.disposeEnemyMaterials(a);
    factory.disposeEnemyMaterials(b);
  }
  factory.dispose();
  texture.dispose();
});

test('GPU timer never reads a pending query result or blocks on unsupported GPUs', () => {
  const unsupported = new GpuFrameTimer({ getExtension: () => null } as unknown as WebGL2RenderingContext);
  unsupported.begin(); unsupported.end(); unsupported.dispose();
  let ready = false;
  let ends = 0;
  let deleted = 0;
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    getExtension: () => ({ TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 }),
    createQuery: () => ({}), beginQuery: () => {},
    endQuery: () => { ends++; }, deleteQuery: () => { deleted++; },
    getParameter: () => false,
    getQueryParameter: (_: unknown, parameter: number) => {
      if (parameter === 1) return ready;
      assert.ok(ready, 'Must not synchronously read a pending GPU query');
      return 2500000;
    },
  } as unknown as WebGL2RenderingContext;
  const timer = new GpuFrameTimer(gl);
  for (let i = 0; i < 24; i++) { timer.begin(); timer.end(); }
  assert.equal(ends, 1);
  ready = true;
  timer.begin(); timer.end();
  assert.equal(timer.milliseconds, 2.5);
  timer.dispose();
  assert.equal(deleted, 1);
});

test('adaptive quality responds to slow frames, recovers, and respects its bounds', () => {
  const quality = new AdaptiveRenderQuality(1.5);
  let ratio = 1.5;
  for (let i = 0; i < 900; i++) ratio = quality.sample(33.3) ?? ratio;
  assert.ok(Math.abs(ratio - 0.7) < 0.00001);
  for (let i = 0; i < 6000; i++) ratio = quality.sample(16.67) ?? ratio;
  assert.equal(ratio, 1.5);
  assert.equal(quality.sample(NaN), null);
  assert.equal(quality.sample(10000), null);
  const slow = new AdaptiveRenderQuality(1);
  let slowRatio = 1;
  for (let i = 0; i < 100; i++) slowRatio = slow.sample(200) ?? slowRatio;
  assert.ok(slowRatio < 1, 'Very slow rendering must also reduce resolution');
});

test('high-refresh quality responds quickly and uses its configured lower bound', () => {
  const quality = new AdaptiveRenderQuality(0.85, 120, 0.45);
  let ratio = 0.85;
  for (let i = 0; i < 90; i++) ratio = quality.sample(30, 33.3) ?? ratio;
  assert.ok(ratio <= 0.46, `Slow GPU must reach the lower bound quickly; got ${ratio}`);
  for (let i = 0; i < 200; i++) ratio = quality.sample(7.5, 8.33) ?? ratio;
  assert.ok(ratio <= 0.46, 'Resolution must not oscillate upward without rendering headroom');
});

test('performance materials preserve surface relief, flags, sharing, and glass', () => {
  const root = new THREE.Group();
  const map = new THREE.Texture();
  const normal = new THREE.Texture();
  const original = new THREE.MeshStandardMaterial({ map, normalMap: normal, vertexColors: true, polygonOffset: true });
  original.normalScale.set(0.4, 0.6);
  original.userData.surface = 'wood';
  const a = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const b = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ transparent: true }));
  const originalGlass = glass.material;
  root.add(a, b, glass);
  const materials = new PerformanceMaterials();
  materials.apply(root);
  const fast = a.material as unknown as THREE.MeshPhongMaterial;
  assert.ok(fast instanceof THREE.MeshPhongMaterial);
  assert.equal(fast, b.material);
  assert.equal(fast.map, map);
  assert.equal(fast.normalMap, normal);
  assert.ok(fast.normalScale.equals(original.normalScale));
  assert.equal(fast.vertexColors, true);
  assert.equal(fast.polygonOffset, true);
  assert.equal(fast.userData.surface, 'wood');
  assert.equal(glass.material, originalGlass);
  materials.dispose();
});

test('cached sky refreshes at low frequency and preserves pending world shadows', () => {
  const world = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  const sky = new CachedSky(dome, world);
  let captures = 0;
  const renderer = { shadowMap: { needsUpdate: true } } as THREE.WebGLRenderer;
  (sky as unknown as { camera: { update: (renderer: THREE.WebGLRenderer) => void } }).camera.update = () => {
    captures++;
    renderer.shadowMap.needsUpdate = false;
  };
  sky.update(renderer, 0);
  for (let i = 0; i < 100; i++) sky.update(renderer, 0.005);
  assert.equal(captures, 2);
  assert.equal(renderer.shadowMap.needsUpdate, true);
  assert.ok(world.background instanceof THREE.CubeTexture);
  sky.dispose();
});

test('weapon batching retains animated magazines, casing meshes, and switchable rigs', () => {
  const texture = new THREE.CanvasTexture({ width: 1, height: 1 } as HTMLCanvasElement);
  const textures = new Proxy({}, { get: () => texture }) as ProceduralTextures;
  const rig = new FirstPersonWeaponRig(textures);
  assert.ok(rig.root.userData.rigidBatching.before > rig.root.userData.rigidBatching.after);
  const parts = rig as unknown as { carbineMag: THREE.Mesh; railMag: THREE.Mesh; shells: Array<{ mesh: THREE.Mesh }> };
  assert.ok(parts.carbineMag.parent);
  assert.ok(parts.railMag.parent);
  assert.equal(parts.carbineMag.matrixAutoUpdate, true);
  for (const shell of parts.shells) assert.equal(shell.mesh.matrixAutoUpdate, true);
  console.log(`Weapon rigid draws: ${rig.root.userData.rigidBatching.before} -> ${rig.root.userData.rigidBatching.after}`);
  rig.dispose();
  texture.dispose();
});

test('graphics presets preserve visual quality and sanitize saved preferences', () => {
  assert.equal(GRAPHICS_PRESETS.quality.resolutionScale, 1);
  assert.equal(GRAPHICS_PRESETS.quality.dynamicResolution, false);
  assert.equal(GRAPHICS_PRESETS.balanced.targetFps, 100);
  assert.equal(GRAPHICS_PRESETS.performance.targetFps, 144);
  const normalized = normalizeGameSettings({
    sensitivity: 99,
    resolutionScale: 0.1,
    targetFps: 123,
    shadowQuality: 'cinematic',
    textureFiltering: 16,
  });
  assert.equal(normalized.sensitivity, 2.2);
  assert.equal(normalized.resolutionScale, 0.5);
  assert.equal(normalized.targetFps, 100);
  assert.equal(normalized.shadowQuality, 'high');
  assert.equal(normalized.textureFiltering, 4);
  assert.equal(normalized.controls.forward, 'KeyW');
  assert.equal(normalized.controls.scopeZoom, 'KeyZ');

  const customControls = normalizeGameSettings({ controls: { forward: 'ArrowUp', reload: 'KeyT' } });
  assert.equal(customControls.controls.forward, 'ArrowUp');
  assert.equal(customControls.controls.reload, 'KeyT');
  assert.equal(customControls.controls.sidearm, 'Digit3');
});
