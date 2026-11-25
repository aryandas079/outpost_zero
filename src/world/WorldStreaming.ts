/**
 * Unified Watertight Low-Poly Terrain System for the 25 km² Three-Island Map.
 * - Divides 5,000 m × 5,000 m into 8×8 = 64 spatial chunks (625 m × 625 m each).
 * - Uses ONE unified, bit-exact 48×48 grid (~13.02 m crisp low-poly facets) across ALL chunks
 *   pre-built once at load so adjacent chunks share identical edge vertices with ZERO holes,
 *   ZERO T-junctions, ZERO mid-run mesh allocation stutters, and ZERO physics/GPU height mismatch.
 */

import * as THREE from 'three';
import { WORLD_CONFIG } from '../core/Config';
import { ProceduralTextures } from '../game/textures';
import { classifyBiomeAt, BIOME_PALETTES } from './Biomes';
import {
  classifyIslandAt,
  ISLAND_HALF_SIZE,
  sampleIslandHeight,
  sampleIslandNormal,
} from './Terrain';
import { lerp, smoothstep } from '../utilities/SeededRng';

type LodLevel = 0 | 1 | 2;

interface TerrainChunk {
  cx: number;
  cz: number;
  centerX: number;
  centerZ: number;
  currentLod: LodLevel | -1;
  mesh: THREE.Mesh | null;
  lods: Partial<Record<LodLevel, THREE.BufferGeometry>>;
  lastUsedFrame: number;
}

const UNIFIED_SEGMENTS = 48;

const LOD_SEGMENTS: Record<LodLevel, number> = {
  0: UNIFIED_SEGMENTS,
  1: UNIFIED_SEGMENTS,
  2: UNIFIED_SEGMENTS,
};

/**
 * Evaluates exact barycentric triangle height of the 48×48 rendered terrain mesh at (wx, wz).
 * Physics capsule feet & camera sit on the exact mathematical plane of every rendered GPU triangle.
 */
export function sampleRenderedTerrainTriangleHeight(wx: number, wz: number): number {
  const step = WORLD_CONFIG.chunkSize / UNIFIED_SEGMENTS;
  const gx = (wx + ISLAND_HALF_SIZE) / step;
  const gz = (wz + ISLAND_HALF_SIZE) / step;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const x0 = -ISLAND_HALF_SIZE + ix * step;
  const z0 = -ISLAND_HALF_SIZE + iz * step;

  const hA = sampleIslandHeight(x0, z0);
  const hB = sampleIslandHeight(x0 + step, z0);
  const hC = sampleIslandHeight(x0, z0 + step);
  const hD = sampleIslandHeight(x0 + step, z0 + step);
  if (fx + fz <= 1) {
    return hA + (hB - hA) * fx + (hC - hA) * fz;
  }
  const u = 1 - fx;
  const v = 1 - fz;
  return hD + (hC - hD) * u + (hB - hD) * v;
}

export function createAntiTiledTerrainMaterial(_textures: ProceduralTextures): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.88,
    metalness: 0.02,
  });
}

function buildChunkGeometry(centerX: number, centerZ: number, size: number, segs: number): THREE.BufferGeometry {
  const step = size / segs;
  const cols = segs + 1;
  const baseVertCount = cols * cols;
  const skirtVertCount = segs * 4 * 2;
  const totalVerts = baseVertCount + skirtVertCount;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  const tmpNormal = new THREE.Vector3();
  const half = size * 0.5;
  const uvTileScale = 1 / 16;

  for (let iz = 0; iz <= segs; iz++) {
    const wz = centerZ - half + iz * step;
    for (let ix = 0; ix <= segs; ix++) {
      const wx = centerX - half + ix * step;
      const idx = iz * cols + ix;
      const wy = sampleIslandHeight(wx, wz);
      sampleIslandNormal(wx, wz, tmpNormal);

      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      normals[idx * 3] = tmpNormal.x;
      normals[idx * 3 + 1] = tmpNormal.y;
      normals[idx * 3 + 2] = tmpNormal.z;

      uvs[idx * 2] = wx * uvTileScale;
      uvs[idx * 2 + 1] = wz * uvTileScale;

      const slope = 1 - tmpNormal.y;
      const biomeId = classifyBiomeAt(wx, wz, wy, slope);
      const pal = BIOME_PALETTES[biomeId];
      const patch =
        0.5 +
        0.5 *
          (Math.sin(wx * 0.014 + 0.4) * Math.cos(wz * 0.013 - 0.3) * 0.65 +
            Math.sin((wx + wz) * 0.032) * 0.35);

      let r = lerp(pal.baseColor[0], pal.altColor[0], patch);
      let g = lerp(pal.baseColor[1], pal.altColor[1], patch);
      let b = lerp(pal.baseColor[2], pal.altColor[2], patch);

      const island = classifyIslandAt(wx, wz);

      // Tight sandy waterline margin in linear RGB
      if (wy >= 0.02 && wy < 1.5 && island !== 'desert_3km2') {
        const beachT = smoothstep(0.1, 1.5, wy);
        r = lerp(0.56, r, beachT);
        g = lerp(0.43, g, beachT);
        b = lerp(0.17, b, beachT);
      }

      // Crisp dark slate/sandstone cliff faces on steep slopes & Hoover Dam canyon walls
      if (slope > 0.14 && wy > 2.2) {
        const nearHooverCanyon = Math.abs(wx - 60) < 260 && wz > -520 && wz < 320;
        const cliffTargetR = island === 'desert_3km2' ? 0.36 : nearHooverCanyon ? 0.27 : 0.12;
        const cliffTargetG = island === 'desert_3km2' ? 0.16 : nearHooverCanyon ? 0.19 : 0.14;
        const cliffTargetB = island === 'desert_3km2' ? 0.07 : nearHooverCanyon ? 0.13 : 0.17;
        const rockBlend = smoothstep(0.14, 0.28, slope);
        r = lerp(r, cliffTargetR, rockBlend);
        g = lerp(g, cliffTargetG, rockBlend);
        b = lerp(b, cliffTargetB, rockBlend);
      }

      // Snow strictly on far northern mountain peaks (never near Hoover Dam)
      if (wy > 58 && wz < -740 && slope < 0.24 && island !== 'desert_3km2') {
        const peakBlend = smoothstep(58, 74, wy) * smoothstep(-740, -920, wz);
        r = lerp(r, 0.72, peakBlend * 0.82);
        g = lerp(g, 0.78, peakBlend * 0.82);
        b = lerp(b, 0.88, peakBlend * 0.82);
      }

      colors[idx * 3] = r;
      colors[idx * 3 + 1] = g;
      colors[idx * 3 + 2] = b;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Tiny 1.5m float-precision lip (identical neighbor vertices eliminate need for deep curtain skirts)
  let skirtCursor = baseVertCount;
  const skirtDepth = 1.5;
  const addSkirtEdge = (edgeIndices: number[], reverse: boolean) => {
    for (let k = 0; k < edgeIndices.length - 1; k++) {
      const topA = edgeIndices[k];
      const topB = edgeIndices[k + 1];
      const botA = skirtCursor++;
      const botB = skirtCursor++;

      for (const [src, dst] of [
        [topA, botA],
        [topB, botB],
      ]) {
        positions[dst * 3] = positions[src * 3];
        positions[dst * 3 + 1] = positions[src * 3 + 1] - skirtDepth;
        positions[dst * 3 + 2] = positions[src * 3 + 2];
        normals[dst * 3] = normals[src * 3];
        normals[dst * 3 + 1] = normals[src * 3 + 1];
        normals[dst * 3 + 2] = normals[src * 3 + 2];
        colors[dst * 3] = colors[src * 3];
        colors[dst * 3 + 1] = colors[src * 3 + 1];
        colors[dst * 3 + 2] = colors[src * 3 + 2];
        uvs[dst * 2] = uvs[src * 2];
        uvs[dst * 2 + 1] = uvs[src * 2 + 1];
      }

      if (reverse) {
        indices.push(topA, botA, topB, topB, botA, botB);
      } else {
        indices.push(topA, topB, botA, topB, botB, botA);
      }
    }
  };

  const topEdge: number[] = [];
  const bottomEdge: number[] = [];
  const leftEdge: number[] = [];
  const rightEdge: number[] = [];
  for (let i = 0; i <= segs; i++) {
    topEdge.push(i);
    bottomEdge.push(segs * cols + i);
    leftEdge.push(i * cols);
    rightEdge.push(i * cols + segs);
  }
  addSkirtEdge(topEdge, false);
  addSkirtEdge(bottomEdge, true);
  addSkirtEdge(leftEdge, true);
  addSkirtEdge(rightEdge, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export class IslandTerrainStreamer {
  public readonly group = new THREE.Group();
  public readonly terrainMaterial: THREE.MeshStandardMaterial;
  public readonly shootableMeshes: THREE.Object3D[] = [];
  public readonly walkableMeshes: THREE.Object3D[] = [];
  private readonly chunks: TerrainChunk[] = [];
  private readonly chunkSize = WORLD_CONFIG.chunkSize;
  private readonly gridCount = Math.round((ISLAND_HALF_SIZE * 2) / WORLD_CONFIG.chunkSize);
  private frameCounter = 0;
  public activeVisibleChunks = 0;

  constructor(textures: ProceduralTextures) {
    this.group.name = 'Island_Chunked_Terrain';
    this.terrainMaterial = createAntiTiledTerrainMaterial(textures);

    for (let gz = 0; gz < this.gridCount; gz++) {
      for (let gx = 0; gx < this.gridCount; gx++) {
        const centerX = -ISLAND_HALF_SIZE + (gx + 0.5) * this.chunkSize;
        const centerZ = -ISLAND_HALF_SIZE + (gz + 0.5) * this.chunkSize;
        const initGeo = buildChunkGeometry(centerX, centerZ, this.chunkSize, LOD_SEGMENTS[0]);
        const mesh = new THREE.Mesh(initGeo, this.terrainMaterial);
        mesh.receiveShadow = true;
        mesh.userData.surface = 'dirt';
        mesh.userData.noCollide = true;
        this.group.add(mesh);
        this.shootableMeshes.push(mesh);
        this.walkableMeshes.push(mesh);
        this.chunks.push({
          cx: gx,
          cz: gz,
          centerX,
          centerZ,
          currentLod: 0,
          mesh,
          lods: { 0: initGeo },
          lastUsedFrame: 0,
        });
      }
    }
  }

  public sampleActiveRenderedHeightAt(wx: number, wz: number): number {
    return sampleRenderedTerrainTriangleHeight(wx, wz);
  }

  public ensureHighLodAround(focusX: number, focusZ: number, radiusMeters = 1000): void {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (Math.hypot(chunk.centerX - focusX, chunk.centerZ - focusZ) <= radiusMeters && chunk.mesh) {
        chunk.mesh.visible = true;
        chunk.currentLod = 0;
        chunk.lastUsedFrame = this.frameCounter;
      }
    }
  }

  public update(
    focusX: number,
    focusZ: number,
    velX = 0,
    velZ = 0,
    viewDistanceMeters = 7200,
    _maxBuildsPerFrame = 4,
  ): void {
    this.frameCounter++;
    const predictX = focusX + THREE.MathUtils.clamp(velX * 1.4, -280, 280);
    const predictZ = focusZ + THREE.MathUtils.clamp(velZ * 1.4, -280, 280);

    let visibleCount = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const distPlayer = Math.hypot(chunk.centerX - focusX, chunk.centerZ - focusZ);
      const distPredict = Math.hypot(chunk.centerX - predictX, chunk.centerZ - predictZ);
      const dist = Math.min(distPlayer, distPredict);
      const inView = dist <= viewDistanceMeters + this.chunkSize * 0.9;
      if (chunk.mesh) {
        chunk.mesh.visible = inView;
      }
      if (inView) {
        visibleCount++;
        chunk.lastUsedFrame = this.frameCounter;
      }
    }

    this.activeVisibleChunks = visibleCount;
  }

  public dispose(): void {
    for (const chunk of this.chunks) {
      if (chunk.lods[0]) chunk.lods[0].dispose();
      chunk.mesh?.removeFromParent();
    }
    this.chunks.length = 0;
    this.terrainMaterial.dispose();
  }
}
