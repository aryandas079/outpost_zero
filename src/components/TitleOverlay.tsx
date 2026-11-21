import React, { useState } from 'react';
import { ArrowLeft, Check, Settings, Volume2, VolumeX } from 'lucide-react';
import {
  DIFFICULTY_SPECS,
  DifficultyId,
  GameSettings,
  MAP_SPECS,
  MapId,
  MissionConfig,
} from '../game/types';

interface TitleOverlayProps {
  bestScore: number;
  settings: GameSettings;
  initialDifficulty: DifficultyId;
  initialMap: MapId;
  onStartMission: (config: MissionConfig) => void;
  onSensitivityChange: (val: number) => void;
  onToggleMute: () => void;
}

type HomeView = 'home' | 'setup' | 'settings';

const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard'];
const MAP_ORDER: MapId[] = ['west'];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  bestScore,
  settings,
  initialDifficulty,
  initialMap,
  onStartMission,
  onSensitivityChange,
  onToggleMute,
}) => {
  const [view, setView] = useState<HomeView>('home');
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [mapId, setMapId] = useState<MapId>(initialMap);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center select-none bg-[#0b1017]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 34%, rgba(245, 158, 11, 0.09) 0%, rgba(18, 26, 38, 0.65) 45%, rgba(11, 16, 23, 1) 100%)',
      }}
    >
      {/* Subtle static architectural hairline framing (no 3D map behind menu) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* =====================================================================
          1. SIMPLE HOME SCREEN: Logo + Name, Start Game, Settings, Best Score
         ===================================================================== */}
      {view === 'home' && (
        <div className="relative z-10 flex flex-col items-center text-center px-6 py-4 w-full max-w-md max-h-[96dvh] overflow-y-auto">
          {/* Game Logo + Title */}
          <div className="mb-5 sm:mb-10 w-full flex justify-center">
            <svg
              viewBox="0 0 420 112"
              className="w-full max-w-[390px] h-auto overflow-visible"
              role="img"
              aria-label="Outpost Zero"
            >
              {/* Geometric Tactical Sight Logo */}
              <g transform="translate(8, 14)">
                <polygon
                  points="22,0 44,12 44,36 22,48 0,36 0,12"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
                <polygon points="22,9 35,16 35,32 22,39 9,32 9,16" fill="#f59e0b" fillOpacity="0.18" />
                <line x1="22" y1="0" x2="22" y2="11" stroke="#f59e0b" strokeWidth="2.2" />
                <line x1="22" y1="37" x2="22" y2="48" stroke="#f59e0b" strokeWidth="2.2" />
                <circle cx="22" cy="24" r="3.5" fill="#f8fafc" />
              </g>

              {/* Display Wordmark */}
              <text
                x="68"
                y="52"
                fill="#f8fafc"
                fontFamily="Oxanium, sans-serif"
                fontWeight="800"
                fontSize="48"
                letterSpacing="3"
              >
                OUTPOST
              </text>
              <text
                x="70"
                y="96"
                fill="#f59e0b"
                fontFamily="Oxanium, sans-serif"
                fontWeight="700"
                fontSize="36"
                letterSpacing="11"
              >
                ZERO
              </text>
              <rect x="214" y="82" width="154" height="3" fill="#f59e0b" fillOpacity="0.55" />
              <rect x="376" y="82" width="24" height="3" fill="#f8fafc" fillOpacity="0.85" />
            </svg>
          </div>

          {/* Primary Actions: Start Game + Settings */}
          <div className="flex flex-col gap-3 w-full max-w-[272px] mb-8">
            <button
              type="button"
              onClick={() => setView('setup')}
              className="inline-flex items-center justify-center px-8 py-3.5 min-h-12 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base tracking-wide rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Start Game
            </button>

            <button
              type="button"
              onClick={() => setView('settings')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-11 bg-[#141c27] hover:bg-[#1b2635] border border-white/14 text-slate-100 font-medium text-sm rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span>Settings</span>
            </button>
          </div>

          {/* Best Score (Clean unboxed tabular readout) */}
          <div className="flex items-baseline gap-3 text-sm">
            <span className="text-slate-400 font-medium">Best Score</span>
            <span className="font-display font-bold text-xl text-white font-mono-num">
              {bestScore.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. MATCH SETUP SCREEN: Select Difficulty + Select Map
         ===================================================================== */}
      {view === 'setup' && (
        <div className="relative z-10 flex items-center justify-center px-4 py-3 w-full max-h-[98dvh] overflow-y-auto">
          <div className="pointer-events-auto w-full max-w-xl bg-[#10161f]/96 border border-white/14 rounded-lg p-4 sm:p-7 shadow-2xl">
            {/* Top Navigation Header */}
            <div className="flex items-center justify-between gap-4 pb-3 sm:pb-5 mb-4 sm:mb-6 border-b border-white/10">
              <div>
                <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                  Match Setup
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setView('home')}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-white/6 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>

            {/* Section 1: Select Difficulty */}
            <div className="mb-6">
              <div className="text-xs font-medium text-slate-300 mb-3">Select Difficulty</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {DIFFICULTY_ORDER.map((id) => {
                  const spec = DIFFICULTY_SPECS[id];
                  const active = difficulty === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDifficulty(id)}
                      aria-pressed={active}
                      className={`text-left px-4 py-3.5 rounded-md border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-[#161f2b] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-display font-bold text-base">{spec.label}</span>
                        {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 leading-snug">{spec.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Select Map */}
            <div className="mb-7">
              <div className="text-xs font-medium text-slate-300 mb-3">Select Map</div>
              <div className="grid grid-cols-1 gap-2.5">
                {MAP_ORDER.map((id) => {
                  const map = MAP_SPECS[id];
                  const active = mapId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMapId(id)}
                      aria-pressed={active}
                      className={`flex items-center gap-4 text-left p-4 rounded-md border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-[#161f2b] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {/* Clean Architectural Top-Down Blueprint Thumbnail of WEST */}
                      <div className="w-24 h-16 rounded bg-[#2a241b] border border-white/12 shrink-0 overflow-hidden flex items-center justify-center">
                        <svg viewBox="0 0 120 80" className="w-full h-full" aria-hidden="true">
                          <rect width="120" height="80" fill="#7c6848" />
                          {/* Main Street dirt road */}
                          <rect x="16" y="34" width="90" height="14" fill="#a28658" />
                          {/* Railroad on left */}
                          <line x1="11" y1="0" x2="11" y2="80" stroke="#3c342b" strokeWidth="3.5" strokeDasharray="2 2" />
                          <rect x="14" y="48" width="7" height="16" fill="#3a291c" />
                          {/* North buildings + Corral + Barn */}
                          <polygon points="48,10 60,10 64,17 60,24 48,24 44,17" fill="none" stroke="#c8b28c" strokeWidth="1.2" />
                          <rect x="65" y="12" width="16" height="9" fill="#382c22" />
                          <rect x="28" y="24" width="14" height="10" fill="#6b4428" />
                          <rect x="43" y="25" width="10" height="9" fill="#823428" />
                          <rect x="59" y="25" width="10" height="9" fill="#3d3024" />
                          <rect x="71" y="25" width="10" height="9" fill="#4f3b2a" />
                          <rect x="83" y="26" width="8" height="8" fill="#7c5636" />
                          {/* Water tower */}
                          <circle cx="96" cy="18" r="4" fill="#4e3824" />
                          {/* South buildings */}
                          <rect x="28" y="49" width="14" height="10" fill="#785334" />
                          <rect x="48" y="49" width="10" height="9" fill="#7e5b3a" />
                          <rect x="60" y="49" width="8" height="9" fill="#3c2c20" />
                          <rect x="70" y="49" width="11" height="10" fill="#8d3328" />
                          <rect x="83" y="50" width="8" height="9" fill="#7b5738" />
                          {/* East square row */}
                          <rect x="99" y="31" width="9" height="16" fill="#8a4c34" />
                          <rect x="99" y="50" width="9" height="9" fill="#3b2b20" />
                          <rect x="99" y="61" width="9" height="10" fill="#765234" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-baseline gap-2.5">
                            <span className="font-display font-bold text-lg tracking-wider text-white">
                              {map.name}
                            </span>
                            <span className="text-xs text-amber-300 font-medium">{map.subtitle}</span>
                          </div>
                          {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{map.details}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Launch Match Action */}
            <button
              type="button"
              onClick={() => onStartMission({ difficulty, mapId })}
              className="w-full py-3.5 min-h-12 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-base tracking-wide rounded-md transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Play {MAP_SPECS[mapId].name} · {DIFFICULTY_SPECS[difficulty].label}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. HOME SETTINGS PANEL
         ===================================================================== */}
      {view === 'settings' && (
        <div className="relative z-10 flex items-center justify-center px-4 py-3 w-full max-h-[98dvh] overflow-y-auto">
          <div className="pointer-events-auto w-full max-w-md bg-[#10161f]/96 border border-white/14 rounded-lg p-5 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between gap-4 pb-3 sm:pb-5 mb-4 sm:mb-6 border-b border-white/10">
              <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                Settings
              </h2>
              <button
                type="button"
                onClick={() => setView('home')}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 text-xs font-medium text-slate-300 hover:text-white rounded-md hover:bg-white/6 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>

            <div className="space-y-5 mb-7">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label htmlFor="home-sens-slider" className="text-slate-300 font-medium">
                    Mouse Sensitivity
                  </label>
                  <span className="font-mono-num text-amber-300 font-semibold">
                    {settings.sensitivity.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="home-sens-slider"
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
                  {settings.muted ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{settings.muted ? 'Muted' : 'Enabled'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setView('home')}
              className="w-full py-3 min-h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide rounded-md transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
