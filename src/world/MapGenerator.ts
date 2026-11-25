/**
 * Clean 25 km² Three-Island Battle Royale Arena Assembler:
 * - Chunked low-poly LOD terrain (Main 15 km², Cliff 7 km², Desert 3 km²)
 * - Surrounding Sea, Big Inland Lakes, Hydro Reservoir, & Left-to-Center River
 * - Low-Poly Hydroelectric Dam on the Main Island River
 * - 3 Monumental Axis-Aligned Low-Poly Suspension Bridges connecting all 3 islands cleanly
 */

import * as THREE from 'three';
import type { ArenaBounds, ArenaData, BoxCollider, RampSurface } from '../game/arena';
import { optimizeStaticArena } from '../game/geometry';
import { ProceduralTextures } from '../game/textures';
import { WORLD_CONFIG } from '../core/Config';
import {
  ISLAND_HALF_SIZE,
  ISLAND_POIS,
  sampleIslandHeight,
  sampleIslandNormal,
  setActiveIslandSeed,
} from './Terrain';
import { IslandTerrainStreamer, sampleRenderedTerrainTriangleHeight } from './WorldStreaming';
import { createIslandWaterSystem, IslandWaterSystem } from './Water';

export interface IslandArenaData extends ArenaData {
  terrainStreamer: IslandTerrainStreamer;
  waterSystem: IslandWaterSystem;
  lootAnchors: Array<{ pos: THREE.Vector3; poiId: string; tier: 'standard' | 'high' | 'military' }>;
}

/** Hexagonal Energy Forcefield Storm Wall */
export function buildStormWallMesh(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(1, 1, 1400, 96, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x22d3ee) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      float hexEdgeDist(vec2 p) {
        const vec2 s = vec2(1.0, 1.7320508);
        vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
        vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
        vec2 c = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? h.xy : h.zw;
        c = abs(c);
        return 0.5 - max(dot(c, normalize(s)), c.x);
      }

      void main() {
        vec2 hexUv = vec2(vUv.x * 840.0, vUv.y * 250.0);
        float d = hexEdgeDist(hexUv);
        float border = 1.0 - smoothstep(0.01, 0.04, d);

        float scanWave = 0.72 + 0.28 * sin(vWorldPos.y * 0.16 - uTime * 3.1 + vUv.x * 42.0);
        float bottomFade = smoothstep(-18.0, 14.0, vWorldPos.y);
        float topFade = 1.0 - smoothstep(65.0, 195.0, vWorldPos.y);
        float baseHotGlow = (1.0 - smoothstep(0.0, 26.0, abs(vWorldPos.y - 4.0))) * bottomFade;

        vec3 fillBlue = mix(uColor * 0.42, vec3(0.11, 0.52, 0.94), 0.65);
        vec3 rimCyan = vec3(0.46, 0.90, 1.0);
        vec3 cellCol = mix(fillBlue, rimCyan, border * 0.76 + baseHotGlow * 0.45);
        float alpha = bottomFade * topFade * (0.03 + border * 0.26 * scanWave + baseHotGlow * 0.18);
        gl_FragColor = vec4(cellCol, clamp(alpha, 0.0, 0.48));
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'BattleRoyale_StormWall';
  mesh.position.y = 580;
  mesh.userData.noCollide = true;
  return mesh;
}

/**
 * Builds a monumental axis-aligned low-poly suspension bridge connecting two islands over water,
 * complete with walkable main deck, sloped end-ramps grounded onto both island shores,
 * twin H-frame pylon towers, deep seabed caissons, catenary main cables, and vertical suspenders.
 */
function buildLowPolySuspensionBridge(
  group: THREE.Group,
  colliders: BoxCollider[],
  ramps: RampSurface[],
  shootableMeshes: THREE.Object3D[],
  walkableMeshes: THREE.Object3D[],
  opts: {
    name: string;
    axis: 'x' | 'z';
    fixedCoord: number; // Z when axis='x', X when axis='z'
    start: number; // Shore start coordinate along bridge axis
    end: number; // Shore end coordinate along bridge axis
    deckY: number;
    towerHeight: number;
    materials: {
      deckMat: THREE.Material;
      towerMat: THREE.Material;
      cableMat: THREE.Material;
      concreteMat: THREE.Material;
    };
  },
): void {
  const { axis, fixedCoord, start, end, deckY, towerHeight, materials } = opts;
  const span = Math.abs(end - start);
  const center = (start + end) * 0.5;
  const halfWidth = 7.5; // 15 m wide solid roadway deck
  const rampLen = 48;
  const mainSpanStart = Math.min(start, end) + rampLen;
  const mainSpanEnd = Math.max(start, end) - rampLen;
  const mainSpanLen = Math.max(60, mainSpanEnd - mainSpanStart);
  const mainCenter = (mainSpanStart + mainSpanEnd) * 0.5;

  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = opts.name;
  group.add(bridgeGroup);

  const addBoxPart = (
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    collide = true,
    walkable = false,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(cx, cy, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    if (!collide) m.userData.noCollide = true;
    bridgeGroup.add(m);
    if (collide) {
      shootableMeshes.push(m);
      colliders.push({
        surface: 'concrete',
        minX: cx - sx * 0.5,
        maxX: cx + sx * 0.5,
        minY: cy - sy * 0.5,
        maxY: cy + sy * 0.5,
        minZ: cz - sz * 0.5,
        maxZ: cz + sz * 0.5,
      });
    }
    if (walkable) walkableMeshes.push(m);
    return m;
  };

  // 1. Flat Elevated Main Span Deck + Concrete Guard Curbs
  if (axis === 'x') {
    addBoxPart(mainCenter, deckY - 0.9, fixedCoord, mainSpanLen, 1.8, halfWidth * 2, materials.deckMat, true, true);
    // Low side guard curbs (walkable safety rails)
    addBoxPart(mainCenter, deckY + 0.55, fixedCoord - halfWidth + 0.4, mainSpanLen, 1.1, 0.8, materials.concreteMat, true);
    addBoxPart(mainCenter, deckY + 0.55, fixedCoord + halfWidth - 0.4, mainSpanLen, 1.1, 0.8, materials.concreteMat, true);
  } else {
    addBoxPart(fixedCoord, deckY - 0.9, mainCenter, halfWidth * 2, 1.8, mainSpanLen, materials.deckMat, true, true);
    addBoxPart(fixedCoord - halfWidth + 0.4, deckY + 0.55, mainCenter, 0.8, 1.1, mainSpanLen, materials.concreteMat, true);
    addBoxPart(fixedCoord + halfWidth - 0.4, deckY + 0.55, mainCenter, 0.8, 1.1, mainSpanLen, materials.concreteMat, true);
  }

  // 2. Grounded Approach Ramps connecting shores cleanly to deckY
  const buildApproachRamp = (shorePos: number, deckPos: number) => {
    const mid = (shorePos + deckPos) * 0.5;
    const shoreGroundY = Math.max(
      1.5,
      axis === 'x' ? sampleIslandHeight(shorePos, fixedCoord) : sampleIslandHeight(fixedCoord, shorePos),
    );
    const len = Math.abs(deckPos - shorePos);
    const dy = deckY - shoreGroundY;
    const pitch = Math.atan2(dy, len);
    const hyp = Math.hypot(len, dy);

    const geo =
      axis === 'x'
        ? new THREE.BoxGeometry(hyp + 2, 1.6, halfWidth * 2)
        : new THREE.BoxGeometry(halfWidth * 2, 1.6, hyp + 2);
    const rampMesh = new THREE.Mesh(geo, materials.deckMat);
    const midY = (shoreGroundY + deckY) * 0.5 - 0.8;
    rampMesh.position.set(axis === 'x' ? mid : fixedCoord, midY, axis === 'z' ? mid : fixedCoord);
    if (axis === 'x') {
      rampMesh.rotation.z = deckPos > shorePos ? pitch : -pitch;
    } else {
      rampMesh.rotation.x = deckPos > shorePos ? -pitch : pitch;
    }
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampMesh.userData.noCollide = true; // Handled cleanly by analytical RampSurface below
    bridgeGroup.add(rampMesh);
    walkableMeshes.push(rampMesh);
    shootableMeshes.push(rampMesh);

    // Concrete abutment block anchoring shore end into terrain
    const abutY = shoreGroundY - 3.0;
    if (axis === 'x') {
      addBoxPart(shorePos, abutY, fixedCoord, 14, 10, halfWidth * 2 + 2, materials.concreteMat, true);
      ramps.push({
        minX: Math.min(shorePos, deckPos),
        maxX: Math.max(shorePos, deckPos),
        minZ: fixedCoord - halfWidth,
        maxZ: fixedCoord + halfWidth,
        axis: 'x',
        lowEdge: shorePos,
        highEdge: deckPos,
        lowY: shoreGroundY,
        highY: deckY,
      });
    } else {
      addBoxPart(fixedCoord, abutY, shorePos, halfWidth * 2 + 2, 10, 14, materials.concreteMat, true);
      ramps.push({
        minX: fixedCoord - halfWidth,
        maxX: fixedCoord + halfWidth,
        minZ: Math.min(shorePos, deckPos),
        maxZ: Math.max(shorePos, deckPos),
        axis: 'z',
        lowEdge: shorePos,
        highEdge: deckPos,
        lowY: shoreGroundY,
        highY: deckY,
      });
    }
  };

  buildApproachRamp(Math.min(start, end), mainSpanStart);
  buildApproachRamp(Math.max(start, end), mainSpanEnd);

  // 3. Twin Suspension Towers (at 28% and 72% of main span) + Underwater Pier Caissons
  const t1 = mainSpanStart + mainSpanLen * 0.24;
  const t2 = mainSpanStart + mainSpanLen * 0.76;
  const towerPositions = [t1, t2];
  const towerTopY = deckY + towerHeight;

  for (const tp of towerPositions) {
    const legOffset = halfWidth + 0.9;
    // Deep concrete foundation caisson descending into ocean bed
    if (axis === 'x') {
      addBoxPart(tp, (deckY - 14) * 0.5 - 1.5, fixedCoord, 10, deckY + 14, halfWidth * 2 + 6, materials.concreteMat, true);
      addBoxPart(tp, (deckY + towerTopY) * 0.5 - 3, fixedCoord - legOffset, 4.2, towerHeight + 10, 3.6, materials.towerMat, true);
      addBoxPart(tp, (deckY + towerTopY) * 0.5 - 3, fixedCoord + legOffset, 4.2, towerHeight + 10, 3.6, materials.towerMat, true);
      addBoxPart(tp, towerTopY - 3, fixedCoord, 3.4, 3.6, legOffset * 2 + 2, materials.towerMat, false);
      addBoxPart(tp, deckY + towerHeight * 0.52, fixedCoord, 3.0, 2.8, legOffset * 2, materials.towerMat, false);
    } else {
      addBoxPart(fixedCoord, (deckY - 14) * 0.5 - 1.5, tp, halfWidth * 2 + 6, deckY + 14, 10, materials.concreteMat, true);
      addBoxPart(fixedCoord - legOffset, (deckY + towerTopY) * 0.5 - 3, tp, 3.6, towerHeight + 10, 4.2, materials.towerMat, true);
      addBoxPart(fixedCoord + legOffset, (deckY + towerTopY) * 0.5 - 3, tp, 3.6, towerHeight + 10, 4.2, materials.towerMat, true);
      addBoxPart(fixedCoord, towerTopY - 3, tp, legOffset * 2 + 2, 3.6, 3.4, materials.towerMat, false);
      addBoxPart(fixedCoord, deckY + towerHeight * 0.52, tp, legOffset * 2, 2.8, 3.0, materials.towerMat, false);
    }
  }

  // 4. Sweeping Catenary Main Cables + Vertical Suspender Cables on both sides
  const catenaryY = (pos: number): number => {
    if (pos <= t1) {
      const f = Math.max(0, (pos - Math.min(start, end)) / (t1 - Math.min(start, end)));
      return THREE.MathUtils.lerp(deckY + 2, towerTopY, f * f * 0.65 + f * 0.35);
    }
    if (pos >= t2) {
      const f = Math.max(0, (Math.max(start, end) - pos) / (Math.max(start, end) - t2));
      return THREE.MathUtils.lerp(deckY + 2, towerTopY, f * f * 0.65 + f * 0.35);
    }
    const u = ((pos - t1) / (t2 - t1)) * 2 - 1; // -1..1 between towers
    return deckY + 5.5 + (towerTopY - (deckY + 5.5)) * u * u;
  };

  const addCableSegment = (a: THREE.Vector3, b: THREE.Vector3, radius: number) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.2) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6), materials.cableMat);
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.userData.noCollide = true;
    bridgeGroup.add(m);
  };

  const cableSegs = 28;
  const sMin = Math.min(start, end);
  const sMax = Math.max(start, end);
  for (const sideSign of [-1, 1]) {
    const lat = fixedCoord + sideSign * (halfWidth + 0.9);
    let prevPt: THREE.Vector3 | null = null;
    for (let i = 0; i <= cableSegs; i++) {
      const p = THREE.MathUtils.lerp(sMin, sMax, i / cableSegs);
      const cy = catenaryY(p);
      const curPt = axis === 'x' ? new THREE.Vector3(p, cy, lat) : new THREE.Vector3(lat, cy, p);
      if (prevPt) {
        addCableSegment(prevPt, curPt, 0.42);
      }
      prevPt = curPt;

      // Vertical suspender cable down to deck edge
      if (p > mainSpanStart + 10 && p < mainSpanEnd - 10 && cy > deckY + 2.5) {
        const deckAnchor = axis === 'x' ? new THREE.Vector3(p, deckY + 0.4, lat) : new THREE.Vector3(lat, deckY + 0.4, p);
        addCableSegment(curPt, deckAnchor, 0.16);
      }
    }
  }

  // Keep lint happy if center/span unused outside readability
  void center;
  void span;
}

export function buildBattleRoyaleIslandArena(
  textures: ProceduralTextures,
  seed = WORLD_CONFIG.defaultSeed,
): IslandArenaData {
  setActiveIslandSeed(seed);

  const group = new THREE.Group();
  group.name = 'BattleRoyale_25km2_ThreeIslands';

  const bounds: ArenaBounds = {
    minX: -ISLAND_HALF_SIZE,
    maxX: ISLAND_HALF_SIZE,
    minZ: -ISLAND_HALF_SIZE,
    maxZ: ISLAND_HALF_SIZE,
  };

  // 1. Chunked Multi-LOD Low-Poly Terrain Streaming
  const terrainStreamer = new IslandTerrainStreamer(textures);
  group.add(terrainStreamer.group);

  // 2. Surrounding Sea, Inland Lakes, Hydro Reservoir & Left-to-Center River
  const waterSystem = createIslandWaterSystem();
  group.add(waterSystem.group);

  // 3. Clean Low-Poly Hydroelectric Dam & 3 Monumental Suspension Bridges
  const colliders: BoxCollider[] = [];
  const ramps: RampSurface[] = [];
  const shootableMeshes: THREE.Object3D[] = [...terrainStreamer.shootableMeshes];
  const walkableMeshes: THREE.Object3D[] = [...terrainStreamer.walkableMeshes];

  const pushCollider = (mesh: THREE.Object3D, surface = 'concrete') => {
    const b = new THREE.Box3().setFromObject(mesh);
    colliders.push({
      surface,
      minX: b.min.x, maxX: b.max.x,
      minY: b.min.y, maxY: b.max.y,
      minZ: b.min.z, maxZ: b.max.z,
    });
  };

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x9ca3a8,
    flatShading: true,
    roughness: 0.88,
    metalness: 0.05,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x3b444d,
    flatShading: true,
    roughness: 0.52,
    metalness: 0.45,
  });
  const towerRedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xb94a34,
    flatShading: true,
    roughness: 0.58,
    metalness: 0.32,
  });
  const deckAsphaltMat = new THREE.MeshStandardMaterial({
    color: 0x4b525a,
    flatShading: true,
    roughness: 0.86,
    metalness: 0.08,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0xd1d7dc,
    flatShading: true,
    roughness: 0.45,
    metalness: 0.55,
  });

  // --- A. Curved Low-Poly Hoover Dam spanning the open Canyon Gorge (60, -84) ---
  // Bows upstream into the large 39.2m Reservoir with stepped concrete downstream face & twin intake towers.
  const damCenterX = 60;
  const damBaseZ = -72;
  const damTopY = 44.5;
  const damBaseY = 2.0;
  const damArchSegs = 11;
  const damHalfSpan = 96; // X: -36 .. 156 anchored cleanly into 44.5m canyon walls
  const archBow = 26;

  const damCurveZ = (xOffset: number) => {
    const u = Math.max(-1, Math.min(1, xOffset / damHalfSpan));
    return damBaseZ - archBow * (1 - u * u);
  };

  for (let s = 0; s < damArchSegs; s++) {
    const x0 = -damHalfSpan + (s / damArchSegs) * (damHalfSpan * 2);
    const x1 = -damHalfSpan + ((s + 1) / damArchSegs) * (damHalfSpan * 2);
    const xm = (x0 + x1) * 0.5;
    const z0 = damCurveZ(x0);
    const z1 = damCurveZ(x1);
    const zm = (z0 + z1) * 0.5;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const segLen = Math.hypot(dx, dz) + 2.4;
    const segYaw = -Math.atan2(dz, dx);

    // 3 battered vertical tiers (wider bedrock base tapering to sleek curved top roadway)
    const tiers: Array<{ yMin: number; yMax: number; thick: number; zShift: number; mat: THREE.Material }> = [
      { yMin: damBaseY, yMax: 20, thick: 32, zShift: 7, mat: concreteMat },
      { yMin: 18, yMax: 34, thick: 23, zShift: 3, mat: concreteMat },
      { yMin: 32, yMax: damTopY, thick: 15, zShift: 0, mat: concreteMat },
    ];
    for (const tier of tiers) {
      const th = tier.yMax - tier.yMin;
      const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(segLen, th, tier.thick), tier.mat);
      wallSeg.position.set(damCenterX + xm, (tier.yMin + tier.yMax) * 0.5, zm + tier.zShift);
      wallSeg.rotation.y = segYaw;
      wallSeg.castShadow = true;
      wallSeg.receiveShadow = true;
      wallSeg.userData.noCollide = true; // Use clean axis-aligned tile colliders below so curved face never blocks sideways
      group.add(wallSeg);
      shootableMeshes.push(wallSeg);
    }

    // Walkable Crest Roadway Segment & Axis-Aligned Solid Collider Tile
    const crestSeg = new THREE.Mesh(new THREE.BoxGeometry(segLen, 1.4, 15.5), deckAsphaltMat);
    crestSeg.position.set(damCenterX + xm, damTopY + 0.7, zm);
    crestSeg.rotation.y = segYaw;
    crestSeg.castShadow = true;
    crestSeg.receiveShadow = true;
    crestSeg.userData.noCollide = true;
    group.add(crestSeg);
    walkableMeshes.push(crestSeg);

    const tileW = Math.abs(dx) + 2.0;
    const tileD = 15.5 + Math.abs(dz);
    colliders.push({
      surface: 'concrete',
      minX: damCenterX + xm - tileW * 0.5,
      maxX: damCenterX + xm + tileW * 0.5,
      minY: damBaseY,
      maxY: damTopY + 1.4,
      minZ: zm - tileD * 0.5,
      maxZ: zm + tileD * 0.5,
    });
  }

  // Twin Octagonal Concrete Hoover Intake Towers standing in the upstream reservoir water
  for (const ix of [-34, 34]) {
    const towerX = damCenterX + ix;
    const towerZ = damCurveZ(ix) - 24;
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.6, 32, 8), concreteMat);
    intake.position.set(towerX, 38.0, towerZ);
    intake.castShadow = true;
    intake.receiveShadow = true;
    group.add(intake);
    shootableMeshes.push(intake);
    pushCollider(intake, 'concrete');

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, 3.2, 8), darkSteelMat);
    cap.position.set(towerX, 53.5, towerZ);
    cap.userData.noCollide = true;
    group.add(cap);

    // Walkway bridge connecting Intake Tower to Hoover Dam Crest
    const footbridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 22), darkSteelMat);
    footbridge.position.set(towerX, damTopY + 0.6, towerZ + 12);
    footbridge.castShadow = true;
    footbridge.receiveShadow = true;
    group.add(footbridge);
    walkableMeshes.push(footbridge);
    pushCollider(footbridge, 'metal');
  }

  // Downstream Hydro Powerhouse Hall at base of canyon wall
  const powerhouse = new THREE.Mesh(new THREE.BoxGeometry(72, 11, 14), concreteMat);
  powerhouse.position.set(damCenterX, damBaseY + 5.5, damBaseZ + 16);
  powerhouse.castShadow = true;
  powerhouse.receiveShadow = true;
  group.add(powerhouse);
  shootableMeshes.push(powerhouse);
  walkableMeshes.push(powerhouse);
  pushCollider(powerhouse, 'concrete');

  // --- B. Three Monumental Low-Poly Suspension Bridges connecting all 3 islands ---
  const bridgeMats = {
    deckMat: deckAsphaltMat,
    towerMat: towerRedSteelMat,
    cableMat,
    concreteMat,
  };

  // 1) North Suspension Bridge: Cliff Island (7 km², x=-760) <-> Main Island (15 km², x=-200) at z = -420
  buildLowPolySuspensionBridge(group, colliders, ramps, shootableMeshes, walkableMeshes, {
    name: 'North_Cliff_Main_Suspension_Bridge',
    axis: 'x',
    fixedCoord: -420,
    start: -760,
    end: -200,
    deckY: 16.5,
    towerHeight: 46,
    materials: bridgeMats,
  });

  // 2) West Strait Suspension Bridge: Cliff Island (7 km², z=240) <-> Desert Island (3 km², z=780) at x = -1260
  buildLowPolySuspensionBridge(group, colliders, ramps, shootableMeshes, walkableMeshes, {
    name: 'West_Cliff_Desert_Suspension_Bridge',
    axis: 'z',
    fixedCoord: -1260,
    start: 240,
    end: 780,
    deckY: 14.5,
    towerHeight: 44,
    materials: bridgeMats,
  });

  // 3) South Suspension Bridge: Desert Island (3 km², x=-660) <-> Main Island (15 km², x=60) at z = 980
  buildLowPolySuspensionBridge(group, colliders, ramps, shootableMeshes, walkableMeshes, {
    name: 'South_Desert_Main_Suspension_Bridge',
    axis: 'x',
    fixedCoord: 980,
    start: -660,
    end: 60,
    deckY: 15.0,
    towerHeight: 50,
    materials: bridgeMats,
  });

  const spawnPoints: THREE.Vector3[] = [];
  const pickupSpots: THREE.Vector3[] = [];
  const lootAnchors: Array<{ pos: THREE.Vector3; poiId: string; tier: 'standard' | 'high' | 'military' }> = [];
  for (const poi of ISLAND_POIS) {
    const wy = sampleRenderedTerrainTriangleHeight(poi.x, poi.z);
    if (wy > 1.0) {
      spawnPoints.push(new THREE.Vector3(poi.x, wy, poi.z));
      pickupSpots.push(new THREE.Vector3(poi.x + 8, wy, poi.z + 8));
      lootAnchors.push({ pos: new THREE.Vector3(poi.x, wy, poi.z), poiId: poi.id, tier: poi.lootTier });
    }
  }

  const islandOwnedGeometries: THREE.BufferGeometry[] = [];

  return {
    mapName: 'ISLAND — 25 KM² THREE ISLANDS',
    group,
    colliders,
    ramps,
    shootableMeshes,
    walkableMeshes,
    occludables: [],
    spawnPoints,
    pickupSpots,
    buildingFootprints: [],
    arenaHalfSize: ISLAND_HALF_SIZE,
    bounds,
    animatedProps: {
      windmillWheel: null,
      flagMesh: null,
      tumbleweeds: [],
    },
    terrainHeightAt: sampleRenderedTerrainTriangleHeight,
    terrainNormalAt: sampleIslandNormal,
    terrainStreamer,
    waterSystem,
    lootAnchors,
    optimizeRendering: () => optimizeStaticArena(group, [], new Set(), islandOwnedGeometries),
    dispose: () => {
      islandOwnedGeometries.forEach((g) => g.dispose());
      terrainStreamer.dispose();
      waterSystem.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    },
  };
}
