import React from 'react';
import { GrenadeId, WeaponId } from '../game/types';

export const PistolSvg: React.FC<{ className?: string }> = ({ className = 'w-16 h-8' }) => (
  <svg viewBox="0 0 80 40" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8 8h54v2h6v10H39l-2 5 8 11H30l-8-13h-6v-5H8V8zm23 13 3 5h3l-3-5h-3z" fillRule="evenodd"/>
  </svg>
);

export const CarbineSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-8' }) => (
  <svg viewBox="0 0 100 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 12h15l3-3h14V6h12v3h21v2h19v2h10v3H68l-2 3H48l-1 12H37l-1-12h-5l-2 8h-5l1-9H12l-3 6H3V12zm35-4h6V6h-6v2zm30 4h15v3H68v-3z"/>
  </svg>
);

export const SniperSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-8' }) => (
  <svg viewBox="0 0 110 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="M2 15h12l6-4h54l3 4h26l4 2-4 2H80l-2 7H66l-2-7H24l-4 7H12l2-7H2V15zm32-3h28v3H34v-3z" />
  </svg>
);

export const ShotgunSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-8' }) => (
  <svg viewBox="0 0 100 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4 13h22l2 2h46l3-1h16l4 2-4 2H80l-3 8H65l-2-6H32l-3 4H14l2-5H4V13zm30 1h32v2H34v-2z" />
  </svg>
);

export const SmgSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 80 36" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6 12h24l3-3h26l3 3h12l3 3-3 3H64l-2 12H52l-2-12H30l-4 8H16l2-6H6V12zm22-1h22v3H28v-3z" />
  </svg>
);

export const MachineGunSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-8' }) => (
  <svg viewBox="0 0 100 36" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 14h14l3-4h15V5h12v5h25v3h21v2h5v3H73l9 14h-3l-10-13-4 13h-3l4-14H51v11H37v-9h-8l-3 9h-5l1-10H12l-4 6H3V14z"/>
  </svg>
);

export const RpgSvg: React.FC<{ className?: string }> = ({ className = 'w-22 h-8' }) => (
  <svg viewBox="0 0 100 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="m2 16 17-6 20 3h17V5h3v8h18l13-4 8 3v12l-8-4H63v8h-5V19H43l-2 9h-5v-9H19L2 16z"/>
  </svg>
);

export const GrenadeSvg: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="14" r="7" />
    <rect x="10" y="3" width="4" height="4" rx="1" />
  </svg>
);

export function WeaponSilhouette({
  weaponId,
  className,
}: {
  weaponId: WeaponId | GrenadeId | string;
  className?: string;
}) {
  switch (weaponId) {
    case 'frag':
    case 'smoke':
    case 'molotov':
    case 'flashbang':
      return <GrenadeSvg className={className} />;
    case 'railpistol':
      return <SniperSvg className={className} />;
    case 'shotgun':
      return <ShotgunSvg className={className} />;
    case 'smg':
      return <SmgSvg className={className} />;
    case 'machinegun':
      return <MachineGunSvg className={className} />;
    case 'marksman':
      return <SniperSvg className={className} />;
    case 'usp':
    case 'deagle':
    case 'glock':
      return <PistolSvg className={className} />;
    case 'rpg':
    case 'grenadelauncher':
      return <RpgSvg className={className} />;
    case 'carbine':
    default:
      return <CarbineSvg className={className} />;
  }
}

export const WeaponCardVisual: React.FC<{
  weaponId: WeaponId | GrenadeId | string;
  alt: string;
  imageUrl: string;
  className?: string;
}> = ({ weaponId, alt, imageUrl, className = 'max-h-full max-w-full object-contain filter drop-shadow' }) => {
  const [imgError, setImgError] = React.useState(false);

  if (imgError) {
    return (
      <div className="flex items-center justify-center p-1 text-amber-400/90">
        <WeaponSilhouette weaponId={weaponId} className="w-16 h-8 drop-shadow" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setImgError(true)}
    />
  );
};
