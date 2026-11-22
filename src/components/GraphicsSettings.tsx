import React from 'react';
import { GameSettings } from '../game/types';
import { GRAPHICS_PRESETS, GraphicsPreset } from '../game/graphicsSettings';

interface GraphicsSettingsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  compact?: boolean;
}

const selectClass =
  'min-h-8 rounded-md border border-white/15 bg-[#141d2b] px-2 text-xs font-mono text-slate-100 outline-none focus:border-amber-400/60 cursor-pointer';

export const GraphicsSettings: React.FC<GraphicsSettingsProps> = ({ settings, onChange }) => {
  const setCustom = (patch: Partial<GameSettings>) => onChange({ ...patch, graphicsPreset: 'custom' });

  return (
    <div className="space-y-3 pt-2">
      {/* Preset & Resolution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex items-center justify-between gap-2 p-2 bg-[#141d2b] border border-white/10 rounded-md">
          <label htmlFor="graphics-preset" className="text-xs text-slate-300 font-medium">
            Preset
          </label>
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

        <div className="p-2 bg-[#141d2b] border border-white/10 rounded-md flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="resolution-scale" className="text-slate-300 font-medium">
              3D Resolution
            </label>
            <span className="font-mono-num text-amber-300 font-bold text-xs">
              {Math.round(settings.resolutionScale * 100)}%
            </span>
          </div>
          <input
            id="resolution-scale"
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={settings.resolutionScale}
            onChange={(event) => setCustom({ resolutionScale: Number(event.target.value) })}
            className="w-full accent-amber-500 cursor-pointer h-1.5"
          />
        </div>
      </div>

      {/* Advanced Dropdown Controls in Compact Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono">
          FPS Target
          <select
            value={settings.targetFps}
            onChange={(event) => setCustom({ targetFps: Number(event.target.value) as GameSettings['targetFps'] })}
            className={selectClass}
          >
            {[60, 90, 100, 120, 144].map((value) => (
              <option key={value} value={value}>
                {value} FPS
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono">
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

        <label className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono">
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

        <label className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono">
          Dynamic Resolution
          <button
            type="button"
            onClick={() => setCustom({ dynamicResolution: !settings.dynamicResolution })}
            className={`min-h-8 rounded-md border px-2 text-xs font-mono font-medium transition-colors cursor-pointer ${
              settings.dynamicResolution
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                : 'border-white/12 bg-[#141d2b] text-slate-400'
            }`}
            aria-pressed={settings.dynamicResolution}
          >
            {settings.dynamicResolution ? 'Enabled (Adaptive)' : 'Disabled'}
          </button>
        </label>
      </div>
    </div>
  );
};
