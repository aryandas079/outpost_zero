export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type WeaponId = 'carbine' | 'railpistol';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortLabel: string;
  slot: 1 | 2;
  automatic: boolean;
  fireRate: number; // shots per second
  damage: number;
  headshotMultiplier: number;
  magSize: number;
  reserveMax: number;
  reloadTime: number; // seconds (tactical reload with round chambered)
  reloadTimeEmpty: number; // seconds (dry empty reload with bolt release / rack)
  spreadHip: number;
  spreadAds: number;
  recoilKick: number;
  recoilPitch: number;
  adsFov: number;
  tracerColor: number;
}

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  carbine: {
    id: 'carbine',
    name: 'M13-MOD2 Tactical Carbine',
    shortLabel: 'M13 CARBINE',
    slot: 1,
    automatic: true,
    fireRate: 9.2,
    damage: 26,
    headshotMultiplier: 2.0,
    magSize: 28,
    reserveMax: 168,
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
};

export interface KillFeedEntry {
  id: number;
  killer: string;
  victim: string;
  weapon: WeaponId;
  headshot: boolean;
}

export interface HitMarkerState {
  active: boolean;
  crit: boolean;
  kill: boolean;
  seq: number;
  intensity: number; // 0..1 smooth flash decay
}

export interface DamageArcState {
  active: boolean;
  angleRad: number; // 0 = front, PI/2 = right, PI = behind, -PI/2 = left
  intensity: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard';
export type MapId = 'west';

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
    summary: 'Balanced frontier combat · 1.0x score',
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
  west: {
    id: 'west',
    name: 'WEST',
    subtitle: '3D Frontier Town',
    details: '15 enterable buildings · Main Street · Railroad · Saloon & Sheriff balconies',
  },
};

export interface MissionConfig {
  difficulty: DifficultyId;
  mapId: MapId;
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
  kind: 'health' | 'ammo';
}

export interface RadarBuildingFootprint {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

export interface RadarState {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  range: number;
  enemies: RadarEnemyBlip[];
  pickups: RadarPickupBlip[];
  buildings: RadarBuildingFootprint[];
}

export interface HudSnapshot {
  phase: GamePhase;
  difficulty: DifficultyId;
  mapId: MapId;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  wave: number;
  maxWaves: number;
  endless: boolean;
  enemiesRemaining: number;
  weaponId: WeaponId;
  ammo: number;
  magSize: number;
  reserve: number;
  carbineAmmo: number;
  carbineReserve: number;
  sniperAmmo: number;
  sniperReserve: number;
  reloading: boolean;
  reloadProgress: number; // 0..1
  reloadEmpty: boolean;
  inspecting: boolean;
  ads: boolean;
  scopeAlpha: number; // 0..1 optical sniper scope blend
  scopeZoom: number; // 6 or 10 magnification
  scopeSwayX: number; // px offset for optical reticle sway
  scopeSwayY: number; // px offset for optical reticle sway
  breathSteady: boolean;
  crouching: boolean;
  sprinting: boolean;
  matchTimeSec: number;
  headingDeg: number; // 0..359 compass heading
  killFeed: KillFeedEntry[];
  crosshairSpread: number; // pixels offset
  pointerLocked: boolean;
  hitMarker: HitMarkerState;
  damageArc: DamageArcState;
  damageFlash: number; // 0..1
  screenShakeX: number; // px screen-space HUD impact offset
  screenShakeY: number; // px screen-space HUD impact offset
  screenShakeRot: number; // deg subtle HUD roll jolt
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
  radar: RadarState;
}

export interface GameSettings {
  sensitivity: number; // 0.3 .. 2.2
  muted: boolean;
}
