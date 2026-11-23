import { PlayerMovementState, WEAPON_SPECS, WeaponId } from './types';

export type CrosshairStyle = 'cross' | 'circle' | 'bracket';

export interface MovementStateInput {
  grounded: boolean;
  dashing: boolean;
  sliding: boolean;
  sprinting: boolean;
  crouching: boolean;
  horizontalSpeed: number;
}

export interface RecoilIntensityInput {
  dynamicSpread: number;
  gunShakeTrauma: number;
  gunKickPitch: number;
}

export interface DynamicCrosshairInput {
  weaponId: WeaponId;
  movementState: PlayerMovementState;
  moveSpeedRatio: number;
  recoilIntensity: number;
  ads: boolean;
  scopeAlpha: number;
  reloading: boolean;
  hitMarkerActive?: boolean;
  hitMarkerIntensity?: number;
}

export interface DynamicCrosshairMetrics {
  gapPx: number;
  tickLengthPx: number;
  tickThicknessPx: number;
  circleRadiusPx: number;
  outerOpacity: number;
  centerDotOpacity: number;
  centerDotScale: number;
  recoilHeat: number; // 0..1 subtle warm bloom intensity on rapid fire
  style: CrosshairStyle;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * Classifies the player's active locomotion posture in strict tactical priority order.
 */
export function resolveMovementState(input: MovementStateInput): PlayerMovementState {
  if (input.dashing) return 'dashing';
  if (input.sliding) return 'sliding';
  if (!input.grounded) return 'airborne';
  if (input.sprinting && input.horizontalSpeed > 1.2) return 'sprinting';
  if (input.crouching) return 'crouching';
  if (input.horizontalSpeed > 0.35) return 'walking';
  return 'idle';
}

/**
 * Normalizes live weapon spread bloom, trauma shake, and vertical kick pitch into a 0..1 recoil intensity.
 */
export function computeRecoilIntensity(input: RecoilIntensityInput): number {
  const spreadNorm = clamp(input.dynamicSpread / 0.032, 0, 1);
  const traumaNorm = clamp(input.gunShakeTrauma, 0, 1);
  const pitchNorm = clamp(input.gunKickPitch / 0.045, 0, 1);
  return clamp(spreadNorm * 0.55 + traumaNorm * 0.35 + pitchNorm * 0.3, 0, 1);
}

function resolveCrosshairStyle(weaponId: WeaponId): CrosshairStyle {
  if (weaponId === 'shotgun') return 'circle';
  if (weaponId === 'rpg' || weaponId === 'grenadelauncher') return 'bracket';
  return 'cross';
}

/**
 * Computes responsive dynamic crosshair geometry driven by weapon profile,
 * player movement state, speed ratio, and live recoil intensity from HudSnapshot.
 */
export function computeDynamicCrosshair(input: DynamicCrosshairInput): DynamicCrosshairMetrics {
  const spec = WEAPON_SPECS[input.weaponId] ?? WEAPON_SPECS.carbine;
  const style = resolveCrosshairStyle(input.weaponId);
  const speedRatio = clamp(input.moveSpeedRatio, 0, 1);
  const recoil = clamp(input.recoilIntensity, 0, 1);
  const scopedOut = input.scopeAlpha > 0.55;

  // Weapon-calibrated baseline hip gap (tighter on precision arms, wider on shotgun/LMG)
  let baseGap = 8.5 + clamp(spec.spreadHip * 165, 1.5, 11);
  if (style === 'circle') {
    baseGap = 15.5;
  } else if (style === 'bracket') {
    baseGap = 14.5;
  } else if (input.weaponId === 'railpistol' || input.weaponId === 'marksman') {
    baseGap = 10.5;
  } else if (input.weaponId === 'usp' || input.weaponId === 'glock') {
    baseGap = 8.5;
  } else if (input.weaponId === 'machinegun') {
    baseGap = 13;
  }

  // Movement posture expansion / contraction offsets (in pixels)
  let movementOffset = 0;
  let stateOpacity = 0.94;
  switch (input.movementState) {
    case 'crouching':
      // Stationary crouch tightens spread sharply; crouch-walking eases back slightly
      movementOffset = -3.4 + speedRatio * 3.8;
      break;
    case 'idle':
      movementOffset = 0;
      break;
    case 'walking':
      movementOffset = 2.8 + speedRatio * 6.4;
      break;
    case 'sliding':
      movementOffset = 9.5 + speedRatio * 3.5;
      stateOpacity = 0.88;
      break;
    case 'sprinting':
      movementOffset = 12.5 + speedRatio * 6.5;
      stateOpacity = 0.78;
      break;
    case 'airborne':
      movementOffset = 17.5 + speedRatio * 4.5;
      stateOpacity = 0.84;
      break;
    case 'dashing':
      movementOffset = 20.5 + speedRatio * 3.5;
      stateOpacity = 0.74;
      break;
  }

  // Non-linear recoil bloom snaps outward immediately on shots and contracts cleanly during recovery
  const weaponRecoilScale =
    style === 'circle'
      ? 1.25
      : input.weaponId === 'machinegun' || input.weaponId === 'railpistol' || input.weaponId === 'deagle'
        ? 1.2
        : 1.0;
  const recoilGainPx = 22 * weaponRecoilScale;
  const recoilOffset = Math.pow(recoil, 0.82) * recoilGainPx;

  // Hitmarker punch adds a brief crisp outward pop
  const hitPop = input.hitMarkerActive ? clamp(input.hitMarkerIntensity ?? 0, 0, 1) * 4.5 : 0;

  let rawGap = baseGap + movementOffset + recoilOffset + hitPop;

  // ADS contracts the reticle smoothly toward the weapon's optical sightline
  let outerOpacity = stateOpacity;
  let centerDotOpacity = 0.96;
  if (scopedOut) {
    rawGap = 3.5;
    outerOpacity = 0;
    centerDotOpacity = 0;
  } else if (input.ads) {
    rawGap = Math.max(3.5, rawGap * 0.36);
    outerOpacity = 0;
    centerDotOpacity = 0;
  } else if (input.reloading) {
    rawGap = Math.max(6.5, baseGap * 0.85 + movementOffset * 0.4);
    outerOpacity = 0.38;
    centerDotOpacity = 0.72;
  }

  const gapPx = Math.round(clamp(rawGap, 3.5, 48) * 10) / 10;
  const tickLengthPx =
    Math.round(clamp((style === 'circle' ? 6.5 : 9.5) + recoil * 3.2 + (input.movementState === 'sprinting' ? 1.5 : 0), 6, 14) * 10) /
    10;
  const circleRadiusPx = Math.round(clamp(gapPx + 2.5, 11, 44) * 10) / 10;
  const recoilHeat = clamp((recoil - 0.25) / 0.75, 0, 1);

  return {
    gapPx,
    tickLengthPx,
    tickThicknessPx: 2,
    circleRadiusPx,
    outerOpacity,
    centerDotOpacity,
    centerDotScale: input.hitMarkerActive ? 1.28 : 1 + recoil * 0.18,
    recoilHeat,
    style,
  };
}
