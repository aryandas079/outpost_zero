import React, { useState } from 'react';
import { GameSettings, HudSnapshot } from '../game/types';
import { ControlsSettings } from './ControlsSettings';
import { GraphicsSettings } from './GraphicsSettings';
import { nativeBridge } from '../utilities/NativeBridge';
import { BrandHeaderLockup } from './BrandEmblem';

interface ModalOverlayProps {
  hud: HudSnapshot;
  settings: GameSettings;
  onResume: () => void;
  onRestart: () => void;
  onContinueEndless: () => void;
  onMainMenu: () => void;
  onSensitivityChange: (sens: number) => void;
  onToggleMute: () => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
  onEnterSpectator?: () => void;
  onExitApp?: () => void;
}

function formatSurvival(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
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
  onEnterSpectator,
  onExitApp,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'graphics' | 'controls' | 'audio'>('graphics');
  const [confirmExitMenu, setConfirmExitMenu] = useState(false);

  if (hud.phase !== 'paused' && hud.phase !== 'victory' && hud.phase !== 'gameover') {
    return null;
  }

  const isIsland = hud.mapId === 'island';
  const br = hud.battleRoyale;
  const accuracy = hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;
  const isVictory = hud.phase === 'victory';
  const isPaused = hud.phase === 'paused';

  const pauseSubtitle = isIsland ? `25 KM² ISLANDS · ZONE ${br?.stormPhase ?? 1}` : `WAVE ${hud.wave} · ${hud.difficulty.toUpperCase()}`;

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-50 bg-[#080F16]/84 flex items-center justify-center p-4"
    >
      <div className="bg-[#10161D] border border-white/15 rounded-xs w-[min(640px,95vw)] max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/12 flex items-center justify-between">
          <div>
            <div className="mb-1.5">
              <BrandHeaderLockup subtitle={isIsland ? 'BATTLE ROYALE' : 'WEST FRONTIER'} compact />
            </div>
            <h2 className="text-xl font-black tracking-wider text-[#F2F4F5] uppercase mt-0.5">
              {isPaused
                ? 'MATCH PAUSED'
                : isVictory
                  ? isIsland
                    ? '#1 VICTORY ROYALE'
                    : 'SECTOR SECURED'
                  : isIsland
                    ? `ELIMINATED · PLACEMENT #${hud.placement ?? br?.aliveCount ?? 2}`
                    : 'OPERATIVE DOWN'}
            </h2>
            <p className="text-xs font-mono text-[#A8B0B8] mt-0.5">
              {isPaused
                ? pauseSubtitle
                : isIsland
                  ? `25 KM² ISLANDS · ${hud.battleRoyale?.nearestPoi ?? 'ISLAND'}`
                  : `WEST FRONTIER · WAVE ${hud.wave}`}
            </p>
          </div>
          {!isPaused && (
            <div
              className="px-3 py-1 rounded-xs font-mono text-xs font-bold tracking-wider"
              style={{
                backgroundColor: isVictory ? 'rgba(96,190,139,0.2)' : 'rgba(224,82,82,0.18)',
                color: isVictory ? '#60BE8B' : '#E05252',
              }}
            >
              {isVictory ? 'VICTORY' : 'MATCH COMPLETE'}
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Stats Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {isIsland ? (
              <>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">PLACEMENT</div>
                  <div className="text-lg font-bold font-mono text-[#52C7DE] mt-0.5">
                    #{isVictory ? 1 : hud.placement ?? br?.aliveCount ?? 1} / {br?.totalCombatants ?? 24}
                  </div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">ELIMINATIONS</div>
                  <div className="text-lg font-bold font-mono text-[#F2F4F5] mt-0.5">{hud.eliminations}</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">DAMAGE DEALT</div>
                  <div className="text-lg font-bold font-mono text-[#E9B94C] mt-0.5">{hud.damageDealt ?? 0}</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">SURVIVAL TIME</div>
                  <div className="text-lg font-bold font-mono text-[#F2F4F5] mt-0.5">
                    {formatSurvival(hud.survivalTimeSec ?? hud.matchTimeSec)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">SCORE</div>
                  <div className="text-lg font-bold font-mono text-[#52C7DE] mt-0.5">{hud.score}</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">ELIMINATIONS</div>
                  <div className="text-lg font-bold font-mono text-[#F2F4F5] mt-0.5">{hud.eliminations}</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">ACCURACY</div>
                  <div className="text-lg font-bold font-mono text-[#E9B94C] mt-0.5">{accuracy}%</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[10px] font-mono text-[#A8B0B8]">WAVE</div>
                  <div className="text-lg font-bold font-mono text-[#F2F4F5] mt-0.5">
                    {hud.wave} / {hud.endless ? 'ENDLESS' : hud.maxWaves}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Expandable Settings Drawer inside Pause */}
          {settingsOpen && (
            <div className="border border-white/12 bg-[#0D141B] rounded-xs p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex gap-2">
                  {(['graphics', 'audio', 'controls'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSettingsTab(tab)}
                      className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded-xs cursor-pointer ${
                        settingsTab === tab ? 'bg-[#52C7DE] text-[#10161D]' : 'bg-white/6 text-[#A8B0B8]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="text-[10px] font-mono text-[#A8B0B8] hover:text-[#F2F4F5] cursor-pointer"
                >
                  HIDE
                </button>
              </div>

              {settingsTab === 'graphics' && <GraphicsSettings settings={settings} onChange={onSettingsChange} />}
              {settingsTab === 'controls' && <ControlsSettings settings={settings} onChange={onSettingsChange} />}
              {settingsTab === 'audio' && (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex items-center justify-between p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
                    <span className="text-[#A8B0B8]">LOOK SENSITIVITY ({settings.sensitivity.toFixed(2)})</span>
                    <input
                      type="range"
                      min={0.35}
                      max={2.2}
                      step={0.05}
                      value={settings.sensitivity}
                      onChange={(e) => onSensitivityChange(Number(e.target.value))}
                      className="w-40 accent-[#52C7DE]"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-[#0B1117] border border-white/10 rounded-xs">
                    <span className="text-[#A8B0B8]">MASTER AUDIO</span>
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className="px-3 py-1 bg-white/10 text-[#F2F4F5] rounded-xs cursor-pointer"
                    >
                      {hud.muted ? 'UNMUTE' : 'MUTE'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Action Buttons */}
          {!confirmExitMenu ? (
            <div className="flex flex-wrap gap-2.5 pt-1">
              {isPaused && (
                <button
                  type="button"
                  onClick={onResume}
                  className="flex-1 min-w-[140px] py-2.5 px-4 bg-[#52C7DE] hover:bg-[#6DD4E8] text-[#10161D] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
                >
                  RESUME MATCH
                </button>
              )}
              {isPaused && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  className="py-2.5 px-4 bg-white/10 hover:bg-white/18 text-[#F2F4F5] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
                >
                  {settingsOpen ? 'CLOSE SETTINGS' : 'SETTINGS'}
                </button>
              )}
              {!isPaused && isIsland && hud.phase === 'gameover' && (hud.enemiesRemaining > 0) && onEnterSpectator && (
                <button
                  type="button"
                  onClick={onEnterSpectator}
                  className="py-2.5 px-4 bg-[#52C7DE] hover:bg-[#6DD4E8] text-[#10161D] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
                >
                  SPECTATE MATCH
                </button>
              )}
              {!isIsland && isVictory && !hud.endless && (
                <button
                  type="button"
                  onClick={onContinueEndless}
                  className="flex-1 min-w-[140px] py-2.5 px-4 bg-[#60BE8B] hover:bg-[#72CFA0] text-[#10161D] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
                >
                  CONTINUE ENDLESS
                </button>
              )}
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 px-4 bg-white/10 hover:bg-white/18 text-[#F2F4F5] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
              >
                {isIsland ? 'PLAY AGAIN' : 'RESTART MATCH'}
              </button>
              <button
                type="button"
                onClick={() => (isPaused ? setConfirmExitMenu(true) : onMainMenu())}
                className="py-2.5 px-4 bg-white/6 hover:bg-white/14 border border-white/12 text-[#A8B0B8] hover:text-[#F2F4F5] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
              >
                MAIN MENU
              </button>
              {nativeBridge.isNativeWinUI && (
                <button
                  type="button"
                  onClick={() => (onExitApp ? onExitApp() : nativeBridge.exitApplication())}
                  className="py-2.5 px-4 bg-[#E05252]/18 hover:bg-[#E05252]/30 border border-[#E05252]/40 text-[#E05252] font-bold tracking-wider text-xs uppercase rounded-xs cursor-pointer"
                >
                  EXIT DESKTOP
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[#171216] border border-[#E05252]/40 rounded-xs flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-[#F2F4F5]">
                ABORT ACTIVE DEPLOYMENT AND RETURN TO MAIN MENU?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmExitMenu(false)}
                  className="px-3 py-1.5 bg-white/10 text-[#F2F4F5] text-xs font-bold rounded-xs cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmExitMenu(false);
                    onMainMenu();
                  }}
                  className="px-3 py-1.5 bg-[#E05252] text-[#F2F4F5] text-xs font-bold rounded-xs cursor-pointer"
                >
                  CONFIRM QUIT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
