/**
 * 3D Terrain-Conforming Road Network, River Bridges, Markings, Utility Poles & Roadside Props.
 */

import * as THREE from 'three';
import type { BoxCollider, RampSurface } from '../game/arena';
import { craftedBox } from '../game/geometry';
import { ProceduralTextures } from '../game/textures';
import {
  ISLAND_ROAD_SPECS,
  sampleIslandHeight,
  sampleRoadElevation,
  sampleRoadSegmentPoint,
  sampleRiverCenterX,
  sampleRiverWaterY,
} from './Terrain';

export interface RoadBuildResult {
  group: THREE.Group;
  shootableMeshes: THREE.Object3D[];
  walkableMeshes: THREE.Object3D[];
  colliders: BoxCollider[];
  ramps: RampSurface[];
}

export function buildIslandRoadNetwork(textures: ProceduralTextures): RoadBuildResult {
  const group = new THREE.Group();
  group.name = 'Island_Road_Network';
  const shootableMeshes: THREE.Object3D[] = [];
  const walkableMeshes: THREE.Object3D[] = [];
  const colliders: BoxCollider[] = [];
  const ramps: RampSurface[] = [];

  const highwayMat = new THREE.MeshStandardMaterial({
    color: 0x454c54,
    map: textures.concreteColor,
    roughness: 0.84,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });

  const ruralMat = new THREE.MeshStandardMaterial({
    color: 0x565c62,
    map: textures.concreteColor,
    roughness: 0.88,
    metalness: 0.03,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });

  const dirtMat = new THREE.MeshStandardMaterial({
    color: 0x7a6246,
    map: textures.dirtRoadColor,
    normalMap: textures.dirtRoadNormal,
    roughness: 0.94,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });

  const stripeMat = new THREE.MeshBasicMaterial({
    color: 0xe6c15a,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });

  const bridgeConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x878d94,
    map: textures.concreteColor,
    roughness: 0.8,
  });

  const railSteelMat = new THREE.MeshStandardMaterial({
    color: 0x3b444e,
    roughness: 0.5,
    metalness: 0.6,
  });

  const poleWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c422c,
    roughness: 0.9,
  });

  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe4a8 });

  // Collect pole & wooden roadside guardrail matrices for instancing (Shot 10!)
  const poleMatrices: THREE.Matrix4[] = [];
  const lampMatrices: THREE.Matrix4[] = [];
  const fenceMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  // Build continuous quad-strip ribbon geometry per road kind so draw calls stay <= 4!
  const makeRibbonBuffers = () => ({
    positions: [] as number[],
    normals: [] as number[],
    uvs: [] as number[],
    indices: [] as number[],
  });

  const roadBuckets = {
    highway: makeRibbonBuffers(),
    rural: makeRibbonBuffers(),
    dirt: makeRibbonBuffers(),
    stripes: makeRibbonBuffers(),
  };

  const appendStrip = (
    buf: ReturnType<typeof makeRibbonBuffers>,
    pts: Array<{ x: number; y: number; z: number }>,
    halfWidth: number,
    uScale: number,
    embankmentDropMeters = 0,
  ) => {
    const baseVertex = buf.positions.length / 3;
    const stride = embankmentDropMeters > 0 ? 4 : 2;
    const skirtW = halfWidth + 1.85;
    let distAccum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      if (i > 0) distAccum += Math.hypot(p.x - prev.x, p.z - prev.z);

      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const tLen = Math.hypot(tx, tz) || 1;
      const nx = -tz / tLen;
      const nz = tx / tLen;

      if (embankmentDropMeters > 0) {
        // 4-vertex cross section: left-skirt-bottom -> left-deck -> right-deck -> right-skirt-bottom
        buf.positions.push(
          p.x - nx * skirtW,
          p.y - embankmentDropMeters,
          p.z - nz * skirtW,
          p.x - nx * halfWidth,
          p.y,
          p.z - nz * halfWidth,
          p.x + nx * halfWidth,
          p.y,
          p.z + nz * halfWidth,
          p.x + nx * skirtW,
          p.y - embankmentDropMeters,
          p.z + nz * skirtW,
        );
        buf.normals.push(-nx * 0.55, 0.83, -nz * 0.55, 0, 1, 0, 0, 1, 0, nx * 0.55, 0.83, nz * 0.55);
        buf.uvs.push(0, distAccum * uScale, 0.15, distAccum * uScale, 0.85, distAccum * uScale, 1, distAccum * uScale);
      } else {
        buf.positions.push(
          p.x - nx * halfWidth,
          p.y,
          p.z - nz * halfWidth,
          p.x + nx * halfWidth,
          p.y,
          p.z + nz * halfWidth,
        );
        buf.normals.push(0, 1, 0, 0, 1, 0);
        buf.uvs.push(0, distAccum * uScale, 1, distAccum * uScale);
      }

      if (i < pts.length - 1) {
        const i0 = baseVertex + i * stride;
        const n0 = i0 + stride;
        for (let seg = 0; seg < stride - 1; seg++) {
          const a = i0 + seg;
          const b = i0 + seg + 1;
          const c = n0 + seg;
          const d = n0 + seg + 1;
          buf.indices.push(a, c, b, b, c, d);
        }
      }
    }
  };

  for (let rIdx = 0; rIdx < ISLAND_ROAD_SPECS.length; rIdx++) {
    const road = ISLAND_ROAD_SPECS[rIdx];
    const segLen = Math.hypot(road.x1 - road.x0, road.z1 - road.z0);
    const steps = Math.max(24, Math.ceil(segLen / 4.8));
    const halfW = road.kind === 'highway' ? 4.8 : road.kind === 'rural' ? 3.8 : 3.0;

    const pts: Array<{ x: number; y: number; z: number; overRiver: boolean }> = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const p2 = sampleRoadSegmentPoint(road, t);
      const nextP2 = sampleRoadSegmentPoint(road, Math.min(1, t + 1 / steps));
      const rdx = nextP2.x - p2.x;
      const rdz = nextP2.z - p2.z;
      const rLen = Math.hypot(rdx, rdz) || 1;
      const rnx = -rdz / rLen;
      const rnz = rdx / rLen;
      const riverX = sampleRiverCenterX(p2.z);
      const inRiverSpan = p2.z > -18 && p2.z < 1050 && Math.abs(p2.x - riverX) < 30;
      const roadGradeY = sampleRoadElevation(rIdx, t);
      const groundY = sampleIslandHeight(p2.x, p2.z);
      const edgeLeftY = sampleIslandHeight(p2.x - rnx * halfW, p2.z - rnz * halfW);
      const edgeRightY = sampleIslandHeight(p2.x + rnx * halfW, p2.z + rnz * halfW);
      const shoulderHighY = Math.max(groundY, edgeLeftY, edgeRightY);
      const deckY = inRiverSpan ? roadGradeY + 0.18 : Math.max(roadGradeY, shoulderHighY) + 0.36;
      pts.push({ x: p2.x, y: deckY, z: p2.z, overRiver: inRiverSpan });

      // Place utility poles along highways cleanly anchored into ground
      if (road.kind === 'highway' && !inRiverSpan && s > 4 && s < steps - 4 && s % 14 === 0 && groundY > 2.2) {
        const px = p2.x + rnx * (halfW + 2.4);
        const pz = p2.z + rnz * (halfW + 2.4);
        const py = sampleIslandHeight(px, pz);
        if (py > 2.2) {
          dummy.rotation.order = 'XYZ';
          dummy.position.set(px, py + 3.2, pz);
          dummy.rotation.set(0, Math.atan2(rdx, rdz), 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          poleMatrices.push(dummy.matrix.clone());

          dummy.position.set(px - rnx * 0.9, py + 6.3, pz - rnz * 0.9);
          dummy.updateMatrix();
          lampMatrices.push(dummy.matrix.clone());
        }
      }

      // Guardrail posts strictly on steep canyon/embankment drops & bridge approaches (never cluttered dashes across flat hills)
      const isSteepDrop = Math.abs(edgeLeftY - edgeRightY) > 1.6 || roadGradeY - groundY > 1.2;
      if (road.kind === 'highway' && !inRiverSpan && isSteepDrop && s > 4 && s < steps - 4 && s % 4 === 0 && groundY > 2.4) {
        const tx = rdx / rLen;
        const tz = rdz / rLen;
        const gx = p2.x - rnx * (halfW + 0.35);
        const gz = p2.z - rnz * (halfW + 0.35);
        dummy.position.set(gx, deckY + 0.42, gz);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.set(-Math.atan2(sampleIslandHeight(gx + tx * 5, gz + tz * 5) - sampleIslandHeight(gx - tx * 5, gz - tz * 5), 10), Math.atan2(rdx, rdz), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        fenceMatrices.push(dummy.matrix.clone());
      }
    }

    appendStrip(roadBuckets[road.kind], pts, halfW, 0.08, 3.4);
    if (road.kind === 'highway') {
      for (let s = 0; s < pts.length - 1; s += 4) {
        const sA = pts[s];
        const sB = pts[Math.min(pts.length - 1, s + 2)];
        appendStrip(
          roadBuckets.stripes,
          [
            { x: sA.x, y: sA.y + 0.04, z: sA.z },
            { x: sB.x, y: sB.y + 0.04, z: sB.z },
          ],
          0.18,
          0.25,
          0,
        );
      }
    }

    // Build monumental solid concrete bridges with tilted approach deck, heavy box girder, jersey parapets & deep bedrock abutments!
    let bridgeStart = -1;
    for (let s = 0; s < pts.length; s++) {
      if (pts[s].overRiver && bridgeStart === -1) bridgeStart = s;
      if ((!pts[s].overRiver || s === pts.length - 1) && bridgeStart !== -1) {
        const endIdx = pts[s].overRiver ? s : s - 1;
        if (endIdx > bridgeStart) {
          const pA = pts[Math.max(0, bridgeStart - 1)];
          const pB = pts[Math.min(pts.length - 1, endIdx + 1)];
          const cx = (pA.x + pB.x) * 0.5;
          const cy = (pA.y + pB.y) * 0.5;
          const cz = (pA.z + pB.z) * 0.5;
          const horizSpan = Math.hypot(pB.x - pA.x, pB.z - pA.z) + 12;
          const dy = pB.y - pA.y;
          const span3D = Math.hypot(horizSpan, dy);
          const yaw = Math.atan2(pB.x - pA.x, pB.z - pA.z);
          const pitchX = -Math.atan2(dy, Math.max(1, Math.hypot(pB.x - pA.x, pB.z - pA.z)));
          const deckW = halfW * 2 + 2.2;

          const bridgeGroup = new THREE.Group();
          bridgeGroup.position.set(cx, cy, cz);
          bridgeGroup.rotation.order = 'YXZ';
          bridgeGroup.rotation.set(pitchX, yaw, 0);

          // Heavy 2.2m-thick concrete box girder deck (eliminates paper-thin underside gap)
          const slab = new THREE.Mesh(craftedBox(deckW, 2.2, span3D), bridgeConcreteMat);
          slab.position.set(0, -1.08, 0);
          slab.castShadow = true;
          slab.receiveShadow = true;
          slab.userData.surface = 'concrete';
          bridgeGroup.add(slab);
          shootableMeshes.push(slab);
          walkableMeshes.push(slab);

          // Raised sidewalks + concrete Jersey parapet barriers + heavy piers seated 24m into bedrock
          for (const side of [-1, 1]) {
            const curb = new THREE.Mesh(craftedBox(1.1, 0.35, span3D), bridgeConcreteMat);
            curb.position.set(side * (deckW * 0.5 - 0.55), 0.16, 0);
            bridgeGroup.add(curb);

            const parapet = new THREE.Mesh(craftedBox(0.42, 1.15, span3D), bridgeConcreteMat);
            parapet.position.set(side * (deckW * 0.5 - 0.21), 0.72, 0);
            parapet.castShadow = true;
            bridgeGroup.add(parapet);

            for (const pz of [-span3D * 0.24, span3D * 0.24]) {
              const pier = new THREE.Mesh(craftedBox(1.8, 24, 2.4), bridgeConcreteMat);
              pier.position.set(side * (deckW * 0.34), -13.0, pz);
              pier.castShadow = true;
              bridgeGroup.add(pier);
            }
          }

          // Massive concrete hammerhead pier caps + deep riverbank abutments anchoring both ends
          for (const pz of [-span3D * 0.24, span3D * 0.24]) {
            const cap = new THREE.Mesh(craftedBox(deckW + 0.4, 1.3, 2.8), bridgeConcreteMat);
            cap.position.set(0, -2.2, pz);
            bridgeGroup.add(cap);
          }
          for (const az of [-span3D * 0.48, span3D * 0.48]) {
            const abutment = new THREE.Mesh(craftedBox(deckW + 2.4, 18, 5.2), bridgeConcreteMat);
            abutment.position.set(0, -9.2, az);
            abutment.castShadow = true;
            bridgeGroup.add(abutment);
          }

          group.add(bridgeGroup);

          const maxY = Math.max(pA.y, pB.y);
          const minY = Math.min(pA.y, pB.y) - 2.2;
          const maxExtent = Math.max(deckW, span3D) * 0.5;
          if (Math.abs(Math.sin(yaw)) > 0.7) {
            colliders.push({
              surface: 'concrete',
              minX: cx - span3D * 0.48,
              maxX: cx + span3D * 0.48,
              minY,
              maxY,
              minZ: cz - deckW * 0.5,
              maxZ: cz + deckW * 0.5,
            });
          } else {
            colliders.push({
              surface: 'concrete',
              minX: cx - maxExtent * 0.7,
              maxX: cx + maxExtent * 0.7,
              minY,
              maxY,
              minZ: cz - maxExtent * 0.7,
              maxZ: cz + maxExtent * 0.7,
            });
          }
        }
        bridgeStart = -1;
      }
    }
  }

  const finalizeRibbon = (
    buf: ReturnType<typeof makeRibbonBuffers>,
    mat: THREE.Material,
    name: string,
    surface?: string,
  ) => {
    if (buf.indices.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
    geo.setIndex(buf.indices);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.userData.noCollide = true;
    if (surface) mesh.userData.surface = surface;
    group.add(mesh);
    if (surface) walkableMeshes.push(mesh);
  };

  finalizeRibbon(roadBuckets.highway, highwayMat, 'Island_Highways', 'concrete');
  finalizeRibbon(roadBuckets.rural, ruralMat, 'Island_Rural_Roads', 'concrete');
  finalizeRibbon(roadBuckets.dirt, dirtMat, 'Island_Dirt_Tracks', 'dirt');
  finalizeRibbon(roadBuckets.stripes, stripeMat, 'Island_Road_Markings');

  if (poleMatrices.length > 0) {
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.19, 6.8, 7);
    const poleInst = new THREE.InstancedMesh(poleGeo, poleWoodMat, poleMatrices.length);
    poleInst.name = 'Road_Utility_Poles';
    poleInst.castShadow = true;
    poleInst.userData.surface = 'wood';
    for (let i = 0; i < poleMatrices.length; i++) poleInst.setMatrixAt(i, poleMatrices[i]);
    poleInst.instanceMatrix.needsUpdate = true;
    group.add(poleInst);
    shootableMeshes.push(poleInst);

    const lampGeo = new THREE.BoxGeometry(0.65, 0.16, 0.35);
    const lampInst = new THREE.InstancedMesh(lampGeo, lampGlowMat, lampMatrices.length);
    lampInst.name = 'Road_Street_Lamps';
    lampInst.userData.noCollide = true;
    for (let i = 0; i < lampMatrices.length; i++) lampInst.setMatrixAt(i, lampMatrices[i]);
    lampInst.instanceMatrix.needsUpdate = true;
    group.add(lampInst);
  }

  if (fenceMatrices.length > 0) {
    const railGeo = craftedBox(0.2, 0.58, 9.6);
    const railInst = new THREE.InstancedMesh(railGeo, railSteelMat, fenceMatrices.length);
    railInst.name = 'Road_Highway_Guardrails';
    railInst.castShadow = true;
    railInst.userData.noCollide = true;
    for (let i = 0; i < fenceMatrices.length; i++) railInst.setMatrixAt(i, fenceMatrices[i]);
    railInst.instanceMatrix.needsUpdate = true;
    group.add(railInst);
  }

  return { group, shootableMeshes, walkableMeshes, colliders, ramps };
}
