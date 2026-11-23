import { DEFAULT_LOADOUT, inventoryWeapons, normalizeLoadout, GRENADES } from './loadout';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AdaptiveRenderQuality } from './renderQuality';
import { FrameMetrics, GpuFrameTimer } from './frameMetrics';
import { StaticSceneBatches } from './staticBatches';
import { CachedSky } from './cachedSky';
import { DEFAULT_GAME_SETTINGS } from './graphicsSettings';
import { ArenaData, buildWestTownArena } from './arena';
import { FootstepSurface, TacticalAudio } from './audio';
import { EnemyEntity, EnemyFactory, EnemyKind } from './enemies';
import { OcclusionCullingSystem } from './occlusion';
import { DynamicCapsuleBody, PhysicsRaycastHit, PhysicsWorld } from './physics';
import { computeDynamicCrosshair, computeRecoilIntensity, resolveMovementState } from './crosshair';
import { createProceduralTextures, ProceduralTextures } from './textures';
import {
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
} from './types';
import { NetworkManager } from './multiplayer/networkManager';
import { RemotePlayerManager } from './multiplayer/remotePlayerRigs';
import { NetworkMessage, PLAYER_COLORS } from './multiplayer/types';
import { FirstPersonWeaponRig } from './weapon';

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

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const SUN_DIRECTION = new THREE.Vector3(68, 34, 42).normalize();

const SkyDomeShader = {
  uniforms: {
    uZenithColor: { value: new THREE.Color(0x1a4d8f) },
    uMidSkyColor: { value: new THREE.Color(0x5b92c7) },
    uHorizonColor: { value: new THREE.Color(0xe6c392) },
    uGroundHazeColor: { value: new THREE.Color(0xc89a67) },
    uSunColor: { value: new THREE.Color(0xfff4d4) },
    uSunDir: { value: SUN_DIRECTION.clone() },
    uCloudCover: { value: 0.36 },
    uSunStrength: { value: 1.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vWorldDir;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldDir = normalize(position);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uZenithColor;
    uniform vec3 uMidSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uGroundHazeColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uCloudCover;
    uniform float uSunStrength;
    uniform float uTime;
    varying vec3 vWorldDir;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbmClouds(vec2 p) {
      float v = 0.0;
      float amp = 0.52;
      for (int i = 0; i < 4; i++) {
        v += amp * noise2(p);
        p = p * 2.08 + vec2(13.7, 7.3);
        amp *= 0.48;
      }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldDir);
      float h = clamp(dir.y, 0.0, 1.0);

      // Multi-band Rayleigh desert atmosphere
      vec3 lowerSky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, h));
      vec3 sky = mix(lowerSky, uZenithColor, pow(h, 0.72));

      // Horizon mist / dust belt below eye level
      float below = clamp(-dir.y * 5.0, 0.0, 1.0);
      sky = mix(sky, uGroundHazeColor, below * 0.88);

      // Sun directional Mie scattering & natural solar disc (glare-free golden-hour sun)
      float sunAmt = max(dot(dir, uSunDir), 0.0);
      float horizonScatter = (1.0 - smoothstep(0.0, 0.42, h)) * pow(sunAmt, 4.5);
      sky += vec3(1.0, 0.76, 0.46) * horizonScatter * 0.09 * uSunStrength;
      sky += uSunColor * pow(sunAmt, 18.0) * 0.09 * uSunStrength;
      sky += uSunColor * pow(sunAmt, 110.0) * 0.2 * uSunStrength;
      float sunDisc = smoothstep(0.9991, 0.99975, sunAmt);
      sky += vec3(1.04, 0.94, 0.78) * sunDisc * uSunStrength;

      // Dynamic procedural cloud deck (sparse cirrus when sunny -> thick overcast stratus deck)
      if (dir.y > 0.015) {
        vec2 cloudUv = dir.xz / (dir.y + 0.22);
        cloudUv.x *= 0.68;
        cloudUv += vec2(uTime * 0.0085, uTime * 0.0032);
        float c1 = fbmClouds(cloudUv * 1.45);
        float c2 = fbmClouds(cloudUv * 3.1 - vec2(uTime * 0.005, 0.0));
        float cloudNoise = c1 * 0.72 + c2 * 0.28;

        float lowEdge = mix(0.56, 0.24, uCloudCover);
        float highEdge = mix(0.86, 0.64, uCloudCover);
        float cloudDensity = smoothstep(lowEdge, highEdge, cloudNoise);
        float horizonFade = smoothstep(0.02, 0.22, dir.y) * (1.0 - smoothstep(0.76, 0.99, dir.y) * 0.28);
        cloudDensity *= horizonFade * mix(0.48, 0.92, uCloudCover);

        vec3 sunnyLit = mix(vec3(0.96, 0.89, 0.80), vec3(1.0, 0.93, 0.75), pow(sunAmt, 2.5));
        vec3 overcastLit = vec3(0.75, 0.78, 0.82);
        vec3 cloudLit = mix(overcastLit, sunnyLit, uSunStrength);

        vec3 sunnyShadow = vec3(0.67, 0.68, 0.75);
        vec3 overcastShadow = vec3(0.45, 0.49, 0.55);
        vec3 cloudShadow = mix(overcastShadow, sunnyShadow, uSunStrength);

        float litFactor = clamp(0.36 + c2 * 0.42 + sunAmt * 0.45 * uSunStrength, 0.0, 1.0);
        vec3 cloudCol = mix(cloudShadow, cloudLit, litFactor);
        sky = mix(sky, cloudCol, cloudDensity);
      }

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export class OutpostGameEngine {
  private readonly container: HTMLElement;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private readonly onContextLost: (lost: boolean) => void;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private renderQuality: AdaptiveRenderQuality;
  private readonly nativePixelRatio: number;
  private readonly gpuTimer: GpuFrameTimer;
  private readonly staticBatches: StaticSceneBatches;
  private readonly cachedSky: CachedSky;
  private readonly frameMetrics = new FrameMetrics();
  private renderWorkMs = 5;
  private readonly gpuName: string;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly weaponScene: THREE.Scene;
  private readonly weaponCamera: THREE.PerspectiveCamera;
  private readonly weaponHemiLight: THREE.HemisphereLight;
  private readonly weaponSunLight: THREE.DirectionalLight;
  private readonly weaponRimLight: THREE.DirectionalLight;
  private readonly envTarget: THREE.WebGLRenderTarget;
  private readonly textures: ProceduralTextures;
  private readonly arena: ArenaData;
  private readonly physics: PhysicsWorld;
  private readonly occlusion: OcclusionCullingSystem;
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
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly sceneBgColor: THREE.Color;
  private readonly sceneFog: THREE.FogExp2;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly saloonGlow: THREE.PointLight;
  private readonly forgeGlow: THREE.PointLight;
  private readonly sunCoronaSprite: THREE.Sprite;
  private readonly sunCoronaMat: THREE.SpriteMaterial;
  private readonly impactLight: THREE.PointLight;
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
  private stepTimer = 0;
  private health = 100;
  private readonly maxHealth = 100;
  private shield = 50;
  private readonly maxShield = 50;
  private timeSinceDamaged = 10;
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
  private adsHeld = false;
  private fireHeld = false;
  private fireJustPressed = false;
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

  // Mobile Touch Controls state (only used by mobile touch HUD)
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprintLock = false;
  private touchAdsActive = false;
  private touchFireHeld = false;

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
  private hitMarkerSeq = 0;
  private damageArcTimer = 0;
  private damageArcAngle = 0;

  // Input & Settings
  private readonly heldKeys = new Set<string>();
  private pointerLocked = false;
  private draggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_GAME_SETTINGS.controls } };

  // Loop & lifecycle
  private frameId = 0;
  private lastFrameMs = 0;
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

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.info.autoReset = false;
    this.nativePixelRatio = this.isSoftwareGl ? 0.5 : Math.min(window.devicePixelRatio || 1, 2);
    const pixelRatio = this.nativePixelRatio * this.settings.resolutionScale;
    this.renderQuality = new AdaptiveRenderQuality(pixelRatio, this.settings.targetFps, this.nativePixelRatio * 0.7);
    this.gpuTimer = new GpuFrameTimer(this.renderer.getContext() as WebGL2RenderingContext);
    const gl = this.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpuName = rendererInfo ? String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)) : 'WebGL GPU';
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // Scene & sunlit Western desert sky dome + dynamic weather horizon fog
    this.scene = new THREE.Scene();
    this.sceneBgColor = new THREE.Color(0xdec096);
    this.scene.background = this.sceneBgColor;
    this.sceneFog = new THREE.FogExp2(0xdec096, 0.0044);
    this.scene.fog = this.sceneFog;

    const skyGeo = new THREE.SphereGeometry(290, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SkyDomeShader.uniforms),
      vertexShader: SkyDomeShader.vertexShader,
      fragmentShader: SkyDomeShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyMat = skyMat;
    this.poolGeos.push(skyGeo);
    this.poolMats.push(skyMat);
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.cachedSky = new CachedSky(skyDome, this.scene);
    this.cachedSky.update(this.renderer, 1);

    // Mandatory RoomEnvironment IBL on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    // Camera (0.06m near plane prevents wall near-plane slicing while preserving crisp 24-bit depth precision)
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.06, 340);
    this.scene.add(this.camera);
    this.audio.attachSpatialAmbient(this.scene, this.camera);

    // Dedicated depth-cleared viewmodel overlay scene & camera so first-person weapons NEVER clip through walls
    this.weaponScene = new THREE.Scene();
    this.weaponScene.environment = this.envTarget.texture;
    this.weaponScene.environmentIntensity = 0.42;
    this.weaponCamera = new THREE.PerspectiveCamera(75, width / height, 0.02, 12);
    this.weaponScene.add(this.weaponCamera);
    this.weaponHemiLight = new THREE.HemisphereLight(0x74a8dc, 0x6b4a2b, 0.48);
    this.weaponHemiLight.position.set(0, 70, 0);
    this.weaponScene.add(this.weaponHemiLight);
    this.weaponSunLight = new THREE.DirectionalLight(0xffdba2, 1.38);
    this.weaponSunLight.position.set(68, 34, 42);
    this.weaponScene.add(this.weaponSunLight);
    this.weaponRimLight = new THREE.DirectionalLight(0x6c9fd4, 0.22);
    this.weaponRimLight.position.set(-48, 22, -40);
    this.weaponScene.add(this.weaponRimLight);

    // Cinematic Western Golden-Hour Raking Sun + Sky/Sand Bounce Fill + Cool Sky Rim
    this.hemiLight = new THREE.HemisphereLight(0x74a8dc, 0x6b4a2b, 0.48);
    this.hemiLight.position.set(0, 70, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffdba2, 1.38);
    this.sunLight.position.set(68, 34, 42);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.radius = 2.6;
    this.sunLight.shadow.camera.near = 15;
    this.sunLight.shadow.camera.far = 190;
    const shadowBound = 64;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.00015;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x6c9fd4, 0.22);
    this.rimLight.position.set(-48, 22, -40);
    this.scene.add(this.rimLight);

    // Subtle warm interior practical lights (Saloon lantern glow & Blacksmith forge embers)
    this.saloonGlow = new THREE.PointLight(0xffb45c, 3.0, 16, 2);
    this.saloonGlow.position.set(-24, 3.1, -12);
    this.scene.add(this.saloonGlow);

    this.forgeGlow = new THREE.PointLight(0xff6b26, 4.0, 13, 2);
    this.forgeGlow.position.set(35.2, 2.2, 17.8);
    this.scene.add(this.forgeGlow);

    // Dynamic pooled bullet impact flash light (sparks & ricochets)
    this.impactLight = new THREE.PointLight(0xffbe6b, 0, 6.8, 2);
    this.scene.add(this.impactLight);

    // Procedural textures, Complete Enterable WEST Town Map, Physics Mesh World, Occlusion Culler, Weapon Rig
    this.textures = createProceduralTextures(Math.min(this.settings.textureFiltering, this.renderer.capabilities.getMaxAnisotropy()));
    this.arena = buildWestTownArena(this.textures);
    this.scene.add(this.arena.group);

    // Physics-Based Environment Mesh Collision World & Conservative 3D Wall Occlusion Culling System
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

    // Restrained warm sun corona aligned 1:1 with the directional sunlight
    this.sunCoronaMat = new THREE.SpriteMaterial({
      map: this.textures.sunCorona,
      color: 0xffdfa0,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.poolMats.push(this.sunCoronaMat);
    this.sunCoronaSprite = new THREE.Sprite(this.sunCoronaMat);
    this.sunCoronaSprite.scale.set(22, 22, 1);
    this.sunCoronaSprite.position.copy(SUN_DIRECTION).multiplyScalar(235);
    this.scene.add(this.sunCoronaSprite);

    this.weaponRig = new FirstPersonWeaponRig(this.textures);
    this.weaponCamera.add(this.weaponRig.root);
    this.weaponRig.root.visible = false;

    this.enemyFactory = new EnemyFactory(this.textures);

    // Initialize Pooled VFX (Tracers, Particles, Projectiles, Surface Decals, Dust Plumes, Pickups, Ambient Dust)
    this.particleMesh = this.initPools();
    this.initAmbientDesertDust();

    // Damage feedback is drawn by the HUD; world & viewmodel use clean depth-isolated passes.
    this.applyWeatherBlend(WEATHER_PRESETS.sunny, WEATHER_PRESETS.sunny, 0);
    this.cachedSky.update(this.renderer, 1);
    const enemyWarmup = this.enemyFactory.createWarmupGroup();
    this.scene.add(enemyWarmup);
    // Warm up both the main world scene and the viewmodel scene shaders before first interactive frame on hardware GPUs.
    if (!this.isSoftwareGl) {
      this.weaponRig.root.visible = true;
      this.renderer.compile(this.scene, this.camera);
      this.renderer.compile(this.weaponScene, this.weaponCamera);
      this.weaponRig.root.visible = false;
    }
    this.scene.remove(enemyWarmup);

    // Position camera down Main Street and render one initial world frame so the WebGL buffer is populated immediately
    this.camera.position.set(-15, 2.2, 1.4);
    this.camera.lookAt(12, 1.8, 1.4);
    this.staticBatches.updateVisibility();
    this.renderer.render(this.scene, this.camera);

    this.bindEvents();
    this.emitHud(true);

    this.lastFrameMs = performance.now();
    this.tick();
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
    for (const e of this.enemies) {
      this.scene.remove(e.root);
      this.enemyFactory.disposeEnemyMaterials(e);
    }
    this.enemies = [];
    this.spawnQueue = [];
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
            enemy.hp -= msg.amount;
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
    this.loadout = normalizeLoadout(config?.loadout ?? this.loadout);
    this.endless = false;
    this.resetCombatState();
    this.frameMetrics.reset();
    this.phase = 'playing';
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
    this.phase = 'playing';
    this.clearInputs();
    this.requestPointerLockSafe();
    this.emitHud(true);
  }

  public pauseMission() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.clearInputs();
    this.exitPointerLockSafe();
    this.emitHud(true);
  }

  public returnToTitle() {
    this.phase = 'title';
    this.clearInputs();
    this.exitPointerLockSafe();
    this.weaponRig.root.visible = false;
    this.clearEnemies();
    this.clearProjectilesAndPickups();
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

  private applyGraphicsSettings() {
    const ceiling = this.nativePixelRatio * this.settings.resolutionScale;
    const minimumScale = this.settings.graphicsPreset === 'quality'
      ? 0.8
      : this.settings.graphicsPreset === 'performance' ? 0.5 : 0.7;
    const floor = this.nativePixelRatio * Math.min(this.settings.resolutionScale, minimumScale);
    this.renderQuality = new AdaptiveRenderQuality(ceiling, this.settings.targetFps, floor);
    this.renderer.setPixelRatio(ceiling);

    const shadowsEnabled = !this.isSoftwareGl && this.settings.shadowQuality !== 'off';
    const shadowSize = this.settings.shadowQuality === 'high' ? 2048 : 1024;
    const sizeChanged = this.sunLight.shadow.mapSize.width !== shadowSize;
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.sunLight.castShadow = shadowsEnabled;
    if (sizeChanged) {
      this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = shadowsEnabled;

    const maxFiltering = Math.min(this.settings.textureFiltering, this.renderer.capabilities.getMaxAnisotropy());
    for (const value of Object.values(this.textures)) {
      if (value instanceof THREE.Texture && value.anisotropy !== maxFiltering) {
        value.anisotropy = maxFiltering;
        value.needsUpdate = true;
      }
    }
    this.handleResize();
    this.emitHud(true);
  }

  // Mobile Touch & HUD Action API
  public setTouchMove(x: number, y: number) {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
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

  private isAdsActive(): boolean {
    return (this.adsHeld || this.touchAdsActive) && !this.reloading && this.grenadeCooldown<=0.12;
  }

  public requestPointerLockSafe() {
    try {
      const canvas = this.renderer.domElement;
      if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        const res = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Fallback drag/keyboard look handles environments where pointer lock is blocked
    }
  }

  private exitPointerLockSafe() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
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
    for (const dp of this.impactDust) {
      dp.active = false;
      dp.life = 0;
      dp.sprite.visible = false;
    }
    this.impactLight.intensity = 0;
    this.impactLightTimer = 0;
  }

  private clearInputs() {
    this.heldKeys.clear();
    this.fireHeld = false;
    this.fireJustPressed = false;
    this.adsHeld = false;
    this.inspectHeld = false;
    this.inspectingActive = false;
    this.inspectCycleElapsed = 0;
    this.inspectCheckPlayedCycle = -1;
    this.touchFireHeld = false;
    this.touchAdsActive = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprintLock = false;
    this.draggingLook = false;
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
  // EVENT LISTENERS
  // =========================================================================
  private readonly handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (this.phase === 'playing') e.preventDefault();
    }

    if (e.code === 'KeyM') {
      this.settings.muted = !this.settings.muted;
      this.audio.setMuted(this.settings.muted);
      this.emitHud(true);
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        this.pauseMission();
      } else if (this.phase === 'paused' && e.code === 'KeyP') {
        this.resumeMission();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    this.heldKeys.add(e.code);

    if (e.code === 'Space' && !e.repeat) {
      if (this.slideTimer > 0) {
        // Slide-jump momentum boost!
        this.slideTimer = 0;
        this.crouching = false;
        this.jumpBufferTimer = 0.12;
      } else if (this.crouching) {
        this.crouching = false;
      } else {
        this.jumpBufferTimer = 0.12;
      }
    }
    if (e.code === this.settings.controls.crouch && !e.repeat) {
      if (!this.crouching && this.tryStartSlide()) {
        // Combat slide initiated!
      } else {
        this.crouching = !this.crouching;
        if (!this.crouching) this.slideTimer = 0;
        this.emitHud(true);
      }
    }
    if (e.code === this.settings.controls.dash && !e.repeat) {
      this.tryActivateDash();
    }
    if (e.code === this.settings.controls.inspect && !e.repeat) {
      this.audio.unlock();
      this.inspectHeld = true;
    }
    if (e.code === this.settings.controls.scopeZoom && !e.repeat && ['railpistol', 'marksman'].includes(this.weaponId) && this.isAdsActive()) {
      this.toggleScopeZoom();
    }
    if (e.code === this.settings.controls.reload && !e.repeat) {
      this.tryStartReload();
    }
    if (e.code === this.settings.controls.grenade && !e.repeat) this.throwGrenade();
    if (e.code === this.settings.controls.sidearm && !e.repeat) this.switchWeapon(this.loadout.sidearm);
    if (e.code === this.settings.controls.launcher && !e.repeat && this.loadout.launcher) this.switchWeapon(this.loadout.launcher);
    if (e.code === this.settings.controls.primary1 && !e.repeat) {
      this.switchWeapon(this.loadout.primary[0]);
    }
    if (e.code === this.settings.controls.primary2 && !e.repeat) {
      this.switchWeapon(this.loadout.primary[1]);
    }
  };

  private readonly handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
    if (e.code === this.settings.controls.inspect) {
      this.inspectHeld = false;
    }
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    // Scale mouse sensitivity smoothly with optical FOV so 6x/10x sniper scoping is razor-accurate
    const fovScale = THREE.MathUtils.clamp(this.camera.fov / 75, 0.13, 1.0);
    const sens = 0.0021 * this.settings.sensitivity * fovScale;

    if (this.pointerLocked) {
      const dx = THREE.MathUtils.clamp(e.movementX, -180, 180);
      const dy = THREE.MathUtils.clamp(e.movementY, -180, 180);
      this.yaw -= dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.42, 1.42);
      if (dy > 0 && this.recoilRecoveryPitch > 0) {
        this.recoilRecoveryPitch = Math.max(0, this.recoilRecoveryPitch - dy * sens);
      }
      this.lookDeltaX += dx;
      this.lookDeltaY += dy;
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.yaw -= dx * sens * 1.35;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens * 1.35, -1.42, 1.42);
      if (dy > 0 && this.recoilRecoveryPitch > 0) {
        this.recoilRecoveryPitch = Math.max(0, this.recoilRecoveryPitch - dy * sens * 1.35);
      }
      this.lookDeltaX += dx;
      this.lookDeltaY += dy;
    }
  };

  private readonly handleMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing') return;
    if (!this.pointerLocked && e.target !== this.renderer.domElement) return;

    this.audio.unlock();

    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
    }

    if (e.button === 0) {
      this.fireHeld = true;
      this.fireJustPressed = true;
      if (!this.pointerLocked) {
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    } else if (e.button === 2) {
      this.adsHeld = true;
      if (!this.pointerLocked) {
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    }
  };

  private readonly handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.fireHeld = false;
      this.draggingLook = false;
    } else if (e.button === 2) {
      this.adsHeld = false;
      this.draggingLook = false;
    }
  };

  private readonly handleWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing') return;
    if (Math.abs(e.deltaY) > 4) {
      if (['railpistol', 'marksman'].includes(this.weaponId) && this.isAdsActive()) {
        this.toggleScopeZoom();
        return;
      }
      const weapons = inventoryWeapons(this.loadout);
      const index = weapons.indexOf(this.weaponId);
      this.switchWeapon(weapons[(index + (e.deltaY > 0 ? 1 : weapons.length - 1)) % weapons.length]);
    }
  };

  private readonly handleContextMenu = (e: MouseEvent) => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private readonly handlePointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    const wasLocked = this.pointerLocked;
    this.pointerLocked = locked;
    // Automatically open Pause overlay when user presses Esc to unlock pointer
    if (wasLocked && !locked && this.phase === 'playing') {
      this.pauseMission();
    } else {
      this.emitHud(true);
    }
  };

  private readonly handleBlur = () => {
    this.clearInputs();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.clearInputs();
  };

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

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

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
    if (this.reloading) return;
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
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;

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
    if (this.phase !== 'playing' || this.grenadesRemaining <= 0 || this.grenadeCooldown > 0) return;
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
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const target = enemy.root.position.clone().add(new THREE.Vector3(0, enemy.kind === 'wasp' ? 0 : 0.9, 0));
      const distance = center.distanceTo(target);
      if (distance > radius) continue;
      if (this.physics.raycastSegment(center.x, center.y, center.z, target.x, target.y, target.z, this.projRayHit, 0.01)) continue;
      const dealt = Math.round(damage * (1 - 0.65 * distance / radius));
      enemy.hp -= dealt;
      enemy.hitFlashTimer = 0.12;
      enemy.flinchKick = 0.8;
      this.hitMarkerTimer = this.hitMarkerDuration = 0.25;
      this.hitMarkerCrit = false;
      this.hitMarkerKill = enemy.hp <= 0;
      this.hitMarkerSeq++;
      this.spawnDamageNumber(target, dealt, false, enemy.hp <= 0);
      if (enemy.hp <= 0) this.handleEnemyKilled(enemy, false, target, source);
    }
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
    if(this.grenadeCooldown>0.12) return;
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
        if (isHeadshot) this.headshots++;

        this.hitMarkerDuration = isHeadshot ? 0.24 : 0.2;
        this.hitMarkerTimer = this.hitMarkerDuration;
        this.hitMarkerCrit = isHeadshot;
        this.hitMarkerKill = false;
        this.hitMarkerSeq++;

        this.audio.playHitMarker(isHeadshot, false);
        this.spawnDamageNumber(hitEnemy.point, dmg, isHeadshot, false);
        this.triggerImpactLight(hitEnemy.point, isHeadshot ? 0xffd257 : 0xff7b36, 6.5, 0.065);
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
          enemy.hp -= dmg;
          enemy.hitFlashTimer = 0.095;
          enemy.flinchKick = Math.min(1, enemy.flinchKick + (isHeadshot ? 0.85 : 0.45));

          // Instant hit flash emissive boost
          for (const m of enemy.bodyMaterials) {
            m.emissive.setHex(isHeadshot ? 0xffc857 : 0xffffff);
            m.emissiveIntensity = isHeadshot ? 0.75 : 0.4;
          }

          const killed = enemy.hp <= 0;
          if (isHeadshot) this.headshots++;

          this.hitMarkerDuration = killed ? 0.3 : isHeadshot ? 0.24 : 0.2;
          this.hitMarkerTimer = this.hitMarkerDuration;
          this.hitMarkerCrit = isHeadshot;
          this.hitMarkerKill = killed;
          this.hitMarkerSeq++;

          this.audio.playHitMarker(isHeadshot, killed);
          this.spawnDamageNumber(hitEnemy.point, dmg, isHeadshot, killed);
          this.triggerImpactLight(
            hitEnemy.point,
            isHeadshot ? 0xffd257 : 0xff7b36,
            isHeadshot ? 9.5 : 5.5,
            0.065,
          );
          this.spawnParticleBurst(
            hitEnemy.point,
            isHeadshot ? 16 : 9,
            isHeadshot ? 0xffca42 : 0xff7b36,
            isHeadshot ? 7.5 : 5.2,
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
      _v3.set(enemy.root.position.x, 0.55, enemy.root.position.z);
      this.spawnPickup(dropKind, _v3);
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

  private spawnDamageNumber(point: THREE.Vector3, damage: number, isHeadshot: boolean, killed: boolean) {
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
    ctx.shadowColor = isHeadshot ? 'rgba(251, 191, 36, 0.7)' : killed ? 'rgba(239, 68, 68, 0.7)' : 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = isHeadshot || killed ? 12 : 6;
    ctx.shadowOffsetY = 3;

    ctx.lineWidth = Math.max(8, Math.round(fontPx * 0.16));
    ctx.strokeStyle = 'rgba(10, 12, 18, 0.94)';
    ctx.strokeText(label, w * 0.5, h * 0.54);

    const grad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.85);
    if (isHeadshot && killed) {
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
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.65, '#f1f5f9');
      grad.addColorStop(1, '#cbd5e1');
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

    // 3. Player Movement + Sprint + Crouch + Tactical Slide + Dash + Jump (Coyote Time + Jump Buffering)
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
    const shiftHeld = this.controlIsHeld('sprint');

    const wantsSprint =
      (shiftHeld || this.touchSprintLock) && moveFwd > 0.25 && !adsActive && !this.crouching && this.slideTimer <= 0;
    this.sprinting = wantsSprint;
    if (this.sprinting && this.crouching) this.crouching = false;

    const maxSpeed = this.sprinting ? 10.2 : this.crouching ? 4.1 : adsActive ? 4.5 : 7.2;

    // Smoothly transition eye height (extra-low athletic dip during tactical slide)
    const targetEye =
      this.slideTimer > 0
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
      const accelLambda = this.grounded ? 14 : 4.6;
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
      if (this.coyoteTimer > 0) {
        this.playerVel.y = 8.4;
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
    this.physics.stepCapsule(this.playerBody, dt, 22.5);
    this.grounded = this.playerBody.grounded;

    const playerIndoors = this.isPlayerIndoors();
    const impactDownSpeed = this.playerBody.landingSpeed;

    // Surface-calibrated landing impact audio + physical knee/weapon compression on touchdown
    if (impactDownSpeed > 2.6) {
      if (impactDownSpeed > 3.2) {
        this.audio.playLanding(this.detectSurfaceBelowPlayer(), impactDownSpeed, playerIndoors);
      }
      this.landingDipVel -= Math.min(1.2, impactDownSpeed * 0.115);
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

    const shakePitch = this.gunKickPitch + this.damagePunchPitch + oscPitch;
    const shakeYaw = this.gunKickYaw + this.damagePunchYaw + oscYaw;
    const shakeRoll = this.gunKickRoll + this.damagePunchRoll + oscRoll;

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
    // Keep the camera sphere strictly outside all solid walls, corners, and ceilings so shake/crouch never sees through geometry
    this.physics.resolveCameraSphere(this.camera.position, 0.28);
    _euler.set(
      this.pitch + shakePitch,
      this.yaw + shakeYaw,
      shakeRoll + this.dashRollTilt + this.slideRoll + this.strafeRoll + headBobRoll,
      'YXZ',
    );
    this.camera.quaternion.setFromEuler(_euler);

    // Keep sky clouds drifting gently, cycle dynamic weather & lock sun corona at optical infinity
    this.skyElapsed += dt;
    this.skyMat.uniforms.uTime.value = this.skyElapsed;
    this.updateDynamicWeather(dt);
    this.sunCoronaSprite.position.copy(this.camera.position).addScaledVector(SUN_DIRECTION, 235);
    if (this.impactLightTimer > 0) {
      this.impactLightTimer = Math.max(0, this.impactLightTimer - dt);
      this.impactLight.intensity = this.impactLightTimer > 0 ? this.impactLight.intensity * Math.exp(-26 * dt) : 0;
    }

    // Dynamic FOV (true 6x / 10x sniper optical magnification + subtle inspect close-up + damage punch)
    const spec = WEAPON_SPECS[this.weaponId];
    const opticalZoom = this.weaponId === 'marksman' ? (this.scopeZoomLevel === 10 ? 6 : 3) : this.scopeZoomLevel;
    const sniperFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(75) / 2) / opticalZoom));
    const baseFov = adsActive
      ? ['railpistol', 'marksman'].includes(this.weaponId)
        ? sniperFov
        : spec.adsFov
      : this.inspectingActive
        ? 70.8
        : this.sprinting
          ? 80
          : 75;
    const fovPunchScale = ['railpistol', 'marksman'].includes(this.weaponId) && adsActive ? 0.22 : 1.0;
    const targetFov = THREE.MathUtils.clamp(baseFov + this.dashFovBoost + this.damageFovPunch * fovPunchScale, 7.2, 104);
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
    if (this.timeSinceDamaged > 4.6 && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 14 * dt);
    }

    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.15);
    this.damageAberration = Math.max(0, this.damageAberration - dt * 3.2);
    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    this.damageArcTimer = Math.max(0, this.damageArcTimer - dt);
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
        _v1.set(bestSpawn.x + jitterX, 0, bestSpawn.z + jitterZ);
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
        if (e.kind === 'wasp') {
          e.root.rotation.z += dt * 4.5 * e.deathFallDir;
          e.root.rotation.x += dt * 2.4;
          e.root.position.y = Math.max(0.25, e.root.position.y - dt * 5.2);
        } else {
          e.root.rotation.x = -eased * 1.48;
          e.root.rotation.z = eased * 0.28 * e.deathFallDir;
          e.root.position.y = Math.max(-0.08, e.root.position.y - dt * 0.25);
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
      // Vector toward player on XZ plane
      const dx = this.playerPos.x - e.root.position.x;
      const dz = this.playerPos.z - e.root.position.z;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq) || 0.001;

      // Smoothly face player
      const desiredYaw = Math.atan2(dx, dz);
      let yawDiff = desiredYaw - e.root.rotation.y;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      e.root.rotation.y += yawDiff * Math.min(1, dt * 8);

      // Strafe cadence
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeDir *= -1;
        e.strafeTimer = 1.4 + Math.random() * 1.6;
      }

      // Movement logic (slow down slightly during attack windup telegraph)
      const moveFactor = e.isWindingUp ? 0.25 : 1.0;
      const nx = dx / dist;
      const nz = dz / dist;
      const rx = -nz;
      const rz = nx;

      let vx = 0;
      let vz = 0;
      if (dist > e.preferredRange + 2.0) {
        vx += nx * e.speed;
        vz += nz * e.speed;
      } else if (dist < e.preferredRange - 3.5) {
        vx -= nx * e.speed * 0.65;
        vz -= nz * e.speed * 0.65;
      }
      vx += rx * e.strafeDir * e.speed * 0.58;
      vz += rz * e.strafeDir * e.speed * 0.58;

      // Soft separation from other combatants so they don't stack
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j || !this.enemies[j].alive) continue;
        const other = this.enemies[j];
        const sx = e.root.position.x - other.root.position.x;
        const sz = e.root.position.z - other.root.position.z;
        const sdSq = sx * sx + sz * sz;
        const minSep = e.radius + other.radius + 0.6;
        if (sdSq < minSep * minSep && sdSq > 0.001) {
          const sd = Math.sqrt(sdSq);
          vx += (sx / sd) * 3.5;
          vz += (sz / sd) * 3.5;
        }
      }

      const edx = vx * moveFactor * dt;
      const edz = vz * moveFactor * dt;

      if (e.kind !== 'wasp') {
        const eSubSteps = Math.max(1, Math.ceil(Math.hypot(edx, edz) / 0.18));
        const eStepX = edx / eSubSteps;
        const eStepZ = edz / eSubSteps;
        for (let s = 0; s < eSubSteps; s++) {
          e.root.position.x += eStepX;
          e.root.position.z += eStepZ;
          this.physics.resolveCapsuleHorizontal(e.root.position, e.radius, 1.85, 0.32);
          this.physics.resolveCapsuleHorizontal(e.root.position, e.radius, 1.85, 0.32);
        }
        // Smoothly step onto wooden boardwalk porches and enterable building floors
        const targetFloor = this.physics.sampleGroundAt(
          e.root.position.x,
          e.root.position.z,
          e.root.position.y,
          e.radius,
          0.32,
        ).y;
        e.root.position.y = THREE.MathUtils.damp(e.root.position.y, targetFloor, 14, dt);
      } else {
        // Keep hovering drones physically outside solid building upper stories, roofs & towers
        _v4.set(e.root.position.x + edx, e.hoverBaseY, e.root.position.z + edz);
        this.physics.resolveSphere(_v4, e.radius + 0.16);
        e.root.position.x = _v4.x;
        e.root.position.z = _v4.z;
      }

      // Realistic Articulated Stride, Knee Bend, Upper-Body Aim Lean & Weapon Recoil
      const moveSpeedNow = Math.hypot(vx, vz) * moveFactor;
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
        if (e.fireCooldown <= 0 && dist < 34) {
          // Verify rough line of sight before telegraphing
          _v1.copy(e.root.position).setY(e.kind === 'wasp' ? e.hoverBaseY : 1.6);
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
      if (
        p.pos.y <= 0.08 ||
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
    // 1. Sky Dome Shader uniforms
    const u = this.skyMat.uniforms;
    (u.uZenithColor.value as THREE.Color).lerpColors(a.zenith, b.zenith, t);
    (u.uMidSkyColor.value as THREE.Color).lerpColors(a.midSky, b.midSky, t);
    (u.uHorizonColor.value as THREE.Color).lerpColors(a.horizon, b.horizon, t);
    (u.uGroundHazeColor.value as THREE.Color).lerpColors(a.groundHaze, b.groundHaze, t);
    (u.uSunColor.value as THREE.Color).lerpColors(a.sunDiscColor, b.sunDiscColor, t);
    u.uCloudCover.value = THREE.MathUtils.lerp(a.cloudCover, b.cloudCover, t);
    u.uSunStrength.value = THREE.MathUtils.lerp(a.sunStrength, b.sunStrength, t);

    // 2. Scene Background & Exponential Fog
    this.sceneBgColor.lerpColors(a.fogColor, b.fogColor, t);
    this.sceneFog.color.copy(this.sceneBgColor);
    this.sceneFog.density = THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t);

    // 3. Directional Sun, Hemisphere Fill, Sky Rim & Practical Interior Glow
    this.sunLight.color.lerpColors(a.sunLightColor, b.sunLightColor, t);
    this.sunLight.intensity = THREE.MathUtils.lerp(a.sunLightIntensity, b.sunLightIntensity, t);

    this.hemiLight.color.lerpColors(a.hemiSkyColor, b.hemiSkyColor, t);
    this.hemiLight.groundColor.lerpColors(a.hemiGroundColor, b.hemiGroundColor, t);
    this.hemiLight.intensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);

    this.rimLight.color.lerpColors(a.rimColor, b.rimColor, t);
    this.rimLight.intensity = THREE.MathUtils.lerp(a.rimIntensity, b.rimIntensity, t);

    this.saloonGlow.intensity = THREE.MathUtils.lerp(a.saloonIntensity, b.saloonIntensity, t);
    this.forgeGlow.intensity = THREE.MathUtils.lerp(a.forgeIntensity, b.forgeIntensity, t);

    // 4. Sun Corona Sprite
    this.sunCoronaMat.color.lerpColors(a.coronaColor, b.coronaColor, t);
    this.sunCoronaMat.opacity = THREE.MathUtils.lerp(a.coronaOpacity, b.coronaOpacity, t);
    const coronaScale = THREE.MathUtils.lerp(a.coronaScale, b.coronaScale, t);
    this.sunCoronaSprite.scale.set(coronaScale, coronaScale, 1);

    // 5. Atmospheric Dust Motes & Drifting Mist/Dust Wisps
    this.dustMotesMat.color.lerpColors(a.moteColor, b.moteColor, t);
    this.dustMotesMat.opacity = THREE.MathUtils.lerp(a.moteOpacity, b.moteOpacity, t);
    this.dustWispsMat.color.lerpColors(a.wispColor, b.wispColor, t);
    this.dustWispsMat.opacity = THREE.MathUtils.lerp(a.wispOpacity, b.wispOpacity, t);
    this.dustWispsMat.size = THREE.MathUtils.lerp(a.wispSize, b.wispSize, t);

    // 6. Sunlit Bloom & Tone Mapping Exposure + IBL Reflection Intensity + Ambient Wind Coupling
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(a.exposure, b.exposure, t);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(a.envIntensity, b.envIntensity, t);
    this.currentWeatherWind = THREE.MathUtils.lerp(a.windIntensity, b.windIntensity, t);

    // Mirror world weather lighting onto the depth-isolated viewmodel overlay scene
    this.weaponSunLight.color.copy(this.sunLight.color);
    this.weaponSunLight.intensity = this.sunLight.intensity;
    this.weaponHemiLight.color.copy(this.hemiLight.color);
    this.weaponHemiLight.groundColor.copy(this.hemiLight.groundColor);
    this.weaponHemiLight.intensity = this.hemiLight.intensity;
    this.weaponRimLight.color.copy(this.rimLight.color);
    this.weaponRimLight.intensity = this.rimLight.intensity;
    this.weaponScene.environmentIntensity = this.scene.environmentIntensity;
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
  // RENDER LOOP (GPU rAF + Software-WebGL afterDraw Pacing)
  // =========================================================================
  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private readonly tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    const foreground = document.visibilityState === 'visible';
    if (!this.isSoftwareGl && this.settings.dynamicResolution && this.phase === 'playing' && foreground) {
      const ratio = this.renderQuality.sample(Math.max(this.renderWorkMs, this.gpuTimer.milliseconds), rawDt * 1000);
      if (ratio !== null) {
        this.renderer.setPixelRatio(ratio);
        this.handleResize();
      }
    }
    const clampedDt = Math.min(Math.max(rawDt, 0.001), 0.05);
    // Gentle EMA frame-delta smoothing removes micro-hitches for silky camera & weapon motion
    this.smoothedDt = THREE.MathUtils.lerp(this.smoothedDt, clampedDt, 0.38);
    const dt = this.smoothedDt;

    // Skip rendering the 3D background map while on the minimalist Home / Setup menu
    if (this.phase === 'title' || !foreground) {
      this.audio.updateAmbient(dt, this.playerPos, false, this.currentWeatherWind, false);
      this.frameId = window.setTimeout(this.tick, 60);
      return;
    }

    this.updateSimulation(dt);
    if (this.phase === 'playing' && document.visibilityState === 'visible') this.frameMetrics.sample(rawDt * 1000);

    // Conservative 3D thick-wall occlusion culling pass right before rendering (skips hidden draw calls & overdraw)
    if (this.phase === 'playing') {
      this.occlusion.update(this.camera, this.playerPos, this.enemies, this.pickups, this.impactDecals);
    }
    this.staticBatches.updateVisibility();

    this.audio.updateAmbient(
      dt,
      this.playerPos,
      this.isPlayerIndoors(),
      this.currentWeatherWind,
      this.phase === 'playing',
    );

    // The town and sunlight direction are static: reuse their shadow map.
    // Moving enemies already have animated ground-contact shadow meshes.
    this.renderer.info.reset();
    this.gpuTimer.begin();
    this.cachedSky.update(this.renderer, clampedDt);
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

    this.hudEmitAccum += clampedDt;
    if (this.hudEmitAccum >= 0.033) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
    this.renderWorkMs = performance.now() - now;

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

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
      crouching: this.crouching,
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
    // Compass bearing in degrees (0 = North (-Z), 90 = East (+X), 180 = South (+Z), 270 = West (-X))
    const rawDeg = ((-this.yaw * 180) / Math.PI) % 360;
    const headingDeg = Math.round((rawDeg + 360) % 360) % 360;

    this.onHudUpdate({
      phase: this.phase,
      difficulty: this.difficulty,
      mapId: this.mapId,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      shield: Math.floor(this.shield),
      maxShield: this.maxShield,
      score: this.score,
      wave: this.wave,
      maxWaves: MAX_WAVES,
      endless: this.endless,
      enemiesRemaining: remaining,
      weaponId: this.weaponId,
      inventory: inventoryWeapons(this.loadout).map(id => ({ id, ammo: this.ammoMap[id], reserve: this.reserveMap[id] })),
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
        seq: this.hitMarkerSeq,
        intensity: this.hitMarkerTimer > 0 ? Math.min(1, this.hitMarkerTimer / this.hitMarkerDuration) : 0,
      },
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
        gpuName: this.gpuName,
        triangles: this.renderer.info.render.triangles,
      },
      radar: {
        playerX: this.playerPos.x,
        playerZ: this.playerPos.z,
        playerYaw: this.yaw,
        range: 40,
        enemies: this.enemies
          .filter((e) => e.alive)
          .map((e) => ({
            id: e.id,
            x: e.root.position.x,
            z: e.root.position.z,
            kind: e.kind,
            elevated: e.root.position.y > 2.2,
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
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (this.remotePlayers) {
      this.remotePlayers.dispose();
      this.remotePlayers = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleWebGLContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleWebGLContextRestored);

    this.resizeObserver?.disconnect();
    this.clearEnemies();
    this.staticBatches.dispose();
    this.arena.dispose();
    for (const item of [...this.ordnance, ...this.zones]) this.disposeOrdnanceMesh(item.mesh);
    this.weaponRig.dispose();
    this.enemyFactory.dispose();
    this.textures.dispose();
    this.envTarget.dispose();
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
    this.cachedSky.dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
