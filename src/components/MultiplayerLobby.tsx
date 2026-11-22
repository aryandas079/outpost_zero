import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  Play,
  LogOut,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  MultiplayerGameSettings,
  NetworkChatMessage,
  PLAYER_COLORS,
  PlayerProfile,
} from '../game/multiplayer/types';
import { getShareUrl } from '../game/multiplayer/networkManager';
import { Loadout, WEAPON_SPECS } from '../game/types';

interface MultiplayerLobbyProps {
  roomCode: string;
  isHost: boolean;
  localPlayerId: string;
  players: PlayerProfile[];
  settings: MultiplayerGameSettings;
  chatMessages: NetworkChatMessage[];
  onStartMatch: () => void;
  onToggleReady: () => void;
  onSendChat: (text: string) => void;
  onLeaveLobby: () => void;
  onOpenLoadout: (current: Loadout, onSave: (next: Loadout) => void) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomCode,
  isHost,
  localPlayerId,
  players,
  settings,
  chatMessages,
  onStartMatch,
  onToggleReady,
  onSendChat,
  onLeaveLobby,
  onOpenLoadout,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const localPlayer = players.find((p) => p.id === localPlayerId);
  const maxPlayers = settings.maxPlayers || 4;

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = getShareUrl(roomCode);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (chatInput.trim()) {
      onSendChat(chatInput);
      setChatInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center select-none bg-black/85 p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-[#0f1622]/98 border border-white/14 rounded-xl p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Simple Header: Room Code + Copy + Mode + Leave */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-black text-xl text-white font-mono tracking-wider">
              {roomCode}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 border border-amber-400/30 text-amber-300">
              {settings.mode === 'coop' ? 'Co-op' : 'Deathmatch'}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-2 py-1 bg-[#141d2b] hover:bg-[#1f2b3e] border border-white/12 rounded text-xs font-mono text-slate-300 transition-colors cursor-pointer"
            >
              {copiedCode ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-2 py-1 bg-[#141d2b] hover:bg-[#1f2b3e] border border-white/12 rounded text-xs font-mono text-slate-300 transition-colors cursor-pointer"
            >
              {copiedLink ? 'Link Copied' : 'Share Link'}
            </button>
          </div>

          <button
            type="button"
            onClick={onLeaveLobby}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded text-xs font-mono transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Players List */}
        <div>
          <div className="flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
            <span>Players ({players.length}/{maxPlayers})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: maxPlayers }).map((_, idx) => {
              const player = players[idx];
              if (player) {
                const colorSpec = PLAYER_COLORS[player.color] ?? PLAYER_COLORS.cyan;
                const isMe = player.id === localPlayerId;
                const weapon = WEAPON_SPECS[player.equippedWeapon] ?? WEAPON_SPECS.carbine;

                return (
                  <div
                    key={player.id}
                    className="bg-[#141d2b] rounded-lg p-2.5 border flex items-center justify-between transition-all"
                    style={{ borderColor: `${colorSpec.css}60` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: colorSpec.css, boxShadow: `0 0 6px ${colorSpec.css}` }}
                      />
                      <div>
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-display font-bold text-sm text-white">
                            {player.name}
                          </span>
                          {player.isHost && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-400/20 text-amber-300 font-mono">
                              Host
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[9px] font-mono text-slate-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {weapon.shortLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {player.ping > 0 && (
                        <span className="text-[10px] font-mono text-slate-500">{player.ping}ms</span>
                      )}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          player.ready || player.isHost
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {player.isHost ? 'Host' : player.ready ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`empty-${idx}`}
                  className="bg-[#0e141e]/50 border border-white/8 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-slate-500"
                >
                  <span>Slot {idx + 1}: Open</span>
                  <span className="text-[10px] text-slate-600">Waiting for player...</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simple Chat Box */}
        <div className="bg-[#0d131d] border border-white/10 rounded-lg p-2.5 flex flex-col h-32">
          <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-white/8 text-[11px] text-slate-400 font-mono">
            <MessageSquare className="w-3 h-3 text-amber-400" />
            <span>Chat</span>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs font-mono">
            {chatMessages.length === 0 ? (
              <p className="text-slate-600 italic text-[11px]">Chat is empty.</p>
            ) : (
              chatMessages.map((msg) => {
                const color = PLAYER_COLORS[msg.senderColor]?.css ?? '#ffffff';
                return (
                  <div key={msg.id} className="leading-tight">
                    {msg.system ? (
                      <span className="text-amber-400/80 text-[11px]">{msg.text}</span>
                    ) : (
                      <>
                        <span className="font-bold mr-1.5" style={{ color }}>
                          {msg.senderName}:
                        </span>
                        <span className="text-slate-200">{msg.text}</span>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2 mt-1.5 pt-1 border-t border-white/8">
            <input
              type="text"
              maxLength={80}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="flex-1 bg-[#141d2b] border border-white/12 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-[#1f2937] hover:bg-[#374151] text-slate-200 rounded text-xs font-medium cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Simple Action Footer */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (localPlayer) {
                onOpenLoadout(localPlayer.loadout, () => {});
              }
            }}
            className="px-3 py-1.5 bg-[#141d2b] hover:bg-[#1f2b3e] border border-white/12 text-slate-300 hover:text-white rounded text-xs font-mono transition-colors cursor-pointer"
          >
            Change Weapons
          </button>

          <div>
            {!isHost && (
              <button
                type="button"
                onClick={onToggleReady}
                className={`px-5 py-2 rounded font-display font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
                  localPlayer?.ready
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {localPlayer?.ready ? 'Ready (Cancel)' : 'Ready Up'}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                onClick={onStartMatch}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs tracking-wider uppercase rounded shadow transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Game</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
