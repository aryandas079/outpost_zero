import type { CrosshairDamagePop, DamageKind } from './damageNumbers';
import type { MatchLifecycleState } from '../core/GameState';
export type { CrosshairDamagePop, DamageKind, MatchLifecycleState };

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
export type PlayerMovementState =
  | 'idle'
  | 'crouching'
  | 'prone'
  | 'walking'
  | 'sprinting'
  | 'sliding'
  | 'airborne'
  | 'swimming'
  | 'dashing';

export type WeaponId =
  | 'carbine'
  | 'railpistol'
  | 'shotgun'
  | 'smg'
  | 'machinegun'
  | 'marksman'
  | 'usp'
  | 'deagle'
  | 'glock'
  | 'rpg'
  | 'grenadelauncher';

export type GrenadeId = 'frag' | 'smoke' | 'molotov' | 'flashbang';

export interface Loadout {
  primary: [WeaponId, WeaponId];
  sidearm: WeaponId;
  launcher: WeaponId | null;
  grenade: GrenadeId;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortLabel: string;
  slot: number;
  pellets?: number;
  blastRadius?: number;
  automatic: boolean;
  fireRate: number;
  damage: number;
  headshotMultiplier: number;
  magSize: number;
  reserveMax: number;
  reloadTime: number;
  reloadTimeEmpty: number;
  spreadHip: number;
  spreadAds: number;
  recoilKick: number;
  recoilPitch: number;
  adsFov: number;
  tracerColor: number;
}

const BASE_WEAPONS = {
  carbine: {
    id: 'carbine',
    name: 'M4A1 Tactical Carbine',
    shortLabel: 'M4A1 CARBINE',
    slot: 1,
    automatic: true,
    fireRate: 9.2,
    damage: 26,
    headshotMultiplier: 2.0,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.32,
    reloadTimeEmpty: 2.18,
    spreadHip: 0.014,
    spreadAds: 0.0028,
    recoilKick: 0.052,
    recoilPitch: 0.018,
    adsFov: 54,
    tracerColor: 0xffb347,
  },
  railpistol: {
    id: 'railpistol',
    name: 'K-9 Precision Sniper',
    shortLabel: 'K-9 SNIPER',
    slot: 2,
    automatic: false,
    fireRate: 1.35,
    damage: 98,
    headshotMultiplier: 2.5,
    magSize: 6,
    reserveMax: 48,
    reloadTime: 1.65,
    reloadTimeEmpty: 2.28,
    spreadHip: 0.014,
    spreadAds: 0.0001,
    recoilKick: 0.082,
    recoilPitch: 0.036,
    adsFov: 15,
    tracerColor: 0xffd27d,
  },
} satisfies Record<'carbine' | 'railpistol', WeaponSpec>;

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  ...BASE_WEAPONS,
  shotgun: {
    ...BASE_WEAPONS.carbine,
    id: 'shotgun',
    name: 'M4 Combat Shotgun',
    shortLabel: 'M4 SHOTGUN',
    automatic: false,
    fireRate: 1.6,
    damage: 15,
    pellets: 8,
    magSize: 8,
    reserveMax: 48,
    spreadHip: 0.065,
    spreadAds: 0.04,
    reloadTime: 2.6,
    reloadTimeEmpty: 3.2,
    recoilKick: 0.09,
    recoilPitch: 0.04,
    adsFov: 58,
  },
  smg: {
    ...BASE_WEAPONS.carbine,
    id: 'smg',
    name: 'MP5 Submachine Gun',
    shortLabel: 'MP5 SMG',
    fireRate: 13,
    damage: 18,
    magSize: 30,
    reserveMax: 210,
    spreadHip: 0.018,
    spreadAds: 0.005,
    recoilPitch: 0.011,
    reloadTime: 1.5,
  },
  machinegun: {
    ...BASE_WEAPONS.carbine,
    id: 'machinegun',
    name: 'M249 Light Machine Gun',
    shortLabel: 'M249 LMG',
    fireRate: 11,
    damage: 30,
    magSize: 100,
    reserveMax: 300,
    reloadTime: 4.5,
    reloadTimeEmpty: 5.2,
    spreadHip: 0.026,
    spreadAds: 0.006,
    recoilPitch: 0.025,
  },
  marksman: {
    ...BASE_WEAPONS.carbine,
    id: 'marksman',
    name: 'SCAR-H Marksman Rifle',
    shortLabel: 'SCAR-H DMR',
    automatic: false,
    fireRate: 3.5,
    damage: 58,
    magSize: 20,
    reserveMax: 100,
    spreadAds: 0.0008,
    adsFov: 30,
    recoilPitch: 0.026,
  },
  usp: {
    ...BASE_WEAPONS.carbine,
    id: 'usp',
    name: 'USP Tactical',
    shortLabel: 'USP TACTICAL',
    slot: 3,
    automatic: false,
    fireRate: 5,
    damage: 32,
    magSize: 12,
    reserveMax: 72,
    reloadTime: 1.2,
    reloadTimeEmpty: 1.6,
    recoilPitch: 0.014,
  },
  deagle: {
    ...BASE_WEAPONS.railpistol,
    id: 'deagle',
    name: 'Desert Eagle',
    shortLabel: 'DESERT EAGLE',
    slot: 3,
    fireRate: 2.4,
    damage: 65,
    magSize: 7,
    reserveMax: 42,
    adsFov: 55,
    spreadAds: 0.003,
  },
  glock: {
    ...BASE_WEAPONS.carbine,
    id: 'glock',
    name: 'Glock 17',
    shortLabel: 'GLOCK 17',
    slot: 3,
    automatic: false,
    fireRate: 6.5,
    damage: 24,
    magSize: 17,
    reserveMax: 68,
    reloadTime: 1.1,
    reloadTimeEmpty: 1.5,
    recoilPitch: 0.01,
  },
  rpg: {
    ...BASE_WEAPONS.railpistol,
    id: 'rpg',
    name: 'RPG-7 Rocket Launcher',
    shortLabel: 'RPG 7',
    slot: 4,
    fireRate: 0.5,
    damage: 180,
    magSize: 1,
    reserveMax: 4,
    reloadTime: 3.5,
    reloadTimeEmpty: 3.5,
    adsFov: 55,
    blastRadius: 6,
    spreadAds: 0.005,
  },
  grenadelauncher: {
    ...BASE_WEAPONS.railpistol,
    id: 'grenadelauncher',
    name: 'Grenade Launcher',
    shortLabel: 'GRENADE LAUNCHER',
    slot: 4,
    fireRate: 0.7,
    damage: 125,
    magSize: 1,
    reserveMax: 8,
    reloadTime: 2.6,
    reloadTimeEmpty: 2.6,
    adsFov: 58,
    blastRadius: 4.5,
    spreadAds: 0.008,
  },
};

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  weapon: WeaponId | GrenadeId;
  headshot: boolean;
}

export interface HitMarkerState {
  active: boolean;
  crit: boolean;
  kill: boolean;
  armor?: boolean;
  armorBreak?: boolean;
  seq: number;
  intensity: number;
}

export interface DamageArcState {
  active: boolean;
  angleRad: number;
  intensity: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard';
export type MapId = 'island' | 'west';

export interface DifficultySpec {
  id: DifficultyId;
  label: string;
  summary: string;
  enemyHpScale: number;
  enemyDamageScale: number;
  enemyFireIntervalScale: number;
  scoreMultiplier: number;
}

export const DIFFICULTY_SPECS: Record<DifficultyId, DifficultySpec> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    summary: 'Lower enemy health & damage · 0.8x score',
    enemyHpScale: 0.75,
    enemyDamageScale: 0.7,
    enemyFireIntervalScale: 1.25,
    scoreMultiplier: 0.8,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    summary: 'Balanced tactical combat · 1.0x score',
    enemyHpScale: 1.0,
    enemyDamageScale: 1.0,
    enemyFireIntervalScale: 1.0,
    scoreMultiplier: 1.0,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    summary: 'Tougher hostiles & faster fire · 1.5x score',
    enemyHpScale: 1.35,
    enemyDamageScale: 1.35,
    enemyFireIntervalScale: 0.78,
    scoreMultiplier: 1.5,
  },
};

export interface MapSpec {
  id: MapId;
  name: string;
  subtitle: string;
  details: string;
}

export const MAP_SPECS: Record<MapId, MapSpec> = {
  island: {
    id: 'island',
    name: 'ISLAND',
    subtitle: '25 km² Three-Island Battle Royale',
    details: 'C-130 Hercules Airdrop · 5.0×5.0 km (15 / 7 / 3 km² Low-Poly Islands) · 3 Suspension Bridges · Hydro Dam & Lakes',
  },
  west: {
    id: 'west',
    name: 'WEST',
    subtitle: '3D Frontier Town',
    details: '15 enterable buildings · Main Street · Railroad · Saloon & Sheriff balconies',
  },
};

export type BattleRoyaleDeployStage = 'airdrop_plane' | 'freefall' | 'parachute' | 'grounded';

export interface BattleRoyaleHudState {
  active: boolean;
  stage: BattleRoyaleDeployStage;
  canJumpFromPlane: boolean;
  altitudeMeters: number;
  airspeedKmh: number;
  aliveCount: number;
  totalCombatants: number;
  remainingPassengers: number;
  deploymentCountdownSec: number;
  stormPhase: number;
  stormTimerSec: number;
  stormWarmup?: boolean;
  stormClosing: boolean;
  stormShrinking: boolean;
  stormCenterX: number;
  stormCenterZ: number;
  stormRadius: number;
  stormTargetX: number;
  stormTargetZ: number;
  stormTargetRadius: number;
  outsideStorm: boolean;
  distanceToSafeZoneMeters: number;
  nearestPoi: string;
}

export interface LootPromptHud {
  id: string;
  label: string;
  category: 'crate' | 'weapon' | 'ammo' | 'armor' | 'medical' | 'grenade';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  keyHint: string;
}

export interface SpectatorHudState {
  active: boolean;
  targetName: string;
  targetHealth: number;
  targetShield: number;
  targetKills: number;
  targetWeapon: WeaponId;
  canSwitch: boolean;
}

export interface MissionMultiplayerConfig {
  mode: 'coop' | 'deathmatch';
  isHost: boolean;
  roomCode: string;
  localPlayerId: string;
  killLimit?: number;
  timeLimitSec?: number;
  spawnIndex?: number;
}

export interface MissionConfig {
  difficulty: DifficultyId;
  mapId: MapId;
  loadout?: Loadout;
  endless?: boolean;
  seed?: number;
  multiplayer?: MissionMultiplayerConfig;
}

export interface RadarEnemyBlip {
  id: number;
  x: number;
  z: number;
  kind: 'striker' | 'sentinel' | 'wasp';
  elevated: boolean;
  firing: boolean;
}

export interface RadarPickupBlip {
  x: number;
  z: number;
  kind: 'health' | 'ammo' | 'armor' | 'weapon';
}

export interface RadarBuildingFootprint {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

export interface RadarPlayerBlip {
  id: string;
  x: number;
  z: number;
  color: string;
  isTeammate: boolean;
  name: string;
}

export interface RadarPoiMarker {
  id?: string;
  name: string;
  x: number;
  z: number;
  theme?: string;
}

export interface RadarState {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  range: number;
  enemies: RadarEnemyBlip[];
  pickups: RadarPickupBlip[];
  buildings: RadarBuildingFootprint[];
  players?: RadarPlayerBlip[];
  pois?: RadarPoiMarker[];
  islandRadius?: number;
  coastlinePolygon?: Array<[number, number]>;
  islandPolygons?: Array<{ id: string; points: Array<[number, number]>; fill: string }>;
  riverPolyline?: Array<[number, number]>;
  waypoint?: { x: number; z: number } | null;
  stormCircle?: {
    cx: number;
    cz: number;
    r: number;
    targetCx: number;
    targetCz: number;
    targetR: number;
  };
  planePath?: {
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    planeX: number;
    planeZ: number;
    active: boolean;
  };
}

export interface MultiplayerHudPlayer {
  id: string;
  name: string;
  color: 'cyan' | 'amber' | 'emerald' | 'rose';
  kills: number;
  deaths: number;
  score: number;
  ping: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  alive: boolean;
  weaponId?: WeaponId;
}

export interface MultiplayerHudSnapshot {
  active: boolean;
  mode: 'coop' | 'deathmatch';
  roomCode: string;
  isHost: boolean;
  ping: number;
  players: MultiplayerHudPlayer[];
  respawnTimer?: number;
  matchTimeRemaining?: number;
  killLimit?: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  lifecycleState?: MatchLifecycleState;
  difficulty: DifficultyId;
  mapId: MapId;
  battleRoyale?: BattleRoyaleHudState;
  spectator?: SpectatorHudState;
  health: number;
  maxHealth: number;
  healthRegenActive?: boolean;
  outOfCombatSec?: number;
  tacticalMapOpen?: boolean;
  inventoryOpen?: boolean;
  crateOpen?: { crateId: string; weapons: WeaponId[] } | null;
  brGuns?: [WeaponId | null, WeaponId | null];
  brMeleeActive?: boolean;
  shield: number;
  maxShield: number;
  armorPlates?: number;
  medkits?: number;
  nearbyLoot?: LootPromptHud | null;
  score: number;
  placement?: number;
  damageDealt?: number;
  survivalTimeSec?: number;
  wave: number;
  maxWaves: number;
  endless: boolean;
  enemiesRemaining: number;
  weaponId: WeaponId;
  inventory: { id: WeaponId; ammo: number; reserve: number }[];
  grenade: GrenadeId;
  grenadesRemaining: number;
  ammo: number;
  magSize: number;
  reserve: number;
  carbineAmmo: number;
  carbineReserve: number;
  sniperAmmo: number;
  sniperReserve: number;
  reloading: boolean;
  reloadProgress: number;
  reloadEmpty: boolean;
  inspecting: boolean;
  ads: boolean;
  scopeAlpha: number;
  scopeZoom: number;
  scopeSwayX: number;
  scopeSwayY: number;
  breathSteady: boolean;
  crouching: boolean;
  prone?: boolean;
  swimming?: boolean;
  underwater?: boolean;
  sprinting: boolean;
  grounded: boolean;
  sliding: boolean;
  movementState: PlayerMovementState;
  moveSpeedRatio: number;
  recoilIntensity: number;
  matchTimeSec: number;
  headingDeg: number;
  killFeed: KillFeedEntry[];
  crosshairSpread: number;
  pointerLocked: boolean;
  hitMarker: HitMarkerState;
  damagePops: CrosshairDamagePop[];
  damageArc: DamageArcState;
  damageFlash: number;
  screenShakeX: number;
  screenShakeY: number;
  screenShakeRot: number;
  waveBanner: string | null;
  pickupNotice: string | null;
  eliminations: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  bestScore: number;
  muted: boolean;
  dashCooldown: number;
  dashCooldownMax: number;
  dashing: boolean;
  gpuPostFx: boolean;
  performance?: {
    fps: number;
    averageFps: number;
    peakFps: number;
    frameMs: number;
    worstFrameMs: number;
    drawCalls: number;
    resolutionScale: number;
    cpuMs: number;
    gpuMs: number;
    gpuName: string;
    triangles: number;
    activeChunks?: number;
    texturesCount?: number;
    geometriesCount?: number;
    jsHeapMb?: number;
  };
  radar: RadarState;
  multiplayer?: MultiplayerHudSnapshot;
}

export type ControlAction =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'sprint'
  | 'crouch'
  | 'reload'
  | 'dash'
  | 'inspect'
  | 'grenade'
  | 'scopeZoom'
  | 'interact'
  | 'armorPlate'
  | 'medkit'
  | 'primary1'
  | 'primary2'
  | 'sidearm'
  | 'launcher';

export type KeyBindings = Record<ControlAction, string>;

export interface GameSettings {
  sensitivity: number; // 0.35 .. 2.2
  adsSensitivity: number; // 0.35 .. 1.8
  invertY: boolean;
  sprintToggle: boolean;
  crouchToggle: boolean;
  fov: number; // 65 .. 105
  muted: boolean;
  masterVolume: number; // 0 .. 1
  musicVolume: number; // 0 .. 1
  envVolume: number; // 0 .. 1
  weaponsVolume: number; // 0 .. 1
  movementVolume: number; // 0 .. 1
  uiVolume: number; // 0 .. 1
  audioDynamicRange: 'wide' | 'balanced' | 'boost';
  graphicsPreset: 'quality' | 'balanced' | 'performance' | 'ultra' | 'custom';
  resolutionScale: number; // 0.5 .. 1.0
  targetFps: 60 | 90 | 100 | 120 | 144;
  dynamicResolution: boolean;
  shadowQuality: 'off' | 'medium' | 'high';
  textureFiltering: 2 | 4 | 8;
  vegetationDensity: 'sparse' | 'balanced' | 'dense';
  viewDistance: 'reduced' | 'balanced' | 'extended' | 'maximum';
  waterQuality: 'basic' | 'standard' | 'enhanced';
  timeOfDay: 'daylight' | 'golden' | 'overcast';
  hudScale: number; // 0.8 .. 1.25
  minimapRotate: boolean;
  crosshairColor: string;
  crosshairSize: number; // 0.7 .. 1.5
  colorblindMode: 'none' | 'deuteranope' | 'protanope' | 'tritanope';
  reducedMotion: boolean;
  screenShakeScale: number; // 0 .. 1
  showPerfOverlay: boolean;
  controls: KeyBindings;
}
