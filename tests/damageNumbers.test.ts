import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyArmorHealthDamage,
  computeCrosshairPopSlot,
  getDamagePopStyle,
} from '../src/game/damageNumbers';

test('applyArmorHealthDamage separates pure armor, armor-break spillover, and pure health damage', () => {
  // Pure armor hit (armor absorbs all damage)
  const armorHit = applyArmorHealthDamage(26, 80, 100);
  assert.equal(armorHit.kind, 'armor');
  assert.equal(armorHit.armorDamage, 26);
  assert.equal(armorHit.healthDamage, 0);
  assert.equal(armorHit.remainingArmor, 54);
  assert.equal(armorHit.remainingHealth, 100);
  assert.equal(armorHit.armorBroken, false);
  assert.equal(armorHit.killed, false);

  // Exact armor break with zero health spillover
  const exactBreak = applyArmorHealthDamage(30, 30, 58);
  assert.equal(exactBreak.kind, 'armor');
  assert.equal(exactBreak.armorDamage, 30);
  assert.equal(exactBreak.healthDamage, 0);
  assert.equal(exactBreak.remainingArmor, 0);
  assert.equal(exactBreak.remainingHealth, 58);
  assert.equal(exactBreak.armorBroken, true);
  assert.equal(exactBreak.killed, false);

  // Mixed hit breaking remaining armor and spilling into health
  const mixedBreak = applyArmorHealthDamage(26, 10, 58);
  assert.equal(mixedBreak.kind, 'mixed');
  assert.equal(mixedBreak.armorDamage, 10);
  assert.equal(mixedBreak.healthDamage, 16);
  assert.equal(mixedBreak.remainingArmor, 0);
  assert.equal(mixedBreak.remainingHealth, 42);
  assert.equal(mixedBreak.armorBroken, true);
  assert.equal(mixedBreak.killed, false);

  // Pure health hit leading to elimination
  const lethalHealth = applyArmorHealthDamage(65, 0, 42);
  assert.equal(lethalHealth.kind, 'health');
  assert.equal(lethalHealth.armorDamage, 0);
  assert.equal(lethalHealth.healthDamage, 65);
  assert.equal(lethalHealth.remainingArmor, 0);
  assert.equal(lethalHealth.remainingHealth, -23);
  assert.equal(lethalHealth.armorBroken, false);
  assert.equal(lethalHealth.killed, true);
});

test('getDamagePopStyle assigns distinct colors for armor versus health and highlights crits and breaks', () => {
  const armorStyle = getDamagePopStyle({
    kind: 'armor',
    armorBroken: false,
    isHeadshot: false,
    isKill: false,
    amount: 26,
  });
  const armorBreakStyle = getDamagePopStyle({
    kind: 'armor',
    armorBroken: true,
    isHeadshot: false,
    isKill: false,
    amount: 30,
  });
  const healthStyle = getDamagePopStyle({
    kind: 'health',
    armorBroken: false,
    isHeadshot: false,
    isKill: false,
    amount: 26,
  });
  const critHealthStyle = getDamagePopStyle({
    kind: 'health',
    armorBroken: false,
    isHeadshot: true,
    isKill: true,
    amount: 98,
  });

  assert.notEqual(armorStyle.primaryColor, healthStyle.primaryColor);
  assert.notEqual(armorStyle.armorColor, armorBreakStyle.armorColor);
  assert.notEqual(healthStyle.healthColor, critHealthStyle.healthColor);
  assert.ok(critHealthStyle.scale > healthStyle.scale);
  assert.ok(armorBreakStyle.scale > armorStyle.scale);
});

test('computeCrosshairPopSlot places numbers cleanly near the crosshair without covering center aim', () => {
  const seen = new Set<string>();
  for (let seq = 1; seq <= 5; seq++) {
    const slot = computeCrosshairPopSlot(seq);
    assert.ok(slot.offsetX >= 18 && slot.offsetX <= 48, `offsetX out of range: ${slot.offsetX}`);
    assert.ok(slot.offsetY <= -10 && slot.offsetY >= -40, `offsetY out of range: ${slot.offsetY}`);
    assert.ok(slot.driftX > 0);
    seen.add(`${slot.offsetX},${slot.offsetY}`);
  }
  assert.equal(seen.size, 5, 'rapid consecutive hits should fan across distinct staggered slots');
});
