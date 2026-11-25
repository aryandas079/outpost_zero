import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Shield, Users } from 'lucide-react';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  DEFAULT_PLAYER_CALLSIGNS,
  MultiplayerGameSettings,
  PLAYER_COLORS,
  PlayerColorId,
} from '../game/multiplayer/types';
import { DifficultyId, Loadout, WEAPON_SPECS } from '../game/types';
import { DEFAULT_LOADOUT, GRENADES } from '../game/loadout';
import { parseRoomFromUrl } from '../game/multiplayer/networkManager';

interface MultiplayerMenuProps {
  onBack: () => void;
  onHostRoom: (
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
    settings: MultiplayerGameSettings,
  ) => void;
  onJoinRoom: (
    roomCode: string,
    profile: { name: string; color: PlayerColorId; loadout: Loadout },
  ) => void;
  initialLoadout?: Loadout;
  onOpenLoadout: (current: Loadout, onSave: (next: Loadout) => void) => void;
}

const COLOR_KEYS: PlayerColorId[] = ['cyan', 'amber', 'emerald', 'rose'];
const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard'];
const DIFFICULTY_LABELS: Record<DifficultyId, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({
  onBack,
  onHostRoom,
  onJoinRoom,
  initialLoadout = DEFAULT_LOADOUT,
  onOpenLoadout,
}) => {
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [callsign, setCallsign] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('opz_player_name') : null;
    return saved || DEFAULT_PLAYER_CALLSIGNS[Math.floor(Math.random() * DEFAULT_PLAYER_CALLSIGNS.length)];
  });
  const [color, setColor] = useState<PlayerColorId>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('opz_player_color') as PlayerColorId) : null;
    return saved && PLAYER_COLORS[saved] ? saved : 'amber';
  });
  const [loadout, setLoadout] = useState<Loadout>(initialLoadout);
  const [joinCode, setJoinCode] = useState('');
  const [settings, setSettings] = useState<MultiplayerGameSettings>({ ...DEFAULT_MULTIPLAYER_SETTINGS });

  useEffect(() => {
    const fromUrl = parseRoomFromUrl();
    if (fromUrl) {
      setJoinCode(fromUrl);
      setTab('join');
    }
  }, []);

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
    onHostRoom({ name: callsign, color, loadout }, settings);
  };

  const handleJoin = () => {
    saveProfileLocally();
    const clean = joinCode.trim();
    if (clean) {
      onJoinRoom(clean, { name: callsign, color, loadout });
    }
  };

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center select-none bg-[#090d13] p-4 overflow-y-auto"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 75% 60% at 50% 18%, rgba(30, 42, 60, 0.42) 0%, rgba(12, 17, 25, 0.9) 58%, #070a0f 100%)',
      }}
    >
      <div className="w-full max-w-lg bg-[#0e131b] border border-white/12 rounded-xl p-6 shadow-[0_24px_64px_rgba(0,0,0,0.8)] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div>
            <p className="text-[11px] font-mono tracking-[0.2em] text-[#f5b301] uppercase mb-0.5">
              SQUAD OPERATIONS
            </p>
            <h2 className="font-display font-extrabold text-2xl text-white uppercase tracking-wide">
              Multiplayer
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151c26] hover:bg-[#1e2836] border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Host vs Join Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-[#131922] p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => setTab('host')}
            className={`py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === 'host'
                ? 'bg-[#f5b301] text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Host Squad
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 rounded-md text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer ${
              tab === 'join'
                ? 'bg-[#f5b301] text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Join Squad
          </button>
        </div>

        {/* Operative Profile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
              Callsign
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                maxLength={14}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                className="flex-1 bg-[#131922] border border-white/12 focus:border-[#f5b301] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                placeholder="Nomad-6"
              />
              <button
                type="button"
                onClick={handleRandomizeCallsign}
                title="Randomize Callsign"
                className="px-2.5 py-2 bg-[#151c26] hover:bg-[#1f2937] border border-white/12 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
              Squad Tag Color
            </label>
            <div className="flex gap-2 items-center h-[36px] px-2 bg-[#131922] border border-white/10 rounded-lg">
              {COLOR_KEYS.map((k) => {
                const spec = PLAYER_COLORS[k];
                const selected = color === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setColor(k)}
                    aria-label={`Select ${k} squad color`}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer ${
                      selected ? 'ring-2 ring-white scale-110' : 'opacity-65 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: spec.css }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Loadout Strip */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#131922] border border-white/10 rounded-lg text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Shield className="w-4 h-4 text-[#f5b301] shrink-0" />
            <div className="truncate">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Equipped Loadout</span>
              <span className="text-slate-100 font-medium">
                {WEAPON_SPECS[loadout.primary[0]].shortLabel} · {WEAPON_SPECS[loadout.sidearm].shortLabel} · {GRENADES[loadout.grenade].name}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenLoadout(loadout, (next) => setLoadout(next))}
            className="text-[#f5b301] hover:text-[#ffc11a] font-mono text-xs font-semibold cursor-pointer shrink-0 ml-2"
          >
            Edit
          </button>
        </div>

        {/* HOST OPTIONS */}
        {tab === 'host' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
                Operation Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, mode: 'coop' })}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-display font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    settings.mode === 'coop'
                      ? 'bg-[#f5b301]/15 border-[#f5b301] text-[#f5b301]'
                      : 'bg-[#131922] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Co-op Survival
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, mode: 'deathmatch' })}
                  className={`py-2.5 px-3 rounded-lg border text-xs font-display font-bold uppercase tracking-wide transition-all cursor-pointer ${
                    settings.mode === 'deathmatch'
                      ? 'bg-[#f5b301]/15 border-[#f5b301] text-[#f5b301]'
                      : 'bg-[#131922] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  PvP Deathmatch
                </button>
              </div>
            </div>

            {settings.mode === 'coop' ? (
              <div>
                <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTY_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSettings({ ...settings, difficulty: id })}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        settings.difficulty === id
                          ? 'bg-[#f5b301] border-[#f5b301] text-slate-950 font-bold'
                          : 'bg-[#131922] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {DIFFICULTY_LABELS[id]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
                  Score Limit
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 25].map((kills) => (
                    <button
                      key={kills}
                      type="button"
                      onClick={() => setSettings({ ...settings, killLimit: kills })}
                      className={`py-2 rounded-lg border text-xs font-mono-num font-semibold transition-all cursor-pointer ${
                        settings.killLimit === kills
                          ? 'bg-[#f5b301] border-[#f5b301] text-slate-950 font-bold'
                          : 'bg-[#131922] border-white/10 text-slate-300 hover:text-white'
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
              className="w-full h-12 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-sm tracking-wider uppercase rounded-lg shadow-[0_4px_20px_rgba(245,179,1,0.28)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>Create Squad Lobby</span>
            </button>
          </div>
        )}

        {/* JOIN OPTIONS */}
        {tab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] text-slate-400 font-mono uppercase mb-1.5">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. OPZ-7K2X"
                className="w-full bg-[#131922] border border-white/15 focus:border-[#f5b301] rounded-lg px-4 py-3 text-base font-mono tracking-[0.25em] text-white uppercase focus:outline-none text-center"
              />
            </div>

            <button
              type="button"
              disabled={!joinCode.trim()}
              onClick={handleJoin}
              className={`w-full h-12 font-display font-extrabold text-sm tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${
                joinCode.trim()
                  ? 'bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 shadow-[0_4px_20px_rgba(245,179,1,0.28)] cursor-pointer'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Connect to Squad</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
