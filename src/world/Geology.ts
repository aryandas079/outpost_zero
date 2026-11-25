/**
 * 3D Geological Cliff Outcrops, Stratified Ridge Boulders & Shoreline Rock Formations.
 * Rooted deeply into terrain slopes (sampled on rendered 6.25m triangles) so rocks provide solid tactical cover
 * across valleys, highlands, quarry rims, riverbanks, and coastlines with zero floating edges.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SeededRng } from '../utilities/SeededRng';
import { ProceduralTextures } from '../game/textures';
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

export interface GeologyBuildResult {
  group: THREE.Group;
  shootableMeshes: THREE.Object3D[];
}

function createStratifiedCliffOutcropGeometry(): THREE.BufferGeometry {
  // Multi-tiered faceted limestone/granite block with deep skirted base & sharp strata shelves
  const base = new THREE.DodecahedronGeometry(2.6, 0);
  base.scale(1.95, 1.35, 1.5);
  base.translate(0, 0.35, 0);

  const upper = new THREE.DodecahedronGeometry(1.85, 0);
  upper.scale(1.45, 1.32, 1.05);
  upper.rotateY(0.8);
  upper.translate(0.55, 1.85, -0.2);

  const ledge = new THREE.DodecahedronGeometry(1.45, 0);
  ledge.scale(1.85, 0.8, 1.2);
  ledge.rotateY(-0.5);
  ledge.translate(-0.75, 1.15, 0.45);

  const merged = mergeGeometries([base, upper, ledge], false);
  merged.computeVertexNormals();
  return merged;
}

function createShorelineBoulderGeometry(): THREE.BufferGeometry {
  const b1 = new THREE.DodecahedronGeometry(1.5, 0);
  b1.scale(1.4, 0.72, 1.15);
  b1.translate(0, 0.15, 0);
  const b2 = new THREE.DodecahedronGeometry(0.95, 0);
  b2.scale(1.1, 0.8, 1.0);
  b2.translate(0.95, 0.25, 0.45);
  const merged = mergeGeometries([b1, b2], false);
  merged.computeVertexNormals();
  return merged;
}

export function buildIslandGeology(
  textures: ProceduralTextures,
  seed: number,
  buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }>,
): GeologyBuildResult {
  const group = new THREE.Group();
  group.name = 'Island_3D_Geology';
  const shootableMeshes: THREE.Object3D[] = [];

  const rng = new SeededRng(seed + 4491);
  const tmpNormal = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteColor,
    roughness: 0.86,
    metalness: 0.04,
    flatShading: true,
  });

  const cliffGeo = createStratifiedCliffOutcropGeometry();
  const cliffCount = 420;
  const cliffInst = new THREE.InstancedMesh(cliffGeo, graniteMat, cliffCount);
  cliffInst.name = 'Island_Cliff_Outcrops';
  cliffInst.castShadow = true;
  cliffInst.receiveShadow = true;
  cliffInst.frustumCulled = false;
  cliffInst.userData.surface = 'stone';

  const isClear = (x: number, z: number, margin: number): boolean => {
    if (distanceToRoadNetwork(x, z).dist < 14 + margin) return false;
    for (let i = 0; i < ISLAND_POIS.length; i++) {
      if (Math.hypot(x - ISLAND_POIS[i].x, z - ISLAND_POIS[i].z) < ISLAND_POIS[i].padRadius * 0.78 + margin) {
        return false;
      }
    }
    for (let i = 0; i < buildingFootprints.length; i++) {
      const b = buildingFootprints[i];
      if (Math.abs(x - b.cx) < b.w * 0.5 + margin + 2 && Math.abs(z - b.cz) < b.d * 0.5 + margin + 2) {
        return false;
      }
    }
    return true;
  };

  let placedCliffs = 0;
  for (let attempt = 0; attempt < 3200 && placedCliffs < cliffCount; attempt++) {
    const x = rng.range(-1380, 1380);
    const z = rng.range(-1380, 1380);
    const analyticalY = sampleIslandHeight(x, z);
    const triY = sampleRenderedTerrainTriangleHeight(x, z);
    const y = Math.min(analyticalY, triY);
    if (y < 2.2) continue;
    // Stay strictly clear of elevated Hydro Dam Reservoir water
    if (z < -90 && Math.hypot(x - 60, (z - -228) * 0.85) < 126) continue;
    if (!isClear(x, z, 4.5)) continue;

    sampleIslandNormal(x, z, tmpNormal);
    const slope = 1 - tmpNormal.y;
    const biome = classifyBiomeAt(x, z, y, slope);
    if (slope < 0.08 && rng.next() > BIOME_PALETTES[biome].rockDensity * 0.45) continue;

    const sx = rng.range(1.05, 2.75);
    const sy = rng.range(1.0, 2.45);
    const sz = rng.range(1.05, 2.55);
    // Seated 0.95*sy into slope so massive base anchors cleanly into hills while strata jut outward
    dummy.position.set(x, y - 0.95 * sy, z);
    dummy.rotation.set(rng.range(-0.18, 0.18), rng.range(0, Math.PI * 2), rng.range(-0.18, 0.18));
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    cliffInst.setMatrixAt(placedCliffs, dummy.matrix);

    const isMossy = biome === 'forest' || biome === 'river_valley';
    tint.setRGB(
      isMossy ? rng.range(0.42, 0.54) : rng.range(0.50, 0.64),
      isMossy ? rng.range(0.46, 0.58) : rng.range(0.51, 0.65),
      isMossy ? rng.range(0.41, 0.52) : rng.range(0.54, 0.68),
    );
    cliffInst.setColorAt(placedCliffs, tint);
    placedCliffs++;
  }
  cliffInst.count = placedCliffs;
  cliffInst.instanceMatrix.needsUpdate = true;
  if (cliffInst.instanceColor) cliffInst.instanceColor.needsUpdate = true;
  group.add(cliffInst);
  shootableMeshes.push(cliffInst);

  // Riverbank & Reservoir Lake Shoreline Stone Clusters (prevents bare zigzag bank transitions)
  const shoreGeo = createShorelineBoulderGeometry();
  const shoreCount = 240;
  const shoreInst = new THREE.InstancedMesh(shoreGeo, graniteMat, shoreCount);
  shoreInst.name = 'Island_River_Shoreline_Rocks';
  shoreInst.castShadow = true;
  shoreInst.receiveShadow = true;
  shoreInst.frustumCulled = false;
  shoreInst.userData.surface = 'stone';

  let placedShore = 0;
  for (let i = 0; i < 420 && placedShore < shoreCount; i++) {
    let rx: number;
    let rz: number;
    if (i < 150) {
      // Along winding riverbanks from Dam spillway down to sea cove
      rz = rng.range(-55, 1020);
      const riverX = sampleRiverCenterX(rz);
      const side = rng.next() < 0.5 ? -1 : 1;
      rx = riverX + side * rng.range(16.5, 29.0);
    } else {
      // Around Hydro Dam Reservoir rocky perimeter
      const ang = rng.range(0, Math.PI * 2);
      rx = 60 + Math.cos(ang) * rng.range(102, 128);
      rz = -228 + Math.sin(ang) * rng.range(122, 148);
    }
    if (!isClear(rx, rz, 2.5)) continue;
    const ry = Math.min(sampleIslandHeight(rx, rz), sampleRenderedTerrainTriangleHeight(rx, rz));
    const riverY = rz >= -65 ? sampleRiverWaterY(rz) : 39.2;
    if (ry < Math.max(0.2, riverY - 0.8)) continue;

    const sc = rng.range(0.85, 2.1);
    dummy.position.set(rx, ry - 0.55 * sc, rz);
    dummy.rotation.set(rng.range(-0.15, 0.15), rng.range(0, Math.PI * 2), rng.range(-0.15, 0.15));
    dummy.scale.set(sc, sc * rng.range(0.85, 1.35), sc * rng.range(0.9, 1.25));
    dummy.updateMatrix();
    shoreInst.setMatrixAt(placedShore, dummy.matrix);
    tint.setRGB(rng.range(0.46, 0.58), rng.range(0.48, 0.59), rng.range(0.50, 0.61));
    shoreInst.setColorAt(placedShore, tint);
    placedShore++;
  }
  shoreInst.count = placedShore;
  shoreInst.instanceMatrix.needsUpdate = true;
  if (shoreInst.instanceColor) shoreInst.instanceColor.needsUpdate = true;
  group.add(shoreInst);
  shootableMeshes.push(shoreInst);

  return { group, shootableMeshes };
}
