/**
 * Unified desktop host bridge supporting both Electron (`window.electronAPI`)
 * and Windows WinUI 3 (`chrome.webview`), degrading to standard Web APIs in browsers.
 */

interface ElectronBridgeApi {
  isElectron?: boolean;
  platform?: string;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  toggleFullscreen?: () => void;
  isFullscreen?: () => Promise<boolean>;
  onFullscreenChange?: (cb: (isFullScreen: boolean) => void) => () => void;
  getVersion?: () => Promise<string>;
}

function getElectronApi(): ElectronBridgeApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: ElectronBridgeApi }).electronAPI;
}

export interface NativeGpuInfo {
  adapterName: string;
  dedicatedVramMb: number;
  sharedMemoryMb: number;
  refreshRateHz: number;
  isNativeHost: boolean;
}

interface WebView2Chrome {
  webview?: {
    postMessage: (message: unknown) => void;
    addEventListener: (type: string, listener: (ev: { data: unknown }) => void) => void;
    removeEventListener: (type: string, listener: (ev: { data: unknown }) => void) => void;
  };
}

class NativeDesktopBridge {
  private gpuInfo: NativeGpuInfo = {
    adapterName: 'WebGL2 Browser',
    dedicatedVramMb: 0,
    sharedMemoryMb: 0,
    refreshRateHz: 60,
    isNativeHost: false,
  };
  private readonly listeners = new Set<(msg: Record<string, unknown>) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      const wv = (window as unknown as { chrome?: WebView2Chrome }).chrome?.webview;
      if (wv) {
        this.gpuInfo.isNativeHost = true;
        wv.addEventListener('message', (ev) => {
          const data = typeof ev.data === 'string' ? safeParse(ev.data) : ev.data;
          if (!data || typeof data !== 'object') return;
          const record = data as Record<string, unknown>;
          if (record.type === 'native:gpu-info') {
            this.gpuInfo = {
              adapterName: String(record.adapterName ?? 'Direct3D11 GPU'),
              dedicatedVramMb: Number(record.dedicatedVramMb ?? 0),
              sharedMemoryMb: Number(record.sharedMemoryMb ?? 0),
              refreshRateHz: Number(record.refreshRateHz ?? 60),
              isNativeHost: true,
            };
          }
          for (const fn of this.listeners) fn(record);
        });
        this.post('host:ready', {});
      }
    }
  }

  get isNativeWinUI(): boolean {
    return this.gpuInfo.isNativeHost;
  }

  get isElectron(): boolean {
    return Boolean(getElectronApi()?.isElectron);
  }

  get isDesktopHost(): boolean {
    return this.isNativeWinUI || this.isElectron;
  }

  getGpuInfo(): NativeGpuInfo {
    return this.gpuInfo;
  }

  onMessage(handler: (msg: Record<string, unknown>) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  post(type: string, payload: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return;
    const wv = (window as unknown as { chrome?: WebView2Chrome }).chrome?.webview;
    if (wv) {
      try {
        wv.postMessage(JSON.stringify({ type, ...payload }));
      } catch {
        // Ignore bridge post errors
      }
    }
  }

  setPointerCapture(active: boolean): void {
    this.post('host:pointer-capture', { active });
  }

  toggleFullscreen(): void {
    if (this.isNativeWinUI) {
      this.post('host:toggle-fullscreen', {});
      return;
    }
    const electron = getElectronApi();
    if (electron?.toggleFullscreen) {
      electron.toggleFullscreen();
      return;
    }
    if (typeof document !== 'undefined') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    }
  }

  exitApplication(): void {
    if (this.isNativeWinUI) {
      this.post('host:exit', {});
      return;
    }
    getElectronApi()?.close?.();
  }

  toggleNativeOverlay(): void {
    this.post('host:toggle-diagnostics', {});
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const nativeBridge = new NativeDesktopBridge();
