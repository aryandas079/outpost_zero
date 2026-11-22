import React from 'react';
import { GameSettings } from '../game/types';
import { GRAPHICS_PRESETS, GraphicsPreset } from '../game/graphicsSettings';

interface GraphicsSettingsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

const selectClass = 'min-h-9 rounded-md border border-white/12 bg-[#18212d] px-2.5 text-xs font-medium text-slate-100 outline-none focus:border-amber-400/60 cursor-pointer';

export const GraphicsSettings: React.FC<GraphicsSettingsProps> = ({ settings, onChange }) => {
  const setCustom = (patch: Partial<GameSettings>) => onChange({ ...patch, graphicsPreset: 'custom' });

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div>
        <div className="text-xs font-semibold tracking-wider uppercase text-amber-300 mb-1">Graphics & Performance</div>
        <p className="text-[11px] leading-relaxed text-slate-400">Balanced keeps full PBR materials and targets 100 FPS. Quality locks native resolution; Performance prioritizes 144 FPS.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="graphics-preset" className="text-xs text-slate-300 font-medium">Preset</label>
        <select
          id="graphics-preset"
          value={settings.graphicsPreset}
          onChange={(event) => {
            const preset = event.target.value as GameSettings['graphicsPreset'];
            if (preset !== 'custom') onChange(GRAPHICS_PRESETS[preset as GraphicsPreset]);
          }}
          className={selectClass}
        >
          <option value="quality">Quality</option>
          <option value="balanced">Balanced</option>
          <option value="performance">Performance</option>
          {settings.graphicsPreset === 'custom' && <option value="custom">Custom</option>}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <label htmlFor="resolution-scale" className="text-slate-300 font-medium">3D Resolution</label>
          <span className="font-mono-num text-amber-300 font-semibold">{Math.round(settings.resolutionScale * 100)}%</span>
        </div>
        <input
          id="resolution-scale"
          type="range"
          min={0.5}
          max={1}
          step={0.05}
          value={settings.resolutionScale}
          onChange={(event) => setCustom({ resolutionScale: Number(event.target.value) })}
          className="w-full accent-amber-500 cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-slate-300 font-medium">
          FPS Target
          <select
            value={settings.targetFps}
            onChange={(event) => setCustom({ targetFps: Number(event.target.value) as GameSettings['targetFps'] })}
            className={selectClass}
          >
            {[60, 90, 100, 120, 144].map(value => <option key={value} value={value}>{value} FPS</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-slate-300 font-medium">
          Shadows
          <select
            value={settings.shadowQuality}
            onChange={(event) => setCustom({ shadowQuality: event.target.value as GameSettings['shadowQuality'] })}
            className={selectClass}
          >
            <option value="high">High · 2048</option>
            <option value="medium">Medium · 1024</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-slate-300 font-medium">
          Texture Filtering
          <select
            value={settings.textureFiltering}
            onChange={(event) => setCustom({ textureFiltering: Number(event.target.value) as GameSettings['textureFiltering'] })}
            className={selectClass}
          >
            <option value={2}>2×</option>
            <option value={4}>4×</option>
            <option value={8}>8×</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setCustom({ dynamicResolution: !settings.dynamicResolution })}
          className={`min-h-9 self-end rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer ${settings.dynamicResolution ? 'border-amber-400/40 bg-amber-400/12 text-amber-200' : 'border-white/12 bg-[#18212d] text-slate-300'}`}
          aria-pressed={settings.dynamicResolution}
        >
          Dynamic Res · {settings.dynamicResolution ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};
