/**
 * Biome-Aware Seeded Vegetation, Rocks, Fallen Logs & Field Grass Instancing.
 * Prevents foliage from intersecting POIs, buildings, roads, rivers, or underwater seabed.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ProceduralTextures } from '../game/textures';
import { SeededRng, smoothstep } from '../utilities/SeededRng';
import { BIOME_PALETTES, classifyBiomeAt } from './Biomes';
import {
  distanceToRoadNetwork,
  ISLAND_POIS,
  sampleIslandHeight,
  sampleIslandNormal,
  sampleRiverCenterX,
  sampleRiverWaterY,
} from './Terrain';
import { sampleRenderedTerrainTriangleHeight } from './WorldStreaming';

function createRealisticConiferTreeGeometries(): { trunkGeo: THREE.BufferGeometry; canopyGeo: THREE.BufferGeometry } {
  const rootBase = new THREE.CylinderGeometry(0.52, 0.88, 1.4, 9);
  rootBase.translate(0, 0.7, 0);
  const mainTrunk = new THREE.CylinderGeometry(0.16, 0.52, 9.8, 9);
  mainTrunk.translate(0, 5.5, 0);
  const branch1 = new THREE.CylinderGeometry(0.06, 0.16, 2.4, 6);
  branch1.rotateZ(1.08);
  branch1.rotateY(0.4);
  branch1.translate(0.9, 3.4, 0.35);
  const branch2 = new THREE.CylinderGeometry(0.05, 0.15, 2.2, 6);
  branch2.rotateZ(-1.12);
  branch2.rotateY(2.2);
  branch2.translate(-0.85, 4.3, -0.5);
  const trunkGeo = mergeGeometries([rootBase, mainTrunk, branch1, branch2], false);

  const tierSpecs = [
    { r: 4.4, h: 3.6, y: 3.8, segs: 13, twist: 0.0 },
    { r: 3.8, h: 3.4, y: 5.6, segs: 12, twist: 0.38 },
    { r: 3.1, h: 3.2, y: 7.3, segs: 12, twist: 0.76 },
    { r: 2.3, h: 2.9, y: 8.9, segs: 11, twist: 1.14 },
    { r: 1.5, h: 2.5, y: 10.5, segs: 9, twist: 1.52 },
  ];

  const tierGeos: THREE.BufferGeometry[] = [];
  for (let t = 0; t < tierSpecs.length; t++) {
    const spec = tierSpecs[t];
    const cone = new THREE.ConeGeometry(spec.r, spec.h, spec.segs, 3, false);
    const pos = cone.attributes.position as THREE.BufferAttribute;
    const uvs = cone.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const radial = Math.hypot(vx, vz);
      if (radial > 0.1) {
        const ang = Math.atan2(vz, vx) + spec.twist;
        const star = 1 + 0.22 * Math.sin(ang * 7) + 0.12 * Math.cos(ang * 5 + 0.8);
        const yNorm = (vy + spec.h * 0.5) / spec.h;
        const droop = (1 - yNorm) * -0.4 * (radial / spec.r);
        pos.setX(i, vx * star);
        pos.setY(i, vy + droop);
        pos.setZ(i, vz * star);
        uvs.setXY(i, (ang / (Math.PI * 2) + 1) * 3, yNorm * 2.4);
      }
    }
    cone.translate(0, spec.y, 0);
    cone.computeVertexNormals();
    tierGeos.push(cone);
  }
  const canopyGeo = mergeGeometries(tierGeos, false);
  return { trunkGeo, canopyGeo };
}

function createRealisticBroadleafTreeGeometries(): { trunkGeo: THREE.BufferGeometry; crownGeo: THREE.BufferGeometry } {
  const flare = new THREE.CylinderGeometry(0.55, 0.92, 1.4, 8);
  flare.translate(0, 0.7, 0);
  const trunk = new THREE.CylinderGeometry(0.32, 0.55, 4.9, 8);
  trunk.translate(0, 3.65, 0);
  // Branches join strictly inside trunk core & reach cleanly up into side canopy clusters
  const limb1 = new THREE.CylinderGeometry(0.14, 0.24, 2.2, 6);
  limb1.rotateZ(0.52);
  limb1.translate(0.52, 5.1, 0.18);
  const limb2 = new THREE.CylinderGeometry(0.14, 0.24, 2.1, 6);
  limb2.rotateZ(-0.54);
  limb2.translate(-0.5, 5.05, -0.2);
  const trunkGeo = mergeGeometries([flare, trunk, limb1, limb2], false);

  const lobeSpecs = [
    { x: 0.0, y: 7.4, z: 0.0, rx: 3.1, ry: 2.35, rz: 3.0 },
    { x: 1.8, y: 6.45, z: 0.7, rx: 2.3, ry: 1.85, rz: 2.2 },
    { x: -1.7, y: 6.35, z: 0.8, rx: 2.25, ry: 1.8, rz: 2.15 },
    { x: 0.25, y: 6.5, z: -1.75, rx: 2.35, ry: 1.85, rz: 2.2 },
  ];
  const lobeGeos: THREE.BufferGeometry[] = [];
  for (let l = 0; l < lobeSpecs.length; l++) {
    const s = lobeSpecs[l];
    const ico = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = ico.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const bump = 1 + 0.1 * Math.sin(vx * 4.5 + l) * Math.cos(vz * 4.5 - l);
      const yScale = vy < 0 ? s.ry * 0.78 : s.ry;
      pos.setX(i, vx * s.rx * bump + s.x);
      pos.setY(i, vy * yScale * bump + s.y);
      pos.setZ(i, vz * s.rz * bump + s.z);
    }
    ico.computeVertexNormals();
    lobeGeos.push(ico);
  }
  const crownGeo = mergeGeometries(lobeGeos, false);
  return { trunkGeo, crownGeo };
}

function createFieldGrassTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  for (let a = 0; a < angles.length; a++) {
    const plane = new THREE.PlaneGeometry(1.6, 1.25, 2, 2);
    const pos = plane.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const topFactor = smoothstep(-0.625, 0.625, vy);
      pos.setX(i, vx * (1 - topFactor * 0.38));
      pos.setZ(i, topFactor * topFactor * 0.34 * (a % 2 === 0 ? 1 : -1));
    }
    plane.translate(0, 0.56, 0);
    plane.rotateY(angles[a]);
    plane.computeVertexNormals();
    blades.push(plane);
  }
  return mergeGeometries(blades, false);
}

function createShrubGeometry(): THREE.BufferGeometry {
  const lobes: THREE.BufferGeometry[] = [];
  for (const [ox, oy, oz, s] of [
    [0, 0.65, 0, 0.95],
    [0.55, 0.48, 0.35, 0.7],
    [-0.5, 0.45, -0.3, 0.72],
  ]) {
    const g = new THREE.IcosahedronGeometry(s, 1);
    g.scale(1.15, 0.82, 1.15);
    g.translate(ox, oy, oz);
    lobes.push(g);
  }
  return mergeGeometries(lobes, false);
}

export interface VegetationBuildResult {
  group: THREE.Group;
  shootableMeshes: THREE.Object3D[];
}

export function buildIslandVegetation(
  textures: ProceduralTextures,
  seed: number,
  buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }>,
): VegetationBuildResult {
  const group = new THREE.Group();
  group.name = 'Island_Biome_Vegetation';
  const shootableMeshes: THREE.Object3D[] = [];
  const rng = new SeededRng(seed + 7717);
  const tmpNormal = new THREE.Vector3();

  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x5c422c,
    map: textures.woodPlankDarkColor,
    normalMap: textures.woodPlankNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.9,
  });

  const birchBarkMat = new THREE.MeshStandardMaterial({
    color: 0xc8c5bc,
    map: textures.woodPlankLightColor,
    roughness: 0.85,
  });

  const pineFoliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.pineNeedlesColor,
    normalMap: textures.pineNeedlesNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.72,
    metalness: 0.01,
    flatShading: true,
  });

  const oakFoliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.leafCanopyColor,
    normalMap: textures.leafCanopyNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.68,
    metalness: 0.01,
    flatShading: true,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.grassTuftColor,
    roughness: 0.64,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.25,
  });

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3ad,
    map: textures.concreteColor,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
  });

  const isBlocked = (x: number, z: number, margin: number): boolean => {
    // Keep strictly outside Hydro Dam Reservoir lake & downstream river water channel
    if (z < -78 && Math.hypot(x - 60, (z - -228) * 0.84) < 138 + margin) return true;
    if (z >= -78 && z <= 1120 && Math.abs(x - sampleRiverCenterX(z)) < 32 + margin) return true;
    const { dist } = distanceToRoadNetwork(x, z);
    if (dist < 12.5 + margin) return true;
    for (let i = 0; i < ISLAND_POIS.length; i++) {
      if (Math.hypot(x - ISLAND_POIS[i].x, z - ISLAND_POIS[i].z) < ISLAND_POIS[i].padRadius * 0.72 + margin) {
        return true;
      }
    }
    for (let i = 0; i < buildingFootprints.length; i++) {
      const b = buildingFootprints[i];
      if (Math.abs(x - b.cx) < b.w * 0.5 + margin + 2 && Math.abs(z - b.cz) < b.d * 0.5 + margin + 2) {
        return true;
      }
    }
    return false;
  };

  /** Evaluates safe rendered-mesh floor Y so vegetation NEVER floats above sloped triangles or waterlines. */
  const sampleSafeVegY = (x: number, z: number): number | null => {
    const triY = sampleRenderedTerrainTriangleHeight(x, z);
    const anaY = sampleIslandHeight(x, z);
    // Reject spots where coarse terrain diverges from high-res analytical crest or sits below river surface
    if (Math.abs(triY - anaY) > 0.85) return null;
    const groundY = Math.min(triY, anaY);
    if (z >= -68 && Math.abs(x - sampleRiverCenterX(z)) < 42 && groundY < sampleRiverWaterY(z) + 1.4) return null;
    if (z < -78 && Math.hypot(x - 60, (z - -228) * 0.84) < 150 && groundY < 40.2) return null;
    return groundY;
  };

  const dummy = new THREE.Object3D();
  const tintColor = new THREE.Color();

  // 1. Conifers / Spruce (1,200 instances, sunlit stylized forest & highland groves — zero extra draw calls)
  const pineCount = 1200;
  const { trunkGeo: pineTrunkGeo, canopyGeo: pineCanopyGeo } = createRealisticConiferTreeGeometries();
  const pineTrunkInst = new THREE.InstancedMesh(pineTrunkGeo, barkMat, pineCount);
  pineTrunkInst.castShadow = true;
  pineTrunkInst.receiveShadow = true;
  pineTrunkInst.frustumCulled = false;
  pineTrunkInst.userData.surface = 'wood';

  const pineCanopyInst = new THREE.InstancedMesh(pineCanopyGeo, pineFoliageMat, pineCount);
  pineCanopyInst.castShadow = true;
  pineCanopyInst.receiveShadow = true;
  pineCanopyInst.frustumCulled = false;
  pineCanopyInst.userData.noCollide = true;

  let placedPines = 0;
  for (let attempt = 0; attempt < 7200 && placedPines < pineCount; attempt++) {
    const tx = rng.range(-1380, 1380);
    const tz = rng.range(-1380, 1380);
    const ty = sampleSafeVegY(tx, tz);
    if (ty === null || ty < 3.4 || ty > 48) continue;
    sampleIslandNormal(tx, tz, tmpNormal);
    const slope = 1 - tmpNormal.y;
    if (slope > 0.32) continue;
    const biome = classifyBiomeAt(tx, tz, ty, slope);
    if (rng.next() > BIOME_PALETTES[biome].treeDensity + 0.16) continue;
    if (isBlocked(tx, tz, 4.2)) continue;

    const sXZ = rng.range(0.88, 1.54);
    const sY = sXZ * rng.range(0.95, 1.24);
    dummy.position.set(tx, ty - 0.55, tz);
    dummy.rotation.set(rng.range(-0.03, 0.03), rng.range(0, Math.PI * 2), rng.range(-0.03, 0.03));
    dummy.scale.set(sXZ, sY, sXZ);
    dummy.updateMatrix();
    pineTrunkInst.setMatrixAt(placedPines, dummy.matrix);
    pineCanopyInst.setMatrixAt(placedPines, dummy.matrix);
    tintColor.setHSL(0.26 + rng.range(-0.025, 0.025), rng.range(0.42, 0.62), rng.range(0.60, 0.84));
    pineCanopyInst.setColorAt(placedPines, tintColor);
    placedPines++;
  }
  pineTrunkInst.count = placedPines;
  pineCanopyInst.count = placedPines;
  pineTrunkInst.instanceMatrix.needsUpdate = true;
  pineCanopyInst.instanceMatrix.needsUpdate = true;
  if (pineCanopyInst.instanceColor) pineCanopyInst.instanceColor.needsUpdate = true;
  group.add(pineTrunkInst, pineCanopyInst);
  shootableMeshes.push(pineTrunkInst);

  // 2. Broadleaf Oaks & Birch Woodland (460 Oak + 220 Birch)
  const oakCount = 460;
  const birchCount = 220;
  const { trunkGeo: oakTrunkGeo, crownGeo: oakCrownGeo } = createRealisticBroadleafTreeGeometries();

  const oakTrunkInst = new THREE.InstancedMesh(oakTrunkGeo, barkMat, oakCount);
  const oakCrownInst = new THREE.InstancedMesh(oakCrownGeo, oakFoliageMat, oakCount);
  const birchTrunkInst = new THREE.InstancedMesh(oakTrunkGeo, birchBarkMat, birchCount);
  const birchCrownInst = new THREE.InstancedMesh(oakCrownGeo, oakFoliageMat, birchCount);
  for (const inst of [oakTrunkInst, oakCrownInst, birchTrunkInst, birchCrownInst]) {
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
  }
  oakTrunkInst.userData.surface = 'wood';
  birchTrunkInst.userData.surface = 'wood';
  oakCrownInst.userData.noCollide = true;
  birchCrownInst.userData.noCollide = true;

  let placedOaks = 0;
  let placedBirch = 0;
  for (let attempt = 0; attempt < 3600 && (placedOaks < oakCount || placedBirch < birchCount); attempt++) {
    const tx = rng.range(-1320, 1320);
    const tz = rng.range(-1320, 1320);
    const ty = sampleSafeVegY(tx, tz);
    if (ty === null || ty < 3.4 || ty > 34) continue;
    sampleIslandNormal(tx, tz, tmpNormal);
    if (1 - tmpNormal.y > 0.26) continue;
    if (isBlocked(tx, tz, 4.5)) continue;

    const isBirch = placedBirch < birchCount && (placedOaks >= oakCount || rng.next() < 0.3);
    const sXZ = isBirch ? rng.range(0.72, 1.05) : rng.range(0.88, 1.45);
    const sY = sXZ * rng.range(0.9, 1.2);
    dummy.position.set(tx, ty - 0.55, tz);
    dummy.rotation.set(rng.range(-0.025, 0.025), rng.range(0, Math.PI * 2), rng.range(-0.025, 0.025));
    dummy.scale.set(sXZ, sY, sXZ);
    dummy.updateMatrix();

    if (isBirch) {
      birchTrunkInst.setMatrixAt(placedBirch, dummy.matrix);
      birchCrownInst.setMatrixAt(placedBirch, dummy.matrix);
      tintColor.setHSL(0.22 + rng.range(-0.03, 0.03), rng.range(0.45, 0.65), rng.range(0.62, 0.82));
      birchCrownInst.setColorAt(placedBirch, tintColor);
      placedBirch++;
    } else {
      oakTrunkInst.setMatrixAt(placedOaks, dummy.matrix);
      oakCrownInst.setMatrixAt(placedOaks, dummy.matrix);
      tintColor.setHSL(0.27 + rng.range(-0.03, 0.03), rng.range(0.45, 0.64), rng.range(0.56, 0.78));
      oakCrownInst.setColorAt(placedOaks, tintColor);
      placedOaks++;
    }
  }
  oakTrunkInst.count = placedOaks;
  oakCrownInst.count = placedOaks;
  birchTrunkInst.count = placedBirch;
  birchCrownInst.count = placedBirch;
  for (const inst of [oakTrunkInst, oakCrownInst, birchTrunkInst, birchCrownInst]) {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  group.add(oakTrunkInst, oakCrownInst, birchTrunkInst, birchCrownInst);
  shootableMeshes.push(oakTrunkInst, birchTrunkInst);

  // 3. Tactical Bushes / Shrubs (680 instances)
  const shrubCount = 680;
  const shrubGeo = createShrubGeometry();
  const shrubInst = new THREE.InstancedMesh(shrubGeo, oakFoliageMat, shrubCount);
  shrubInst.castShadow = true;
  shrubInst.receiveShadow = true;
  shrubInst.frustumCulled = false;
  shrubInst.userData.noCollide = true;

  let placedShrubs = 0;
  for (let attempt = 0; attempt < 3600 && placedShrubs < shrubCount; attempt++) {
    const sx = rng.range(-1320, 1320);
    const sz = rng.range(-1320, 1320);
    const sy = sampleSafeVegY(sx, sz);
    if (sy === null || sy < 3.0 || sy > 36) continue;
    if (isBlocked(sx, sz, 1.5)) continue;
    const sc = rng.range(0.75, 1.5);
    dummy.position.set(sx, sy - 0.24, sz);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.scale.set(sc, sc * rng.range(0.85, 1.15), sc);
    dummy.updateMatrix();
    shrubInst.setMatrixAt(placedShrubs, dummy.matrix);
    tintColor.setHSL(0.26 + rng.range(-0.04, 0.04), rng.range(0.42, 0.62), rng.range(0.56, 0.78));
    shrubInst.setColorAt(placedShrubs, tintColor);
    placedShrubs++;
  }
  shrubInst.count = placedShrubs;
  shrubInst.instanceMatrix.needsUpdate = true;
  if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
  group.add(shrubInst);

  // 4. Fallen Logs (120 instances in woodlands)
  const logCount = 120;
  const logGeo = new THREE.CylinderGeometry(0.28, 0.36, 5.2, 8);
  logGeo.rotateZ(Math.PI / 2);
  const logInst = new THREE.InstancedMesh(logGeo, barkMat, logCount);
  logInst.castShadow = true;
  logInst.receiveShadow = true;
  logInst.frustumCulled = false;
  logInst.userData.surface = 'wood';

  let placedLogs = 0;
  for (let attempt = 0; attempt < 900 && placedLogs < logCount; attempt++) {
    const lx = rng.range(-1200, 1200);
    const lz = rng.range(-1200, 1200);
    const ly = sampleIslandHeight(lx, lz);
    if (ly < 4.0 || ly > 36) continue;
    sampleIslandNormal(lx, lz, tmpNormal);
    if (1 - tmpNormal.y > 0.18) continue;
    if (isBlocked(lx, lz, 3.0)) continue;
    dummy.position.set(lx, ly + 0.18, lz);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), rng.range(-0.05, 0.05));
    dummy.scale.set(rng.range(0.8, 1.25), rng.range(0.8, 1.15), rng.range(0.8, 1.15));
    dummy.updateMatrix();
    logInst.setMatrixAt(placedLogs, dummy.matrix);
    placedLogs++;
  }
  logInst.count = placedLogs;
  logInst.instanceMatrix.needsUpdate = true;
  group.add(logInst);
  shootableMeshes.push(logInst);

  // 5. Dense Field Grass Tuft Clusters (5,200 instanced clusters across meadows, hills & POIs — single draw call)
  const grassCount = 5200;
  const grassGeo = createFieldGrassTuftGeometry();
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassInst.receiveShadow = true;
  grassInst.frustumCulled = false;
  grassInst.userData.noCollide = true;

  let placedGrass = 0;
  for (let attempt = 0; attempt < 13000 && placedGrass < grassCount; attempt++) {
    const gx = rng.range(-1320, 1320);
    const gz = rng.range(-1320, 1320);
    const gy = sampleSafeVegY(gx, gz);
    if (gy === null || gy < 3.0 || gy > 36) continue;
    sampleIslandNormal(gx, gz, tmpNormal);
    const slope = 1 - tmpNormal.y;
    if (slope > 0.22) continue;
    const biome = classifyBiomeAt(gx, gz, gy, slope);
    if (rng.next() > BIOME_PALETTES[biome].grassDensity + 0.15) continue;
    if (isBlocked(gx, gz, 0.5)) continue;

    const sx = rng.range(1.25, 2.35);
    const sy = rng.range(1.05, 2.05);
    dummy.position.set(gx, gy - 0.28, gz);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    grassInst.setMatrixAt(placedGrass, dummy.matrix);
    tintColor.setHSL(0.26 + rng.range(-0.04, 0.04), rng.range(0.45, 0.65), rng.range(0.52, 0.72));
    grassInst.setColorAt(placedGrass, tintColor);
    placedGrass++;
  }
  grassInst.count = placedGrass;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  group.add(grassInst);

  // 6. Sculpted Rock Outcrops & Coastal Boulders (420 instances)
  const rockCount = 420;
  const rockGeo = new THREE.DodecahedronGeometry(1.75, 1);
  rockGeo.translate(0, 0.8, 0);
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;
  rockInst.frustumCulled = false;
  rockInst.userData.surface = 'stone';

  let placedRocks = 0;
  for (let attempt = 0; attempt < 1500 && placedRocks < rockCount; attempt++) {
    const rx = rng.range(-1400, 1400);
    const rz = rng.range(-1400, 1400);
    const ry = sampleIslandHeight(rx, rz);
    if (ry < 0.6) continue;
    if (isBlocked(rx, rz, 3.5)) continue;
    const sx = rng.range(0.7, 2.0);
    const sy = rng.range(0.6, 1.6);
    const sz = rng.range(0.7, 2.0);
    dummy.position.set(rx, ry - 0.3, rz);
    dummy.rotation.set(rng.range(-0.2, 0.2), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2));
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(placedRocks, dummy.matrix);
    placedRocks++;
  }
  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  group.add(rockInst);
  shootableMeshes.push(rockInst);

  return { group, shootableMeshes };
}
