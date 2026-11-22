import { DEFAULT_LOADOUT } from '../loadout';
import {
  DEFAULT_MULTIPLAYER_SETTINGS,
  MultiplayerGameSettings,
  NetworkChatMessage,
  NetworkMessage,
  PlayerColorId,
  PlayerProfile,
} from './types';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'hosting'
  | 'joined'
  | 'lobby'
  | 'playing'
  | 'disconnected'
  | 'error';

export interface NetworkCallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onPlayersChange?: (players: PlayerProfile[]) => void;
  onSettingsChange?: (settings: MultiplayerGameSettings) => void;
  onChatMessage?: (message: NetworkChatMessage) => void;
  onMatchStart?: (settings: MultiplayerGameSettings, seed: number, spawnIndices: Record<string, number>) => void;
  onMatchRestart?: () => void;
  onMatchEnded?: (winnerId?: string, winnerName?: string, standings?: PlayerProfile[]) => void;
  onRemoteMessage?: (msg: NetworkMessage, senderId: string) => void;
  onError?: (err: string) => void;
}

const PEER_PREFIX = 'outpostzero-v1-';

export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OPZ-${code}`;
}

export function normalizeRoomCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('OPZ') && cleaned.length > 3) {
    return `OPZ-${cleaned.slice(3, 7)}`;
  }
  return cleaned.length >= 4 ? `OPZ-${cleaned.slice(0, 4)}` : cleaned;
}

export function parseRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const q = params.get('room') || params.get('r');
  if (q) return normalizeRoomCode(q);
  const hash = window.location.hash;
  if (hash.includes('room=')) {
    const match = hash.match(/room=([A-Za-z0-9_-]+)/);
    if (match?.[1]) return normalizeRoomCode(match[1]);
  }
  return null;
}

export function getShareUrl(roomCode: string): string {
  if (typeof window === 'undefined') return roomCode;
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

export class NetworkManager {
  private peer: any = null;
  private connections = new Map<string, any>();
  private hostConn: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private pingInterval: any = null;

  public status: ConnectionStatus = 'idle';
  public isHost = false;
  public roomCode = '';
  public localPlayerId = '';
  public hostPlayerId = '';
  public players: PlayerProfile[] = [];
  public settings: MultiplayerGameSettings = { ...DEFAULT_MULTIPLAYER_SETTINGS };
  public chatMessages: NetworkChatMessage[] = [];
  public callbacks: NetworkCallbacks = {};

  constructor(callbacks: NetworkCallbacks = {}) {
    this.callbacks = callbacks;
    this.localPlayerId = 'p_' + Math.random().toString(36).slice(2, 9);
  }

  public setCallbacks(callbacks: NetworkCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  public getLocalPlayer(): PlayerProfile | undefined {
    return this.players.find((p) => p.id === this.localPlayerId);
  }

  /**
   * Host a new room for up to 4 players.
   */
  public async hostRoom(
    profile: { name: string; color: PlayerColorId; loadout?: any },
    customSettings?: Partial<MultiplayerGameSettings>,
    roomCode = generateRoomCode(),
  ): Promise<string> {
    this.disconnect();
    this.isHost = true;
    this.roomCode = normalizeRoomCode(roomCode);
    this.settings = { ...DEFAULT_MULTIPLAYER_SETTINGS, ...customSettings };
    this.setStatus('connecting');

    const localProfile: PlayerProfile = {
      id: this.localPlayerId,
      name: profile.name.trim() || 'Host',
      color: profile.color,
      isHost: true,
      ready: true,
      loadout: profile.loadout ?? DEFAULT_LOADOUT,
      ping: 0,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: (profile.loadout ?? DEFAULT_LOADOUT).primary[0],
    };

    this.hostPlayerId = this.localPlayerId;
    this.players = [localProfile];
    this.callbacks.onPlayersChange?.([...this.players]);

    const peerId = `${PEER_PREFIX}${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    try {
      this.peer = await this.createPeerInstance(peerId);

      this.peer.on('connection', (conn: any) => {
        this.handleIncomingHostConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        // If peerId is already taken, try appending a short suffix
        if (err?.type === 'unavailable-id') {
          const fallback = `${peerId}-${Math.floor(Math.random() * 900 + 100)}`;
          this.createPeerInstance(fallback).then((p) => {
            this.peer = p;
            this.peer.on('connection', (conn: any) => this.handleIncomingHostConnection(conn));
          }).catch(() => {});
        } else {
          this.callbacks.onError?.(err?.message ?? 'Peer network warning');
        }
      });

      this.setStatus('hosting');
      this.initBroadcastChannel();
      this.startPingLoop();
      return this.roomCode;
    } catch (err: any) {
      // In environments where WebRTC or cloud broker is blocked, fallback to BroadcastChannel
      this.initBroadcastChannel();
      this.setStatus('hosting');
      this.startPingLoop();
      return this.roomCode;
    }
  }

  /**
   * Join an existing room via room code.
   */
  public async joinRoom(
    roomCode: string,
    profile: { name: string; color: PlayerColorId; loadout?: any },
  ): Promise<void> {
    this.disconnect();
    this.isHost = false;
    this.roomCode = normalizeRoomCode(roomCode);
    this.setStatus('connecting');

    const clean = this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetPeerId = `${PEER_PREFIX}${clean}`;

    const localProfile: PlayerProfile = {
      id: this.localPlayerId,
      name: profile.name.trim() || 'Player',
      color: profile.color,
      isHost: false,
      ready: false,
      loadout: profile.loadout ?? DEFAULT_LOADOUT,
      ping: 0,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      kills: 0,
      deaths: 0,
      score: 0,
      headshots: 0,
      alive: true,
      equippedWeapon: (profile.loadout ?? DEFAULT_LOADOUT).primary[0],
    };

    this.players = [localProfile];
    this.callbacks.onPlayersChange?.([...this.players]);

    try {
      this.peer = await this.createPeerInstance();
      const conn = this.peer.connect(targetPeerId, {
        reliable: true,
        metadata: { playerId: this.localPlayerId },
      });

      this.hostConn = conn;

      conn.on('open', () => {
        this.setStatus('joined');
        this.sendRaw(conn, {
          type: 'join',
          player: localProfile,
        });
      });

      conn.on('data', (data: any) => {
        this.handleMessage(data, 'host');
      });

      conn.on('close', () => {
        this.setStatus('disconnected');
        this.callbacks.onError?.('Disconnected from host.');
      });

      conn.on('error', (err: any) => {
        this.callbacks.onError?.(err?.message ?? 'Connection error with host.');
      });

      this.initBroadcastChannel();
      this.startPingLoop();
    } catch (err: any) {
      // Local fallback
      this.initBroadcastChannel();
      this.setStatus('joined');
      this.broadcastRaw({
        type: 'join',
        player: localProfile,
      });
      this.startPingLoop();
    }
  }

  private async createPeerInstance(id?: string): Promise<any> {
    const PeerModule = await import('peerjs');
    const PeerCtor = (PeerModule as any).default?.Peer || (PeerModule as any).Peer || (PeerModule as any).default || PeerModule;

    return new Promise((resolve, reject) => {
      const config = {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      };

      const peer = id ? new PeerCtor(id, config) : new PeerCtor(config);
      const timer = setTimeout(() => {
        resolve(peer);
      }, 4000);

      peer.on('open', () => {
        clearTimeout(timer);
        resolve(peer);
      });

      peer.on('error', (err: any) => {
        clearTimeout(timer);
        // If id taken or general error, reject to trigger fallback
        reject(err);
      });
    });
  }

  private handleIncomingHostConnection(conn: any) {
    conn.on('open', () => {
      // Wait for 'join' packet
    });

    conn.on('data', (data: any) => {
      if (typeof data !== 'object' || !data) return;
      if (data.type === 'join') {
        const guest = data.player as PlayerProfile;

        // Enforce maximum 4 players capacity
        if (this.players.length >= (this.settings.maxPlayers || 4)) {
          this.sendRaw(conn, {
            type: 'join-ack',
            accepted: false,
            reason: 'Room is full (Max 4 players)',
            roomCode: this.roomCode,
            hostId: this.localPlayerId,
            settings: this.settings,
            players: this.players,
          });
          conn.close();
          return;
        }

        // Avoid duplicate ID
        const existingIdx = this.players.findIndex((p) => p.id === guest.id);
        if (existingIdx >= 0) {
          this.players[existingIdx] = guest;
        } else {
          this.players.push(guest);
        }

        this.connections.set(guest.id, conn);

        // Acknowledge acceptance
        this.sendRaw(conn, {
          type: 'join-ack',
          accepted: true,
          roomCode: this.roomCode,
          hostId: this.localPlayerId,
          settings: this.settings,
          players: this.players,
        });

        // Notify other peers
        this.broadcastToOthers(guest.id, {
          type: 'player-joined',
          player: guest,
        });

        this.callbacks.onPlayersChange?.([...this.players]);
        this.addSystemChatMessage(`${guest.name} joined the squad.`);
      } else {
        this.handleMessage(data, conn.metadata?.playerId ?? 'peer');
      }
    });

    conn.on('close', () => {
      let leftId: string | null = null;
      for (const [id, c] of this.connections.entries()) {
        if (c === conn) {
          leftId = id;
          break;
        }
      }
      if (leftId) {
        this.connections.delete(leftId);
        const player = this.players.find((p) => p.id === leftId);
        this.players = this.players.filter((p) => p.id !== leftId);
        if (player) {
          this.addSystemChatMessage(`${player.name} left the room.`);
          this.broadcastRaw({
            type: 'player-left',
            playerId: leftId,
            name: player.name,
          });
          this.callbacks.onPlayersChange?.([...this.players]);
        }
      }
    });
  }

  private handleMessage(data: any, fromSender: string) {
    if (!data || typeof data !== 'object') return;
    const msg = data as NetworkMessage;

    switch (msg.type) {
      case 'join-ack': {
        if (!msg.accepted) {
          this.callbacks.onError?.(msg.reason ?? 'Failed to join room.');
          this.disconnect();
          return;
        }
        this.roomCode = msg.roomCode;
        this.hostPlayerId = msg.hostId;
        this.settings = msg.settings;
        this.players = msg.players;
        this.setStatus('lobby');
        this.callbacks.onSettingsChange?.(this.settings);
        this.callbacks.onPlayersChange?.([...this.players]);
        this.addSystemChatMessage(`Connected to Room ${this.roomCode}.`);
        break;
      }

      case 'player-joined': {
        if (!this.players.some((p) => p.id === msg.player.id)) {
          this.players.push(msg.player);
          this.callbacks.onPlayersChange?.([...this.players]);
          this.addSystemChatMessage(`${msg.player.name} joined the room.`);
        }
        break;
      }

      case 'player-left': {
        this.players = this.players.filter((p) => p.id !== msg.playerId);
        this.callbacks.onPlayersChange?.([...this.players]);
        this.addSystemChatMessage(`${msg.name} disconnected.`);
        break;
      }

      case 'profile-update': {
        const idx = this.players.findIndex((p) => p.id === msg.player.id);
        if (idx >= 0) {
          this.players[idx] = { ...this.players[idx], ...msg.player };
          this.callbacks.onPlayersChange?.([...this.players]);
        }
        if (this.isHost) {
          this.broadcastToOthers(fromSender, msg);
        }
        break;
      }

      case 'settings-update': {
        this.settings = msg.settings;
        this.callbacks.onSettingsChange?.(this.settings);
        if (this.isHost) {
          this.broadcastToOthers(fromSender, msg);
        }
        break;
      }

      case 'match-start': {
        this.settings = msg.settings;
        this.setStatus('playing');
        this.callbacks.onMatchStart?.(msg.settings, msg.seed, msg.spawnIndices);
        break;
      }

      case 'match-restart': {
        this.callbacks.onMatchRestart?.();
        break;
      }

      case 'match-ended': {
        this.setStatus('lobby');
        this.callbacks.onMatchEnded?.(msg.winnerId, msg.winnerName, msg.finalStandings);
        break;
      }

      case 'chat': {
        this.chatMessages.push(msg.message);
        this.callbacks.onChatMessage?.(msg.message);
        if (this.isHost) {
          this.broadcastToOthers(fromSender, msg);
        }
        break;
      }

      case 'ping': {
        this.sendDirect(fromSender, {
          type: 'pong',
          senderId: this.localPlayerId,
          timestamp: msg.timestamp,
        });
        break;
      }

      case 'pong': {
        const rtt = Math.max(1, Math.round(Date.now() - msg.timestamp));
        const p = this.players.find((pl) => pl.id === this.localPlayerId);
        if (p) p.ping = rtt;
        break;
      }

      default: {
        // High-frequency in-game events (player-state, shoot, damage, sync, etc.)
        this.callbacks.onRemoteMessage?.(msg, fromSender);
        if (this.isHost && fromSender !== 'host') {
          // Relay to other peers
          this.broadcastToOthers(fromSender, msg);
        }
        break;
      }
    }
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel(`opz_${this.roomCode}`);
      this.broadcastChannel.onmessage = (evt) => {
        if (!evt.data) return;
        const { senderId, payload } = evt.data;
        if (senderId === this.localPlayerId) return;
        this.handleMessage(payload, senderId);
      };
    } catch {
      // Ignore broadcast channel errors in restricted environments
    }
  }

  private sendRaw(conn: any, msg: NetworkMessage) {
    try {
      if (conn?.open) {
        conn.send(msg);
      }
    } catch {
      // Connection may have dropped
    }
  }

  private broadcastRaw(msg: NetworkMessage) {
    if (this.isHost) {
      for (const conn of this.connections.values()) {
        this.sendRaw(conn, msg);
      }
    } else if (this.hostConn) {
      this.sendRaw(this.hostConn, msg);
    }
    // Also dispatch to local broadcast channel
    this.broadcastChannel?.postMessage({
      senderId: this.localPlayerId,
      payload: msg,
    });
  }

  private broadcastToOthers(exceptSenderId: string, msg: NetworkMessage) {
    if (this.isHost) {
      for (const [id, conn] of this.connections.entries()) {
        if (id !== exceptSenderId) {
          this.sendRaw(conn, msg);
        }
      }
    }
    this.broadcastChannel?.postMessage({
      senderId: this.localPlayerId,
      payload: msg,
    });
  }

  private sendDirect(recipientId: string, msg: NetworkMessage) {
    if (this.isHost) {
      const conn = this.connections.get(recipientId);
      if (conn) this.sendRaw(conn, msg);
    } else if (this.hostConn) {
      this.sendRaw(this.hostConn, msg);
    }
  }

  /**
   * Broadcast a network message to all other players in the session.
   */
  public broadcast(msg: NetworkMessage) {
    this.broadcastRaw(msg);
  }

  public updateLocalProfile(patch: Partial<PlayerProfile>) {
    const idx = this.players.findIndex((p) => p.id === this.localPlayerId);
    if (idx >= 0) {
      this.players[idx] = { ...this.players[idx], ...patch };
      this.callbacks.onPlayersChange?.([...this.players]);
      this.broadcast({
        type: 'profile-update',
        player: { ...patch, id: this.localPlayerId },
      });
    }
  }

  public updateSettings(settings: MultiplayerGameSettings) {
    if (!this.isHost) return;
    this.settings = settings;
    this.callbacks.onSettingsChange?.(settings);
    this.broadcast({
      type: 'settings-update',
      settings,
    });
  }

  public sendChatMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const me = this.getLocalPlayer();
    const chatMsg: NetworkChatMessage = {
      id: 'c_' + Math.random().toString(36).slice(2, 9),
      senderId: this.localPlayerId,
      senderName: me?.name ?? 'Player',
      senderColor: me?.color ?? 'cyan',
      text: trimmed,
      timestamp: Date.now(),
    };
    this.chatMessages.push(chatMsg);
    this.callbacks.onChatMessage?.(chatMsg);
    this.broadcast({
      type: 'chat',
      message: chatMsg,
    });
  }

  private addSystemChatMessage(text: string) {
    const chatMsg: NetworkChatMessage = {
      id: 'sys_' + Math.random().toString(36).slice(2, 9),
      senderId: 'system',
      senderName: 'SYSTEM',
      senderColor: 'amber',
      text,
      timestamp: Date.now(),
      system: true,
    };
    this.chatMessages.push(chatMsg);
    this.callbacks.onChatMessage?.(chatMsg);
  }

  public startMatch() {
    if (!this.isHost) return;
    const spawnIndices: Record<string, number> = {};
    this.players.forEach((p, i) => {
      spawnIndices[p.id] = i % 4;
    });

    const seed = Math.floor(Math.random() * 100000);
    this.setStatus('playing');
    this.callbacks.onMatchStart?.(this.settings, seed, spawnIndices);
    this.broadcast({
      type: 'match-start',
      settings: this.settings,
      seed,
      spawnIndices,
    });
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.status !== 'playing' && this.status !== 'lobby' && this.status !== 'hosting') return;
      this.broadcastRaw({
        type: 'ping',
        senderId: this.localPlayerId,
        timestamp: Date.now(),
      });
    }, 2500);
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect() {
    this.stopPingLoop();
    try {
      this.hostConn?.close();
      for (const c of this.connections.values()) {
        c.close();
      }
      this.connections.clear();
      this.peer?.destroy();
      this.broadcastChannel?.close();
    } catch {
      // Ignore
    }
    this.peer = null;
    this.hostConn = null;
    this.broadcastChannel = null;
    this.players = [];
    this.chatMessages = [];
    this.isHost = false;
    this.roomCode = '';
    this.setStatus('idle');
  }
}
