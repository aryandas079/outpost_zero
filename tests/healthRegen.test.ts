import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeHealthRegenStep,
  HEALTH_REGEN_DELAY_SEC,
  HEALTH_REGEN_MAX_RATIO,
  HEALTH_REGEN_RATE_PER_SEC,
} from '../src/game/healthRegen';

test('health regeneration mechanic waits strictly for 5 seconds out of combat', () => {
  const maxHealth = 100;
  const lowHealth = 20;

  // At 0 seconds out of combat: no regen
  const res0 = computeHealthRegenStep(lowHealth, maxHealth, 0, 0.1);
  assert.equal(res0.health, 20);
  assert.equal(res0.regenerating, false);

  // At 4.9 seconds out of combat: still no regen
  const res49 = computeHealthRegenStep(lowHealth, maxHealth, 4.9, 0.1);
  assert.equal(res49.health, 20);
  assert.equal(res49.regenerating, false);

  // At exactly 5.0 seconds out of combat: health begins regenerating
  const res50 = computeHealthRegenStep(lowHealth, maxHealth, 5.0, 1.0);
  assert.equal(res50.regenerating, true);
  assert.equal(res50.health, lowHealth + HEALTH_REGEN_RATE_PER_SEC * 1.0);
});

test('health regeneration slowly recovers and strictly caps at 50% of max health', () => {
  const maxHealth = 100;
  const regenCap = maxHealth * HEALTH_REGEN_MAX_RATIO; // 50 HP

  // Recovering from 45 HP with 1 second step (+8 HP) caps strictly at 50 HP
  const step = computeHealthRegenStep(45, maxHealth, 6.0, 1.0);
  assert.equal(step.health, regenCap);
  assert.equal(step.regenerating, true);

  // Once at or above 50% max health (e.g. 50 HP, 75 HP, 100 HP), regeneration stops
  const atCap = computeHealthRegenStep(50, maxHealth, 10.0, 0.5);
  assert.equal(atCap.health, 50);
  assert.equal(atCap.regenerating, false);

  const aboveCap = computeHealthRegenStep(75, maxHealth, 10.0, 0.5);
  assert.equal(aboveCap.health, 75);
  assert.equal(aboveCap.regenerating, false);
});

test('health regeneration ignores dead players or zero time steps', () => {
  // Dead player (0 HP) does not resurrect
  const dead = computeHealthRegenStep(0, 100, 10.0, 1.0);
  assert.equal(dead.health, 0);
  assert.equal(dead.regenerating, false);

  // Zero delta time produces no change
  const noDt = computeHealthRegenStep(30, 100, 8.0, 0);
  assert.equal(noDt.health, 30);
  assert.equal(noDt.regenerating, false);
});
