import { GameSettings } from './types';

export type GraphicsPreset = Exclude<GameSettings['graphicsPreset'], 'custom'>;

export const GRAPHICS_PRESETS: Record<GraphicsPreset, Pick<GameSettings,
  'graphicsPreset' | 'resolutionScale' | 'targetFps' | 'dynamicResolution' | 'shadowQuality' | 'textureFiltering'
>> = {
  quality: {
    graphicsPreset: 'quality',
    resolutionScale: 1,
    targetFps: 60,
    dynamicResolution: false,
    shadowQuality: 'high',
    textureFiltering: 8,
  },
  balanced: {
    graphicsPreset: 'balanced',
    resolutionScale: 0.9,
    targetFps: 100,
    dynamicResolution: true,
    shadowQuality: 'high',
    textureFiltering: 4,
  },
  performance: {
    graphicsPreset: 'performance',
    resolutionScale: 0.72,
    targetFps: 144,
    dynamicResolution: true,
    shadowQuality: 'medium',
    textureFiltering: 2,
  },
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  sensitivity: 1,
  muted: false,
  ...GRAPHICS_PRESETS.balanced,
};

export function normalizeGameSettings(value: unknown): GameSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GAME_SETTINGS };
  const candidate = value as Partial<GameSettings>;
  const presets: GameSettings['graphicsPreset'][] = ['quality', 'balanced', 'performance', 'custom'];
  const fpsTargets: GameSettings['targetFps'][] = [60, 90, 100, 120, 144];
  const shadows: GameSettings['shadowQuality'][] = ['off', 'medium', 'high'];
  const filtering: GameSettings['textureFiltering'][] = [2, 4, 8];
  return {
    sensitivity: typeof candidate.sensitivity === 'number'
      ? Math.min(2.2, Math.max(0.35, candidate.sensitivity)) : DEFAULT_GAME_SETTINGS.sensitivity,
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : DEFAULT_GAME_SETTINGS.muted,
    graphicsPreset: presets.includes(candidate.graphicsPreset as GameSettings['graphicsPreset'])
      ? candidate.graphicsPreset as GameSettings['graphicsPreset'] : DEFAULT_GAME_SETTINGS.graphicsPreset,
    resolutionScale: typeof candidate.resolutionScale === 'number'
      ? Math.min(1, Math.max(0.5, candidate.resolutionScale)) : DEFAULT_GAME_SETTINGS.resolutionScale,
    targetFps: fpsTargets.includes(candidate.targetFps as GameSettings['targetFps'])
      ? candidate.targetFps as GameSettings['targetFps'] : DEFAULT_GAME_SETTINGS.targetFps,
    dynamicResolution: typeof candidate.dynamicResolution === 'boolean'
      ? candidate.dynamicResolution : DEFAULT_GAME_SETTINGS.dynamicResolution,
    shadowQuality: shadows.includes(candidate.shadowQuality as GameSettings['shadowQuality'])
      ? candidate.shadowQuality as GameSettings['shadowQuality'] : DEFAULT_GAME_SETTINGS.shadowQuality,
    textureFiltering: filtering.includes(candidate.textureFiltering as GameSettings['textureFiltering'])
      ? candidate.textureFiltering as GameSettings['textureFiltering'] : DEFAULT_GAME_SETTINGS.textureFiltering,
  };
}

export function withCustomGraphics(
  settings: GameSettings,
  patch: Partial<GameSettings>,
): GameSettings {
  return {
    ...settings,
    ...patch,
    graphicsPreset: patch.graphicsPreset ?? 'custom',
  };
}
