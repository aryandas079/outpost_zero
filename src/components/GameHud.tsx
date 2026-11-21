import React, { useCallback, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  Maximize2,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { HudSnapshot, WeaponId } from '../game/types';
import { RadarMinimap } from './RadarMinimap';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  isMobile: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onDash: () => void;
  onInspectHold: (held: boolean) => void;
  onToggleCrouch: () => void;
  onToggleScopeZoom: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onTouchFire: (held: boolean) => void;
  onTouchAdsToggle: () => void;
  onTouchSprintToggle: (active: boolean) => void;
  onTouchJump: () => void;
}

const COMPASS_LABELS: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SW',
  270: 'W',
  315: 'NW',
};

function formatClock(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Crisp SVG rifle silhouettes for loadout cards & live kill feed */
const CarbineSvg: React.FC<{ className?: string }> = ({ className = 'w-14 h-5' }) => (
  <svg viewBox="0 0 96 28" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4 11h16l3-2h18v-3h10v3h9l2 1.5h26v2.5H65l-1 2.5H51l2.5 8.5h-5.2L45 16h-9l-3 7.5h-4.5L31 16H20l-2 4.5H4V11zm38-4.5h6V8h-6V6.5z" />
  </svg>
);

const SniperSvg: React.FC<{ className?: string }> = ({ className = 'w-14 h-5' }) => (
  <svg viewBox="0 0 108 28" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 13h17l4-2.5h15V7.5h-4V5.2h23v2.3h-4v3h14l2 1.2h35v2.2H71l-1 2.2H54l-1.5 6.8h-5.2l1.2-6.8H37l-3.2 6.8H29l2.6-6.8H19l-2 4.8H3V13z" />
  </svg>
);

export const GameHud: React.FC<GameHudProps> = React.memo(({
  hud,
  muted,
  isMobile,
  onPause,
  onToggleMute,
  onToggleFullscreen,
  onSelectWeapon,
  onReload,
  onDash,
  onInspectHold,
  onToggleCrouch,
  onToggleScopeZoom,
  onTouchMove,
  onTouchLook,
  onTouchFire,
  onTouchAdsToggle,
  onTouchSprintToggle,
  onTouchJump,
}) => {
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / hud.maxShield) * 100));
  const lowHealth = hud.health <= 30;
  const lowAmmo = hud.ammo <= Math.ceil(hud.magSize * 0.25);
  const spread = hud.crosshairSpread;
  const dashReady = hud.dashCooldown <= 0.02;
  const dashChargePct = dashReady
    ? 100
    : Math.max(0, Math.min(100, (1 - hud.dashCooldown / hud.dashCooldownMax) * 100));

  // Progress bar fill percentages for Top-Left Tactical Match Score Widget
  const friendlyBarPct = Math.min(100, Math.max(12, hud.eliminations * 4));
  const hostileBarPct = Math.min(100, Math.max(6, hud.enemiesRemaining * 7));

  // =========================================================================
  // MOBILE VIRTUAL JOYSTICK & RIGHT-SIDE TOUCH LOOK STATE (ONLY ON MOBILE)
  // =========================================================================
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintLocked, setSprintLocked] = useState(false);

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firePointerId = useRef<number | null>(null);
  const lastFirePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateJoystickFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = joyBaseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.38;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      setJoyKnob({ x: dx, y: dy });
      const nx = dx / maxR;
      const ny = -dy / maxR; // up on screen = forward (+1)
      onTouchMove(nx, ny);
      // Auto-sprint if pushed hard forward past 85%
      if (ny > 0.88 && !sprintLocked) {
        onTouchSprintToggle(true);
      } else if (!sprintLocked) {
        onTouchSprintToggle(false);
      }
    },
    [onTouchMove, onTouchSprintToggle, sprintLocked],
  );

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyKnob({ x: 0, y: 0 });
    onTouchMove(0, 0);
    if (!sprintLocked) onTouchSprintToggle(false);
  };

  const handleLookZoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookZoneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    onTouchLook(dx, dy);
  };

  const handleLookZoneUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  };

  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    firePointerId.current = e.pointerId;
    lastFirePos.current = { x: e.clientX, y: e.clientY };
    onTouchFire(true);
  };

  const handleFireMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - lastFirePos.current.x;
    const dy = e.clientY - lastFirePos.current.y;
    lastFirePos.current = { x: e.clientX, y: e.clientY };
    // Allow smooth aim tracking while holding down Fire button on mobile!
    onTouchLook(dx, dy);
  };

  const handleFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    firePointerId.current = null;
    onTouchFire(false);
  };

  const handleSprintToggleClick = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = !sprintLocked;
    setSprintLocked(next);
    onTouchSprintToggle(next);
  };

  // =========================================================================
  // TOP-CENTER COMPASS TICKS AROUND CURRENT HEADING
  // =========================================================================
  const heading = hud.headingDeg;
  const compassTicks: Array<{ deg: number; offsetDeg: number; label: string; isCardinal: boolean }> = [];
  const baseStep = Math.floor(heading / 15) * 15;
  for (let i = -5; i <= 5; i++) {
    const rawDeg = baseStep + i * 15;
    const normDeg = ((rawDeg % 360) + 360) % 360;
    let diff = rawDeg - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) <= 72) {
      const cardinal = COMPASS_LABELS[normDeg];
      compassTicks.push({
        deg: rawDeg,
        offsetDeg: diff,
        label: cardinal ?? String(normDeg),
        isCardinal: Boolean(cardinal),
      });
    }
  }

  const scopedIn = hud.scopeAlpha > 0.02;
  const hasScreenShake =
    Math.abs(hud.screenShakeX) > 0.05 ||
    Math.abs(hud.screenShakeY) > 0.05 ||
    Math.abs(hud.screenShakeRot) > 0.02;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* =====================================================================
          1. FULL-SCREEN HIGH-PRECISION OPTICAL SNIPER SCOPE OVERLAY (K-9 SNIPER)
          ===================================================================== */}
      {scopedIn && (
        <div
          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
          style={{ opacity: hud.scopeAlpha }}
        >
          {/* Matte-black optical scope housing mask with realistic beveled circular ocular lens */}
          <svg
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full block"
          >
            <defs>
              <mask id="sniper-aperture-mask">
                <rect x="0" y="0" width="1600" height="900" fill="white" />
                <circle
                  cx={800 + hud.scopeSwayX * 0.55}
                  cy={450 + hud.scopeSwayY * 0.55}
                  r="348"
                  fill="black"
                />
              </mask>
              <radialGradient id="sniper-lens-vignette" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0f2530" stopOpacity="0.02" />
                <stop offset="72%" stopColor="#081a24" stopOpacity="0.1" />
                <stop offset="89%" stopColor="#040b10" stopOpacity="0.52" />
                <stop offset="97%" stopColor="#020407" stopOpacity="0.94" />
                <stop offset="100%" stopColor="#000000" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="sniper-lens-glint" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#8ce6ff" stopOpacity="0.06" />
                <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.01" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Exterior Matte Optical Eyepiece Shadow */}
            <rect
              x="0"
              y="0"
              width="1600"
              height="900"
              fill="#030508"
              fillOpacity="0.97"
              mask="url(#sniper-aperture-mask)"
            />

            {/* Optical Lens Coating, Edge Vignette & Etched Mil-Dot Reticle */}
            <g transform={`translate(${hud.scopeSwayX * 0.55}, ${hud.scopeSwayY * 0.55})`}>
              {/* Optical glass vignette & subtle anti-reflective tint */}
              <circle cx="800" cy="450" r="350" fill="url(#sniper-lens-vignette)" />
              <circle cx="800" cy="450" r="348" fill="url(#sniper-lens-glint)" />

              {/* Machined aluminum scope bezel inner ring */}
              <circle
                cx="800"
                cy="450"
                r="348"
                fill="none"
                stroke="#11161e"
                strokeWidth="12"
              />
              <circle
                cx="800"
                cy="450"
                r="342"
                fill="none"
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="1.5"
              />

              {/* Outer heavy duplex posts */}
              <g stroke="#070a0f" strokeLinecap="butt">
                <line x1="452" y1="450" x2="635" y2="450" strokeWidth="4.5" />
                <line x1="965" y1="450" x2="1148" y2="450" strokeWidth="4.5" />
                <line x1="800" y1="628" x2="800" y2="798" strokeWidth="5.2" />
                <line x1="800" y1="102" x2="800" y2="270" strokeWidth="2.8" />
              </g>

              {/* Ultra-fine etched glass crosshair hairlines */}
              <g stroke="#090d14" strokeOpacity="0.92">
                <line x1="635" y1="450" x2="965" y2="450" strokeWidth="1.1" />
                <line x1="800" y1="270" x2="800" y2="628" strokeWidth="1.1" />
              </g>

              {/* Horizontal Windage Mil-Dots */}
              {[-130, -98, -65, -33, 33, 65, 98, 130].map((dx) => (
                <line
                  key={`wx-${dx}`}
                  x1={800 + dx}
                  y1={444}
                  x2={800 + dx}
                  y2={456}
                  stroke="#090d14"
                  strokeWidth={Math.abs(dx) === 65 || Math.abs(dx) === 130 ? 1.6 : 1.1}
                />
              ))}

              {/* Vertical Elevation Drop Stadia Marks (3, 6, 9 matching reference sniper scope!) */}
              {[
                { dy: 34, w: 12, label: '3' },
                { dy: 68, w: 15, label: '' },
                { dy: 102, w: 19, label: '6' },
                { dy: 136, w: 23, label: '' },
                { dy: 170, w: 27, label: '9' },
              ].map((tick) => (
                <g key={`ey-${tick.dy}`}>
                  <line
                    x1={800 - tick.w}
                    y1={450 + tick.dy}
                    x2={800 + tick.w}
                    y2={450 + tick.dy}
                    stroke="#090d14"
                    strokeWidth="1.35"
                  />
                  {tick.label && (
                    <text
                      x={800 + tick.w + 9}
                      y={454 + tick.dy}
                      fill="#0b1018"
                      fontSize="14"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}

              {/* Upper Range Ticks */}
              {[-34, -68, -102].map((dy) => (
                <line
                  key={`uy-${dy}`}
                  x1={792}
                  y1={450 + dy}
                  x2={808}
                  y2={450 + dy}
                  stroke="#090d14"
                  strokeWidth="1.2"
                />
              ))}

              {/* Illuminated Crisp Crimson Fiber-Optic Center Dot */}
              <circle cx="800" cy="450" r="4.4" fill="#ef4444" fillOpacity="0.34" />
              <circle cx="800" cy="450" r="2.2" fill="#ff3b30" />
            </g>
          </svg>

          {/* Subtle Optical Telemetry Callouts Outside Lens */}
          <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 flex items-center gap-3 text-[11px] font-mono-num tracking-wider text-slate-300/90 bg-black/55 border border-white/12 px-3 py-1 rounded">
            <span className="text-amber-400 font-bold">{hud.scopeZoom}X OPTIC</span>
            <span className="text-white/25">|</span>
            {hud.breathSteady ? (
              <span className="text-emerald-400 font-semibold">BREATH STEADY</span>
            ) : (
              <span>{isMobile ? 'CROUCH TO STEADY' : 'HOLD SHIFT · STEADY'}</span>
            )}
            {!isMobile && (
              <>
                <span className="text-white/25">|</span>
                <span>SCROLL / Z · ZOOM</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Fallback screen-edge red vignette when Software WebGL skips ShaderPass */}
      {!hud.gpuPostFx && hud.damageFlash > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: hud.damageFlash * 0.85,
            boxShadow: 'inset 0 0 110px 28px rgba(220, 38, 38, 0.72)',
          }}
        />
      )}

      {/* =====================================================================
          2. MOBILE RIGHT-SIDE TOUCH-LOOK CANVAS LAYER (REMOVED ON DESKTOP)
          ===================================================================== */}
      {isMobile && (
        <div
          className="absolute top-0 bottom-0 right-0 w-[58%] z-10 pointer-events-auto touch-none"
          onPointerDown={handleLookZoneDown}
          onPointerMove={handleLookZoneMove}
          onPointerUp={handleLookZoneUp}
          onPointerCancel={handleLookZoneUp}
          aria-label="Touch drag to look"
        />
      )}

      {/* Shaken Tactical HUD Chrome Layer (reticle, compass, score, loadout) synced with 3D camera impact */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={
          hasScreenShake
            ? {
                transform: `translate3d(${hud.screenShakeX.toFixed(2)}px, ${hud.screenShakeY.toFixed(2)}px, 0) rotate(${hud.screenShakeRot.toFixed(2)}deg)`,
              }
            : undefined
        }
      >
      {/* =====================================================================
          3. TOP HUD LAYER: MATCH SCORE + KILL FEED (LEFT) | COMPASS (CENTER) | UTILITY + MINIMAP (RIGHT)
          ===================================================================== */}
      <div className="absolute top-2.5 sm:top-3.5 left-3 sm:left-4 right-3 sm:right-4 z-30 flex items-start justify-between gap-2">
        {/* TOP-LEFT: Tactical Crest, Dual Score/Wave Bars, Match Timer & Live Kill Feed */}
        <div className="flex flex-col items-start gap-2 max-w-[230px] sm:max-w-[265px]">
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#0a0f17]/88 via-[#0e1520]/76 to-transparent pr-4 pl-2 py-1.5 rounded-sm border-l-2 border-amber-400/80">
            {/* Tactical Crest Emblem */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-sm bg-[#16202e]/90 border border-white/20 flex items-center justify-center">
              <svg viewBox="0 0 28 28" className="w-5 h-5 sm:w-6 sm:h-6 text-slate-100" fill="currentColor" aria-hidden="true">
                <path d="M14 2L4 6.2v6.6c0 6.1 4.1 11.4 10 13.2 5.9-1.8 10-7.1 10-13.2V6.2L14 2zm0 3.2l6.6 2.8v4.5c0 4.3-2.7 8.1-6.6 9.6-3.9-1.5-6.6-5.3-6.6-9.6V8L14 5.2zm0 3.3l-3.4 4.2h2.2v4.6h2.4v-4.6h2.2L14 8.5z" />
              </svg>
            </div>

            {/* Dual Team/Wave Score Bars */}
            <div className="flex flex-col gap-1 min-w-[104px] sm:min-w-[116px]">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base leading-none text-white font-mono-num w-7">
                  {hud.eliminations}
                </span>
                <div className="flex-1 h-1.5 bg-white/12 rounded-[1px] overflow-hidden">
                  <div
                    className="h-full bg-sky-400 origin-left transition-transform duration-150"
                    style={{ transform: `scaleX(${friendlyBarPct / 100})` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base leading-none text-slate-200 font-mono-num w-7">
                  {hud.enemiesRemaining}
                </span>
                <div className="flex-1 h-1.5 bg-white/12 rounded-[1px] overflow-hidden">
                  <div
                    className="h-full bg-red-500 origin-left transition-transform duration-150"
                    style={{ transform: `scaleX(${hostileBarPct / 100})` }}
                  />
                </div>
              </div>
            </div>

            {/* Match Clock */}
            <div className="pl-2 border-l border-white/15 flex flex-col items-end">
              <span className="font-mono-num font-bold text-xs sm:text-sm text-white leading-tight">
                {formatClock(hud.matchTimeSec)}
              </span>
              <span className="font-display text-[10px] tracking-widest uppercase text-amber-300/90 font-semibold">
                {hud.endless ? `W${hud.wave}` : `W${hud.wave}/${hud.maxWaves}`}
              </span>
            </div>
          </div>

          {/* Subtle Status Caption */}
          <div className="pl-2 -mt-1 flex items-center gap-2 text-[10px] sm:text-[11px] font-display tracking-widest uppercase">
            <span className={lowHealth ? 'text-red-400 font-bold' : 'text-slate-200/90 font-semibold'}>
              {lowHealth ? 'CRITICAL' : 'ENGAGED'}
            </span>
            <span className="text-white/25">·</span>
            <span className="text-amber-300 font-mono-num font-semibold">
              {hud.score.toLocaleString()} PTS
            </span>
          </div>

          {/* LIVE KILL FEED (Matching Reference Top-Left Kill Feed) */}
          {hud.killFeed.length > 0 && (
            <div className="flex flex-col gap-1 pl-1 mt-0.5">
              {hud.killFeed.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-1.5 bg-[#090d14]/65 px-2 py-0.5 rounded-xs text-[11px] font-medium whitespace-nowrap"
                >
                  <span className="text-sky-400 font-semibold">{entry.killer}</span>
                  {entry.weapon === 'railpistol' ? (
                    <SniperSvg className="w-7 h-3 text-slate-100" />
                  ) : (
                    <CarbineSvg className="w-7 h-3 text-slate-100" />
                  )}
                  {entry.headshot && (
                    <Crosshair className="w-3 h-3 text-amber-400 shrink-0" aria-label="Headshot" />
                  )}
                  <span className="text-red-400 font-semibold">{entry.victim}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP-CENTER: Dynamic Horizontal Tactical Compass Strip */}
        <div className="hidden sm:flex flex-col items-center pointer-events-none flex-1 max-w-[420px]">
          <div className="relative w-full h-9 overflow-hidden">
            {/* Subtle dark fade backing */}
            <div className="absolute inset-x-4 top-0 h-8 bg-gradient-to-r from-transparent via-[#090e16]/62 to-transparent" />
            {/* Center Gold Bearing Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-amber-400" />

            {/* Scrolling Bearing Ticks */}
            {compassTicks.map((t) => {
              const pct = 50 + (t.offsetDeg / 72) * 46;
              const isNearCenter = Math.abs(t.offsetDeg) < 7.5;
              return (
                <div
                  key={t.deg}
                  className="absolute top-1.5 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${pct}%`, opacity: isNearCenter ? 0 : 1 - Math.abs(t.offsetDeg) / 78 }}
                >
                  <span className="w-[1px] h-1.5 bg-white/35 mb-0.5" />
                  <span
                    className={`font-mono-num leading-none ${
                      t.isCardinal
                        ? 'text-xs font-bold text-slate-100'
                        : 'text-[10px] font-medium text-slate-400'
                    }`}
                  >
                    {t.label}
                  </span>
                </div>
              );
            })}

            {/* Active Center Degree Readout (Gold Highlight matching Reference) */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#090e16]/80 border-x border-white/20">
              <span className="font-mono-num font-bold text-xs text-amber-400 leading-none">
                {heading}
              </span>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT: Vertical Stack of Circular Utility Buttons + Rounded-Square Minimap */}
        <div className="flex items-start gap-2 sm:gap-2.5">
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onPause}
              aria-label="Settings and Pause"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0a0f17]/80 border border-white/20 flex items-center justify-center text-slate-200 hover:bg-[#182231] hover:text-white transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0a0f17]/80 border border-white/20 flex items-center justify-center text-slate-200 hover:bg-[#182231] hover:text-white transition-colors cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Toggle fullscreen"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#0a0f17]/80 border border-white/20 flex items-center justify-center text-slate-200 hover:bg-[#182231] hover:text-white transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <RadarMinimap radar={hud.radar} compact={isMobile} />
        </div>
      </div>

      {/* =====================================================================
          4. CENTERED TACTICAL WAVE / OBJECTIVE BANNER (Matching Reference Emblem Banner)
          ===================================================================== */}
      {hud.waveBanner && !scopedIn && (
        <div className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
          {/* Tactical Skull / Crossed Rifles Crest */}
          <div className="w-10 h-8 flex items-center justify-center -mb-1">
            <svg viewBox="0 0 64 40" className="w-10 h-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]" fill="none" aria-hidden="true">
              <path d="M8 32L56 8M56 32L8 8" stroke="#cbd5e1" strokeWidth="2.6" strokeLinecap="round" />
              <path
                d="M32 5C25.4 5 21 9.6 21 15.8c0 3.7 1.7 6.5 4.2 8.2v4.5c0 1.4 1.1 2.5 2.5 2.5h8.6c1.4 0 2.5-1.1 2.5-2.5V24c2.5-1.7 4.2-4.5 4.2-8.2C43 9.6 38.6 5 32 5z"
                fill="#0f172a"
                stroke="#e2e8f0"
                strokeWidth="2"
              />
              <circle cx="28" cy="16" r="2.5" fill="#e2e8f0" />
              <circle cx="36" cy="16" r="2.5" fill="#e2e8f0" />
              <path d="M29 25v3M32 25v3M35 25v3" stroke="#e2e8f0" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="bg-gradient-to-r from-transparent via-[#0b111b]/88 to-transparent px-10 py-1.5 border-y border-white/15 text-center">
            <p className="font-display font-bold text-xs sm:text-base tracking-[0.14em] uppercase text-white whitespace-nowrap drop-shadow">
              {hud.waveBanner}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-300/90 tracking-wide">
              Eliminate hostiles to hold WEST
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. CENTER DYNAMIC CROSSHAIR, HITMARKER & DIRECTIONAL DAMAGE ARC
          ===================================================================== */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
        {hud.damageArc.active && (
          <div
            className="absolute top-1/2 left-1/2 w-28 h-28 -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `translate(-50%, -50%) rotate(${hud.damageArc.angleRad}rad)`,
              opacity: hud.damageArc.intensity,
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path
                d="M 28 14 A 42 42 0 0 1 72 14"
                fill="none"
                stroke="#ef4444"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {(() => {
          const hitActive = hud.hitMarker.active;
          const hitColor = hud.hitMarker.crit
            ? '#fbbf24'
            : hud.hitMarker.kill
              ? '#ef4444'
              : '#ff5a36';
          const tickColor = hitActive ? hitColor : 'rgba(255, 255, 255, 0.92)';
          const tickSpread = spread + (hitActive ? Math.round(hud.hitMarker.intensity * 4) : 0);
          const hitGlow = hitActive
            ? `0 0 ${hud.hitMarker.crit || hud.hitMarker.kill ? 10 : 7}px ${hitColor}`
            : '0 0 2px rgba(0, 0, 0, 0.7)';

          return (
            <div className="relative w-0 h-0">
              {hitActive && (
                <span
                  key={`ring-${hud.hitMarker.seq}`}
                  className="animate-crosshair-ring absolute top-1/2 left-1/2 w-7 h-7 rounded-full border-2 pointer-events-none"
                  style={{
                    borderColor: hitColor,
                    boxShadow: `0 0 10px ${hitColor}`,
                  }}
                />
              )}

              {/* Hipfire precision center dot & 4 ticks (hidden cleanly during ADS / optical scope) */}
              {!hud.ads && (
                <>
                  <span
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-75"
                    style={{
                      width: hitActive ? '5px' : '3.5px',
                      height: hitActive ? '5px' : '3.5px',
                      backgroundColor: hitActive ? hitColor : '#f8fafc',
                      boxShadow: hitGlow,
                    }}
                  />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 transition-colors duration-75"
                    style={{
                      bottom: `${tickSpread}px`,
                      backgroundColor: tickColor,
                      boxShadow: hitGlow,
                    }}
                  />
                  <span
                    className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 transition-colors duration-75"
                    style={{
                      top: `${tickSpread}px`,
                      backgroundColor: tickColor,
                      boxShadow: hitGlow,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 transition-colors duration-75"
                    style={{
                      right: `${tickSpread}px`,
                      backgroundColor: tickColor,
                      boxShadow: hitGlow,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 transition-colors duration-75"
                    style={{
                      left: `${tickSpread}px`,
                      backgroundColor: tickColor,
                      boxShadow: hitGlow,
                    }}
                  />
                </>
              )}

              {/* Crisp Hitmarker X (visible both in hipfire & through optical sniper scope) */}
              {hitActive && (
                <svg
                  key={`x-${hud.hitMarker.seq}`}
                  viewBox="0 0 36 36"
                  className="animate-crosshair-hit absolute top-1/2 left-1/2 w-9 h-9 pointer-events-none"
                  style={{ filter: `drop-shadow(0 0 4px ${hitColor})` }}
                >
                  <g
                    stroke={hitColor}
                    strokeWidth={hud.hitMarker.crit || hud.hitMarker.kill ? '2.8' : '2.2'}
                    strokeLinecap="round"
                  >
                    <line x1="6" y1="6" x2="13" y2="13" />
                    <line x1="30" y1="6" x2="23" y2="13" />
                    <line x1="6" y1="30" x2="13" y2="23" />
                    <line x1="30" y1="30" x2="23" y2="23" />
                  </g>
                </svg>
              )}
            </div>
          );
        })()}
      </div>

      {/* =====================================================================
          6. PICKUP NOTICE & DESKTOP POINTER-LOCK HINT
          ===================================================================== */}
      <div className="absolute bottom-[98px] sm:bottom-[108px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
        {hud.pickupNotice && (
          <div className="bg-[#0a1019]/88 border border-emerald-400/45 rounded px-3.5 py-1 text-xs font-mono-num font-semibold text-emerald-300 whitespace-nowrap">
            {hud.pickupNotice}
          </div>
        )}
        {!isMobile && !hud.pointerLocked && (
          <div className="bg-[#0a1019]/82 border border-white/15 rounded px-3.5 py-1 text-[11px] text-slate-200 whitespace-nowrap">
            Click arena to lock aim · Right-Click Scope · Hold I Inspect · Shift+C Slide · 1/2 Swap
          </div>
        )}
      </div>

      {/* =====================================================================
          7. BOTTOM-CENTER TACTICAL LOADOUT BAR + HP / SHIELD BAR (BOTH DESKTOP & MOBILE)
          Matches reference image: skewed tactical slots + gold-bordered active weapon + horizontal HP bar
          ===================================================================== */}
      <div className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 sm:gap-2">
        {/* Reloading Progress Indicator (distinguishes fast Tactical vs. Empty Bolt-Rack Reload) */}
        {hud.reloading && (
          <div className="flex flex-col items-center gap-1 mb-0.5">
            <span
              className={`font-display font-bold text-[10px] tracking-[0.16em] uppercase drop-shadow ${
                hud.reloadEmpty ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {hud.reloadEmpty
                ? hud.reloadProgress > 0.66
                  ? 'EMPTY RELOAD · BOLT'
                  : 'EMPTY RELOAD'
                : 'TACTICAL RELOAD'}
            </span>
            <div className="w-40 h-1 bg-white/15 rounded-full overflow-hidden">
              <div
                className={`h-full origin-left ${hud.reloadEmpty ? 'bg-amber-400' : 'bg-sky-400'}`}
                style={{ transform: `scaleX(${hud.reloadProgress})` }}
              />
            </div>
          </div>
        )}

        {/* Active Weapon Inspect Showcase Label */}
        {!hud.reloading && hud.inspecting && (
          <div className="flex items-center gap-2 mb-0.5 px-2.5 py-0.5 bg-[#0a0f17]/78 border border-amber-400/35 rounded-xs">
            <span className="font-display font-bold text-[10px] tracking-[0.18em] uppercase text-amber-300">
              INSPECTING · {hud.weaponId === 'carbine' ? 'M13 CARBINE' : 'K-9 SNIPER'}
            </span>
          </div>
        )}

        {/* Skewed Tactical Equipment & Dual Weapon Cards */}
        <div className="flex items-stretch gap-1.5 sm:gap-2 pointer-events-auto">
          {/* Dash Tactical Slot */}
          <button
            type="button"
            onClick={onDash}
            aria-label="Dash"
            className={`hud-skew relative w-10 sm:w-12 h-11 sm:h-13 rounded-[3px] border transition-colors cursor-pointer overflow-hidden ${
              dashReady
                ? 'bg-[#0b111b]/80 border-white/25 hover:border-amber-400/70'
                : 'bg-[#0b111b]/65 border-white/12'
            }`}
          >
            {/* Cooldown fill */}
            <div
              className="absolute inset-x-0 bottom-0 bg-amber-400/18 origin-bottom"
              style={{ height: `${dashChargePct}%` }}
            />
            <div className="hud-unskew relative h-full flex flex-col items-center justify-center">
              <Zap className={`w-4 h-4 ${dashReady ? 'text-amber-300' : 'text-slate-500'}`} />
              {!isMobile && (
                <span className="mt-0.5 text-[9px] font-mono-num font-bold text-slate-200 bg-white/12 px-1 rounded-[2px]">
                  F
                </span>
              )}
            </div>
          </button>

          {/* Reload Tactical Slot */}
          <button
            type="button"
            onClick={onReload}
            aria-label="Reload weapon"
            className={`hud-skew relative w-10 sm:w-12 h-11 sm:h-13 rounded-[3px] border transition-colors cursor-pointer ${
              lowAmmo && hud.reserve > 0
                ? 'bg-red-950/75 border-red-400/70'
                : 'bg-[#0b111b]/80 border-white/25 hover:border-white/50'
            }`}
          >
            <div className="hud-unskew h-full flex flex-col items-center justify-center">
              <RotateCw
                className={`w-4 h-4 ${hud.reloading ? 'animate-spin text-amber-400' : lowAmmo ? 'text-red-300' : 'text-slate-200'}`}
              />
              {!isMobile && (
                <span className="mt-0.5 text-[9px] font-mono-num font-bold text-slate-200 bg-white/12 px-1 rounded-[2px]">
                  R
                </span>
              )}
            </div>
          </button>

          {/* Inspect Weapon Tactical Slot (Hold to inspect weapon from multiple angles) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onInspectHold(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onInspectHold(false);
            }}
            onPointerLeave={() => onInspectHold(false)}
            onPointerCancel={() => onInspectHold(false)}
            aria-label="Hold to inspect weapon"
            className={`hud-skew relative w-10 sm:w-12 h-11 sm:h-13 rounded-[3px] border transition-colors cursor-pointer touch-none ${
              hud.inspecting
                ? 'bg-amber-500/25 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                : 'bg-[#0b111b]/80 border-white/25 hover:border-amber-400/65'
            }`}
          >
            <div className="hud-unskew h-full flex flex-col items-center justify-center">
              <Eye className={`w-4 h-4 ${hud.inspecting ? 'text-amber-300' : 'text-slate-200'}`} />
              {!isMobile && (
                <span className="mt-0.5 text-[9px] font-mono-num font-bold text-slate-200 bg-white/12 px-1 rounded-[2px]">
                  I
                </span>
              )}
            </div>
          </button>

          {/* Slot 1: M13 CARBINE Card */}
          <button
            type="button"
            onClick={() => onSelectWeapon('carbine')}
            aria-label="Equip M13 Carbine"
            className={`hud-skew relative h-11 sm:h-13 px-2.5 sm:px-3.5 rounded-[3px] border transition-all cursor-pointer ${
              hud.weaponId === 'carbine'
                ? 'bg-[#121924]/90 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.28)]'
                : 'bg-[#0a0f17]/72 border-white/18 hover:border-white/35 opacity-80'
            }`}
          >
            <div className="hud-unskew h-full flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-start justify-center">
                <CarbineSvg
                  className={`w-12 sm:w-16 h-4 sm:h-5 ${
                    hud.weaponId === 'carbine' ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span className="font-display font-bold text-[8px] sm:text-[9px] tracking-wider uppercase text-slate-300 leading-none mt-0.5">
                  M13 CARBINE
                </span>
              </div>
              <div className="flex items-baseline gap-0.5 font-mono-num">
                <span
                  className={`font-display font-bold text-base sm:text-xl leading-none ${
                    hud.weaponId === 'carbine' && hud.carbineAmmo <= 7
                      ? 'text-red-400'
                      : hud.weaponId === 'carbine'
                        ? 'text-white'
                        : 'text-slate-300'
                  }`}
                >
                  {hud.carbineAmmo}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400">/{hud.carbineReserve}</span>
              </div>
            </div>
            {hud.weaponId === 'carbine' && (
              <span className="absolute bottom-0 inset-x-1 h-[2px] bg-amber-400" />
            )}
          </button>

          {/* Slot 2: K-9 SNIPER Card */}
          <button
            type="button"
            onClick={() => onSelectWeapon('railpistol')}
            aria-label="Equip K-9 Sniper"
            className={`hud-skew relative h-11 sm:h-13 px-2.5 sm:px-3.5 rounded-[3px] border transition-all cursor-pointer ${
              hud.weaponId === 'railpistol'
                ? 'bg-[#121924]/90 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.28)]'
                : 'bg-[#0a0f17]/72 border-white/18 hover:border-white/35 opacity-80'
            }`}
          >
            <div className="hud-unskew h-full flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-start justify-center">
                <SniperSvg
                  className={`w-12 sm:w-16 h-4 sm:h-5 ${
                    hud.weaponId === 'railpistol' ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span className="font-display font-bold text-[8px] sm:text-[9px] tracking-wider uppercase text-slate-300 leading-none mt-0.5">
                  K-9 SNIPER
                </span>
              </div>
              <div className="flex items-baseline gap-0.5 font-mono-num">
                <span
                  className={`font-display font-bold text-base sm:text-xl leading-none ${
                    hud.weaponId === 'railpistol' && hud.sniperAmmo <= 2
                      ? 'text-red-400'
                      : hud.weaponId === 'railpistol'
                        ? 'text-white'
                        : 'text-slate-300'
                  }`}
                >
                  {hud.sniperAmmo}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400">/{hud.sniperReserve}</span>
              </div>
            </div>
            {hud.weaponId === 'railpistol' && (
              <span className="absolute bottom-0 inset-x-1 h-[2px] bg-amber-400" />
            )}
          </button>
        </div>

        {/* Sleek Horizontal HP & Shield Bar directly below Weapon Slots (Matching Reference) */}
        <div className="w-[260px] sm:w-[340px] flex flex-col gap-1">
          {/* Thin Tactical Shield Strip */}
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[9px] tracking-wider text-sky-400 w-5 text-right">
              SH
            </span>
            <div className="flex-1 h-[3px] bg-black/55 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 origin-left transition-transform duration-100"
                style={{ transform: `scaleX(${shieldPct / 100})` }}
              />
            </div>
            <span className="font-mono-num text-[9px] text-sky-300/90 w-6">{hud.shield}</span>
          </div>

          {/* Primary Crisp White/Red HP Bar */}
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[10px] tracking-wider text-slate-200 w-5 text-right">
              HP
            </span>
            <div className="flex-1 h-2 bg-black/65 border border-white/15 rounded-[2px] overflow-hidden">
              <div
                className={`h-full origin-left transition-transform duration-100 ${
                  lowHealth ? 'bg-red-500' : 'bg-white'
                }`}
                style={{ transform: `scaleX(${healthPct / 100})` }}
              />
            </div>
            <span
              className={`font-mono-num font-bold text-[10px] w-6 ${
                lowHealth ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {hud.health}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          8. MOBILE-ONLY LANDSCAPE TOUCH CONTROLS (COMPLETELY REMOVED ON DESKTOP!)
          Matches user's pasted reference image (/public/assets/aistudio/image_b7587126.png)
          ===================================================================== */}
      {isMobile && (
        <>
          {/* BOTTOM-LEFT: Sprint Lock Button + Floating Virtual Movement Joystick */}
          <div className="absolute bottom-4 left-5 z-30 flex flex-col items-center gap-2.5 pointer-events-auto touch-none">
            {/* Sprint Lock Circular Toggle (Running Man Icon matching reference) */}
            <button
              type="button"
              onPointerDown={handleSprintToggleClick}
              aria-label="Toggle sprint"
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
                sprintLocked || hud.sprinting
                  ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                  : 'bg-[#0b111b]/60 border-white/25 text-slate-200'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                <circle cx="14.5" cy="4.5" r="2" />
                <path d="M10.5 8.5l2.5-.8 3.2 2.3 2.8-.6.4 1.8-3.6.8-2.2-1.5-1.2 2.4 2.7 2.4-.9 4.7-1.9-.3.7-3.4-2.4-2.1-1.7 2.8-3.4 1.6-.8-1.7 2.8-1.3 2.4-4-2.1-.6-1.7 2.3-1.5-1.1 2.3-3.1 4.6 1.2z" />
              </svg>
            </button>

            {/* Translucent Virtual Movement Joystick */}
            <div
              ref={joyBaseRef}
              onPointerDown={handleJoyDown}
              onPointerMove={handleJoyMove}
              onPointerUp={handleJoyUp}
              onPointerCancel={handleJoyUp}
              className="relative w-28 h-28 rounded-full bg-[#0a0f17]/40 border border-white/25 flex items-center justify-center touch-none"
              aria-label="Movement joystick"
            >
              {/* Top Directional Chevron */}
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-white/80" />
              {/* Inner Cardinal Ticks */}
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/45" />
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/45" />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/45" />

              {/* Draggable Thumb Knob */}
              <div
                className="w-11 h-11 rounded-full bg-white/28 border border-white/45 shadow-inner pointer-events-none"
                style={{
                  transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
                }}
              />
            </div>
          </div>

          {/* BOTTOM-RIGHT: Ergonomic Fire, Scope/ADS, Zoom, Crouch & Jump Controls */}
          <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2.5 pointer-events-none touch-none">
            {/* Scope Magnification Toggle (only when scoped in with K-9 Sniper) */}
            {hud.weaponId === 'railpistol' && hud.ads && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onToggleScopeZoom();
                }}
                aria-label="Toggle scope magnification"
                className="pointer-events-auto w-11 h-11 rounded-full bg-[#0b111b]/82 border border-amber-400 text-amber-300 font-mono-num font-bold text-xs flex items-center justify-center shadow-lg"
              >
                {hud.scopeZoom}x
              </button>
            )}

            {/* Middle Row: Primary Fire Button + Scope/ADS Crosshair Button */}
            <div className="flex items-center gap-3 pointer-events-auto">
              {/* Primary Fire Trigger (Hold to Fire + Drag to Aim) */}
              <button
                type="button"
                onPointerDown={handleFireDown}
                onPointerMove={handleFireMove}
                onPointerUp={handleFireUp}
                onPointerCancel={handleFireUp}
                aria-label="Fire weapon"
                className="w-16 h-16 rounded-full bg-amber-500/25 active:bg-amber-500/50 border-2 border-amber-400/90 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.3)] touch-none"
              >
                <svg viewBox="0 0 28 28" className="w-7 h-7 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M5 12h13l4 2-4 2H5v-4zm15-4l4 2-2 1-3-1 1-2zm0 12l-1-2 3-1 2 1-4 2z" />
                </svg>
              </button>

              {/* Scope / ADS Crosshair Button (Matching Reference Right-Side Crosshair Circle) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchAdsToggle();
                }}
                aria-label="Toggle Scope ADS"
                className={`w-13 h-13 rounded-full border-2 flex items-center justify-center transition-colors ${
                  hud.ads
                    ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                    : 'bg-[#0b111b]/65 border-white/35 text-white'
                }`}
              >
                <Crosshair className="w-6 h-6" />
              </button>
            </div>

            {/* Bottom-Right Stance Row: Crouch + Jump (Matching Reference Bottom-Right Pair) */}
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onToggleCrouch();
                }}
                aria-label="Toggle crouch"
                className={`w-11 h-11 rounded-full border flex items-center justify-center transition-colors ${
                  hud.crouching
                    ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                    : 'bg-[#0b111b]/65 border-white/30 text-slate-100'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                  <circle cx="13" cy="6" r="2.1" />
                  <path d="M9.5 10.5l4.2-.6 2.8 2.6-1.2 1.4-2-1.8-1.4 2.1 2.9 1.6v3.7h-2v-2.6l-3.6-1.8 1.3-3.2-2.2.7-.8-1.7 2-.4z" />
                </svg>
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onTouchJump();
                }}
                aria-label="Jump"
                className="w-11 h-11 rounded-full bg-[#0b111b]/65 active:bg-white/25 border border-white/30 text-slate-100 flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 4l6 6h-4v8h-4v-8H6l6-6z" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
});

