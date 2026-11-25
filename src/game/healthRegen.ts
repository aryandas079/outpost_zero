/**
 * Out-of-Combat Health Regeneration Mechanic
 * If a player remains out of combat for 5 seconds, their health slowly recovers
 * up to 50% of maximum health.
 */

export const HEALTH_REGEN_DELAY_SEC = 5.0;
export const HEALTH_REGEN_MAX_RATIO = 0.5;
export const HEALTH_REGEN_RATE_PER_SEC = 8.0;

export interface HealthRegenStepResult {
  health: number;
  regenerating: boolean;
}

export function computeHealthRegenStep(
  currentHealth: number,
  maxHealth: number,
  outOfCombatSec: number,
  dt: number,
): HealthRegenStepResult {
  if (currentHealth <= 0 || maxHealth <= 0 || dt <= 0) {
    return { health: currentHealth, regenerating: false };
  }

  const regenCap = maxHealth * HEALTH_REGEN_MAX_RATIO;
  if (currentHealth >= regenCap || outOfCombatSec < HEALTH_REGEN_DELAY_SEC) {
    return { health: currentHealth, regenerating: false };
  }

  const nextHealth = Math.min(regenCap, currentHealth + HEALTH_REGEN_RATE_PER_SEC * dt);
  return {
    health: nextHealth,
    regenerating: nextHealth > currentHealth,
  };
}
