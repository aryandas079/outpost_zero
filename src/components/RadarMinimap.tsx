import React from 'react';
import type { RadarState } from '../game/types';
import { INLAND_LAKES } from '../world/Terrain';
import { MapViewportTransform, worldToMapPoint } from '../utilities/MapTransform';

export interface RadarMinimapProps {
  radar: RadarState;
  isIsland: boolean;
  rotateWithPlayer?: boolean;
  onToggleMap: () => void;
}

const SIZE = 148;
const CENTER = SIZE / 2;

const BRIDGE_SPANS = [
  { id: 'bridge-1', x0: -760, z0: -420, x1: -200, z1: -420 },
  { id: 'bridge-2', x0: -1260, z0: 240, x1: -1260, z1: 780 },
  { id: 'bridge-3', x0: -660, z0: 980, x1: 60, z1: 980 },
];

/**
 * Ultra-Clean Square Low-Poly Minimap matching the HUD Kit:
 * Shows the 3 low-poly islands, lakes, river, bridges, white storm ring, and directional player arrow.
 */
export const RadarMinimap: React.FC<RadarMinimapProps> = ({
  radar,
  isIsland,
  rotateWithPlayer = false,
  onToggleMap,
}) => {
  const effectiveRange = Math.max(24, radar.range || (isIsland ? 340 : 40));
  const pxPerMeter = (CENTER - 6) / effectiveRange;
  const transform: MapViewportTransform = {
    centerPx: CENTER,
    originWorldX: radar.playerX,
    originWorldZ: radar.playerZ,
    pxPerMeter,
    rotationRad: rotateWithPlayer ? radar.playerYaw : 0,
  };

  const islandPaths = React.useMemo(() => {
    if (radar.islandPolygons && radar.islandPolygons.length > 0) {
      return radar.islandPolygons.map((poly) => ({
        id: poly.id,
        fill: poly.fill,
        d:
          poly.points
            .map(([wx, wz], idx) => {
              const pt = worldToMapPoint(wx, wz, transform);
              return `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            })
            .join(' ') + ' Z',
      }));
    }
    if (!radar.coastlinePolygon || radar.coastlinePolygon.length < 3) return [];
    return [
      {
        id: 'main_15km2',
        fill: '#466B36',
        d:
          radar.coastlinePolygon
            .map(([wx, wz], idx) => {
              const pt = worldToMapPoint(wx, wz, transform);
              return `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            })
            .join(' ') + ' Z',
      },
    ];
  }, [radar.islandPolygons, radar.coastlinePolygon, radar.playerX, radar.playerZ, radar.playerYaw, pxPerMeter, rotateWithPlayer]);

  const riverPath = React.useMemo(() => {
    if (!radar.riverPolyline || radar.riverPolyline.length < 2) return null;
    return radar.riverPolyline
      .map(([wx, wz], idx) => {
        const pt = worldToMapPoint(wx, wz, transform);
        return `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');
  }, [radar.riverPolyline, radar.playerX, radar.playerZ, radar.playerYaw, pxPerMeter, rotateWithPlayer]);

  const stormPos = radar.stormCircle ? worldToMapPoint(radar.stormCircle.cx, radar.stormCircle.cz, transform) : null;
  const targetPos = radar.stormCircle
    ? worldToMapPoint(radar.stormCircle.targetCx, radar.stormCircle.targetCz, transform)
    : null;
  const waypointPos = radar.waypoint ? worldToMapPoint(radar.waypoint.x, radar.waypoint.z, transform) : null;
  const arrowRotationDeg = rotateWithPlayer ? 0 : ((-radar.playerYaw * 180) / Math.PI + 360) % 360;

  return (
    <div className="flex flex-col items-end pointer-events-auto">
      <div
        onClick={onToggleMap}
        title="Open Map [M]"
        className="relative rounded-sm border-2 border-white/60 bg-[#0D4A75] shadow-xl overflow-hidden cursor-pointer hover:border-[#FACC15] transition-colors"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full block">
          {/* 3-Island Silhouettes & Lakes */}
          {isIsland &&
            islandPaths.map((poly) => (
              <g key={poly.id}>
                <path d={poly.d} fill="#1E7B98" stroke="#2296B3" strokeWidth="5" />
                <path d={poly.d} fill={poly.fill} stroke="#CBB782" strokeWidth="1.8" />
              </g>
            ))}

          {isIsland &&
            INLAND_LAKES.map((lake) => {
              const pt = worldToMapPoint(lake.cx, lake.cz, transform);
              return (
                <ellipse
                  key={lake.id}
                  cx={pt.x}
                  cy={pt.y}
                  rx={Math.max(2.5, lake.rx * pxPerMeter)}
                  ry={Math.max(2.5, lake.rz * pxPerMeter)}
                  fill="#1D7A9E"
                />
              );
            })}

          {isIsland && (
            <ellipse
              cx={worldToMapPoint(60, -242, transform).x}
              cy={worldToMapPoint(60, -242, transform).y}
              rx={Math.max(2, 110 * pxPerMeter)}
              ry={Math.max(2, 130 * pxPerMeter)}
              fill="#1D7A9E"
            />
          )}

          {isIsland && riverPath && (
            <path
              d={riverPath}
              fill="none"
              stroke="#1D7A9E"
              strokeWidth={Math.max(2.2, 24 * pxPerMeter)}
              strokeLinecap="round"
            />
          )}

          {/* 3 Suspension Bridges */}
          {isIsland &&
            BRIDGE_SPANS.map((br) => {
              const a = worldToMapPoint(br.x0, br.z0, transform);
              const b = worldToMapPoint(br.x1, br.z1, transform);
              return (
                <line
                  key={br.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#D97757"
                  strokeWidth={Math.max(2, 11 * pxPerMeter)}
                  strokeLinecap="round"
                />
              );
            })}

          {/* West Town buildings */}
          {!isIsland &&
            radar.buildings.map((b, i) => {
              if (Math.abs(b.cx - radar.playerX) > effectiveRange * 1.2 || Math.abs(b.cz - radar.playerZ) > effectiveRange * 1.2) {
                return null;
              }
              const p = worldToMapPoint(b.cx, b.cz, transform);
              return (
                <rect
                  key={i}
                  x={p.x - Math.max(2, b.w * pxPerMeter) / 2}
                  y={p.y - Math.max(2, b.d * pxPerMeter) / 2}
                  width={Math.max(2, b.w * pxPerMeter)}
                  height={Math.max(2, b.d * pxPerMeter)}
                  fill="#64748B"
                />
              );
            })}

          {/* Clean Storm & Target Rings */}
          {isIsland && radar.stormCircle && stormPos && (
            <circle
              cx={stormPos.x}
              cy={stormPos.y}
              r={Math.max(2, radar.stormCircle.r * pxPerMeter)}
              fill="none"
              stroke="rgba(255,255,255,0.88)"
              strokeWidth="1.5"
            />
          )}
          {isIsland && radar.stormCircle && targetPos && radar.stormCircle.targetR > 0 && (
            <circle
              cx={targetPos.x}
              cy={targetPos.y}
              r={Math.max(2, radar.stormCircle.targetR * pxPerMeter)}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.1"
              strokeDasharray="3 2"
            />
          )}

          {/* Waypoint marker */}
          {waypointPos && (
            <polygon
              points={`${waypointPos.x},${waypointPos.y - 4.5} ${waypointPos.x + 4},${waypointPos.y} ${waypointPos.x},${waypointPos.y + 4.5} ${waypointPos.x - 4},${waypointPos.y}`}
              fill="#FACC15"
              stroke="#0F172A"
              strokeWidth="1"
            />
          )}

          {/* Clean White Player Arrow */}
          <g transform={`translate(${CENTER}, ${CENTER}) rotate(${arrowRotationDeg})`}>
            <polygon points="0,-7.5 5.5,6 0,3.2 -5.5,6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1" />
          </g>
        </svg>

        <span className="absolute bottom-1 right-1 px-1 py-px rounded-xs bg-black/55 font-mono text-[8px] font-bold text-white/85">
          M
        </span>
      </div>
    </div>
  );
};
