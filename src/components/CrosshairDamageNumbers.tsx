import React from 'react';
import { getDamagePopStyle } from '../game/damageNumbers';
import { CrosshairDamagePop } from '../game/types';

export interface CrosshairDamageNumbersProps {
  pops: CrosshairDamagePop[];
}

const ShieldIcon: React.FC<{ broken?: boolean; color: string }> = ({ broken, color }) => (
  <svg
    viewBox="0 0 14 14"
    className="w-3 h-3 shrink-0"
    style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.95))' }}
    aria-hidden="true"
  >
    <path
      d="M7 1.2L2.1 3.1v3.7c0 3.1 2.1 5.1 4.9 6 2.8-.9 4.9-2.9 4.9-6V3.1L7 1.2z"
      fill={color}
      fillOpacity={broken ? 0.25 : 0.85}
      stroke={color}
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    {broken && (
      <path
        d="M7.6 2.6L5.8 6.4l2.1.5-1.5 4.4"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

const TEXT_OUTLINE =
  '0 1px 2px rgba(4, 7, 12, 0.98), 0 0 4px rgba(4, 7, 12, 0.92), 1px 0 0 rgba(4, 7, 12, 0.9), -1px 0 0 rgba(4, 7, 12, 0.9), 0 -1px 0 rgba(4, 7, 12, 0.9)';

/**
 * Floating tactical damage numbers anchored near the crosshair.
 * Differentiates Armor/Shield hits (tactical cyan + shield glyph) from Health hits
 * (crimson-coral body / amber-gold headshot), and splits armor-break overflow hits cleanly.
 */
export const CrosshairDamageNumbers: React.FC<CrosshairDamageNumbersProps> = React.memo(({ pops }) => {
  if (pops.length === 0) return null;

  return (
    <div
      data-testid="crosshair-damage-numbers"
      className="absolute top-0 left-0 w-0 h-0 pointer-events-none select-none z-40"
      aria-hidden="true"
    >
      {pops.map((pop) => {
        const style = getDamagePopStyle(pop);
        const cssVars = {
          '--dmg-x': `${pop.offsetX}px`,
          '--dmg-y': `${pop.offsetY}px`,
          '--dmg-drift-x': `${pop.driftX}px`,
          '--dmg-scale': `${style.scale}`,
          animationDuration: `${Math.round(pop.ttl * 1000)}ms`,
        } as React.CSSProperties;

        return (
          <div
            key={pop.id}
            data-testid="damage-number-pop"
            data-damage-kind={pop.kind}
            data-armor-broken={pop.armorBroken ? 'true' : 'false'}
            data-headshot={pop.isHeadshot ? 'true' : 'false'}
            className="animate-crosshair-damage absolute top-0 left-0 inline-flex items-center gap-1 whitespace-nowrap font-display font-extrabold font-mono-num leading-none tracking-tight will-change-transform"
            style={cssVars}
          >
            {pop.kind === 'armor' && (
              <span
                className="inline-flex items-center gap-0.5 text-[15px]"
                style={{
                  color: style.armorColor,
                  textShadow: `${TEXT_OUTLINE}, 0 0 10px ${style.armorGlow}`,
                }}
              >
                <ShieldIcon broken={pop.armorBroken} color={style.armorColor} />
                <span>{pop.armorDamage}</span>
                {pop.isHeadshot && (
                  <span className="text-[12px] text-[#fbbf24] font-black ml-px">!</span>
                )}
              </span>
            )}

            {pop.kind === 'health' && (
              <span
                className="inline-flex items-center gap-0.5 text-[16px]"
                style={{
                  color: style.healthColor,
                  textShadow: `${TEXT_OUTLINE}, 0 0 10px ${style.healthGlow}`,
                }}
              >
                <span>{pop.healthDamage}</span>
                {pop.isHeadshot && <span className="text-[13px] font-black">!</span>}
              </span>
            )}

            {pop.kind === 'mixed' && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-0.5 text-[13px]"
                  style={{
                    color: style.armorColor,
                    textShadow: `${TEXT_OUTLINE}, 0 0 9px ${style.armorGlow}`,
                  }}
                >
                  <ShieldIcon broken={pop.armorBroken} color={style.armorColor} />
                  <span>{pop.armorDamage}</span>
                </span>
                <span
                  className="inline-flex items-center gap-0.5 text-[16px]"
                  style={{
                    color: style.healthColor,
                    textShadow: `${TEXT_OUTLINE}, 0 0 10px ${style.healthGlow}`,
                  }}
                >
                  <span>{pop.healthDamage}</span>
                  {pop.isHeadshot && <span className="text-[13px] font-black">!</span>}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});
