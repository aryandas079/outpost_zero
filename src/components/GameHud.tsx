import React, { useCallback, useRef, useState } from 'react';
import { HudSnapshot, KeyBindings, WeaponId } from '../game/types';
import { computeDynamicCrosshair } from '../game/crosshair';
import { TacticalHudPanels } from './TacticalHudPanels';

interface GameHudProps {
  hud: HudSnapshot;
  controls: KeyBindings;
  muted: boolean;
  isMobile: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onThrowGrenade: () => void;
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

export const GameHud: React.FC<GameHudProps> = React.memo(({
  hud,
  controls,
  muted,
  isMobile,
  onPause,
  onToggleMute,
  onToggleFullscreen,
  onSelectWeapon,
  onReload,
  onThrowGrenade,
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
  // Mobile virtual joystick & look controls
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
      const ny = -dy / maxR;
      onTouchMove(nx, ny);
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

  const scopedIn = hud.scopeAlpha > 0.02;
  const hasScreenShake =
    Math.abs(hud.screenShakeX) > 0.05 ||
    Math.abs(hud.screenShakeY) > 0.05 ||
    Math.abs(hud.screenShakeRot) > 0.02;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* 1. SNIPER OPTICAL SCOPE OVERLAY */}
      {scopedIn && (
        <div
          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
          style={{ opacity: hud.scopeAlpha }}
        >
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
            <defs>
              <mask id="sniper-aperture-mask">
                <rect x="0" y="0" width="1600" height="900" fill="white" />
                <circle cx={800 + hud.scopeSwayX * 0.55} cy={450 + hud.scopeSwayY * 0.55} r="348" fill="black" />
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

            <rect x="0" y="0" width="1600" height="900" fill="#030508" fillOpacity="0.97" mask="url(#sniper-aperture-mask)" />

            <g transform={`translate(${hud.scopeSwayX * 0.55}, ${hud.scopeSwayY * 0.55})`}>
              <circle cx="800" cy="450" r="350" fill="url(#sniper-lens-vignette)" />
              <circle cx="800" cy="450" r="348" fill="url(#sniper-lens-glint)" />
              <circle cx="800" cy="450" r="348" fill="none" stroke="#11161e" strokeWidth="12" />
              <circle cx="800" cy="450" r="342" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="1.5" />

              <g stroke="#070a0f" strokeLinecap="butt">
                <line x1="452" y1="450" x2="635" y2="450" strokeWidth="4.5" />
                <line x1="965" y1="450" x2="1148" y2="450" strokeWidth="4.5" />
                <line x1="800" y1="628" x2="800" y2="798" strokeWidth="5.2" />
                <line x1="800" y1="102" x2="800" y2="270" strokeWidth="2.8" />
              </g>

              <g stroke="#090d14" strokeOpacity="0.92">
                <line x1="635" y1="450" x2="965" y2="450" strokeWidth="1.1" />
                <line x1="800" y1="270" x2="800" y2="628" strokeWidth="1.1" />
              </g>

              {[-130, -98, -65, -33, 33, 65, 98, 130].map((dx) => (
                <line key={`wx-${dx}`} x1={800 + dx} y1={444} x2={800 + dx} y2={456} stroke="#090d14" strokeWidth={Math.abs(dx) === 65 || Math.abs(dx) === 130 ? 1.6 : 1.1} />
              ))}

              {[
                { dy: 34, w: 12, label: '3' },
                { dy: 68, w: 15, label: '' },
                { dy: 102, w: 19, label: '6' },
                { dy: 136, w: 23, label: '' },
                { dy: 170, w: 27, label: '9' },
              ].map((tick) => (
                <g key={`ey-${tick.dy}`}>
                  <line x1={800 - tick.w} y1={450 + tick.dy} x2={800 + tick.w} y2={450 + tick.dy} stroke="#090d14" strokeWidth="1.35" />
                  {tick.label && (
                    <text x={800 + tick.w + 9} y={454 + tick.dy} fill="#0b1018" fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                      {tick.label}
                    </text>
                  )}
                </g>
              ))}

              <circle cx="800" cy="450" r="4.4" fill="#ef4444" fillOpacity="0.34" />
              <circle cx="800" cy="450" r="2.2" fill="#ff3b30" />
            </g>
          </svg>

          <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 flex items-center gap-2.5 text-[11px] font-mono tracking-wider text-slate-300 bg-black/60 border border-white/10 px-3 py-1 rounded">
            <span className="text-amber-400 font-bold">{hud.scopeZoom}X</span>
            <span className="text-white/25">|</span>
            {hud.breathSteady ? (
              <span className="text-emerald-400 font-semibold">STEADY</span>
            ) : (
              <span>{isMobile ? 'CROUCH TO STEADY' : 'HOLD SHIFT'}</span>
            )}
          </div>
        </div>
      )}

      {/* Screen damage vignette */}
      {!hud.gpuPostFx && hud.damageFlash > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: hud.damageFlash * 0.85,
            boxShadow: 'inset 0 0 110px 28px rgba(220, 38, 38, 0.72)',
          }}
        />
      )}

      {/* Mobile touch-look drag area */}
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

      {/* Main HUD container with screen shake */}
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
        <TacticalHudPanels hud={hud} controls={controls} muted={muted} isMobile={isMobile}
          onPause={onPause} onToggleMute={onToggleMute} onToggleFullscreen={onToggleFullscreen}
          onSelectWeapon={onSelectWeapon} onReload={onReload} onThrowGrenade={onThrowGrenade} onDash={onDash}/>

        {/* Dynamic Center Crosshair & Hitmarker */}
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
                  strokeWidth="4"
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
            const crosshair = computeDynamicCrosshair({
              weaponId: hud.weaponId,
              movementState: hud.movementState,
              moveSpeedRatio: hud.moveSpeedRatio,
              recoilIntensity: hud.recoilIntensity,
              ads: hud.ads,
              scopeAlpha: hud.scopeAlpha,
              reloading: hud.reloading,
              hitMarkerActive: hitActive,
              hitMarkerIntensity: hud.hitMarker.intensity,
            });
            const baseTickColor =
              crosshair.recoilHeat > 0.15
                ? `rgba(253, ${Math.round(244 - crosshair.recoilHeat * 42)}, ${Math.round(238 - crosshair.recoilHeat * 145)}, 0.94)`
                : 'rgba(248, 250, 252, 0.94)';
            const tickColor = hitActive ? hitColor : baseTickColor;
            const hitGlow = hitActive
              ? `0 0 ${hud.hitMarker.crit || hud.hitMarker.kill ? 10 : 7}px ${hitColor}`
              : '0 0 2px rgba(0, 0, 0, 0.85)';
            const tickTransition = 'transform 75ms cubic-bezier(0.16, 1, 0.3, 1), opacity 110ms ease-out, background-color 75ms ease-out';
            const gap = crosshair.gapPx;
            const len = crosshair.tickLengthPx;
            const thick = crosshair.tickThicknessPx;
            const reloadArcRadius = 11;
            const reloadArcCircumference = 2 * Math.PI * reloadArcRadius;

            return (
              <div
                className="relative w-0 h-0"
                data-testid="dynamic-crosshair"
                data-movement-state={hud.movementState}
                data-recoil-intensity={hud.recoilIntensity.toFixed(3)}
                data-crosshair-gap={gap.toFixed(1)}
                data-crosshair-style={crosshair.style}
              >
                {hitActive && (
                  <span
                    key={`ring-${hud.hitMarker.seq}`}
                    className="animate-crosshair-ring absolute top-1/2 left-1/2 w-6 h-6 rounded-full border-2 pointer-events-none"
                    style={{ borderColor: hitColor, boxShadow: `0 0 8px ${hitColor}` }}
                  />
                )}

                {/* Reload micro-progress arc centered on reticle */}
                {hud.reloading && !scopedIn && (
                  <svg
                    viewBox="0 0 30 30"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 pointer-events-none"
                    style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}
                  >
                    <circle
                      cx="15"
                      cy="15"
                      r={reloadArcRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="15"
                      cy="15"
                      r={reloadArcRadius}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={reloadArcCircumference}
                      strokeDashoffset={reloadArcCircumference * (1 - hud.reloadProgress)}
                      transform="rotate(-90 15 15)"
                    />
                  </svg>
                )}

                {/* Center precision dot (locked to dead-center while outer ticks expand/contract) */}
                {crosshair.centerDotOpacity > 0.01 && (
                  <span
                    data-testid="crosshair-dot"
                    className="absolute top-0 left-0 rounded-full"
                    style={{
                      width: '3.5px',
                      height: '3.5px',
                      opacity: crosshair.centerDotOpacity,
                      transform: `translate3d(-50%, -50%, 0) scale(${crosshair.centerDotScale.toFixed(3)})`,
                      backgroundColor: hitActive ? hitColor : '#f8fafc',
                      boxShadow: hitGlow,
                      transition: tickTransition,
                    }}
                  />
                )}

                {/* Shotgun dynamic spread circle (GPU-composited via transform scale) */}
                {crosshair.style === 'circle' && crosshair.outerOpacity > 0.01 && (
                  <span
                    data-testid="crosshair-circle"
                    className="absolute top-0 left-0 w-10 h-10 rounded-full border-[1.75px]"
                    style={{
                      opacity: crosshair.outerOpacity * 0.72,
                      borderColor: tickColor,
                      transform: `translate3d(-50%, -50%, 0) scale(${(crosshair.circleRadiusPx / 20).toFixed(3)})`,
                      boxShadow: `0 0 2px rgba(0, 0, 0, 0.75), inset 0 0 2px rgba(0, 0, 0, 0.45)`,
                      transition: tickTransition,
                    }}
                  />
                )}

                {/* Launcher ballistic arc brackets */}
                {crosshair.style === 'bracket' && crosshair.outerOpacity > 0.01 && (
                  <>
                    <span
                      data-testid="crosshair-bracket-left"
                      className="absolute top-0 left-0 w-2.5 h-5 border-l-2 border-y-2 rounded-l-xs"
                      style={{
                        opacity: crosshair.outerOpacity,
                        borderColor: tickColor,
                        transform: `translate3d(${-(gap + 10)}px, -50%, 0)`,
                        filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))',
                        transition: tickTransition,
                      }}
                    />
                    <span
                      data-testid="crosshair-bracket-right"
                      className="absolute top-0 left-0 w-2.5 h-5 border-r-2 border-y-2 rounded-r-xs"
                      style={{
                        opacity: crosshair.outerOpacity,
                        borderColor: tickColor,
                        transform: `translate3d(${gap}px, -50%, 0)`,
                        filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))',
                        transition: tickTransition,
                      }}
                    />
                  </>
                )}

                {/* Four GPU-composited directional ticks (expand/contract smoothly via translate3d) */}
                {crosshair.style !== 'bracket' && crosshair.outerOpacity > 0.01 && (
                  <>
                    {/* Top tick */}
                    <span
                      data-testid="crosshair-tick-top"
                      className="absolute top-0 left-0 rounded-[1px]"
                      style={{
                        width: `${thick}px`,
                        height: `${len}px`,
                        opacity: crosshair.outerOpacity,
                        backgroundColor: tickColor,
                        boxShadow: hitGlow,
                        transform: `translate3d(-50%, ${-(gap + len)}px, 0)`,
                        transition: tickTransition,
                      }}
                    />
                    {/* Bottom tick */}
                    <span
                      data-testid="crosshair-tick-bottom"
                      className="absolute top-0 left-0 rounded-[1px]"
                      style={{
                        width: `${thick}px`,
                        height: `${len}px`,
                        opacity: crosshair.outerOpacity,
                        backgroundColor: tickColor,
                        boxShadow: hitGlow,
                        transform: `translate3d(-50%, ${gap}px, 0)`,
                        transition: tickTransition,
                      }}
                    />
                    {/* Left tick */}
                    <span
                      data-testid="crosshair-tick-left"
                      className="absolute top-0 left-0 rounded-[1px]"
                      style={{
                        width: `${len}px`,
                        height: `${thick}px`,
                        opacity: crosshair.outerOpacity,
                        backgroundColor: tickColor,
                        boxShadow: hitGlow,
                        transform: `translate3d(${-(gap + len)}px, -50%, 0)`,
                        transition: tickTransition,
                      }}
                    />
                    {/* Right tick */}
                    <span
                      data-testid="crosshair-tick-right"
                      className="absolute top-0 left-0 rounded-[1px]"
                      style={{
                        width: `${len}px`,
                        height: `${thick}px`,
                        opacity: crosshair.outerOpacity,
                        backgroundColor: tickColor,
                        boxShadow: hitGlow,
                        transform: `translate3d(${gap}px, -50%, 0)`,
                        transition: tickTransition,
                      }}
                    />
                  </>
                )}

                {hitActive && (
                  <svg
                    key={`x-${hud.hitMarker.seq}`}
                    viewBox="0 0 36 36"
                    className="animate-crosshair-hit absolute top-1/2 left-1/2 w-8 h-8 pointer-events-none"
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

        {/* Center Wave Banner */}
        {hud.waveBanner && !scopedIn && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none bg-[#090f18]/92 px-8 py-2 border-y-2 border-amber-400 text-center rounded shadow-xl">
            <p className="font-display font-black text-sm sm:text-base tracking-[0.2em] uppercase text-white whitespace-nowrap drop-shadow">
              {hud.waveBanner}
            </p>
          </div>
        )}

        {/* Mobile Landscape Virtual Controls */}
        {isMobile && (
          <>
            {/* Virtual Joystick */}
            <div className="absolute bottom-3 left-4 z-30 flex flex-col items-center gap-2 pointer-events-auto touch-none opacity-70">
              <button
                type="button"
                onPointerDown={handleSprintToggleClick}
                aria-label="Toggle sprint"
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                  sprintLocked || hud.sprinting
                    ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                    : 'bg-black/50 border-white/20 text-slate-200'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <circle cx="14.5" cy="4.5" r="2" />
                  <path d="M10.5 8.5l2.5-.8 3.2 2.3 2.8-.6.4 1.8-3.6.8-2.2-1.5-1.2 2.4 2.7 2.4-.9 4.7-1.9-.3.7-3.4-2.4-2.1-1.7 2.8-3.4 1.6-.8-1.7 2.8-1.3 2.4-4-2.1-.6-1.7 2.3-1.5-1.1 2.3-3.1 4.6 1.2z" />
                </svg>
              </button>

              <div
                ref={joyBaseRef}
                onPointerDown={handleJoyDown}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyUp}
                onPointerCancel={handleJoyUp}
                className="relative w-24 h-24 rounded-full bg-black/40 border border-white/25 flex items-center justify-center touch-none"
              >
                <div
                  className="w-10 h-10 rounded-full bg-white/30 border border-white/50 shadow-inner pointer-events-none"
                  style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
                />
              </div>
            </div>

            {/* Fire and Scope Buttons */}
            <div className="absolute bottom-3 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none touch-none opacity-80">
              {['railpistol', 'marksman'].includes(hud.weaponId) && hud.ads && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onToggleScopeZoom();
                  }}
                  aria-label="Toggle scope zoom"
                  className="pointer-events-auto w-9 h-9 rounded-full bg-black/70 border border-amber-400 text-amber-300 font-mono font-bold text-xs flex items-center justify-center"
                >
                  {hud.scopeZoom}x
                </button>
              )}

              <div className="flex items-center gap-2.5 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={handleFireDown}
                  onPointerMove={handleFireMove}
                  onPointerUp={handleFireUp}
                  onPointerCancel={handleFireUp}
                  aria-label="Fire weapon"
                  className="w-14 h-14 rounded-full bg-amber-500/35 active:bg-amber-500/65 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_16px_rgba(251,191,36,0.3)] touch-none"
                >
                  <svg viewBox="0 0 28 28" className="w-6 h-6 text-white" fill="currentColor">
                    <path d="M5 12h13l4 2-4 2H5v-4zm15-4l4 2-2 1-3-1 1-2zm0 12l-1-2 3-1 2 1-4 2z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onTouchAdsToggle();
                  }}
                  aria-label="Toggle Scope ADS"
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${
                    hud.ads
                      ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                      : 'bg-black/60 border-white/35 text-white'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="3" x2="12" y2="7" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <line x1="3" y1="12" x2="7" y2="12" />
                    <line x1="17" y1="12" x2="21" y2="12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onToggleCrouch();
                  }}
                  aria-label="Toggle crouch"
                  className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                    hud.crouching
                      ? 'bg-amber-500/35 border-amber-400 text-amber-300'
                      : 'bg-black/60 border-white/25 text-slate-100'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
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
                  className="w-9 h-9 rounded-full bg-black/60 active:bg-white/20 border border-white/25 text-slate-100 flex items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
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
