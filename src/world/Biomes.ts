/**
 * Low-Poly 3-Island Biome Definitions & Material Palette (25 km² Archipelago).
 */

import { classifyIslandAt } from './Terrain';

export type BiomeId =
  | 'ocean'
  | 'beach'
  | 'desert'
  | 'plains'
  | 'forest'
  | 'mountain'
  | 'river_valley'
  | 'agricultural'
  | 'urban';

export interface BiomePalette {
  id: BiomeId;
  label: string;
  baseColor: [number, number, number];
  altColor: [number, number, number];
  treeDensity: number;
  grassDensity: number;
  rockDensity: number;
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  ocean: {
    id: 'ocean',
    label: 'Coastal Seabed',
    baseColor: [0.42, 0.40, 0.31],
    altColor: [0.34, 0.33, 0.27],
    treeDensity: 0,
    grassDensity: 0,
    rockDensity: 0.1,
  },
  beach: {
    id: 'beach',
    label: 'Coastal Sand & Shore',
    baseColor: [0.85, 0.77, 0.53],
    altColor: [0.76, 0.68, 0.45],
    treeDensity: 0.05,
    grassDensity: 0.12,
    rockDensity: 0.25,
  },
  desert: {
    id: 'desert',
    label: 'Low-Poly Desert Dunes & Mesas',
    baseColor: [0.87, 0.73, 0.45],
    altColor: [0.76, 0.56, 0.33],
    treeDensity: 0.02,
    grassDensity: 0.06,
    rockDensity: 0.35,
  },
  plains: {
    id: 'plains',
    label: 'Low-Poly Meadow',
    baseColor: [0.31, 0.58, 0.22],
    altColor: [0.41, 0.65, 0.27],
    treeDensity: 0.35,
    grassDensity: 0.9,
    rockDensity: 0.18,
  },
  forest: {
    id: 'forest',
    label: 'Low-Poly Forest',
    baseColor: [0.19, 0.46, 0.16],
    altColor: [0.27, 0.54, 0.21],
    treeDensity: 1.0,
    grassDensity: 0.78,
    rockDensity: 0.22,
  },
  mountain: {
    id: 'mountain',
    label: 'Rocky Cliffs & Highlands',
    baseColor: [0.43, 0.47, 0.52],
    altColor: [0.55, 0.58, 0.62],
    treeDensity: 0.15,
    grassDensity: 0.2,
    rockDensity: 0.85,
  },
  river_valley: {
    id: 'river_valley',
    label: 'Riverbank & Valley',
    baseColor: [0.25, 0.49, 0.19],
    altColor: [0.34, 0.53, 0.24],
    treeDensity: 0.3,
    grassDensity: 0.8,
    rockDensity: 0.4,
  },
  agricultural: {
    id: 'agricultural',
    label: 'Open Lowlands',
    baseColor: [0.37, 0.59, 0.23],
    altColor: [0.46, 0.62, 0.27],
    treeDensity: 0.15,
    grassDensity: 0.85,
    rockDensity: 0.1,
  },
  urban: {
    id: 'urban',
    label: 'Concrete Platform',
    baseColor: [0.42, 0.43, 0.41],
    altColor: [0.36, 0.37, 0.35],
    treeDensity: 0,
    grassDensity: 0.05,
    rockDensity: 0.05,
  },
};

export function classifyBiomeAt(x: number, z: number, height: number, slope: number): BiomeId {
  if (height < 0.05) return 'ocean';
  const island = classifyIslandAt(x, z);

  // Small Desert Island (3 km², SW) -> warm sandy desert dunes & terracotta mesa rock
  if (island === 'desert_3km2') {
    if (slope > 0.28 || height > 24) return 'mountain';
    return 'desert';
  }

  if (height < 3.2) return 'beach';

  // Both 15 km² Main Island and 7 km² Cliff Island feature crisp low-poly rocky cliffs
  if (height > 31 || slope > 0.16) return 'mountain';

  // 7 km² Cliff Island plateaus: mossy highland grass + cliff crags
  if (island === 'cliff_7km2') {
    return slope > 0.12 ? 'mountain' : 'plains';
  }

  // 15 km² Main Island: lush low-poly forest core, meadow openings, & river valley
  if (Math.abs(x - 68) < 120 && z > -260 && z < 1100) return 'river_valley';
  if (x > 260 || z < 280) return 'forest';
  return 'plains';
}
