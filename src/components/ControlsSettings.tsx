import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_KEY_BINDINGS } from '../game/graphicsSettings';
import { ControlAction, GameSettings, KeyBindings } from '../game/types';

interface ControlsSettingsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

const CONTROL_GROUPS: Array<{ id: string; title: string; actions: Array<[ControlAction, string]> }> = [
  {
    id: 'movement',
    title: 'Movement',
    actions: [
      ['forward', 'Move Forward'],
      ['backward', 'Move Backward'],
      ['left', 'Move Left'],
      ['right', 'Move Right'],
      ['sprint', 'Sprint'],
      ['crouch', 'Crouch'],
    ],
  },
  {
    id: 'combat',
    title: 'Combat',
    actions: [
      ['reload', 'Reload'],
      ['dash', 'Dash'],
      ['inspect', 'Inspect Weapon'],
      ['grenade', 'Use Grenade'],
      ['scopeZoom', 'Scope Zoom'],
    ],
  },
  {
    id: 'weapons',
    title: 'Weapon Slots',
    actions: [
      ['primary1', 'Primary 1'],
      ['primary2', 'Primary 2'],
      ['sidearm', 'Sidearm'],
      ['launcher', 'Launcher'],
    ],
  },
];

const keyName = (code: string) =>
  code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('ShiftLeft', 'L-Shift')
    .replace('ShiftRight', 'R-Shift')
    .replace('ControlLeft', 'L-Ctrl')
    .replace('ControlRight', 'R-Ctrl')
    .replace('AltLeft', 'L-Alt')
    .replace('AltRight', 'R-Alt')
    .replace('Space', 'Space');

export const ControlsSettings: React.FC<ControlsSettingsProps> = ({ settings, onChange }) => {
  const [capturing, setCapturing] = useState<ControlAction | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>('all');

  const assign = (action: ControlAction, code: string) => {
    const next: KeyBindings = { ...settings.controls };
    const owner = (Object.keys(next) as ControlAction[]).find(
      (candidate) => candidate !== action && next[candidate] === code,
    );
    if (owner) next[owner] = next[action];
    next[action] = code;
    onChange({ controls: next });
    setCapturing(null);
  };

  const filteredGroups =
    activeGroupFilter === 'all'
      ? CONTROL_GROUPS
      : CONTROL_GROUPS.filter((g) => g.id === activeGroupFilter);

  return (
    <section className="space-y-2.5 pt-2">
      {/* Controls Dropdown Filter & Reset */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">Category:</span>
          <select
            value={activeGroupFilter}
            onChange={(e) => setActiveGroupFilter(e.target.value)}
            className="bg-[#141d2b] border border-white/15 rounded px-2 py-1 text-xs text-amber-300 font-mono focus:outline-none cursor-pointer"
          >
            <option value="all">All Controls (15 Keys)</option>
            <option value="movement">Movement (WASD)</option>
            <option value="combat">Combat (Reload/Dash/Grenade)</option>
            <option value="weapons">Weapon Slots (1–4)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange({ controls: { ...DEFAULT_KEY_BINDINGS } });
            setCapturing(null);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 border border-white/12 rounded hover:bg-white/5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Compact Rebinding Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filteredGroups.map((group) => (
          <div key={group.title} className="rounded-md border border-white/8 bg-[#141d2b] p-2">
            <h4 className="text-[10px] uppercase font-mono tracking-wider text-amber-400/90 mb-1.5">
              {group.title}
            </h4>
            <div className="space-y-1">
              {group.actions.map(([action, label]) => (
                <div key={action} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-300 font-mono">{label}</span>
                  <button
                    type="button"
                    onClick={() => setCapturing(action)}
                    onKeyDown={(event) => {
                      if (capturing !== action) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (event.code === 'Escape') setCapturing(null);
                      else assign(action, event.code);
                    }}
                    className={`min-w-16 px-1.5 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer ${
                      capturing === action
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 animate-pulse'
                        : 'border-white/12 bg-[#0d131d] text-slate-200 hover:border-amber-400/60'
                    }`}
                  >
                    {capturing === action ? 'Press key…' : keyName(settings.controls[action])}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
