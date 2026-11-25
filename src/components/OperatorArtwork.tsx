import React from 'react';
import { OperatorId } from '../game/operators';

interface OperatorPortraitProps {
  operatorId: OperatorId;
  active?: boolean;
  size?: 'hero' | 'card' | 'avatar';
  className?: string;
}

const PALETTES: Record<
  OperatorId,
  {
    rim: string;
    helmet: string;
    helmetDark: string;
    gear: string;
    gearLight: string;
    visor: string;
    accent: string;
    bgGlow: string;
  }
> = {
  nomad: {
    rim: '#c2a65a',
    helmet: '#4b4e38',
    helmetDark: '#2b2e22',
    gear: '#383d30',
    gearLight: '#565c47',
    visor: '#141920',
    accent: '#f5b301',
    bgGlow: 'rgba(180, 152, 72, 0.22)',
  },
  viper: {
    rim: '#6e8c82',
    helmet: '#2a333b',
    helmetDark: '#192027',
    gear: '#232c33',
    gearLight: '#3c4952',
    visor: '#0f171d',
    accent: '#34d399',
    bgGlow: 'rgba(72, 148, 128, 0.2)',
  },
  hawk: {
    rim: '#688ea8',
    helmet: '#313a42',
    helmetDark: '#1d242a',
    gear: '#283138',
    gearLight: '#43515c',
    visor: '#111922',
    accent: '#38bdf8',
    bgGlow: 'rgba(78, 134, 178, 0.2)',
  },
  rook: {
    rim: '#948a78',
    helmet: '#2f3237',
    helmetDark: '#1b1d22',
    gear: '#25292f',
    gearLight: '#424750',
    visor: '#0c1015',
    accent: '#fb7185',
    bgGlow: 'rgba(148, 126, 112, 0.2)',
  },
};

export const OperatorPortrait: React.FC<OperatorPortraitProps> = ({
  operatorId,
  active = true,
  size = 'hero',
  className = '',
}) => {
  const p = PALETTES[operatorId];
  const uid = `op-${operatorId}-${size}`;

  return (
    <svg
      viewBox="0 0 360 400"
      className={className}
      role="img"
      aria-label={`${operatorId} tactical operator portrait`}
    >
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor={active ? p.bgGlow : 'rgba(148,163,184,0.08)'} />
          <stop offset="70%" stopColor="rgba(11,16,23,0)" />
        </radialGradient>
        <linearGradient id={`${uid}-helmet`} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor={p.helmet} />
          <stop offset="55%" stopColor={p.helmetDark} />
          <stop offset="100%" stopColor="#12161b" />
        </linearGradient>
        <linearGradient id={`${uid}-gear`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.gearLight} />
          <stop offset="50%" stopColor={p.gear} />
          <stop offset="100%" stopColor="#11151b" />
        </linearGradient>
        <linearGradient id={`${uid}-fade`} x1="0%" y1="72%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0b0f16" stopOpacity="0" />
          <stop offset="100%" stopColor="#0b0f16" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Atmospheric Rim Aura */}
      <rect width="360" height="400" fill={`url(#${uid}-glow)`} />

      <g opacity={active ? 1 : 0.72} style={{ filter: active ? 'none' : 'saturate(0.35)' }}>
        {/* Broad Tactical Shoulders & Jacket */}
        <path
          d="M36 400 L56 292 C66 258 98 242 132 232 L145 212 L215 212 L228 232 C264 242 296 260 306 294 L324 400 Z"
          fill={`url(#${uid}-gear)`}
          stroke={p.rim}
          strokeOpacity="0.28"
          strokeWidth="1.5"
        />

        {/* Sleeve Patch & Shoulder Rig */}
        <path
          d="M254 274 L298 286 L308 352 L262 342 Z"
          fill={p.helmetDark}
          stroke={p.rim}
          strokeOpacity="0.22"
          strokeWidth="1.2"
        />
        <rect x="268" y="294" width="24" height="16" rx="2" fill={p.gearLight} opacity="0.7" />
        <line x1="272" y1="302" x2="288" y2="302" stroke={p.accent} strokeWidth="2" opacity="0.8" />

        {/* Plate Carrier & MOLLE Webbing */}
        <path
          d="M114 236 L142 224 L218 224 L246 236 L254 398 L106 398 Z"
          fill={p.helmetDark}
          stroke={p.rim}
          strokeOpacity="0.32"
          strokeWidth="1.4"
        />
        {/* Shoulder Straps */}
        <path d="M126 230 L144 224 L152 274 L126 274 Z" fill={p.helmet} opacity="0.9" />
        <path d="M234 230 L216 224 L208 274 L234 274 Z" fill={p.helmet} opacity="0.9" />
        {/* Chest MOLLE Rows */}
        {[286, 306, 326, 346].map((y) => (
          <g key={y}>
            <rect x="128" y={y} width="104" height="10" rx="2" fill={p.gear} stroke={p.rim} strokeOpacity="0.22" />
            <line x1="154" y1={y} x2="154" y2={y + 10} stroke="#0d1117" strokeWidth="2" />
            <line x1="180" y1={y} x2="180" y2={y + 10} stroke="#0d1117" strokeWidth="2" />
            <line x1="206" y1={y} x2="206" y2={y + 10} stroke="#0d1117" strokeWidth="2" />
          </g>
        ))}

        {/* Chest Tactical Rifle Sling / Carbine Silhouette (Nomad / Hawk / Rook) */}
        {operatorId !== 'viper' && (
          <path
            d="M84 316 L112 288 L178 362 L156 398 L104 398 Z"
            fill="#141921"
            stroke="#475569"
            strokeOpacity="0.5"
            strokeWidth="1.4"
          />
        )}

        {/* Neck Gaiter / Shemagh */}
        <path
          d="M138 188 L222 188 L228 242 C202 254 158 254 132 242 Z"
          fill={p.helmet}
          stroke={p.rim}
          strokeOpacity="0.28"
          strokeWidth="1.2"
        />
        <path d="M142 204 Q180 214 218 204" fill="none" stroke="#181c16" strokeWidth="2.5" opacity="0.55" />
        <path d="M140 220 Q180 230 220 220" fill="none" stroke="#181c16" strokeWidth="2.5" opacity="0.55" />

        {/* Head Base */}
        <ellipse cx="180" cy="144" rx="52" ry="62" fill="#2b2623" />

        {/* Lower Mask / Balaclava */}
        <path
          d="M134 150 C148 142 212 142 226 150 L220 198 C200 212 160 212 140 198 Z"
          fill={operatorId === 'viper' ? '#2c2927' : p.helmet}
          stroke={p.rim}
          strokeOpacity="0.25"
        />

        {/* Ballistic Shades / Goggles */}
        <path
          d="M136 126 L176 128 L174 150 C158 153 142 149 134 140 Z"
          fill={p.visor}
          stroke="#64748b"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <path
          d="M224 126 L184 128 L186 150 C202 153 218 149 226 140 Z"
          fill={p.visor}
          stroke="#64748b"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        <line x1="175" y1="132" x2="185" y2="132" stroke="#64748b" strokeWidth="2.5" />
        {/* Lens Reflection */}
        <path d="M142 132 L164 133 L154 144 L140 140 Z" fill="#94a3b8" opacity="0.2" />
        <path d="M192 132 L214 133 L204 144 L190 140 Z" fill="#94a3b8" opacity="0.2" />

        {/* Headgear Variant per Operator */}
        {operatorId === 'viper' ? (
          /* Tactical Cap + Visor Brim */
          <g>
            <path
              d="M124 122 C126 78 150 62 182 62 C214 62 236 80 236 122 Z"
              fill={`url(#${uid}-helmet)`}
              stroke={p.rim}
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
            <path
              d="M112 122 Q168 106 238 122 Q174 126 112 122 Z"
              fill="#151c22"
              stroke={p.rim}
              strokeOpacity="0.35"
            />
          </g>
        ) : (
          /* FAST Ballistic Combat Helmet + NVG Mount + Side Rails */
          <g>
            <path
              d="M118 128 C118 76 144 52 180 52 C216 52 242 76 242 128 L232 132 C210 116 150 116 128 132 Z"
              fill={`url(#${uid}-helmet)`}
              stroke={p.rim}
              strokeOpacity="0.52"
              strokeWidth="1.6"
            />
            {/* NVG Shroud Mount */}
            <path
              d="M168 62 L192 62 L196 86 L164 86 Z"
              fill="#1c2126"
              stroke={p.rim}
              strokeOpacity="0.5"
              strokeWidth="1.2"
            />
            <rect x="173" y="68" width="14" height="10" rx="1.5" fill="#0d1117" />
            {/* Helmet ARC Rails */}
            <path d="M124 108 L152 104 L152 114 L124 118 Z" fill="#1d2226" stroke={p.rim} strokeOpacity="0.35" />
            <path d="M236 108 L208 104 L208 114 L236 118 Z" fill="#1d2226" stroke={p.rim} strokeOpacity="0.35" />
            {/* Rook Extra Ballistic Brow Visor */}
            {operatorId === 'rook' && (
              <path
                d="M126 122 Q180 110 234 122 L230 132 Q180 122 130 132 Z"
                fill="#11151a"
                stroke={p.accent}
                strokeOpacity="0.4"
              />
            )}
          </g>
        )}

        {/* Tactical Comms Earpro Headset & Boom Mic */}
        <rect
          x="114"
          y="128"
          width="18"
          height="42"
          rx="7"
          fill="#1b2026"
          stroke={p.rim}
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        <rect
          x="228"
          y="128"
          width="18"
          height="42"
          rx="7"
          fill="#1b2026"
          stroke={p.rim}
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        {/* Boom Mic */}
        <path
          d="M234 162 Q226 184 202 184"
          fill="none"
          stroke="#475569"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="200" cy="184" r="3.5" fill="#1e293b" stroke={p.accent} strokeWidth="1" />
      </g>

      {/* Bottom Fade Integration */}
      {size === 'hero' && <rect x="0" y="290" width="360" height="110" fill={`url(#${uid}-fade)`} />}
    </svg>
  );
};
