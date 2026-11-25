import React, { useState } from 'react';
import { GameSettings } from '../game/types';
import { GRAPHICS_PRESETS, GraphicsPreset, withCustomGraphics } from '../settings/SettingsStore';

interface GraphicsSettingsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

type SettingsGroup = 'display' | 'gameplay' | 'accessibility';

const PRESET_LIST: Array<{ id: GraphicsPreset; label: string; desc: string }> = [
  { id: 'performance', label: 'LOW', desc: '144 FPS · 72% scale' },
  { id: 'balanced', label: 'MEDIUM', desc: '100 FPS · Balanced' },
  { id: 'quality', label: 'HIGH', desc: '60 FPS · High' },
  { id: 'ultra', label: 'ULTRA', desc: '60 FPS · Max view' },
];

export const GraphicsSettings: React.FC<GraphicsSettingsProps> = ({ settings, onChange }) => {
  const [group, setGroup] = useState<SettingsGroup>('display');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1.5 bg-[#0B1117] p-1 border border-white/10 rounded-xs">
        {(
          [
            ['display', 'DISPLAY & QUALITY'],
            ['gameplay', 'CAMERA & HUD'],
            ['accessibility', 'ACCESSIBILITY'],
          ] as Array<[SettingsGroup, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGroup(id)}
            className={`py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-xs transition-colors cursor-pointer ${
              group === id ? 'bg-[#52C7DE] text-[#10161D]' : 'text-[#A8B0B8] hover:text-[#F2F4F5]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {group === 'display' && (
        <div className="space-y-3.5">
          <div>
            <div className="text-[10px] font-mono tracking-wider text-[#A8B0B8] uppercase mb-1.5">
              QUALITY PRESET {settings.graphicsPreset === 'custom' && '· CUSTOM'}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESET_LIST.map((preset) => {
                const active = settings.graphicsPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange(GRAPHICS_PRESETS[preset.id])}
                    className={`p-2 border rounded-xs text-left cursor-pointer ${
                      active
                        ? 'border-[#52C7DE] bg-[#52C7DE]/15 text-[#F2F4F5]'
                        : 'border-white/10 bg-[#0B1117] text-[#A8B0B8] hover:text-[#F2F4F5]'
                    }`}
                  >
                    <div className="text-[11px] font-bold tracking-wider">{preset.label}</div>
                    <div className="text-[9px] font-mono opacity-80">{preset.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#A8B0B8]">RENDER RESOLUTION SCALE</span>
              <span className="text-[#52C7DE] font-bold">{Math.round(settings.resolutionScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={settings.resolutionScale}
              onChange={(e) => onChange(withCustomGraphics(settings, { resolutionScale: Number(e.target.value) }))}
              className="w-full accent-[#52C7DE]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
              <div className="text-[10px] font-mono text-[#A8B0B8] mb-1.5">SHADOW QUALITY</div>
              <div className="grid grid-cols-3 gap-1">
                {(['off', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onChange(withCustomGraphics(settings, { shadowQuality: q }))}
                    className={`py-1 text-[10px] font-mono uppercase rounded-xs cursor-pointer ${
                      settings.shadowQuality === q ? 'bg-[#52C7DE] text-[#10161D] font-bold' : 'bg-white/6 text-[#A8B0B8]'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
              <div className="text-[10px] font-mono text-[#A8B0B8] mb-1.5">VIEW DISTANCE</div>
              <div className="grid grid-cols-4 gap-1">
                {(['reduced', 'balanced', 'extended', 'maximum'] as const).map((vd, idx) => (
                  <button
                    key={vd}
                    type="button"
                    onClick={() => onChange(withCustomGraphics(settings, { viewDistance: vd }))}
                    className={`py-1 text-[9px] font-mono uppercase rounded-xs cursor-pointer ${
                      settings.viewDistance === vd ? 'bg-[#52C7DE] text-[#10161D] font-bold' : 'bg-white/6 text-[#A8B0B8]'
                    }`}
                  >
                    {['LOW', 'MED', 'HIGH', 'MAX'][idx]}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
              <div className="text-[10px] font-mono text-[#A8B0B8] mb-1.5">WATER & SHADERS</div>
              <div className="grid grid-cols-3 gap-1">
                {(['basic', 'standard', 'enhanced'] as const).map((wq) => (
                  <button
                    key={wq}
                    type="button"
                    onClick={() => onChange(withCustomGraphics(settings, { waterQuality: wq }))}
                    className={`py-1 text-[9px] font-mono uppercase rounded-xs cursor-pointer ${
                      settings.waterQuality === wq ? 'bg-[#52C7DE] text-[#10161D] font-bold' : 'bg-white/6 text-[#A8B0B8]'
                    }`}
                  >
                    {wq}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
              <div className="text-[10px] font-mono text-[#A8B0B8] mb-1.5">LIGHTING TIME OF DAY</div>
              <div className="grid grid-cols-3 gap-1">
                {(['daylight', 'golden', 'overcast'] as const).map((tod) => (
                  <button
                    key={tod}
                    type="button"
                    onClick={() => onChange({ timeOfDay: tod })}
                    className={`py-1 text-[9px] font-mono uppercase rounded-xs cursor-pointer ${
                      settings.timeOfDay === tod ? 'bg-[#E9B94C] text-[#10161D] font-bold' : 'bg-white/6 text-[#A8B0B8]'
                    }`}
                  >
                    {tod}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-[#0B1117] border border-white/10 rounded-xs text-[11px] font-mono">
            <span className="text-[#A8B0B8]">PERFORMANCE TELEMETRY OVERLAY [F8]</span>
            <button
              type="button"
              onClick={() => onChange({ showPerfOverlay: !settings.showPerfOverlay })}
              className={`px-3 py-1 rounded-xs font-bold cursor-pointer ${
                settings.showPerfOverlay ? 'bg-[#52C7DE] text-[#10161D]' : 'bg-white/10 text-[#A8B0B8]'
              }`}
            >
              {settings.showPerfOverlay ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {group === 'gameplay' && (
        <div className="space-y-3">
          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#A8B0B8]">FIELD OF VIEW (FOV)</span>
              <span className="text-[#52C7DE] font-bold">{settings.fov}°</span>
            </div>
            <input
              type="range"
              min={65}
              max={105}
              step={1}
              value={settings.fov}
              onChange={(e) => onChange({ fov: Number(e.target.value) })}
              className="w-full accent-[#52C7DE]"
            />
          </div>

          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#A8B0B8]">ADS AIM SENSITIVITY MULTIPLIER</span>
              <span className="text-[#52C7DE] font-bold">{settings.adsSensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.35}
              max={1.8}
              step={0.05}
              value={settings.adsSensitivity}
              onChange={(e) => onChange({ adsSensitivity: Number(e.target.value) })}
              className="w-full accent-[#52C7DE]"
            />
          </div>

          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#A8B0B8]">HUD SCALE</span>
              <span className="text-[#52C7DE] font-bold">{Math.round(settings.hudScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.25}
              step={0.05}
              value={settings.hudScale}
              onChange={(e) => onChange({ hudScale: Number(e.target.value) })}
              className="w-full accent-[#52C7DE]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            {(
              [
                ['invertY', 'INVERT Y-AXIS', settings.invertY],
                ['sprintToggle', 'SPRINT TOGGLE', settings.sprintToggle],
                ['crouchToggle', 'CROUCH TOGGLE', settings.crouchToggle],
                ['minimapRotate', 'ROTATING MINIMAP', settings.minimapRotate],
              ] as const
            ).map(([key, label, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ [key]: !val } as Partial<GameSettings>)}
                className="flex items-center justify-between p-2.5 bg-[#0B1117] border border-white/10 rounded-xs cursor-pointer hover:border-white/25"
              >
                <span className="text-[#A8B0B8]">{label}</span>
                <span className={`font-bold ${val ? 'text-[#52C7DE]' : 'text-[#A8B0B8]'}`}>
                  {val ? (key === 'minimapRotate' ? 'ROTATE' : 'ON') : key === 'minimapRotate' ? 'NORTH-UP' : 'OFF'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {group === 'accessibility' && (
        <div className="space-y-3">
          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="text-[10px] font-mono text-[#A8B0B8] mb-1.5">COLORBLIND PALETTE</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['none', 'deuteranope', 'protanope', 'tritanope'] as const).map((cb) => (
                <button
                  key={cb}
                  type="button"
                  onClick={() => onChange({ colorblindMode: cb })}
                  className={`py-1.5 text-[10px] font-mono uppercase rounded-xs cursor-pointer ${
                    settings.colorblindMode === cb ? 'bg-[#52C7DE] text-[#10161D] font-bold' : 'bg-white/6 text-[#A8B0B8]'
                  }`}
                >
                  {cb}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-[#A8B0B8]">CROSSHAIR COLOR</span>
              <div className="flex gap-1.5">
                {['#F2F4F5', '#52C7DE', '#E9B94C', '#60BE8B'].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onChange({ crosshairColor: col })}
                    className={`w-6 h-6 rounded-xs border-2 cursor-pointer ${
                      settings.crosshairColor === col ? 'border-white scale-110' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-[#A8B0B8]">CROSSHAIR SIZE</span>
              <span className="text-[#52C7DE] font-bold">{settings.crosshairSize.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.5}
              step={0.1}
              value={settings.crosshairSize}
              onChange={(e) => onChange({ crosshairSize: Number(e.target.value) })}
              className="w-full accent-[#52C7DE]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ reducedMotion: !settings.reducedMotion })}
              className="flex items-center justify-between p-2.5 bg-[#0B1117] border border-white/10 rounded-xs text-[11px] font-mono cursor-pointer"
            >
              <span className="text-[#A8B0B8]">REDUCED MOTION</span>
              <span className={settings.reducedMotion ? 'text-[#52C7DE] font-bold' : 'text-[#A8B0B8]'}>
                {settings.reducedMotion ? 'ON' : 'OFF'}
              </span>
            </button>
            <div className="p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-[#A8B0B8]">CAMERA SHAKE</span>
                <span className="text-[#52C7DE]">{Math.round(settings.screenShakeScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.screenShakeScale}
                onChange={(e) => onChange({ screenShakeScale: Number(e.target.value) })}
                className="w-full accent-[#52C7DE]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
