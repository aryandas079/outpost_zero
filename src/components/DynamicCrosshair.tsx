import React, { useEffect, useRef } from 'react';
import { computeDynamicCrosshair } from '../game/crosshair';
import {
  CrosshairDamagePop,
  DamageArcState,
  HitMarkerState,
  PlayerMovementState,
  WeaponId,
} from '../game/types';
import { CrosshairDamageNumbers } from './CrosshairDamageNumbers';

export interface DynamicCrosshairProps {
  weaponId: WeaponId;
  movementState: PlayerMovementState;
  moveSpeedRatio: number;
  recoilIntensity: number;
  ads: boolean;
  scopeAlpha: number;
  reloading: boolean;
  reloadProgress: number;
  hitMarker: HitMarkerState;
  damagePops: CrosshairDamagePop[];
  damageArc: DamageArcState;
  crosshairColor?: string;
  crosshairSize?: number;
}

/**
 * GPU-composited dynamic tactical crosshair that expands on running/sprinting/jumping/recoil
 * and contracts crisply when crouching or recovering between bursts.
 */
export const DynamicCrosshair: React.FC<DynamicCrosshairProps> = React.memo(
  ({
    weaponId,
    movementState,
    moveSpeedRatio,
    recoilIntensity,
    ads,
    scopeAlpha,
    reloading,
    reloadProgress,
    hitMarker,
    damagePops,
    damageArc,
    crosshairColor,
    crosshairSize = 1.0,
  }) => {
    const scopedIn = scopeAlpha > 0.02;
    const hitActive = hitMarker.active;
    const hitColor = hitMarker.armorBreak
      ? '#7ce8ff'
      : hitMarker.armor
      ? '#57d7ee'
      : hitMarker.crit
      ? '#fbbf24'
      : hitMarker.kill
      ? '#ef4444'
      : '#ff5e5b';

    const crosshair = computeDynamicCrosshair({
      weaponId,
      movementState,
      moveSpeedRatio,
      recoilIntensity,
      ads,
      scopeAlpha,
      reloading,
      hitMarkerActive: hitActive,
      hitMarkerIntensity: hitMarker.intensity,
    });

    // Asymmetric spring smoothing: fast outward punch on recoil/sprint, smooth controlled settle on crouch/recovery
    const targetRef = useRef({
      gap: crosshair.gapPx,
      len: crosshair.tickLengthPx,
      circleRadius: crosshair.circleRadiusPx,
    });
    const currentRef = useRef({
      gap: crosshair.gapPx,
      len: crosshair.tickLengthPx,
      circleRadius: crosshair.circleRadiusPx,
    });

    const topTickRef = useRef<HTMLSpanElement | null>(null);
    const bottomTickRef = useRef<HTMLSpanElement | null>(null);
    const leftTickRef = useRef<HTMLSpanElement | null>(null);
    const rightTickRef = useRef<HTMLSpanElement | null>(null);
    const circleRef = useRef<HTMLSpanElement | null>(null);
    const leftBracketRef = useRef<HTMLSpanElement | null>(null);
    const rightBracketRef = useRef<HTMLSpanElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    targetRef.current.gap = crosshair.gapPx;
    targetRef.current.len = crosshair.tickLengthPx;
    targetRef.current.circleRadius = crosshair.circleRadiusPx;

    useEffect(() => {
      let rafId = 0;
      let lastTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const cur = currentRef.current;
        const tgt = targetRef.current;

        // Snappier expansion (lambda 32) when firing or sprinting; composed contraction (lambda 16) when crouching or recovering
        const gapLambda = tgt.gap > cur.gap ? 32 : 16;
        const lenLambda = tgt.len > cur.len ? 28 : 14;
        const gapAlpha = 1 - Math.exp(-gapLambda * dt);
        const lenAlpha = 1 - Math.exp(-lenLambda * dt);

        cur.gap += (tgt.gap - cur.gap) * gapAlpha;
        cur.len += (tgt.len - cur.len) * lenAlpha;
        cur.circleRadius += (tgt.circleRadius - cur.circleRadius) * gapAlpha;

        const g = cur.gap;
        const l = cur.len;

        if (topTickRef.current) {
          topTickRef.current.style.height = `${l.toFixed(2)}px`;
          topTickRef.current.style.transform = `translate3d(-50%, ${-(g + l).toFixed(2)}px, 0)`;
        }
        if (bottomTickRef.current) {
          bottomTickRef.current.style.height = `${l.toFixed(2)}px`;
          bottomTickRef.current.style.transform = `translate3d(-50%, ${g.toFixed(2)}px, 0)`;
        }
        if (leftTickRef.current) {
          leftTickRef.current.style.width = `${l.toFixed(2)}px`;
          leftTickRef.current.style.transform = `translate3d(${-(g + l).toFixed(2)}px, -50%, 0)`;
        }
        if (rightTickRef.current) {
          rightTickRef.current.style.width = `${l.toFixed(2)}px`;
          rightTickRef.current.style.transform = `translate3d(${g.toFixed(2)}px, -50%, 0)`;
        }
        if (circleRef.current) {
          circleRef.current.style.transform = `translate3d(-50%, -50%, 0) scale(${(cur.circleRadius / 20).toFixed(3)})`;
        }
        if (leftBracketRef.current) {
          leftBracketRef.current.style.transform = `translate3d(${-(g + 10).toFixed(2)}px, -50%, 0)`;
        }
        if (rightBracketRef.current) {
          rightBracketRef.current.style.transform = `translate3d(${g.toFixed(2)}px, -50%, 0)`;
        }

        rafId = requestAnimationFrame(step);
      };

      rafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(rafId);
    }, []);

    const baseTickColor = crosshairColor
      ? crosshairColor
      : crosshair.recoilHeat > 0.12
        ? `rgba(253, ${Math.round(240 - crosshair.recoilHeat * 56)}, ${Math.round(220 - crosshair.recoilHeat * 165)}, 0.96)`
        : crosshair.crouchStabilized
        ? 'rgba(236, 253, 245, 0.98)'
        : 'rgba(248, 250, 252, 0.94)';
    const tickColor = hitActive ? hitColor : baseTickColor;
    const hitGlow = hitActive
      ? `0 0 ${hitMarker.crit || hitMarker.kill ? 10 : 7}px ${hitColor}`
      : '0 0 2px rgba(0, 0, 0, 0.9)';
    const opacityTransition = 'opacity 100ms ease-out, background-color 80ms ease-out, border-color 80ms ease-out';

    const gap = crosshair.gapPx;
    const len = crosshair.tickLengthPx;
    const thick = crosshair.tickThicknessPx;
    const reloadArcRadius = 11;
    const reloadArcCircumference = 2 * Math.PI * reloadArcRadius;

    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
        {/* Directional incoming damage arc */}
        {damageArc.active && (
          <div
            className="absolute top-1/2 left-1/2 w-28 h-28 -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `translate(-50%, -50%) rotate(${damageArc.angleRad}rad)`,
              opacity: damageArc.intensity,
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

        <div
          ref={containerRef}
          className="relative w-0 h-0"
          style={{ transform: crosshairSize !== 1 ? `scale(${crosshairSize})` : undefined }}
          data-testid="dynamic-crosshair"
          data-movement-state={movementState}
          data-recoil-intensity={recoilIntensity.toFixed(3)}
          data-crosshair-gap={gap.toFixed(1)}
          data-crosshair-style={crosshair.style}
        >
          {/* Hitmarker shock ring */}
          {hitActive && (
            <span
              key={`ring-${hitMarker.seq}`}
              className="animate-crosshair-ring absolute top-1/2 left-1/2 w-6 h-6 rounded-full border-2 pointer-events-none"
              style={{ borderColor: hitColor, boxShadow: `0 0 8px ${hitColor}` }}
            />
          )}

          {/* Reload micro-progress arc centered on reticle */}
          {reloading && !scopedIn && (
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
                stroke="#f5b301"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={reloadArcCircumference}
                strokeDashoffset={reloadArcCircumference * (1 - reloadProgress)}
                transform="rotate(-90 15 15)"
              />
            </svg>
          )}

          {/* Center precision dot (stays anchored to dead-center while outer ticks expand/shrink) */}
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
                transition: 'transform 70ms cubic-bezier(0.16, 1, 0.3, 1), opacity 100ms ease-out',
              }}
            />
          )}

          {/* Shotgun dynamic spread circle */}
          {crosshair.style === 'circle' && crosshair.outerOpacity > 0.01 && (
            <span
              ref={circleRef}
              data-testid="crosshair-circle"
              className="absolute top-0 left-0 w-10 h-10 rounded-full border-[1.75px]"
              style={{
                opacity: crosshair.outerOpacity * 0.78,
                borderColor: tickColor,
                transform: `translate3d(-50%, -50%, 0) scale(${(crosshair.circleRadiusPx / 20).toFixed(3)})`,
                boxShadow: '0 0 2px rgba(0, 0, 0, 0.8), inset 0 0 2px rgba(0, 0, 0, 0.45)',
                transition: opacityTransition,
              }}
            />
          )}

          {/* Launcher ballistic arc brackets */}
          {crosshair.style === 'bracket' && crosshair.outerOpacity > 0.01 && (
            <>
              <span
                ref={leftBracketRef}
                data-testid="crosshair-bracket-left"
                className="absolute top-0 left-0 w-2.5 h-5 border-l-2 border-y-2 rounded-l-xs"
                style={{
                  opacity: crosshair.outerOpacity,
                  borderColor: tickColor,
                  transform: `translate3d(${-(gap + 10)}px, -50%, 0)`,
                  filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))',
                  transition: opacityTransition,
                }}
              />
              <span
                ref={rightBracketRef}
                data-testid="crosshair-bracket-right"
                className="absolute top-0 left-0 w-2.5 h-5 border-r-2 border-y-2 rounded-r-xs"
                style={{
                  opacity: crosshair.outerOpacity,
                  borderColor: tickColor,
                  transform: `translate3d(${gap}px, -50%, 0)`,
                  filter: 'drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))',
                  transition: opacityTransition,
                }}
              />
            </>
          )}

          {/* Four GPU-composited directional ticks */}
          {crosshair.style !== 'bracket' && crosshair.outerOpacity > 0.01 && (
            <>
              <span
                ref={topTickRef}
                data-testid="crosshair-tick-top"
                className="absolute top-0 left-0 rounded-[1px]"
                style={{
                  width: `${thick}px`,
                  height: `${len}px`,
                  opacity: crosshair.outerOpacity,
                  backgroundColor: tickColor,
                  boxShadow: hitGlow,
                  transform: `translate3d(-50%, ${-(gap + len)}px, 0)`,
                  transition: opacityTransition,
                }}
              />
              <span
                ref={bottomTickRef}
                data-testid="crosshair-tick-bottom"
                className="absolute top-0 left-0 rounded-[1px]"
                style={{
                  width: `${thick}px`,
                  height: `${len}px`,
                  opacity: crosshair.outerOpacity,
                  backgroundColor: tickColor,
                  boxShadow: hitGlow,
                  transform: `translate3d(-50%, ${gap}px, 0)`,
                  transition: opacityTransition,
                }}
              />
              <span
                ref={leftTickRef}
                data-testid="crosshair-tick-left"
                className="absolute top-0 left-0 rounded-[1px]"
                style={{
                  width: `${len}px`,
                  height: `${thick}px`,
                  opacity: crosshair.outerOpacity,
                  backgroundColor: tickColor,
                  boxShadow: hitGlow,
                  transform: `translate3d(${-(gap + len)}px, -50%, 0)`,
                  transition: opacityTransition,
                }}
              />
              <span
                ref={rightTickRef}
                data-testid="crosshair-tick-right"
                className="absolute top-0 left-0 rounded-[1px]"
                style={{
                  width: `${len}px`,
                  height: `${thick}px`,
                  opacity: crosshair.outerOpacity,
                  backgroundColor: tickColor,
                  boxShadow: hitGlow,
                  transform: `translate3d(${gap}px, -50%, 0)`,
                  transition: opacityTransition,
                }}
              />
            </>
          )}

          {/* Hitmarker X confirmation */}
          {hitActive && (
            <svg
              key={`x-${hitMarker.seq}`}
              viewBox="0 0 36 36"
              className="animate-crosshair-hit absolute top-1/2 left-1/2 w-8 h-8 pointer-events-none"
              style={{ filter: `drop-shadow(0 0 4px ${hitColor})` }}
            >
              <g
                stroke={hitColor}
                strokeWidth={hitMarker.crit || hitMarker.kill || hitMarker.armorBreak ? '2.8' : '2.2'}
                strokeLinecap="round"
              >
                <line x1="6" y1="6" x2="13" y2="13" />
                <line x1="30" y1="6" x2="23" y2="13" />
                <line x1="6" y1="30" x2="13" y2="23" />
                <line x1="30" y1="30" x2="23" y2="23" />
              </g>
            </svg>
          )}

          {/* Floating armor vs health damage numbers near crosshair */}
          <CrosshairDamageNumbers pops={damagePops} />
        </div>
      </div>
    );
  },
);
