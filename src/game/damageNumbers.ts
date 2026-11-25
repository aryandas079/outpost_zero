export type DamageKind = 'armor' | 'health' | 'mixed';

export interface CrosshairDamagePop {
  id: number;
  amount: number;
  armorDamage: number;
  healthDamage: number;
  kind: DamageKind;
  armorBroken: boolean;
  isHeadshot: boolean;
  isKill: boolean;
  age: number;
  ttl: number;
  offsetX: number;
  offsetY: number;
  driftX: number;
}

export interface DamageResolution {
  amount: number;
  armorDamage: number;
  healthDamage: number;
  remainingArmor: number;
  remainingHealth: number;
  armorBroken: boolean;
  killed: boolean;
  kind: DamageKind;
}

export interface DamagePopStyle {
  armorColor: string;
  armorGlow: string;
  healthColor: string;
  healthGlow: string;
  primaryColor: string;
  primaryGlow: string;
  scale: number;
}

/**
 * Splits incoming hit damage cleanly across armor (ballistic plates / shield)
 * and underlying health, reporting armor break and elimination states.
 */
export function applyArmorHealthDamage(
  incomingDamage: number,
  currentArmor: number,
  currentHealth: number,
): DamageResolution {
  const amount = Math.max(0, Math.round(incomingDamage));
  const safeArmor = Math.max(0, currentArmor || 0);

  const armorDamage = Math.min(safeArmor, amount);
  const remainingArmor = Math.max(0, safeArmor - armorDamage);
  const healthDamage = Math.max(0, amount - armorDamage);
  const remainingHealth = currentHealth - healthDamage;

  const armorBroken = safeArmor > 0 && remainingArmor <= 0;
  const killed = remainingHealth <= 0;

  let kind: DamageKind;
  if (armorDamage > 0 && healthDamage > 0) {
    kind = 'mixed';
  } else if (armorDamage > 0) {
    kind = 'armor';
  } else {
    kind = 'health';
  }

  return {
    amount,
    armorDamage,
    healthDamage,
    remainingArmor,
    remainingHealth,
    armorBroken,
    killed,
    kind,
  };
}

/**
 * Computes a tight, staggered offset in the upper-right tactical quadrant near the crosshair
 * so rapid full-auto bursts cascade cleanly without obscuring the center aim point.
 */
export function computeCrosshairPopSlot(seq: number): {
  offsetX: number;
  offsetY: number;
  driftX: number;
} {
  const slots: ReadonlyArray<{ offsetX: number; offsetY: number; driftX: number }> = [
    { offsetX: 24, offsetY: -18, driftX: 12 },
    { offsetX: 34, offsetY: -28, driftX: 16 },
    { offsetX: 22, offsetY: -34, driftX: 8 },
    { offsetX: 38, offsetY: -14, driftX: 18 },
    { offsetX: 28, offsetY: -24, driftX: 14 },
  ];
  const idx = Math.abs(Math.trunc(seq)) % slots.length;
  return { ...slots[idx] };
}

/**
 * Resolves distinct high-contrast tactical HUD colors for armor vs. health damage.
 * Armor uses Outpost Zero's canonical tactical shield cyan (#57d7ee / #7ce8ff).
 * Health uses high-contrast crimson-coral (#ff5e5b) and amber-gold (#fbbf24) for headshots.
 */
export function getDamagePopStyle(
  pop: Pick<CrosshairDamagePop, 'kind' | 'armorBroken' | 'isHeadshot' | 'isKill' | 'amount'>,
): DamagePopStyle {
  const armorColor = pop.armorBroken ? '#7ce8ff' : '#57d7ee';
  const armorGlow = pop.armorBroken
    ? 'rgba(124, 232, 255, 0.75)'
    : 'rgba(87, 215, 238, 0.55)';

  const healthColor = pop.isHeadshot
    ? '#fbbf24'
    : pop.isKill
    ? '#ff4757'
    : '#ff5e5b';
  const healthGlow = pop.isHeadshot
    ? 'rgba(251, 191, 36, 0.72)'
    : pop.isKill
    ? 'rgba(255, 71, 87, 0.7)'
    : 'rgba(255, 94, 91, 0.52)';

  const primaryColor = pop.kind === 'armor' ? armorColor : healthColor;
  const primaryGlow = pop.kind === 'armor' ? armorGlow : healthGlow;

  const heavyHitBoost = pop.amount >= 90 ? 0.1 : pop.amount >= 50 ? 0.05 : 0;
  const scale =
    1 +
    heavyHitBoost +
    (pop.isHeadshot ? 0.14 : 0) +
    (pop.armorBroken ? 0.08 : 0) +
    (pop.isKill ? 0.08 : 0);

  return {
    armorColor,
    armorGlow,
    healthColor,
    healthGlow,
    primaryColor,
    primaryGlow,
    scale: Math.min(1.36, Number(scale.toFixed(2))),
  };
}
