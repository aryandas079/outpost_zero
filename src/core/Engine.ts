import * as THREE from 'three';
import { DEFAULT_LOADOUT, inventoryWeapons, normalizeLoadout, GRENADES } from '../game/loadout';
import { AdaptiveRenderQuality, FrameMetrics, GpuFrameTimer } from '../rendering/FrameMetrics';
import { StaticSceneBatches } from '../rendering/StaticBatches';
import { SkySystem, SUN_DIRECTION, GOLDEN_SUN_DIRECTION } from '../rendering/Sky';
import { LightingRig } from '../rendering/Lighting';
import { createConfiguredRenderer, detectSoftwareWebGL } from '../rendering/Renderer';
import { applyShadowQuality } from '../rendering/Shadows';
import { applyRendererToneMapping, getViewDistanceFarPlane } from '../rendering/PostProcessing';
import { DEFAULT_GAME_SETTINGS } from '../settings/SettingsStore';
import { SIMULATION_CONFIG, WORLD_CONFIG } from './Config';
import { GameLoop } from './GameLoop';
import { MatchStateMachine } from './GameState';
import { InputManager } from '../input/InputManager';
import { AssetManager } from '../assets/AssetManager';
import { ArenaData, buildWestTownArena } from '../world/WestTown';
import { OcclusionCullingSystem } from '../world/Occlusion';
import {
  buildBattleRoyaleIslandArena,
  buildStormWallMesh,
  IslandArenaData,
} from '../world/MapGenerator';
import {
  buildCoastlinePolygon,
  buildIslandPolygons,
  buildRiverPolyline,
  evalInlandLakeDist,
  findNearestIslandPoi,
  INLAND_LAKES,
  ISLAND_HALF_SIZE,
  ISLAND_POIS,
  IslandOutlinePolygon,
  sampleIslandHeight,
  sampleRiverCenterX,
  sampleRiverWaterY,
} from '../world/Terrain';
import { sampleRenderedTerrainTriangleHeight } from '../world/WorldStreaming';
import { buildTransportAirplane, TransportAirplaneRig } from '../entities/Aircraft';
import {
  buildPlayerSkydiverRig,
  buildTacticalParachute,
  PlayerSkydiverRig,
  updateSkydiverRigPose,
} from '../entities/Parachute';
import { stepGroundEnemyMovement } from '../entities/AI';
import { StormController } from '../gameplay/Storm';
import { InventorySystem } from '../gameplay/Inventory';
import { LootManager } from '../gameplay/Loot';
import { DeploymentSystem } from '../gameplay/Deployment';
import { FootstepSurface, TacticalAudio } from '../audio/TacticalAudio';
import { EnemyEntity, EnemyFactory, EnemyKind } from '../game/enemies';
import { DynamicCapsuleBody, PhysicsRaycastHit, PhysicsWorld } from '../physics/PhysicsWorld';
import { computeDynamicCrosshair, computeRecoilIntensity, resolveMovementState } from '../animation/Crosshair';
import { computeHealthRegenStep } from '../gameplay/HealthRegen';
import { applyArmorHealthDamage, computeCrosshairPopSlot } from '../gameplay/Damage';
import { ProceduralTextures } from '../assets/ProceduralTextures';
import {
  BattleRoyaleDeployStage,
  CrosshairDamagePop,
  DIFFICULTY_SPECS,
  DifficultyId,
  GamePhase,
  GameSettings,
  HudSnapshot,
  KillFeedEntry,
  MapId,
  MissionConfig,
  MissionMultiplayerConfig,
  WEAPON_SPECS,
  WeaponId,
  Loadout,
  GrenadeId,
} from '../game/types';
import { NetworkManager } from '../game/multiplayer/networkManager';
import { RemotePlayerManager } from '../game/multiplayer/remotePlayerRigs';
import { NetworkMessage, PLAYER_COLORS } from '../game/multiplayer/types';
import { FirstPersonWeaponRig } from '../animation/WeaponRig';
import { nativeBridge } from '../utilities/NativeBridge';
import { worldToGridSector } from '../utilities/MapTransform';

// Pre-allocated scratch math helpers (zero per-frame GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v2d = new THREE.Vector2();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface TracerItem {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface ParticleItem {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  rotVel: THREE.Vector3;
  scale: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface EnemyProjectile {
  active: boolean;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
}

interface PickupItem {
  active: boolean;
  kind: 'health' | 'ammo';
  group: THREE.Group;
  pos: THREE.Vector3;
  phase: number;
}

interface DamageNumberItem {
  active: boolean;
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  baseScale: number;
  life: number;
  maxLife: number;
}

type SurfaceType = 'wood' | 'stone' | 'concrete' | 'metal' | 'glass' | 'dirt';

interface DustPuffItem {
  active: boolean;
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  baseScale: number;
  maxScale: number;
  baseOpacity: number;
  life: number;
  maxLife: number;
}

type WeatherKind = 'sunny' | 'overcast' | 'light_fog';

interface WeatherPreset {
  zenith: THREE.Color;
  midSky: THREE.Color;
  horizon: THREE.Color;
  groundHaze: THREE.Color;
  sunDiscColor: THREE.Color;
  cloudCover: number;
  sunStrength: number;
  fogColor: THREE.Color;
  fogDensity: number;
  sunLightColor: THREE.Color;
  sunLightIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  saloonIntensity: number;
  forgeIntensity: number;
  coronaColor: THREE.Color;
  coronaOpacity: number;
  coronaScale: number;
  moteColor: THREE.Color;
  moteOpacity: number;
  wispColor: THREE.Color;
  wispOpacity: number;
  wispSize: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  exposure: number;
  envIntensity: number;
  windIntensity: number;
}

const WEATHER_ORDER: WeatherKind[] = ['sunny', 'overcast', 'light_fog'];
const WEATHER_HOLD_SEC = 26;
const WEATHER_TRANSITION_SEC = 8;

const WEATHER_PRESETS: Record<WeatherKind, WeatherPreset> = {
  sunny: {
    zenith: new THREE.Color(0x184780),
    midSky: new THREE.Color(0x5284b8),
    horizon: new THREE.Color(0xd2ad7c),
    groundHaze: new THREE.Color(0xae8152),
    sunDiscColor: new THREE.Color(0xffe0a8),
    cloudCover: 0.36,
    sunStrength: 0.64,
    fogColor: new THREE.Color(0xc8a77e),
    fogDensity: 0.0033,
    sunLightColor: new THREE.Color(0xffead1),
    sunLightIntensity: 1.52,
    hemiSkyColor: new THREE.Color(0xb3cce5),
    hemiGroundColor: new THREE.Color(0xa18164),
    hemiIntensity: 0.62,
    rimColor: new THREE.Color(0x6c9fd4),
    rimIntensity: 0.22,
    saloonIntensity: 3.0,
    forgeIntensity: 4.0,
    coronaColor: new THREE.Color(0xffdfa0),
    coronaOpacity: 0.14,
    coronaScale: 22,
    moteColor: new THREE.Color(0xf5d49a),
    moteOpacity: 0.2,
    wispColor: new THREE.Color(0xc4a274),
    wispOpacity: 0.05,
    wispSize: 3.6,
    bloomStrength: 0.12,
    bloomRadius: 0.24,
    bloomThreshold: 1.36,
    exposure: 0.88,
    envIntensity: 0.32,
    windIntensity: 0.32,
  },
  overcast: {
    zenith: new THREE.Color(0x46525e),
    midSky: new THREE.Color(0x707c88),
    horizon: new THREE.Color(0x98a0a8),
    groundHaze: new THREE.Color(0x7e848b),
    sunDiscColor: new THREE.Color(0xd4dde6),
    cloudCover: 0.94,
    sunStrength: 0.1,
    fogColor: new THREE.Color(0x9299a1),
    fogDensity: 0.0064,
    sunLightColor: new THREE.Color(0xcbd5e0),
    sunLightIntensity: 0.58,
    hemiSkyColor: new THREE.Color(0x92a0b0),
    hemiGroundColor: new THREE.Color(0x58544e),
    hemiIntensity: 0.78,
    rimColor: new THREE.Color(0x9aa8b8),
    rimIntensity: 0.22,
    saloonIntensity: 5.0,
    forgeIntensity: 6.2,
    coronaColor: new THREE.Color(0xd0d8e2),
    coronaOpacity: 0.02,
    coronaScale: 20,
    moteColor: new THREE.Color(0xc0c8d0),
    moteOpacity: 0.07,
    wispColor: new THREE.Color(0xa2aab2),
    wispOpacity: 0.09,
    wispSize: 4.6,
    bloomStrength: 0.1,
    bloomRadius: 0.22,
    bloomThreshold: 1.3,
    exposure: 0.86,
    envIntensity: 0.3,
    windIntensity: 0.9,
  },
  light_fog: {
    zenith: new THREE.Color(0x72879b),
    midSky: new THREE.Color(0xa4aeb6),
    horizon: new THREE.Color(0xc0c6c6),
    groundHaze: new THREE.Color(0xb4bab8),
    sunDiscColor: new THREE.Color(0xede2cb),
    cloudCover: 0.74,
    sunStrength: 0.28,
    fogColor: new THREE.Color(0xbec4c2),
    fogDensity: 0.0155,
    sunLightColor: new THREE.Color(0xe6decb),
    sunLightIntensity: 0.92,
    hemiSkyColor: new THREE.Color(0xb4c0c8),
    hemiGroundColor: new THREE.Color(0x746d62),
    hemiIntensity: 0.72,
    rimColor: new THREE.Color(0xb2bcc4),
    rimIntensity: 0.24,
    saloonIntensity: 4.5,
    forgeIntensity: 5.8,
    coronaColor: new THREE.Color(0xf0e6ce),
    coronaOpacity: 0.1,
    coronaScale: 34,
    moteColor: new THREE.Color(0xdce2e4),
    moteOpacity: 0.14,
    wispColor: new THREE.Color(0xc8cfcc),
    wispOpacity: 0.15,
    wispSize: 6.0,
    bloomStrength: 0.13,
    bloomRadius: 0.28,
    bloomThreshold: 1.32,
    exposure: 0.88,
    envIntensity: 0.32,
    windIntensity: 0.62,
  },
};

interface WaveDefinition {
  strikers: number;
  sentinels: number;
  wasps: number;
  banner: string;
}

const MAX_WAVES = 5;

const WAVE_TABLE: WaveDefinition[] = [
  { strikers: 5, sentinels: 0, wasps: 1, banner: 'WEST · Wave 1 — Main Street Showdown' },
  { strikers: 5, sentinels: 1, wasps: 2, banner: 'WEST · Wave 2 — Railroad Ambush' },
  { strikers: 6, sentinels: 2, wasps: 3, banner: 'WEST · Wave 3 — Corral & Barn Flank' },
  { strikers: 7, sentinels: 3, wasps: 4, banner: 'WEST · Wave 4 — Town Square Siege' },
  { strikers: 8, sentinels: 4, wasps: 5, banner: 'WEST · Wave 5 — High Noon Last Stand' },
];

const BEST_SCORE_KEY = 'outpost_zero_best_score_v1';

// SkySystem in ../rendering/Sky and Renderer in ../rendering/Renderer replace duplicated shader & WebGL detection helpers.

export class OutpostGameEngine {
  private readonly container: HTMLElement;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private readonly onContextLost: (lost: boolean) => void;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private renderQuality: AdaptiveRenderQuality;
  private readonly nativePixelRatio: number;
  private readonly gpuTimer: GpuFrameTimer;
  private staticBatches: StaticSceneBatches;
  private readonly skySystem: SkySystem;
  private readonly lightingRig: LightingRig;
  private readonly assetManager: AssetManager;
  private readonly input: InputManager;
  private readonly gameLoop: GameLoop;
  private readonly lifecycle = new MatchStateMachine();
  private readonly storm = new StormController();
  private readonly inventory = new InventorySystem();
  private readonly lootManager: LootManager;
  private readonly deployment = new DeploymentSystem();
  private readonly frameMetrics = new FrameMetrics();
  private renderWorkMs = 5;
  private readonly gpuName: string;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly weaponScene: THREE.Scene;
  private readonly weaponCamera: THREE.PerspectiveCamera;
  private readonly textures: ProceduralTextures;
  private arena: ArenaData;
  private islandArena: IslandArenaData | null = null;
  private loadedArenaMapId: MapId = 'west';
  private physics: PhysicsWorld;
  private occlusion: OcclusionCullingSystem;
  private readonly weaponRig: FirstPersonWeaponRig;
  private readonly enemyFactory: EnemyFactory;
  private readonly audio: TacticalAudio;
  private readonly raycaster = new THREE.Raycaster();
  private readonly footRaycaster = new THREE.Raycaster();
  private readonly projRayHit: PhysicsRaycastHit = {
    hit: false,
    t: 2,
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    surface: 'wood',
  };
  private currentWeatherWind = 0.32;

  private get skyMat(): THREE.ShaderMaterial {
    return this.skySystem.skyMat;
  }
  private get sunLight(): THREE.DirectionalLight {
    return this.lightingRig.sunLight;
  }
  private get hemiLight(): THREE.HemisphereLight {
    return this.lightingRig.hemiLight;
  }
  private get rimLight(): THREE.DirectionalLight {
    return this.lightingRig.rimLight;
  }
  private get saloonGlow(): THREE.PointLight {
    return this.lightingRig.saloonGlow;
  }
  private get forgeGlow(): THREE.PointLight {
    return this.lightingRig.forgeGlow;
  }
  private get impactLight(): THREE.PointLight {
    return this.lightingRig.impactLight;
  }
  private get sunCoronaMat(): THREE.SpriteMaterial {
    return this.skySystem.sunCoronaMat;
  }
  private get heldKeys(): Set<string> {
    return this.input.heldKeys;
  }
  private get pointerLocked(): boolean {
    return this.input.pointerLocked;
  }
  private get fireHeld(): boolean {
    return this.input.fireHeld;
  }
  private set fireHeld(v: boolean) {
    this.input.fireHeld = v;
  }
  private get fireJustPressed(): boolean {
    return this.input.fireJustPressed;
  }
  private set fireJustPressed(v: boolean) {
    this.input.fireJustPressed = v;
  }
  private get adsHeld(): boolean {
    return this.input.adsHeld;
  }
  private get touchMoveX(): number {
    return this.input.touchMoveX;
  }
  private get touchMoveY(): number {
    return this.input.touchMoveY;
  }
  private get touchSprintLock(): boolean {
    return this.input.touchSprintLock;
  }
  private set touchSprintLock(v: boolean) {
    this.input.touchSprintLock = v;
  }
  private get touchAdsActive(): boolean {
    return this.input.touchAdsActive;
  }
  private set touchAdsActive(v: boolean) {
    this.input.touchAdsActive = v;
  }
  private get touchFireHeld(): boolean {
    return this.input.touchFireHeld;
  }
  private set touchFireHeld(v: boolean) {
    this.input.touchFireHeld = v;
  }

  // Multiplayer Networking & Remote Operatives
  private networkManager: NetworkManager | null = null;
  private remotePlayers: RemotePlayerManager | null = null;
  private multiplayerConfig: MissionMultiplayerConfig | null = null;
  private networkBroadcastTimer = 0;
  private enemySyncTimer = 0;
  private matchTimeRemaining = 0;
  private respawnTimer = 0;

  // Object pools & atmospheric VFX
  private readonly tracers: TracerItem[] = [];
  private readonly particles: ParticleItem[] = [];
  private readonly particleMesh: THREE.InstancedMesh;
  private readonly projectiles: EnemyProjectile[] = [];
  private readonly pickups: PickupItem[] = [];
  private readonly impactDecals: THREE.Mesh[] = [];
  private readonly impactDust: DustPuffItem[] = [];
  private readonly damageNumbers: DamageNumberItem[] = [];
  private decalWoodMat!: THREE.MeshBasicMaterial;
  private decalStoneMat!: THREE.MeshBasicMaterial;
  private decalMetalMat!: THREE.MeshBasicMaterial;
  private readonly sceneBgColor: THREE.Color;
  private readonly sceneFog: THREE.FogExp2;
  private impactLightTimer = 0;
  private dustMotesPoints!: THREE.Points;
  private dustMotesMat!: THREE.PointsMaterial;
  private dustMotesBasePos!: Float32Array;
  private dustMotesPhase!: Float32Array;
  private dustWispsPoints!: THREE.Points;
  private dustWispsMat!: THREE.PointsMaterial;
  private dustWispsBasePos!: Float32Array;
  private dustWispsPhase!: Float32Array;
  private skyElapsed = 0;
  private weatherIdx = 0;
  private weatherTimer = 0;
  private nextDecalIdx = 0;
  private nextDustIdx = 0;

  // Dynamic entities
  private enemies: EnemyEntity[] = [];
  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;

  // Game state
  private phase: GamePhase = 'title';
  private difficulty: DifficultyId = 'normal';
  private mapId: MapId = 'west';
  private endless = false;
  private wave = 1;
  private score = 0;
  private bestScore = 0;
  private eliminations = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private waveClearDelay = 0;
  private waveBanner: string | null = null;
  private waveBannerTimer = 0;
  private pickupNotice: string | null = null;
  private pickupNoticeTimer = 0;

  // 10 km² Battle Royale Island & C-130 Hercules Airdrop State
  private brStage: BattleRoyaleDeployStage = 'grounded';
  private brAirplane: TransportAirplaneRig | null = null;
  private brPlayerRig: PlayerSkydiverRig | null = null;
  private brStormWall: THREE.Mesh | null = null;
  private brTotalCombatants: number = WORLD_CONFIG.totalBattleRoyaleCombatants;
  private brAliveCount: number = WORLD_CONFIG.totalBattleRoyaleCombatants;
  private readonly brParatroopers: Array<{
    enemy: EnemyEntity;
    parachute: THREE.Group;
    targetX: number;
    targetZ: number;
  }> = [];
  private activeSeed: number = WORLD_CONFIG.defaultSeed;
  private placement = 0;
  private damageDealt = 0;
  private survivalTimeSec = 0;
  private inventoryOpen = false;
  private prone = false;
  private swimming = false;
  private underwater = false;
  private readonly proneEyeHeight = SIMULATION_CONFIG.proneEyeHeight;
  private sprintToggled = false;
  private crouchToggled = false;
  private waypoint: { x: number; z: number } | null = null;
  private coastlinePolygon: Array<[number, number]> = [];
  private islandPolygons: IslandOutlinePolygon[] = [];
  private riverPolyline: Array<[number, number]> = [];
  private spectatorActive = false;
  private spectatorIdx = 0;
  private islandBotSkirmishTimer = 7.5;

  // Player state (starts on Main Street looking straight down the heart of WEST)
  private readonly playerPos = new THREE.Vector3(-15, 0, 1.4);
  private readonly playerVel = new THREE.Vector3();
  private readonly playerRadius = 0.56;
  private readonly standEyeHeight = 1.68;
  private readonly crouchEyeHeight = 1.12;
  private readonly playerBody: DynamicCapsuleBody;
  private currentEyeHeight = 1.68;
  private crouching = false;
  private sprinting = false;
  private strideBobPhase = 0;
  private strafeRoll = 0;
  private yaw = -Math.PI / 2;
  private pitch = 0;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private planeBoostAudio: HTMLAudioElement | null = null;
  private planeFlightAudio: HTMLAudioElement | null = null;
  private stepTimer = 0;
  private health = 100;
  private readonly maxHealth = 100;
  private shield = 50;
  private readonly maxShield = 50;
  private timeSinceDamaged = 10;
  private outOfCombatSec = 10;
  private healthRegenActive = false;
  private tacticalMapOpen = false;
  private matchTimeSec = 0;
  private killFeed: Array<KillFeedEntry & { ttl: number }> = [];
  private nextKillFeedId = 1;

  // Dash ability state
  private readonly dashDir = new THREE.Vector3();
  private dashTimer = 0;
  private readonly dashDuration = 0.17;
  private dashCooldown = 0;
  private readonly dashCooldownMax = 2.2;
  private dashFovBoost = 0;
  private dashRollTilt = 0;
  private dashVfx = 0;

  // Tactical Combat Slide & Landing Compression state
  private slideTimer = 0;
  private readonly slideDuration = 0.38;
  private readonly slideDir = new THREE.Vector3(0, 0, -1);
  private slideRoll = 0;
  private landingDip = 0;
  private landingDipVel = 0;
  private recoilRecoveryPitch = 0;

  // Weapon & Optical Sniper Scope state
  private weaponId: WeaponId = 'carbine';
  private loadout: Loadout = normalizeLoadout(DEFAULT_LOADOUT);
  private ammoMap = Object.fromEntries(Object.values(WEAPON_SPECS).map(s => [s.id, s.magSize])) as Record<WeaponId, number>;
  private reserveMap = Object.fromEntries(Object.values(WEAPON_SPECS).map(s => [s.id, s.reserveMax])) as Record<WeaponId, number>;
  private grenadesRemaining = 3;
  private grenadeCooldown = 0;
  private pendingGrenade: {kind: GrenadeId; delay: number} | null = null;
  private ordnance: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>; velocity: THREE.Vector3; fuse: number; kind: GrenadeId | 'rocket'; source: WeaponId | GrenadeId; radius: number; damage: number }[] = [];
  private zones: { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>; kind: 'smoke' | 'molotov'; life: number; pulse: number; radius: number }[] = [];
  private stunnedEnemies = new Map<number, number>();
  private fireCooldown = 0;
  private reloading = false;
  private reloadTimer = 0;
  private reloadDuration = WEAPON_SPECS.carbine.reloadTime;
  private reloadIsEmpty = false;
  private reloadAudioStage = 0;
  private inspectHeld = false;
  private inspectingActive = false;
  private inspectCycleElapsed = 0;
  private inspectCheckPlayedCycle = -1;
  private dynamicSpread = 0;
  private scopeAlpha = 0;
  private scopeZoomLevel: 6 | 10 = 6;
  private scopeSwayPhase = 0;
  private scopeSwayX = 0;
  private scopeSwayY = 0;
  private breathSteady = false;

  // Touch & Weapon input fields delegated to InputManager / InventorySystem above.

  // Frame pacing & zero-allocation caches
  private smoothedDt = 1 / 60;
  private weatherHoldApplied = false;
  private readonly enemyTargetsCache: THREE.Object3D[] = [];

  // Feedback & juice
  private shakeClock = 0;
  private shakeTrauma = 0;
  private gunShakeTrauma = 0;
  private gunKickPitch = 0;
  private gunKickYaw = 0;
  private gunKickRoll = 0;
  private gunKickBack = 0;
  private gunShotParity = 1;
  private damageShakeTrauma = 0;
  private damagePunchPitch = 0;
  private damagePunchYaw = 0;
  private damagePunchRoll = 0;
  private damagePunchRight = 0;
  private damagePunchUp = 0;
  private damagePunchBack = 0;
  private damageFovPunch = 0;
  private hudShakeX = 0;
  private hudShakeY = 0;
  private hudShakeRot = 0;
  private damageFlash = 0;
  private damageAberration = 0;
  private hitMarkerTimer = 0;
  private hitMarkerDuration = 0.22;
  private hitMarkerCrit = false;
  private hitMarkerKill = false;
  private hitMarkerArmor = false;
  private hitMarkerArmorBreak = false;
  private hitMarkerSeq = 0;
  private crosshairDamagePops: CrosshairDamagePop[] = [];
  private landingAudioCooldown = 0;
  private damagePopSeq = 0;
  private damageArcTimer = 0;
  private damageArcAngle = 0;

  // Settings & loop lifecycle
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_GAME_SETTINGS.controls } };
  private hudEmitAccum = 0;
  private titleOrbitAngle = 0.4;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  // Shared disposable geometries/materials for pools
  private readonly poolGeos: THREE.BufferGeometry[] = [];
  private readonly poolMats: THREE.Material[] = [];

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onContextLost: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLost = onContextLost;
    this.audio = new TacticalAudio();
    this.audio.setDynamicRange(this.settings.audioDynamicRange);

    try {
      const saved = window.localStorage.getItem(BEST_SCORE_KEY);
      if (saved) this.bestScore = Math.max(0, parseInt(saved, 10) || 0);
    } catch {
      // Ignore storage errors in sandboxed iframes
    }

    this.isSoftwareGl = detectSoftwareWebGL();
    const { renderer, nativePixelRatio, gpuName } = createConfiguredRenderer(
      container,
      this.isSoftwareGl,
      this.settings.resolutionScale,
    );
    this.renderer = renderer;
    this.nativePixelRatio = nativePixelRatio;
    this.gpuName = gpuName;
    const pixelRatio = this.nativePixelRatio * this.settings.resolutionScale;
    this.renderQuality = new AdaptiveRenderQuality(pixelRatio, this.settings.targetFps, this.nativePixelRatio * 0.7);
    this.gpuTimer = new GpuFrameTimer(this.renderer.getContext() as WebGL2RenderingContext);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Asset manager & procedural PBR textures
    this.assetManager = new AssetManager(Math.min(this.settings.textureFiltering, this.renderer.capabilities.getMaxAnisotropy()));
    this.textures = this.assetManager.textures;

    // Scene, Camera & Analytical Atmospheric Sky Dome
    this.scene = new THREE.Scene();
    this.sceneBgColor = new THREE.Color(0xdec096);
    this.scene.background = this.sceneBgColor;
    this.sceneFog = new THREE.FogExp2(0xdec096, 0.0044);
    this.scene.fog = this.sceneFog;

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, width / height, 0.06, 360);
    this.scene.add(this.camera);
    this.audio.attachSpatialAmbient(this.scene, this.camera);

    // Depth-isolated viewmodel overlay scene & camera
    this.weaponScene = new THREE.Scene();
    this.weaponCamera = new THREE.PerspectiveCamera(this.settings.fov, width / height, 0.02, 12);
    this.weaponScene.add(this.weaponCamera);

    // Lighting rig & analytical sky dome
    this.lightingRig = new LightingRig(this.renderer, this.scene, this.weaponScene);
    this.skySystem = new SkySystem(this.scene, this.textures.sunCorona);
    this.lootManager = new LootManager(this.scene);

    // Complete Enterable WEST Town initial arena, Physics World & Occlusion Culler
    this.arena = buildWestTownArena(this.textures);
    this.scene.add(this.arena.group);

    this.physics = new PhysicsWorld(this.arena);
    this.occlusion = new OcclusionCullingSystem(this.arena);
    this.arena.group.userData.staticBatching = this.arena.optimizeRendering();
    const animatedRoots = new Set<THREE.Object3D>(this.arena.animatedProps.tumbleweeds.map(item => item.mesh));
    if (this.arena.animatedProps.windmillWheel) animatedRoots.add(this.arena.animatedProps.windmillWheel);
    if (this.arena.animatedProps.flagMesh) animatedRoots.add(this.arena.animatedProps.flagMesh);
    this.staticBatches = new StaticSceneBatches(this.arena.group, animatedRoots);
    this.raycaster.layers.enable(31);
    this.footRaycaster.layers.enable(31);
    this.playerBody = PhysicsWorld.createCapsuleBody(
      this.playerPos,
      this.playerVel,
      this.playerRadius,
      this.standEyeHeight + 0.16,
      0.32,
    );

    this.weaponRig = new FirstPersonWeaponRig(this.textures);
    this.weaponCamera.add(this.weaponRig.root);
    this.weaponRig.root.visible = false;

    this.enemyFactory = new EnemyFactory(this.textures);

    // Initialize Pooled VFX (Tracers, Particles, Projectiles, Surface Decals, Dust Plumes, Pickups, Ambient Dust)
    this.particleMesh = this.initPools();
    this.initAmbientDesertDust();

    this.applyWeatherBlend(WEATHER_PRESETS.sunny, WEATHER_PRESETS.sunny, 0);
    this.skySystem.syncToCamera(this.camera, false, 0, this.renderer, 1);

    const enemyWarmup = this.enemyFactory.createWarmupGroup();
    this.scene.add(enemyWarmup);
    if (!this.isSoftwareGl) {
      this.weaponRig.root.visible = true;
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.weaponScene, this.weaponCamera);
      this.weaponRig.root.visible = false;
    }
    this.scene.remove(enemyWarmup);

    // Position camera down Main Street and render initial world frame
    this.camera.position.set(-15, 2.2, 1.4);
    this.camera.lookAt(12, 1.8, 1.4);
    this.skySystem.syncToCamera(this.camera, false, 0, this.renderer, 0.016);
    this.staticBatches.updateVisibility();
    this.renderer.render(this.scene, this.camera);

    // Centralized input manager & single fixed-timestep GameLoop
    this.input = new InputManager(this.renderer.domElement, {
      isPlaying: () => this.phase === 'playing',
      isPaused: () => this.phase === 'paused',
      isOverlayOpen: () => this.tacticalMapOpen || this.inventoryOpen,
      onKeyActionDown: (code, repeat) => this.handleEngineKeyDown(code, repeat),
      onKeyActionUp: (code) => this.handleEngineKeyUp(code),
      onLookDelta: (dx, dy) => this.applyMouseLookDelta(dx, dy),
      onMouseDown: () => {
        if (this.spectatorActive && this.phase === 'playing') {
          this.cycleSpectatorTarget();
        }
      },
      onMouseUp: () => {},
      onWheel: (deltaY) => this.handleMouseWheel(deltaY),
      onPointerLockChange: (locked, wasLocked) => {
        if (wasLocked && !locked && this.phase === 'playing' && !this.tacticalMapOpen && !this.inventoryOpen) {
          this.pauseMission();
        } else {
          this.emitHud(true);
        }
      },
      onFocusLost: () => {
        this.inspectHeld = false;
        this.inspectingActive = false;
        this.weaponRig.setScopeOverlayHidden(false);
        this.scopeAlpha = 0;
      },
      onAudioUnlock: () => this.audio.unlock(),
      onToggleMap: () => this.toggleTacticalMap(),
      onEscapeOrPause: (code) => {
        if (this.inventoryOpen) {
          this.inventoryOpen = false;
          this.requestPointerLockSafe();
          this.emitHud(true);
          return;
        }
        if (this.tacticalMapOpen) {
          this.closeTacticalMap();
          return;
        }
        if (this.phase === 'playing') {
          this.pauseMission();
        } else if (this.phase === 'paused' && code === 'KeyP') {
          this.resumeMission();
        }
      },
    });

    this.bindCanvasEvents();
    this.emitHud(true);

    this.gameLoop = new GameLoop(
      this.isSoftwareGl,
      {
        isForeground: () => document.visibilityState === 'visible',
        isIdle: () => this.phase === 'title',
        fixedStep: (fixedDt) => this.updateSimulation(fixedDt),
        renderFrame: (frameDt, rawMs) => this.renderWorldFrame(frameDt, rawMs),
        idleTick: (dt) => {
          this.audio.updateAmbient(dt, this.playerPos, false, this.currentWeatherWind, false);
        },
      },
      (cb) => window.setTimeout(cb, 16),
    );
    this.gameLoop.start();
  }

  private initPools(): THREE.InstancedMesh {
    // 1. Bullet Tracer Beams (18 pooled)
    const tracerGeo = new THREE.BoxGeometry(0.028, 0.028, 1);
    this.poolGeos.push(tracerGeo);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffc66d,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.poolMats.push(mat);
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, mat, life: 0, maxLife: 0.09 });
    }

    // 2. Pooled Sparks, Wood Splinters, Stone Chips & Earth Clods (220 instances, 1 draw call)
    const particleCount = 220;
    const pGeo = new THREE.BoxGeometry(0.075, 0.055, 0.11);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.poolGeos.push(pGeo);
    this.poolMats.push(pMat);
    const pMesh = new THREE.InstancedMesh(pGeo, pMat, particleCount);
    pMesh.frustumCulled = false;
    pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    _mat4.makeScale(0, 0, 0);
    for (let i = 0; i < particleCount; i++) {
      pMesh.setMatrixAt(i, _mat4);
      pMesh.setColorAt(i, _color.setHex(0xffb84d));
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        rotVel: new THREE.Vector3(),
        scale: 1,
        life: 0,
        maxLife: 0.4,
        gravity: 14,
      });
    }
    pMesh.instanceMatrix.needsUpdate = true;
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    this.scene.add(pMesh);

    // 3. Enemy Plasma Bolts (28 pooled)
    const boltGeo = new THREE.CapsuleGeometry(0.11, 0.55, 6, 8);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0xff5436,
    });
    this.poolGeos.push(boltGeo);
    this.poolMats.push(boltMat);

    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 14,
        life: 0,
      });
    }

    // 4. Surface-Aware Textured Bullet Impact Hole Decals (42 pooled, flicker-free polygonOffset)
    const decalGeo = new THREE.PlaneGeometry(0.28, 0.28);
    const makeDecalMat = (map: THREE.CanvasTexture) =>
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.04,
        opacity: 0.94,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -4,
      });
    this.decalWoodMat = makeDecalMat(this.textures.bulletHoleWood);
    this.decalStoneMat = makeDecalMat(this.textures.bulletHoleStone);
    this.decalMetalMat = makeDecalMat(this.textures.bulletHoleMetal);
    this.poolGeos.push(decalGeo);
    this.poolMats.push(this.decalWoodMat, this.decalStoneMat, this.decalMetalMat);
    for (let i = 0; i < 42; i++) {
      const d = new THREE.Mesh(decalGeo, this.decalWoodMat);
      d.renderOrder = 3;
      d.visible = false;
      this.scene.add(d);
      this.impactDecals.push(d);
    }

    // 5. High-Craft Composite 3D Supply Pickups (6 pooled: 3 Tactical Med-Cases, 3 Mil-Spec Brass Ammo Crates)
    const healthBodyMat = new THREE.MeshStandardMaterial({
      color: 0xedf2f7,
      roughness: 0.36,
      metalness: 0.16,
      roughnessMap: this.textures.gunMetalRoughness,
    });
    const healthTrimMat = new THREE.MeshStandardMaterial({
      color: 0x242c37,
      roughness: 0.44,
      metalness: 0.72,
    });
    const healthGlowMat = new THREE.MeshStandardMaterial({
      color: 0x26e595,
      emissive: 0x12c97a,
      emissiveIntensity: 1.55,
      roughness: 0.22,
    });
    const ammoBodyMat = new THREE.MeshStandardMaterial({
      color: 0x3b4539,
      roughness: 0.48,
      metalness: 0.68,
      roughnessMap: this.textures.gunMetalRoughness,
    });
    const ammoBrassMat = new THREE.MeshStandardMaterial({
      color: 0xc99c4a,
      roughness: 0.32,
      metalness: 0.88,
    });
    const ammoDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.5,
      metalness: 0.78,
    });
    const ammoGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf7ae2b,
      emissive: 0xe68a00,
      emissiveIntensity: 1.45,
      roughness: 0.24,
    });
    this.poolMats.push(
      healthBodyMat,
      healthTrimMat,
      healthGlowMat,
      ammoBodyMat,
      ammoBrassMat,
      ammoDarkMat,
      ammoGlowMat,
    );

    // Shared composite pickup geometries
    const medMainGeo = new THREE.BoxGeometry(0.64, 0.32, 0.44);
    const medLidGeo = new THREE.BoxGeometry(0.67, 0.08, 0.47);
    const medSeamGeo = new THREE.BoxGeometry(0.66, 0.025, 0.46);
    const medCornerGeo = new THREE.BoxGeometry(0.11, 0.35, 0.11);
    const medLatchGeo = new THREE.BoxGeometry(0.07, 0.12, 0.04);
    const medBezelGeo = new THREE.BoxGeometry(0.32, 0.24, 0.46);
    const crossHGeo = new THREE.BoxGeometry(0.24, 0.068, 0.472);
    const crossVGeo = new THREE.BoxGeometry(0.068, 0.2, 0.472);
    const handlePostGeo = new THREE.BoxGeometry(0.04, 0.09, 0.045);
    const handleBarGeo = new THREE.BoxGeometry(0.26, 0.038, 0.05);
    const vialGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.24, 10);

    const ammoMainGeo = new THREE.BoxGeometry(0.68, 0.36, 0.42);
    const ammoLidGeo = new THREE.BoxGeometry(0.72, 0.09, 0.46);
    const ammoRibGeo = new THREE.BoxGeometry(0.04, 0.32, 0.45);
    const ammoStripGeo = new THREE.BoxGeometry(0.42, 0.055, 0.445);
    const ammoShellGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.15, 8);
    const ringGeo = new THREE.TorusGeometry(0.49, 0.032, 8, 28);
    ringGeo.rotateX(Math.PI / 2);

    this.poolGeos.push(
      medMainGeo,
      medLidGeo,
      medSeamGeo,
      medCornerGeo,
      medLatchGeo,
      medBezelGeo,
      crossHGeo,
      crossVGeo,
      handlePostGeo,
      handleBarGeo,
      vialGeo,
      ammoMainGeo,
      ammoLidGeo,
      ammoRibGeo,
      ammoStripGeo,
      ammoShellGeo,
      ringGeo,
    );

    for (let i = 0; i < 6; i++) {
      const kind: 'health' | 'ammo' = i < 3 ? 'health' : 'ammo';
      const g = new THREE.Group();

      if (kind === 'health') {
        const body = new THREE.Mesh(medMainGeo, healthBodyMat);
        body.castShadow = true;
        g.add(body);

        const lid = new THREE.Mesh(medLidGeo, healthBodyMat);
        lid.position.y = 0.18;
        lid.castShadow = true;
        g.add(lid);

        const seam = new THREE.Mesh(medSeamGeo, healthTrimMat);
        seam.position.y = 0.14;
        g.add(seam);

        // 4 armored rubberized corner bumpers
        for (const cx of [-0.285, 0.285]) {
          for (const cz of [-0.185, 0.185]) {
            const bumper = new THREE.Mesh(medCornerGeo, healthTrimMat);
            bumper.position.set(cx, 0.02, cz);
            g.add(bumper);
          }
        }

        // Front & back dark bezel + glowing emerald cross
        const bezel = new THREE.Mesh(medBezelGeo, healthTrimMat);
        bezel.position.y = -0.01;
        g.add(bezel);
        const ch = new THREE.Mesh(crossHGeo, healthGlowMat);
        ch.position.y = -0.01;
        const cv = new THREE.Mesh(crossVGeo, healthGlowMat);
        cv.position.y = -0.01;
        g.add(ch, cv);

        // Metallic clasp latches
        for (const lx of [-0.18, 0.18]) {
          const latchF = new THREE.Mesh(medLatchGeo, healthTrimMat);
          latchF.position.set(lx, 0.12, 0.235);
          const latchB = new THREE.Mesh(medLatchGeo, healthTrimMat);
          latchB.position.set(lx, 0.12, -0.235);
          g.add(latchF, latchB);
        }

        // Top recessed carry handle
        const postL = new THREE.Mesh(handlePostGeo, healthTrimMat);
        postL.position.set(-0.11, 0.255, 0);
        const postR = new THREE.Mesh(handlePostGeo, healthTrimMat);
        postR.position.set(0.11, 0.255, 0);
        const bar = new THREE.Mesh(handleBarGeo, healthTrimMat);
        bar.position.set(0, 0.295, 0);
        g.add(postL, postR, bar);

        // Side glowing serum vials
        for (const sx of [-0.335, 0.335]) {
          const vial = new THREE.Mesh(vialGeo, healthGlowMat);
          vial.position.set(sx, 0, 0);
          g.add(vial);
        }
      } else {
        const body = new THREE.Mesh(ammoMainGeo, ammoBodyMat);
        body.castShadow = true;
        g.add(body);

        const lid = new THREE.Mesh(ammoLidGeo, ammoDarkMat);
        lid.position.y = 0.205;
        lid.castShadow = true;
        g.add(lid);

        // 3 stamped steel structural ribs
        for (const rx of [-0.22, 0, 0.22]) {
          const rib = new THREE.Mesh(ammoRibGeo, ammoDarkMat);
          rib.position.set(rx, -0.01, 0);
          g.add(rib);
        }

        // Brass clamp latches on front & back
        for (const lx of [-0.21, 0.21]) {
          const claspF = new THREE.Mesh(medLatchGeo, ammoBrassMat);
          claspF.position.set(lx, 0.14, 0.23);
          const claspB = new THREE.Mesh(medLatchGeo, ammoBrassMat);
          claspB.position.set(lx, 0.14, -0.23);
          g.add(claspF, claspB);
        }

        // Top carry bail handle
        const postL = new THREE.Mesh(handlePostGeo, ammoBrassMat);
        postL.position.set(-0.12, 0.285, 0);
        const postR = new THREE.Mesh(handlePostGeo, ammoBrassMat);
        postR.position.set(0.12, 0.285, 0);
        const bar = new THREE.Mesh(handleBarGeo, ammoDarkMat);
        bar.position.set(0, 0.325, 0);
        g.add(postL, postR, bar);

        // Illuminated amber caliber indicator strip + side brass cartridge bars
        const strip = new THREE.Mesh(ammoStripGeo, ammoGlowMat);
        strip.position.y = -0.02;
        g.add(strip);

        for (const sx of [-0.355, 0.355]) {
          for (const sz of [-0.07, 0, 0.07]) {
            const shell = new THREE.Mesh(ammoShellGeo, ammoBrassMat);
            shell.position.set(sx, 0.01, sz);
            g.add(shell);
          }
        }
      }

      const ring = new THREE.Mesh(ringGeo, kind === 'health' ? healthGlowMat : ammoGlowMat);
      ring.position.y = -0.28;
      g.add(ring);

      g.visible = false;
      this.scene.add(g);
      this.pickups.push({
        active: false,
        kind,
        group: g,
        pos: new THREE.Vector3(),
        phase: i * 1.1,
      });
    }

    // 6. Floating 3D Damage Indicator Sprite Pool (18 reusable canvas-backed sprites)
    for (let i = 0; i < 18; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;

      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 24;
      this.scene.add(sprite);

      this.damageNumbers.push({
        active: false,
        sprite,
        mat,
        canvas,
        ctx,
        tex,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        baseScale: 0.7,
        life: 0,
        maxLife: 0.85,
      });
    }

    // 7. Expanding Billowing Impact Dust & Smoke Plume Pool (30 sprites)
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.dustPuff,
        color: 0xd6b07c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.scene.add(sprite);
      this.impactDust.push({
        active: false,
        sprite,
        mat,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        baseScale: 0.25,
        maxScale: 1.2,
        baseOpacity: 0.7,
        life: 0,
        maxLife: 0.55,
      });
    }

    return pMesh;
  }

  private initAmbientDesertDust() {
    // Layer 1: Sunlit drifting desert dust motes (260 golden particles around the player)
    const moteCount = 260;
    const motePos = new Float32Array(moteCount * 3);
    this.dustMotesBasePos = new Float32Array(moteCount * 3);
    this.dustMotesPhase = new Float32Array(moteCount);

    for (let i = 0; i < moteCount; i++) {
      const x = (Math.random() - 0.5) * 64;
      const y = 0.5 + Math.random() * 13.5;
      const z = (Math.random() - 0.5) * 64;
      this.dustMotesBasePos[i * 3] = x;
      this.dustMotesBasePos[i * 3 + 1] = y;
      this.dustMotesBasePos[i * 3 + 2] = z;
      motePos[i * 3] = x;
      motePos[i * 3 + 1] = y;
      motePos[i * 3 + 2] = z;
      this.dustMotesPhase[i] = Math.random() * Math.PI * 2;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      map: this.textures.dustMote,
      color: 0xffe4b3,
      size: 0.24,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dustMotesMat = moteMat;
    this.poolGeos.push(moteGeo);
    this.poolMats.push(moteMat);
    this.dustMotesPoints = new THREE.Points(moteGeo, moteMat);
    this.dustMotesPoints.frustumCulled = false;
    this.scene.add(this.dustMotesPoints);

    // Layer 2: Low-altitude wind-swept desert dust & fog wisps skimming Main Street
    const wispCount = 42;
    const wispPos = new Float32Array(wispCount * 3);
    this.dustWispsBasePos = new Float32Array(wispCount * 3);
    this.dustWispsPhase = new Float32Array(wispCount);

    for (let i = 0; i < wispCount; i++) {
      const x = (Math.random() - 0.5) * 76;
      const y = 0.8 + Math.random() * 3.8;
      const z = (Math.random() - 0.5) * 76;
      this.dustWispsBasePos[i * 3] = x;
      this.dustWispsBasePos[i * 3 + 1] = y;
      this.dustWispsBasePos[i * 3 + 2] = z;
      wispPos[i * 3] = x;
      wispPos[i * 3 + 1] = y;
      wispPos[i * 3 + 2] = z;
      this.dustWispsPhase[i] = Math.random() * Math.PI * 2;
    }

    const wispGeo = new THREE.BufferGeometry();
    wispGeo.setAttribute('position', new THREE.BufferAttribute(wispPos, 3));
    const wispMat = new THREE.PointsMaterial({
      map: this.textures.dustPuff,
      color: 0xe2c191,
      size: 4.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    this.dustWispsMat = wispMat;
    this.poolGeos.push(wispGeo);
    this.poolMats.push(wispMat);
    this.dustWispsPoints = new THREE.Points(wispGeo, wispMat);
    this.dustWispsPoints.frustumCulled = false;
    this.scene.add(this.dustWispsPoints);
  }

  private clearEnemies() {
    for (const pt of this.brParatroopers) {
      if (pt.parachute.parent) pt.parachute.parent.remove(pt.parachute);
    }
    this.brParatroopers.length = 0;
    for (const e of this.enemies) {
      this.scene.remove(e.root);
      this.enemyFactory.disposeEnemyMaterials(e);
    }
    this.enemies = [];
    this.spawnQueue = [];
  }

  /**
   * Dynamically switches between the 10 km² 3D Battle Royale Island ('island') and the Frontier Town ('west').
   */
  private ensureArenaLoaded(targetMapId: MapId, seed: number = WORLD_CONFIG.defaultSeed) {
    const seedChanged = targetMapId === 'island' && seed !== this.activeSeed;
    if (this.loadedArenaMapId === targetMapId && !seedChanged) return;

    this.clearEnemies();
    this.clearProjectilesAndPickups();
    this.lootManager.clear();
    this.staticBatches.dispose();
    this.scene.remove(this.arena.group);
    this.arena.dispose();

    this.loadedArenaMapId = targetMapId;
    this.activeSeed = seed;
    if (targetMapId === 'island') {
      this.islandArena = buildBattleRoyaleIslandArena(this.textures, seed);
      this.arena = this.islandArena;
      this.coastlinePolygon = buildCoastlinePolygon();
      this.islandPolygons = buildIslandPolygons();
      this.riverPolyline = buildRiverPolyline();
    } else {
      this.islandArena = null;
      this.coastlinePolygon = [];
      this.islandPolygons = [];
      this.riverPolyline = [];
      this.arena = buildWestTownArena(this.textures);
    }
    this.scene.add(this.arena.group);

    this.physics = new PhysicsWorld(this.arena);
    this.occlusion = new OcclusionCullingSystem(this.arena);
    this.arena.group.userData.staticBatching = this.arena.optimizeRendering();
    const animatedRoots = new Set<THREE.Object3D>(this.arena.animatedProps.tumbleweeds.map((item) => item.mesh));
    if (this.arena.animatedProps.windmillWheel) animatedRoots.add(this.arena.animatedProps.windmillWheel);
    if (this.arena.animatedProps.flagMesh) animatedRoots.add(this.arena.animatedProps.flagMesh);
    this.staticBatches = new StaticSceneBatches(this.arena.group, animatedRoots);

    this.camera.far = getViewDistanceFarPlane(targetMapId, this.settings.viewDistance);
    this.saloonGlow.visible = targetMapId !== 'island';
    this.forgeGlow.visible = targetMapId !== 'island';
    this.applyTimeOfDayPreset();
    this.skySystem.syncToCamera(this.camera, targetMapId === 'island', this.skyElapsed, this.renderer, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = !this.isSoftwareGl && this.settings.shadowQuality !== 'off';
  }

  private initBattleRoyaleMatch() {
    if (!this.brAirplane) {
      this.brAirplane = buildTransportAirplane(this.textures);
      this.scene.add(this.brAirplane.group);
    }
    if (!this.brPlayerRig) {
      this.brPlayerRig = buildPlayerSkydiverRig();
      this.scene.add(this.brPlayerRig.root);
    }
    if (!this.brStormWall) {
      this.brStormWall = buildStormWallMesh();
      this.scene.add(this.brStormWall);
    }

    const randomMatchSeed = ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || this.activeSeed;
    this.deployment.reset(randomMatchSeed);
    this.storm.reset(randomMatchSeed);
    this.inventory.reset(this.loadout);

    this.brAirplane.group.visible = true;
    this.brAirplane.group.position.copy(this.deployment.planePos);
    this.brAirplane.group.lookAt(this.deployment.planeEnd);
    this.brPlayerRig.root.visible = false;
    this.brPlayerRig.canopyGroup.visible = false;

    this.brStage = 'airdrop_plane';
    this.weaponRig.root.visible = false;

    this.playerPos.copy(this.deployment.planePos);
    this.playerVel.set(0, 0, 0);
    this.grounded = false;
    this.prone = false;
    this.swimming = false;
    this.underwater = false;
    this.spectatorActive = false;
    this.yaw = Math.atan2(-this.deployment.planeDir.x, -this.deployment.planeDir.z);
    this.pitch = -0.36;

    this.brTotalCombatants = WORLD_CONFIG.totalBattleRoyaleCombatants;
    this.brAliveCount = this.brTotalCombatants;
    this.placement = 0;
    this.damageDealt = 0;
    this.survivalTimeSec = 0;
    this.islandBotSkirmishTimer = 7.5;

    this.brStormWall.visible = true;
    this.brStormWall.position.set(this.storm.centerX, 580, this.storm.centerZ);
    this.brStormWall.scale.set(this.storm.radius, 1, this.storm.radius);

    if (this.islandArena) {
      this.lootManager.spawnSeededPoiLoot(this.islandArena.lootAnchors, this.activeSeed);
      this.islandArena.terrainStreamer.update(
        this.playerPos.x,
        this.playerPos.z,
        this.deployment.planeDir.x * this.deployment.planeSpeed,
        this.deployment.planeDir.z * this.deployment.planeSpeed,
        getViewDistanceFarPlane('island', this.settings.viewDistance),
        6,
      );
    }

    for (let i = 0; i < Math.min(6, this.arena.pickupSpots.length); i++) {
      this.spawnPickup(i % 2 === 0 ? 'health' : 'ammo', this.arena.pickupSpots[i]);
    }

    this.lifecycle.transition('aircraft_deployment');
    this.waveBanner = 'C-130 AIRDROP · STANDBY FOR GREEN LIGHT';
    this.waveBannerTimer = 2.6;

    if (typeof Audio !== 'undefined') {
      try {
        this.planeFlightAudio?.pause();
        this.planeBoostAudio?.pause();
        this.planeBoostAudio = new Audio('./sounds/airplane_first_boost.mp3');
        this.planeBoostAudio.volume = 0.65;
        this.planeBoostAudio.play().catch(() => {});

        this.planeFlightAudio = new Audio('./sounds/airplane_in_flight.mp3');
        this.planeFlightAudio.loop = true;
        this.planeFlightAudio.volume = 0.45;
        this.planeFlightAudio.play().catch(() => {});
      } catch {
        // Ignore audio errors in headless environments
      }
    }
  }

  /**
   * Ejects the player from the C-130 Hercules rear cargo ramp into high-altitude 3D freefall.
   */
  public ejectFromTransportPlane(): boolean {
    if (this.mapId !== 'island' || this.brStage !== 'airdrop_plane') return false;
    if (!this.deployment.canJump()) return false;
    this.brStage = 'freefall';
    this.lifecycle.transition('freefall');
    if (this.planeFlightAudio) {
      this.planeFlightAudio.pause();
      this.planeFlightAudio.currentTime = 0;
    }
    this.playerPos
      .copy(this.deployment.planePos)
      .addScaledVector(this.deployment.planeDir, -14)
      .add(_v4.set(0, -3.2, 0));
    this.playerVel.set(this.deployment.planeDir.x * 32, -24, this.deployment.planeDir.z * 32);
    this.grounded = false;
    this.weaponRig.root.visible = false;
    if (this.brPlayerRig) {
      this.brPlayerRig.root.visible = true;
      this.brPlayerRig.root.position.copy(this.playerPos);
      this.brPlayerRig.root.rotation.set(0, this.yaw, 0);
      updateSkydiverRigPose(this.brPlayerRig, 'freefall', 0, 0, this.skyElapsed);
    }
    this.dashFovBoost = 12;
    this.shakeTrauma = 0.28;
    this.audio.playDash();
    this.waveBanner = 'FREEFALL · STEER WASD · [SPACE] PARACHUTE';
    this.waveBannerTimer = 4.0;
    this.emitHud(true);
    return true;
  }

  /**
   * Deploys the player's 3D tactical ram-air parachute during freefall.
   */
  public deployParachute(): boolean {
    if (this.mapId !== 'island' || this.brStage !== 'freefall') return false;
    this.brStage = 'parachute';
    this.lifecycle.transition('parachuting');
    this.playerVel.y = Math.max(this.playerVel.y, -12.5);
    if (this.brPlayerRig) {
      this.brPlayerRig.root.visible = true;
      this.brPlayerRig.root.position.copy(this.playerPos);
      this.brPlayerRig.root.rotation.set(0, this.yaw, 0);
      updateSkydiverRigPose(this.brPlayerRig, 'parachute', 0, 0, this.skyElapsed);
    }
    this.shakeTrauma = 0.22;
    this.audio.playSlide();
    this.waveBanner = 'PARACHUTE DEPLOYED · GLIDE TO DROP ZONE';
    this.waveBannerTimer = 3.2;
    this.emitHud(true);
    return true;
  }

  private spawnAiParatrooperFromPlane() {
    if (this.deployment.botsRemainingToSpawn <= 0) return;
    const activeTotal = this.countAliveEnemies();
    if (activeTotal >= 10) return;

    this.deployment.botsRemainingToSpawn--;
    const poi = ISLAND_POIS[Math.floor(Math.random() * ISLAND_POIS.length)];
    const dropPos = this.deployment.planePos
      .clone()
      .addScaledVector(this.deployment.planeDir, -15)
      .add(new THREE.Vector3((Math.random() - 0.5) * 18, -4 - Math.random() * 6, (Math.random() - 0.5) * 18));

    const archetypes: EnemyKind[] = ['striker', 'striker', 'sentinel'];
    const kind = archetypes[this.deployment.botsRemainingToSpawn % archetypes.length];
    const diffSpec = DIFFICULTY_SPECS[this.difficulty];
    const enemy = this.enemyFactory.createEnemy(kind, dropPos, diffSpec.enemyHpScale);
    this.scene.add(enemy.root);
    this.enemies.push(enemy);

    const canopy = buildTacticalParachute();
    enemy.root.add(canopy);
    this.brParatroopers.push({
      enemy,
      parachute: canopy,
      targetX: poi.x + (Math.random() - 0.5) * 70,
      targetZ: poi.z + (Math.random() - 0.5) * 70,
    });
  }

  // =========================================================================
  // PUBLIC CONTROLS (CALLED BY REACT GAME SHELL)
  // =========================================================================
  public attachNetworkManager(nm: NetworkManager | null) {
    this.networkManager = nm;
    if (nm) {
      nm.setCallbacks({
        onRemoteMessage: (msg, senderId) => this.handleNetworkMessage(msg, senderId),
      });
    }
  }

  private handleNetworkMessage(msg: NetworkMessage, senderId: string) {
    if (!this.remotePlayers && this.phase === 'playing') {
      this.remotePlayers = new RemotePlayerManager(this.scene, this.textures);
    }
    if (!this.remotePlayers) return;

    switch (msg.type) {
      case 'player-state':
        this.remotePlayers.updateNetworkState(msg.state);
        break;
      case 'player-shoot':
        this.remotePlayers.triggerShot(
          msg.playerId,
          msg.weaponId,
          new THREE.Vector3(...msg.origin),
          new THREE.Vector3(...msg.target),
        );
        this.spawnTracer(
          new THREE.Vector3(...msg.origin),
          new THREE.Vector3(...msg.target),
          WEAPON_SPECS[msg.weaponId]?.tracerColor ?? 0xffb347,
        );
        if (msg.weaponId === 'carbine') {
          this.audio.playCarbineShot();
        } else {
          this.audio.playRailShot();
        }
        break;
      case 'player-damage':
        if (msg.targetId === this.networkManager?.localPlayerId) {
          this.applyPlayerDamage(msg.amount, msg.attackerId, msg.attackerName, msg.weaponId, msg.isHeadshot);
        } else {
          this.remotePlayers.triggerDamage(msg.targetId, msg.amount, msg.isHeadshot);
        }
        break;
      case 'player-killed':
        this.killFeed.unshift({
          id: Date.now() + Math.random(),
          killer: msg.killerName,
          victim: msg.victimName,
          weapon: msg.weaponId,
          headshot: msg.isHeadshot,
          ttl: 4.5,
        });
        if (this.killFeed.length > 5) this.killFeed.pop();
        if (msg.victimId !== this.networkManager?.localPlayerId) {
          this.remotePlayers.triggerKilled(msg.victimId);
        }
        if (msg.killerId === this.networkManager?.localPlayerId) {
          this.score += 150;
          this.eliminations++;
          if (msg.isHeadshot) this.headshots++;
          this.audio.playHitMarker(msg.isHeadshot, true);
        }
        break;
      case 'player-respawn':
        this.remotePlayers.triggerRespawn(msg.playerId, new THREE.Vector3(...msg.pos));
        break;
      case 'enemy-damage':
        if (this.multiplayerConfig?.isHost) {
          const enemy = this.enemies.find((e) => e.id === msg.enemyId && e.alive);
          if (enemy) {
            const res = applyArmorHealthDamage(msg.amount, enemy.armor ?? 0, enemy.hp);
            enemy.armor = res.remainingArmor;
            enemy.hp = res.remainingHealth;
            if (enemy.hp <= 0) {
              enemy.alive = false;
              enemy.deathTimer = 0;
              this.score += enemy.scoreValue;
              this.killFeed.unshift({
                id: Date.now() + Math.random(),
                killer: this.networkManager?.players.find((p) => p.id === msg.shooterId)?.name ?? 'Operative',
                victim: enemy.displayName,
                weapon: msg.weaponId,
                headshot: msg.isHeadshot,
                ttl: 4.5,
              });
              if (this.killFeed.length > 5) this.killFeed.pop();
            }
          }
        }
        break;
      case 'enemy-sync':
        if (!this.multiplayerConfig?.isHost) {
          if (msg.wave !== this.wave) {
            this.wave = msg.wave;
            this.waveBanner = `WAVE ${msg.wave}`;
            this.waveBannerTimer = 2.5;
          }
          for (const netE of msg.enemies) {
            let localE = this.enemies.find((e) => e.id === netE.id);
            if (!localE && netE.alive) {
              localE = this.enemyFactory.createEnemy(netE.kind, new THREE.Vector3(...netE.pos), 1);
              localE.id = netE.id;
              this.scene.add(localE.root);
              this.enemies.push(localE);
            }
            if (localE) {
              localE.root.position.set(netE.pos[0], netE.pos[1], netE.pos[2]);
              localE.root.rotation.y = netE.yaw;
              localE.hp = netE.hp;
              localE.maxHp = netE.maxHp;
              localE.alive = netE.alive;
              if (!netE.alive && localE.root.parent) {
                this.scene.remove(localE.root);
              }
            }
          }
        }
        break;
      case 'wave-start':
        this.wave = msg.wave;
        this.waveBanner = `WAVE ${msg.wave}`;
        this.waveBannerTimer = 2.5;
        break;
    }
  }

  public startMission(config?: Partial<MissionConfig>) {
    this.audio.unlock();
    if (config?.difficulty) this.difficulty = config.difficulty;
    if (config?.mapId) this.mapId = config.mapId;
    const seed = config?.seed ?? WORLD_CONFIG.defaultSeed;
    this.lifecycle.beginNewMatch();
    this.ensureArenaLoaded(this.mapId, seed);
    this.loadout = normalizeLoadout(config?.loadout ?? this.loadout);
    this.endless = Boolean(config?.endless);
    this.resetCombatState();
    this.frameMetrics.reset();
    this.phase = 'playing';

    if (this.mapId === 'island') {
      this.multiplayerConfig = null;
      this.initBattleRoyaleMatch();
      this.requestPointerLockSafe();
      this.emitHud(true);
      return;
    }

    if (this.brAirplane) this.brAirplane.group.visible = false;
    if (this.brPlayerRig) this.brPlayerRig.root.visible = false;
    if (this.brStormWall) this.brStormWall.visible = false;
    this.brStage = 'grounded';
    this.lifecycle.transition('active_match');
    this.weaponRig.root.visible = true;

    if (config?.multiplayer) {
      this.multiplayerConfig = config.multiplayer;
      if (!this.remotePlayers) {
        this.remotePlayers = new RemotePlayerManager(this.scene, this.textures);
      }
      if (this.networkManager) {
        for (const p of this.networkManager.players) {
          if (p.id !== this.networkManager.localPlayerId) {
            this.remotePlayers.addOrUpdatePlayer(p);
          }
        }
      }
      const spawnIndex = config.multiplayer.spawnIndex ?? 0;
      const startPositions = [
        new THREE.Vector3(-15, 0, 1.4),
        new THREE.Vector3(-15, 0, 5.0),
        new THREE.Vector3(-18, 0, 1.4),
        new THREE.Vector3(-18, 0, 5.0),
      ];
      this.playerPos.copy(startPositions[spawnIndex % startPositions.length]);

      if (config.multiplayer.mode === 'deathmatch') {
        this.clearEnemies();
        this.matchTimeRemaining = config.multiplayer.timeLimitSec || 360;
        this.waveBanner = `DEATHMATCH · FIRST TO ${config.multiplayer.killLimit || 15} KILLS`;
        this.waveBannerTimer = 3.5;
      } else {
        if (config.multiplayer.isHost) {
          this.startWave(1);
        } else {
          this.clearEnemies();
          this.waveBanner = 'CO-OP SURVIVAL · SQUAD ASSEMBLED';
          this.waveBannerTimer = 3.0;
        }
      }
    } else {
      this.multiplayerConfig = null;
      this.startWave(1);
    }

    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public continueEndless() {
    this.audio.unlock();
    this.endless = true;
    this.phase = 'playing';
    this.lifecycle.transition('active_match');
    this.weaponRig.root.visible = true;
    this.health = Math.min(this.maxHealth, this.health + 40);
    this.shield = this.maxShield;
    this.startWave(this.wave + 1);
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public resumeMission() {
    if (this.phase !== 'paused') return;
    this.audio.unlock();
    this.lifecycle.resume();
    this.phase = 'playing';
    this.clearInputs();
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public pauseMission() {
    if (this.phase !== 'playing') return;
    this.lifecycle.pause();
    this.phase = 'paused';
    this.clearInputs();
    this.exitPointerLockSafe();
    this.emitHud(true);
  }

  public returnToTitle() {
    this.lifecycle.forceResetToMenu();
    this.phase = 'title';
    this.spectatorActive = false;
    this.clearInputs();
    this.exitPointerLockSafe();
    this.weaponRig.root.visible = false;
    this.clearEnemies();
    this.clearProjectilesAndPickups();
    this.lootManager.clear();
    if (this.remotePlayers) {
      this.remotePlayers.dispose();
      this.remotePlayers = null;
    }
    this.multiplayerConfig = null;
    this.emitHud(true);
  }

  public updateSettings(next: Partial<GameSettings>) {
    this.settings = {
      ...this.settings,
      ...next,
      controls: next.controls ? { ...next.controls } : this.settings.controls,
    };
    this.audio.setMuted(this.settings.muted);
    this.audio.setDynamicRange(this.settings.audioDynamicRange);
    this.applyGraphicsSettings();
  }

  private controlIsHeld(action: keyof GameSettings['controls']) {
    return this.heldKeys.has(this.settings.controls[action]);
  }

  private applyTimeOfDayPreset(): void {
    const dir = this.settings.timeOfDay === 'golden' ? GOLDEN_SUN_DIRECTION : SUN_DIRECTION;
    this.skySystem.setSunDirection(dir);
    if (this.settings.timeOfDay === 'overcast') {
      this.weatherIdx = 1;
      this.weatherTimer = 0;
      this.weatherHoldApplied = false;
      this.applyWeatherBlend(WEATHER_PRESETS.overcast, WEATHER_PRESETS.overcast, 0);
    } else if (this.settings.timeOfDay === 'golden') {
      this.weatherIdx = 0;
      this.weatherTimer = 0;
      this.weatherHoldApplied = false;
      this.applyWeatherBlend(WEATHER_PRESETS.sunny, WEATHER_PRESETS.sunny, 0);
      this.sunLight.color.setHex(0xffd093);
      this.skyMat.uniforms.uHorizonColor.value.setHex(0xe8b57e);
    } else {
      this.weatherIdx = 0;
      this.weatherTimer = 0;
      this.weatherHoldApplied = false;
      this.applyWeatherBlend(WEATHER_PRESETS.sunny, WEATHER_PRESETS.sunny, 0);
    }
    this.lightingRig.syncWeaponLights(this.scene.environmentIntensity, this.weaponScene);
  }

  private applyGraphicsSettings() {
    const ceiling = this.nativePixelRatio * this.settings.resolutionScale;
    const minimumScale = this.settings.graphicsPreset === 'quality' || this.settings.graphicsPreset === 'ultra'
      ? 0.85
      : this.settings.graphicsPreset === 'performance' ? 0.55 : 0.72;
    const floor = this.nativePixelRatio * Math.min(this.settings.resolutionScale, minimumScale);
    this.renderQuality = new AdaptiveRenderQuality(ceiling, this.settings.targetFps, floor);
    this.renderer.setPixelRatio(ceiling);

    applyShadowQuality(this.renderer, this.sunLight, this.settings.shadowQuality, this.isSoftwareGl);
    this.camera.far = getViewDistanceFarPlane(this.mapId, this.settings.viewDistance);
    this.camera.fov = this.settings.fov;
    this.weaponCamera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.updateProjectionMatrix();

    const maxFiltering = Math.min(this.settings.textureFiltering, this.renderer.capabilities.getMaxAnisotropy());
    this.assetManager.setTextureAnisotropy(maxFiltering);
    this.applyTimeOfDayPreset();
    this.handleResize();
    this.emitHud(true);
  }

  // Mobile Touch & HUD Action API
  public setTouchMove(x: number, y: number) {
    this.input.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.input.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addTouchLook(dx: number, dy: number) {
    if (this.phase !== 'playing') return;
    const fovScale = THREE.MathUtils.clamp(this.camera.fov / 75, 0.14, 1.0);
    const sens = 0.0044 * this.settings.sensitivity * fovScale;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.42, 1.42);
    if (dy > 0 && this.recoilRecoveryPitch > 0) {
      this.recoilRecoveryPitch = Math.max(0, this.recoilRecoveryPitch - dy * sens);
    }
    this.lookDeltaX += dx * 1.4;
    this.lookDeltaY += dy * 1.4;
  }

  public setTouchFire(held: boolean) {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (held && !this.touchFireHeld) {
      this.fireJustPressed = true;
    }
    this.touchFireHeld = held;
  }

  public toggleTouchAds() {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    this.touchAdsActive = !this.touchAdsActive;
    if (this.touchAdsActive) this.touchSprintLock = false;
    this.emitHud(true);
  }

  public setTouchAds(active: boolean) {
    this.touchAdsActive = active;
    if (active) this.touchSprintLock = false;
    this.emitHud(true);
  }

  public setTouchSprint(active: boolean) {
    this.touchSprintLock = active;
    if (active) {
      this.touchAdsActive = false;
      this.crouching = false;
    }
    this.emitHud(true);
  }

  public triggerTouchJump() {
    if (this.phase !== 'playing') return;
    this.audio.unlock();
    if (this.mapId === 'island') {
      if (this.brStage === 'airdrop_plane') {
        this.ejectFromTransportPlane();
        return;
      }
      if (this.brStage === 'freefall') {
        this.deployParachute();
        return;
      }
    }
    if (this.crouching) {
      this.crouching = false;
      return;
    }
    this.jumpBufferTimer = 0.14;
  }

  public toggleCrouch() {
    if (this.phase !== 'playing') return;
    if (!this.crouching && this.tryStartSlide()) {
      return;
    }
    this.crouching = !this.crouching;
    if (this.crouching) {
      this.touchSprintLock = false;
    } else {
      this.slideTimer = 0;
    }
    this.emitHud(true);
  }

  public setInspectHeld(held: boolean) {
    if (this.phase !== 'playing') {
      this.inspectHeld = false;
      return;
    }
    if (held) {
      this.audio.unlock();
    }
    this.inspectHeld = held;
  }

  public triggerReload() {
    if (this.phase !== 'playing') return;
    this.tryStartReload();
  }

  public triggerDash() {
    if (this.phase !== 'playing') return;
    this.tryActivateDash();
  }

  public selectWeapon(id: WeaponId) {
    if (this.phase !== 'playing') return;
    this.switchWeapon(id);
  }

  public toggleScopeZoom() {
    if (this.phase !== 'playing' || !['railpistol', 'marksman'].includes(this.weaponId)) return;
    this.scopeZoomLevel = this.scopeZoomLevel === 6 ? 10 : 6;
    this.emitHud(true);
  }

  public toggleTacticalMap() {
    if (this.phase !== 'playing') return;
    this.tacticalMapOpen = !this.tacticalMapOpen;
    if (this.tacticalMapOpen) {
      this.inventoryOpen = false;
      this.exitPointerLockSafe();
    } else {
      this.requestPointerLockSafe();
    }
    this.emitHud(true);
  }

  public closeTacticalMap() {
    if (!this.tacticalMapOpen) return;
    this.tacticalMapOpen = false;
    if (this.phase === 'playing') {
      this.requestPointerLockSafe();
    }
    this.emitHud(true);
  }

  public toggleInventory() {
    if (this.phase !== 'playing' || (this.mapId === 'island' && this.brStage !== 'grounded')) return;
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.tacticalMapOpen = false;
      this.exitPointerLockSafe();
    } else {
      this.requestPointerLockSafe();
    }
    this.emitHud(true);
  }

  public toggleProne() {
    if (this.phase !== 'playing' || (this.mapId === 'island' && this.brStage !== 'grounded')) return;
    this.prone = !this.prone;
    if (this.prone) {
      this.crouching = false;
      this.crouchToggled = false;
      this.sprintToggled = false;
      this.touchSprintLock = false;
      this.slideTimer = 0;
    }
    this.emitHud(true);
  }

  public interactLoot(): boolean {
    if (this.phase !== 'playing' || this.mapId !== 'island' || this.brStage !== 'grounded') return false;
    const item = this.lootManager.findClosestInteractable(this.playerPos, 3.0);
    if (!item) return false;
    this.lootManager.consumeItem(item);
    if (item.category === 'weapon' && item.weaponId) {
      const res = this.inventory.equipWeaponPickup(item.weaponId);
      this.loadout = this.inventory.loadout;
      const spec = WEAPON_SPECS[item.weaponId];
      this.ammoMap[item.weaponId] = this.inventory.ammoMap[item.weaponId];
      this.reserveMap[item.weaponId] = this.inventory.reserveMap[item.weaponId];
      if (!res.addedAmmoOnly) {
        this.switchWeapon(item.weaponId);
      }
      this.pickupNotice = res.addedAmmoOnly ? `+AMMO · ${spec.shortLabel}` : `EQUIPPED · ${spec.name}`;
    } else if (item.category === 'armor') {
      const added = this.inventory.addArmorPlate(item.amount);
      if (added === 0 && this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + 25);
        this.pickupNotice = '+25 ARMOR APPLIED';
      } else {
        this.pickupNotice = `+${added || 1} ARMOR PLATE`;
      }
    } else if (item.category === 'medical') {
      const added = this.inventory.addMedkit(item.amount);
      if (added === 0 && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 45);
        this.pickupNotice = '+45 HEALTH APPLIED';
      } else {
        this.pickupNotice = `+${added || 1} FIELD MEDKIT`;
      }
    } else if (item.category === 'grenade' && item.grenadeId) {
      this.inventory.addGrenade(item.grenadeId, item.amount);
      this.loadout = this.inventory.loadout;
      this.grenadesRemaining = this.inventory.grenadesRemaining;
      this.pickupNotice = `+${item.amount} ${GRENADES[item.grenadeId].name.toUpperCase()}`;
    } else {
      for (const wid of inventoryWeapons(this.loadout)) {
        const gain = WEAPON_SPECS[wid].magSize * 2;
        this.reserveMap[wid] = Math.min(WEAPON_SPECS[wid].reserveMax, this.reserveMap[wid] + gain);
        this.inventory.reserveMap[wid] = this.reserveMap[wid];
      }
      this.pickupNotice = '+AMMO RESERVES REPLENISHED';
    }
    this.pickupNoticeTimer = 2.2;
    this.audio.playPickup();
    this.emitHud(true);
    return true;
  }

  public useArmorPlate(): boolean {
    if (this.phase !== 'playing' || this.spectatorActive) return false;
    const gain = this.inventory.consumeArmorPlate(this.shield, this.maxShield);
    if (gain <= 0) return false;
    this.shield = Math.min(this.maxShield, this.shield + gain);
    this.pickupNotice = `ARMOR PLATE INSERTED · +${Math.round(gain)} ARMOR`;
    this.pickupNoticeTimer = 2.0;
    this.audio.playPickup();
    this.emitHud(true);
    return true;
  }

  public useMedkit(): boolean {
    if (this.phase !== 'playing' || this.spectatorActive) return false;
    const gain = this.inventory.consumeMedkit(this.health, this.maxHealth);
    if (gain <= 0) return false;
    this.health = Math.min(this.maxHealth, this.health + gain);
    this.pickupNotice = `MEDKIT APPLIED · +${Math.round(gain)} HP`;
    this.pickupNoticeTimer = 2.0;
    this.audio.playPickup();
    this.emitHud(true);
    return true;
  }

  public dropActiveWeapon(): void {
    // Cycle to next owned weapon while preserving inventory integrity
    const owned = inventoryWeapons(this.loadout);
    if (owned.length <= 1) return;
    const idx = owned.indexOf(this.weaponId);
    const next = owned[(idx + 1) % owned.length];
    this.switchWeapon(next);
  }

  public setWaypoint(x: number, z: number) {
    this.waypoint = { x, z };
    this.emitHud(true);
  }

  public clearWaypoint() {
    this.waypoint = null;
    this.emitHud(true);
  }

  public enterSpectatorMode() {
    if (this.mapId !== 'island') return;
    const aliveEnemies = this.enemies.filter((e) => e.alive);
    if (aliveEnemies.length === 0) return;
    this.spectatorActive = true;
    this.spectatorIdx = 0;
    this.lifecycle.transition('spectating');
    this.phase = 'playing';
    this.weaponRig.root.visible = false;
    this.emitHud(true);
  }

  public cycleSpectatorTarget() {
    const aliveEnemies = this.enemies.filter((e) => e.alive);
    if (!this.spectatorActive || aliveEnemies.length === 0) return;
    this.spectatorIdx = (this.spectatorIdx + 1) % aliveEnemies.length;
    this.emitHud(true);
  }

  private isAdsActive(): boolean {
    return (this.adsHeld || this.touchAdsActive) && !this.reloading && this.grenadeCooldown <= 0.12 && !this.spectatorActive;
  }

  public requestPointerLockSafe() {
    this.input.requestPointerLock();
  }

  private exitPointerLockSafe() {
    this.input.exitPointerLock();
  }

  private resetCombatState() {
    this.clearEnemies();
    this.clearProjectilesAndPickups();
    this.clearInputs();

    this.score = 0;
    this.eliminations = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.wave = 1;
    this.waveClearDelay = 0;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.timeSinceDamaged = 10;
    this.outOfCombatSec = 10;
    this.healthRegenActive = false;
    this.tacticalMapOpen = false;

    this.playerPos.set(-15, 0, 1.4);
    this.playerVel.set(0, 0, 0);
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.grounded = true;
    this.crouching = false;
    this.sprinting = false;
    this.currentEyeHeight = this.standEyeHeight;
    this.strideBobPhase = 0;
    this.strafeRoll = 0;
    this.matchTimeSec = 0;
    this.killFeed = [];

    this.weaponId = this.loadout.primary[0];
    this.weaponRig.setWeapon(this.weaponId);
    this.grenadesRemaining = 3;
    this.grenadeCooldown = 0;
    this.pendingGrenade = null;
    this.weaponRig.cancelGrenadeThrow();
    for (const spec of Object.values(WEAPON_SPECS)) { this.ammoMap[spec.id] = spec.magSize; this.reserveMap[spec.id] = spec.reserveMax; }
    this.weaponRig.setScopeOverlayHidden(false);
    this.scopeAlpha = 0;
    this.scopeZoomLevel = 6;
    this.scopeSwayX = 0;
    this.scopeSwayY = 0;
    this.breathSteady = false;
    this.ammoMap.carbine = WEAPON_SPECS.carbine.magSize;
    this.reserveMap.carbine = WEAPON_SPECS.carbine.reserveMax;
    this.ammoMap.railpistol = WEAPON_SPECS.railpistol.magSize;
    this.reserveMap.railpistol = WEAPON_SPECS.railpistol.reserveMax;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = WEAPON_SPECS.carbine.reloadTime;
    this.reloadIsEmpty = false;
    this.reloadAudioStage = 0;
    this.fireCooldown = 0;
    this.damageFlash = 0;
    this.damageAberration = 0;
    this.shakeTrauma = 0;
    this.gunShakeTrauma = 0;
    this.gunKickPitch = 0;
    this.gunKickYaw = 0;
    this.gunKickRoll = 0;
    this.gunKickBack = 0;
    this.damageShakeTrauma = 0;
    this.damagePunchPitch = 0;
    this.damagePunchYaw = 0;
    this.damagePunchRoll = 0;
    this.damagePunchRight = 0;
    this.damagePunchUp = 0;
    this.damagePunchBack = 0;
    this.damageFovPunch = 0;
    this.hudShakeX = 0;
    this.hudShakeY = 0;
    this.hudShakeRot = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashFovBoost = 0;
    this.dashRollTilt = 0;
    this.dashVfx = 0;
    this.slideTimer = 0;
    this.slideRoll = 0;
    this.landingDip = 0;
    this.landingDipVel = 0;
    this.recoilRecoveryPitch = 0;
    this.inspectHeld = false;
    this.inspectingActive = false;
    this.inspectCycleElapsed = 0;
    this.inspectCheckPlayedCycle = -1;

    this.weatherIdx = 0;
    this.weatherTimer = 0;
    this.weatherHoldApplied = false;
    this.applyWeatherBlend(WEATHER_PRESETS.sunny, WEATHER_PRESETS.sunny, 0);
    this.weatherHoldApplied = true;

    this.impactDecals.forEach((d) => {
      d.visible = false;
      d.userData.placed = false;
    });
    this.playerBody.grounded = true;
    this.playerBody.landingSpeed = 0;
    this.occlusion.revealAll();
  }

  private clearProjectilesAndPickups() {
    for (const item of [...this.ordnance, ...this.zones]) this.disposeOrdnanceMesh(item.mesh);
    this.ordnance = [];
    this.zones = [];
    this.stunnedEnemies.clear();
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const pk of this.pickups) {
      pk.active = false;
      pk.group.visible = false;
    }
    for (const t of this.tracers) {
      t.life = 0;
      t.mesh.visible = false;
    }
    for (const dn of this.damageNumbers) {
      dn.active = false;
      dn.life = 0;
      dn.sprite.visible = false;
    }
    this.crosshairDamagePops = [];
    for (const dp of this.impactDust) {
      dp.active = false;
      dp.life = 0;
      dp.sprite.visible = false;
    }
    this.impactLight.intensity = 0;
    this.impactLightTimer = 0;
  }

  private clearInputs() {
    this.input.clearHeldInputs();
    this.inspectHeld = false;
    this.inspectingActive = false;
    this.inspectCycleElapsed = 0;
    this.inspectCheckPlayedCycle = -1;
    this.sprintToggled = false;
    this.crouchToggled = false;
    this.weaponRig.setScopeOverlayHidden(false);
    this.scopeAlpha = 0;
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    const queue: EnemyKind[] = [];

    if (waveNum <= WAVE_TABLE.length) {
      const def = WAVE_TABLE[waveNum - 1];
      for (let i = 0; i < def.strikers; i++) queue.push('striker');
      for (let i = 0; i < def.sentinels; i++) queue.push('sentinel');
      for (let i = 0; i < def.wasps; i++) queue.push('wasp');
      this.waveBanner = def.banner;
    } else {
      const extra = waveNum - WAVE_TABLE.length;
      const strikers = 8 + extra * 2;
      const sentinels = 4 + extra;
      const wasps = 5 + extra;
      for (let i = 0; i < strikers; i++) queue.push('striker');
      for (let i = 0; i < sentinels; i++) queue.push('sentinel');
      for (let i = 0; i < wasps; i++) queue.push('wasp');
      this.waveBanner = `Wave ${waveNum} — Endless Escalation`;
    }

    // Shuffle spawn order so enemy archetypes mix dynamically
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }

    this.spawnQueue = queue;
    this.spawnTimer = 0.2;
    this.waveBannerTimer = 3.2;

    // Refresh tactical pickups inside key enterable buildings
    this.spawnPickup('health', this.arena.pickupSpots[waveNum % this.arena.pickupSpots.length]);
    this.spawnPickup('ammo', this.arena.pickupSpots[(waveNum + 2) % this.arena.pickupSpots.length]);
  }

  private spawnPickup(kind: 'health' | 'ammo', pos: THREE.Vector3) {
    const slot = this.pickups.find((p) => !p.active && p.kind === kind);
    if (!slot) return;
    slot.active = true;
    slot.pos.copy(pos);
    slot.group.position.copy(pos);
    slot.group.visible = true;
  }

  // =========================================================================
  // INPUT ACTION HANDLERS (DELEGATED FROM InputManager)
  // =========================================================================
  private handleEngineKeyDown(code: string, repeat: boolean) {
    if (this.spectatorActive) {
      if (!repeat && (code === 'Space' || code === 'KeyE' || code === 'ArrowRight' || code === 'ArrowLeft')) {
        this.cycleSpectatorTarget();
      }
      return;
    }

    if ((code === 'Space' || code === 'KeyF') && !repeat && this.mapId === 'island') {
      if (this.brStage === 'airdrop_plane' && this.ejectFromTransportPlane()) return;
      if (this.brStage === 'freefall' && this.deployParachute()) return;
    }

    if (code === 'Tab' && !repeat) {
      this.toggleInventory();
      return;
    }

    if (code === 'Space' && !repeat) {
      if (this.prone) {
        this.prone = false;
      } else if (this.slideTimer > 0) {
        this.slideTimer = 0;
        this.crouching = false;
        this.crouchToggled = false;
        this.jumpBufferTimer = 0.12;
      } else if (this.crouching) {
        this.crouching = false;
        this.crouchToggled = false;
      } else {
        this.jumpBufferTimer = 0.12;
      }
    }

    if (code === 'KeyV' && !repeat) {
      this.toggleProne();
    }

    if (code === this.settings.controls.sprint && !repeat && this.settings.sprintToggle) {
      this.sprintToggled = !this.sprintToggled;
    }

    if (code === this.settings.controls.crouch && !repeat) {
      this.prone = false;
      if (!this.crouching && this.tryStartSlide()) {
        // Combat slide initiated!
      } else {
        this.crouching = !this.crouching;
        this.crouchToggled = this.crouching;
        if (!this.crouching) this.slideTimer = 0;
        this.emitHud(true);
      }
    }

    if (code === this.settings.controls.interact && !repeat) {
      this.interactLoot();
    }
    if (code === this.settings.controls.armorPlate && !repeat) {
      this.useArmorPlate();
    }
    if (code === this.settings.controls.medkit && !repeat) {
      this.useMedkit();
    }
    if (code === 'KeyX' && !repeat) {
      this.dropActiveWeapon();
    }
    if (code === this.settings.controls.dash && !repeat) {
      this.tryActivateDash();
    }
    if (code === this.settings.controls.inspect && !repeat) {
      this.audio.unlock();
      this.inspectHeld = true;
    }
    if (code === this.settings.controls.scopeZoom && !repeat && ['railpistol', 'marksman'].includes(this.weaponId) && this.isAdsActive()) {
      this.toggleScopeZoom();
    }
    if (code === this.settings.controls.reload && !repeat) {
      this.tryStartReload();
    }
    if (code === this.settings.controls.grenade && !repeat) this.throwGrenade();
    if (code === this.settings.controls.sidearm && !repeat) this.switchWeapon(this.loadout.sidearm);
    if (code === this.settings.controls.launcher && !repeat && this.loadout.launcher) this.switchWeapon(this.loadout.launcher);
    if (code === this.settings.controls.primary1 && !repeat) this.switchWeapon(this.loadout.primary[0]);
    if (code === this.settings.controls.primary2 && !repeat) this.switchWeapon(this.loadout.primary[1]);
  }

  private handleEngineKeyUp(code: string) {
    if (code === this.settings.controls.inspect) {
      this.inspectHeld = false;
    }
    if (code === this.settings.controls.crouch && !this.settings.crouchToggle && this.crouching && this.slideTimer <= 0) {
      this.crouching = false;
      this.emitHud(true);
    }
  }

  private applyMouseLookDelta(dx: number, dy: number) {
    const fovScale = THREE.MathUtils.clamp(this.camera.fov / Math.max(45, this.settings.fov), 0.13, 1.0);
    const adsMult = this.isAdsActive() ? this.settings.adsSensitivity : 1.0;
    const invertSign = this.settings.invertY ? -1 : 1;
    const sens = 0.0021 * this.settings.sensitivity * adsMult * fovScale;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens * invertSign, -1.42, 1.42);
    if (dy > 0 && this.recoilRecoveryPitch > 0) {
      this.recoilRecoveryPitch = Math.max(0, this.recoilRecoveryPitch - dy * sens);
    }
    this.lookDeltaX += dx;
    this.lookDeltaY += dy * invertSign;
  }

  private handleMouseWheel(deltaY: number) {
    if (['railpistol', 'marksman'].includes(this.weaponId) && this.isAdsActive()) {
      this.toggleScopeZoom();
      return;
    }
    const weapons = inventoryWeapons(this.loadout);
    const index = weapons.indexOf(this.weaponId);
    this.switchWeapon(weapons[(index + (deltaY > 0 ? 1 : weapons.length - 1)) % weapons.length]);
  }

  private readonly handleWebGLContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLost(true);
  };

  private readonly handleWebGLContextRestored = () => {
    this.onContextLost(false);
  };

  private handleResize() {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.aspect = w / h;
    this.weaponCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private bindCanvasEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.handleWebGLContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleWebGLContextRestored);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  // =========================================================================
  // WEAPON LOGIC & HITSCAN BALLISTICS
  // =========================================================================
  private tryStartSlide(): boolean {
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (!this.grounded || !this.sprinting || this.slideTimer > 0 || this.dashTimer > 0 || horizSpeed < 6.4) {
      return false;
    }
    this.slideDir.set(this.playerVel.x, 0, this.playerVel.z).normalize();
    this.slideTimer = this.slideDuration;
    this.crouching = true;
    this.sprinting = false;
    this.touchSprintLock = false;
    this.inspectHeld = false;
    this.dashFovBoost = Math.max(this.dashFovBoost, 6.2);
    this.slideRoll = -0.048;
    this.audio.playSlide();
    this.emitHud(true);
    return true;
  }

  private switchWeapon(next: WeaponId) {
    if (this.mapId === 'island' && this.brStage !== 'grounded') return;
    if (!inventoryWeapons(this.loadout).includes(next) || this.weaponId === next) return;
    this.weaponId = next;
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadDuration = WEAPON_SPECS[next].reloadTime;
    this.reloadIsEmpty = false;
    this.reloadAudioStage = 0;
    this.inspectHeld = false;
    this.recoilRecoveryPitch = 0;
    this.fireCooldown = 0.22;
    this.scopeAlpha = 0;
    this.weaponRig.setScopeOverlayHidden(false);
    this.weaponRig.setWeapon(next);
    this.emitHud(true);
  }

  private tryStartReload() {
    if (this.reloading || (this.mapId === 'island' && this.brStage !== 'grounded')) return;
    const spec = WEAPON_SPECS[this.weaponId];
    const current = this.ammoMap[this.weaponId];
    const reserve = this.reserveMap[this.weaponId];
    if (current >= spec.magSize || reserve <= 0) return;

    const isEmpty = current === 0;
    this.reloading = true;
    this.reloadIsEmpty = isEmpty;
    this.reloadDuration = isEmpty ? spec.reloadTimeEmpty : spec.reloadTime;
    this.reloadTimer = this.reloadDuration;
    this.reloadAudioStage = 0;
    this.inspectHeld = false;
    this.weaponRig.setScopeOverlayHidden(false);
    this.audio.playReloadStart();
    this.emitHud(true);
  }

  private tryActivateDash() {
    if (this.dashCooldown > 0 || this.dashTimer > 0 || (this.mapId === 'island' && this.brStage !== 'grounded')) return;

    const moveFwd =
      (this.controlIsHeld('forward') ? 1 : 0) -
      (this.controlIsHeld('backward') ? 1 : 0) +
      this.touchMoveY;
    const moveRight = (this.controlIsHeld('right') ? 1 : 0) - (this.controlIsHeld('left') ? 1 : 0) + this.touchMoveX;

    _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); // forward
    _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));  // right

    if (Math.abs(moveFwd) > 0.05 || Math.abs(moveRight) > 0.05) {
      this.dashDir.set(0, 0, 0).addScaledVector(_v1, moveFwd).addScaledVector(_v2, moveRight).normalize();
    } else {
      this.dashDir.copy(_v1).normalize();
    }

    this.crouching = false;
    this.slideTimer = 0;
    this.inspectHeld = false;
    this.dashTimer = this.dashDuration;
    this.dashCooldown = this.dashCooldownMax;
    this.dashFovBoost = 16.5;
    this.dashVfx = 1.0;
    this.dashRollTilt = -THREE.MathUtils.clamp(moveRight, -1, 1) * 0.065;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.16);

    // Light upward impulse when airborne or stepping over curbs
    if (!this.grounded && this.playerVel.y < 1.2) {
      this.playerVel.y = 1.8;
    }

    this.audio.playDash();
    this.emitHud(true);
  }

  public throwGrenade() {
    if (this.phase !== 'playing' || this.grenadesRemaining <= 0 || this.grenadeCooldown > 0 || (this.mapId === 'island' && this.brStage !== 'grounded')) return;
    this.outOfCombatSec = 0;
    this.grenadesRemaining--;
    this.grenadeCooldown = 0.8;
    this.inspectHeld = false;
    this.pendingGrenade = {kind:this.loadout.grenade,delay:0.38};
    this.weaponRig.triggerGrenadeThrow(this.loadout.grenade);
    this.emitHud(true);
  }

  private launchOrdnance(kind: GrenadeId | 'rocket', source: WeaponId | GrenadeId, radius: number, damage: number) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(kind === 'rocket' ? 0.09 : 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: kind === 'rocket' ? 0xffb347 : GRENADES[kind].color }));
    this.camera.getWorldPosition(mesh.position);
    const velocity = this.camera.getWorldDirection(new THREE.Vector3());
    mesh.position.addScaledVector(velocity, 0.55);
    velocity.multiplyScalar(kind === 'rocket' ? 42 : 15);
    if (kind !== 'rocket') velocity.y += 4;
    this.scene.add(mesh);
    this.ordnance.push({ mesh, velocity, fuse: kind === 'rocket' ? 4 : kind === 'molotov' ? 3 : 1.6, kind, source, radius, damage });
  }

  private disposeOrdnanceMesh(mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  private segmentNearSphere(a: THREE.Vector3, b: THREE.Vector3, center: THREE.Vector3, radius: number): boolean {
    const ab = new THREE.Vector3().subVectors(b, a);
    const t = THREE.MathUtils.clamp(new THREE.Vector3().subVectors(center, a).dot(ab) / Math.max(0.0001, ab.lengthSq()), 0, 1);
    return ab.multiplyScalar(t).add(a).distanceToSquared(center) <= radius * radius;
  }

  private areaDamage(center: THREE.Vector3, radius: number, damage: number, source: WeaponId | GrenadeId) {
    let anyHit = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const target = enemy.root.position.clone().add(new THREE.Vector3(0, enemy.kind === 'wasp' ? 0 : 0.9, 0));
      const distance = center.distanceTo(target);
      if (distance > radius) continue;
      if (this.physics.raycastSegment(center.x, center.y, center.z, target.x, target.y, target.z, this.projRayHit, 0.01)) continue;
      const dealt = Math.round(damage * (1 - 0.65 * distance / radius));
      const res = applyArmorHealthDamage(dealt, enemy.armor ?? 0, enemy.hp);
      if ('armor' in enemy) enemy.armor = res.remainingArmor;
      enemy.hp = res.remainingHealth;
      enemy.hitFlashTimer = 0.12;
      enemy.flinchKick = 0.8;
      this.hitMarkerTimer = this.hitMarkerDuration = res.killed ? 0.3 : 0.25;
      this.hitMarkerCrit = false;
      this.hitMarkerKill = res.killed;
      this.hitMarkerArmor = res.kind === 'armor';
      this.hitMarkerArmorBreak = res.armorBroken;
      this.hitMarkerSeq++;
      this.pushCrosshairDamagePop(res.armorDamage, res.healthDamage, res.armorBroken, false, res.killed);
      this.spawnDamageNumber(target, dealt, false, res.killed, res.kind === 'armor');
      anyHit = true;
      if (res.killed) this.handleEnemyKilled(enemy, false, target, source);
    }
    if (anyHit && typeof this.onHudUpdate === 'function') this.emitHud(true);
  }

  private updateOrdnance(dt: number) {
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    if(this.pendingGrenade) {
      this.pendingGrenade.delay-=dt;
      if(this.pendingGrenade.delay<=0) {
        const kind=this.pendingGrenade.kind;
        this.pendingGrenade=null;
        this.launchOrdnance(kind,kind,kind==='flashbang'?10:5,110);
      }
    }
    for (let i = this.ordnance.length - 1; i >= 0; i--) {
      const item = this.ordnance[i];
      item.fuse -= dt;
      if (item.kind !== 'rocket') item.velocity.y -= 12 * dt;
      const from = item.mesh.position.clone();
      const to = from.clone().addScaledVector(item.velocity, dt);
      const wall = this.physics.raycastSegment(from.x, from.y, from.z, to.x, to.y, to.z, this.projRayHit, 0.06);
      if (wall) to.copy(this.projRayHit.point).addScaledVector(this.projRayHit.normal, 0.18);
      const ground = this.physics.sampleGroundAt(to.x, to.z, Math.max(to.y, from.y), 0.1, 0.3).y + 0.15;
      const floor = to.y <= ground;
      if (floor) to.y = ground;
      item.mesh.position.copy(to);
      const enemyHit = item.kind === 'rocket' && this.enemies.some(e => e.alive && this.segmentNearSphere(from, to, e.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)), e.radius + 0.3));
      const impact = wall || floor || enemyHit;
      if (impact && item.kind !== 'rocket' && item.kind !== 'molotov') { item.velocity.multiplyScalar(0.4); item.velocity.y = Math.abs(item.velocity.y) * 0.35; }
      if (item.fuse > 0 && !(impact && (item.kind === 'rocket' || item.kind === 'molotov'))) continue;
      const center = to.clone();
      if (item.kind === 'smoke' || item.kind === 'molotov') {
        const smoke = item.kind === 'smoke';
        const zone = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: smoke ? 0xaabbcc : 0xff6b16, transparent: true, opacity: smoke ? 0.65 : 0.35, depthWrite: false }));
        zone.position.copy(center);
        if (smoke) zone.position.y += 1.5;
        zone.scale.set(item.radius, smoke ? 3 : 0.4, item.radius);
        this.scene.add(zone);
        this.zones.push({ mesh: zone, kind: item.kind, radius: item.radius, life: smoke ? 8 : 6, pulse: 0 });
      } else if (item.kind === 'flashbang') {
        for (const enemy of this.enemies) {
          const target = enemy.root.position.clone().add(new THREE.Vector3(0, 1, 0));
          if (enemy.alive && center.distanceTo(target) < item.radius && !this.physics.raycastSegment(center.x, center.y, center.z, target.x, target.y, target.z, this.projRayHit, 0.01)) this.stunnedEnemies.set(enemy.id, 4);
        }
        this.triggerImpactLight(center, 0xffffff, 30, 0.2);
        this.spawnParticleBurst(center, 24, 0xffffff, 10);
      } else {
        this.areaDamage(center, item.radius, item.damage, item.source);
        this.audio.playEnemyExplode();
        this.triggerImpactLight(center, 0xffa43b, 20, 0.2);
        this.spawnParticleBurst(center, 32, 0xff9a32, 10);
      }
      this.disposeOrdnanceMesh(item.mesh);
      this.ordnance.splice(i, 1);
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i];
      zone.life -= dt;
      zone.pulse -= dt;
      zone.mesh.material.opacity = Math.min(1, zone.life) * (zone.kind === 'smoke' ? 0.65 : 0.35);
      if (zone.kind === 'molotov' && zone.pulse <= 0) {
        zone.pulse = 0.5;
        this.areaDamage(zone.mesh.position, zone.radius, 22, 'molotov');
        this.spawnParticleBurst(zone.mesh.position, 6, 0xff8a24, 2.5);
      }
      if (zone.life <= 0) { this.disposeOrdnanceMesh(zone.mesh); this.zones.splice(i, 1); }
    }
  }

  private executeShot() {
    if (this.grenadeCooldown > 0.12 || (this.mapId === 'island' && this.brStage !== 'grounded')) return;
    const spec = WEAPON_SPECS[this.weaponId];
    const currentAmmo = this.ammoMap[this.weaponId];
    const adsActive = this.isAdsActive();

    this.inspectHeld = false;

    if (currentAmmo <= 0) {
      this.audio.playDryFire();
      this.tryStartReload();
      this.fireCooldown = 0.25;
      return;
    }

    this.ammoMap[this.weaponId] = currentAmmo - 1;
    this.fireCooldown = 1 / spec.fireRate;
    this.shotsFired++;
    this.outOfCombatSec = 0;

    // Audio & Viewmodel Recoil Kick
    if (this.weaponId === 'carbine') {
      this.audio.playCarbineShot();
    } else {
      this.audio.playRailShot();
    }
    const crouchRecoil = this.crouching ? 0.72 : 1.0;
    this.weaponRig.triggerShot(spec.recoilKick * crouchRecoil, spec.recoilPitch * crouchRecoil);
    const pitchAdded = spec.recoilPitch * (adsActive ? 0.45 : 0.95) * crouchRecoil;
    this.pitch = THREE.MathUtils.clamp(this.pitch + pitchAdded, -1.42, 1.42);
    // Smart auto-recenter recovers ~65% of recoil climb once burst finishes (cancelled if player pulls down)
    this.recoilRecoveryPitch = Math.min(0.11, this.recoilRecoveryPitch + pitchAdded * 0.65);
    this.yaw += (Math.random() - 0.5) * spec.recoilPitch * (adsActive ? 0.24 : 0.42) * crouchRecoil;
    this.triggerGunfireShake(this.weaponId === 'railpistol', adsActive);
    this.dynamicSpread = Math.min(0.032, this.dynamicSpread + (this.weaponId === 'railpistol' ? 0.012 : 0.0052));

    if (spec.blastRadius) {
      this.launchOrdnance('rocket', this.weaponId, spec.blastRadius, spec.damage);
      if (this.ammoMap[this.weaponId] === 0) this.tryStartReload();
      this.emitHud(true);
      return;
    }
    let shotConnected = false;
    const shotSummaries = new Map<
      string,
      {
        armorDamage: number;
        healthDamage: number;
        armorBroken: boolean;
        isHeadshot: boolean;
        isKill: boolean;
        point: THREE.Vector3;
      }
    >();
    const recordShotHit = (
      key: string,
      armorDamage: number,
      healthDamage: number,
      armorBroken: boolean,
      isHeadshot: boolean,
      isKill: boolean,
      point: THREE.Vector3,
    ) => {
      const existing = shotSummaries.get(key);
      if (existing) {
        existing.armorDamage += armorDamage;
        existing.healthDamage += healthDamage;
        existing.armorBroken = existing.armorBroken || armorBroken;
        existing.isHeadshot = existing.isHeadshot || isHeadshot;
        existing.isKill = existing.isKill || isKill;
        existing.point.copy(point);
      } else {
        shotSummaries.set(key, {
          armorDamage,
          healthDamage,
          armorBroken,
          isHeadshot,
          isKill,
          point: point.clone(),
        });
      }
    };
    for (let pellet = 0; pellet < (spec.pellets ?? 1); pellet++) {
    // Compute ray with calibrated spread (optical sniper ADS is pinpoint at exact reticle sway)
    const crouchSpread = this.crouching ? 0.65 : 1.0;
    const spread =
      ((adsActive ? spec.spreadAds : spec.spreadHip) + this.dynamicSpread * (adsActive ? 0.18 : 0.68)) * crouchSpread;
    let sx = (Math.random() - 0.5) * spread * 2;
    let sy = (Math.random() - 0.5) * spread * 2;
    if (['railpistol', 'marksman'].includes(this.weaponId) && this.scopeAlpha > 0.65) {
      // Align shot precisely with the live optical crosshair sway offset on screen!
      const w = Math.max(1, this.container.clientWidth || window.innerWidth);
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      sx += (this.scopeSwayX / w) * 2;
      sy -= (this.scopeSwayY / h) * 2;
    }
    _v2d.set(sx, sy);
    this.raycaster.setFromCamera(_v2d, this.camera);
    this.raycaster.near = 0.1;
    this.raycaster.far = 160;

    // Intersect arena geometry first to establish wall occlusion distance
    const worldHits = this.raycaster.intersectObjects(this.arena.shootableMeshes, false);
    const maxWallDist = worldHits.length > 0 ? worldHits[0].distance : 120;

    // Collect living enemy hitboxes into zero-allocation reusable cache
    const enemyTargets = this.enemyTargetsCache;
    enemyTargets.length = 0;
    for (let j = 0; j < this.enemies.length; j++) {
      const e = this.enemies[j];
      if (e.alive) {
        for (let i = 0; i < e.hitMeshes.length; i++) {
          enemyTargets.push(e.hitMeshes[i]);
        }
      }
    }
    // In PvP Deathmatch, include remote players as hit targets
    if (this.remotePlayers && (this.multiplayerConfig?.mode === 'deathmatch' || this.multiplayerConfig?.isHost === false)) {
      const pMeshes = this.remotePlayers.getHitMeshes();
      for (let i = 0; i < pMeshes.length; i++) {
        enemyTargets.push(pMeshes[i]);
      }
    }

    const enemyHits = this.raycaster.intersectObjects(enemyTargets, false);
    const hitEnemy = enemyHits.length > 0 && enemyHits[0].distance < maxWallDist ? enemyHits[0] : null;

    // Muzzle start -> impact endpoint for glowing tracer
    this.weaponRig.getMuzzleWorldPosition(_v1);

    if (hitEnemy) {
      const hitObj = hitEnemy.object;
      const isPlayer = Boolean(hitObj.userData.isPlayer);
      const isHeadshot = Boolean(hitObj.userData.isHeadshot);

      this.spawnTracer(_v1, hitEnemy.point, spec.tracerColor);

      if (isPlayer) {
        const targetId = hitObj.userData.remotePlayerId as string;
        shotConnected = true;
        const dmg = Math.round(spec.damage * (isHeadshot ? spec.headshotMultiplier : 1));
        const vitals = this.remotePlayers?.getPlayerVitals(targetId);
        const res = applyArmorHealthDamage(dmg, vitals?.shield ?? 0, vitals?.health ?? 100);
        if (isHeadshot) this.headshots++;

        this.hitMarkerDuration = isHeadshot ? 0.24 : 0.2;
        this.hitMarkerTimer = this.hitMarkerDuration;
        this.hitMarkerCrit = isHeadshot;
        this.hitMarkerKill = res.killed;
        this.hitMarkerArmor = res.kind === 'armor';
        this.hitMarkerArmorBreak = res.armorBroken;
        this.hitMarkerSeq++;

        this.audio.playHitMarker(isHeadshot, res.killed);
        recordShotHit(`p:${targetId}`, res.armorDamage, res.healthDamage, res.armorBroken, isHeadshot, res.killed, hitEnemy.point);
        this.triggerImpactLight(
          hitEnemy.point,
          res.kind === 'armor' ? 0x57d7ee : isHeadshot ? 0xffd257 : 0xff7b36,
          6.5,
          0.065,
        );
        this.remotePlayers?.triggerDamage(targetId, dmg, isHeadshot);

        this.networkManager?.broadcast({
          type: 'player-damage',
          targetId,
          attackerId: this.networkManager.localPlayerId,
          attackerName: this.networkManager.getLocalPlayer()?.name ?? 'Operative',
          amount: dmg,
          isHeadshot,
          weaponId: this.weaponId,
        });
      } else {
        const enemyId = hitObj.userData.enemyId as number;
        const enemy = this.enemies.find((e) => e.id === enemyId && e.alive);

        if (enemy) {
          shotConnected = true;
          const dmg = Math.round(spec.damage * (isHeadshot ? spec.headshotMultiplier : 1));
          const res = applyArmorHealthDamage(dmg, enemy.armor ?? 0, enemy.hp);
          enemy.armor = res.remainingArmor;
          enemy.hp = res.remainingHealth;
          this.damageDealt += res.armorDamage + res.healthDamage;
          enemy.hitFlashTimer = 0.095;
          enemy.flinchKick = Math.min(1, enemy.flinchKick + (isHeadshot ? 0.85 : 0.45));

          // Instant hit flash emissive boost (cool cyan sheen on armor impact, gold on headshot, bright flash on health)
          for (const m of enemy.bodyMaterials) {
            m.emissive.setHex(res.kind === 'armor' ? 0x57d7ee : isHeadshot ? 0xffc857 : 0xffffff);
            m.emissiveIntensity = res.armorBroken ? 0.72 : isHeadshot ? 0.75 : 0.42;
          }

          const killed = res.killed;
          if (isHeadshot) this.headshots++;

          this.hitMarkerDuration = killed ? 0.3 : isHeadshot || res.armorBroken ? 0.24 : 0.2;
          this.hitMarkerTimer = this.hitMarkerDuration;
          this.hitMarkerCrit = isHeadshot;
          this.hitMarkerKill = killed;
          this.hitMarkerArmor = res.kind === 'armor';
          this.hitMarkerArmorBreak = res.armorBroken;
          this.hitMarkerSeq++;

          this.audio.playHitMarker(isHeadshot, killed);
          recordShotHit(`e:${enemyId}`, res.armorDamage, res.healthDamage, res.armorBroken, isHeadshot, killed, hitEnemy.point);
          this.triggerImpactLight(
            hitEnemy.point,
            res.kind === 'armor' ? 0x57d7ee : isHeadshot ? 0xffd257 : 0xff7b36,
            isHeadshot ? 9.5 : 5.5,
            0.065,
          );
          this.spawnParticleBurst(
            hitEnemy.point,
            res.armorBroken ? 16 : isHeadshot ? 16 : 9,
            res.kind === 'armor' || res.armorBroken ? 0x67e8f9 : isHeadshot ? 0xffca42 : 0xff7b36,
            isHeadshot || res.armorBroken ? 7.5 : 5.2,
          );

          if (!this.multiplayerConfig?.isHost && this.networkManager) {
            this.networkManager.broadcast({
              type: 'enemy-damage',
              enemyId,
              amount: dmg,
              isHeadshot,
              shooterId: this.networkManager.localPlayerId,
              weaponId: this.weaponId,
            });
          }

          if (killed) {
            this.handleEnemyKilled(enemy, isHeadshot, hitEnemy.point);
          }
        }
      }
    } else if (worldHits.length > 0) {
      const wh = worldHits[0];
      const surface = (wh.object.userData?.surface as SurfaceType) || 'wood';
      this.spawnTracer(_v1, wh.point, spec.tracerColor);

      if (wh.face) {
        _v2.copy(wh.face.normal).transformDirection(wh.object.matrixWorld).normalize();
      } else {
        _v2.copy(this.raycaster.ray.direction).negate();
      }

      // Surface-calibrated ballistic impact debris, sparks, billowing dust plume & textured hole
      if (surface === 'metal') {
        this.spawnParticleBurst(wh.point, 12, 0xffe28a, 7.6);
        this.spawnParticleBurst(wh.point, 5, 0xffffff, 8.8);
        this.triggerImpactLight(wh.point, 0xffd37d, 8.8, 0.06);
      } else if (surface === 'glass') {
        this.spawnParticleBurst(wh.point, 14, 0xd8f1ff, 6.8);
        this.spawnParticleBurst(wh.point, 6, 0xffffff, 7.4);
        this.triggerImpactLight(wh.point, 0xcceeff, 4.5, 0.045);
      } else if (surface === 'wood') {
        this.spawnParticleBurst(wh.point, 9, 0xb8814d, 5.2);
        this.spawnParticleBurst(wh.point, 4, 0xffd796, 4.4);
      } else if (surface === 'stone' || surface === 'concrete') {
        this.spawnParticleBurst(wh.point, 10, 0xcab18e, 5.6);
        this.spawnParticleBurst(wh.point, 4, 0xffd394, 5.2);
        this.triggerImpactLight(wh.point, 0xffc675, 4.2, 0.045);
      } else {
        // dirt / desert sand
        this.spawnParticleBurst(wh.point, 11, 0xb5864e, 5.8);
        this.spawnParticleBurst(wh.point, 5, 0xd9b37c, 4.4);
      }

      this.spawnImpactDust(wh.point, _v2, surface);
      this.placeImpactDecal(wh.point, _v2, surface);
    } else {
      _v2.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 80);
      this.spawnTracer(_v1, _v2, spec.tracerColor);
    }

    }
    if (shotSummaries.size > 0) {
      for (const summary of shotSummaries.values()) {
        const totalDealt = summary.armorDamage + summary.healthDamage;
        const armorOnly = summary.armorDamage > 0 && summary.healthDamage === 0;
        this.pushCrosshairDamagePop(
          summary.armorDamage,
          summary.healthDamage,
          summary.armorBroken,
          summary.isHeadshot,
          summary.isKill,
        );
        this.spawnDamageNumber(summary.point, totalDealt, summary.isHeadshot, summary.isKill, armorOnly);
      }
    }
    if (shotConnected) this.shotsHit++;

    // Broadcast gunfire across multiplayer network
    if (this.networkManager && this.phase === 'playing') {
      _v2.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 65);
      this.networkManager.broadcast({
        type: 'player-shoot',
        playerId: this.networkManager.localPlayerId,
        weaponId: this.weaponId,
        origin: [_v1.x, _v1.y, _v1.z],
        target: [_v2.x, _v2.y, _v2.z],
      });
    }

    // Auto-reload if magazine hits zero and reserve remains
    if (this.ammoMap[this.weaponId] === 0 && this.reserveMap[this.weaponId] > 0) {
      this.tryStartReload();
    }

    this.emitHud(true);
  }

  private handleEnemyKilled(enemy: EnemyEntity, isHeadshot: boolean, hitPoint: THREE.Vector3, source: WeaponId | GrenadeId = this.weaponId) {
    enemy.alive = false;
    enemy.deathTimer = enemy.deathDuration;
    enemy.isWindingUp = false;
    this.eliminations++;

    // Push live tactical kill feed entry (matching reference HUD top-left kill feed)
    this.killFeed.unshift({
      id: this.nextKillFeedId++,
      killer: 'Raven07',
      victim: enemy.displayName,
      weapon: source,
      headshot: isHeadshot,
      ttl: 5.5,
    });
    if (this.killFeed.length > 4) this.killFeed.pop();

    const diffSpec = DIFFICULTY_SPECS[this.difficulty];
    const bonus = isHeadshot ? 50 : 0;
    this.score += Math.round((enemy.scoreValue + bonus) * diffSpec.scoreMultiplier);
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // Ignore
      }
    }

    // Non-blocking crisp kill feedback (zero camera freeze so multi-kills stay butter-smooth)
    this.shakeTrauma = Math.min(1, this.shakeTrauma + (isHeadshot ? 0.2 : 0.14));
    this.audio.playEnemyExplode();
    this.spawnParticleBurst(hitPoint, enemy.kind === 'wasp' ? 22 : 12, enemy.kind === 'wasp' ? 0xff8c2b : 0xb8966e, 6.2);
    if (enemy.kind === 'wasp') {
      _v4.copy(enemy.root.position);
      _v4.y = enemy.hoverBaseY;
      this.spawnParticleBurst(_v4, 14, 0xffe08a, 7.2);
    }

    // 26% chance to drop a supply pickup where the enemy fell
    if (Math.random() < 0.26) {
      const dropKind = this.health < 65 ? 'health' : 'ammo';
      _v3.set(enemy.root.position.x, enemy.root.position.y + 0.55, enemy.root.position.z);
      this.spawnPickup(dropKind, _v3);
    }

    // Battle Royale elimination & Victory Royale tracking
    if (this.mapId === 'island') {
      this.brAliveCount = Math.max(1, this.brAliveCount - 1);
      if (this.brAliveCount <= 1) {
        this.brAliveCount = 1;
        this.placement = 1;
        this.score += 1000;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          try {
            window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
          } catch {
            // Ignore
          }
        }
        this.lifecycle.transition('match_completed');
        this.waveBanner = 'VICTORY ROYALE — #1 LAST OPERATOR STANDING';
        this.waveBannerTimer = 5.0;
        this.phase = 'victory';
        this.clearInputs();
        this.exitPointerLockSafe();
        this.emitHud(true);
      }
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number) {
    const item = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const dist = start.distanceTo(end);
    if (dist < 0.2) return;

    item.mesh.position.lerpVectors(start, end, 0.5);
    item.mesh.lookAt(end);
    item.mesh.scale.set(1, 1, dist);
    item.mat.color.setHex(colorHex);
    item.mat.opacity = 0.9;
    item.mesh.visible = true;
    item.maxLife = 0.075;
    item.life = item.maxLife;
  }

  private triggerImpactLight(point: THREE.Vector3, colorHex: number, intensity: number, duration: number) {
    this.impactLight.color.setHex(colorHex);
    this.impactLight.position.copy(point);
    this.impactLight.intensity = intensity;
    this.impactLightTimer = duration;
  }

  private placeImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, surface: SurfaceType) {
    const decal = this.impactDecals[this.nextDecalIdx];
    this.nextDecalIdx = (this.nextDecalIdx + 1) % this.impactDecals.length;

    if (surface === 'metal' || surface === 'glass') {
      decal.material = this.decalMetalMat;
    } else if (surface === 'stone' || surface === 'concrete' || surface === 'dirt') {
      decal.material = this.decalStoneMat;
    } else {
      decal.material = this.decalWoodMat;
    }

    const baseScale = surface === 'dirt' ? 1.28 : surface === 'metal' || surface === 'glass' ? 0.85 : 1.0;
    const s = baseScale * (0.84 + Math.random() * 0.42);
    decal.scale.set(s, s, 1);

    // Deterministic micro-layering prevents stacked decals from Z-fighting each other or the surface
    const normalOffset = 0.02 + (this.nextDecalIdx % 8) * 0.0012;
    decal.position.copy(point).addScaledVector(normal, normalOffset);
    _v4.copy(decal.position).add(normal);
    decal.lookAt(_v4);
    decal.rotateZ(Math.random() * Math.PI * 2);
    decal.userData.placed = true;
    decal.visible = true;
  }

  private spawnImpactDust(point: THREE.Vector3, normal: THREE.Vector3, surface: SurfaceType) {
    const puffCount = surface === 'dirt' ? 3 : surface === 'metal' || surface === 'glass' ? 1 : 2;
    const tintHex =
      surface === 'dirt'
        ? 0xd6ae78
        : surface === 'stone' || surface === 'concrete'
          ? 0xd8c3a5
          : surface === 'glass'
            ? 0xdceef8
            : surface === 'metal'
              ? 0xc4ccd4
              : 0xc9a77e;

    for (let k = 0; k < puffCount; k++) {
      const slot = this.impactDust[this.nextDustIdx];
      this.nextDustIdx = (this.nextDustIdx + 1) % this.impactDust.length;

      slot.active = true;
      slot.pos.copy(point).addScaledVector(normal, 0.08 + k * 0.06);
      const spread = surface === 'dirt' ? 1.35 : 0.9;
      slot.vel
        .copy(normal)
        .multiplyScalar((surface === 'metal' || surface === 'glass' ? 1.9 : 1.35) + Math.random() * 1.1)
        .add(_v4.set((Math.random() - 0.5) * spread, 0.35 + Math.random() * 0.65, (Math.random() - 0.5) * spread));

      slot.baseScale = surface === 'dirt' ? 0.34 : 0.22;
      slot.maxScale =
        (surface === 'dirt'
          ? 1.55
          : surface === 'stone' || surface === 'concrete'
            ? 1.25
            : surface === 'metal' || surface === 'glass'
              ? 0.78
              : 1.0) *
        (0.85 + Math.random() * 0.35);
      slot.baseOpacity = surface === 'dirt' ? 0.72 : surface === 'metal' || surface === 'glass' ? 0.46 : 0.62;
      slot.maxLife = (surface === 'dirt' ? 0.74 : 0.54) + Math.random() * 0.22;
      slot.life = slot.maxLife;

      slot.mat.color.setHex(tintHex);
      slot.mat.opacity = slot.baseOpacity;
      slot.mat.rotation = Math.random() * Math.PI * 2;
      slot.sprite.position.copy(slot.pos);
      slot.sprite.scale.set(slot.baseScale, slot.baseScale, 1);
      slot.sprite.visible = true;
    }
  }

  private triggerGunfireShake(isHeavy: boolean, ads: boolean) {
    const adsScale = ads ? 0.58 : 1.0;
    this.gunShotParity *= -1;
    if (isHeavy) {
      this.gunShakeTrauma = Math.min(1, this.gunShakeTrauma + 0.54 * adsScale);
      this.gunKickPitch = Math.min(0.072, this.gunKickPitch + 0.038 * adsScale);
      this.gunKickYaw += this.gunShotParity * (0.0085 + Math.random() * 0.006) * adsScale;
      this.gunKickRoll += this.gunShotParity * (0.024 + Math.random() * 0.01) * adsScale;
      this.gunKickBack = Math.min(0.08, this.gunKickBack + 0.05 * adsScale);
    } else {
      this.gunShakeTrauma = Math.min(1, this.gunShakeTrauma + 0.25 * adsScale);
      this.gunKickPitch = Math.min(0.036, this.gunKickPitch + 0.013 * adsScale);
      this.gunKickYaw += this.gunShotParity * (0.0042 + Math.random() * 0.0035) * adsScale;
      this.gunKickRoll += this.gunShotParity * (0.01 + Math.random() * 0.005) * adsScale;
      this.gunKickBack = Math.min(0.044, this.gunKickBack + 0.02 * adsScale);
    }
  }

  private triggerDamageShake(amount: number, arcAngle: number, shieldBroken = false, hitHealth = false) {
    // True damage-relative impact scaling (light graze ~0.32 -> Striker ~0.6 -> Sentinel ~0.95 -> Hard/shield-break 1.4+)
    const baseRatio = THREE.MathUtils.clamp(amount / 20, 0.24, 1.55);
    const fleshScale = hitHealth ? 1.12 : 0.86;
    const breakBoost = shieldBroken ? 0.34 : 0;
    const impactScale = THREE.MathUtils.clamp(baseRatio * fleshScale + breakBoost, 0.24, 1.75);

    this.damageShakeTrauma = Math.min(1.25, this.damageShakeTrauma + 0.3 + 0.56 * impactScale);

    // Directional camera flinch punched away from incoming fire angle
    const lateral = Math.sin(arcAngle);
    const frontal = Math.cos(arcAngle);
    const rollSign = Math.abs(lateral) > 0.15 ? -Math.sign(lateral) : Math.random() < 0.5 ? -1 : 1;

    this.damagePunchRoll = THREE.MathUtils.clamp(
      this.damagePunchRoll + rollSign * (0.042 + Math.abs(lateral) * 0.056) * impactScale,
      -0.21,
      0.21,
    );
    this.damagePunchPitch = THREE.MathUtils.clamp(
      this.damagePunchPitch + (0.024 + frontal * 0.032) * impactScale,
      -0.13,
      0.13,
    );
    this.damagePunchYaw = THREE.MathUtils.clamp(
      this.damagePunchYaw - lateral * 0.034 * impactScale,
      -0.095,
      0.095,
    );
    this.damagePunchRight = THREE.MathUtils.clamp(
      this.damagePunchRight - lateral * 0.068 * impactScale,
      -0.15,
      0.15,
    );
    this.damagePunchUp = THREE.MathUtils.clamp(
      this.damagePunchUp - 0.036 * impactScale,
      -0.1,
      0.1,
    );
    this.damagePunchBack = THREE.MathUtils.clamp(
      this.damagePunchBack + (0.024 + Math.max(0, frontal) * 0.032) * impactScale,
      0,
      0.11,
    );

    // Snappy inward camera FOV concussion compression scaled by impact severity
    this.damageFovPunch = THREE.MathUtils.clamp(
      this.damageFovPunch - (1.8 + 3.6 * impactScale),
      -7.8,
      0,
    );

    // Physical weapon flinch in the player's hands
    this.weaponRig.triggerDamageFlinch(impactScale, lateral);
  }

  private pushCrosshairDamagePop(
    armorDamage: number,
    healthDamage: number,
    armorBroken: boolean,
    isHeadshot: boolean,
    isKill: boolean,
  ) {
    if (!this.crosshairDamagePops) return;
    const total = Math.max(0, Math.round(armorDamage + healthDamage));
    if (total <= 0) return;
    const seq = ++this.damagePopSeq;
    const slot = computeCrosshairPopSlot(seq);
    const kind =
      armorDamage > 0 && healthDamage > 0
        ? 'mixed'
        : armorDamage > 0
        ? 'armor'
        : 'health';
    const ttl = isKill || armorBroken || isHeadshot ? 0.9 : 0.72;
    this.crosshairDamagePops.push({
      id: seq,
      amount: total,
      armorDamage: Math.round(armorDamage),
      healthDamage: Math.round(healthDamage),
      kind,
      armorBroken,
      isHeadshot,
      isKill,
      age: 0,
      ttl,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      driftX: slot.driftX,
    });
    if (this.crosshairDamagePops.length > 8) {
      this.crosshairDamagePops.splice(0, this.crosshairDamagePops.length - 8);
    }
  }

  private spawnDamageNumber(
    point: THREE.Vector3,
    damage: number,
    isHeadshot: boolean,
    killed: boolean,
    isArmor = false,
  ) {
    let slot = this.damageNumbers.find((d) => !d.active);
    if (!slot) {
      slot = this.damageNumbers[0];
      for (let i = 1; i < this.damageNumbers.length; i++) {
        if (this.damageNumbers[i].life < slot.life) {
          slot = this.damageNumbers[i];
        }
      }
    }

    const { ctx, canvas } = slot;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Proportional scaling based on damage dealt (carbine 26 -> rail headshot 144)
    const dmgNorm = THREE.MathUtils.clamp((damage - 20) / 124, 0, 1);
    const fontPx = Math.round(THREE.MathUtils.lerp(56, 86, dmgNorm) + (isHeadshot ? 6 : 0));
    const label = isHeadshot ? `${damage}!` : `${damage}`;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontPx}px "Oxanium", "Rajdhani", system-ui, -apple-system, sans-serif`;

    // High-contrast outline & shadow so numbers read crisply over sunlit desert & dark interiors
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.shadowColor = isArmor
      ? 'rgba(87, 215, 238, 0.72)'
      : isHeadshot
      ? 'rgba(251, 191, 36, 0.7)'
      : killed
      ? 'rgba(239, 68, 68, 0.7)'
      : 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = isArmor || isHeadshot || killed ? 12 : 6;
    ctx.shadowOffsetY = 3;

    ctx.lineWidth = Math.max(8, Math.round(fontPx * 0.16));
    ctx.strokeStyle = 'rgba(10, 12, 18, 0.94)';
    ctx.strokeText(label, w * 0.5, h * 0.54);

    const grad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.85);
    if (isArmor) {
      grad.addColorStop(0, '#cffafe');
      grad.addColorStop(0.5, '#57d7ee');
      grad.addColorStop(1, '#0284c7');
    } else if (isHeadshot && killed) {
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.55, '#fbbf24');
      grad.addColorStop(1, '#f97316');
    } else if (isHeadshot) {
      grad.addColorStop(0, '#fef9c3');
      grad.addColorStop(0.5, '#facc15');
      grad.addColorStop(1, '#f59e0b');
    } else if (killed) {
      grad.addColorStop(0, '#fecaca');
      grad.addColorStop(0.45, '#fb7185');
      grad.addColorStop(1, '#ef4444');
    } else {
      grad.addColorStop(0, '#ffe4e6');
      grad.addColorStop(0.55, '#ff6b6b');
      grad.addColorStop(1, '#ef4444');
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(label, w * 0.5, h * 0.54);
    ctx.restore();

    slot.tex.needsUpdate = true;

    // Position at impact point with subtle fan-out jitter + slight pull toward camera
    _dir.subVectors(this.camera.position, point).normalize();
    slot.pos
      .copy(point)
      .addScaledVector(_dir, 0.16)
      .add(_v4.set((Math.random() - 0.5) * 0.34, 0.1 + Math.random() * 0.12, (Math.random() - 0.5) * 0.34));

    slot.vel.set(
      (Math.random() - 0.5) * 1.25,
      1.95 + Math.random() * 0.55 + (isHeadshot ? 0.45 : 0),
      (Math.random() - 0.5) * 1.25,
    );

    slot.baseScale =
      THREE.MathUtils.lerp(0.54, 1.18, dmgNorm) *
      (isHeadshot ? 1.14 : 1.0) *
      (killed ? 1.08 : 1.0);
    slot.maxLife = killed ? 1.02 : isHeadshot ? 0.92 : 0.78;
    slot.life = slot.maxLife;
    slot.active = true;
    slot.mat.opacity = 1;
    slot.sprite.position.copy(slot.pos);
    slot.sprite.visible = true;
  }

  private spawnParticleBurst(origin: THREE.Vector3, count: number, colorHex: number, speed: number) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.85;
        const spd = speed * (0.45 + Math.random() * 0.75);
        p.vel.set(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * spd * 0.85 + 1.6,
          Math.sin(phi) * Math.sin(theta) * spd,
        );
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.rotVel.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        p.scale = 0.65 + Math.random() * 1.1;
        p.maxLife = 0.28 + Math.random() * 0.28;
        p.life = p.maxLife;
        p.gravity = 15;
        this.particleMesh.setColorAt(i, _color.setHex(colorHex));
        spawned++;
      }
    }
    if (spawned > 0 && this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private fireEnemyProjectile(enemy: EnemyEntity) {
    const bolt = this.projectiles.find((p) => !p.active);
    if (!bolt) return;

    // Calculate world muzzle position
    _v1.copy(enemy.muzzleOffset).applyQuaternion(enemy.root.quaternion).add(enemy.root.position);
    // Aim toward player chest with slight fair inaccuracy so moving players can dodge
    _v2.set(
      this.playerPos.x + (Math.random() - 0.5) * 0.65,
      this.playerPos.y + this.currentEyeHeight * 0.78 + (Math.random() - 0.5) * 0.35,
      this.playerPos.z + (Math.random() - 0.5) * 0.65,
    );

    _dir.subVectors(_v2, _v1).normalize();
    const speed = enemy.kind === 'wasp' ? 27 : enemy.kind === 'sentinel' ? 23 : 25;

    bolt.active = true;
    bolt.pos.copy(_v1);
    bolt.vel.copy(_dir).multiplyScalar(speed);
    const diffSpec = DIFFICULTY_SPECS[this.difficulty];
    const baseDmg = enemy.kind === 'sentinel' ? 18 : enemy.kind === 'wasp' ? 11 : 13;
    bolt.damage = Math.max(4, Math.round(baseDmg * diffSpec.enemyDamageScale));
    bolt.life = 3.2;
    bolt.mesh.position.copy(_v1);
    bolt.mesh.lookAt(_v2);
    bolt.mesh.visible = true;

    // Trigger realistic rifle recoil kick & brief muzzle flash on enemy operator
    enemy.recoilKick = 1.0;
    if (enemy.muzzleFlash) {
      enemy.muzzleFlash.visible = true;
      enemy.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      enemy.muzzleFlashTimer = 0.065;
    }

    this.audio.playEnemyFire(enemy.kind === 'sentinel');
  }

  // =========================================================================
  // MOVEMENT & PHYSICS-BASED MESH COLLISION HELPERS
  // =========================================================================
  private getGroundHeightAt(x: number, z: number, currentY: number, radius = this.playerRadius): number {
    return this.physics.sampleGroundAt(x, z, currentY, radius, 0.32).y;
  }

  private detectSurfaceBelowPlayer(): FootstepSurface {
    _v4.set(this.playerPos.x, this.playerPos.y + 0.65, this.playerPos.z);
    this.footRaycaster.set(_v4, _down);
    this.footRaycaster.near = 0.05;
    this.footRaycaster.far = 1.45;
    const hits = this.footRaycaster.intersectObjects(this.arena.walkableMeshes, false);
    if (hits.length > 0) {
      const raw = (hits[0].object.userData?.surface as SurfaceType | undefined) || 'dirt';
      if (raw === 'concrete' || raw === 'stone') return 'concrete';
      if (raw === 'metal') return 'metal';
      if (raw === 'glass') return 'glass';
      if (raw === 'wood') return 'wood';
      return 'dirt';
    }
    return this.playerPos.y > 0.15 ? 'wood' : 'dirt';
  }

  private isPlayerIndoors(): boolean {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    for (let i = 0; i < this.arena.buildingFootprints.length; i++) {
      const b = this.arena.buildingFootprints[i];
      if (Math.abs(px - b.cx) < b.w * 0.48 && Math.abs(pz - b.cz) < b.d * 0.48) {
        return true;
      }
    }
    return false;
  }

  private resolveHorizontalCollisions(pos: THREE.Vector3, radius: number, bodyHeight: number) {
    this.physics.resolveCapsuleHorizontal(pos, radius, bodyHeight, 0.31);
  }

  // =========================================================================
  // MAIN SIMULATION UPDATE
  // =========================================================================
  private updateSimulation(dt: number) {
    // 1. Title screen sweeping aerial vista over the complete 3D WEST town
    if (this.phase === 'title') {
      this.titleOrbitAngle += dt * 0.11;
      const radius = 44.0;
      this.camera.position.set(
        Math.cos(this.titleOrbitAngle) * radius,
        21.5 + Math.sin(this.titleOrbitAngle * 1.3) * 2.2,
        Math.sin(this.titleOrbitAngle) * radius,
      );
      this.camera.lookAt(0, 2.2, -1.0);

      // Gentle idle patrol motion for showcase bots
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        e.stridePhase += dt * 3.0;
        e.root.rotation.y += dt * (i % 2 === 0 ? 0.35 : -0.35);
        if (e.rotors) {
          for (const r of e.rotors) r.rotation.y += dt * 22;
          e.root.children[1].position.y = e.hoverBaseY + Math.sin(e.stridePhase) * 0.18;
        }
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.matchTimeSec += dt;
    if (this.mapId === 'island' && this.health > 0 && !this.spectatorActive) {
      this.survivalTimeSec += dt;
    }

    // Spectator camera orbits active surviving bot safely above terrain & outside trees/walls
    if (this.spectatorActive && this.mapId === 'island') {
      const aliveBots = this.enemies.filter((e) => e.alive);
      if (aliveBots.length > 0) {
        const target = aliveBots[this.spectatorIdx % aliveBots.length];
        this.playerPos.copy(target.root.position);
        const focusX = target.root.position.x;
        const focusY = target.root.position.y + 1.5;
        const focusZ = target.root.position.z;
        const desiredCamX = focusX + Math.sin(this.yaw) * 6.5;
        const desiredCamZ = focusZ + Math.cos(this.yaw) * 6.5;
        const floorAtCam = this.sampleFloorClampAt(desiredCamX, desiredCamZ) + 1.1;
        const desiredCamY = Math.max(focusY + 2.0, floorAtCam);
        const desiredVec = _v4.set(desiredCamX, desiredCamY, desiredCamZ);
        if (this.physics.raycastSegment(focusX, focusY, focusZ, desiredCamX, desiredCamY, desiredCamZ, this.projRayHit, 0.35)) {
          desiredVec.lerpVectors(_v3.set(focusX, focusY, focusZ), desiredVec, Math.max(0.22, this.projRayHit.t - 0.12));
        }
        this.physics.resolveCameraSphere(desiredVec, 0.55);
        desiredVec.y = Math.max(desiredVec.y, this.sampleFloorClampAt(desiredVec.x, desiredVec.z) + 0.9);
        this.camera.position.lerp(desiredVec, Math.min(1, dt * 8));
        this.camera.lookAt(focusX, focusY, focusZ);
        this.skyElapsed += dt;
        this.updateDynamicWeather(dt);
        this.skySystem.syncToCamera(this.camera, true, this.skyElapsed, this.renderer, dt);
        this.islandArena?.terrainStreamer.update(
          this.camera.position.x,
          this.camera.position.z,
          0,
          0,
          getViewDistanceFarPlane('island', this.settings.viewDistance),
          2,
        );
        this.islandArena?.waterSystem.update(
          this.skyElapsed,
          this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
          this.sceneFog.color,
          this.sceneFog.density,
        );
        this.lightingRig.updateIslandShadowFocus(
          this.camera.position,
          this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
          this.renderer,
          !this.isSoftwareGl && this.settings.shadowQuality !== 'off',
        );
        this.updateWaveAndEnemies(dt);
        this.updateParticlesAndTracers(dt);
        return;
      }
    }
    // Age live kill feed entries
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].ttl -= dt;
      if (this.killFeed[i].ttl <= 0) {
        this.killFeed.splice(i, 1);
      }
    }

    // Update remote multiplayer operatives
    this.remotePlayers?.update(dt, this.camera);

    // Deathmatch respawn countdown
    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnTimer = 0;
        this.health = this.maxHealth;
        this.shield = this.maxShield;
        const pts = this.arena.spawnPoints;
        const randPt = pts[Math.floor(Math.random() * pts.length)] ?? new THREE.Vector3(-15, 0, 1.4);
        this.playerPos.copy(randPt);
        this.playerVel.set(0, 0, 0);
        this.networkManager?.broadcast({
          type: 'player-respawn',
          playerId: this.networkManager.localPlayerId,
          pos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
        });
        this.emitHud(true);
      }
    }

    // Deathmatch match time countdown
    if (this.matchTimeRemaining > 0) {
      this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - dt);
      if (this.matchTimeRemaining <= 0) {
        this.matchTimeRemaining = 0;
        this.phase = 'victory';
        this.waveBanner = 'MATCH CONCLUDED · FINAL SCORES';
        this.waveBannerTimer = 4.0;
        this.emitHud(true);
      }
    }

    // High frequency network broadcast (~25Hz)
    if (this.networkManager && this.phase === 'playing') {
      this.networkBroadcastTimer += dt;
      if (this.networkBroadcastTimer >= 0.04) {
        this.networkBroadcastTimer = 0;
        this.networkManager.broadcast({
          type: 'player-state',
          state: {
            id: this.networkManager.localPlayerId,
            timestamp: Date.now(),
            pos: [this.playerPos.x, this.playerPos.y, this.playerPos.z],
            vel: [this.playerVel.x, this.playerVel.y, this.playerVel.z],
            yaw: this.yaw,
            pitch: this.pitch,
            weaponId: this.weaponId,
            crouching: this.crouching,
            sprinting: this.sprinting,
            firing: this.fireHeld || this.touchFireHeld,
            health: Math.ceil(this.health),
            shield: Math.floor(this.shield),
            alive: this.health > 0,
          },
        });
      }

      if (this.multiplayerConfig?.mode === 'coop' && this.multiplayerConfig.isHost) {
        this.enemySyncTimer += dt;
        if (this.enemySyncTimer >= 0.12) {
          this.enemySyncTimer = 0;
          this.networkManager.broadcast({
            type: 'enemy-sync',
            wave: this.wave,
            enemiesRemaining: this.countAliveEnemies(),
            enemies: this.enemies.map((e) => ({
              id: e.id,
              kind: e.kind,
              pos: [e.root.position.x, e.root.position.y, e.root.position.z],
              yaw: e.root.rotation.y,
              hp: e.hp,
              maxHp: e.maxHp,
              alive: e.alive,
              firing: e.isWindingUp,
            })),
          });
        }
      }
    }

    // 2. Keyboard turn fallback (Q/E or Left/Right arrow)
    const turnSpeed = 2.15 * THREE.MathUtils.clamp(this.camera.fov / 75, 0.22, 1.0);
    if (this.heldKeys.has('KeyQ') || this.heldKeys.has('ArrowLeft')) this.yaw += turnSpeed * dt;
    if (this.heldKeys.has('KeyE') || this.heldKeys.has('ArrowRight')) this.yaw -= turnSpeed * dt;

    // 2B. Battle Royale C-130 Airplane Flight, Paratroopers, Skydiving & Shrinking Storm Zone
    if (this.mapId === 'island') {
      this.updateBattleRoyaleSystem(dt);
      if (this.brStage !== 'grounded') {
        return;
      }
    }

    // 3. Player Movement + Sprint + Crouch + Prone + Swim + Tactical Slide + Dash + Jump + Mantle
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    }

    const adsActive = this.isAdsActive();
    const keyFwd =
      (this.controlIsHeld('forward') ? 1 : 0) -
      (this.controlIsHeld('backward') ? 1 : 0);
    const keyRight = (this.controlIsHeld('right') ? 1 : 0) - (this.controlIsHeld('left') ? 1 : 0);
    const moveFwd = THREE.MathUtils.clamp(keyFwd + this.touchMoveY, -1, 1);
    const moveRight = THREE.MathUtils.clamp(keyRight + this.touchMoveX, -1, 1);
    const shiftHeld = this.settings.sprintToggle ? this.sprintToggled : this.controlIsHeld('sprint');
    if (this.settings.sprintToggle && moveFwd <= 0.1) {
      this.sprintToggled = false;
    }

    const waterSurfaceY = this.getWaterSurfaceYAt(this.playerPos.x, this.playerPos.z);
    const terrainFloorY =
      this.mapId === 'island' ? this.sampleFloorClampAt(this.playerPos.x, this.playerPos.z) : -99;
    const waterDepth = waterSurfaceY !== null ? Math.max(0, waterSurfaceY - terrainFloorY) : 0;
    this.swimming = this.mapId === 'island' && waterSurfaceY !== null && waterDepth > 1.05 && this.playerPos.y <= waterSurfaceY + 0.3;
    this.underwater = this.swimming && waterSurfaceY !== null && this.playerPos.y + this.currentEyeHeight < waterSurfaceY;
    if (this.swimming && this.prone) {
      this.prone = false;
    }

    const wantsSprint =
      (shiftHeld || this.touchSprintLock) &&
      moveFwd > 0.25 &&
      !adsActive &&
      !this.crouching &&
      !this.prone &&
      this.slideTimer <= 0;
    this.sprinting = wantsSprint;
    if (this.sprinting && this.crouching) this.crouching = false;

    const maxSpeed = this.swimming
      ? wantsSprint
        ? 6.2
        : 4.5
      : this.prone
        ? 2.3
        : this.sprinting
          ? 10.2
          : this.crouching
            ? 4.1
            : adsActive
              ? 4.5
              : 7.2;

    // Smoothly transition eye height (prone, crouch, athletic tactical slide, swim)
    const targetEye =
      this.prone
        ? this.proneEyeHeight
        : this.slideTimer > 0
          ? this.crouchEyeHeight - 0.14
          : this.crouching
            ? this.crouchEyeHeight
            : this.standEyeHeight;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 14, dt);

    _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); // forward
    _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));  // right
    _v3.set(0, 0, 0).addScaledVector(_v1, moveFwd).addScaledVector(_v2, moveRight);
    const inputMag = Math.min(1, _v3.length());
    if (inputMag > 0.001) _v3.normalize().multiplyScalar(inputMag);

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      const dashProgress = this.dashTimer / this.dashDuration;
      const burstSpeed = 16.5 + dashProgress * 12.5;
      this.playerVel.x = this.dashDir.x * burstSpeed;
      this.playerVel.z = this.dashDir.z * burstSpeed;
    } else if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
      const slideT = this.slideTimer / this.slideDuration;
      const slideSpeed = 4.4 + slideT * slideT * 8.6;
      this.playerVel.x = this.slideDir.x * slideSpeed;
      this.playerVel.z = this.slideDir.z * slideSpeed;
    } else {
      const targetVx = _v3.x * maxSpeed;
      const targetVz = _v3.z * maxSpeed;
      const accelLambda = this.swimming ? 6.5 : this.grounded ? 14 : 4.6;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, accelLambda, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, accelLambda, dt);
    }

    if (this.grounded) {
      this.coyoteTimer = 0.11;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      if (this.swimming && waterSurfaceY !== null) {
        this.playerVel.y = 5.4;
        this.jumpBufferTimer = 0;
      } else if (this.coyoteTimer > 0) {
        // Low-obstacle mantle assist when jumping while sprinting/moving into waist-high cover
        let mantleBoost = 8.4;
        if (moveFwd > 0.25 && this.physics.raycastSegment(
          this.playerPos.x,
          this.playerPos.y + 0.9,
          this.playerPos.z,
          this.playerPos.x + _v1.x * 1.15,
          this.playerPos.y + 0.9,
          this.playerPos.z + _v1.z * 1.15,
          this.projRayHit,
          0.02,
        )) {
          const headBlocked = this.physics.raycastSegment(
            this.playerPos.x,
            this.playerPos.y + 2.05,
            this.playerPos.z,
            this.playerPos.x + _v1.x * 1.25,
            this.playerPos.y + 2.05,
            this.playerPos.z + _v1.z * 1.25,
            this.projRayHit,
            0.02,
          );
          if (!headBlocked) mantleBoost = 10.6;
        }
        this.playerVel.y = mantleBoost;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.slideTimer = 0;
        this.audio.playJump();
      }
    }

    // Physics-Based Continuous Sub-Stepped 3D Capsule Simulation against ALL environment meshes
    this.playerBody.height = this.currentEyeHeight + 0.16;
    this.playerBody.grounded = this.grounded;
    if (this.swimming && waterSurfaceY !== null) {
      const floatHeight = waterSurfaceY - 1.15;
      if (this.crouching) {
        this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, -2.6, 5, dt);
      } else if (this.playerPos.y < floatHeight) {
        this.playerVel.y = THREE.MathUtils.clamp((floatHeight - this.playerPos.y) * 9.5, -2, 6.2);
      } else {
        this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, 0, 6, dt);
      }
      this.physics.stepCapsule(this.playerBody, dt, 2.5);
    } else {
      this.physics.stepCapsule(this.playerBody, dt, SIMULATION_CONFIG.gravityMps2);
    }
    if (this.mapId === 'island' && !this.swimming) {
      const minTerrainY = this.sampleFloorClampAt(this.playerPos.x, this.playerPos.z);
      if (this.playerPos.y < minTerrainY) {
        this.playerPos.y = minTerrainY;
        if (this.playerVel.y < 0) this.playerVel.y = 0;
        this.playerBody.grounded = true;
      }
    }
    this.grounded = this.playerBody.grounded;

    if (this.landingAudioCooldown > 0) {
      this.landingAudioCooldown = Math.max(0, this.landingAudioCooldown - dt);
    }
    const playerIndoors = this.isPlayerIndoors();
    const impactDownSpeed = this.playerBody.landingSpeed;

    // Surface-calibrated landing impact audio + physical knee/weapon compression strictly on real drops (> 4.4 m/s)
    if (impactDownSpeed > 4.4 && this.landingAudioCooldown <= 0) {
      this.audio.playLanding(this.detectSurfaceBelowPlayer(), impactDownSpeed, playerIndoors);
      this.landingAudioCooldown = 0.36;
      this.landingDipVel -= Math.min(1.1, impactDownSpeed * 0.09);
      this.weaponRig.triggerLanding(impactDownSpeed);
      this.stepTimer = 0.34;
    }

    // Critically-damped landing knee compression spring
    const landAccel = -this.landingDip * 145 - this.landingDipVel * 20;
    this.landingDipVel += landAccel * dt;
    this.landingDip = THREE.MathUtils.clamp(this.landingDip + this.landingDipVel * dt, -0.18, 0.04);

    // Surface-aware procedural footstep cadence (muted during active slide)
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.grounded && horizSpeed > 1.4 && this.dashTimer <= 0 && this.slideTimer <= 0) {
      const strideRate = this.sprinting ? 1.38 : this.crouching ? 0.72 : 1.0;
      this.stepTimer -= dt * strideRate;
      if (this.stepTimer <= 0) {
        const surface = this.detectSurfaceBelowPlayer();
        this.audio.playFootstep(surface, { sprinting: this.sprinting, indoor: playerIndoors });
        this.stepTimer = 0.42;
      }
    } else {
      this.stepTimer = 0.12;
    }

    // 5. Camera Transform, Dynamic FOV, Optical Sniper Scope Sway & Multi-Axis Shake
    this.shakeClock += dt;
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.6);
    this.gunShakeTrauma = Math.max(0, this.gunShakeTrauma - dt * 4.6);
    // Heavier damage trauma lingers slightly longer with weighty recovery; light hits snap back fast
    const dmgDecayRate = THREE.MathUtils.lerp(2.55, 1.48, THREE.MathUtils.clamp(this.damageShakeTrauma, 0, 1));
    this.damageShakeTrauma = Math.max(0, this.damageShakeTrauma - dt * dmgDecayRate);

    this.gunKickPitch = THREE.MathUtils.damp(this.gunKickPitch, 0, 18, dt);
    this.gunKickYaw = THREE.MathUtils.damp(this.gunKickYaw, 0, 20, dt);
    this.gunKickRoll = THREE.MathUtils.damp(this.gunKickRoll, 0, 16, dt);
    this.gunKickBack = THREE.MathUtils.damp(this.gunKickBack, 0, 22, dt);

    this.damagePunchPitch = THREE.MathUtils.damp(this.damagePunchPitch, 0, 9.2, dt);
    this.damagePunchYaw = THREE.MathUtils.damp(this.damagePunchYaw, 0, 10.2, dt);
    this.damagePunchRoll = THREE.MathUtils.damp(this.damagePunchRoll, 0, 8.2, dt);
    this.damagePunchRight = THREE.MathUtils.damp(this.damagePunchRight, 0, 10.5, dt);
    this.damagePunchUp = THREE.MathUtils.damp(this.damagePunchUp, 0, 10.5, dt);
    this.damagePunchBack = THREE.MathUtils.damp(this.damagePunchBack, 0, 11.5, dt);
    this.damageFovPunch = THREE.MathUtils.damp(this.damageFovPunch, 0, 11.5, dt);

    const st = this.shakeClock;
    const gunAmt = this.gunShakeTrauma * this.gunShakeTrauma;
    const dmgAmt = this.damageShakeTrauma * this.damageShakeTrauma;
    const envAmt = this.shakeTrauma * this.shakeTrauma;

    // Dual-frequency damage concussion: low-freq heavy body sway + crisp high-freq ballistic impact rattle
    const dmgOscPitch =
      (Math.sin(st * 19.0) * 0.55 + Math.cos(st * 37.0) * 0.3 + Math.sin(st * 63.0) * 0.15) * 0.058 * dmgAmt;
    const dmgOscYaw =
      (Math.cos(st * 17.0) * 0.55 + Math.sin(st * 33.0) * 0.3 + Math.cos(st * 59.0) * 0.15) * 0.048 * dmgAmt;
    const dmgOscRoll =
      (Math.sin(st * 15.0) * 0.6 + Math.cos(st * 31.0) * 0.25 + Math.sin(st * 53.0) * 0.15) * 0.078 * dmgAmt;

    const oscPitch =
      (Math.sin(st * 47.0) * 0.65 + Math.cos(st * 73.0) * 0.35) * 0.015 * gunAmt +
      dmgOscPitch +
      Math.sin(st * 31.0) * 0.014 * envAmt;
    const oscYaw =
      (Math.cos(st * 53.0) * 0.6 + Math.sin(st * 81.0) * 0.4) * 0.012 * gunAmt +
      dmgOscYaw +
      Math.cos(st * 27.0) * 0.011 * envAmt;
    const oscRoll =
      (Math.sin(st * 61.0) * 0.55 + Math.cos(st * 41.0) * 0.45) * 0.02 * gunAmt +
      dmgOscRoll +
      Math.sin(st * 35.0) * 0.016 * envAmt;

    const shakeScale = this.settings.reducedMotion ? 0.15 : this.settings.screenShakeScale;
    const shakePitch = (this.gunKickPitch + this.damagePunchPitch + oscPitch) * shakeScale;
    const shakeYaw = (this.gunKickYaw + this.damagePunchYaw + oscYaw) * shakeScale;
    const shakeRoll = (this.gunKickRoll + this.damagePunchRoll + oscRoll) * shakeScale;

    const localRight =
      this.damagePunchRight + Math.sin(st * 41.0) * 0.032 * dmgAmt + Math.cos(st * 67.0) * 0.007 * gunAmt;
    const localUp =
      this.damagePunchUp + Math.cos(st * 31.0) * 0.032 * dmgAmt + Math.sin(st * 59.0) * 0.006 * gunAmt;
    const localBack = this.gunKickBack + this.damagePunchBack + dmgAmt * 0.042;

    // Synced screen-space HUD micro-shake (px & deg) scaled directly to active damage impact
    const rawHudX = (this.damagePunchRight * 125 + Math.sin(st * 43.0) * 11 * dmgAmt);
    const rawHudY = (-this.damagePunchUp * 115 + Math.cos(st * 37.0) * 11 * dmgAmt);
    const rawHudRot = (this.damagePunchRoll * 16 + dmgOscRoll * 18);
    this.hudShakeX = Math.abs(rawHudX) > 0.08 ? THREE.MathUtils.clamp(rawHudX, -18, 18) : 0;
    this.hudShakeY = Math.abs(rawHudY) > 0.08 ? THREE.MathUtils.clamp(rawHudY, -16, 16) : 0;
    this.hudShakeRot = Math.abs(rawHudRot) > 0.02 ? THREE.MathUtils.clamp(rawHudRot, -2.4, 2.4) : 0;

    this.dashRollTilt = THREE.MathUtils.damp(this.dashRollTilt, 0, 10, dt);
    this.slideRoll = THREE.MathUtils.damp(this.slideRoll, this.slideTimer > 0 ? -0.052 : 0, 11, dt);
    this.dashFovBoost = THREE.MathUtils.damp(this.dashFovBoost, 0, this.dashTimer > 0 ? 2.5 : 8.5, dt);
    this.dashVfx = THREE.MathUtils.damp(this.dashVfx, 0, this.dashTimer > 0 ? 2.2 : 9.5, dt);

    // Smart camera recoil auto-recenter once burst finishes (butter-smooth burst control)
    const anyFireHeldNow = this.fireHeld || this.touchFireHeld;
    if (!anyFireHeldNow && this.fireCooldown <= 0.02 && this.recoilRecoveryPitch > 0.0004) {
      const nextRecovery = THREE.MathUtils.damp(this.recoilRecoveryPitch, 0, 11.5, dt);
      const recoverDelta = this.recoilRecoveryPitch - nextRecovery;
      this.pitch = THREE.MathUtils.clamp(this.pitch - recoverDelta, -1.42, 1.42);
      this.recoilRecoveryPitch = nextRecovery;
    } else if (this.recoilRecoveryPitch <= 0.0004) {
      this.recoilRecoveryPitch = 0;
    }

    // Hold-to-Inspect active check (cancels instantly on combat actions or sprinting/sliding/dashing)
    const canInspect =
      (this.inspectHeld || this.controlIsHeld('inspect')) &&
      !adsActive &&
      !this.reloading &&
      !this.sprinting &&
      this.dashTimer <= 0 &&
      this.slideTimer <= 0 &&
      !anyFireHeldNow;
    if (canInspect !== this.inspectingActive) {
      this.inspectingActive = canInspect;
      if (canInspect) {
        this.inspectCycleElapsed = 0;
        this.inspectCheckPlayedCycle = -1;
        this.audio.playInspectStart();
      }
      this.emitHud(true);
    }
    if (this.inspectingActive) {
      this.inspectCycleElapsed += dt;
      const cycleIdx = Math.floor(this.inspectCycleElapsed / 7.2);
      const cycleMod = this.inspectCycleElapsed % 7.2;
      if (cycleMod >= 2.8 && this.inspectCheckPlayedCycle !== cycleIdx) {
        this.inspectCheckPlayedCycle = cycleIdx;
        this.audio.playInspectBoltCheck();
      }
    }

    // Weighted grounded stride headbob + subtle tactical strafe roll (paused during slide/dash)
    if (this.grounded && horizSpeed > 0.5 && this.dashTimer <= 0 && this.slideTimer <= 0) {
      const bobRate = this.sprinting ? 10.6 : this.crouching ? 5.6 : 7.6;
      this.strideBobPhase += dt * (bobRate + Math.min(1, horizSpeed / 9) * 1.8);
    }
    const moveFactor =
      this.grounded && this.dashTimer <= 0 && this.slideTimer <= 0 ? Math.min(1, horizSpeed / 8.5) : 0;
    const adsBobDamp = adsActive ? 0.14 : this.crouching ? 0.48 : 1.0;
    const headBobY = -Math.abs(Math.cos(this.strideBobPhase)) * 0.024 * moveFactor * adsBobDamp;
    const headBobRoll = Math.sin(this.strideBobPhase) * 0.0045 * moveFactor * adsBobDamp;
    this.strafeRoll = THREE.MathUtils.damp(this.strafeRoll, -moveRight * 0.011 * (adsActive ? 0.25 : 1), 10, dt);

    const camFwdX = -Math.sin(this.yaw);
    const camFwdZ = -Math.cos(this.yaw);
    const camRightX = Math.cos(this.yaw);
    const camRightZ = -Math.sin(this.yaw);

    this.camera.position.set(
      this.playerPos.x + camRightX * localRight - camFwdX * localBack,
      this.playerPos.y + this.currentEyeHeight + headBobY + this.landingDip + localUp,
      this.playerPos.z + camRightZ * localRight - camFwdZ * localBack,
    );
    // Keep the camera sphere strictly outside all solid walls, corners, ceilings, and strictly above rendered terrain faces
    this.physics.resolveCameraSphere(this.camera.position, 0.28);
    if (this.mapId === 'island') {
      const floorCamY = this.sampleFloorClampAt(this.camera.position.x, this.camera.position.z) + 0.42;
      if (this.camera.position.y < floorCamY) {
        this.camera.position.y = floorCamY;
      }
    } else if (this.camera.position.y < 0.36) {
      this.camera.position.y = 0.36;
    }
    _euler.set(
      this.pitch + shakePitch,
      this.yaw + shakeYaw,
      shakeRoll + this.dashRollTilt + this.slideRoll + this.strafeRoll + headBobRoll,
      'YXZ',
    );
    this.camera.quaternion.setFromEuler(_euler);

    // Keep analytical sky dome synchronized to camera, stream terrain chunks, update water & directional shadow focus
    this.skyElapsed += dt;
    this.updateDynamicWeather(dt);
    this.skySystem.syncToCamera(this.camera, this.mapId === 'island', this.skyElapsed, this.renderer, dt);
    if (this.mapId === 'island' && this.islandArena) {
      this.islandArena.terrainStreamer.update(
        this.playerPos.x,
        this.playerPos.z,
        this.playerVel.x,
        this.playerVel.z,
        getViewDistanceFarPlane('island', this.settings.viewDistance),
        3,
      );
      this.islandArena.waterSystem.update(
        this.skyElapsed,
        this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
        this.sceneFog.color,
        this.sceneFog.density,
      );
      this.lightingRig.updateIslandShadowFocus(
        this.playerPos,
        this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
        this.renderer,
        !this.isSoftwareGl && this.settings.shadowQuality !== 'off',
      );
      this.lootManager.update(dt, this.playerPos);
    }
    if (this.impactLightTimer > 0) {
      this.impactLightTimer = Math.max(0, this.impactLightTimer - dt);
      this.impactLight.intensity = this.impactLightTimer > 0 ? this.impactLight.intensity * Math.exp(-26 * dt) : 0;
    }

    // Dynamic FOV using user-configurable base FOV (65..105°)
    const spec = WEAPON_SPECS[this.weaponId];
    const baseUserFov = this.settings.fov;
    const opticalZoom = this.weaponId === 'marksman' ? (this.scopeZoomLevel === 10 ? 6 : 3) : this.scopeZoomLevel;
    const sniperFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseUserFov) / 2) / opticalZoom));
    const baseFov = adsActive
      ? ['railpistol', 'marksman'].includes(this.weaponId)
        ? sniperFov
        : spec.adsFov
      : this.inspectingActive
        ? Math.max(60, baseUserFov - 4.2)
        : this.sprinting
          ? Math.min(108, baseUserFov + 5)
          : baseUserFov;
    const fovPunchScale = ['railpistol', 'marksman'].includes(this.weaponId) && adsActive ? 0.22 : 1.0;
    const targetFov = THREE.MathUtils.clamp(baseFov + this.dashFovBoost + this.damageFovPunch * fovPunchScale, 7.2, 110);
    if (Math.abs(this.camera.fov - targetFov) > 0.03) {
      const fovLambda =
        this.dashTimer > 0 || Math.abs(this.damageFovPunch) > 0.35
          ? 24
          : ['railpistol', 'marksman'].includes(this.weaponId) && adsActive
            ? 13
            : this.inspectingActive
              ? 8.5
              : 12;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, fovLambda, dt);
      this.camera.updateProjectionMatrix();
      this.weaponCamera.fov = this.camera.fov;
      this.weaponCamera.updateProjectionMatrix();
    }
    this.weaponCamera.position.copy(this.camera.position);
    this.weaponCamera.quaternion.copy(this.camera.quaternion);
    this.weaponCamera.updateMatrixWorld(true);

    // 6. Weapon Firing & Reloading
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.dynamicSpread = THREE.MathUtils.damp(this.dynamicSpread, 0, 9, dt);

    if (this.reloading) {
      this.reloadTimer -= dt;
      const stageProg = THREE.MathUtils.clamp(1 - Math.max(0, this.reloadTimer) / this.reloadDuration, 0, 1);

      // Synchronized procedural mechanical foley & subtle tactile camera impulses per reload stage
      if (!this.reloadIsEmpty) {
        if (stageProg >= 0.14 && this.reloadAudioStage < 1) {
          this.reloadAudioStage = 1;
          this.audio.playReloadMagOut(false);
        }
        if (stageProg >= 0.62 && this.reloadAudioStage < 2) {
          this.reloadAudioStage = 2;
          this.audio.playReloadMagIn();
          this.gunKickPitch += 0.0045;
          this.gunKickRoll += 0.0055;
        }
      } else {
        if (stageProg >= 0.06 && this.reloadAudioStage < 1) {
          this.reloadAudioStage = 1;
          this.audio.playReloadMagOut(true);
          this.gunKickRoll += 0.005;
        }
        if (stageProg >= 0.45 && this.reloadAudioStage < 2) {
          this.reloadAudioStage = 2;
          this.audio.playReloadMagIn();
          this.gunKickPitch += 0.0065;
          this.gunKickRoll += 0.007;
        }
        if (stageProg >= 0.71 && this.reloadAudioStage < 3) {
          this.reloadAudioStage = 3;
          this.audio.playReloadBoltRack();
          this.gunKickPitch -= 0.0055;
          this.gunKickRoll -= 0.009;
        }
      }

      if (this.reloadTimer <= 0) {
        const needed = spec.magSize - this.ammoMap[this.weaponId];
        const take = Math.min(needed, this.reserveMap[this.weaponId]);
        this.ammoMap[this.weaponId] += take;
        this.reserveMap[this.weaponId] -= take;
        this.reloading = false;
        this.reloadIsEmpty = false;
        this.reloadAudioStage = 0;
        this.audio.playReloadComplete();
        this.emitHud(true);
      }
    } else {
      const anyFireHeld = this.fireHeld || this.touchFireHeld;
      const wantsFire = spec.automatic ? anyFireHeld : this.fireJustPressed;
      if (wantsFire && this.fireCooldown <= 0) {
        this.executeShot();
      }
    }
    this.fireJustPressed = false;

    const reloadProg = this.reloading
      ? THREE.MathUtils.clamp(1 - Math.max(0, this.reloadTimer) / this.reloadDuration, 0, 1)
      : 0;
    this.weaponRig.update(
      dt,
      Math.min(1, horizSpeed / 9),
      this.grounded,
      adsActive,
      this.reloading,
      reloadProg,
      this.ammoMap[this.weaponId] / spec.magSize,
      this.lookDeltaX,
      this.lookDeltaY,
      this.sprinting,
      this.crouching,
      this.reloadIsEmpty,
      this.inspectingActive,
    );
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;

    // Seamless 3D Scope -> Full-Screen Optical Sniper Lens Handoff + Breath Sway
    if (['railpistol', 'marksman'].includes(this.weaponId) && adsActive) {
      const adsBlend = this.weaponRig.getAdsBlend();
      const targetScope = THREE.MathUtils.clamp((adsBlend - 0.56) / 0.34, 0, 1);
      this.scopeAlpha = THREE.MathUtils.damp(this.scopeAlpha, targetScope, 18, dt);
      this.weaponRig.setScopeOverlayHidden(this.scopeAlpha > 0.72);

      this.breathSteady = shiftHeld || this.crouching;
      this.scopeSwayPhase += dt * (this.breathSteady ? 0.85 : 1.55);
      const swayAmp = (this.breathSteady ? 1.6 : 6.8) * (1 + Math.min(1, horizSpeed / 5) * 1.45);
      const targetSwayX =
        Math.sin(this.scopeSwayPhase) * swayAmp +
        this.gunKickYaw * 360 +
        this.damagePunchRight * 260 +
        dmgOscYaw * 420;
      const targetSwayY =
        Math.sin(this.scopeSwayPhase * 2.0) * swayAmp * 0.62 -
        this.gunKickPitch * 420 -
        this.damagePunchPitch * 380 -
        dmgOscPitch * 420;
      this.scopeSwayX = THREE.MathUtils.damp(this.scopeSwayX, targetSwayX, 12, dt);
      this.scopeSwayY = THREE.MathUtils.damp(this.scopeSwayY, targetSwayY, 12, dt);
    } else {
      this.scopeAlpha = THREE.MathUtils.damp(this.scopeAlpha, 0, 22, dt);
      if (this.scopeAlpha < 0.01) this.scopeAlpha = 0;
      this.breathSteady = false;
      this.scopeSwayX = THREE.MathUtils.damp(this.scopeSwayX, 0, 16, dt);
      this.scopeSwayY = THREE.MathUtils.damp(this.scopeSwayY, 0, 16, dt);
      this.weaponRig.setScopeOverlayHidden(false);
    }

    // 7. Shield Recharge & Timers
    this.timeSinceDamaged += dt;
    this.outOfCombatSec += dt;
    if (this.timeSinceDamaged > 4.6 && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 14 * dt);
    }

    if (this.health > 0) {
      const regen = computeHealthRegenStep(this.health, this.maxHealth, this.outOfCombatSec, dt);
      this.health = regen.health;
      this.healthRegenActive = regen.regenerating;
    } else {
      this.healthRegenActive = false;
    }

    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.15);
    this.damageAberration = Math.max(0, this.damageAberration - dt * 3.2);
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    this.damageArcTimer = Math.max(0, this.damageArcTimer - dt);
    for (let i = this.crosshairDamagePops.length - 1; i >= 0; i--) {
      this.crosshairDamagePops[i].age += dt;
      if (this.crosshairDamagePops[i].age >= this.crosshairDamagePops[i].ttl) {
        this.crosshairDamagePops.splice(i, 1);
      }
    }
    if (this.waveBannerTimer > 0) {
      this.waveBannerTimer -= dt;
      if (this.waveBannerTimer <= 0) this.waveBanner = null;
    }
    if (this.pickupNoticeTimer > 0) {
      this.pickupNoticeTimer -= dt;
      if (this.pickupNoticeTimer <= 0) this.pickupNotice = null;
    }

    // 8. Wave Spawning & Enemy AI
    this.updateOrdnance(dt);
    this.updateWaveAndEnemies(dt);

    // 9. Enemy Projectiles & Supply Pickups
    this.updateProjectiles(dt);
    this.updatePickups(dt);

    // 10. Pooled VFX
    this.updateParticlesAndTracers(dt);
  }

  private countAliveEnemies(): number {
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) count++;
    }
    return count;
  }

  private updateWaveAndEnemies(dt: number) {
    const aliveCount = this.countAliveEnemies();

    // Trickle-spawn queued enemies up to an active cap so combat stays brisk & readable
    const maxConcurrent = Math.min(7, 4 + this.wave);
    if (this.spawnQueue.length > 0 && aliveCount < maxConcurrent) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const nextKind = this.spawnQueue.shift()!;
        // Pick a spawn point comfortably distant from the player
        let bestSpawn = this.arena.spawnPoints[0];
        let bestDist = -1;
        for (let attempt = 0; attempt < 4; attempt++) {
          const candidate = this.arena.spawnPoints[Math.floor(Math.random() * this.arena.spawnPoints.length)];
          const d = candidate.distanceTo(this.playerPos);
          if (d > bestDist) {
            bestDist = d;
            bestSpawn = candidate;
          }
        }
        const jitterX = (Math.random() - 0.5) * 2.2;
        const jitterZ = (Math.random() - 0.5) * 2.2;
        const spawnX = bestSpawn.x + jitterX;
        const spawnZ = bestSpawn.z + jitterZ;
        const spawnY = this.physics.sampleGroundAt(spawnX, spawnZ, bestSpawn.y + 4, 0.5, 0.32).y;
        _v1.set(spawnX, spawnY, spawnZ);
        const diffSpec = DIFFICULTY_SPECS[this.difficulty];
        const waveScale = (1 + (this.wave - 1) * 0.14) * diffSpec.enemyHpScale;
        const enemy = this.enemyFactory.createEnemy(nextKind, _v1, waveScale);
        this.scene.add(enemy.root);
        this.enemies.push(enemy);
        this.spawnTimer = Math.max(0.55, 1.35 - this.wave * 0.1);
      }
    }

    // Update each enemy
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Grounded Tactical Death Collapse Animation & Cleanup (no cartoon shrinking blocks)
      if (!e.alive) {
        e.deathTimer -= dt;
        const t = THREE.MathUtils.clamp(1 - e.deathTimer / e.deathDuration, 0, 1);
        const eased = 1 - (1 - t) * (1 - t);
        const floorY = this.arena.terrainHeightAt
          ? this.arena.terrainHeightAt(e.root.position.x, e.root.position.z)
          : 0;
        if (e.kind === 'wasp') {
          e.root.rotation.z += dt * 4.5 * e.deathFallDir;
          e.root.rotation.x += dt * 2.4;
          e.root.position.y = Math.max(floorY + 0.25, e.root.position.y - dt * 5.2);
        } else {
          e.root.rotation.x = -eased * 1.48;
          e.root.rotation.z = eased * 0.28 * e.deathFallDir;
          e.root.position.y = Math.max(floorY - 0.08, e.root.position.y - dt * 0.25);
          if (e.leftKnee && e.rightKnee) {
            e.leftKnee.rotation.x = eased * 0.75;
            e.rightKnee.rotation.x = eased * 0.55;
          }
          if (e.muzzleFlash) e.muzzleFlash.visible = false;
        }
        if (e.deathTimer <= 0) {
          this.scene.remove(e.root);
          this.enemyFactory.disposeEnemyMaterials(e);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // Skip standard ground walk for AI paratroopers currently descending under parachute
      if (this.mapId === 'island' && this.brParatroopers.some((pt) => pt.enemy === e)) {
        continue;
      }

      // Decay hit flash, muzzle flash, recoil kick & hit flinch
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        if (e.hitFlashTimer <= 0) {
          for (const m of e.bodyMaterials) {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
        }
      }
      if (e.muzzleFlashTimer > 0) {
        e.muzzleFlashTimer -= dt;
        if (e.muzzleFlashTimer <= 0 && e.muzzleFlash) {
          e.muzzleFlash.visible = false;
        }
      }
      e.recoilKick = THREE.MathUtils.damp(e.recoilKick, 0, 14, dt);
      e.flinchKick = THREE.MathUtils.damp(e.flinchKick, 0, 11, dt);

      const stun = this.stunnedEnemies.get(e.id) ?? 0;
      if (stun > 0) {
        this.stunnedEnemies.set(e.id, Math.max(0, stun - dt));
        e.isWindingUp = false;
        continue;
      }
      // Delegate terrain-aware & storm-aware steering to modular AI controller
      const steer = stepGroundEnemyMovement(e, this.enemies, i, dt, {
        playerPos: this.playerPos,
        playerAlive: this.health > 0 && !this.spectatorActive,
        physics: this.physics,
        storm: this.storm,
        isIsland: this.mapId === 'island',
      });
      const dx = steer.dxToPlayer;
      const dz = steer.dzToPlayer;
      const dist = steer.distToPlayer;
      const moveSpeedNow = steer.moveSpeedNow;
      const strideAmp = THREE.MathUtils.clamp(moveSpeedNow / 4.2, 0.08, 1.0);
      const prevStrideHalf = Math.floor(e.stridePhase / Math.PI);
      e.stridePhase += dt * (e.kind === 'wasp' ? 4.2 : 6.8 + strideAmp * 3.0);
      const nextStrideHalf = Math.floor(e.stridePhase / Math.PI);

      // Spatialized enemy footsteps routed through DRC subtle-cue bus so players hear flanking threats during firefights
      if (e.kind !== 'wasp' && moveSpeedNow > 0.6 && nextStrideHalf !== prevStrideHalf && dist < 34) {
        const camRightX = Math.cos(this.yaw);
        const camRightZ = -Math.sin(this.yaw);
        const rightDot = ((-dx) * camRightX + (-dz) * camRightZ) / dist;
        const stepSurface = e.root.position.y > 0.14 ? 'wood' : 'dirt';
        this.audio.playEnemyFootstep(stepSurface, dist, rightDot, e.kind === 'sentinel');
      }

      if (e.leftLeg && e.rightLeg) {
        const leftSwing = Math.sin(e.stridePhase) * 0.56 * strideAmp;
        const rightSwing = Math.sin(e.stridePhase + Math.PI) * 0.56 * strideAmp;
        e.leftLeg.rotation.x = leftSwing;
        e.rightLeg.rotation.x = rightSwing;
        // Articulated knees flex backward cleanly during swing phase
        if (e.leftKnee && e.rightKnee) {
          e.leftKnee.rotation.x = Math.max(0.08, -Math.cos(e.stridePhase) * 0.65 * strideAmp);
          e.rightKnee.rotation.x = Math.max(0.08, -Math.cos(e.stridePhase + Math.PI) * 0.65 * strideAmp);
        }
      }
      if (e.torsoGroup) {
        const breath = Math.sin(e.stridePhase * 0.45) * 0.025;
        const aimLean = e.isWindingUp ? 0.14 : 0.08 * strideAmp;
        e.torsoGroup.rotation.x = aimLean - e.flinchKick * 0.28 + breath;
        e.torsoGroup.rotation.z = -e.strafeDir * 0.055 * strideAmp + Math.sin(e.stridePhase) * 0.03 * strideAmp;
      }
      if (e.weaponGroup) {
        e.weaponGroup.rotation.x = -e.recoilKick * 0.22;
        e.weaponGroup.position.z = 0.06 * (e.kind === 'sentinel' ? 1.12 : 1.0) - e.recoilKick * 0.065;
      }
      if (e.rotors) {
        for (const r of e.rotors) r.rotation.y += dt * 32;
        if (e.root.children[1]) {
          e.root.children[1].position.y = e.hoverBaseY + Math.sin(e.stridePhase) * 0.18;
          e.root.children[1].rotation.z = -e.strafeDir * 0.14;
        }
      }

      const smokeBlocked = this.zones.some(zone => zone.kind === 'smoke' && this.segmentNearSphere(e.root.position, this.playerPos, zone.mesh.position, zone.radius));
      if (smokeBlocked) { e.isWindingUp = false; e.fireCooldown = Math.max(e.fireCooldown, 0.3); continue; }
      // Attack Telegraph Windup & Projectile Firing
      if (e.isWindingUp) {
        e.windupTimer -= dt;
        const chargeProgress = 1 - Math.max(0, e.windupTimer) / e.windupDuration;
        // Subtle realistic optic/goggle glint ramp during attack telegraph
        e.coreMaterial.emissiveIntensity = 0.75 + chargeProgress * 2.8;
        if (e.windupTimer <= 0) {
          e.isWindingUp = false;
          e.coreMaterial.emissiveIntensity = 0.55;
          this.fireEnemyProjectile(e);
          const diffSpec = DIFFICULTY_SPECS[this.difficulty];
          const baseCd = (e.kind === 'sentinel' ? 1.85 : e.kind === 'wasp' ? 1.35 : 1.55) + Math.random() * 0.65;
          e.fireCooldown = baseCd * diffSpec.enemyFireIntervalScale;
        }
      } else {
        e.fireCooldown -= dt;
        const maxEngageRange = this.mapId === 'island' ? 68 : 34;
        if (e.fireCooldown <= 0 && dist < maxEngageRange) {
          // Verify rough line of sight before telegraphing
          _v1.copy(e.root.position).setY(e.kind === 'wasp' ? e.root.position.y + e.hoverBaseY : e.root.position.y + 1.6);
          _v2.copy(this.playerPos).setY(this.playerPos.y + 1.3);
          // AI needs a visibility answer, not triangle-level impact details.
          // Query the spatial hash instead of testing every facade triangle.
          const blocked = this.physics.raycastSegment(
            _v1.x, _v1.y, _v1.z, _v2.x, _v2.y, _v2.z, this.projRayHit, 0.01,
          );
          if (!blocked) {
            e.isWindingUp = true;
            e.windupTimer = e.windupDuration;
          } else {
            e.fireCooldown = 0.45;
          }
        }
      }
    }

    // In Battle Royale mode, victory is governed by brAliveCount rather than 5 fixed waves
    if (this.mapId === 'island') {
      return;
    }

    // Check Wave Completion
    const remaining = this.spawnQueue.length + this.countAliveEnemies();
    if (remaining === 0) {
      if (this.waveClearDelay === 0) {
        this.audio.playWaveClear();
        this.score += 250 * this.wave;
        if (this.score > this.bestScore) {
          this.bestScore = this.score;
          try {
            window.localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
          } catch {
            // Ignore
          }
        }

        if (!this.endless && this.wave >= MAX_WAVES) {
          this.phase = 'victory';
          this.clearInputs();
          this.exitPointerLockSafe();
          this.emitHud(true);
          return;
        }
        this.waveClearDelay = 2.6;
        this.waveBanner = `Wave ${this.wave} Cleared — Resupplying`;
        this.waveBannerTimer = 2.5;
      } else {
        this.waveClearDelay -= dt;
        if (this.waveClearDelay <= 0) {
          this.waveClearDelay = 0;
          this.shield = this.maxShield;
          this.health = Math.min(this.maxHealth, this.health + 15);
          this.startWave(this.wave + 1);
        }
      }
    }
  }

  /**
   * Simulates the 3D C-130 Hercules transport aircraft, AI paratrooper drops,
   * player skydiving/parachute descent, ambient AI skirmishes, and the shrinking 10 km² storm circle.
   */
  private updateBattleRoyaleSystem(dt: number) {
    // 1. Update C-130 Transport Airplane flying across the 10 km² island
    if (this.deployment.countdownSec > 0) {
      this.deployment.countdownSec = Math.max(0, this.deployment.countdownSec - dt);
      if (this.deployment.countdownSec === 0 && this.brStage === 'airdrop_plane') {
        this.waveBanner = 'GREEN LIGHT · PRESS [SPACE] OR [F] TO JUMP';
        this.waveBannerTimer = 4.5;
      }
    }

    const flightLen = this.deployment.planeStart.distanceTo(this.deployment.planeEnd) || 2800;
    if (this.deployment.planeProgress < 1.15) {
      this.deployment.planeProgress += (this.deployment.planeSpeed * dt) / flightLen;
      this.deployment.planePos.lerpVectors(
        this.deployment.planeStart,
        this.deployment.planeEnd,
        this.deployment.planeProgress,
      );
      if (this.brAirplane) {
        this.brAirplane.group.visible = true;
        this.brAirplane.group.position.copy(this.deployment.planePos);
        for (let i = 0; i < this.brAirplane.propellers.length; i++) {
          this.brAirplane.propellers[i].rotation.z += dt * 38;
        }
      }

      if (
        this.deployment.planeProgress >= this.deployment.nextBotDropProgress &&
        this.deployment.planeProgress <= 0.92 &&
        this.deployment.botsRemainingToSpawn > 0
      ) {
        this.spawnAiParatrooperFromPlane();
        this.deployment.nextBotDropProgress += 0.04;
      }

      if (this.brStage === 'airdrop_plane' && this.deployment.planeProgress >= 0.93) {
        this.ejectFromTransportPlane();
      }
    } else if (this.brAirplane) {
      this.brAirplane.group.visible = false;
    }

    // 2. Update descending AI paratroopers with 3D parachute canopies
    for (let i = this.brParatroopers.length - 1; i >= 0; i--) {
      const pt = this.brParatroopers[i];
      if (!pt.enemy.alive) {
        if (pt.parachute.parent) pt.parachute.parent.remove(pt.parachute);
        this.brParatroopers.splice(i, 1);
        continue;
      }
      const pos = pt.enemy.root.position;
      const dx = pt.targetX - pos.x;
      const dz = pt.targetZ - pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const glideSpeed = Math.min(18, dist * 0.45);
      pos.x += (dx / dist) * glideSpeed * dt;
      pos.z += (dz / dist) * glideSpeed * dt;
      pos.y -= 13.5 * dt;
      pt.enemy.root.rotation.y = Math.atan2(dx, dz);

      const groundY = this.physics.sampleGroundAt(pos.x, pos.z, pos.y + 2, pt.enemy.radius, 0.32).y;
      if (pos.y <= groundY + 0.15) {
        pos.y = groundY;
        if (pt.parachute.parent) pt.parachute.parent.remove(pt.parachute);
        this.brParatroopers.splice(i, 1);
      }
    }

    // 3. Keep active ground combatants populated near the player's sector & simulate off-screen BR eliminations
    if (this.brStage === 'grounded') {
      const activeEnemies = this.countAliveEnemies();
      if (this.deployment.botsRemainingToSpawn > 0 && activeEnemies < 7 && this.brAliveCount - 1 > activeEnemies) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.deployment.botsRemainingToSpawn--;
          const angle = Math.random() * Math.PI * 2;
          const dist = 42 + Math.random() * 54;
          const sx = THREE.MathUtils.clamp(
            this.playerPos.x + Math.cos(angle) * dist,
            -ISLAND_HALF_SIZE + 80,
            ISLAND_HALF_SIZE - 80,
          );
          const sz = THREE.MathUtils.clamp(
            this.playerPos.z + Math.sin(angle) * dist,
            -ISLAND_HALF_SIZE + 80,
            ISLAND_HALF_SIZE - 80,
          );
          const sy = sampleIslandHeight(sx, sz);
          if (sy > 0.5) {
            const kinds: EnemyKind[] = ['striker', 'striker', 'sentinel', 'wasp'];
            const kind = kinds[this.deployment.botsRemainingToSpawn % kinds.length];
            const diffSpec = DIFFICULTY_SPECS[this.difficulty];
            const enemy = this.enemyFactory.createEnemy(kind, new THREE.Vector3(sx, sy, sz), diffSpec.enemyHpScale);
            this.scene.add(enemy.root);
            this.enemies.push(enemy);
          } else {
            this.deployment.botsRemainingToSpawn++;
          }
          this.spawnTimer = 1.6;
        }
      }

      // Ambient distant AI vs AI skirmish eliminations (never reduces below active nearby bots + 1 player)
      if (this.brAliveCount > activeEnemies + 2) {
        this.islandBotSkirmishTimer -= dt;
        if (this.islandBotSkirmishTimer <= 0) {
          this.islandBotSkirmishTimer = 7.5 + Math.random() * 5.0;
          this.brAliveCount = Math.max(activeEnemies + 1, this.brAliveCount - 1);
          if (this.deployment.botsRemainingToSpawn > 0) this.deployment.botsRemainingToSpawn--;
          const weapons: WeaponId[] = ['carbine', 'smg', 'marksman', 'shotgun'];
          this.killFeed.unshift({
            id: this.nextKillFeedId++,
            killer: `Nomad-${10 + (this.nextKillFeedId % 19)}`,
            victim: `Viper-${21 + (this.nextKillFeedId % 17)}`,
            weapon: weapons[this.nextKillFeedId % weapons.length],
            headshot: this.nextKillFeedId % 4 === 0,
            ttl: 4.5,
          });
          if (this.killFeed.length > 4) this.killFeed.pop();
        }
      }
    }

    // 4. Shrinking Battle Royale Storm Circle & Vertical-Fading 3D Storm Wall
    const stormEv = this.storm.update(dt);
    if (stormEv.phaseStartedClosing) {
      this.waveBanner = `STORM PHASE ${this.storm.phase} CLOSING · MOVE TO SAFE ZONE`;
      this.waveBannerTimer = 3.5;
    }

    if (this.brStormWall) {
      this.brStormWall.visible = this.storm.radius > 1;
      this.brStormWall.position.set(this.storm.centerX, 580, this.storm.centerZ);
      this.brStormWall.scale.set(Math.max(1, this.storm.radius), 1, Math.max(1, this.storm.radius));
      const wallMat = this.brStormWall.material;
      if (wallMat instanceof THREE.ShaderMaterial && wallMat.uniforms?.uTime) {
        wallMat.uniforms.uTime.value = this.skyElapsed;
      }
    }

    if (this.brStage === 'grounded' && this.health > 0 && !this.spectatorActive) {
      const stormDmg = this.storm.sampleStormDamage(this.playerPos.x, this.playerPos.z, dt);
      if (stormDmg > 0) {
        this.applyPlayerDamage(stormDmg);
      }
    }

    // 5. Handle Airdrop Camera & Aerodynamic Skydiving / Parachute Flight Physics
    if (this.brStage === 'airdrop_plane') {
      this.playerPos.copy(this.deployment.planePos);
      const camDist = 34;
      const camElev = 11;
      this.camera.position.set(
        this.deployment.planePos.x + Math.sin(this.yaw) * camDist * Math.cos(this.pitch * 0.5),
        this.deployment.planePos.y + camElev - Math.sin(this.pitch) * 18,
        this.deployment.planePos.z + Math.cos(this.yaw) * camDist * Math.cos(this.pitch * 0.5),
      );
      this.camera.lookAt(
        this.deployment.planePos.x + this.deployment.planeDir.x * 4,
        this.deployment.planePos.y - 3,
        this.deployment.planePos.z + this.deployment.planeDir.z * 4,
      );
      this.syncIslandAtmosphereAndStreaming(
        dt,
        this.deployment.planeDir.x * this.deployment.planeSpeed,
        this.deployment.planeDir.z * this.deployment.planeSpeed,
      );
      this.updateParticlesAndTracers(dt);
      return;
    }

    if (this.brStage === 'freefall' || this.brStage === 'parachute') {
      const keyFwd = (this.controlIsHeld('forward') ? 1 : 0) - (this.controlIsHeld('backward') ? 1 : 0);
      const keyRight = (this.controlIsHeld('right') ? 1 : 0) - (this.controlIsHeld('left') ? 1 : 0);
      const moveFwd = THREE.MathUtils.clamp(keyFwd + this.touchMoveY, -1, 1);
      const moveRight = THREE.MathUtils.clamp(keyRight + this.touchMoveX, -1, 1);

      _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      _v3.set(0, 0, 0).addScaledVector(_v1, moveFwd).addScaledVector(_v2, moveRight);
      if (_v3.lengthSq() > 1) _v3.normalize();

      const isParachute = this.brStage === 'parachute';
      const maxGlideHoriz = isParachute ? 30.0 : 58.0;
      const targetVy = isParachute ? -10.8 : moveFwd > 0.2 ? -52.0 : -39.0;

      const autoGlide = isParachute && Math.abs(moveFwd) < 0.1 ? 0.45 : 0;
      const targetVx = (_v3.x + _v1.x * autoGlide) * maxGlideHoriz;
      const targetVz = (_v3.z + _v1.z * autoGlide) * maxGlideHoriz;

      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, isParachute ? 4.2 : 3.0, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, isParachute ? 4.2 : 3.0, dt);
      this.playerVel.y = THREE.MathUtils.damp(this.playerVel.y, targetVy, isParachute ? 6.5 : 3.5, dt);

      this.playerPos.addScaledVector(this.playerVel, dt);
      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, -ISLAND_HALF_SIZE + 30, ISLAND_HALF_SIZE - 30);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, -ISLAND_HALF_SIZE + 30, ISLAND_HALF_SIZE - 30);

      const groundY = this.physics.sampleGroundAt(
        this.playerPos.x,
        this.playerPos.z,
        this.playerPos.y + 2,
        this.playerRadius,
        0.32,
      ).y;
      const waterSurfaceAtDrop = this.getWaterSurfaceYAt(this.playerPos.x, this.playerPos.z);
      const effectiveFloorY =
        waterSurfaceAtDrop !== null && waterSurfaceAtDrop - groundY > 1.15
          ? waterSurfaceAtDrop - 1.05
          : groundY;
      const agl = this.playerPos.y - effectiveFloorY;
      if (agl < 180) {
        this.islandArena?.terrainStreamer.ensureHighLodAround(this.playerPos.x, this.playerPos.z, 900);
      }

      if (this.brStage === 'freefall' && agl <= WORLD_CONFIG.autoParachuteAglMeters) {
        this.deployParachute();
      }

      // Render & articulate 3D Third-Person Skydiver Character Rig during BOTH diving & parachuting!
      if (this.brPlayerRig) {
        this.brPlayerRig.root.visible = true;
        this.brPlayerRig.root.position.copy(this.playerPos);
        this.brPlayerRig.root.rotation.set(0, this.yaw, 0);
        updateSkydiverRigPose(
          this.brPlayerRig,
          isParachute ? 'parachute' : 'freefall',
          moveFwd,
          moveRight,
          this.skyElapsed,
        );
      }

      if (this.playerPos.y <= effectiveFloorY + 0.14) {
        this.playerPos.y = effectiveFloorY;
        this.playerVel.set(0, 0, 0);
        const landedInWater = waterSurfaceAtDrop !== null && waterSurfaceAtDrop - groundY > 1.15;
        this.swimming = landedInWater;
        this.grounded = !landedInWater;
        this.playerBody.grounded = !landedInWater;
        this.brStage = 'grounded';
        this.lifecycle.transition('active_match');
        if (this.brPlayerRig) {
          this.brPlayerRig.root.visible = false;
          this.brPlayerRig.canopyGroup.visible = false;
        }
        // Synchronously build all surrounding 64x64 LOD 0 chunks before switching to FPS view (zero LOD seam/tent!)
        this.islandArena?.terrainStreamer.ensureHighLodAround(this.playerPos.x, this.playerPos.z, 620);

        this.weaponRig.root.visible = true;
        this.landingDipVel = -0.95;
        this.weaponRig.triggerLanding(7.5);
        this.audio.playLanding(landedInWater ? 'dirt' : 'dirt', 6.5, false);

        const poi = findNearestIslandPoi(this.playerPos.x, this.playerPos.z);
        const lookAheadDist = Math.hypot(
          this.playerPos.x - Math.sin(this.yaw) * 140,
          this.playerPos.z - Math.cos(this.yaw) * 140,
        );
        if (lookAheadDist > 1280) {
          this.yaw = Math.atan2(-(poi.x - this.playerPos.x), -(poi.z - this.playerPos.z));
        }
        this.pitch = THREE.MathUtils.clamp(this.pitch, -0.09, 0.05);

        // Snap seamlessly into first-person perspective on the touchdown frame
        this.camera.position.set(this.playerPos.x, this.playerPos.y + this.currentEyeHeight, this.playerPos.z);
        _euler.set(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(_euler);
        this.camera.fov = this.settings.fov;
        this.camera.updateProjectionMatrix();

        this.waveBanner = `TOUCHDOWN · ${poi.name} · ${this.brAliveCount} ALIVE`;
        this.waveBannerTimer = 4.0;
        this.spawnTimer = 0.4;
        this.syncIslandAtmosphereAndStreaming(dt, 0, 0);
        this.emitHud(true);
        return;
      }

      // Third-Person Follow Camera behind 3D Skydiver / Paratrooper Rig
      this.shakeClock += dt;
      const followBack = isParachute ? 6.4 : 4.6;
      const followUp = isParachute ? 2.6 : 1.75;
      const lookPitch = THREE.MathUtils.clamp(this.pitch, -1.15, 0.45);
      const backHoriz = Math.cos(lookPitch * 0.55) * followBack;
      const liftY = followUp - Math.sin(lookPitch) * (followBack * 0.65);

      const camX = this.playerPos.x + Math.sin(this.yaw) * backHoriz;
      const camZ = this.playerPos.z + Math.cos(this.yaw) * backHoriz;
      const minTerrainY = this.sampleFloorClampAt(camX, camZ) + 0.85;
      const camY = Math.max(minTerrainY, this.playerPos.y + liftY);

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(
        this.playerPos.x - Math.sin(this.yaw) * 1.4,
        this.playerPos.y + (isParachute ? 2.15 : 0.95),
        this.playerPos.z - Math.cos(this.yaw) * 1.4,
      );

      const targetFov = isParachute ? this.settings.fov + 4 : this.settings.fov + 12;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, THREE.MathUtils.clamp(targetFov, 65, 110), 6, dt);
      this.camera.updateProjectionMatrix();

      this.syncIslandAtmosphereAndStreaming(dt, this.playerVel.x, this.playerVel.z);
      this.updateParticlesAndTracers(dt);
    }
  }

  private sampleFloorClampAt(x: number, z: number): number {
    if (this.mapId !== 'island') return 0;
    return this.islandArena?.terrainStreamer.sampleActiveRenderedHeightAt(x, z) ?? sampleRenderedTerrainTriangleHeight(x, z);
  }

  private syncIslandAtmosphereAndStreaming(dt: number, velX: number, velZ: number) {
    this.skyElapsed += dt;
    this.skySystem.syncToCamera(this.camera, true, this.skyElapsed, this.renderer, dt);
    if (this.islandArena) {
      this.islandArena.terrainStreamer.update(
        this.playerPos.x,
        this.playerPos.z,
        velX,
        velZ,
        getViewDistanceFarPlane('island', this.settings.viewDistance),
        3,
      );
      this.islandArena.waterSystem.update(
        this.skyElapsed,
        this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
        this.sceneFog.color,
        this.sceneFog.density,
      );
      this.lightingRig.updateIslandShadowFocus(
        this.playerPos,
        this.skyMat.uniforms.uSunDir.value as THREE.Vector3,
        this.renderer,
        !this.isSoftwareGl && this.settings.shadowQuality !== 'off',
      );
    }
  }

  private getWaterSurfaceYAt(x: number, z: number): number | null {
    if (this.mapId !== 'island') return null;
    const nx = (x - 60) / 185;
    const nz = (z - -285) / 185;
    if (z < -92 && nx * nx + nz * nz <= 1.0) return WORLD_CONFIG.reservoirWaterLevel;
    for (let i = 0; i < INLAND_LAKES.length; i++) {
      const lake = INLAND_LAKES[i];
      if (evalInlandLakeDist(x, z, lake) <= 1.02) {
        return lake.waterLevel;
      }
    }
    if (z >= -54 && z <= 920 && Math.abs(x - sampleRiverCenterX(z)) < 14) {
      return sampleRiverWaterY(z);
    }
    return WORLD_CONFIG.oceanWaterLevel;
  }

  private updateProjectiles(dt: number) {
    const playerCenterY = this.playerPos.y + this.currentEyeHeight * 0.65;

    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const prevX = p.pos.x;
      const prevY = p.pos.y;
      const prevZ = p.pos.z;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Arena perimeter or floor hit
      const { minX, maxX, minZ, maxZ } = this.arena.bounds;
      const localFloorY = this.arena.terrainHeightAt ? this.arena.terrainHeightAt(p.pos.x, p.pos.z) : 0;
      if (
        p.pos.y <= localFloorY + 0.08 ||
        p.pos.x < minX - 2 ||
        p.pos.x > maxX + 2 ||
        p.pos.z < minZ - 2 ||
        p.pos.z > maxZ + 2
      ) {
        this.spawnParticleBurst(p.pos, 5, 0xff6b35, 3.8);
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Spatial-grid swept 3D ray-segment vs. ALL environment mesh colliders (zero wall tunneling)
      if (this.physics.raycastSegment(prevX, prevY, prevZ, p.pos.x, p.pos.y, p.pos.z, this.projRayHit, 0.04)) {
        this.spawnParticleBurst(this.projRayHit.point, 6, 0xff6b35, 4.2);
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Player cylinder hit check
      const dx = p.pos.x - this.playerPos.x;
      const dz = p.pos.z - this.playerPos.z;
      const dy = Math.abs(p.pos.y - playerCenterY);
      if (dx * dx + dz * dz < 0.72 * 0.72 && dy < 0.98) {
        // Compute directional damage indicator angle relative to camera forward
        const incomingX = -p.vel.x;
        const incomingZ = -p.vel.z;
        const fwdX = -Math.sin(this.yaw);
        const fwdZ = -Math.cos(this.yaw);
        const rightX = Math.cos(this.yaw);
        const rightZ = -Math.sin(this.yaw);
        const dotFwd = incomingX * fwdX + incomingZ * fwdZ;
        const dotRight = incomingX * rightX + incomingZ * rightZ;
        this.damageArcAngle = Math.atan2(dotRight, dotFwd);
        this.damageArcTimer = 0.75;

        this.applyPlayerDamage(p.damage);
        p.active = false;
        p.mesh.visible = false;
      }
    }
  }

  private applyPlayerDamage(
    amount: number,
    attackerId?: string,
    attackerName?: string,
    weaponId?: WeaponId | GrenadeId,
    isHeadshot?: boolean,
  ) {
    this.timeSinceDamaged = 0;
    this.outOfCombatSec = 0;

    const hadShield = this.shield > 0;
    let remaining = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    const shieldBroken = hadShield && this.shield <= 0;
    const hitHealth = remaining > 0;
    if (hitHealth) {
      this.health = Math.max(0, this.health - remaining);
    }

    const dmgScale = THREE.MathUtils.clamp(amount / 20, 0.28, 1.65) + (shieldBroken ? 0.3 : 0);
    this.damageFlash = Math.min(1, this.damageFlash + THREE.MathUtils.clamp(0.32 + 0.52 * dmgScale, 0.38, 1.0));
    this.damageAberration = Math.min(1.25, Math.max(this.damageAberration, 0.42 + 0.62 * dmgScale));
    this.triggerDamageShake(amount, this.damageArcAngle, shieldBroken, hitHealth);
    this.audio.playPlayerDamage(dmgScale, shieldBroken);

    if (this.health <= 0) {
      if (this.multiplayerConfig?.mode === 'deathmatch') {
        this.respawnTimer = 3.0;
        this.health = 0;
        const myName = this.networkManager?.getLocalPlayer()?.name ?? 'Operative';
        this.networkManager?.broadcast({
          type: 'player-killed',
          victimId: this.networkManager.localPlayerId,
          victimName: myName,
          killerId: attackerId ?? 'opponent',
          killerName: attackerName ?? 'Opponent',
          weaponId: weaponId ?? 'carbine',
          isHeadshot: Boolean(isHeadshot),
        });
      } else {
        if (this.mapId === 'island') {
          this.placement = Math.max(2, this.brAliveCount);
          this.lifecycle.transition('eliminated');
        }
        this.phase = 'gameover';
        this.clearInputs();
        this.exitPointerLockSafe();
      }
    }
    this.emitHud(true);
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      if (!pk.active) continue;
      pk.phase += dt * 2.8;
      pk.group.rotation.y += dt * 1.9;
      pk.group.position.y = pk.pos.y + Math.sin(pk.phase) * 0.14;

      const dx = this.playerPos.x - pk.pos.x;
      const dz = this.playerPos.z - pk.pos.z;
      const dy = Math.abs(this.playerPos.y + 0.6 - pk.pos.y);
      if (dx * dx + dz * dz < 1.35 * 1.35 && dy < 1.3) {
        if (pk.kind === 'health') {
          if (this.health >= this.maxHealth && this.shield >= this.maxShield) continue;
          this.health = Math.min(this.maxHealth, this.health + 35);
          this.shield = Math.min(this.maxShield, this.shield + 25);
          this.pickupNotice = '+35 HEALTH · +25 SHIELD';
        } else {
          for (const id of inventoryWeapons(this.loadout)) this.reserveMap[id] = Math.min(WEAPON_SPECS[id].reserveMax, this.reserveMap[id] + WEAPON_SPECS[id].magSize * 2);
          this.pickupNotice = 'AMMO RESERVES REPLENISHED';
        }
        this.pickupNoticeTimer = 2.0;
        this.audio.playPickup();
        pk.active = false;
        pk.group.visible = false;
        this.emitHud(true);
      }
    }
  }

  private updateParticlesAndTracers(dt: number) {
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) {
          t.mesh.visible = false;
        } else {
          t.mat.opacity = (t.life / t.maxLife) * 0.9;
        }
      }
    }

    let dirty = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.04) {
        p.pos.y = 0.04;
        p.vel.y *= -0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      p.rot.x += p.rotVel.x * dt;
      p.rot.y += p.rotVel.y * dt;
      p.rot.z += p.rotVel.z * dt;

      const s = p.scale * (p.life / p.maxLife);
      _quat.setFromEuler(p.rot);
      _scale.set(s, s, s);
      _mat4.compose(p.pos, _quat, _scale);
      this.particleMesh.setMatrixAt(i, _mat4);
    }

    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    this.updateImpactDust(dt);
    this.updateAmbientDust(dt);
    this.updateDamageNumbers(dt);
  }

  private updateImpactDust(dt: number) {
    const drag = Math.exp(-4.2 * dt);
    for (let i = 0; i < this.impactDust.length; i++) {
      const dp = this.impactDust[i];
      if (!dp.active) continue;

      dp.life -= dt;
      if (dp.life <= 0) {
        dp.active = false;
        dp.sprite.visible = false;
        continue;
      }

      dp.vel.multiplyScalar(drag);
      dp.vel.y += 0.45 * dt; // warm buoyant dust drift
      dp.pos.addScaledVector(dp.vel, dt);
      dp.sprite.position.copy(dp.pos);

      const p = 1 - dp.life / dp.maxLife;
      const eased = 1 - (1 - p) * (1 - p);
      const s = THREE.MathUtils.lerp(dp.baseScale, dp.maxScale, eased);
      dp.sprite.scale.set(s, s, 1);
      dp.mat.rotation += dt * 0.55;
      dp.mat.opacity = dp.baseOpacity * (1 - p) * (1 - p * 0.4);
    }
  }

  private updateAmbientDust(dt: number) {
    const t = this.skyElapsed;
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    // 1. Sunlit floating dust motes drifting across a 64m volume anchored around the player
    const moteAttr = this.dustMotesPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const moteArr = moteAttr.array as Float32Array;
    const moteCount = this.dustMotesPhase.length;
    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      const ph = this.dustMotesPhase[i];
      const bx = this.dustMotesBasePos[idx] + t * 1.15;
      const by = this.dustMotesBasePos[idx + 1] + Math.sin(t * 0.75 + ph) * 0.42;
      const bz = this.dustMotesBasePos[idx + 2] + t * 0.42 + Math.cos(t * 0.55 + ph) * 0.35;

      // Wrap seamlessly into [-32, +32] around player
      moteArr[idx] = px + ((((bx - px + 32) % 64) + 64) % 64) - 32;
      moteArr[idx + 1] = by;
      moteArr[idx + 2] = pz + ((((bz - pz + 32) % 64) + 64) % 64) - 32;
    }
    moteAttr.needsUpdate = true;

    // 2. Low-altitude desert wind dust wisps skimming Main Street
    const wispAttr = this.dustWispsPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wispArr = wispAttr.array as Float32Array;
    const wispCount = this.dustWispsPhase.length;
    for (let i = 0; i < wispCount; i++) {
      const idx = i * 3;
      const ph = this.dustWispsPhase[i];
      const bx = this.dustWispsBasePos[idx] + t * 2.35;
      const by = this.dustWispsBasePos[idx + 1] + Math.sin(t * 0.45 + ph) * 0.35;
      const bz = this.dustWispsBasePos[idx + 2] + t * 0.85;

    wispArr[idx] = px + ((((bx - px + 38) % 76) + 76) % 76) - 38;
      wispArr[idx + 1] = by;
      wispArr[idx + 2] = pz + ((((bz - pz + 38) % 76) + 76) % 76) - 38;
    }
    wispAttr.needsUpdate = true;

    this.updateAnimatedArenaProps(dt);
  }

  private updateAnimatedArenaProps(dt: number) {
    const props = this.arena.animatedProps;
    const t = this.skyElapsed;
    const wind = this.currentWeatherWind;

    // 1. Water-tower frontier windmill rotor driven by current weather wind
    if (props.windmillWheel) {
      props.windmillWheel.rotation.z += dt * (0.68 + wind * 1.45);
    }

    // 2. Town Square flagpole banner fluttering organically in desert wind
    if (props.flagMesh) {
      props.flagMesh.rotation.y =
        0.22 +
        Math.sin(t * (3.1 + wind * 2.4)) * (0.14 + wind * 0.08) +
        Math.sin(t * 7.3) * 0.05;
      props.flagMesh.rotation.z = Math.sin(t * 4.4) * 0.032;
    }

    // 3. Desert tumbleweeds rolling & bouncing across the outer outskirts
    for (let i = 0; i < props.tumbleweeds.length; i++) {
      const tw = props.tumbleweeds[i];
      const windSpeed = tw.speed * (0.75 + wind * 0.85);
      const span = tw.rangeX * 2;
      const offset = (((t * windSpeed + tw.phase * 7.5) % span) + span) % span - tw.rangeX;
      tw.mesh.position.x = tw.baseX + offset;
      tw.mesh.position.z = tw.baseZ + Math.sin(t * 0.55 + tw.phase) * 1.65;
      tw.mesh.position.y = 0.42 + Math.abs(Math.sin(t * (2.6 + windSpeed * 0.45) + tw.phase)) * 0.17;
      tw.mesh.rotation.z -= (windSpeed * dt) / 0.42;
      tw.mesh.rotation.x += dt * 0.62;
    }
  }

  private updateDynamicWeather(dt: number) {
    // Keep Battle Royale Island in crisp bright sunlit daylight (matching Shot 1/2/5/10 unless user explicitly selects Time-of-Day)
    if (this.mapId === 'island') {
      if (!this.weatherHoldApplied) {
        this.applyTimeOfDayPreset();
        this.weatherHoldApplied = true;
      }
      return;
    }

    this.weatherTimer += dt;
    const cycleSpan = WEATHER_HOLD_SEC + WEATHER_TRANSITION_SEC;
    if (this.weatherTimer >= cycleSpan) {
      this.weatherTimer -= cycleSpan;
      this.weatherIdx = (this.weatherIdx + 1) % WEATHER_ORDER.length;
      this.weatherHoldApplied = false;
    }

    // Skip redundant 25+ uniform/color updates during the 26s steady weather hold window
    if (this.weatherTimer <= WEATHER_HOLD_SEC && this.weatherHoldApplied) {
      return;
    }

    const fromKey = WEATHER_ORDER[this.weatherIdx];
    const toKey = WEATHER_ORDER[(this.weatherIdx + 1) % WEATHER_ORDER.length];
    const fromPreset = WEATHER_PRESETS[fromKey];
    const toPreset = WEATHER_PRESETS[toKey];

    let blend = 0;
    if (this.weatherTimer > WEATHER_HOLD_SEC) {
      this.weatherHoldApplied = false;
      const raw = THREE.MathUtils.clamp((this.weatherTimer - WEATHER_HOLD_SEC) / WEATHER_TRANSITION_SEC, 0, 1);
      // Cubic smoothstep for natural meteorological easing
      blend = raw * raw * (3 - 2 * raw);
    } else {
      this.weatherHoldApplied = true;
    }

    this.applyWeatherBlend(fromPreset, toPreset, blend);
  }

  private applyWeatherBlend(a: WeatherPreset, b: WeatherPreset, t: number) {
    const isIsland = this.mapId === 'island';
    const isIslandDay = isIsland && this.settings.timeOfDay === 'daylight';
    const islandZenith = new THREE.Color(0x165ec2);
    const islandMidSky = new THREE.Color(0x4ba1eb);
    const islandHorizon = new THREE.Color(0xcde8fb);
    const islandHaze = new THREE.Color(0xa6cfe9);
    const islandFog = new THREE.Color(0xb2d8f2);

    // 1. Sky Dome Shader uniforms
    const u = this.skyMat.uniforms;
    if (isIslandDay) {
      (u.uZenithColor.value as THREE.Color).copy(islandZenith);
      (u.uMidSkyColor.value as THREE.Color).copy(islandMidSky);
      (u.uHorizonColor.value as THREE.Color).copy(islandHorizon);
      (u.uGroundHazeColor.value as THREE.Color).copy(islandHaze);
      (u.uSunColor.value as THREE.Color).setHex(0xfff7e2);
      u.uCloudCover.value = 0.36;
      u.uSunStrength.value = 0.96;
    } else {
      (u.uZenithColor.value as THREE.Color).lerpColors(a.zenith, b.zenith, t);
      (u.uMidSkyColor.value as THREE.Color).lerpColors(a.midSky, b.midSky, t);
      if (isIsland) {
        (u.uHorizonColor.value as THREE.Color).lerpColors(a.horizon, b.horizon, t).lerp(islandHorizon, 0.72);
        (u.uGroundHazeColor.value as THREE.Color).lerpColors(a.groundHaze, b.groundHaze, t).lerp(islandHaze, 0.72);
      } else {
        (u.uHorizonColor.value as THREE.Color).lerpColors(a.horizon, b.horizon, t);
        (u.uGroundHazeColor.value as THREE.Color).lerpColors(a.groundHaze, b.groundHaze, t);
      }
      (u.uSunColor.value as THREE.Color).lerpColors(a.sunDiscColor, b.sunDiscColor, t);
      u.uCloudCover.value = THREE.MathUtils.lerp(a.cloudCover, b.cloudCover, t);
      u.uSunStrength.value = THREE.MathUtils.lerp(a.sunStrength, b.sunStrength, t);
    }

    // 2. Scene Background & Exponential Fog (lighter crisp azure atmospheric depth on 10 km² island)
    this.sceneBgColor.lerpColors(a.fogColor, b.fogColor, t);
    if (isIsland) {
      this.sceneBgColor.copy(islandFog);
    }
    this.sceneFog.color.copy(this.sceneBgColor);
    const baseFog = THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t);
    this.sceneFog.density = isIsland ? baseFog * 0.042 : baseFog;

    // 3. Directional Sun, Hemisphere Fill, Sky Rim & Practical Interior Glow
    this.sunLight.color.lerpColors(a.sunLightColor, b.sunLightColor, t);
    if (isIslandDay) this.sunLight.color.setHex(0xfff3db);
    this.sunLight.intensity = isIslandDay
      ? 1.84
      : THREE.MathUtils.lerp(a.sunLightIntensity, b.sunLightIntensity, t) * (isIsland ? 1.15 : 1.0);

    this.hemiLight.color.lerpColors(a.hemiSkyColor, b.hemiSkyColor, t);
    this.hemiLight.groundColor.lerpColors(a.hemiGroundColor, b.hemiGroundColor, t);
    if (isIsland) {
      if (isIslandDay) this.hemiLight.color.setHex(0x9bd0ff);
      this.hemiLight.groundColor.lerp(new THREE.Color(0x5d7e42), 0.78);
    }
    this.hemiLight.intensity = isIslandDay
      ? 1.16
      : THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t) * (isIsland ? 1.48 : 1.0);

    this.rimLight.color.lerpColors(a.rimColor, b.rimColor, t);
    this.rimLight.intensity = THREE.MathUtils.lerp(a.rimIntensity, b.rimIntensity, t);

    this.saloonGlow.intensity = THREE.MathUtils.lerp(a.saloonIntensity, b.saloonIntensity, t);
    this.forgeGlow.intensity = THREE.MathUtils.lerp(a.forgeIntensity, b.forgeIntensity, t);

    // 4. Sun Corona Sprite
    this.sunCoronaMat.color.lerpColors(a.coronaColor, b.coronaColor, t);
    this.sunCoronaMat.opacity = THREE.MathUtils.lerp(a.coronaOpacity, b.coronaOpacity, t);
    const coronaScale = THREE.MathUtils.lerp(a.coronaScale, b.coronaScale, t);
    this.skySystem.sunCoronaSprite.scale.set(coronaScale, coronaScale, 1);

    // 5. Atmospheric Dust Motes & Drifting Mist/Dust Wisps
    this.dustMotesMat.color.lerpColors(a.moteColor, b.moteColor, t);
    this.dustMotesMat.opacity = THREE.MathUtils.lerp(a.moteOpacity, b.moteOpacity, t);
    this.dustWispsMat.color.lerpColors(a.wispColor, b.wispColor, t);
    this.dustWispsMat.opacity = THREE.MathUtils.lerp(a.wispOpacity, b.wispOpacity, t);
    this.dustWispsMat.size = THREE.MathUtils.lerp(a.wispSize, b.wispSize, t);

    // 6. Sunlit Bloom & Tone Mapping Exposure + IBL Reflection Intensity + Ambient Wind Coupling
    applyRendererToneMapping(
      this.renderer,
      isIslandDay ? 0.99 : THREE.MathUtils.lerp(a.exposure, b.exposure, t),
    );
    this.scene.environmentIntensity = isIslandDay
      ? 0.44
      : THREE.MathUtils.lerp(a.envIntensity, b.envIntensity, t);
    this.currentWeatherWind = THREE.MathUtils.lerp(a.windIntensity, b.windIntensity, t);

    // Mirror world weather lighting onto the depth-isolated viewmodel overlay scene
    this.lightingRig.syncWeaponLights(this.scene.environmentIntensity, this.weaponScene);
  }

  private updateDamageNumbers(dt: number) {
    const drag = Math.exp(-3.4 * dt);
    for (let i = 0; i < this.damageNumbers.length; i++) {
      const dn = this.damageNumbers[i];
      if (!dn.active) continue;

      dn.life -= dt;
      if (dn.life <= 0) {
        dn.active = false;
        dn.sprite.visible = false;
        continue;
      }

      dn.vel.y -= 3.1 * dt;
      dn.vel.x *= drag;
      dn.vel.z *= drag;
      dn.pos.addScaledVector(dn.vel, dt);
      dn.sprite.position.copy(dn.pos);

      const p = 1 - dn.life / dn.maxLife;
      // Snappy pop-in overshoot -> settle -> subtle shrink out
      let popScale = 1.0;
      if (p < 0.14) {
        const k = p / 0.14;
        popScale = THREE.MathUtils.lerp(0.55, 1.24, 1 - (1 - k) * (1 - k));
      } else if (p < 0.3) {
        const k = (p - 0.14) / 0.16;
        popScale = THREE.MathUtils.lerp(1.24, 1.0, k);
      } else if (p > 0.65) {
        const k = (p - 0.65) / 0.35;
        popScale = THREE.MathUtils.lerp(1.0, 0.84, k);
      }

      const dist = this.camera.position.distanceTo(dn.pos);
      const distScale = THREE.MathUtils.clamp(0.42 + dist * 0.044, 0.55, 2.35);
      const spriteH = dn.baseScale * popScale * distScale;
      dn.sprite.scale.set(spriteH * 2.0, spriteH, 1);

      dn.mat.opacity = p > 0.58 ? THREE.MathUtils.clamp(1 - (p - 0.58) / 0.42, 0, 1) : 1;
    }
  }

  // =========================================================================
  // RENDER PASS (DELEGATED TO FIXED-TIMESTEP GameLoop)
  // =========================================================================
  private renderWorldFrame(frameDt: number, rawMs: number) {
    if (this.disposed) return;

    const now = performance.now();
    const foreground = document.visibilityState === 'visible';
    if (!this.isSoftwareGl && this.settings.dynamicResolution && this.phase === 'playing' && foreground) {
      const ratio = this.renderQuality.sample(Math.max(this.renderWorkMs, this.gpuTimer.milliseconds), rawMs);
      if (ratio !== null) {
        this.renderer.setPixelRatio(ratio);
        this.handleResize();
      }
    }

    if (this.phase === 'playing' && foreground) this.frameMetrics.sample(rawMs);

    if (this.phase === 'playing') {
      this.occlusion.update(this.camera, this.playerPos, this.enemies, this.pickups, this.impactDecals);
    }
    this.staticBatches.updateVisibility();

    this.audio.updateAmbient(
      frameDt,
      this.playerPos,
      this.isPlayerIndoors(),
      this.currentWeatherWind,
      this.phase === 'playing',
    );

    this.renderer.info.reset();
    this.gpuTimer.begin();
    this.skySystem.syncToCamera(this.camera, this.mapId === 'island', this.skyElapsed, this.renderer, frameDt);
    this.renderer.render(this.scene, this.camera);
    if (this.weaponRig.root.visible) {
      this.weaponCamera.position.copy(this.camera.position);
      this.weaponCamera.quaternion.copy(this.camera.quaternion);
      if (this.weaponCamera.fov !== this.camera.fov) {
        this.weaponCamera.fov = this.camera.fov;
        this.weaponCamera.updateProjectionMatrix();
      }
      this.weaponCamera.updateMatrixWorld(true);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, this.weaponCamera);
      this.renderer.autoClear = true;
    }
    this.gpuTimer.end();

    this.hudEmitAccum += frameDt;
    if (this.hudEmitAccum >= 0.033) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
    this.renderWorkMs = performance.now() - now;
  }

  private emitHud(force: boolean) {
    if (!force && this.phase === 'title') return;
    const spec = WEAPON_SPECS[this.weaponId];
    const remaining = this.spawnQueue.length + this.countAliveEnemies();
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const adsActive = this.isAdsActive();
    const slidingNow = this.slideTimer > 0;
    const dashingNow = this.dashTimer > 0;
    const moveSpeedRatio = THREE.MathUtils.clamp(horizSpeed / 10.6, 0, 1);
    const movementState = resolveMovementState({
      grounded: this.grounded,
      dashing: dashingNow,
      sliding: slidingNow,
      sprinting: this.sprinting,
      crouching: this.crouching || this.prone,
      horizontalSpeed: horizSpeed,
    });
    const recoilIntensity = computeRecoilIntensity({
      dynamicSpread: this.dynamicSpread,
      gunShakeTrauma: this.gunShakeTrauma,
      gunKickPitch: this.gunKickPitch,
    });
    const crosshairMetrics = computeDynamicCrosshair({
      weaponId: this.weaponId,
      movementState,
      moveSpeedRatio,
      recoilIntensity,
      ads: adsActive,
      scopeAlpha: this.scopeAlpha,
      reloading: this.reloading,
    });
    const spreadPx = crosshairMetrics.gapPx;
    const rawDeg = ((-this.yaw * 180) / Math.PI) % 360;
    const headingDeg = Math.round((rawDeg + 360) % 360) % 360;

    const isBr = this.mapId === 'island';
    const nearestPoi = isBr
      ? `${findNearestIslandPoi(this.playerPos.x, this.playerPos.z).name} · ${worldToGridSector(this.playerPos.x, this.playerPos.z, ISLAND_HALF_SIZE)}`
      : 'WEST TOWN';
    const localTerrainY = isBr ? Math.max(0, sampleIslandHeight(this.playerPos.x, this.playerPos.z)) : 0;
    const altitudeMeters = isBr ? Math.max(0, Math.round(this.playerPos.y - localTerrainY)) : 0;
    const airspeedKmh = isBr
      ? this.brStage === 'airdrop_plane'
        ? Math.round(this.deployment.planeSpeed * 3.6)
        : Math.round(this.playerVel.length() * 3.6)
      : Math.round(horizSpeed * 3.6);
    const outsideStorm =
      isBr &&
      this.brStage === 'grounded' &&
      this.storm.isOutsideSafeZone(this.playerPos.x, this.playerPos.z);

    const closestLoot = isBr && this.brStage === 'grounded' && !this.spectatorActive
      ? this.lootManager.findClosestInteractable(this.playerPos, 3.0)
      : null;

    const aliveEnemies = isBr ? this.enemies.filter((e) => e.alive) : [];
    const spectatorTarget = this.spectatorActive && aliveEnemies.length > 0
      ? aliveEnemies[this.spectatorIdx % aliveEnemies.length]
      : null;
    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;

    this.onHudUpdate({
      phase: this.phase,
      lifecycleState: this.lifecycle.state,
      difficulty: this.difficulty,
      mapId: this.mapId,
      battleRoyale: isBr
        ? {
            active: true,
            stage: this.brStage,
            canJumpFromPlane: this.deployment.canJump(),
            altitudeMeters,
            airspeedKmh,
            aliveCount: this.brAliveCount,
            totalCombatants: this.brTotalCombatants,
            remainingPassengers: this.deployment.getRemainingPassengers(this.brStage === 'airdrop_plane'),
            deploymentCountdownSec: Math.ceil(this.deployment.countdownSec),
            stormPhase: this.storm.phase,
            stormTimerSec: Math.max(0, Math.ceil(this.storm.timerSec)),
            stormClosing: this.storm.closing,
            stormShrinking: this.storm.closing,
            stormCenterX: this.storm.centerX,
            stormCenterZ: this.storm.centerZ,
            stormRadius: this.storm.radius,
            stormTargetX: this.storm.targetX,
            stormTargetZ: this.storm.targetZ,
            stormTargetRadius: this.storm.targetRadius,
            outsideStorm,
            distanceToSafeZoneMeters: this.storm.distanceToSafeZone(this.playerPos.x, this.playerPos.z),
            nearestPoi,
          }
        : undefined,
      spectator: spectatorTarget
        ? {
            active: true,
            targetName: spectatorTarget.displayName,
            targetHealth: Math.max(0, Math.ceil(spectatorTarget.hp)),
            targetShield: Math.max(0, Math.floor(spectatorTarget.armor ?? 0)),
            targetKills: 0,
            targetWeapon: spectatorTarget.kind === 'sentinel' ? 'marksman' : 'carbine',
            canSwitch: aliveEnemies.length > 1,
          }
        : undefined,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      healthRegenActive: this.healthRegenActive,
      outOfCombatSec: this.outOfCombatSec,
      tacticalMapOpen: this.tacticalMapOpen,
      inventoryOpen: this.inventoryOpen,
      shield: Math.floor(this.shield),
      maxShield: this.maxShield,
      armorPlates: this.inventory.armorPlates,
      medkits: this.inventory.medkits,
      nearbyLoot: this.lootManager.toPromptHud(closestLoot, this.settings.controls.interact),
      score: this.score,
      placement: isBr ? (this.placement || this.brAliveCount) : undefined,
      damageDealt: Math.round(this.damageDealt),
      survivalTimeSec: Math.round(this.survivalTimeSec),
      wave: this.wave,
      maxWaves: MAX_WAVES,
      endless: this.endless,
      enemiesRemaining: isBr ? Math.max(0, this.brAliveCount - 1) : remaining,
      weaponId: this.weaponId,
      inventory: inventoryWeapons(this.loadout).map((id) => ({ id, ammo: this.ammoMap[id], reserve: this.reserveMap[id] })),
      grenade: this.loadout.grenade,
      grenadesRemaining: this.grenadesRemaining,
      ammo: this.ammoMap[this.weaponId],
      magSize: spec.magSize,
      reserve: this.reserveMap[this.weaponId],
      carbineAmmo: this.ammoMap.carbine,
      carbineReserve: this.reserveMap.carbine,
      sniperAmmo: this.ammoMap.railpistol,
      sniperReserve: this.reserveMap.railpistol,
      reloading: this.reloading,
      reloadProgress: this.reloading
        ? THREE.MathUtils.clamp(1 - Math.max(0, this.reloadTimer) / this.reloadDuration, 0, 1)
        : 0,
      reloadEmpty: this.reloading && this.reloadIsEmpty,
      inspecting: this.inspectingActive,
      ads: adsActive,
      scopeAlpha: this.scopeAlpha,
      scopeZoom: this.weaponId === 'marksman' ? (this.scopeZoomLevel === 10 ? 6 : 3) : this.scopeZoomLevel,
      scopeSwayX: this.scopeSwayX,
      scopeSwayY: this.scopeSwayY,
      breathSteady: this.breathSteady,
      crouching: this.crouching,
      prone: this.prone,
      swimming: this.swimming,
      underwater: this.underwater,
      sprinting: this.sprinting,
      grounded: this.grounded,
      sliding: slidingNow,
      movementState,
      moveSpeedRatio,
      recoilIntensity,
      matchTimeSec: this.matchTimeSec,
      headingDeg,
      killFeed: this.killFeed.map(({ id, killer, victim, weapon, headshot }) => ({
        id,
        killer,
        victim,
        weapon,
        headshot,
      })),
      crosshairSpread: spreadPx,
      pointerLocked: this.pointerLocked,
      hitMarker: {
        active: this.hitMarkerTimer > 0,
        crit: this.hitMarkerCrit,
        kill: this.hitMarkerKill,
        armor: this.hitMarkerArmor,
        armorBreak: this.hitMarkerArmorBreak,
        seq: this.hitMarkerSeq,
        intensity: this.hitMarkerTimer > 0 ? Math.min(1, this.hitMarkerTimer / this.hitMarkerDuration) : 0,
      },
      damagePops: this.crosshairDamagePops.map((pop) => ({ ...pop })),
      damageArc: {
        active: this.damageArcTimer > 0,
        angleRad: this.damageArcAngle,
        intensity: Math.min(1, this.damageArcTimer / 0.75),
      },
      damageFlash: this.damageFlash,
      screenShakeX: this.hudShakeX,
      screenShakeY: this.hudShakeY,
      screenShakeRot: this.hudShakeRot,
      waveBanner: this.waveBanner,
      pickupNotice: this.pickupNotice,
      eliminations: this.eliminations,
      headshots: this.headshots,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      bestScore: this.bestScore,
      muted: this.settings.muted,
      dashCooldown: this.dashCooldown,
      dashCooldownMax: this.dashCooldownMax,
      dashing: this.dashTimer > 0,
      gpuPostFx: false,
      performance: {
        fps: this.frameMetrics.fps,
        averageFps: this.frameMetrics.averageFps,
        peakFps: this.frameMetrics.peakFps,
        frameMs: this.frameMetrics.frameMs,
        worstFrameMs: this.frameMetrics.worstFrameMs,
        drawCalls: this.renderer.info.render.calls,
        resolutionScale: this.renderer.getPixelRatio() / this.nativePixelRatio,
        cpuMs: this.renderWorkMs,
        gpuMs: this.gpuTimer.milliseconds,
        gpuName: nativeBridge.isNativeWinUI ? nativeBridge.getGpuInfo().adapterName : this.gpuName,
        triangles: this.renderer.info.render.triangles,
        activeChunks: this.islandArena?.terrainStreamer.activeVisibleChunks ?? 0,
        texturesCount: this.renderer.info.memory.textures,
        geometriesCount: this.renderer.info.memory.geometries,
        jsHeapMb: typeof perfMemory === 'number' ? Math.round(perfMemory / (1024 * 1024)) : undefined,
      },
      radar: {
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerYaw: this.yaw,
        range: isBr ? (this.brStage === 'grounded' ? 240 : 1450) : 40,
        enemies: isBr
          ? this.enemies
              .filter((e) => e.alive && e.isWindingUp)
              .map((e) => ({
                id: e.id,
                x: e.root.position.x,
                z: e.root.position.z,
                kind: e.kind,
                elevated: e.root.position.y > localTerrainY + 2.2,
                firing: e.isWindingUp,
              }))
          : this.enemies
              .filter((e) => e.alive)
              .map((e) => ({
                id: e.id,
                x: e.root.position.x,
                z: e.root.position.z,
                kind: e.kind,
                elevated: e.root.position.y > localTerrainY + 2.2,
                firing: e.isWindingUp,
              })),
        pickups: this.pickups
          .filter((pk) => pk.active)
          .map((pk) => ({
            x: pk.pos.x,
            z: pk.pos.z,
            kind: pk.kind,
          })),
        buildings: this.arena.buildingFootprints,
        pois: isBr ? ISLAND_POIS.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, theme: p.theme })) : undefined,
        islandRadius: isBr ? ISLAND_HALF_SIZE : undefined,
        coastlinePolygon: isBr ? this.coastlinePolygon : undefined,
        islandPolygons: isBr ? this.islandPolygons : undefined,
        riverPolyline: isBr ? this.riverPolyline : undefined,
        waypoint: this.waypoint,
        stormCircle: isBr
          ? {
              cx: this.storm.centerX,
              cz: this.storm.centerZ,
              r: this.storm.radius,
              targetCx: this.storm.targetX,
              targetCz: this.storm.targetZ,
              targetR: this.brStage === 'grounded' ? this.storm.targetRadius : 0,
            }
          : undefined,
        planePath: isBr
          ? {
              x0: this.deployment.planeStart.x,
              z0: this.deployment.planeStart.z,
              x1: this.deployment.planeEnd.x,
              z1: this.deployment.planeEnd.z,
              planeX: this.deployment.planePos.x,
              planeZ: this.deployment.planePos.z,
              active: this.deployment.planeProgress < 1.05,
            }
          : undefined,
        players: this.remotePlayers
          ? this.remotePlayers.getPlayerPositions().map((p) => ({
              id: p.id,
              x: p.x,
              z: p.z,
              color: PLAYER_COLORS[p.color]?.css ?? '#06b6d4',
              isTeammate: this.multiplayerConfig?.mode === 'coop',
              name: p.name,
            }))
          : [],
      },
      multiplayer:
        this.multiplayerConfig && this.networkManager
          ? {
              active: true,
              mode: this.multiplayerConfig.mode,
              roomCode: this.multiplayerConfig.roomCode,
              isHost: this.multiplayerConfig.isHost,
              ping: this.networkManager.getLocalPlayer()?.ping ?? 0,
              players: this.networkManager.players.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                kills: p.id === this.networkManager!.localPlayerId ? this.eliminations : p.kills,
                deaths: p.deaths,
                score: p.id === this.networkManager!.localPlayerId ? this.score : p.score,
                ping: p.ping,
                health: p.id === this.networkManager!.localPlayerId ? Math.ceil(this.health) : p.health,
                maxHealth: p.maxHealth,
                shield: p.id === this.networkManager!.localPlayerId ? Math.floor(this.shield) : p.shield,
                maxShield: p.maxShield,
                alive: p.id === this.networkManager!.localPlayerId ? this.health > 0 : p.alive,
                weaponId: p.equippedWeapon,
              })),
              respawnTimer: this.respawnTimer > 0 ? this.respawnTimer : undefined,
              matchTimeRemaining: this.matchTimeRemaining > 0 ? this.matchTimeRemaining : undefined,
              killLimit: this.multiplayerConfig.killLimit,
            }
          : undefined,
    });
  }

  public dispose() {
    this.disposed = true;
    this.gameLoop.dispose();
    this.input.dispose();
    if (this.remotePlayers) {
      this.remotePlayers.dispose();
      this.remotePlayers = null;
    }

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleWebGLContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleWebGLContextRestored);

    this.resizeObserver?.disconnect();
    this.clearEnemies();
    this.lootManager.dispose();
    this.staticBatches.dispose();
    if (this.brPlayerRig) {
      const disposedGeos = new Set<THREE.BufferGeometry>();
      const disposedMats = new Set<THREE.Material>();
      this.scene.remove(this.brPlayerRig.root);
      this.brPlayerRig.root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry && !disposedGeos.has(obj.geometry)) {
            disposedGeos.add(obj.geometry);
            obj.geometry.dispose();
          }
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (mat && !disposedMats.has(mat)) {
              disposedMats.add(mat);
              mat.dispose();
            }
          }
        }
      });
      this.brPlayerRig = null;
    }
    this.arena.dispose();
    for (const item of [...this.ordnance, ...this.zones]) this.disposeOrdnanceMesh(item.mesh);
    this.weaponRig.dispose();
    this.enemyFactory.dispose();
    this.assetManager.dispose();
    this.lightingRig.dispose();
    this.skySystem.dispose();
    this.poolGeos.forEach((g) => g.dispose());
    this.poolMats.forEach((m) => m.dispose());
    this.damageNumbers.forEach((dn) => {
      dn.tex.dispose();
      dn.mat.dispose();
    });
    this.impactDust.forEach((dp) => {
      dp.mat.dispose();
    });
    this.audio.dispose();
    this.gpuTimer.dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
