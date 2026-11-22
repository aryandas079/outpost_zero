import React from 'react';
import { RadarState } from '../game/types';

interface RadarMinimapProps {
  radar: RadarState;
  compact?: boolean;
}

const VIEW_SIZE = 160;
const CENTER = VIEW_SIZE / 2;
const HALF_EXTENT = 66;

export const RadarMinimap: React.FC<RadarMinimapProps> = React.memo(({ radar, compact = false }) => {
  const pxPerMeter = HALF_EXTENT / Math.max(10, radar.range);
  const yawDeg = (radar.playerYaw * 180) / Math.PI;
  const cosYaw = Math.cos(radar.playerYaw);
  const sinYaw = Math.sin(radar.playerYaw);

  const sizeClass = compact ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-[clamp(148px,15vw,190px)] h-[clamp(148px,15vw,190px)]';

  return (
    <div
      className="select-none pointer-events-none"
      aria-label="Tactical radar minimap"
    >
      <div
        className={`relative ${sizeClass} rounded-full bg-[#0a0f16]/90 border border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.65)] overflow-hidden`}
      >
        <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full h-full block">
          <defs>
            <clipPath id="circle-radar-clip">
              <circle cx={CENTER} cy={CENTER} r={HALF_EXTENT} />
            </clipPath>
            <radialGradient id="sq-radar-bg" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#172230" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#080d14" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id="sq-fov-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Tactical Dark Slate Map Surface */}
          <rect x={0} y={0} width={VIEW_SIZE} height={VIEW_SIZE} fill="url(#sq-radar-bg)" />

          {/* Outer Bezel Rim */}
          <circle cx={CENTER} cy={CENTER} r={78} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          <circle cx={CENTER} cy={CENTER} r={HALF_EXTENT + 2} fill="none" stroke="rgba(56,189,248,0.25)" strokeWidth={1} />

          {/* Subtle Outer Compass Cardinal Ticks */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const isMajor = deg % 90 === 0;
            const r1 = isMajor ? 73 : 75;
            const r2 = 78;
            return (
              <line
                key={deg}
                x1={CENTER + Math.sin(rad) * r1}
                y1={CENTER - Math.cos(rad) * r1}
                x2={CENTER + Math.sin(rad) * r2}
                y2={CENTER - Math.cos(rad) * r2}
                stroke={isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
                strokeWidth={isMajor ? 1.5 : 1}
              />
            );
          })}

          {/* Outer Cardinal Direction Letters (N, E, S, W) matching reference */}
          <text x={CENTER} y={11} fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            N
          </text>
          <text x={VIEW_SIZE - 6} y={CENTER + 3} fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            E
          </text>
          <text x={CENTER} y={VIEW_SIZE - 4} fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            S
          </text>
          <text x={7} y={CENTER + 3} fill="#94a3b8" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
            W
          </text>

          {/* Subtle Tactical Grid Lines */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth={0.75} clipPath="url(#circle-radar-clip)">
            <line x1={40} y1={0} x2={40} y2={VIEW_SIZE} />
            <line x1={80} y1={0} x2={80} y2={VIEW_SIZE} />
            <line x1={120} y1={0} x2={120} y2={VIEW_SIZE} />
            <line x1={0} y1={40} x2={VIEW_SIZE} y2={40} />
            <line x1={0} y1={80} x2={VIEW_SIZE} y2={80} />
            <line x1={0} y1={120} x2={VIEW_SIZE} y2={120} />
          </g>

          {/* World-Locked Map Geometry */}
          <g clipPath="url(#circle-radar-clip)">
            <g
              transform={`translate(${CENTER}, ${CENTER}) rotate(${yawDeg}) scale(${pxPerMeter}) translate(${-radar.playerX}, ${-radar.playerZ})`}
            >
              {/* Main Street & East Town Plaza */}
              <rect x={-47} y={-5.95} width={86} height={13.5} fill="rgba(203, 213, 225, 0.12)" />
              <rect x={13} y={-11} width={24} height={34} fill="rgba(203, 213, 225, 0.09)" />

              {/* Railroad Track along West Perimeter */}
              <line
                x1={-46.5}
                y1={-75}
                x2={-46.5}
                y2={75}
                stroke="rgba(226, 232, 240, 0.35)"
                strokeWidth={0.8}
                strokeDasharray="1.2 1.2"
              />

              {/* Enterable Town Buildings */}
              {radar.buildings.map((b, idx) => (
                <rect
                  key={idx}
                  x={b.cx - b.w / 2}
                  y={b.cz - b.d / 2}
                  width={b.w}
                  height={b.d}
                  rx={0.5}
                  fill="rgba(148, 163, 184, 0.28)"
                  stroke="rgba(226, 232, 240, 0.55)"
                  strokeWidth={0.7}
                />
              ))}

              {/* Active Supply Pickups */}
              {radar.pickups.map((pk, idx) =>
                pk.kind === 'health' ? (
                  <g key={`pk-${idx}`} transform={`translate(${pk.x}, ${pk.z})`}>
                    <rect x={-1.2} y={-0.4} width={2.4} height={0.8} fill="#34d399" />
                    <rect x={-0.4} y={-1.2} width={0.8} height={2.4} fill="#34d399" />
                  </g>
                ) : (
                  <rect
                    key={`pk-${idx}`}
                    x={pk.x - 0.8}
                    y={pk.z - 0.8}
                    width={1.6}
                    height={1.6}
                    fill="#fbbf24"
                  />
                ),
              )}
            </g>

            {/* Player Forward Vision Cone */}
            <polygon
              points={`${CENTER},${CENTER} ${CENTER - 38},${CENTER - 60} ${CENTER + 38},${CENTER - 60}`}
              fill="url(#sq-fov-grad)"
            />

            {/* Hostile Blips */}
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

            {/* Remote Multiplayer Teammates / Players */}
            {radar.players?.map((p) => {
              const dx = p.x - radar.playerX;
              const dz = p.z - radar.playerZ;
              const rx = (dx * cosYaw - dz * sinYaw) * pxPerMeter;
              const ry = (dx * sinYaw + dz * cosYaw) * pxPerMeter;
              const bound = HALF_EXTENT - 4;

              if (Math.abs(rx) > bound || Math.abs(ry) > bound) {
                const scale = bound / Math.max(Math.abs(rx), Math.abs(ry), 0.001);
                const ex = CENTER + rx * scale;
                const ey = CENTER + ry * scale;
                const angleDeg = (Math.atan2(ry, rx) * 180) / Math.PI + 90;
                return (
                  <g key={p.id} transform={`translate(${ex}, ${ey}) rotate(${angleDeg})`}>
                    <polygon
                      points="0,-4.5 3.4,2.8 -3.4,2.8"
                      fill={p.color}
                      stroke="#090d13"
                      strokeWidth={0.85}
                    />
                  </g>
                );
              }

              const bx = CENTER + rx;
              const by = CENTER + ry;

              return (
                <g key={p.id} transform={`translate(${bx}, ${by})`}>
                  <polygon
                    points="0,-5 4,3.5 -4,3.5"
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={0.8}
                  />
                </g>
              );
            })}

            {/* Center Player Yellow Tactical Arrow */}
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
