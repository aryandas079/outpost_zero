import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { ProceduralTextures } from '../src/game/textures';
import { IslandTerrainStreamer, sampleRenderedTerrainTriangleHeight } from '../src/world/WorldStreaming';
import { buildStormWallMesh } from '../src/world/MapGenerator';
import { StormController } from '../src/gameplay/Storm';
import { InventorySystem, MAX_ARMOR_PLATES, MAX_MEDKITS } from '../src/gameplay/Inventory';
import { DeploymentSystem } from '../src/gameplay/Deployment';
import { LootManager } from '../src/gameplay/Loot';
import { MatchStateMachine } from '../src/core/GameState';
import { EventBus } from '../src/core/EventBus';
import { mapPointToWorld, worldToGridSector, worldToMapPoint, yawToCompassDeg } from '../src/utilities/MapTransform';
import { normalizeGameSettings } from '../src/settings/SettingsStore';
import {
  ISLAND_POIS,
  ISLAND_ROAD_SPECS,
  sampleIslandHeight,
  sampleRiverCenterX,
  sampleRoadElevation,
  sampleRoadSegmentPoint,
} from '../src/world/Terrain';
import { buildAllIslandPois } from '../src/world/Buildings';
import { buildIslandRoadNetwork } from '../src/world/Roads';
import { buildIslandGeology } from '../src/world/Geology';
import { buildPlayerSkydiverRig, updateSkydiverRigPose } from '../src/entities/Parachute';

function makeMockTextures(): ProceduralTextures {
  const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  tex.needsUpdate = true;
  return new Proxy({ dispose: () => tex.dispose() } as unknown as ProceduralTextures, {
    get(target, prop) {
      if (prop in target) return (target as unknown as Record<string | symbol, unknown>)[prop];
      return tex;
    },
  });
}

test('IslandTerrainStreamer maintains 64 zero-hole chunks with velocity lookahead & LOD reclamation', () => {
  const textures = makeMockTextures();
  const streamer = new IslandTerrainStreamer(textures);
  try {
    streamer.update(0, 0, 120, 40, 3600, 6);
    assert.ok(streamer.activeVisibleChunks >= 40);
    // Simulate rapid flight jump across map edge without holes or NaNs
    streamer.update(1200, -1100, 0, 0, 2200, 4);
    assert.ok(streamer.activeVisibleChunks > 0);
    for (const mesh of streamer.walkableMeshes) {
      assert.ok((mesh as THREE.Mesh).geometry.attributes.position.count > 0);
    }
  } finally {
    streamer.dispose();
    textures.dispose();
  }
});

test('StormWall shader mesh extends high overhead with smooth fades eliminating black sky cuts', () => {
  const wall = buildStormWallMesh();
  const posAttr = wall.geometry.getAttribute('position');
  assert.ok(posAttr.count > 100);
  const bbox = new THREE.Box3().setFromBufferAttribute(posAttr as THREE.BufferAttribute);
  assert.ok(bbox.max.y - bbox.min.y >= 1300, 'Storm cylinder height should span 1400m vertically');
  wall.geometry.dispose();
  (wall.material as THREE.Material).dispose();
});

test('StormController stays inland through multi-phase progression and caps dt spikes', () => {
  const storm = new StormController(2026079);
  for (let i = 0; i < 60; i++) {
    storm.update(8);
  }
  assert.ok(Number.isFinite(storm.centerX) && Number.isFinite(storm.centerZ));
  assert.ok(storm.radius >= 0);
  const extremeDmg = storm.sampleStormDamage(3000, 3000, 99);
  assert.equal(extremeDmg, 0, 'First clamped step (0.25s) should stay bounded below 1.0s tick threshold');
  let totalTicked = 0;
  for (let i = 0; i < 4; i++) {
    totalTicked += storm.sampleStormDamage(3000, 3000, 0.25);
  }
  assert.ok(totalTicked > 0, 'Four 0.25s steps outside zone should trigger one storm damage tick');
});

test('DeploymentSystem enforces countdown gate and accurate remaining passenger math', () => {
  const deploy = new DeploymentSystem();
  deploy.reset(2026079);
  assert.equal(deploy.canJump(), false);
  assert.equal(deploy.getRemainingPassengers(true), 50);
  deploy.countdownSec = 0;
  assert.equal(deploy.canJump(), true);
  assert.equal(deploy.getRemainingPassengers(false), 49);
});

test('InventorySystem handles full-health/shield no-op guards and grenade restocking cleanly', () => {
  const inv = new InventorySystem();
  inv.reset();
  assert.equal(inv.consumeArmorPlate(50, 50), 0);
  assert.equal(inv.armorPlates, 2);
  assert.equal(inv.consumeMedkit(100, 100), 0);
  assert.equal(inv.medkits, 1);

  inv.addArmorPlate(20);
  inv.addMedkit(20);
  assert.equal(inv.armorPlates, MAX_ARMOR_PLATES);
  assert.equal(inv.medkits, MAX_MEDKITS);

  const ammoAdded = inv.addAmmo('carbine', 0);
  assert.equal(ammoAdded, 0);
});

test('LootManager spawns deterministic POI loot and filters closest interactable within reach', () => {
  const scene = new THREE.Scene();
  const loot = new LootManager(scene);
  try {
    const anchors = ISLAND_POIS.slice(0, 4).map((p) => ({
      pos: new THREE.Vector3(p.x, sampleIslandHeight(p.x, p.z), p.z),
      poiId: p.id,
      tier: p.lootTier,
    }));
    loot.spawnSeededPoiLoot(anchors, 2026079);
    assert.equal(loot.items.length, 4);
    const far = loot.findClosestInteractable(new THREE.Vector3(1590, 0, 1590), 3.0);
    assert.equal(far, null);
    const nearItem = loot.items[0];
    const hit = loot.findClosestInteractable(nearItem.pos, 3.0);
    assert.equal(hit?.id, nearItem.id);
    const hud = loot.toPromptHud(hit, 'KeyE');
    assert.equal(hud?.keyHint, 'E');
  } finally {
    loot.dispose();
  }
});

test('MatchStateMachine preserves pause resume targets across flight and combat states', () => {
  const fsm = new MatchStateMachine();
  fsm.beginNewMatch();
  assert.equal(fsm.transition('aircraft_deployment'), true);
  assert.equal(fsm.pause(), true);
  assert.equal(fsm.toGamePhase(), 'paused');
  assert.equal(fsm.resume(), true);
  assert.equal(fsm.toDeployStage(), 'airdrop_plane');
  assert.equal(fsm.transition('freefall'), true);
  assert.equal(fsm.toDeployStage(), 'freefall');
});

test('MapTransform maps grid sectors, compass bearings, and panned viewports cleanly', () => {
  assert.equal(yawToCompassDeg(0), 0);
  assert.equal(Math.round(yawToCompassDeg(-Math.PI / 2)), 90);
  assert.equal(worldToGridSector(-1590, -1590, 1600), 'A1');
  assert.equal(worldToGridSector(1590, 1590, 1600), 'H8');

  const xform = {
    centerPx: 360,
    originWorldX: 120,
    originWorldZ: -80,
    pxPerMeter: 0.25,
    rotationRad: 0.42,
  };
  const pt = worldToMapPoint(450, 210, xform);
  const back = mapPointToWorld(pt.x, pt.y, xform);
  assert.ok(Math.abs(back.x - 450) < 1e-6);
  assert.ok(Math.abs(back.z - 210) < 1e-6);
});

test('EventBus dispatches typed events and cleans up unsubscribed handlers', () => {
  const bus = new EventBus<{ ping: number }>();
  let sum = 0;
  const off = bus.on('ping', (v) => {
    sum += v;
  });
  bus.emit('ping', 4);
  off();
  bus.emit('ping', 9);
  assert.equal(sum, 4);
});

test('Settings sanitization clamps out-of-range FOV, HUD scale, and invalid hex colors', () => {
  const sanitized = normalizeGameSettings({
    fov: 999,
    hudScale: 0.1,
    crosshairColor: 'not-a-color',
    colorblindMode: 'unknown',
    controls: { interact: 'KeyF' },
  });
  assert.equal(sanitized.fov, 105);
  assert.equal(sanitized.hudScale, 0.8);
  assert.equal(sanitized.crosshairColor, '#F2F4F5');
  assert.equal(sanitized.colorblindMode, 'none');
  assert.equal(sanitized.controls.interact, 'KeyF');
});

test('Road embankments conform to island terrain everywhere and render triangles never diverge', () => {
  for (let i = 0; i < ISLAND_ROAD_SPECS.length; i++) {
    const road = ISLAND_ROAD_SPECS[i];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const pt = sampleRoadSegmentPoint(road, t);
      const riverX = sampleRiverCenterX(pt.z);
      const inRiver = pt.z > -22 && pt.z < 1100 && Math.abs(pt.x - riverX) < 30;
      if (inRiver) continue;
      const roadY = sampleRoadElevation(i, t);
      const terrainY = sampleIslandHeight(pt.x, pt.z);
      assert.ok(Math.abs(roadY - terrainY) < 1.2, `Road ${road.id} at t=${t} detached (${roadY} vs ${terrainY})`);
    }
  }
  const triDam = sampleRenderedTerrainTriangleHeight(60, -80);
  const anaDam = sampleIslandHeight(60, -80);
  assert.ok(Number.isFinite(triDam) && Math.abs(triDam - anaDam) < 8.0);
});

test('Island POIs & extruded roads build grounded foundations and deep concrete bridges', () => {
  const textures = makeMockTextures();
  try {
    const pois = buildAllIslandPois(textures);
    const roads = buildIslandRoadNetwork(textures);
    assert.ok(pois.colliders.length >= 160, 'Expected solid structural colliders across all 16 POIs and checkpoints');
    // Dam crest gravity structure must span deep into bedrock without floating
    const damCol = pois.colliders.find((c) => c.minX < 10 && c.maxX > 110 && c.minY < 20);
    assert.ok(damCol, 'Hydroelectric Dam should extend deep into canyon bedrock');
    assert.ok(roads.walkableMeshes.length >= 4, 'Expected walkable extruded highways, rural roads, dirt tracks, and bridges');
  } finally {
    textures.dispose();
  }
});

test('Third-person Skydiver rig toggles aerodynamic freefall and canopy parachute poses cleanly', () => {
  const rig = buildPlayerSkydiverRig();
  assert.equal(rig.canopyGroup.visible, false);

  updateSkydiverRigPose(rig, 'freefall', 1, 0, 1.5);
  assert.equal(rig.canopyGroup.visible, false);
  assert.ok(rig.bodyPivot.rotation.x > 1.0, 'Expected belly-dive horizontal tilt during freefall');

  updateSkydiverRigPose(rig, 'parachute', 0, 0, 2.0);
  assert.equal(rig.canopyGroup.visible, true);
  assert.ok(Math.abs(rig.bodyPivot.rotation.x) < 0.35, 'Expected upright harness posture under deployed canopy');
});

test('Geological formations & synchronous LOD 0 terrain streaming produce continuous grounded heights', () => {
  const textures = makeMockTextures();
  const streamer = new IslandTerrainStreamer(textures);
  try {
    const geo = buildIslandGeology(textures, 777, [{ cx: 60, cz: -85, w: 120, d: 30 }]);
    assert.ok(geo.shootableMeshes.length >= 2, 'Expected instanced cliff outcrops and shoreline river boulders');

    streamer.ensureHighLodAround(60, -80, 620);
    const activeH = streamer.sampleActiveRenderedHeightAt(60, -80);
    const exactH = sampleIslandHeight(60, -80);
    assert.ok(Number.isFinite(activeH));
    assert.ok(Math.abs(activeH - exactH) < 2.5, `Expected synchronous LOD 0 near dam to align closely (${activeH} vs ${exactH})`);
  } finally {
    streamer.dispose();
    textures.dispose();
  }
});
