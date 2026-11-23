export type AudioDynamicRangePreset = 'wide' | 'balanced' | 'boost';

export interface AudioDynamicRangeSpec {
  id: AudioDynamicRangePreset;
  label: string;
  shortLabel: string;
  description: string;
  thresholdDb: number;
  kneeDb: number;
  ratio: number;
  attackSec: number;
  releaseSec: number;
  makeupGain: number;
  combatPeakGain: number;
  subtleCueGain: number;
  footstepPresenceDb: number;
  ambientDuckGain: number;
  enemyFootstepRangeMeters: number;
}

export const AUDIO_DYNAMIC_RANGE_ORDER: AudioDynamicRangePreset[] = ['wide', 'balanced', 'boost'];

export const AUDIO_DYNAMIC_RANGE_PRESETS: Record<AudioDynamicRangePreset, AudioDynamicRangeSpec> = {
  wide: {
    id: 'wide',
    label: 'Wide',
    shortLabel: 'Wide',
    description: 'Full cinema range with loud gunfire and natural distance falloff.',
    thresholdDb: -6,
    kneeDb: 12,
    ratio: 1.5,
    attackSec: 0.01,
    releaseSec: 0.18,
    makeupGain: 1.0,
    combatPeakGain: 1.0,
    subtleCueGain: 1.0,
    footstepPresenceDb: 0,
    ambientDuckGain: 1.0,
    enemyFootstepRangeMeters: 22,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    shortLabel: 'Balanced',
    description: 'Moderate compression keeps gunfire punchy while lifting nearby footsteps.',
    thresholdDb: -18,
    kneeDb: 18,
    ratio: 4.0,
    attackSec: 0.004,
    releaseSec: 0.14,
    makeupGain: 1.16,
    combatPeakGain: 0.85,
    subtleCueGain: 1.28,
    footstepPresenceDb: 2.5,
    ambientDuckGain: 0.86,
    enemyFootstepRangeMeters: 26,
  },
  boost: {
    id: 'boost',
    label: 'Footstep Boost',
    shortLabel: 'Boost',
    description: 'High compression tames explosions and gunfire so enemy footsteps cut through.',
    thresholdDb: -30,
    kneeDb: 24,
    ratio: 10.0,
    attackSec: 0.002,
    releaseSec: 0.1,
    makeupGain: 1.34,
    combatPeakGain: 0.72,
    subtleCueGain: 1.68,
    footstepPresenceDb: 5.0,
    ambientDuckGain: 0.7,
    enemyFootstepRangeMeters: 32,
  },
};

export function getAudioDynamicRangeSpec(preset: unknown): AudioDynamicRangeSpec {
  if (typeof preset === 'string' && preset in AUDIO_DYNAMIC_RANGE_PRESETS) {
    return AUDIO_DYNAMIC_RANGE_PRESETS[preset as AudioDynamicRangePreset];
  }
  return AUDIO_DYNAMIC_RANGE_PRESETS.balanced;
}

export interface EnemyFootstepMix {
  audible: boolean;
  gain: number;
  pan: number;
  cutoffHz: number;
}

/**
 * Pure spatial attenuation and stereo panning calculation for enemy footsteps.
 * Higher dynamic range compression reduces distance rolloff and boosts footstep clarity.
 */
export function computeEnemyFootstepMix(
  distance: number,
  relativeRightDot: number,
  heavy: boolean,
  preset: AudioDynamicRangePreset,
): EnemyFootstepMix {
  const spec = getAudioDynamicRangeSpec(preset);
  const maxRange = spec.enemyFootstepRangeMeters * (heavy ? 1.15 : 1.0);
  if (!Number.isFinite(distance) || distance < 0 || distance >= maxRange) {
    return { audible: false, gain: 0, pan: 0, cutoffHz: 900 };
  }

  const normalizedDist = Math.min(1, Math.max(0, distance / maxRange));
  // Gentler rolloff exponent under stronger compression keeps mid-range footsteps audible
  const rolloffExp = preset === 'boost' ? 1.25 : preset === 'balanced' ? 1.55 : 1.9;
  const attenuation = Math.pow(1 - normalizedDist, rolloffExp);
  const baseWeight = heavy ? 0.34 : 0.24;
  const gain = Math.min(0.62, baseWeight * attenuation * spec.subtleCueGain);
  const pan = Math.max(-0.92, Math.min(0.92, relativeRightDot));
  const cutoffHz = Math.round(
    (preset === 'boost' ? 3200 : preset === 'balanced' ? 2700 : 2250) * (1 - normalizedDist * 0.52),
  );

  return {
    audible: gain > 0.008,
    gain,
    pan,
    cutoffHz,
  };
}
