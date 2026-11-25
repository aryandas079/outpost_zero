/**
 * Single shared coordinate transform between 3D world space (X East-West, Z North-South)
 * and 2D map space (Minimap & Tactical Full-Screen Map), eliminating drift and flipping.
 */

export interface MapViewportTransform {
  centerPx: number;
  originWorldX: number;
  originWorldZ: number;
  pxPerMeter: number;
  rotationRad: number;
}

export function worldToMapPoint(
  worldX: number,
  worldZ: number,
  transform: MapViewportTransform,
): { x: number; y: number } {
  const dx = worldX - transform.originWorldX;
  const dz = worldZ - transform.originWorldZ;
  if (Math.abs(transform.rotationRad) < 1e-6) {
    return {
      x: transform.centerPx + dx * transform.pxPerMeter,
      y: transform.centerPx + dz * transform.pxPerMeter,
    };
  }
  const cos = Math.cos(transform.rotationRad);
  const sin = Math.sin(transform.rotationRad);
  return {
    x: transform.centerPx + (dx * cos - dz * sin) * transform.pxPerMeter,
    y: transform.centerPx + (dx * sin + dz * cos) * transform.pxPerMeter,
  };
}

export function mapPointToWorld(
  mapX: number,
  mapY: number,
  transform: MapViewportTransform,
): { x: number; z: number } {
  const rx = (mapX - transform.centerPx) / Math.max(1e-6, transform.pxPerMeter);
  const rz = (mapY - transform.centerPx) / Math.max(1e-6, transform.pxPerMeter);
  if (Math.abs(transform.rotationRad) < 1e-6) {
    return {
      x: transform.originWorldX + rx,
      z: transform.originWorldZ + rz,
    };
  }
  const cos = Math.cos(-transform.rotationRad);
  const sin = Math.sin(-transform.rotationRad);
  return {
    x: transform.originWorldX + (rx * cos - rz * sin),
    z: transform.originWorldZ + (rx * sin + rz * cos),
  };
}

/**
 * Converts player camera yaw (where yaw = 0 faces -Z North and yaw = -PI/2 faces +X East)
 * into clockwise compass degrees [0, 360) where 0 = North, 90 = East, 180 = South, 270 = West.
 */
export function yawToCompassDeg(yawRad: number): number {
  const rawDeg = ((-yawRad * 180) / Math.PI) % 360;
  return ((rawDeg % 360) + 360) % 360;
}

/**
 * Computes 8x8 military grid sector code (A1..H8) consistently for HUD and Tactical Map.
 */
export function worldToGridSector(worldX: number, worldZ: number, worldExtent: number): string {
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const rows = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const minW = -worldExtent;
  const span = Math.max(1, worldExtent * 2);
  const colIdx = Math.max(0, Math.min(7, Math.floor(((worldX - minW) / span) * 8)));
  const rowIdx = Math.max(0, Math.min(7, Math.floor(((worldZ - minW) / span) * 8)));
  return `${cols[colIdx]}${rows[rowIdx]}`;
}
