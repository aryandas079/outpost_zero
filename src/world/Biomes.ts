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
    baseColor: [0.16, 0.14, 0.08],
    altColor: [0.10, 0.09, 0.06],
    treeDensity: 0,
    grassDensity: 0,
    rockDensity: 0.1,
  },
  beach: {
    id: 'beach',
    label: 'Coastal Sand & Shore',
    baseColor: [0.58, 0.45, 0.18],
    altColor: [0.46, 0.35, 0.13],
    treeDensity: 0.05,
    grassDensity: 0.12,
    rockDensity: 0.25,
  },
  desert: {
    id: 'desert',
    label: 'Low-Poly Desert Dunes & Mesas',
    baseColor: [0.64, 0.42, 0.13],
    altColor: [0.48, 0.25, 0.08],
    treeDensity: 0.02,
    grassDensity: 0.06,
    rockDensity: 0.35,
  },
  plains: {
    id: 'plains',
    label: 'Low-Poly Meadow',
    baseColor: [0.08, 0.30, 0.04],
    altColor: [0.14, 0.39, 0.06],
    treeDensity: 0.35,
    grassDensity: 0.9,
    rockDensity: 0.18,
  },
  forest: {
    id: 'forest',
    label: 'Low-Poly Forest',
    baseColor: [0.03, 0.18, 0.025],
    altColor: [0.06, 0.25, 0.04],
    treeDensity: 1.0,
    grassDensity: 0.78,
    rockDensity: 0.22,
  },
  mountain: {
    id: 'mountain',
    label: 'Rocky Cliffs & Highlands',
    baseColor: [0.13, 0.15, 0.18],
    altColor: [0.21, 0.24, 0.28],
    treeDensity: 0.15,
    grassDensity: 0.2,
    rockDensity: 0.85,
  },
  river_valley: {
    id: 'river_valley',
    label: 'Riverbank & Valley',
    baseColor: [0.05, 0.23, 0.035],
    altColor: [0.10, 0.28, 0.05],
    treeDensity: 0.3,
    grassDensity: 0.8,
    rockDensity: 0.4,
  },
  agricultural: {
    id: 'agricultural',
    label: 'Open Lowlands',
    baseColor: [0.11, 0.32, 0.05],
    altColor: [0.18, 0.36, 0.07],
    treeDensity: 0.15,
    grassDensity: 0.85,
    rockDensity: 0.1,
  },
  urban: {
    id: 'urban',
    label: 'Concrete Platform',
    baseColor: [0.14, 0.15, 0.14],
    altColor: [0.10, 0.11, 0.10],
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
