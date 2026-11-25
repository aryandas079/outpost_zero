import React, { useEffect, useMemo, useState } from 'react';
import { ControlAction, GameSettings } from '../game/types';
import { DEFAULT_KEY_BINDINGS } from '../settings/SettingsStore';

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'Space') return 'SPACE';
  return code.toUpperCase();
}

interface ControlsSettingsProps {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}

const ACTION_LIST: { action: ControlAction; label: string }[] = [
  { action: 'forward', label: 'Move Forward' },
  { action: 'backward', label: 'Move Backward' },
  { action: 'left', label: 'Strafe Left' },
  { action: 'right', label: 'Strafe Right' },
  { action: 'sprint', label: 'Sprint / Tactical Glide' },
  { action: 'crouch', label: 'Crouch / Combat Slide' },
  { action: 'interact', label: 'Interact / Loot Item' },
  { action: 'armorPlate', label: 'Apply Armor Plate' },
  { action: 'medkit', label: 'Use Field Medkit' },
  { action: 'reload', label: 'Reload Weapon' },
  { action: 'dash', label: 'Dash / Eject Aircraft' },
  { action: 'inspect', label: 'Weapon Inspect' },
  { action: 'grenade', label: 'Throw Ordnance' },
  { action: 'scopeZoom', label: 'Toggle Optic Zoom' },
  { action: 'primary1', label: 'Primary Slot 1' },
  { action: 'primary2', label: 'Primary Slot 2' },
  { action: 'sidearm', label: 'Sidearm Slot 3' },
  { action: 'launcher', label: 'Launcher Slot 4' },
];

export const ControlsSettings: React.FC<ControlsSettingsProps> = ({ settings, onChange }) => {
  const [rebinding, setRebinding] = useState<ControlAction | null>(null);

  const conflicts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const code of Object.values(settings.controls)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [settings.controls]);

  useEffect(() => {
    if (!rebinding) return;
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setRebinding(null);
        return;
      }
      onChange({
        controls: {
          ...settings.controls,
          [rebinding]: e.code,
        },
      });
      setRebinding(null);
    };
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [rebinding, settings.controls, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#A8B0B8]">CLICK ANY KEY TO REBIND · ESC TO CANCEL</span>
        <button
          type="button"
          onClick={() => onChange({ controls: { ...DEFAULT_KEY_BINDINGS } })}
          className="px-2.5 py-1 border border-white/15 bg-white/8 hover:bg-white/15 text-[#F2F4F5] rounded-xs cursor-pointer"
        >
          RESET KEYS
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {ACTION_LIST.map(({ action, label }) => {
          const code = settings.controls[action];
          const isRebinding = rebinding === action;
          const isDuplicate = (conflicts.get(code) ?? 0) > 1;
          return (
            <button
              key={action}
              type="button"
              onClick={() => setRebinding(action)}
              className={`flex items-center justify-between px-3 py-2 border rounded-xs text-left cursor-pointer ${
                isRebinding
                  ? 'border-[#E9B94C] bg-[#E9B94C]/15'
                  : isDuplicate
                    ? 'border-[#E05252]/70 bg-[#E05252]/10'
                    : 'border-white/10 bg-[#0B1117] hover:border-white/25'
              }`}
            >
              <span className="text-xs text-[#F2F4F5]">{label}</span>
              <span className="px-2 py-0.5 bg-white/10 rounded-xs font-mono text-[11px] font-bold text-[#52C7DE]">
                {isRebinding ? 'PRESS KEY...' : formatKeyCode(code)}
                {isDuplicate && !isRebinding ? ' !' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2 text-[10px] font-mono text-[#A8B0B8]">
        <span>[SPACE] JUMP / CHUTE</span>
        <span>·</span>
        <span>[V] PRONE</span>
        <span>·</span>
        <span>[M] TACTICAL MAP</span>
        <span>·</span>
        <span>[TAB] INVENTORY</span>
        <span>·</span>
        <span>[F8] TELEMETRY</span>
      </div>
    </div>
  );
};
