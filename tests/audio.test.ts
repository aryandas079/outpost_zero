import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_DYNAMIC_RANGE_ORDER,
  AUDIO_DYNAMIC_RANGE_PRESETS,
  computeEnemyFootstepMix,
  getAudioDynamicRangeSpec,
} from '../src/game/audioCompression';
import { DEFAULT_GAME_SETTINGS, normalizeGameSettings } from '../src/game/graphicsSettings';

test('dynamic range compression presets progress monotonically from wide to footstep boost', () => {
  assert.deepEqual(AUDIO_DYNAMIC_RANGE_ORDER, ['wide', 'balanced', 'boost']);

  const wide = AUDIO_DYNAMIC_RANGE_PRESETS.wide;
  const balanced = AUDIO_DYNAMIC_RANGE_PRESETS.balanced;
  const boost = AUDIO_DYNAMIC_RANGE_PRESETS.boost;

  // Stronger compression lowers threshold and increases ratio
  assert.ok(wide.thresholdDb > balanced.thresholdDb && balanced.thresholdDb > boost.thresholdDb);
  assert.ok(wide.ratio < balanced.ratio && balanced.ratio < boost.ratio);

  // Stronger compression tames combat peaks while lifting subtle footsteps & presence EQ
  assert.ok(wide.combatPeakGain > balanced.combatPeakGain && balanced.combatPeakGain > boost.combatPeakGain);
  assert.ok(wide.subtleCueGain < balanced.subtleCueGain && balanced.subtleCueGain < boost.subtleCueGain);
  assert.ok(wide.footstepPresenceDb < balanced.footstepPresenceDb && balanced.footstepPresenceDb < boost.footstepPresenceDb);

  // Ambient wind ducks further under stronger compression so footsteps stay legible
  assert.ok(wide.ambientDuckGain > balanced.ambientDuckGain && balanced.ambientDuckGain > boost.ambientDuckGain);
  assert.ok(wide.enemyFootstepRangeMeters < balanced.enemyFootstepRangeMeters && balanced.enemyFootstepRangeMeters < boost.enemyFootstepRangeMeters);
});

test('game settings normalization persists valid dynamic range presets and falls back safely', () => {
  assert.equal(DEFAULT_GAME_SETTINGS.audioDynamicRange, 'balanced');
  assert.equal(normalizeGameSettings({ audioDynamicRange: 'wide' }).audioDynamicRange, 'wide');
  assert.equal(normalizeGameSettings({ audioDynamicRange: 'boost' }).audioDynamicRange, 'boost');
  assert.equal(normalizeGameSettings({ audioDynamicRange: 'invalid-mode' as never }).audioDynamicRange, 'balanced');
  assert.equal(normalizeGameSettings(null).audioDynamicRange, 'balanced');
  assert.equal(getAudioDynamicRangeSpec('unknown').id, 'balanced');
});

test('computeEnemyFootstepMix boosts audibility and range under stronger compression and clamps stereo pan', () => {
  const wideNear = computeEnemyFootstepMix(12, 0.5, false, 'wide');
  const balancedNear = computeEnemyFootstepMix(12, 0.5, false, 'balanced');
  const boostNear = computeEnemyFootstepMix(12, 0.5, false, 'boost');

  assert.equal(wideNear.audible, true);
  assert.equal(balancedNear.audible, true);
  assert.equal(boostNear.audible, true);
  assert.ok(boostNear.gain > balancedNear.gain && balancedNear.gain > wideNear.gain);
  assert.ok(boostNear.cutoffHz > balancedNear.cutoffHz && balancedNear.cutoffHz > wideNear.cutoffHz);

  // Distant enemy at 25m is inaudible in Wide mode but clearly heard in Footstep Boost
  const wideFar = computeEnemyFootstepMix(25, -0.7, false, 'wide');
  const boostFar = computeEnemyFootstepMix(25, -0.7, false, 'boost');
  assert.equal(wideFar.audible, false);
  assert.equal(boostFar.audible, true);

  // Heavy sentinel footsteps carry louder than striker footsteps at equal distance
  const lightStep = computeEnemyFootstepMix(10, 0.2, false, 'balanced');
  const heavyStep = computeEnemyFootstepMix(10, 0.2, true, 'balanced');
  assert.ok(heavyStep.gain > lightStep.gain);

  // Stereo pan is clamped safely to [-0.92, 0.92]
  assert.equal(computeEnemyFootstepMix(5, 2.5, false, 'boost').pan, 0.92);
  assert.equal(computeEnemyFootstepMix(5, -2.5, false, 'boost').pan, -0.92);
});
