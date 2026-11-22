import { DifficultyId, GrenadeId, Loadout, MapId, WeaponId } from '../types';

export type MultiplayerMode = 'coop' | 'deathmatch';

export type PlayerColorId = 'cyan' | 'amber' | 'emerald' | 'rose';

export interface PlayerColorSpec {
  id: PlayerColorId;
  label: string;
  hex: number;
  css: string;
  glow: string;
}

export const PLAYER_COLORS: Record<PlayerColorId, PlayerColorSpec> = {
  cyan: {
    id: 'cyan',
    label: 'Neon Cyan',
    hex: 0x06b6d4,
    css: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.4)',
  },
  amber: {
    id: 'amber',
    label: 'Solar Amber',
    hex: 0xf59e0b,
    css: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  emerald: {
    id: 'emerald',
    label: 'Bio Emerald',
    hex: 0x10b981,
    css: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  rose: {
    id: 'rose',
    label: 'Pulse Rose',
    hex: 0xf43f5e,
    css: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
};

export const DEFAULT_PLAYER_CALLSIGNS = [
  'Ghost-1',
  'Viper-2',
  'Spectre-3',
  'Apex-4',
  'Ranger-5',
  'Nomad-6',
  'Echo-7',
  'Hawk-8',
];

export interface PlayerProfile {
  id: string;
  name: string;
  color: PlayerColorId;
  isHost: boolean;
  ready: boolean;
  loadout: Loadout;
  ping: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  kills: number;
  deaths: number;
  score: number;
  headshots: number;
  alive: boolean;
  equippedWeapon: WeaponId;
}

export interface MultiplayerGameSettings {
  mode: MultiplayerMode;
  difficulty: DifficultyId;
  mapId: MapId;
  maxPlayers: number; // 2..4
  killLimit: number; // For deathmatch, e.g. 15
  timeLimitSec: number; // e.g. 300 (5 mins) or 0 (unlimited)
  friendlyFire: boolean;
}

export const DEFAULT_MULTIPLAYER_SETTINGS: MultiplayerGameSettings = {
  mode: 'coop',
  difficulty: 'normal',
  mapId: 'west',
  maxPlayers: 4,
  killLimit: 15,
  timeLimitSec: 360,
  friendlyFire: false,
};

export interface RemotePlayerNetworkState {
  id: string;
  timestamp: number;
  pos: [number, number, number];
  vel: [number, number, number];
  yaw: number;
  pitch: number;
  weaponId: WeaponId;
  crouching: boolean;
  sprinting: boolean;
  firing: boolean;
  health: number;
  shield: number;
  alive: boolean;
}

export interface NetworkEnemyState {
  id: number;
  kind: 'striker' | 'sentinel' | 'wasp';
  pos: [number, number, number];
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  firing: boolean;
}

export interface NetworkChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: PlayerColorId;
  text: string;
  timestamp: number;
  system?: boolean;
}

export type NetworkMessage =
  | { type: 'join'; player: PlayerProfile }
  | {
      type: 'join-ack';
      accepted: boolean;
      reason?: string;
      roomCode: string;
      hostId: string;
      settings: MultiplayerGameSettings;
      players: PlayerProfile[];
    }
  | { type: 'player-joined'; player: PlayerProfile }
  | { type: 'player-left'; playerId: string; name: string }
  | { type: 'profile-update'; player: Partial<PlayerProfile> & { id: string } }
  | { type: 'settings-update'; settings: MultiplayerGameSettings }
  | { type: 'match-start'; settings: MultiplayerGameSettings; seed: number; spawnIndices: Record<string, number> }
  | { type: 'match-restart' }
  | { type: 'match-ended'; winnerId?: string; winnerName?: string; finalStandings: PlayerProfile[] }
  | { type: 'player-state'; state: RemotePlayerNetworkState }
  | {
      type: 'player-shoot';
      playerId: string;
      weaponId: WeaponId;
      origin: [number, number, number];
      target: [number, number, number];
    }
  | { type: 'player-reload'; playerId: string; weaponId: WeaponId }
  | {
      type: 'player-grenade';
      playerId: string;
      kind: GrenadeId;
      origin: [number, number, number];
      dir: [number, number, number];
    }
  | {
      type: 'player-damage';
      targetId: string;
      attackerId: string;
      attackerName: string;
      amount: number;
      isHeadshot: boolean;
      weaponId: WeaponId | GrenadeId;
    }
  | {
      type: 'player-killed';
      victimId: string;
      victimName: string;
      killerId: string;
      killerName: string;
      weaponId: WeaponId | GrenadeId;
      isHeadshot: boolean;
    }
  | { type: 'player-respawn'; playerId: string; pos: [number, number, number] }
  | {
      type: 'enemy-damage';
      enemyId: number;
      amount: number;
      isHeadshot: boolean;
      shooterId: string;
      weaponId: WeaponId | GrenadeId;
    }
  | { type: 'enemy-sync'; enemies: NetworkEnemyState[]; wave: number; enemiesRemaining: number }
  | { type: 'wave-start'; wave: number; enemyCount: number }
  | { type: 'chat'; message: NetworkChatMessage }
  | { type: 'ping'; senderId: string; timestamp: number }
  | { type: 'pong'; senderId: string; timestamp: number };
