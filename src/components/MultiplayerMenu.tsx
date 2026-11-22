import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, RefreshCw } from 'lucide-react';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  DEFAULT_PLAYER_CALLSIGNS,
  MultiplayerGameSettings,
  PLAYER_COLORS,
  PlayerColorId,
} from '../game/multiplayer/types';
import { DifficultyId, Loadout } from '../game/types';
import { DEFAULT_LOADOUT } from '../game/loadout';
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
  normal: 'Medium',
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
    return saved && PLAYER_COLORS[saved] ? saved : 'cyan';
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
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center select-none bg-black/85 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#0f1622]/98 border border-white/14 rounded-xl p-5 shadow-2xl space-y-4 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <h2 className="font-display font-bold text-lg text-white">Multiplayer</h2>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Top Tabs: Host vs Join */}
        <div className="flex border-b border-white/12">
          <button
            type="button"
            onClick={() => setTab('host')}
            className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              tab === 'host'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Host Match
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              tab === 'join'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Join Match
          </button>
        </div>

        {/* Operative Info */}
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
        {tab === 'host' && (
          <div className="space-y-3.5 pt-1">
            {/* Mode: Co-op vs Deathmatch */}
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1.5">Game Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, mode: 'coop' })}
                  className={`py-2 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                    settings.mode === 'coop'
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow'
                      : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  Co-op Survival
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, mode: 'deathmatch' })}
                  className={`py-2 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                    settings.mode === 'deathmatch'
                      ? 'bg-rose-400/20 border-rose-400 text-rose-300 shadow'
                      : 'bg-[#141d2b] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  PvP Deathmatch
                </button>
              </div>
            </div>

            {/* Simple Settings: Easy / Medium / Hard */}
            {settings.mode === 'coop' ? (
              <div>
                <label className="block text-[11px] text-slate-400 font-mono mb-1.5">Difficulty</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIFFICULTY_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSettings({ ...settings, difficulty: id })}
                      className={`py-2 rounded border font-mono text-xs font-semibold transition-all cursor-pointer ${
                        settings.difficulty === id
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
                      onClick={() => setSettings({ ...settings, killLimit: kills })}
                      className={`py-2 rounded border font-mono text-xs font-semibold transition-all cursor-pointer ${
                        settings.killLimit === kills
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
        {tab === 'join' && (
          <div className="space-y-3.5 pt-1">
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Room Code</label>
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
    </div>
  );
};
