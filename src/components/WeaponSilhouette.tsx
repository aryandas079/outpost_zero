import React from 'react';
import { GrenadeId, WeaponId } from '../game/types';

export const PistolSvg: React.FC<{ className?: string }> = ({ className = 'w-14 h-7' }) => (
  <svg viewBox="0 0 88 44" fill="currentColor" className={className} aria-hidden="true">
    {/* Compact Glock 17: flat squared slide, polymer frame, trigger guard & angled grip */}
    <path d="M14 11h50v2h3v7H42l-2 4 8 14H33l-7-14h-8v-4h-4v-9zm17 11 3 5h4l-3-5h-4z" fillRule="evenodd" />
  </svg>
);

export const DeagleSvg: React.FC<{ className?: string }> = ({ className = 'w-16 h-7' }) => (
  <svg viewBox="0 0 96 44" fill="currentColor" className={className} aria-hidden="true">
    {/* Iconic Desert Eagle: long heavy tapered barrel, beveled slide, spur hammer & stout grip */}
    <path d="M10 10h66l4 3v5H56l-2 4H40l-2 4 9 13H31l-8-13h-8v-5l-5-3v-8zm5-2h8v2h-8V8zm52 4h7v2h-7v-2zm-34 11 3.5 5h4l-3.5-5h-4z" fillRule="evenodd" />
  </svg>
);

export const UspSvg: React.FC<{ className?: string }> = ({ className = 'w-16 h-7' }) => (
  <svg viewBox="0 0 96 44" fill="currentColor" className={className} aria-hidden="true">
    {/* Tactical USP .45 w/ suppressor & under-rail */}
    <path d="M12 11h44v3h28v5H56v2H40l-2 4 7 13H31l-7-13h-8v-5h-4v-9zm19 11 3 5h4l-3-5h-4z" fillRule="evenodd" />
  </svg>
);

export const RailPistolSvg: React.FC<{ className?: string }> = ({ className = 'w-16 h-7' }) => (
  <svg viewBox="0 0 96 44" fill="currentColor" className={className} aria-hidden="true">
    {/* Futuristic split-rail energy pistol */}
    <path d="M12 10h64l4 2v3H42v2h34v3H42l-2 4 8 14H32l-8-14h-8v-4h-4v-10zm19 12 3 5h4l-3-5h-4z" fillRule="evenodd" />
  </svg>
);

export const CarbineSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 112 40" fill="currentColor" className={className} aria-hidden="true">
    {/* M4A1 silhouette w/ optic, handguard rails, curved mag & collapsible stock */}
    <path d="M4 16h14l4-4h16V8h14v4h24v2h22v2h10v3H76l-2 3H55l-2 13H43l-1-13h-7l-3 9h-6l2-10H14l-4 7H4V16zm37-6h8V8h-8v2zm36 4h18v3H77v-3z" fillRule="evenodd" />
  </svg>
);

export const SniperSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 120 40" fill="currentColor" className={className} aria-hidden="true">
    {/* Long precision bolt-action sniper w/ elevated scope & bipod */}
    <path d="M2 18h14l7-4h18V9h24v4h14l3 4h32l4 2-4 2H82l-3 8H68l-2-8H26l-5 8H12l3-8H2v-3zm41-8h20v3H43v-3z" fillRule="evenodd" />
  </svg>
);

export const ShotgunSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 112 40" fill="currentColor" className={className} aria-hidden="true">
    {/* Tactical pump shotgun silhouette */}
    <path d="M4 17h20l3 2h54l4-1h18l4 2-4 2H84l-3 9H70l-3-7H34l-4 5H15l3-6H4v-6zm34 1h36v2.5H38V18z" fillRule="evenodd" />
  </svg>
);

export const SmgSvg: React.FC<{ className?: string }> = ({ className = 'w-18 h-8' }) => (
  <svg viewBox="0 0 92 40" fill="currentColor" className={className} aria-hidden="true">
    {/* Compact tactical SMG silhouette */}
    <path d="M8 14h22l4-4h28l4 4h14l4 3-4 3H68l-3 14H55l-2-14H33l-5 9H17l3-7H8v-8zm25-1h22v3H33v-3z" fillRule="evenodd" />
  </svg>
);

export const MachineGunSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 112 40" fill="currentColor" className={className} aria-hidden="true">
    {/* Heavy LMG / SAW w/ box mag & bipod */}
    <path d="M4 15h14l4-4h16V6h14v5h28v3h22v2h6v3H80l9 15h-3.5L74 20l-4.5 14H66l4.5-15H55v12H40V21h-9l-3 10h-6l2-11H13l-4 7H4V15z" fillRule="evenodd" />
  </svg>
);

export const RpgSvg: React.FC<{ className?: string }> = ({ className = 'w-20 h-8' }) => (
  <svg viewBox="0 0 112 40" fill="currentColor" className={className} aria-hidden="true">
    <path d="m4 19 18-7 22 3h16V7h4v8h20l14-4 8 3v14l-8-4H64v9h-5V22H44l-2 10h-6v-9H22L4 19z" fillRule="evenodd" />
  </svg>
);

export const GrenadeSvg: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path d="M13 4h6v3l2 2h-10l2-2V4z" fill="#94A3B8" />
    <path d="M19 6c3 0 4 2 4 5h-2c0-2-.5-3-2-3V6z" fill="#CBD5E1" />
    <polygon points="16,9 24,13 25,22 20,28 12,28 7,22 8,13" fill="#5D7B40" />
    <polygon points="16,9 24,13 16,18 8,13" fill="#769A52" />
    <polygon points="16,18 24,13 25,22 16,28" fill="#4B6632" />
  </svg>
);

export const MedkitIconSvg: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 36 32" className={className} aria-hidden="true">
    <rect x="12" y="3" width="12" height="5" rx="1.5" fill="none" stroke="#CBD5E1" strokeWidth="2.4" />
    <rect x="3" y="7" width="30" height="21" rx="3" fill="#F1F5F9" />
    <polygon points="3,28 33,28 33,21 3,23" fill="#CBD5E1" />
    <path d="M15.5 11.5h5v4h4v5h-4v4h-5v-4h-4v-5h4v-4z" fill="#E11D48" />
  </svg>
);

export const ArmorPlateIconSvg: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 28 32" className={className} aria-hidden="true">
    <polygon points="14,2 25,6 23,19 14,29 5,19 3,6" fill="#38BDF8" />
    <polygon points="14,2 25,6 23,19 14,29" fill="#0284C7" />
    <polygon points="14,6 20,9 19,17 14,24" fill="#7DD3FC" opacity="0.55" />
  </svg>
);

export const AmmoIconSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
    <path d="M5 6l1.5-4L8 6v11H5V6zm4.5 0L11 2l1.5 4v11h-3V6zm4.5 0L15.5 2 17 6v11h-3V6z" />
  </svg>
);

export const AlivePlayerIconSvg: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <circle cx="12" cy="7.5" r="4" />
    <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5H4.5z" />
  </svg>
);

export const SkullElimIconSvg: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2.5C7 2.5 4 6 4 10.5c0 2.8 1.4 4.8 3 6v3.5h2.5V17.5h1.5V20h2v-2.5h1.5V20H17v-3.5c1.6-1.2 3-3.2 3-6C20 6 17 2.5 12 2.5zM9 12a1.8 1.8 0 1 1 0-3.6A1.8 1.8 0 0 1 9 12zm6 0a1.8 1.8 0 1 1 0-3.6A1.8 1.8 0 0 1 15 12z" />
  </svg>
);

export const StaminaBoltSvg: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 20 24" fill="currentColor" className={className} aria-hidden="true">
    <polygon points="11.5,1 3,13.5 9.5,13.5 8,23 17.5,10 10.5,10" />
  </svg>
);

export const LowPolySoldierAvatar: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" fill="#323F4D" />
    {/* Faceted background triangles */}
    <polygon points="0,0 64,0 32,26" fill="#3B4958" />
    <polygon points="0,64 64,64 32,38" fill="#25303B" />
    {/* Shoulders & vest */}
    <polygon points="8,64 20,44 44,44 56,64" fill="#4B5D3E" />
    <polygon points="20,44 32,48 44,44 40,64 24,64" fill="#3B4B30" />
    {/* Tactical scarf / collar */}
    <polygon points="22,44 32,50 42,44 38,39 26,39" fill="#9A4939" />
    {/* Low-poly head & jawline */}
    <polygon points="22,22 42,22 41,37 32,42 23,37" fill="#D5A680" />
    <polygon points="32,22 42,22 41,37 32,42" fill="#B88762" />
    {/* Tactical goggles & visor */}
    <polygon points="21,23 43,23 42,29 22,29" fill="#1E293B" />
    <polygon points="23,24 31,24 30,28 23,28" fill="#38BDF8" opacity="0.7" />
    <polygon points="33,24 41,24 41,28 34,28" fill="#38BDF8" opacity="0.55" />
    {/* Low-poly military helmet */}
    <polygon points="17,23 22,10 42,10 47,23" fill="#5D7447" />
    <polygon points="32,10 42,10 47,23 32,23" fill="#465934" />
    <polygon points="19,17 45,17 47,23 17,23" fill="#6E8755" />
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
      return <RailPistolSvg className={className} />;
    case 'shotgun':
      return <ShotgunSvg className={className} />;
    case 'smg':
      return <SmgSvg className={className} />;
    case 'machinegun':
      return <MachineGunSvg className={className} />;
    case 'marksman':
      return <SniperSvg className={className} />;
    case 'deagle':
      return <DeagleSvg className={className} />;
    case 'usp':
      return <UspSvg className={className} />;
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
