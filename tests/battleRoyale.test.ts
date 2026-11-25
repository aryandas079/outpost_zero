import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ISLAND_AREA_KM2,
  ISLAND_HALF_SIZE,
  ISLAND_POIS,
  ISLAND_ROADS,
  buildStormWallMesh,
  buildTacticalParachute,
  buildTransportAirplane,
  findNearestIslandPoi,
  sampleIslandHeight,
  sampleIslandNormal,
  sampleRiverWaterY,
} from '../src/game/battleRoyaleIsland';
import { ArenaData } from '../src/game/arena';
import { PhysicsWorld } from '../src/game/physics';
import { MAP_SPECS } from '../src/game/types';
import { StormController } from '../src/gameplay/Storm';
import { InventorySystem } from '../src/gameplay/Inventory';
import { MatchStateMachine } from '../src/core/GameState';
import { worldToMapPoint, mapPointToWorld, yawToCompassDeg } from '../src/utilities/MapTransform';

test('25 km2 isolated Battle Royale island dimensions, river & heightfield biomes', () => {
  assert.equal(ISLAND_HALF_SIZE, 2500);
  assert.ok(Math.abs(ISLAND_AREA_KM2 - 25.0) < 0.01, 'Island area should be ~25 km²');
  assert.equal(MAP_SPECS.island.name, 'ISLAND');

  const deepOceanY = sampleIslandHeight(1580, 1580);
  assert.ok(deepOceanY < -1.0, `Expected deep ocean below -1m, got ${deepOceanY}`);

  const damElevation = sampleIslandHeight(184, -80);
  assert.ok(damElevation > 35, `Expected Hoover Dam highland > 35m, got ${damElevation}`);

  // River slopes cleanly from spillway to sea level
  assert.ok(sampleRiverWaterY(-60) > sampleRiverWaterY(900), 'River should descend toward southern sea');

  // 16 interconnected POIs and road segments
  assert.equal(ISLAND_POIS.length, 16, 'Expected 16 differentiated POIs across the 10 km² island');
  assert.ok(ISLAND_ROADS.length >= 20, 'Expected full interconnected highway & rural road network');
  for (const poi of ISLAND_POIS) {
    const poiY = sampleIslandHeight(poi.x, poi.z);
    assert.ok(poiY >= 2.0, `POI ${poi.name} should be above sea level, got ${poiY}`);
    const nearest = findNearestIslandPoi(poi.x + 4, poi.z - 3);
    assert.equal(nearest.name, poi.name);
  }

  const normal = new THREE.Vector3();
  sampleIslandNormal(120, -90, normal);
  assert.ok(Math.abs(normal.length() - 1) < 1e-4);
  assert.ok(normal.y > 0.35);
});

test('3D C-130 transport aircraft, tactical parachute, and storm wall build valid 3D meshes', () => {
  const { group: plane, propellers } = buildTransportAirplane();
  assert.equal(plane.name, 'C130_Hercules_Transport');
  assert.equal(propellers.length, 4, 'C-130 must have 4 spinning turboprop propellers');
  assert.ok(plane.children.length >= 10, 'C-130 must be a multi-part composite 3D aircraft');

  const parachute = buildTacticalParachute();
  assert.equal(parachute.name, 'Tactical_RamAir_Parachute');
  assert.ok(parachute.children.length >= 10, 'Parachute must include multi-cell canopy and suspension lines');

  const stormWall = buildStormWallMesh();
  assert.ok(stormWall instanceof THREE.Mesh);
});

test('PhysicsWorld adapts spatial grid and samples 3D island heightfield terrain', () => {
  const dummyArena: ArenaData = {
    mapName: 'DUMMY',
    group: new THREE.Group(),
    colliders: [
      {
        surface: 'concrete',
        minX: -10,
        maxX: 10,
        minZ: -10,
        maxZ: 10,
        minY: sampleIslandHeight(0, 0) + 3.8,
        maxY: sampleIslandHeight(0, 0) + 4.3,
      },
    ],
    ramps: [],
    shootableMeshes: [],
    walkableMeshes: [],
    occludables: [],
    spawnPoints: [new THREE.Vector3(0, 0, 0)],
    pickupSpots: [new THREE.Vector3(10, 0, 10)],
    buildingFootprints: [],
    arenaHalfSize: ISLAND_HALF_SIZE,
    bounds: {
      minX: -ISLAND_HALF_SIZE,
      maxX: ISLAND_HALF_SIZE,
      minZ: -ISLAND_HALF_SIZE,
      maxZ: ISLAND_HALF_SIZE,
    },
    animatedProps: {
      windmillWheel: null,
      flagMesh: null,
      tumbleweeds: [],
    },
    terrainHeightAt: sampleIslandHeight,
    terrainNormalAt: sampleIslandNormal,
    optimizeRendering: () => ({ before: 0, after: 0 }),
    dispose: () => {},
  };

  const physics = new PhysicsWorld(dummyArena);
  const outNormal = new THREE.Vector3();

  const hillX = 240;
  const hillZ = -180;
  const expectedHillY = sampleIslandHeight(hillX, hillZ);
  const sampledHillY = physics.sampleGroundAt(hillX, hillZ, expectedHillY + 1.0, 0.5, 0.32, outNormal).y;
  assert.ok(Math.abs(sampledHillY - expectedHillY) < 1e-4);

  const roofTopY = sampleIslandHeight(0, 0) + 4.3;
  const sampledRoofY = physics.sampleGroundAt(0, 0, roofTopY + 0.2, 0.5, 0.32, outNormal).y;
  assert.ok(Math.abs(sampledRoofY - roofTopY) < 1e-4);
});

test('StormController shrinks deterministically through valid inland zones and prevents negative/NaN bounds', () => {
  const storm = new StormController(2026079);
  assert.equal(storm.phase, 1);
  assert.equal(storm.isOutsideSafeZone(0, 0), false);
  assert.equal(storm.isOutsideSafeZone(3000, 0), true);

  for (let s = 0; s < 350; s++) {
    storm.update(1.0);
  }
  assert.ok(storm.phase >= 2);
  assert.ok(Number.isFinite(storm.radius) && storm.radius >= 0);
  assert.ok(Math.hypot(storm.centerX, storm.centerZ) < 1400);
});

test('InventorySystem enforces plate/medkit stack caps and weapon swapping', () => {
  const inv = new InventorySystem();
  inv.reset();
  assert.equal(inv.addArmorPlate(10), 3); // starts at 2, cap 5
  assert.equal(inv.armorPlates, 5);
  assert.equal(inv.consumeArmorPlate(25, 50), 25);
  assert.equal(inv.armorPlates, 4);
  assert.equal(inv.consumeArmorPlate(50, 50), 0); // full armor not wasted

  const swap = inv.equipWeaponPickup('marksman');
  assert.equal(swap.addedAmmoOnly, false);
  assert.ok(inv.getOwnedWeapons().includes('marksman'));
});

test('MatchStateMachine blocks duplicate endings and preserves deployment -> combat transitions', () => {
  const sm = new MatchStateMachine();
  assert.equal(sm.state, 'main_menu');
  sm.beginNewMatch();
  assert.equal(sm.transition('aircraft_deployment'), true);
  assert.equal(sm.isDeploying(), true);
  assert.equal(sm.isCombatAllowed(), false);
  assert.equal(sm.transition('freefall'), true);
  assert.equal(sm.transition('parachuting'), true);
  assert.equal(sm.transition('active_match'), true);
  assert.equal(sm.isCombatAllowed(), true);
  assert.equal(sm.completeMatch('victory'), true);
  assert.equal(sm.completeMatch('gameover'), false); // duplicate prevented
});

test('MapTransform round-trips world <-> map points cleanly with rotation', () => {
  const xf = { centerPx: 400, originWorldX: -120, originWorldZ: 250, pxPerMeter: 0.25, rotationRad: 0.8 };
  const p = worldToMapPoint(320, -140, xf);
  const round = mapPointToWorld(p.x, p.y, xf);
  assert.ok(Math.abs(round.x - 320) < 1e-4);
  assert.ok(Math.abs(round.z - -140) < 1e-4);
  assert.equal(Math.round(yawToCompassDeg(0)), 0);
  assert.equal(Math.round(yawToCompassDeg(-Math.PI / 2)), 90);
});
