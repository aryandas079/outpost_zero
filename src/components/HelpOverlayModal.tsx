import React from 'react';
import { Keyboard, Shield, Target, X, Zap } from 'lucide-react';
import { KeyBindings } from '../game/types';

interface HelpOverlayModalProps {
  controls: KeyBindings;
  onClose: () => void;
}

const formatKey = (code: string) =>
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

export const HelpOverlayModal: React.FC<HelpOverlayModalProps> = ({ controls, onClose }) => {
  const bindings: Array<[string, string]> = [
    ['Move', `${formatKey(controls.forward)}${formatKey(controls.left)}${formatKey(controls.backward)}${formatKey(controls.right)}`],
    ['Sprint / Steady Breath', formatKey(controls.sprint)],
    ['Crouch / Slide', formatKey(controls.crouch)],
    ['Jump', 'Space'],
    ['Fire / Aim (ADS)', 'LMB / RMB'],
    ['Reload', formatKey(controls.reload)],
    ['Tactical Dash', formatKey(controls.dash)],
    ['Throw Ordnance', formatKey(controls.grenade)],
    ['Scope Magnification', formatKey(controls.scopeZoom)],
    ['Inspect Weapon', formatKey(controls.inspect)],
    ['Primary Weapons', `${formatKey(controls.primary1)} / ${formatKey(controls.primary2)}`],
    ['Sidearm / Launcher', `${formatKey(controls.sidearm)} / ${formatKey(controls.launcher)}`],
    ['Tactical Satellite Map', 'M'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Field Manual and Controls"
    >
      <div
        className="w-full max-w-2xl bg-[#0e131b] border border-white/12 rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121822]">
          <div className="flex items-center gap-3">
            <Keyboard className="w-5 h-5 text-[#f5b301]" />
            <div>
              <h2 className="font-display font-bold text-lg text-white tracking-wide uppercase">
                Field Manual & Controls
              </h2>
              <p className="text-xs text-slate-400">Active keybindings and tactical combat briefing</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75dvh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {bindings.map(([label, keyText]) => (
              <div
                key={label}
                className="flex items-center justify-between px-3.5 py-2.5 bg-[#141b25] border border-white/8 rounded-lg text-xs"
              >
                <span className="text-slate-300">{label}</span>
                <kbd className="px-2 py-0.5 rounded bg-[#0a0e14] border border-white/15 font-mono text-[#f5b301] font-semibold">
                  {keyText}
                </kbd>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <div className="p-3.5 bg-[#141b25] border border-white/8 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-[#f5b301] font-display font-bold text-xs uppercase">
                <Target className="w-4 h-4" />
                <span>Precision Optics</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hold Right Click to align sights. On sniper & marksman rifles, hold Sprint to steady breath and toggle magnification.
              </p>
            </div>
            <div className="p-3.5 bg-[#141b25] border border-white/8 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-[#f5b301] font-display font-bold text-xs uppercase">
                <Zap className="w-4 h-4" />
                <span>Tactical Mobility</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Combine Sprint + Crouch to execute a combat slide, or trigger Dash to evade heavy enemy volleys.
              </p>
            </div>
            <div className="p-3.5 bg-[#141b25] border border-white/8 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-[#f5b301] font-display font-bold text-xs uppercase">
                <Shield className="w-4 h-4" />
                <span>Shield Recovery</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Take cover inside buildings to recharge ballistic shields and pick up health and ammo crates between waves.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-white/10 bg-[#0b1017] flex items-center justify-between">
          <span className="text-xs text-slate-400">You can rebind any key in Settings → Controls.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
