import React, { useState } from 'react';
import {
  ChevronDown,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Home,
  Keyboard,
} from 'lucide-react';
import { DIFFICULTY_SPECS, GameSettings, HudSnapshot, MAP_SPECS } from '../game/types';

interface ModalOverlayProps {
  hud: HudSnapshot;
  settings: GameSettings;
  onResume: () => void;
  onRestart: () => void;
  onContinueEndless: () => void;
  onMainMenu: () => void;
  onSensitivityChange: (val: number) => void;
  onToggleMute: () => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  hud,
  settings,
  onResume,
  onRestart,
  onContinueEndless,
  onMainMenu,
  onSensitivityChange,
  onToggleMute,
  onSettingsChange,
}) => {
  const accuracy = hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;
  const isPaused = hud.phase === 'paused';
  const isVictory = hud.phase === 'victory';
  const mapName = MAP_SPECS[hud.mapId].name;
  const diffLabel = DIFFICULTY_SPECS[hud.difficulty].label;

  // Optional Controls guide expanded state
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-xs px-4 py-3 select-none overflow-y-auto">
      <div className="w-full max-w-md max-h-[96dvh] overflow-y-auto bg-[#0f1622]/98 border border-white/14 rounded-xl p-4 sm:p-6 shadow-2xl space-y-4">
        {/* Header Breadcrumb & Title */}
        <div className="border-b border-white/10 pb-3">
          <p className="text-[11px] font-mono text-amber-400 font-semibold mb-0.5">
            {hud.multiplayer?.active
              ? `${hud.multiplayer.mode === 'coop' ? 'Co-op Survival' : 'Deathmatch (PvP)'} · Room ${hud.multiplayer.roomCode}`
              : `${mapName} · ${diffLabel} · ${isPaused ? 'Paused' : isVictory ? 'Town Secured' : 'Overrun'}`}
          </p>
          <h2 className="font-display font-bold text-2xl text-white tracking-tight">
            {isPaused
              ? 'Game Paused'
              : isVictory
              ? 'Mission Complete'
              : hud.multiplayer?.mode === 'deathmatch'
              ? 'Match Concluded'
              : 'Eliminated'}
          </h2>
        </div>

        {/* Multiplayer Standings Summary */}
        {!isPaused && hud.multiplayer?.active && hud.multiplayer.players.length > 0 && (
          <div className="py-2.5 border-y border-white/10 space-y-2">
            <span className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wider">
              Final Standings
            </span>
            <div className="space-y-1">
              {[...hud.multiplayer.players]
                .sort((a, b) => b.kills - a.kills || b.score - a.score)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-white/5 rounded px-2.5 py-1.5">
                    <span className="font-mono text-white font-bold">
                      #{idx + 1} {p.name}
                    </span>
                    <span className="font-mono text-amber-300 font-semibold">
                      {p.kills} Kills · {p.score} Pts
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Combat Stats Grid (Victory / Game Over) */}
        {!isPaused && (
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/10">
            <div className="p-2.5 bg-[#141d2b] border border-white/10 rounded-lg">
              <div className="text-[11px] text-slate-400 font-mono mb-0.5">Final Score</div>
              <div className="font-display font-bold text-xl text-white font-mono-num">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 bg-[#141d2b] border border-white/10 rounded-lg">
              <div className="text-[11px] text-slate-400 font-mono mb-0.5">Best Score</div>
              <div className="font-display font-bold text-xl text-amber-400 font-mono-num">
                {hud.bestScore.toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 bg-[#141d2b] border border-white/10 rounded-lg">
              <div className="text-[11px] text-slate-400 font-mono mb-0.5">Eliminations</div>
              <div className="font-mono font-semibold text-sm text-slate-100">
                {hud.eliminations} <span className="text-[10px] text-slate-400 font-normal">({hud.headshots} headshots)</span>
              </div>
            </div>
            <div className="p-2.5 bg-[#141d2b] border border-white/10 rounded-lg">
              <div className="text-[11px] text-slate-400 font-mono mb-0.5">Accuracy · Wave</div>
              <div className="font-mono font-semibold text-sm text-slate-100">
                {accuracy}% · Wave {hud.wave}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SIMPLIFIED PAUSE MENU (CLEAN, DIRECT, NO REDUNDANT DROPDOWNS)
            =================================================================== */}
        {isPaused && (
          <div className="space-y-3.5 py-1">
            {/* Primary Action Button: Resume Mission */}
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-base tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:scale-[1.01] active:scale-[0.99]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Resume Mission</span>
            </button>

            {/* Quick Navigation: Restart & Main Menu */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 px-3 bg-[#141d2b] hover:bg-[#1d293d] border border-white/12 text-slate-200 hover:text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={onMainMenu}
                className="py-2.5 px-3 bg-[#141d2b] hover:bg-[#1d293d] border border-white/12 text-slate-200 hover:text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Main Menu</span>
              </button>
            </div>

            {/* Simple Controls & Settings Card */}
            <div className="p-3 bg-[#141d2b] border border-white/10 rounded-xl space-y-3 text-xs">
              {/* Row 1: Mouse Aim Sensitivity */}
              <div>
                <div className="flex items-center justify-between mb-1.5 font-mono">
                  <span className="text-slate-300 font-medium">Mouse Aim Sensitivity</span>
                  <span className="text-amber-300 font-bold">{settings.sensitivity.toFixed(2)}x</span>
                </div>
                <input
                  id="pause-sens"
                  type="range"
                  min={0.35}
                  max={2.5}
                  step={0.05}
                  value={settings.sensitivity}
                  onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5"
                />
              </div>

              {/* Row 2: Sound Effects Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-white/8">
                <span className="text-slate-300 font-mono font-medium">Sound Effects</span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-md border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: !settings.muted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    borderColor: !settings.muted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                    color: !settings.muted ? '#6ee7b7' : '#fca5a5',
                  }}
                >
                  {!settings.muted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{!settings.muted ? 'Enabled' : 'Muted'}</span>
                </button>
              </div>

              {/* Row 3: Simple Graphics Preset (Performance / Balanced / Quality) */}
              <div className="pt-2 border-t border-white/8">
                <div className="flex items-center justify-between mb-1.5 font-mono text-[11px]">
                  <span className="text-slate-300 font-medium">Graphics Quality</span>
                  <span className="text-cyan-300 font-bold uppercase">{settings.graphicsPreset}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['performance', 'balanced', 'quality'] as const).map((preset) => {
                    const active = settings.graphicsPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => onSettingsChange({ graphicsPreset: preset })}
                        className={`py-1.5 px-2 rounded-md font-mono text-xs font-bold capitalize transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-400 text-slate-950 shadow'
                            : 'bg-[#0d131d] text-slate-400 hover:text-white border border-white/10'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Keyboard Reference Accordion */}
            <div className="border border-white/8 rounded-lg overflow-hidden bg-[#141d2b]/40">
              <button
                type="button"
                onClick={() => setShowControls((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between text-left text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Keyboard Controls</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showControls ? 'rotate-180 text-amber-400' : ''}`}
                />
              </button>

              {showControls && (
                <div className="px-3 pb-3 pt-1 border-t border-white/8 bg-[#0d131d]/90 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-slate-300">
                  <div><span className="text-amber-300 font-bold">WASD</span> : Move</div>
                  <div><span className="text-amber-300 font-bold">Mouse</span> : Aim / Look</div>
                  <div><span className="text-amber-300 font-bold">Left Click</span> : Fire</div>
                  <div><span className="text-amber-300 font-bold">Right Click</span> : Aim (ADS)</div>
                  <div><span className="text-amber-300 font-bold">R</span> : Reload</div>
                  <div><span className="text-amber-300 font-bold">F</span> : Dash</div>
                  <div><span className="text-amber-300 font-bold">Q / G</span> : Grenade</div>
                  <div><span className="text-amber-300 font-bold">Space / C</span> : Jump / Crouch</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Victory / Game Over Action Buttons */}
        {!isPaused && (
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            {isVictory && (
              <button
                type="button"
                onClick={onContinueEndless}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(245,158,11,0.25)]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Continue Endless Protocol</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 px-3 bg-[#141d2b] hover:bg-[#1c293d] border border-white/12 text-slate-200 hover:text-white text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={onMainMenu}
                className="py-2.5 px-3 bg-[#141d2b] hover:bg-[#1c293d] border border-white/12 text-slate-200 hover:text-white text-xs font-mono rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
