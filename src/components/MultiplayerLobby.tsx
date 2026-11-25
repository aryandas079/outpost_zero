import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  MessageSquare,
  Play,
  Send,
  UserPlus,
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
      // Clipboard blocked in iframe
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = getShareUrl(roomCode);
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in iframe
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
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-center select-none bg-[#090d13] p-4 overflow-y-auto"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 75% 60% at 50% 18%, rgba(30, 42, 60, 0.42) 0%, rgba(12, 17, 25, 0.9) 58%, #070a0f 100%)',
      }}
    >
      <div className="w-full max-w-2xl bg-[#0e131b] border border-white/12 rounded-xl p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.82)] space-y-5">
        {/* Lobby Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400">
                {settings.mode === 'coop' ? 'Co-op Survival' : 'PvP Deathmatch'} · Room Code
              </span>
              <span className="font-display font-extrabold text-2xl text-white font-mono-num tracking-wider">
                {roomCode}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#151c26] hover:bg-[#1e2836] border border-white/12 rounded-lg text-xs font-mono text-slate-200 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#151c26] hover:bg-[#1e2836] border border-white/12 rounded-lg text-xs font-mono text-slate-200 transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedLink ? 'Link Copied' : 'Invite Link'}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onLeaveLobby}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-mono transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* Party Roster */}
        <div>
          <div className="flex items-center justify-between mb-2.5 text-xs font-mono text-slate-400 uppercase tracking-wider">
            <span>Party Roster</span>
            <span className="font-mono-num text-slate-300">
              {players.length} / {maxPlayers}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: maxPlayers }).map((_, idx) => {
              const player = players[idx];
              if (player) {
                const colorSpec = PLAYER_COLORS[player.color] ?? PLAYER_COLORS.amber;
                const isMe = player.id === localPlayerId;
                const weapon = WEAPON_SPECS[player.equippedWeapon] ?? WEAPON_SPECS.carbine;

                return (
                  <div
                    key={player.id}
                    className={`bg-[#141b25] rounded-lg p-3 border flex items-center justify-between transition-all ${
                      player.isHost ? 'border-[#f5b301]/50' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: colorSpec.css }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 leading-none mb-1">
                          <span className="font-display font-bold text-sm text-white truncate">
                            {player.name}
                          </span>
                          {player.isHost && <Crown className="w-3.5 h-3.5 text-[#f5b301] shrink-0" />}
                          {isMe && <span className="text-[10px] font-mono text-slate-400">(You)</span>}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{weapon.shortLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {player.ping > 0 && (
                        <span className="text-[10px] font-mono-num text-slate-400">{player.ping}ms</span>
                      )}
                      <span
                        className={`text-[10px] font-mono font-bold uppercase ${
                          player.ready || player.isHost ? 'text-emerald-400' : 'text-[#f5b301]'
                        }`}
                      >
                        {player.isHost ? 'Leader' : player.ready ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={`empty-${idx}`}
                  type="button"
                  onClick={handleCopyLink}
                  className="bg-[#111720] hover:bg-[#161e2a] border border-dashed border-white/12 rounded-lg p-3 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-slate-500" />
                    <span>Invite Player</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Copy Link</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Squad Comms Chat */}
        <div className="bg-[#0b1017] border border-white/10 rounded-lg p-3 flex flex-col h-36">
          <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-white/8 text-[11px] text-slate-400 font-mono uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5 text-[#f5b301]" />
            <span>Squad Comms</span>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs font-mono">
            {chatMessages.length === 0 ? (
              <p className="text-slate-500 text-[11px]">Share the room code or link above to invite teammates.</p>
            ) : (
              chatMessages.map((msg) => {
                const msgColor = PLAYER_COLORS[msg.senderColor]?.css ?? '#ffffff';
                return (
                  <div key={msg.id} className="leading-snug">
                    {msg.system ? (
                      <span className="text-[#f5b301]/90 text-[11px]">{msg.text}</span>
                    ) : (
                      <>
                        <span className="font-bold mr-1.5" style={{ color: msgColor }}>
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

          <form onSubmit={handleSendMessage} className="flex gap-2 mt-2 pt-2 border-t border-white/8">
            <input
              type="text"
              maxLength={80}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message to squad..."
              className="flex-1 bg-[#141b25] border border-white/12 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f5b301] font-mono"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="px-3 py-1.5 bg-[#1d2633] hover:bg-[#2a3648] text-slate-200 rounded-md cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (localPlayer) {
                onOpenLoadout(localPlayer.loadout, () => {});
              }
            }}
            className="px-4 py-2.5 bg-[#151c26] hover:bg-[#1e2836] border border-white/12 text-slate-200 hover:text-white rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Edit Loadout
          </button>

          <div>
            {!isHost && (
              <button
                type="button"
                onClick={onToggleReady}
                className={`px-6 py-2.5 rounded-lg font-display font-extrabold text-xs tracking-wider uppercase transition-all cursor-pointer ${
                  localPlayer?.ready
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                    : 'bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950'
                }`}
              >
                {localPlayer?.ready ? 'Ready (Cancel)' : 'Ready Up'}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                onClick={onStartMatch}
                className="px-6 py-2.5 bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-xs tracking-wider uppercase rounded-lg shadow-[0_4px_18px_rgba(245,179,1,0.3)] transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Deploy Squad</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
