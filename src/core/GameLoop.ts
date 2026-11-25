/**
 * Single active animation loop with fixed-timestep simulation accumulator
 * and frame-rate-independent interpolation factor. Prevents duplicate rAF loops.
 */

import { SIMULATION_CONFIG } from './Config';

export interface GameLoopCallbacks {
  isForeground: () => boolean;
  isIdle: () => boolean;
  fixedStep: (fixedDt: number) => void;
  renderFrame: (frameDt: number, rawMs: number, interpolationAlpha: number) => void;
  idleTick?: (dt: number) => void;
  onBeforeSoftwareWait?: () => void;
}

export class GameLoop {
  private running = false;
  private disposed = false;
  private rafId = 0;
  private timeoutId = 0;
  private lastMs = 0;
  private accumulator = 0;
  private smoothedDt = SIMULATION_CONFIG.fixedStepSec;

  constructor(
    private readonly isSoftwareRenderer: boolean,
    private readonly callbacks: GameLoopCallbacks,
    private readonly scheduleSoftwarePacing?: (cb: () => void) => number,
  ) {}

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastMs = performance.now();
    this.accumulator = 0;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private scheduleNext(): void {
    if (!this.running || this.disposed) return;
    if (!this.callbacks.isForeground() || this.callbacks.isIdle()) {
      this.timeoutId = window.setTimeout(this.tick, 60);
      return;
    }
    if (this.isSoftwareRenderer && this.scheduleSoftwarePacing) {
      this.timeoutId = this.scheduleSoftwarePacing(this.tick);
      return;
    }
    this.rafId = requestAnimationFrame(this.tick);
  }

  private readonly tick = () => {
    this.rafId = 0;
    this.timeoutId = 0;
    if (!this.running || this.disposed) return;

    const now = performance.now();
    const rawMs = Math.max(0.5, now - this.lastMs);
    this.lastMs = now;

    const clampedDt = Math.min(rawMs / 1000, SIMULATION_CONFIG.maxDeltaSec);
    this.smoothedDt = this.smoothedDt + (clampedDt - this.smoothedDt) * 0.38;

    if (!this.callbacks.isForeground() || this.callbacks.isIdle()) {
      this.accumulator = 0;
      this.callbacks.idleTick?.(this.smoothedDt);
      this.scheduleNext();
      return;
    }

    this.accumulator += clampedDt;
    const fixedDt = SIMULATION_CONFIG.fixedStepSec;
    let steps = 0;
    while (this.accumulator >= fixedDt && steps < SIMULATION_CONFIG.maxSubStepsPerFrame) {
      this.callbacks.fixedStep(fixedDt);
      this.accumulator -= fixedDt;
      steps++;
    }
    if (steps >= SIMULATION_CONFIG.maxSubStepsPerFrame) {
      this.accumulator = 0;
    }

    const alpha = Math.max(0, Math.min(1, this.accumulator / fixedDt));
    this.callbacks.renderFrame(this.smoothedDt, rawMs, alpha);
    this.callbacks.onBeforeSoftwareWait?.();
    this.scheduleNext();
  };
}
