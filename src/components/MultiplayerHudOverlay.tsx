import React, { useState, useEffect } from 'react';
import { Trophy, Skull } from 'lucide-react';
import { PLAYER_COLORS } from '../game/multiplayer/types';
import { MultiplayerHudPlayer, MultiplayerHudSnapshot } from '../game/types';

interface MultiplayerHudOverlayProps {
  multiplayer: MultiplayerHudSnapshot;
  localPlayerId: string;
}

export const MultiplayerHudOverlay: React.FC<MultiplayerHudOverlayProps> = ({
  multiplayer,
  localPlayerId,
}) => {
  const [showScoreboard, setShowScoreboard] = useState(false);

  // Tab key listener for toggling the tactical scoreboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sortedPlayers: MultiplayerHudPlayer[] = [...multiplayer.players].sort((a, b) => {
    if (multiplayer.mode === 'deathmatch') {
      return b.kills - a.kills || b.score - a.score;
    }
    return b.score - a.score || b.kills - a.kills;
  });

  return (
    <>
      {/* Top Left Teammates Status Strip (Docked directly beneath match status badge) */}
      <div className="absolute top-24 sm:top-28 left-4 z-20 flex flex-col gap-1.5 pointer-events-none select-none max-w-[220px]">
        {multiplayer.players.map((p: MultiplayerHudPlayer) => {
          const colorSpec = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.cyan;
          const isMe = p.id === localPlayerId;
          const healthFrac = Math.max(0, Math.min(1, p.health / Math.max(1, p.maxHealth)));
          const shieldFrac = Math.max(0, Math.min(1, p.shield / Math.max(1, p.maxShield)));

          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-1 rounded bg-[#0b121b]/88 border text-[11px] font-mono shadow-md transition-all ${
                !p.alive ? 'opacity-40 grayscale' : ''
              }`}
              style={{ borderColor: `${colorSpec.css}50` }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: colorSpec.css, boxShadow: `0 0 6px ${colorSpec.css}` }}
              />
              <div className="flex-1 min-w-[70px]">
                <div className="flex items-center justify-between leading-tight mb-0.5">
                  <span className={`font-bold truncate max-w-[95px] ${isMe ? 'text-amber-300' : 'text-white'}`}>
                    {p.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold ml-1">
                    {p.kills}K
                  </span>
                </div>
                {/* Health & Shield Bar with angled tip */}
                <div className="w-full h-1.5 bg-black/60 rounded-[1px] overflow-hidden flex">
                  {shieldFrac > 0 && (
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${shieldFrac * 35}%` }}
                    />
                  )}
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${healthFrac * 65}%`,
                      backgroundColor: healthFrac > 0.4 ? colorSpec.css : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deathmatch Respawn Screen Overlay */}
      {multiplayer.respawnTimer && multiplayer.respawnTimer > 0 && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs select-none pointer-events-none">
          <div className="text-center p-5 bg-[#101722]/95 border border-rose-500/40 rounded-lg max-w-xs shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto mb-2 text-rose-400">
              <Skull className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="font-display font-bold text-lg uppercase tracking-wider text-white mb-0.5">
              Operative Down
            </h3>
            <p className="text-[11px] text-slate-400 mb-3 font-mono">
              Redeploying to secure sector...
            </p>
            <div className="text-2xl font-mono font-bold text-amber-400">
              {Math.ceil(multiplayer.respawnTimer)}s
            </div>
          </div>
        </div>
      )}

      {/* Tactical Scoreboard (Toggled with Tab) */}
      {showScoreboard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none">
          <div className="w-full max-w-lg bg-[#0e1520]/95 border border-white/15 rounded-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-base text-white tracking-wide uppercase">
                  Squad Standings · {multiplayer.mode === 'coop' ? 'Co-op Defense' : 'Deathmatch'}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">[TAB] to close</span>
            </div>

            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-white/10 text-left">
                  <th className="pb-2">Operative</th>
                  <th className="pb-2 text-center">Score</th>
                  <th className="pb-2 text-center">Kills</th>
                  <th className="pb-2 text-center">Deaths</th>
                  <th className="pb-2 text-right">Ping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedPlayers.map((p, idx) => {
                  const spec = PLAYER_COLORS[p.color] ?? PLAYER_COLORS.cyan;
                  const isMe = p.id === localPlayerId;
                  return (
                    <tr key={p.id} className={isMe ? 'bg-amber-400/10' : ''}>
                      <td className="py-2.5 flex items-center gap-2">
                        <span className="font-bold text-slate-400 w-3">{idx + 1}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: spec.css }}
                        />
                        <span className={`font-bold ${isMe ? 'text-amber-300' : 'text-white'}`}>
                          {p.name}
                        </span>
                        {isMe && <span className="text-[10px] text-amber-400/80">(You)</span>}
                      </td>
                      <td className="py-2.5 text-center text-white font-bold">{p.score}</td>
                      <td className="py-2.5 text-center text-emerald-400 font-bold">{p.kills}</td>
                      <td className="py-2.5 text-center text-rose-400">{p.deaths}</td>
                      <td className="py-2.5 text-right text-slate-400">{p.ping}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
