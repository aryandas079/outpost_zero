import React from 'react';
import { RadarState } from '../game/types';

interface RadarMinimapProps {
  radar: RadarState;
  compact?: boolean;
}

const VIEW_SIZE = 160;
const CENTER = VIEW_SIZE / 2;
const HALF_EXTENT = 74;

export const RadarMinimap: React.FC<RadarMinimapProps> = React.memo(({ radar, compact = false }) => {
  const pxPerMeter = HALF_EXTENT / Math.max(10, radar.range);
  const yawDeg = (radar.playerYaw * 180) / Math.PI;
  const cosYaw = Math.cos(radar.playerYaw);
  const sinYaw = Math.sin(radar.playerYaw);

  const sizeClass = compact ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-32 h-32 md:w-36 md:h-36';

  return (
    <div
      className="select-none pointer-events-none"
      aria-label="Tactical radar minimap"
    >
      <div
        className={`relative ${sizeClass} rounded-md bg-[#0b1018]/90 border border-white/22 shadow-[0_6px_22px_rgba(0,0,0,0.55)] overflow-hidden`}
      >
        <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full h-full block">
          <defs>
            <clipPath id="square-radar-clip">
              <rect x={2} y={2} width={VIEW_SIZE - 4} height={VIEW_SIZE - 4} rx={5} />
            </clipPath>
            <radialGradient id="sq-radar-bg" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#1b2636" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#0a0f17" stopOpacity="0.92" />
            </radialGradient>
            <linearGradient id="sq-fov-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Tactical Dark Slate Map Surface */}
          <rect x={0} y={0} width={VIEW_SIZE} height={VIEW_SIZE} fill="url(#sq-radar-bg)" />

          {/* Subtle Tactical Grid Lines */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth={0.75}>
            <line x1={40} y1={0} x2={40} y2={VIEW_SIZE} />
            <line x1={80} y1={0} x2={80} y2={VIEW_SIZE} />
            <line x1={120} y1={0} x2={120} y2={VIEW_SIZE} />
            <line x1={0} y1={40} x2={VIEW_SIZE} y2={40} />
            <line x1={0} y1={80} x2={VIEW_SIZE} y2={80} />
            <line x1={0} y1={120} x2={VIEW_SIZE} y2={120} />
          </g>

          {/* World-Locked Map Geometry (Main Street, Town Plaza, Railroad, Buildings, Pickups) */}
          <g clipPath="url(#square-radar-clip)">
            <g
              transform={`translate(${CENTER}, ${CENTER}) rotate(${yawDeg}) scale(${pxPerMeter}) translate(${-radar.playerX}, ${-radar.playerZ})`}
            >
              {/* Main Street & East Town Plaza */}
              <rect x={-47} y={-5.95} width={86} height={13.5} fill="rgba(203, 213, 225, 0.1)" />
              <rect x={13} y={-11} width={24} height={34} fill="rgba(203, 213, 225, 0.08)" />

              {/* Railroad Track along West Perimeter */}
              <line
                x1={-46.5}
                y1={-75}
                x2={-46.5}
                y2={75}
                stroke="rgba(226, 232, 240, 0.28)"
                strokeWidth={0.75}
                strokeDasharray="1.1 1.1"
              />

              {/* Enterable Town Buildings */}
              {radar.buildings.map((b, idx) => (
                <rect
                  key={idx}
                  x={b.cx - b.w / 2}
                  y={b.cz - b.d / 2}
                  width={b.w}
                  height={b.d}
                  rx={0.4}
                  fill="rgba(148, 163, 184, 0.22)"
                  stroke="rgba(226, 232, 240, 0.42)"
                  strokeWidth={0.65}
                />
              ))}

              {/* Active Supply Pickups */}
              {radar.pickups.map((pk, idx) =>
                pk.kind === 'health' ? (
                  <g key={`pk-${idx}`} transform={`translate(${pk.x}, ${pk.z})`}>
                    <rect x={-1.05} y={-0.35} width={2.1} height={0.7} fill="#34d399" />
                    <rect x={-0.35} y={-1.05} width={0.7} height={2.1} fill="#34d399" />
                  </g>
                ) : (
                  <rect
                    key={`pk-${idx}`}
                    x={pk.x - 0.75}
                    y={pk.z - 0.75}
                    width={1.5}
                    height={1.5}
                    fill="#fbbf24"
                  />
                ),
              )}
            </g>

            {/* Player Forward Vision Cone */}
            <polygon
              points={`${CENTER},${CENTER} ${CENTER - 42},${CENTER - 68} ${CENTER + 42},${CENTER - 68}`}
              fill="url(#sq-fov-grad)"
            />

            {/* Hostile Blips (In-range exact positions + Square-Edge Clamped Threat Indicators) */}
            {radar.enemies.map((e) => {
              const dx = e.x - radar.playerX;
              const dz = e.z - radar.playerZ;
              const rx = (dx * cosYaw - dz * sinYaw) * pxPerMeter;
              const ry = (dx * sinYaw + dz * cosYaw) * pxPerMeter;
              const bound = HALF_EXTENT - 4;

              if (Math.abs(rx) > bound || Math.abs(ry) > bound) {
                const scale = bound / Math.max(Math.abs(rx), Math.abs(ry), 0.001);
                const ex = CENTER + rx * scale;
                const ey = CENTER + ry * scale;
                const angleDeg = (Math.atan2(ry, rx) * 180) / Math.PI + 90;
                return (
                  <g key={e.id} transform={`translate(${ex}, ${ey}) rotate(${angleDeg})`}>
                    <polygon
                      points="0,-4.5 3.4,2.8 -3.4,2.8"
                      fill={e.firing ? '#fbbf24' : '#ef4444'}
                      stroke="#090d13"
                      strokeWidth={0.85}
                    />
                  </g>
                );
              }

              const bx = CENTER + rx;
              const by = CENTER + ry;

              return (
                <g key={e.id} transform={`translate(${bx}, ${by})`}>
                  {e.firing && (
                    <circle cx={0} cy={0} r={6.2} fill="none" stroke="#fbbf24" strokeWidth={1.3} />
                  )}
                  {e.kind === 'sentinel' ? (
                    <polygon
                      points="0,-4.6 4.6,0 0,4.6 -4.6,0"
                      fill="#f97316"
                      stroke="#fff7ed"
                      strokeWidth={0.9}
                    />
                  ) : e.kind === 'wasp' ? (
                    <polygon
                      points="0,-4.4 4.0,3.2 -4.0,3.2"
                      fill="#ef4444"
                      stroke="#fde68a"
                      strokeWidth={0.85}
                    />
                  ) : (
                    <circle cx={0} cy={0} r={3.5} fill="#ef4444" stroke="#fee2e2" strokeWidth={0.9} />
                  )}
                </g>
              );
            })}

            {/* Center Player Yellow Tactical Arrow (Matching Reference Image) */}
            <g transform={`translate(${CENTER}, ${CENTER})`}>
              <polygon
                points="0,-7.5 5.4,5.4 0,2.5 -5.4,5.4"
                fill="#facc15"
                stroke="#0c1118"
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
});

