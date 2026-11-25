/**
 * Deterministic 25 km² (5,000 m × 5,000 m) Three-Island Low-Poly Battle Royale Heightfield:
 * - Main Island (~15 km² share, East/Center): Crisp low-poly emerald forest, dramatic rocky cliffs,
 *   elevated organic inland lakes (zero ocean z-fighting), open-canyon Hydroelectric Dam, & left-to-center river.
 * - Medium Cliff Island (~7 km² share, West/NW): Terraced highlands and steep rocky sea cliffs.
 * - Small Desert Island (~3 km² share, SW): Golden sand dunes and warm terracotta low-poly mesas.
 *
 * Strictly C¹-smooth everywhere so low-poly chunked meshes render solidly with zero seam cracks or tearing.
 */

import * as THREE from 'three';
import { WORLD_CONFIG } from '../core/Config';
import { clamp, fbm2D, lerp, ridgedNoise2D, smoothstep } from '../utilities/SeededRng';

export const ISLAND_HALF_SIZE = WORLD_CONFIG.islandHalfSize;
export const ISLAND_AREA_KM2 = ((ISLAND_HALF_SIZE * 2) * (ISLAND_HALF_SIZE * 2)) / 1_000_000;

export type IslandId = 'main_15km2' | 'cliff_7km2' | 'desert_3km2' | 'ocean';

export type PoiTheme =
  | 'city'
  | 'quarry'
  | 'solar'
  | 'airbase'
  | 'harbor'
  | 'dam'
  | 'radar'
  | 'residential'
  | 'factory'
  | 'bunker'
  | 'outpost'
  | 'railway'
  | 'farm'
  | 'lighthouse'
  | 'substation'
  | 'research';

export interface IslandPoiSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  padRadius: number;
  baseElevation: number;
  theme: PoiTheme;
  lootTier: 'standard' | 'high' | 'military';
}

export interface InlandLakeSpec {
  id: string;
  name: string;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  waterLevel: number;
  maxDepth: number;
  phase: number;
}

/**
 * Elevated organic inland lakes deep inside the 15 km² Main Island.
 * Elevated clearly above sea level (8.6 m & 6.4 m) so there is zero Z-fighting with the -0.35 m ocean shader.
 */
export const INLAND_LAKES: readonly InlandLakeSpec[] = [
  {
    id: 'emerald_lake',
    name: 'EMERALD LAKE',
    cx: 1020,
    cz: 110,
    rx: 270,
    rz: 210,
    waterLevel: 8.6,
    maxDepth: 5.4,
    phase: 0.7,
  },
  {
    id: 'south_mirror_lake',
    name: 'MIRROR LAKE',
    cx: 740,
    cz: 820,
    rx: 235,
    rz: 185,
    waterLevel: 6.4,
    maxDepth: 4.8,
    phase: 2.1,
  },
];

/** Evaluates organic deformed radial distance (< 1.0 inside lake shoreline). */
export function evalInlandLakeDist(x: number, z: number, lake: InlandLakeSpec): number {
  const dx = (x - lake.cx) / lake.rx;
  const dz = (z - lake.cz) / lake.rz;
  const ang = Math.atan2(dz, dx);
  const wobble = 1 + 0.16 * Math.sin(ang * 3 + lake.phase) + 0.09 * Math.cos(ang * 5 - lake.phase * 1.4);
  return Math.hypot(dx, dz) / wobble;
}

export const ISLAND_POIS: readonly IslandPoiSpec[] = [
  { id: 'central_city', name: 'CENTRAL VALLEY', x: 320, z: 180, padRadius: 68, baseElevation: 16.0, theme: 'city', lootTier: 'high' },
  { id: 'north_quarry', name: 'NORTHWEST CLIFFS', x: -1240, z: -840, padRadius: 62, baseElevation: 34.0, theme: 'quarry', lootTier: 'high' },
  { id: 'solar_array', name: 'EASTERN FOREST', x: 1460, z: -260, padRadius: 60, baseElevation: 18.0, theme: 'solar', lootTier: 'standard' },
  { id: 'military_airbase', name: 'WESTERN PLATEAU', x: -1580, z: -160, padRadius: 72, baseElevation: 22.0, theme: 'airbase', lootTier: 'military' },
  { id: 'coastal_port', name: 'DESERT OASIS SHORE', x: -860, z: 1240, padRadius: 64, baseElevation: 8.5, theme: 'harbor', lootTier: 'high' },
  { id: 'hydro_dam', name: 'HOOVER DAM', x: 60, z: -80, padRadius: 64, baseElevation: 43.0, theme: 'dam', lootTier: 'high' },
  { id: 'comms_station', name: 'NORTHERN PEAKS', x: 620, z: -1160, padRadius: 56, baseElevation: 42.0, theme: 'radar', lootTier: 'military' },
  { id: 'residential_town', name: 'CLIFF ISLAND RIDGE', x: -940, z: -420, padRadius: 58, baseElevation: 24.0, theme: 'residential', lootTier: 'standard' },
  { id: 'abandoned_factory', name: 'RIVER BEND WOODS', x: 360, z: 540, padRadius: 58, baseElevation: 13.0, theme: 'factory', lootTier: 'high' },
  { id: 'forest_bunker', name: 'TIMBER HIGHLANDS', x: 1180, z: -640, padRadius: 56, baseElevation: 25.0, theme: 'bunker', lootTier: 'military' },
  { id: 'mountain_outpost', name: 'GRANITE OVERLOOK', x: 180, z: -860, padRadius: 58, baseElevation: 44.0, theme: 'outpost', lootTier: 'military' },
  { id: 'railway_yard', name: 'DUNES SOUTH', x: -1340, z: 1420, padRadius: 60, baseElevation: 14.0, theme: 'railway', lootTier: 'standard' },
  { id: 'farm_district', name: 'SOUTH LAKE SHORE', x: 1140, z: 680, padRadius: 60, baseElevation: 14.0, theme: 'farm', lootTier: 'standard' },
  { id: 'coastal_village', name: 'NORTHEAST CAPE', x: 1420, z: -1020, padRadius: 56, baseElevation: 19.0, theme: 'lighthouse', lootTier: 'standard' },
  { id: 'power_substation', name: 'WEST CLIFF POINT', x: -1780, z: -680, padRadius: 52, baseElevation: 28.0, theme: 'substation', lootTier: 'standard' },
  { id: 'research_facility', name: 'RED ROCK MESA', x: -1060, z: 1020, padRadius: 56, baseElevation: 18.0, theme: 'research', lootTier: 'military' },
];

export type RoadKind = 'highway' | 'rural' | 'dirt';

export interface IslandRoadSpec {
  id: string;
  kind: RoadKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  curveAmp: number;
}

export const ISLAND_ROAD_SPECS: readonly IslandRoadSpec[] = [
  { id: 'link-cliff-1', kind: 'highway', x0: -1780, z0: -680, x1: -1240, z1: -840, curveAmp: 12 },
  { id: 'link-cliff-2', kind: 'highway', x0: -1240, z0: -840, x1: -940, z1: -420, curveAmp: -10 },
  { id: 'link-cliff-3', kind: 'rural', x0: -1580, z0: -160, x1: -940, z1: -420, curveAmp: 8 },
  { id: 'bridge-north', kind: 'highway', x0: -940, z0: -420, x1: 60, z1: -80, curveAmp: 0 },
  { id: 'bridge-west', kind: 'highway', x0: -1580, z0: -160, x1: -1060, z1: 1020, curveAmp: 0 },
  { id: 'bridge-south', kind: 'highway', x0: -860, z0: 1240, x1: 360, z1: 540, curveAmp: 0 },
  { id: 'desert-1', kind: 'dirt', x0: -1060, z0: 1020, x1: -860, z1: 1240, curveAmp: 10 },
  { id: 'desert-2', kind: 'dirt', x0: -860, z0: 1240, x1: -1340, z1: 1420, curveAmp: -12 },
  { id: 'desert-3', kind: 'dirt', x0: -1340, z0: 1420, x1: -1060, z1: 1020, curveAmp: 8 },
  { id: 'main-dam-outpost', kind: 'highway', x0: 60, z0: -80, x1: 180, z1: -860, curveAmp: 12 },
  { id: 'main-outpost-comms', kind: 'rural', x0: 180, z0: -860, x1: 620, z1: -1160, curveAmp: -10 },
  { id: 'main-comms-cape', kind: 'rural', x0: 620, z0: -1160, x1: 1420, z1: -1020, curveAmp: 14 },
  { id: 'main-cape-bunk', kind: 'rural', x0: 1420, z0: -1020, x1: 1180, z1: -640, curveAmp: -8 },
  { id: 'main-bunk-east', kind: 'highway', x0: 1180, z0: -640, x1: 1460, z1: -260, curveAmp: 10 },
  { id: 'main-east-farm', kind: 'rural', x0: 1460, z0: -260, x1: 1140, z1: 680, curveAmp: 16 },
  { id: 'main-farm-woods', kind: 'rural', x0: 1140, z0: 680, x1: 360, z1: 540, curveAmp: -12 },
  { id: 'main-woods-city', kind: 'highway', x0: 360, z0: 540, x1: 320, z1: 180, curveAmp: 8 },
  { id: 'main-city-dam', kind: 'highway', x0: 320, z0: 180, x1: 60, z1: -80, curveAmp: 0 },
  { id: 'main-city-bunk', kind: 'rural', x0: 320, z0: 180, x1: 1180, z1: -640, curveAmp: 14 },
  { id: 'main-dam-comms', kind: 'dirt', x0: 60, z0: -80, x1: 620, z1: -1160, curveAmp: -14 },
];

export const ISLAND_ROADS: Array<[number, number, number, number]> = ISLAND_ROAD_SPECS.map((r) => [
  r.x0,
  r.z0,
  r.x1,
  r.z1,
]);

let activeIslandSeed: number = WORLD_CONFIG.defaultSeed;

export function setActiveIslandSeed(seed: number): void {
  const next = seed >>> 0 || WORLD_CONFIG.defaultSeed;
  if (next !== activeIslandSeed) {
    activeIslandSeed = next;
  }
}

export function getActiveIslandSeed(): number {
  return activeIslandSeed;
}

function islandNormalizedRadius(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  phase: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const angle = Math.atan2(dz, dx);
  const seedShift = (activeIslandSeed % 1000) * 0.002 + phase;
  const coastWobble =
    1 +
    0.095 * Math.sin(angle * 3 + seedShift) +
    0.065 * Math.cos(angle * 5 - phase * 1.3) +
    0.04 * Math.sin(angle * 7 + seedShift * 0.7);
  const rNorm = Math.hypot(dx / rx, dz / rz);
  return rNorm / coastWobble;
}

export function classifyIslandAt(x: number, z: number): IslandId {
  if (islandNormalizedRadius(x, z, -1120, 1260, 620, 560, 2.1) < 1.02) {
    return 'desert_3km2';
  }
  if (islandNormalizedRadius(x, z, -1380, -480, 760, 860, 0.8) < 1.02) {
    return 'cliff_7km2';
  }
  if (islandNormalizedRadius(x, z, 720, -140, 1180, 1480, 0.1) < 1.02) {
    return 'main_15km2';
  }
  return 'ocean';
}

export function getIslandCoastRadius(angleRad: number): number {
  const seedShift = (activeIslandSeed % 1000) * 0.002;
  return 2160 + 110 * Math.sin(angleRad * 3 + seedShift) + 65 * Math.cos(angleRad * 5 - 0.8);
}

export function buildCoastlinePolygon(segments = 72): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const coastWobble = 1 + 0.095 * Math.sin(a * 3 + 0.1) + 0.065 * Math.cos(a * 5 - 0.13);
    pts.push([720 + Math.cos(a) * 1140 * coastWobble, -140 + Math.sin(a) * 1420 * coastWobble]);
  }
  return pts;
}

export interface IslandOutlinePolygon {
  id: IslandId;
  points: Array<[number, number]>;
  fill: string;
}

export function buildIslandPolygons(segments = 64): IslandOutlinePolygon[] {
  const seedShift = (activeIslandSeed % 1000) * 0.002;
  const specs: Array<{ id: IslandId; cx: number; cz: number; rx: number; rz: number; phase: number; fill: string }> = [
    { id: 'main_15km2', cx: 720, cz: -140, rx: 1180, rz: 1480, phase: 0.1, fill: '#4E7A38' },
    { id: 'cliff_7km2', cx: -1380, cz: -480, rx: 760, rz: 860, phase: 0.8, fill: '#61715A' },
    { id: 'desert_3km2', cx: -1120, cz: 1260, rx: 620, rz: 560, phase: 2.1, fill: '#D5B268' },
  ];
  return specs.map((s) => {
    const points: Array<[number, number]> = [];
    const ph = seedShift + s.phase;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const w =
        1 +
        0.095 * Math.sin(a * 3 + ph) +
        0.065 * Math.cos(a * 5 - s.phase * 1.3) +
        0.04 * Math.sin(a * 7 + ph * 0.7);
      points.push([s.cx + Math.cos(a) * s.rx * w, s.cz + Math.sin(a) * s.rz * w]);
    }
    return { id: s.id, points, fill: s.fill };
  });
}

export function sampleRiverCenterX(z: number): number {
  if (z < -180) {
    const t = clamp((-180 - z) / 560, 0, 1);
    return lerp(60, -540, smoothstep(0, 1, t)) + 38 * Math.sin(z * 0.006);
  }
  return 68 + 52 * Math.sin(z * 0.0044) - 26 * Math.cos(z * 0.0085) + (z + 80) * 0.12;
}

export function sampleRiverWaterY(z: number): number {
  if (z <= -92) return WORLD_CONFIG.reservoirWaterLevel;
  // Scarce low canyon stream downstream of Hoover Dam (7.2 m dropping gently to sea level)
  const t = clamp((z - -58) / 1060, 0, 1);
  return lerp(7.2, WORLD_CONFIG.oceanWaterLevel, smoothstep(0, 1, t));
}

export function buildRiverPolyline(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let z = -60; z <= 1020; z += 45) {
    pts.push([sampleRiverCenterX(z), z]);
  }
  return pts;
}

export function sampleRoadSegmentPoint(
  road: IslandRoadSpec,
  t: number,
): { x: number; z: number } {
  const vx = road.x1 - road.x0;
  const vz = road.z1 - road.z0;
  const len = Math.hypot(vx, vz) || 1;
  const nx = -vz / len;
  const nz = vx / len;
  const wave = Math.sin(t * Math.PI) * road.curveAmp;
  return {
    x: road.x0 + vx * t + nx * wave,
    z: road.z0 + vz * t + nz * wave,
  };
}

export function distanceToRoadNetwork(
  x: number,
  z: number,
): { dist: number; road: IslandRoadSpec | null; roadIndex: number; t: number } {
  let minD = 9999;
  let nearest: IslandRoadSpec | null = null;
  let nearestIdx = -1;
  let nearestT = 0;
  for (let i = 0; i < ISLAND_ROAD_SPECS.length; i++) {
    const road = ISLAND_ROAD_SPECS[i];
    const vx = road.x1 - road.x0;
    const vz = road.z1 - road.z0;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 1) continue;
    const t = clamp(((x - road.x0) * vx + (z - road.z0) * vz) / lenSq, 0, 1);
    const pt = sampleRoadSegmentPoint(road, t);
    const d = Math.hypot(x - pt.x, z - pt.z);
    if (d < minD) {
      minD = d;
      nearest = road;
      nearestIdx = i;
      nearestT = t;
    }
  }
  return { dist: minD, road: nearest, roadIndex: nearestIdx, t: nearestT };
}

export function sampleRoadElevation(roadIndex: number, t: number): number {
  const road = ISLAND_ROAD_SPECS[roadIndex];
  if (!road) return 10;
  const pt = sampleRoadSegmentPoint(road, clamp(t, 0, 1));
  return sampleIslandHeight(pt.x, pt.z);
}

/**
 * Pure C¹-continuous 3-island low-poly heightfield (25 km², 15 / 7 / 3 km²).
 */
export function sampleIslandHeight(x: number, z: number): number {
  const seed = activeIslandSeed;

  // --- 1. Smooth Island Coastal Masks ---
  const mainDistBase = islandNormalizedRadius(x, z, 720, -140, 1180, 1480, 0.1);
  const damPeninsulaDist = islandNormalizedRadius(x, z, 110, -160, 440, 560, 1.4);
  const mainNormDist = Math.min(mainDistBase, damPeninsulaDist);
  const mainMask = 1 - smoothstep(0.88, 1.03, mainNormDist);
  const mainDeep = 1 - smoothstep(0.36, 0.94, mainNormDist);

  const cliffNormDist = islandNormalizedRadius(x, z, -1380, -480, 760, 860, 0.8);
  const cliffMask = 1 - smoothstep(0.86, 1.03, cliffNormDist);
  const cliffDeep = 1 - smoothstep(0.32, 0.92, cliffNormDist);

  const desertNormDist = islandNormalizedRadius(x, z, -1120, 1260, 620, 560, 2.1);
  const desertMask = 1 - smoothstep(0.87, 1.03, desertNormDist);
  const desertDeep = 1 - smoothstep(0.34, 0.93, desertNormDist);

  if (mainMask <= 0.0001 && cliffMask <= 0.0001 && desertMask <= 0.0001) {
    return -5.5;
  }

  const lowFbm = fbm2D(x * 0.0014, z * 0.0014, 4, 2.05, 0.5, seed);
  const midFbm = fbm2D(x * 0.0046, z * 0.0046, 3, 2.1, 0.46, seed + 511);

  // --- 2. Island-Specific Relief ---
  // A) Main Island (15 km²): Forested ridges, Northern alpine cliffs & Hydro Canyon Rim
  const northCliffs =
    ridgedNoise2D(x * 0.0021, (z + 680) * 0.0021, 3, seed + 211) *
    smoothstep(-380, -1120, z) *
    60.0;
  const damMassifDist = Math.hypot((x - 60) * 0.68, (z - -225) * 0.72);
  const damMassif = smoothstep(460, 165, damMassifDist) * 41.0;
  const mainRidges = ridgedNoise2D(x * 0.0026, z * 0.0026, 3, seed + 701) * 14.5 * mainDeep;
  const mainH =
    mainMask * (3.2 + (11.5 + lowFbm * 14.5 + midFbm * 5.8) * mainDeep + mainRidges + northCliffs + damMassif);

  // B) Cliff Island (7 km²): Rugged coastal cliffs & highland ridges
  const cliffRidges = ridgedNoise2D((x + 1380) * 0.0028, (z + 480) * 0.0028, 3, seed + 333) * 46.0 * cliffDeep;
  const cliffStep = cliffRidges > 10 ? Math.sin(cliffRidges * 0.28) * 1.8 : 0;
  const cliffH =
    cliffMask * (4.0 + 15.0 * cliffDeep + (lowFbm * 11.0 + midFbm * 4.5) * cliffDeep + cliffRidges + cliffStep);

  // C) Desert Island (3 km²): Wind-carved dunes & warm mesas
  const duneWave = Math.sin(x * 0.016 + z * 0.011 + lowFbm * 2.6) * 4.2 + Math.cos(z * 0.014 - x * 0.008) * 2.6;
  const mesaDist = Math.hypot((x + 1100) * 0.9, (z - 1260) * 1.05);
  const mesaBump = smoothstep(260, 120, mesaDist) * 15.0;
  const desertH =
    desertMask * (2.6 + 6.0 * desertDeep + (duneWave + lowFbm * 6.5) * desertDeep + mesaBump);

  const combinedMask = clamp(mainMask + cliffMask + desertMask, 0, 1);
  let h = -5.5 * (1 - combinedMask) + mainH + cliffH + desertH;

  // --- 3. Hoover Dam Canyon Walls (West x < -14, East x > 134), Big Reservoir Upstream, Deep Dry Canyon Gorge Downstream ---
  // Raised granite canyon shoulders flanking the Hoover Dam arch cleanly at ~44.5 m
  const westRimW = (1 - smoothstep(14, 72, Math.abs(x - -66))) * (1 - smoothstep(32, 96, Math.abs(z - -92)));
  const eastRimW = (1 - smoothstep(14, 72, Math.abs(x - 186))) * (1 - smoothstep(32, 96, Math.abs(z - -92)));
  const rimBlend = Math.max(westRimW, eastRimW);
  if (rimBlend > 0.001) {
    h = lerp(h, 44.5, rimBlend * 0.92);
  }

  // Big deep Hoover Dam Reservoir Basin behind the Dam (z = -470 .. -96, x = -140 .. 260) -> floor ~25 m
  const resDist = Math.hypot((x - 60) / 185, (z - -285) / 185);
  if (resDist < 1.25 && z < -82) {
    const basinW = (1 - smoothstep(0.58, 1.25, resDist)) * smoothstep(-82, -106, z);
    h = lerp(h, 25.0, basinW * 0.96);
  }

  // --- 4. Open Deep Canyon Gorge & Scarce Narrow Downstream Riverbed ---
  // Carves completely flat & clean across z = -110 .. +1160 so zero terrain overlaps or rises above Hoover Dam crest!
  if (z >= -124 && z <= 1160) {
    const rx = sampleRiverCenterX(z);
    const rDist = Math.abs(x - rx);
    const halfCanyonWidth = z < 160 ? 84 : 66;
    if (rDist < halfCanyonWidth) {
      const canyonW = 1 - smoothstep(34, halfCanyonWidth, rDist);
      const endFade = smoothstep(-124, -102, z) * smoothstep(1160, 1060, z);
      const canyonBedY = sampleRiverWaterY(z) - 1.35; // scarce shallow stream (~1.35 m bed below low trickle)
      h = lerp(h, Math.min(h, canyonBedY), canyonW * endFade * 0.96);
    }
  }

  // Left-to-center western river channel flowing from west sea edge (-360, 150) into central river (92, 260)
  if (x >= -380 && x <= 140) {
    const xt = clamp((x - -380) / 520, 0, 1);
    const westRiverZ = lerp(150, 260, smoothstep(0, 1, xt)) + Math.sin(x * 0.015) * 32;
    const dZ = Math.abs(z - westRiverZ);
    if (dZ < 58) {
      const bankW = 1 - smoothstep(16, 58, dZ);
      const endFade = smoothstep(-380, -300, x) * smoothstep(140, 60, x);
      const riverSurf = lerp(WORLD_CONFIG.oceanWaterLevel, sampleRiverWaterY(240), smoothstep(0, 1, xt));
      h = lerp(h, Math.min(h, riverSurf - 3.2), bankW * endFade * 0.94);
    }
  }

  // --- 5. Elevated Organic Inland Lakes on 15 km² Main Island (zero ocean z-fighting!) ---
  for (let i = 0; i < INLAND_LAKES.length; i++) {
    const lake = INLAND_LAKES[i];
    const lDist = evalInlandLakeDist(x, z, lake);
    if (lDist < 1.38) {
      // Ensure lake basin rim always sits cleanly at least 3.5 m above lake waterLevel before dipping in
      const rimMask = smoothstep(0.88, 1.18, lDist) * (1 - smoothstep(1.18, 1.38, lDist));
      h = Math.max(h, lake.waterLevel + 3.2 * rimMask);
      const bowlW = 1 - smoothstep(0.65, 1.15, lDist);
      const targetFloor = lake.waterLevel - lake.maxDepth;
      h = lerp(h, targetFloor, bowlW * 0.96);
    }
  }

  return h;
}

export function sampleIslandNormal(x: number, z: number, out: THREE.Vector3): void {
  const eps = 2.0;
  const hL = sampleIslandHeight(x - eps, z);
  const hR = sampleIslandHeight(x + eps, z);
  const hD = sampleIslandHeight(x, z - eps);
  const hU = sampleIslandHeight(x, z + eps);
  out.set(hL - hR, 2 * eps, hD - hU).normalize();
}

export function findNearestIslandPoi(x: number, z: number): IslandPoiSpec {
  let best = ISLAND_POIS[0];
  let bestD2 = Infinity;
  for (let i = 0; i < ISLAND_POIS.length; i++) {
    const p = ISLAND_POIS[i];
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}
