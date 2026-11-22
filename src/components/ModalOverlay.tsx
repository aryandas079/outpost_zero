import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { DIFFICULTY_SPECS, GameSettings, HudSnapshot, MAP_SPECS } from '../game/types';
import { GraphicsSettings } from './GraphicsSettings';

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

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#090d13]/72 px-4 py-3 select-none overflow-y-auto">
      <div className="w-full max-w-md max-h-[96dvh] overflow-y-auto bg-[#10161f]/96 border border-white/14 rounded-lg p-5 sm:p-7 shadow-2xl">
        {/* Heading */}
        <div className="mb-4 sm:mb-6">
          <p className="text-xs font-medium text-amber-400 mb-1">
            {mapName} · {diffLabel} · {isPaused ? 'Paused' : isVictory ? 'Town Secured' : 'Overrun'}
          </p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
            {isPaused ? 'Game Paused' : isVictory ? 'Mission Complete' : 'Eliminated'}
          </h2>
        </div>

        {/* Combat Stats Grid (Victory / Game Over) */}
        {!isPaused && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4 mb-6 border-y border-white/10">
            <div>
              <div className="text-xs text-slate-400 mb-0.5">Final Score</div>
              <div className="font-display font-bold text-2xl text-white font-mono-num">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">Best Score</div>
              <div className="font-display font-bold text-2xl text-amber-400 font-mono-num">
                {hud.bestScore.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">Eliminations</div>
              <div className="font-mono-num font-semibold text-base text-slate-100">
                {hud.eliminations} <span className="text-xs text-slate-400 font-normal">({hud.headshots} headshots)</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-0.5">Accuracy · Wave</div>
              <div className="font-mono-num font-semibold text-base text-slate-100">
                {accuracy}% <span className="text-slate-500">·</span> Wave {hud.wave}
              </div>
            </div>
          </div>
        )}

        {/* Settings Controls (Pause Screen) */}
        {isPaused && (
          <div className="space-y-5 py-4 mb-6 border-y border-white/10">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <label htmlFor="mouse-sens-slider" className="text-slate-300 font-medium">
                  Mouse Sensitivity
                </label>
                <span className="font-mono-num text-amber-300 font-semibold">
                  {settings.sensitivity.toFixed(2)}x
                </span>
              </div>
              <input
                id="mouse-sens-slider"
                type="range"
                min={0.35}
                max={2.2}
                step={0.05}
                value={settings.sensitivity}
                onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Sound Effects</span>
              <button
                type="button"
                onClick={onToggleMute}
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-10 text-xs font-medium text-slate-200 bg-[#18212d] border border-white/12 rounded-md hover:bg-[#202c3c] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {settings.muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>{settings.muted ? 'Muted' : 'Enabled'}</span>
              </button>
            </div>

            <GraphicsSettings settings={settings} onChange={onSettingsChange} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 min-h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide rounded-md transition-colors cursor-pointer"
            >
              Resume
            </button>
          )}

          {isVictory && (
            <button
              type="button"
              onClick={onContinueEndless}
              className="w-full py-3 min-h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide rounded-md transition-colors cursor-pointer"
            >
              Continue Endless
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className={`w-full py-3 min-h-11 font-display font-bold text-sm tracking-wide rounded-md transition-colors cursor-pointer ${
              !isPaused && !isVictory
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-[#1a2330] hover:bg-[#243042] text-slate-100 border border-white/12'
            }`}
          >
            {isPaused ? 'Restart Mission' : 'Play Again'}
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full py-2.5 min-h-10 text-slate-300 hover:text-white text-xs font-medium rounded-md hover:bg-white/6 transition-colors cursor-pointer"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
