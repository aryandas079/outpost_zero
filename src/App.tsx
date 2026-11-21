import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ModalOverlay } from './components/ModalOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { OutpostGameEngine } from './game/engine';
import { GameSettings, HudSnapshot, MissionConfig, WEAPON_SPECS, WeaponId } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  difficulty: 'normal',
  mapId: 'west',
  health: 100,
  maxHealth: 100,
  shield: 50,
  maxShield: 50,
  score: 0,
  wave: 1,
  maxWaves: 5,
  endless: false,
  enemiesRemaining: 0,
  weaponId: 'carbine',
  ammo: WEAPON_SPECS.carbine.magSize,
  magSize: WEAPON_SPECS.carbine.magSize,
  reserve: WEAPON_SPECS.carbine.reserveMax,
  carbineAmmo: WEAPON_SPECS.carbine.magSize,
  carbineReserve: WEAPON_SPECS.carbine.reserveMax,
  sniperAmmo: WEAPON_SPECS.railpistol.magSize,
  sniperReserve: WEAPON_SPECS.railpistol.reserveMax,
  reloading: false,
  reloadProgress: 0,
  reloadEmpty: false,
  inspecting: false,
  ads: false,
  scopeAlpha: 0,
  scopeZoom: 6,
  scopeSwayX: 0,
  scopeSwayY: 0,
  breathSteady: false,
  crouching: false,
  sprinting: false,
  matchTimeSec: 0,
  headingDeg: 90,
  killFeed: [],
  crosshairSpread: 10,
  pointerLocked: false,
  hitMarker: { active: false, crit: false, kill: false, seq: 0, intensity: 0 },
  damageArc: { active: false, angleRad: 0, intensity: 0 },
  damageFlash: 0,
  screenShakeX: 0,
  screenShakeY: 0,
  screenShakeRot: 0,
  waveBanner: null,
  pickupNotice: null,
  eliminations: 0,
  headshots: 0,
  shotsFired: 0,
  shotsHit: 0,
  bestScore: 0,
  muted: false,
  dashCooldown: 0,
  dashCooldownMax: 2.2,
  dashing: false,
  gpuPostFx: true,
  radar: {
    playerX: -15,
    playerZ: 1.4,
    playerYaw: -Math.PI / 2,
    range: 40,
    enemies: [],
    pickups: [],
    buildings: [],
  },
};

function detectTouchMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const shortestSide = Math.min(window.innerWidth, window.innerHeight);
  return coarse || (hasTouch && shortestSide <= 900);
}

async function lockLandscapeOrientation(): Promise<void> {
  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen can be restricted in embedded preview iframes — continue gracefully
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'landscape-primary') => Promise<void>;
    };
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
    }
  } catch {
    // iOS Safari and non-fullscreen contexts ignore orientation.lock; portrait overlay handles it
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OutpostGameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<GameSettings>({
    sensitivity: 1.0,
    muted: false,
  });
  const [missionConfig, setMissionConfig] = useState<MissionConfig>({
    difficulty: 'normal',
    mapId: 'west',
  });
  const [contextLost, setContextLost] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => detectTouchMobileDevice());
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );

  // Track responsive mobile/desktop mode and enforce landscape awareness on mobile devices
  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(detectTouchMobileDevice());
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  // Attempt automatic landscape lock when a mobile user first taps the screen
  useEffect(() => {
    if (!isMobile) return;
    const tryLock = () => {
      void lockLandscapeOrientation();
    };
    window.addEventListener('pointerdown', tryLock, { once: true });
    return () => window.removeEventListener('pointerdown', tryLock);
  }, [isMobile]);

  // Mount Three.js engine once in an isolated DOM container so React HUD updates never tear down WebGL
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new OutpostGameEngine(
      mount,
      (snapshot) => setHud(snapshot),
      (lost) => setContextLost(lost),
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartMission = useCallback(
    (config: MissionConfig) => {
      setMissionConfig(config);
      if (isMobile) {
        void lockLandscapeOrientation();
      }
      engineRef.current?.startMission(config);
    },
    [isMobile],
  );

  const handleRestart = useCallback(() => {
    engineRef.current?.startMission(missionConfig);
  }, [missionConfig]);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeMission();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseMission();
  }, []);

  const handleContinueEndless = useCallback(() => {
    engineRef.current?.continueEndless();
  }, []);

  const handleMainMenu = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleSensitivityChange = useCallback((sensitivity: number) => {
    setSettings((prev) => {
      const next = { ...prev, sensitivity };
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setHud((prevHud) => {
      const nextMuted = !prevHud.muted;
      setSettings((prev) => {
        const next = { ...prev, muted: nextMuted };
        engineRef.current?.updateSettings(next);
        return next;
      });
      return { ...prevHud, muted: nextMuted };
    });
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      void lockLandscapeOrientation();
    }
  }, []);

  const handleSelectWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  }, []);

  const handleReload = useCallback(() => {
    engineRef.current?.triggerReload();
  }, []);

  const handleDash = useCallback(() => {
    engineRef.current?.triggerDash();
  }, []);

  const handleInspectHold = useCallback((held: boolean) => {
    engineRef.current?.setInspectHeld(held);
  }, []);

  const handleToggleCrouch = useCallback(() => {
    engineRef.current?.toggleCrouch();
  }, []);

  const handleToggleScopeZoom = useCallback(() => {
    engineRef.current?.toggleScopeZoom();
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    engineRef.current?.setTouchMove(x, y);
  }, []);

  const handleTouchLook = useCallback((dx: number, dy: number) => {
    engineRef.current?.addTouchLook(dx, dy);
  }, []);

  const handleTouchFire = useCallback((held: boolean) => {
    engineRef.current?.setTouchFire(held);
  }, []);

  const handleTouchAdsToggle = useCallback(() => {
    engineRef.current?.toggleTouchAds();
  }, []);

  const handleTouchSprintToggle = useCallback((active: boolean) => {
    engineRef.current?.setTouchSprint(active);
  }, []);

  const handleTouchJump = useCallback(() => {
    engineRef.current?.triggerTouchJump();
  }, []);

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-[#12171e] touch-none">
      {/* Isolated WebGL canvas mount */}
      <div
        ref={canvasMountRef}
        className="w-full h-full"
        aria-label="Outpost Zero 3D game viewport"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d1219]/95 px-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-display font-bold text-xl text-white mb-2">
              Graphics Context Interrupted
            </h2>
            <p className="text-sm text-slate-300 mb-5">
              WebGL rendering was temporarily suspended by the browser. Reload to resume play.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-md cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {/* Simple Home Screen + Match Setup (Difficulty & Map) + Settings */}
      {hud.phase === 'title' && (
        <TitleOverlay
          bestScore={hud.bestScore}
          settings={{ ...settings, muted: hud.muted }}
          initialDifficulty={missionConfig.difficulty}
          initialMap={missionConfig.mapId}
          onStartMission={handleStartMission}
          onSensitivityChange={handleSensitivityChange}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Playing HUD (Auto-switches cleanly between Mobile Landscape Touch & Desktop Clean HUD) */}
      {hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          muted={hud.muted}
          isMobile={isMobile}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onSelectWeapon={handleSelectWeapon}
          onReload={handleReload}
          onDash={handleDash}
          onInspectHold={handleInspectHold}
          onToggleCrouch={handleToggleCrouch}
          onToggleScopeZoom={handleToggleScopeZoom}
          onTouchMove={handleTouchMove}
          onTouchLook={handleTouchLook}
          onTouchFire={handleTouchFire}
          onTouchAdsToggle={handleTouchAdsToggle}
          onTouchSprintToggle={handleTouchSprintToggle}
          onTouchJump={handleTouchJump}
        />
      )}

      {/* Pause / Victory / Game Over Modal */}
      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'gameover') && (
        <ModalOverlay
          hud={hud}
          settings={{ ...settings, muted: hud.muted }}
          onResume={handleResume}
          onRestart={handleRestart}
          onContinueEndless={handleContinueEndless}
          onMainMenu={handleMainMenu}
          onSensitivityChange={handleSensitivityChange}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Mobile Landscape Enforcement Overlay (ensures mobile always plays in landscape layout) */}
      {isMobile && isPortrait && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f17]/97 px-8 text-center">
          <div className="animate-phone-rotate mb-6 w-16 h-24 rounded-xl border-2 border-amber-400/90 bg-[#141d2b] flex flex-col items-center justify-between p-2 shadow-[0_0_24px_rgba(251,191,36,0.2)]">
            <span className="w-6 h-1 rounded-full bg-white/25" />
            <span className="w-3 h-3 rounded-full border border-amber-400/60" />
            <span className="w-4 h-1 rounded-full bg-white/30" />
          </div>
          <h2 className="font-display font-bold text-xl tracking-wider uppercase text-white mb-2">
            Rotate to Landscape
          </h2>
          <p className="text-sm text-slate-300 max-w-xs mb-6 leading-relaxed">
            Outpost Zero is designed for horizontal landscape gameplay on mobile devices.
          </p>
          <button
            type="button"
            onClick={() => void lockLandscapeOrientation()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs tracking-wider uppercase rounded-md cursor-pointer"
          >
            Enter Landscape Fullscreen
          </button>
        </div>
      )}
    </main>
  );
}
