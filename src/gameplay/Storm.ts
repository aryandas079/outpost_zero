/**
 * Centralized Battle Royale Safe Zone & Shrinking Storm Controller.
 * Guarantees valid inland target zones, deterministic seeded progression,
 * accurate boundary checks, and consistent world/map coordinates.
 */

import { clamp, lerp, SeededRng } from '../utilities/SeededRng';
import { getIslandCoastRadius, ISLAND_HALF_SIZE, sampleIslandHeight } from '../world/Terrain';

export interface StormPhaseConfig {
  phase: number;
  waitSec: number;
  shrinkSec: number;
  targetRadius: number;
  damagePerSec: number;
}

export const STORM_PHASES: readonly StormPhaseConfig[] = [
  { phase: 1, waitSec: 110, shrinkSec: 85, targetRadius: 1950, damagePerSec: 2 },
  { phase: 2, waitSec: 85, shrinkSec: 70, targetRadius: 1320, damagePerSec: 4 },
  { phase: 3, waitSec: 65, shrinkSec: 55, targetRadius: 780, damagePerSec: 7 },
  { phase: 4, waitSec: 55, shrinkSec: 45, targetRadius: 390, damagePerSec: 11 },
  { phase: 5, waitSec: 40, shrinkSec: 35, targetRadius: 140, damagePerSec: 16 },
  { phase: 6, waitSec: 30, shrinkSec: 30, targetRadius: 0, damagePerSec: 22 },
];

export class StormController {
  public phase = 1;
  public timerSec = 42;
  public closing = false;
  public centerX = 0;
  public centerZ = 0;
  public radius = 1480;
  public startX = 0;
  public startZ = 0;
  public startRadius = 1480;
  public targetX = 0;
  public targetZ = 0;
  public targetRadius = 820;
  public damagePerSec = 2;

  private rng: SeededRng;
  private currentShrinkDuration = 36;
  private damageAccumulator = 0;

  constructor(seed = 2026079) {
    this.rng = new SeededRng(seed + 551);
    this.reset(seed);
  }

  public reset(seed = 2026079): void {
    this.rng = new SeededRng(seed + 551);
    const p1 = STORM_PHASES[0];
    this.phase = 1;
    this.closing = false;
    this.timerSec = p1.waitSec;
    this.currentShrinkDuration = p1.shrinkSec;
    this.centerX = 0;
    this.centerZ = 0;
    this.radius = 2850;
    this.startX = 0;
    this.startZ = 0;
    this.startRadius = 2850;
    this.damagePerSec = p1.damagePerSec;
    this.damageAccumulator = 0;

    // Pick a random safe zone anywhere across the 25 km² 3-island map (Main, Cliff, or Desert islands)
    const maxSpan = ISLAND_HALF_SIZE - 450;
    let pickedX = this.rng.range(-maxSpan, maxSpan);
    let pickedZ = this.rng.range(-maxSpan, maxSpan);
    for (let attempt = 0; attempt < 24; attempt++) {
      const cx = this.rng.range(-maxSpan, maxSpan);
      const cz = this.rng.range(-maxSpan, maxSpan);
      if (sampleIslandHeight(cx, cz) > 1.0) {
        pickedX = cx;
        pickedZ = cz;
        break;
      }
    }
    this.targetX = pickedX;
    this.targetZ = pickedZ;
    this.targetRadius = p1.targetRadius;
  }

  public update(dt: number): { phaseStartedClosing: boolean; phaseAdvanced: boolean } {
    if (dt <= 0 || !Number.isFinite(dt)) return { phaseStartedClosing: false, phaseAdvanced: false };

    let phaseStartedClosing = false;
    let phaseAdvanced = false;
    const cfg = STORM_PHASES[Math.min(STORM_PHASES.length - 1, this.phase - 1)];
    this.damagePerSec = cfg.damagePerSec;

    this.timerSec -= dt;
    if (!this.closing) {
      if (this.timerSec <= 0) {
        this.closing = true;
        this.currentShrinkDuration = cfg.shrinkSec;
        this.timerSec = Math.max(0.1, cfg.shrinkSec + this.timerSec);
        this.startX = this.centerX;
        this.startZ = this.centerZ;
        this.startRadius = this.radius;
        phaseStartedClosing = true;
      }
    } else {
      const progress = 1 - clamp(this.timerSec / Math.max(0.1, this.currentShrinkDuration), 0, 1);
      const smooth = progress * progress * (3 - 2 * progress);
      this.centerX = lerp(this.startX, this.targetX, smooth);
      this.centerZ = lerp(this.startZ, this.targetZ, smooth);
      this.radius = lerp(this.startRadius, this.targetRadius, smooth);

      if (this.timerSec <= 0) {
        this.centerX = this.targetX;
        this.centerZ = this.targetZ;
        this.radius = this.targetRadius;
        this.closing = false;

        if (this.phase < STORM_PHASES.length) {
          this.phase += 1;
          const nextCfg = STORM_PHASES[this.phase - 1];
          this.timerSec = nextCfg.waitSec;
          this.currentShrinkDuration = nextCfg.shrinkSec;
          this.damagePerSec = nextCfg.damagePerSec;
          this.targetRadius = nextCfg.targetRadius;
          this.pickValidNextTarget(this.radius, this.targetRadius);
          phaseAdvanced = true;
        } else {
          this.timerSec = 0;
        }
      }
    }

    return { phaseStartedClosing, phaseAdvanced };
  }

  private pickValidNextTarget(curR: number, nextR: number): void {
    const maxOffset = Math.max(0, (curR - nextR) * 0.72);
    for (let attempt = 0; attempt < 16; attempt++) {
      const ang = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(0, maxOffset);
      const cx = this.centerX + Math.cos(ang) * dist;
      const cz = this.centerZ + Math.sin(ang) * dist;
      const coastR = getIslandCoastRadius(Math.atan2(cz, cx));
      // Keep final zones cleanly on dry landmass rather than deep offshore ocean
      if (Math.hypot(cx, cz) + nextR * 0.35 < coastR - 80) {
        this.targetX = cx;
        this.targetZ = cz;
        return;
      }
    }
    this.targetX = this.centerX * 0.85;
    this.targetZ = this.centerZ * 0.85;
  }

  public isOutsideSafeZone(x: number, z: number): boolean {
    if (this.radius <= 0) return true;
    return Math.hypot(x - this.centerX, z - this.centerZ) > this.radius;
  }

  public distanceToSafeZone(x: number, z: number): number {
    const d = Math.hypot(x - this.centerX, z - this.centerZ);
    return Math.max(0, Math.round(d - this.radius));
  }

  /** Computes damage ticks across variable dt (capped cleanly to prevent multi-tick spikes). */
  public sampleStormDamage(x: number, z: number, dt: number): number {
    if (!this.isOutsideSafeZone(x, z)) {
      this.damageAccumulator = 0;
      return 0;
    }
    this.damageAccumulator = Math.min(2.0, this.damageAccumulator + Math.min(dt, 0.25));
    if (this.damageAccumulator >= 1.0) {
      this.damageAccumulator -= 1.0;
      return this.damagePerSec;
    }
    return 0;
  }
}
