/**
 * Centralized game configuration, HUD color palette, world metrics, and graphics presets.
 * Single source of truth replacing scattered hardcoded constants across systems.
 */

export const HUD_PALETTE = {
  primaryText: '#F2F4F5',
  secondaryText: '#A8B0B8',
  panelBg: '#10161D',
  armorAccent: '#52C7DE',
  warning: '#E9B94C',
  danger: '#E05252',
  positive: '#60BE8B',
} as const;

export const WORLD_CONFIG = {
  islandHalfSize: 2500, // 5,000m x 5,000m = 25 km²
  oceanWaterLevel: -0.35,
  reservoirWaterLevel: 39.2,
  damBaseElevation: 43.0,
  chunkSize: 625, // 8x8 = 64 spatial terrain chunks across 5,000m x 5,000m
  chunkGridSegmentsHigh: 48,
  chunkGridSegmentsMed: 24,
  chunkGridSegmentsLow: 12,
  maxTerrainSampleHalfSize: 2500,
  defaultSeed: 2026079 as number,
  totalBattleRoyaleCombatants: 50,
  planeAltitudeMeters: 345,
  planeSpeedMps: 132,
  autoParachuteAglMeters: 88,
} as const;

export const SIMULATION_CONFIG = {
  fixedStepSec: 1 / 60,
  maxDeltaSec: 0.05,
  maxSubStepsPerFrame: 4,
  gravityMps2: 22.5,
  playerRadius: 0.54,
  standEyeHeight: 1.68,
  crouchEyeHeight: 1.12,
  proneEyeHeight: 0.56,
} as const;

export const GRAPHICS_PRESET_TIERS = {
  low: {
    renderScale: 0.72,
    shadowMapSize: 512,
    shadowsEnabled: true,
    vegetationDensity: 0.4,
    viewDistance: 1800,
    waterQuality: 'basic' as const,
    textureFiltering: 2 as const,
    postProcessing: 'minimal' as const,
    targetFps: 144 as const,
    dynamicResolution: true,
  },
  medium: {
    renderScale: 0.9,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    vegetationDensity: 0.75,
    viewDistance: 2800,
    waterQuality: 'standard' as const,
    textureFiltering: 4 as const,
    postProcessing: 'balanced' as const,
    targetFps: 100 as const,
    dynamicResolution: true,
  },
  high: {
    renderScale: 1.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    vegetationDensity: 1.0,
    viewDistance: 3800,
    waterQuality: 'enhanced' as const,
    textureFiltering: 8 as const,
    postProcessing: 'enhanced' as const,
    targetFps: 60 as const,
    dynamicResolution: false,
  },
  ultra: {
    renderScale: 1.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    vegetationDensity: 1.0,
    viewDistance: 4800,
    waterQuality: 'maximum' as const,
    textureFiltering: 8 as const,
    postProcessing: 'maximum' as const,
    targetFps: 60 as const,
    dynamicResolution: false,
  },
} as const;
