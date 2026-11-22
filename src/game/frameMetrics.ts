/** GPU timers are polled asynchronously: never wait for the graphics queue. */
export class GpuFrameTimer {
  private readonly extension: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: WebGLQuery | null = null;
  private active = false;
  private frames = 0;
  public milliseconds = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  begin() {
    const ext = this.extension;
    if (!ext) return;
    if (this.pending && this.gl.getQueryParameter(this.pending, this.gl.QUERY_RESULT_AVAILABLE)) {
      if (!this.gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        this.milliseconds = this.gl.getQueryParameter(this.pending, this.gl.QUERY_RESULT) / 1e6;
      } else this.milliseconds = 0;
      this.gl.deleteQuery(this.pending);
      this.pending = null;
    }
    if (this.pending || ++this.frames % 12 !== 0) return;
    this.pending = this.gl.createQuery();
    if (!this.pending) return;
    this.gl.beginQuery(ext.TIME_ELAPSED_EXT, this.pending);
    this.active = true;
  }

  end() {
    if (!this.active || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.active = false;
  }

  dispose() {
    this.end();
    if (this.pending) this.gl.deleteQuery(this.pending);
    this.pending = null;
  }
}

export class FrameMetrics {
  private elapsed = 0;
  private frames = 0;
  private worst = 0;
  private totalElapsed = 0;
  private totalFrames = 0;
  public fps = 0;
  public averageFps = 0;
  public peakFps = 0;
  public frameMs = 0;
  public worstFrameMs = 0;

  sample(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.elapsed += milliseconds;
    this.totalElapsed += milliseconds;
    this.totalFrames++;
    this.frames++;
    this.worst = Math.max(this.worst, milliseconds);
    if (this.elapsed < 1000) return;
    this.fps = Math.round(this.frames * 1000 / this.elapsed);
    this.averageFps = Math.round(this.totalFrames * 1000 / this.totalElapsed);
    this.peakFps = Math.max(this.peakFps, this.fps);
    this.frameMs = this.elapsed / this.frames;
    this.worstFrameMs = this.worst;
    this.elapsed = 0;
    this.frames = 0;
    this.worst = 0;
  }

  reset() {
    this.elapsed = this.frames = this.worst = this.totalElapsed = this.totalFrames = 0;
    this.fps = this.averageFps = this.peakFps = this.frameMs = this.worstFrameMs = 0;
  }
}
