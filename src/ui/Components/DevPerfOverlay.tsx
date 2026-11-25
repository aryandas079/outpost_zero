import React from 'react';
import type { HudSnapshot } from '../../game/types';
import { nativeBridge } from '../../utilities/NativeBridge';

interface DevPerfOverlayProps {
  hud: HudSnapshot;
  visible: boolean;
}

export const DevPerfOverlay: React.FC<DevPerfOverlayProps> = ({ hud, visible }) => {
  if (!visible || !hud.performance) return null;
  const p = hud.performance;
  const nativeGpu = nativeBridge.getGpuInfo();
  const gpuLabel = nativeGpu.isNativeHost ? nativeGpu.adapterName : p.gpuName;

  return (
    <div
      data-testid="dev-perf-overlay"
      className="fixed left-4 top-[198px] z-40 pointer-events-none select-none font-mono text-[10px] leading-tight text-[#F2F4F5] bg-[#10161D]/88 border border-white/15 px-2.5 py-2 rounded-xs shadow-lg min-w-[205px]"
    >
      <div className="flex items-center justify-between text-[#52C7DE] font-bold tracking-wider pb-1 mb-1 border-b border-white/10">
        <span>TELEMETRY · F8</span>
        <span>{p.fps} FPS</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[#A8B0B8]">
        <span>FRAME: {p.frameMs.toFixed(1)} ms</span>
        <span>WORST: {p.worstFrameMs.toFixed(1)} ms</span>
        <span>CPU: {p.cpuMs.toFixed(1)} ms</span>
        <span>GPU: {p.gpuMs.toFixed(1)} ms</span>
        <span>DRAWS: {p.drawCalls}</span>
        <span>TRIS: {(p.triangles / 1000).toFixed(1)}k</span>
        <span>CHUNKS: {p.activeChunks ?? 0}/64</span>
        <span>RES: {Math.round(p.resolutionScale * 100)}%</span>
        <span>TEX: {p.texturesCount ?? 0}</span>
        <span>GEO: {p.geometriesCount ?? 0}</span>
        {typeof p.jsHeapMb === 'number' && <span>HEAP: {p.jsHeapMb} MB</span>}
        {nativeGpu.isNativeHost && nativeGpu.dedicatedVramMb > 0 && (
          <span>VRAM: {nativeGpu.dedicatedVramMb} MB</span>
        )}
      </div>
      <div className="mt-1 pt-1 border-t border-white/10 text-[9px] text-[#A8B0B8] truncate max-w-[215px]">
        {gpuLabel}
      </div>
    </div>
  );
};
