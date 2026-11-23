import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Info,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DifficultyId,
  GameSettings,
  GrenadeId,
  Loadout,
  MapId,
  MAP_SPECS,
  MissionConfig,
  WeaponId,
  WEAPON_SPECS,
} from '../game/types';
import {
  DEFAULT_LOADOUT,
  GRENADES,
  LAUNCHERS,
  PRIMARY_WEAPONS,
  SIDEARMS,
} from '../game/loadout';
import {
  AUDIO_DYNAMIC_RANGE_ORDER,
  AUDIO_DYNAMIC_RANGE_PRESETS,
  getAudioDynamicRangeSpec,
} from '../game/audioCompression';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  DEFAULT_PLAYER_CALLSIGNS,
  MultiplayerGameSettings,
  PLAYER_COLORS,
  PlayerColorId,
} from '../game/multiplayer/types';
import { parseRoomFromUrl } from '../game/multiplayer/networkManager';
import { GraphicsSettings } from './GraphicsSettings';
import { ControlsSettings } from './ControlsSettings';
import { toAssetUrl } from '../utils/assets';
import { WeaponCardVisual } from './WeaponSilhouette';

interface TitleOverlayProps {
  bestScore: number;
  settings: GameSettings;
  initialDifficulty: DifficultyId;
  initialMap: MapId;
  initialLoadout?: Loadout;
  initialSection?: MainMenuSection;
  onStartMission: (config: MissionConfig) => void;
  onSensitivityChange: (val: number) => void;
  onToggleMute: () => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
  onOpenMultiplayer?: () => void;
  onHostRoom?: (
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
    settings: MultiplayerGameSettings,
  ) => void;
  onJoinRoom?: (
    roomCode: string,
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
  ) => void;
  onLoadoutChange?: (loadout: Loadout) => void;
}

export type MainMenuSection = 'solo' | 'multiplayer' | 'armory' | 'settings' | 'intel';

const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard'];
const DIFFICULTY_LABELS: Record<DifficultyId, string> = {
  easy: 'Easy',
  normal: 'Medium',
  hard: 'Hard',
};

const COLOR_KEYS: PlayerColorId[] = ['cyan', 'amber', 'emerald', 'rose'];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  bestScore,
  settings,
  initialDifficulty,
  initialMap,
  initialLoadout = DEFAULT_LOADOUT,
  initialSection = 'solo',
  onStartMission,
  onSensitivityChange,
  onToggleMute,
  onSettingsChange,
  onOpenMultiplayer,
  onHostRoom,
  onJoinRoom,
  onLoadoutChange,
}) => {
  const [activeSection, setActiveSection] = useState<MainMenuSection>(initialSection);

  // Solo Mission state
  const [difficulty, setDifficulty] = useState<DifficultyId>(initialDifficulty);
  const [endlessMode, setEndlessMode] = useState(false);
  const mapId = initialMap;

  // Loadout state
  const [loadout, setLoadout] = useState<Loadout>(initialLoadout);

  // Armory state
  const [armoryTab, setArmoryTab] = useState<'primary' | 'sidearm' | 'launcher' | 'grenades'>('primary');
  const [editingPrimarySlot, setEditingPrimarySlot] = useState<0 | 1>(0);

  // Settings sub-tab state
  const [settingsTab, setSettingsTab] = useState<'audio' | 'graphics' | 'controls'>('audio');

  // Multiplayer state
  const [multiplayerTab, setMultiplayerTab] = useState<'host' | 'join'>('host');
  const [callsign, setCallsign] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('opz_player_name') : null;
    return saved || DEFAULT_PLAYER_CALLSIGNS[Math.floor(Math.random() * DEFAULT_PLAYER_CALLSIGNS.length)];
  });
  const [color, setColor] = useState<PlayerColorId>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('opz_player_color') as PlayerColorId) : null;
    return saved && PLAYER_COLORS[saved] ? saved : 'cyan';
  });
  const [joinCode, setJoinCode] = useState('');
  const [networkSettings, setNetworkSettings] = useState<MultiplayerGameSettings>({ ...DEFAULT_MULTIPLAYER_SETTINGS });

  // Auto-detect room from URL
  useEffect(() => {
    const fromUrl = parseRoomFromUrl();
    if (fromUrl) {
      setJoinCode(fromUrl);
      setActiveSection('multiplayer');
      setMultiplayerTab('join');
    }
  }, []);

  const handleUpdateLoadout = (next: Loadout) => {
    setLoadout(next);
    onLoadoutChange?.(next);
  };

  const handleChoosePrimary = (weaponId: WeaponId) => {
    const updated = [...loadout.primary] as [WeaponId, WeaponId];
    const existingIdx = updated.indexOf(weaponId);
    if (existingIdx !== -1) {
      [updated[editingPrimarySlot], updated[existingIdx]] = [updated[existingIdx], updated[editingPrimarySlot]];
    } else {
      updated[editingPrimarySlot] = weaponId;
    }
    const next = { ...loadout, primary: updated };
    handleUpdateLoadout(next);
    setEditingPrimarySlot(editingPrimarySlot === 0 ? 1 : 0);
  };

  const handleRandomizeCallsign = () => {
    const next = DEFAULT_PLAYER_CALLSIGNS[Math.floor(Math.random() * DEFAULT_PLAYER_CALLSIGNS.length)];
    setCallsign(next);
  };

  const saveProfileLocally = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('opz_player_name', callsign);
      localStorage.setItem('opz_player_color', color);
    }
  };

  const handleHost = () => {
    saveProfileLocally();
    if (onHostRoom) {
      onHostRoom({ name: callsign, color, loadout }, networkSettings);
    } else {
      onOpenMultiplayer?.();
    }
  };

  const handleJoin = () => {
    saveProfileLocally();
    const clean = joinCode.trim();
    if (clean) {
      if (onJoinRoom) {
        onJoinRoom(clean, { name: callsign, color, loadout });
      } else {
        onOpenMultiplayer?.();
      }
    }
  };

  const handleDeploySolo = () => {
    onStartMission({
      difficulty,
      mapId,
      loadout,
    });
  };

  useEffect(() => {
    if (activeSection !== 'solo') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartMission({
          difficulty,
          mapId,
          loadout,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSection, difficulty, mapId, loadout, onStartMission]);

  const playerColorSpec = PLAYER_COLORS[color] ?? PLAYER_COLORS.cyan;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#080d14] text-slate-100 select-none overflow-hidden">
      {/* =====================================================================
          SIMPLE TOP NAVIGATION HEADER
          ===================================================================== */}
      <header className="shrink-0 h-14 border-b border-white/10 bg-[#0d1420] px-4 sm:px-6 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 font-display font-black text-sm">
            Ø
          </div>
          <span className="font-display font-black text-sm tracking-wider text-white">
            OUTPOST ZERO
          </span>
          {typeof window !== 'undefined' && window.electronAPI?.isElectron ? (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
              WINDOWS APP
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-white/5 text-slate-400 border border-white/10">
              BROWSER
            </span>
          )}
        </div>

        {/* Section Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Main Menu Sections">
          <button
            type="button"
            onClick={() => setActiveSection('solo')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-display font-bold transition-all cursor-pointer ${
              activeSection === 'solo'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Solo
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('multiplayer')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-display font-bold transition-all cursor-pointer ${
              activeSection === 'multiplayer'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Multiplayer
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('armory')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-display font-bold transition-all cursor-pointer ${
              activeSection === 'armory'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Armory
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-display font-bold transition-all cursor-pointer ${
              activeSection === 'settings'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {bestScore > 0 && (
            <span className="hidden sm:inline-block text-xs font-mono text-amber-300">
              Best: {bestScore.toLocaleString()}
            </span>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
            className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
          >
            {settings.muted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* =====================================================================
          MAIN SECTION CONTENT
          ===================================================================== */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
        {/* ===================================================================
            SECTION 1: SOLO MISSION (SIMPLE: EASY / MEDIUM / HARD)
            =================================================================== */}
        {activeSection === 'solo' && (
          <div className="w-full max-w-md bg-[#0f1622]/98 border border-white/12 rounded-xl p-5 shadow-2xl space-y-5 animate-fadeIn">
            <div>
              <h2 className="font-display font-bold text-xl text-white">Solo Mission</h2>
            </div>

            {/* Simple Difficulty: Easy, Medium, Hard */}
            <div>
              <label className="block text-xs text-slate-400 font-mono mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_ORDER.map((id) => {
                  const selected = difficulty === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDifficulty(id)}
                      className={`py-3 px-2 rounded-lg border font-display font-bold text-sm text-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                          : 'bg-[#141d2b] border-white/12 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      {DIFFICULTY_LABELS[id]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simple Mode: 5 Waves vs Endless */}
            <div>
              <label className="block text-xs text-slate-400 font-mono mb-2">Game Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEndlessMode(false)}
                  className={`py-2.5 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                    !endlessMode
                      ? 'bg-white/15 border-white text-white shadow'
                      : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Standard (5 Waves)
                </button>
                <button
                  type="button"
                  onClick={() => setEndlessMode(true)}
                  className={`py-2.5 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                    endlessMode
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow'
                      : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Endless Survival
                </button>
              </div>
            </div>

            {/* Simple Loadout Preview */}
            <div className="p-3 bg-[#141d2b] border border-white/10 rounded-lg flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Loadout</span>
                <span className="text-white font-semibold">
                  {WEAPON_SPECS[loadout.primary[0]].shortLabel} · {WEAPON_SPECS[loadout.primary[1]].shortLabel} · {GRENADES[loadout.grenade].name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('armory')}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Deploy Action */}
            <button
              type="button"
              data-start="true"
              onClick={handleDeploySolo}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base tracking-wider uppercase rounded-lg shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Crosshair className="w-5 h-5" />
              <span>Start Mission</span>
            </button>
          </div>
        )}

        {/* ===================================================================
            SECTION 2: MULTIPLAYER (SIMPLE: NAME, COLOR, MODE, START/JOIN)
            =================================================================== */}
        {activeSection === 'multiplayer' && (
          <div className="w-full max-w-md bg-[#0f1622]/98 border border-white/12 rounded-xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            {/* Simple Top Tabs: Host vs Join */}
            <div className="flex border-b border-white/12">
              <button
                type="button"
                onClick={() => setMultiplayerTab('host')}
                className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  multiplayerTab === 'host'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Host Match
              </button>
              <button
                type="button"
                onClick={() => setMultiplayerTab('join')}
                className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  multiplayerTab === 'join'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Join Match
              </button>
            </div>

            {/* Simple Operative Info */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 font-mono mb-1">Callsign</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    maxLength={14}
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    className="flex-1 bg-[#141d2b] border border-white/15 focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                    placeholder="Name"
                  />
                  <button
                    type="button"
                    onClick={handleRandomizeCallsign}
                    title="Randomize"
                    className="px-2 py-1.5 bg-[#1a2536] border border-white/12 rounded text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-mono mb-1">Color</label>
                <div className="flex gap-1.5 items-center h-[34px]">
                  {COLOR_KEYS.map((k) => {
                    const spec = PLAYER_COLORS[k];
                    const selected = color === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setColor(k)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          selected ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: spec.css }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* HOST OPTIONS */}
            {multiplayerTab === 'host' && (
              <div className="space-y-4 pt-1">
                {/* Simple Mode: Co-op vs Deathmatch */}
                <div>
                  <label className="block text-[11px] text-slate-400 font-mono mb-1.5">Game Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNetworkSettings({ ...networkSettings, mode: 'coop' })}
                      className={`py-2 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                        networkSettings.mode === 'coop'
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow'
                          : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Co-op Survival
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetworkSettings({ ...networkSettings, mode: 'deathmatch' })}
                      className={`py-2 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                        networkSettings.mode === 'deathmatch'
                          ? 'bg-rose-400/20 border-rose-400 text-rose-300 shadow'
                          : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      PvP Deathmatch
                    </button>
                  </div>
                </div>

                {/* Simple Settings: Easy / Medium / Hard */}
                {networkSettings.mode === 'coop' ? (
                  <div>
                    <label className="block text-[11px] text-slate-400 font-mono mb-1.5">Difficulty</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DIFFICULTY_ORDER.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNetworkSettings({ ...networkSettings, difficulty: id })}
                          className={`py-2 rounded border font-mono text-xs font-semibold transition-all cursor-pointer ${
                            networkSettings.difficulty === id
                              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                              : 'bg-[#141d2b] border-white/10 text-slate-400'
                          }`}
                        >
                          {DIFFICULTY_LABELS[id]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-slate-400 font-mono mb-1.5">Score Limit</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[10, 15, 25].map((kills) => (
                        <button
                          key={kills}
                          type="button"
                          onClick={() => setNetworkSettings({ ...networkSettings, killLimit: kills })}
                          className={`py-2 rounded border font-mono text-xs font-semibold transition-all cursor-pointer ${
                            networkSettings.killLimit === kills
                              ? 'bg-rose-400/20 border-rose-400 text-rose-300'
                              : 'bg-[#141d2b] border-white/10 text-slate-400'
                          }`}
                        >
                          {kills} Kills
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleHost}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wider uppercase rounded-lg shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Create Squad Lobby</span>
                </button>
              </div>
            )}

            {/* JOIN OPTIONS */}
            {multiplayerTab === 'join' && (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 font-mono mb-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. OPZ-7K2X"
                    className="w-full bg-[#141d2b] border-2 border-white/15 focus:border-cyan-400 rounded-lg px-3 py-2.5 text-base font-mono tracking-widest text-white uppercase focus:outline-none text-center"
                  />
                </div>

                <button
                  type="button"
                  disabled={!joinCode.trim()}
                  onClick={handleJoin}
                  className={`w-full py-3 font-display font-bold text-sm tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${
                    joinCode.trim()
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow cursor-pointer'
                      : 'bg-white/10 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Connect to Squad</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            SECTION 3: ARMORY (SIMPLE: PRIMARY, SIDEARM, LAUNCHER, GRENADES)
            =================================================================== */}
        {activeSection === 'armory' && (
          <div className="w-full max-w-2xl bg-[#0f1622]/98 border border-white/12 rounded-xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h2 className="font-display font-bold text-lg text-white">Armory</h2>
              <button
                type="button"
                onClick={() => setActiveSection('solo')}
                className="text-xs font-display font-bold px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded cursor-pointer"
              >
                Done
              </button>
            </div>

            {/* Simple Category Tabs */}
            <div className="grid grid-cols-4 gap-1 border-b border-white/10 pb-2">
              <button
                type="button"
                onClick={() => setArmoryTab('primary')}
                className={`py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                  armoryTab === 'primary' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                Primary
              </button>
              <button
                type="button"
                onClick={() => setArmoryTab('sidearm')}
                className={`py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                  armoryTab === 'sidearm' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                Sidearm
              </button>
              <button
                type="button"
                onClick={() => setArmoryTab('launcher')}
                className={`py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                  armoryTab === 'launcher' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                Launcher
              </button>
              <button
                type="button"
                onClick={() => setArmoryTab('grenades')}
                className={`py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                  armoryTab === 'grenades' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-400'
                }`}
              >
                Grenade
              </button>
            </div>

            {/* PRIMARY WEAPONS */}
            {armoryTab === 'primary' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {loadout.primary.map((id, index) => {
                    const active = editingPrimarySlot === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEditingPrimarySlot(index as 0 | 1)}
                        className={`p-2 rounded border text-left cursor-pointer ${
                          active
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                            : 'bg-[#141d2b] border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-[10px] block font-mono">Slot {index + 1}</span>
                        <span className="text-xs font-bold text-white font-display">
                          {WEAPON_SPECS[id].shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRIMARY_WEAPONS.map((id) => {
                    const spec = WEAPON_SPECS[id];
                    const isSelected = loadout.primary[editingPrimarySlot] === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleChoosePrimary(id)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 shadow'
                            : 'bg-[#141d2b] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="h-12 flex items-center justify-center mb-1">
                          <WeaponCardVisual
                            weaponId={id}
                            alt={spec.name}
                            imageUrl={toAssetUrl(`weapons/${id}.png`)}
                          />
                        </div>
                        <span className="text-xs font-display font-bold text-white">
                          {spec.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SIDEARMS */}
            {armoryTab === 'sidearm' && (
              <div className="grid grid-cols-3 gap-2">
                {SIDEARMS.map((id) => {
                  const spec = WEAPON_SPECS[id];
                  const selected = loadout.sidearm === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleUpdateLoadout({ ...loadout, sidearm: id })}
                      className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${
                        selected
                          ? 'bg-amber-500/20 border-amber-400 shadow'
                          : 'bg-[#141d2b] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="h-14 flex items-center justify-center mb-1">
                        <WeaponCardVisual
                          weaponId={id}
                          alt={spec.name}
                          imageUrl={toAssetUrl(`weapons/${id}.png`)}
                        />
                      </div>
                      <span className="text-xs font-display font-bold text-white">
                        {spec.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* LAUNCHERS */}
            {armoryTab === 'launcher' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {LAUNCHERS.map((id) => {
                    const spec = WEAPON_SPECS[id];
                    const selected = loadout.launcher === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleUpdateLoadout({ ...loadout, launcher: id })}
                        className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${
                          selected
                            ? 'bg-amber-500/20 border-amber-400 shadow'
                            : 'bg-[#141d2b] border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="h-14 flex items-center justify-center mb-1">
                          <WeaponCardVisual
                            weaponId={id}
                            alt={spec.name}
                            imageUrl={toAssetUrl(`weapons/${id}.png`)}
                          />
                        </div>
                        <span className="text-xs font-display font-bold text-white">
                          {spec.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateLoadout({ ...loadout, launcher: null })}
                  className={`w-full py-2 rounded text-xs font-mono transition-colors cursor-pointer ${
                    loadout.launcher === null
                      ? 'bg-amber-400/20 border border-amber-400 text-amber-300 font-bold'
                      : 'bg-[#141d2b] border border-white/10 text-slate-400'
                  }`}
                >
                  No Launcher (Faster Sprint)
                </button>
              </div>
            )}

            {/* GRENADES */}
            {armoryTab === 'grenades' && (
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(GRENADES) as GrenadeId[]).map((id) => {
                  const spec = GRENADES[id];
                  const selected = loadout.grenade === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleUpdateLoadout({ ...loadout, grenade: id })}
                      className={`p-2.5 rounded-lg border text-center cursor-pointer transition-all ${
                        selected
                          ? 'bg-amber-500/20 border-amber-400 shadow'
                          : 'bg-[#141d2b] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="h-12 flex items-center justify-center mb-1">
                        <WeaponCardVisual
                          weaponId={id}
                          alt={spec.name}
                          imageUrl={toAssetUrl(`weapons/${id}.png`)}
                        />
                      </div>
                      <span className="text-xs font-display font-bold text-white">
                        {spec.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            SECTION 4: SETTINGS (SIMPLE: SENSITIVITY, SOUND, GRAPHICS, KEYS)
            =================================================================== */}
        {activeSection === 'settings' && (
          <div className="w-full max-w-md bg-[#0f1622]/98 border border-white/12 rounded-xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            <h2 className="font-display font-bold text-lg text-white">Settings</h2>

            {/* Simple Sub-tabs */}
            <div className="flex border-b border-white/10 pb-1">
              <button
                type="button"
                onClick={() => setSettingsTab('audio')}
                className={`flex-1 py-1 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settingsTab === 'audio' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
                }`}
              >
                Aim & Audio
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('graphics')}
                className={`flex-1 py-1 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settingsTab === 'graphics' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
                }`}
              >
                Graphics
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('controls')}
                className={`flex-1 py-1 text-xs font-mono font-semibold transition-all cursor-pointer ${
                  settingsTab === 'controls' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-slate-400'
                }`}
              >
                Keybindings
              </button>
            </div>

            {settingsTab === 'audio' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#141d2b] border border-white/10 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Mouse Sensitivity</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {settings.sensitivity.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    value={settings.sensitivity}
                    onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1.5"
                  />
                </div>

                <div className="p-3 bg-[#141d2b] border border-white/10 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Sound Effects</span>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className="px-3 py-1 rounded border font-mono transition-colors cursor-pointer"
                    style={{
                      backgroundColor: !settings.muted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      borderColor: !settings.muted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                      color: !settings.muted ? '#6ee7b7' : '#fca5a5',
                    }}
                  >
                    {!settings.muted ? 'Enabled' : 'Muted'}
                  </button>
                </div>

                {(() => {
                  const activeDrc = getAudioDynamicRangeSpec(settings.audioDynamicRange);
                  const footstepPct = Math.round((activeDrc.subtleCueGain - 1) * 100);
                  return (
                    <div className="p-3 bg-[#141d2b] border border-white/10 rounded-lg space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-300 font-medium">Dynamic Range Compression</span>
                        <span className="font-mono text-[11px] text-cyan-300 font-bold uppercase">
                          {activeDrc.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Dynamic Range Compression">
                        {AUDIO_DYNAMIC_RANGE_ORDER.map((presetId) => {
                          const spec = AUDIO_DYNAMIC_RANGE_PRESETS[presetId];
                          const active = activeDrc.id === presetId;
                          return (
                            <button
                              key={presetId}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => onSettingsChange({ audioDynamicRange: presetId })}
                              className={`py-1.5 px-2 rounded-md font-mono text-[11px] font-bold transition-all cursor-pointer ${
                                active
                                  ? 'bg-amber-400 text-slate-950 shadow'
                                  : 'bg-[#0d131d] text-slate-400 hover:text-white border border-white/10'
                              }`}
                            >
                              {spec.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {activeDrc.description}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-white/8 text-[10px] font-mono text-slate-400">
                        <span>Threshold {activeDrc.thresholdDb} dB · {activeDrc.ratio}:1</span>
                        <span className="text-emerald-300">
                          Footsteps {footstepPct > 0 ? `+${footstepPct}%` : 'Natural'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {settingsTab === 'graphics' && (
              <GraphicsSettings settings={settings} onChange={onSettingsChange} />
            )}

            {settingsTab === 'controls' && (
              <ControlsSettings settings={settings} onChange={onSettingsChange} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};
