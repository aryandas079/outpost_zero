import React, { useMemo, useRef, useState } from 'react';
import type { HudSnapshot } from '../game/types';
import { INLAND_LAKES, ISLAND_HALF_SIZE } from '../world/Terrain';
import { MapViewportTransform, mapPointToWorld, worldToMapPoint } from '../utilities/MapTransform';

export interface TacticalMapModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSetWaypoint?: (x: number, z: number) => void;
  onClearWaypoint?: () => void;
}

const SVG_SIZE = 760;
const HALF_SVG = SVG_SIZE / 2;

const BRIDGE_SPANS = [
  { id: 'bridge-1', x0: -760, z0: -420, x1: -200, z1: -420 },
  { id: 'bridge-2', x0: -1260, z0: 240, x1: -1260, z1: 780 },
  { id: 'bridge-3', x0: -660, z0: 980, x1: 60, z1: 980 },
];

/**
 * Ultra-Clean Minimal Tactical Map toggled with [M]:
 * - Only A–H / 1–8 grid coordinates, smooth scroll-wheel zoom & drag-pan,
 *   3 low-poly islands, water bodies, bridges, safe zones, and clean labels directly on the map.
 */
export const TacticalMapModal: React.FC<TacticalMapModalProps> = ({
  hud,
  onClose,
  onSetWaypoint,
  onClearWaypoint,
}) => {
  const isIsland = hud.mapId === 'island';
  const [zoom, setZoom] = useState(1);
  const [panWorld, setPanWorld] = useState({ x: 0, z: 0 });
  const dragRef = useRef<{ active: boolean; moved: boolean; startX: number; startY: number; panX: number; panZ: number }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    panX: 0,
    panZ: 0,
  });

  const baseHalfMeters = isIsland ? ISLAND_HALF_SIZE : 85;
  const pxPerMeter = ((SVG_SIZE - 44) / (baseHalfMeters * 2)) * zoom;

  const transform: MapViewportTransform = {
    centerPx: HALF_SVG,
    originWorldX: panWorld.x,
    originWorldZ: panWorld.z,
    pxPerMeter,
    rotationRad: 0,
  };

  const islandPaths = useMemo(() => {
    if (!isIsland) return [];
    if (hud.radar.islandPolygons && hud.radar.islandPolygons.length > 0) {
      return hud.radar.islandPolygons.map((poly) => ({
        id: poly.id,
        fill: poly.fill,
        d:
          poly.points
            .map(([wx, wz], idx) => {
              const p = worldToMapPoint(wx, wz, transform);
              return `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ') + ' Z',
      }));
    }
    if (!hud.radar.coastlinePolygon || hud.radar.coastlinePolygon.length < 3) return [];
    return [
      {
        id: 'main_15km2',
        fill: '#5C8739',
        d:
          hud.radar.coastlinePolygon
            .map(([wx, wz], idx) => {
              const p = worldToMapPoint(wx, wz, transform);
              return `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ') + ' Z',
      },
    ];
  }, [isIsland, hud.radar.islandPolygons, hud.radar.coastlinePolygon, panWorld.x, panWorld.z, pxPerMeter]);

  const riverPath = useMemo(() => {
    if (!isIsland || !hud.radar.riverPolyline || hud.radar.riverPolyline.length < 2) return null;
    return hud.radar.riverPolyline
      .map(([wx, wz], idx) => {
        const p = worldToMapPoint(wx, wz, transform);
        return `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
  }, [isIsland, hud.radar.riverPolyline, panWorld.x, panWorld.z, pxPerMeter]);

  const gridCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const gridRows = ['1', '2', '3', '4', '5', '6', '7', '8'];

  const playerPt = worldToMapPoint(hud.radar.playerX, hud.radar.playerZ, transform);
  const stormPt = hud.radar.stormCircle ? worldToMapPoint(hud.radar.stormCircle.cx, hud.radar.stormCircle.cz, transform) : null;
  const targetPt = hud.radar.stormCircle
    ? worldToMapPoint(hud.radar.stormCircle.targetCx, hud.radar.stormCircle.targetCz, transform)
    : null;
  const waypointPt = hud.radar.waypoint ? worldToMapPoint(hud.radar.waypoint.x, hud.radar.waypoint.z, transform) : null;

  const handleWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    setZoom((z) => Math.max(0.85, Math.min(6.0, Number((z * factor).toFixed(2)))));
  };

  const handleSvgPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (e.button === 2) {
      e.preventDefault();
      onClearWaypoint?.();
      return;
    }
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      panX: panWorld.x,
      panZ: panWorld.z,
    };
  };

  const handleSvgPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 5) dragRef.current.moved = true;
    const scale = 1 / pxPerMeter;
    setPanWorld({
      x: Math.max(-baseHalfMeters * 0.9, Math.min(baseHalfMeters * 0.9, dragRef.current.panX - dx * scale)),
      z: Math.max(-baseHalfMeters * 0.9, Math.min(baseHalfMeters * 0.9, dragRef.current.panZ - dy * scale)),
    });
  };

  const handleSvgPointerUp: React.PointerEventHandler<SVGSVGElement> = (e) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    if (!wasMoved && e.button === 0 && onSetWaypoint) {
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
      const sy = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
      const world = mapPointToWorld(sx, sy, transform);
      onSetWaypoint(world.x, world.z);
    }
  };

  const playerRotDeg = ((-hud.radar.playerYaw * 180) / Math.PI + 360) % 360;

  return (
    <div
      data-testid="tactical-map-modal"
      className="fixed inset-0 z-40 bg-[#050C14]/78 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(86vh,86vw)] aspect-square bg-[#08243A] border-2 border-white/25 rounded-sm shadow-2xl overflow-hidden"
      >
        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="w-full h-full select-none cursor-crosshair block"
          onWheel={handleWheel}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
        >
          {/* Coordinate Grid A–H x 1–8 */}
          {gridCols.map((col, ci) => {
            const x0 = -baseHalfMeters + (ci / 8) * (baseHalfMeters * 2);
            const p = worldToMapPoint(x0, -baseHalfMeters, transform);
            const labelX = worldToMapPoint(x0 + (baseHalfMeters * 2) / 16, -baseHalfMeters, transform).x;
            return (
              <g key={col}>
                <line x1={p.x} y1={0} x2={p.x} y2={SVG_SIZE} stroke="rgba(186,230,253,0.12)" strokeWidth="1" />
                <text x={labelX} y={16} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="monospace" fill="rgba(226,232,240,0.75)">
                  {col}
                </text>
              </g>
            );
          })}
          {gridRows.map((row, ri) => {
            const z0 = -baseHalfMeters + (ri / 8) * (baseHalfMeters * 2);
            const p = worldToMapPoint(-baseHalfMeters, z0, transform);
            const labelY = worldToMapPoint(-baseHalfMeters, z0 + (baseHalfMeters * 2) / 16, transform).y;
            return (
              <g key={row}>
                <line x1={0} y1={p.y} x2={SVG_SIZE} y2={p.y} stroke="rgba(186,230,253,0.12)" strokeWidth="1" />
                <text x={14} y={labelY + 4} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="monospace" fill="rgba(226,232,240,0.75)">
                  {row}
                </text>
              </g>
            );
          })}

          {/* 3-Island Silhouettes, Lakes, Dam Reservoir, River, & Suspension Bridges */}
          {isIsland && islandPaths.length > 0 && (
            <>
              {islandPaths.map((poly) => (
                <g key={poly.id}>
                  <path d={poly.d} fill="#186E8C" stroke="#228EB0" strokeWidth="11" opacity={0.8} />
                  <path d={poly.d} fill={poly.fill} stroke="#D7C792" strokeWidth="3.2" />
                </g>
              ))}
              {INLAND_LAKES.map((lake) => {
                const pt = worldToMapPoint(lake.cx, lake.cz, transform);
                return (
                  <ellipse
                    key={lake.id}
                    cx={pt.x}
                    cy={pt.y}
                    rx={lake.rx * pxPerMeter}
                    ry={lake.rz * pxPerMeter}
                    fill="#1E7B9E"
                    stroke="#A4D5E8"
                    strokeWidth="1.2"
                  />
                );
              })}
              <ellipse
                cx={worldToMapPoint(60, -242, transform).x}
                cy={worldToMapPoint(60, -242, transform).y}
                rx={125 * pxPerMeter}
                ry={145 * pxPerMeter}
                fill="#1E7B9E"
                stroke="#A4D5E8"
                strokeWidth="1"
              />
              {riverPath && (
                <path
                  d={riverPath}
                  fill="none"
                  stroke="#1E7B9E"
                  strokeWidth={Math.max(4, 28 * pxPerMeter)}
                  strokeLinecap="round"
                />
              )}
              {BRIDGE_SPANS.map((br) => {
                const a = worldToMapPoint(br.x0, br.z0, transform);
                const b = worldToMapPoint(br.x1, br.z1, transform);
                return (
                  <line
                    key={br.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#E06D53"
                    strokeWidth={Math.max(3, 14 * pxPerMeter)}
                    strokeLinecap="round"
                  />
                );
              })}
            </>
          )}

          {/* West Town */}
          {!isIsland &&
            hud.radar.buildings.map((b, i) => {
              const p = worldToMapPoint(b.cx, b.cz, transform);
              return (
                <rect
                  key={i}
                  x={p.x - Math.max(4, b.w * pxPerMeter) / 2}
                  y={p.y - Math.max(4, b.d * pxPerMeter) / 2}
                  width={Math.max(4, b.w * pxPerMeter)}
                  height={Math.max(4, b.d * pxPerMeter)}
                  fill="#46525E"
                  stroke="#7A8996"
                  strokeWidth="1"
                />
              );
            })}

          {/* Closing Storm & Safe Zone Rings */}
          {isIsland && hud.radar.stormCircle && stormPt && (
            <circle
              cx={stormPt.x}
              cy={stormPt.y}
              r={Math.max(4, hud.radar.stormCircle.r * pxPerMeter)}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2"
            />
          )}
          {isIsland && hud.radar.stormCircle && targetPt && hud.radar.stormCircle.targetR > 0 && (
            <circle
              cx={targetPt.x}
              cy={targetPt.y}
              r={Math.max(4, hud.radar.stormCircle.targetR * pxPerMeter)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeDasharray="7 4"
            />
          )}

          {/* Plane Flight Corridor */}
          {isIsland && hud.radar.planePath && (
            (() => {
              const p0 = worldToMapPoint(hud.radar.planePath.x0, hud.radar.planePath.z0, transform);
              const p1 = worldToMapPoint(hud.radar.planePath.x1, hud.radar.planePath.z1, transform);
              const pp = worldToMapPoint(hud.radar.planePath.planeX, hud.radar.planePath.planeZ, transform);
              const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI + 90;
              return (
                <g>
                  <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#FACC15" strokeWidth="2" strokeDasharray="8 6" opacity="0.8" />
                  {hud.radar.planePath.active && (
                    <g transform={`translate(${pp.x}, ${pp.y}) rotate(${angle})`}>
                      <polygon points="0,-8 7,4 2,4 2,9 -2,9 -2,4 -7,4" fill="#FACC15" stroke="#0C1826" strokeWidth="1.2" />
                    </g>
                  )}
                </g>
              );
            })()
          )}

          {/* Clean minimal location names placed directly on the map */}
          {isIsland &&
            hud.radar.pois?.map((poi) => {
              const pt = worldToMapPoint(poi.x, poi.z, transform);
              return (
                <g key={poi.id ?? poi.name}>
                  <circle cx={pt.x} cy={pt.y} r="2.2" fill="#FFFFFF" opacity="0.8" />
                  <text
                    x={pt.x}
                    y={pt.y - 6}
                    textAnchor="middle"
                    fontSize={zoom > 1.8 ? '10' : '8.5'}
                    fontWeight="700"
                    fontFamily="sans-serif"
                    fill="#F8FAFC"
                    style={{ paintOrder: 'stroke', stroke: '#071B2E', strokeWidth: 3 }}
                  >
                    {poi.name}
                  </text>
                </g>
              );
            })}

          {/* Waypoint */}
          {waypointPt && (
            <g>
              <line x1={playerPt.x} y1={playerPt.y} x2={waypointPt.x} y2={waypointPt.y} stroke="#FACC15" strokeWidth="1.6" strokeDasharray="5 4" />
              <polygon
                points={`${waypointPt.x},${waypointPt.y - 9} ${waypointPt.x + 6.5},${waypointPt.y} ${waypointPt.x},${waypointPt.y + 9} ${waypointPt.x - 6.5},${waypointPt.y}`}
                fill="#FACC15"
                stroke="#0C1826"
                strokeWidth="1.4"
              />
            </g>
          )}

          {/* Player Directional Cursor */}
          <g transform={`translate(${playerPt.x}, ${playerPt.y}) rotate(${playerRotDeg})`}>
            <polygon points="0,-9 6.5,7 0,3.5 -6.5,7" fill="#FFFFFF" stroke="#0C1826" strokeWidth="1.4" />
          </g>
        </svg>

        {/* Minimal corner zoom indicator */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-xs bg-black/55 font-mono text-[10px] text-white/80 pointer-events-none">
          {zoom.toFixed(1)}× · SCROLL ZOOM · [M] CLOSE
        </div>
      </div>
    </div>
  );
};
