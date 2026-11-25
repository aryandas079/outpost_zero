import React from 'react';

interface BrandEmblemProps {
  className?: string;
}

/**
 * Geometric Winged Shield Emblem matching OUTPOST ZERO reference HUD & POI insignia.
 */
export const BrandEmblem: React.FC<BrandEmblemProps> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
    <path
      d="M5 9 L16 14 L20 7 L24 14 L35 9 L28 24 L20 35 L12 24 Z"
      fill="#F2F4F5"
      stroke="#10161D"
      strokeWidth="1.2"
    />
    <path d="M13 17 L20 13 L27 17 L20 29 Z" fill="#10161D" />
    <path d="M17 19 L20 17 L23 19 L20 25 Z" fill="#F5B301" />
  </svg>
);

export const BrandHeaderLockup: React.FC<{
  subtitle?: string;
  compact?: boolean;
}> = ({ subtitle = 'BATTLE ROYALE', compact = false }) => (
  <div className="inline-flex items-center gap-2.5 select-none">
    <BrandEmblem className={compact ? 'w-6 h-6 shrink-0' : 'w-8 h-8 shrink-0'} />
    <div className="leading-none">
      <div className="text-[11px] font-black tracking-[0.14em] text-[#F2F4F5] uppercase">OUTPOST</div>
      <div className="text-sm font-black tracking-[0.16em] text-[#F5B301] uppercase -mt-0.5">ZERO</div>
    </div>
    <div className="h-6 w-px bg-white/18 mx-0.5" />
    <div className="leading-tight">
      <div className="text-[10px] font-bold tracking-[0.18em] text-[#F2F4F5] uppercase">{subtitle}</div>
      <div className="text-[9px] font-mono tracking-wider text-[#A8B0B8] uppercase">SOLO · 24 PLAYERS</div>
    </div>
  </div>
);
