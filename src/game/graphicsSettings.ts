import { ControlAction, GameSettings, KeyBindings } from './types';

export type GraphicsPreset = Exclude<GameSettings['graphicsPreset'], 'custom'>;

export const GRAPHICS_PRESETS: Record<
  GraphicsPreset,
  Pick<
    GameSettings,
    | 'graphicsPreset'
    | 'resolutionScale'
    | 'targetFps'
    | 'dynamicResolution'
    | 'shadowQuality'
    | 'textureFiltering'
    | 'vegetationDensity'
    | 'viewDistance'
    | 'waterQuality'
  >
> = {
  performance: {
    graphicsPreset: 'performance',
    resolutionScale: 0.72,
    targetFps: 144,
    dynamicResolution: true,
    shadowQuality: 'medium',
    textureFiltering: 2,
    vegetationDensity: 'sparse',
    viewDistance: 'reduced',
    waterQuality: 'basic',
  },
  balanced: {
    graphicsPreset: 'balanced',
    resolutionScale: 0.9,
    targetFps: 100,
    dynamicResolution: true,
    shadowQuality: 'high',
    textureFiltering: 4,
    vegetationDensity: 'balanced',
    viewDistance: 'balanced',
    waterQuality: 'standard',
  },
  quality: {
    graphicsPreset: 'quality',
    resolutionScale: 1,
    targetFps: 60,
    dynamicResolution: false,
    shadowQuality: 'high',
    textureFiltering: 8,
    vegetationDensity: 'dense',
    viewDistance: 'extended',
    waterQuality: 'enhanced',
  },
  ultra: {
    graphicsPreset: 'ultra',
    resolutionScale: 1,
    targetFps: 60,
    dynamicResolution: false,
    shadowQuality: 'high',
    textureFiltering: 8,
    vegetationDensity: 'dense',
    viewDistance: 'maximum',
    waterQuality: 'enhanced',
  },
};

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  reload: 'KeyR',
  dash: 'KeyF',
  inspect: 'KeyI',
  grenade: 'KeyG',
  scopeZoom: 'KeyZ',
  interact: 'KeyE',
  armorPlate: 'Digit5',
  medkit: 'Digit6',
  primary1: 'Digit1',
  primary2: 'Digit2',
  sidearm: 'Digit3',
  launcher: 'Digit4',
};

const CONTROL_ACTIONS = Object.keys(DEFAULT_KEY_BINDINGS) as ControlAction[];

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  sensitivity: 1,
  adsSensitivity: 0.85,
  invertY: false,
  sprintToggle: false,
  crouchToggle: true,
  fov: 75,
  muted: false,
  masterVolume: 0.85,
  musicVolume: 0.6,
  envVolume: 0.8,
  weaponsVolume: 1.0,
  movementVolume: 0.9,
  uiVolume: 0.75,
  audioDynamicRange: 'balanced',
  ...GRAPHICS_PRESETS.balanced,
  timeOfDay: 'daylight',
  hudScale: 1.0,
  minimapRotate: false,
  crosshairColor: '#F2F4F5',
  crosshairSize: 1.0,
  colorblindMode: 'none',
  reducedMotion: false,
  screenShakeScale: 1.0,
  showPerfOverlay: false,
  controls: { ...DEFAULT_KEY_BINDINGS },
};

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : fallback;
}

export function normalizeGameSettings(value: unknown): GameSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_KEY_BINDINGS } };
  }
  const candidate = value as Partial<GameSettings>;
  const presets: GameSettings['graphicsPreset'][] = ['quality', 'balanced', 'performance', 'ultra', 'custom'];
  const dynamicRanges: GameSettings['audioDynamicRange'][] = ['wide', 'balanced', 'boost'];
  const fpsTargets: GameSettings['targetFps'][] = [60, 90, 100, 120, 144];
  const shadows: GameSettings['shadowQuality'][] = ['off', 'medium', 'high'];
  const filtering: GameSettings['textureFiltering'][] = [2, 4, 8];
  const vegDensities: GameSettings['vegetationDensity'][] = ['sparse', 'balanced', 'dense'];
  const viewDistances: GameSettings['viewDistance'][] = ['reduced', 'balanced', 'extended', 'maximum'];
  const waterQualities: GameSettings['waterQuality'][] = ['basic', 'standard', 'enhanced'];
  const timesOfDay: GameSettings['timeOfDay'][] = ['daylight', 'golden', 'overcast'];
  const colorblinds: GameSettings['colorblindMode'][] = ['none', 'deuteranope', 'protanope', 'tritanope'];

  const safeColor =
    typeof candidate.crosshairColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(candidate.crosshairColor)
      ? candidate.crosshairColor
      : DEFAULT_GAME_SETTINGS.crosshairColor;

  return {
    sensitivity: clampNum(candidate.sensitivity, 0.35, 2.2, DEFAULT_GAME_SETTINGS.sensitivity),
    adsSensitivity: clampNum(candidate.adsSensitivity, 0.35, 1.8, DEFAULT_GAME_SETTINGS.adsSensitivity),
    invertY: typeof candidate.invertY === 'boolean' ? candidate.invertY : DEFAULT_GAME_SETTINGS.invertY,
    sprintToggle: typeof candidate.sprintToggle === 'boolean' ? candidate.sprintToggle : DEFAULT_GAME_SETTINGS.sprintToggle,
    crouchToggle: typeof candidate.crouchToggle === 'boolean' ? candidate.crouchToggle : DEFAULT_GAME_SETTINGS.crouchToggle,
    fov: Math.round(clampNum(candidate.fov, 65, 105, DEFAULT_GAME_SETTINGS.fov)),
    muted: typeof candidate.muted === 'boolean' ? candidate.muted : DEFAULT_GAME_SETTINGS.muted,
    masterVolume: clampNum(candidate.masterVolume, 0, 1, DEFAULT_GAME_SETTINGS.masterVolume),
    musicVolume: clampNum(candidate.musicVolume, 0, 1, DEFAULT_GAME_SETTINGS.musicVolume),
    envVolume: clampNum(candidate.envVolume, 0, 1, DEFAULT_GAME_SETTINGS.envVolume),
    weaponsVolume: clampNum(candidate.weaponsVolume, 0, 1, DEFAULT_GAME_SETTINGS.weaponsVolume),
    movementVolume: clampNum(candidate.movementVolume, 0, 1, DEFAULT_GAME_SETTINGS.movementVolume),
    uiVolume: clampNum(candidate.uiVolume, 0, 1, DEFAULT_GAME_SETTINGS.uiVolume),
    audioDynamicRange: dynamicRanges.includes(candidate.audioDynamicRange as GameSettings['audioDynamicRange'])
      ? (candidate.audioDynamicRange as GameSettings['audioDynamicRange'])
      : DEFAULT_GAME_SETTINGS.audioDynamicRange,
    graphicsPreset: presets.includes(candidate.graphicsPreset as GameSettings['graphicsPreset'])
      ? (candidate.graphicsPreset as GameSettings['graphicsPreset'])
      : DEFAULT_GAME_SETTINGS.graphicsPreset,
    resolutionScale: clampNum(candidate.resolutionScale, 0.5, 1, DEFAULT_GAME_SETTINGS.resolutionScale),
    targetFps: fpsTargets.includes(candidate.targetFps as GameSettings['targetFps'])
      ? (candidate.targetFps as GameSettings['targetFps'])
      : DEFAULT_GAME_SETTINGS.targetFps,
    dynamicResolution:
      typeof candidate.dynamicResolution === 'boolean'
        ? candidate.dynamicResolution
        : DEFAULT_GAME_SETTINGS.dynamicResolution,
    shadowQuality: shadows.includes(candidate.shadowQuality as GameSettings['shadowQuality'])
      ? (candidate.shadowQuality as GameSettings['shadowQuality'])
      : DEFAULT_GAME_SETTINGS.shadowQuality,
    textureFiltering: filtering.includes(candidate.textureFiltering as GameSettings['textureFiltering'])
      ? (candidate.textureFiltering as GameSettings['textureFiltering'])
      : DEFAULT_GAME_SETTINGS.textureFiltering,
    vegetationDensity: vegDensities.includes(candidate.vegetationDensity as GameSettings['vegetationDensity'])
      ? (candidate.vegetationDensity as GameSettings['vegetationDensity'])
      : DEFAULT_GAME_SETTINGS.vegetationDensity,
    viewDistance: viewDistances.includes(candidate.viewDistance as GameSettings['viewDistance'])
      ? (candidate.viewDistance as GameSettings['viewDistance'])
      : DEFAULT_GAME_SETTINGS.viewDistance,
    waterQuality: waterQualities.includes(candidate.waterQuality as GameSettings['waterQuality'])
      ? (candidate.waterQuality as GameSettings['waterQuality'])
      : DEFAULT_GAME_SETTINGS.waterQuality,
    timeOfDay: timesOfDay.includes(candidate.timeOfDay as GameSettings['timeOfDay'])
      ? (candidate.timeOfDay as GameSettings['timeOfDay'])
      : DEFAULT_GAME_SETTINGS.timeOfDay,
    hudScale: clampNum(candidate.hudScale, 0.8, 1.25, DEFAULT_GAME_SETTINGS.hudScale),
    minimapRotate:
      typeof candidate.minimapRotate === 'boolean' ? candidate.minimapRotate : DEFAULT_GAME_SETTINGS.minimapRotate,
    crosshairColor: safeColor,
    crosshairSize: clampNum(candidate.crosshairSize, 0.7, 1.5, DEFAULT_GAME_SETTINGS.crosshairSize),
    colorblindMode: colorblinds.includes(candidate.colorblindMode as GameSettings['colorblindMode'])
      ? (candidate.colorblindMode as GameSettings['colorblindMode'])
      : DEFAULT_GAME_SETTINGS.colorblindMode,
    reducedMotion:
      typeof candidate.reducedMotion === 'boolean' ? candidate.reducedMotion : DEFAULT_GAME_SETTINGS.reducedMotion,
    screenShakeScale: clampNum(candidate.screenShakeScale, 0, 1, DEFAULT_GAME_SETTINGS.screenShakeScale),
    showPerfOverlay:
      typeof candidate.showPerfOverlay === 'boolean' ? candidate.showPerfOverlay : DEFAULT_GAME_SETTINGS.showPerfOverlay,
    controls: CONTROL_ACTIONS.reduce<KeyBindings>((bindings, action) => {
      const proposed = candidate.controls?.[action];
      bindings[action] =
        typeof proposed === 'string' && proposed.length > 0 && proposed.length <= 32
          ? proposed
          : DEFAULT_KEY_BINDINGS[action];
      return bindings;
    }, {} as KeyBindings),
  };
}

export function withCustomGraphics(settings: GameSettings, patch: Partial<GameSettings>): GameSettings {
  return {
    ...settings,
    ...patch,
    graphicsPreset: patch.graphicsPreset ?? 'custom',
  };
}
