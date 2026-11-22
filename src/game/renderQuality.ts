/** Render-time budget with faster reductions and cautious quality recovery. */
export class AdaptiveRenderQuality {
  private averageMs: number;
  private sampleSeconds = 0;
  private cooldownSeconds = 1;
  private ratio: number;

  constructor(private readonly ceiling: number, private readonly targetFps = 60, private readonly floor = 0.7) {
    this.ratio = ceiling;
    this.averageMs = 1000 / targetFps;
  }

  sample(frameMs: number, elapsedMs = frameMs): number | null {
    // Ignore tab suspension, loading stalls, and invalid timing samples.
    if (!Number.isFinite(frameMs) || frameMs < 0.01 || frameMs > 500) return null;
    const seconds = Math.min(Math.max(elapsedMs, 0), 500) / 1000;
    this.averageMs += (frameMs - this.averageMs) * (1 - Math.exp(-seconds * 5));
    this.sampleSeconds += seconds;
    this.cooldownSeconds -= seconds;
    if (this.cooldownSeconds > 0 || this.sampleSeconds < 0.5) return null;
    this.sampleSeconds = 0;
    const minimum = Math.min(this.ceiling, this.floor);
    const budgetMs = 1000 / this.targetFps;
    const highRefresh = this.targetFps >= 100;
    const next = this.averageMs > budgetMs * (highRefresh ? 1.1 : 1.26)
      ? Math.max(minimum, this.ratio - Math.min(0.2, Math.max(0.06, this.ratio * (1 - Math.sqrt(budgetMs / this.averageMs)))))
      : this.averageMs < budgetMs * (highRefresh ? 0.78 : 1.032)
        ? Math.min(this.ceiling, this.ratio + 0.035) : this.ratio;
    if (Math.abs(next - this.ratio) < 0.01) return null;
    const reducing = next < this.ratio;
    this.ratio = next;
    this.cooldownSeconds = reducing ? 0.75 : 2.5;
    return next;
  }
}
