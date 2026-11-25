/**
 * Tone mapping, exposure calibration, and view-distance fog controls.
 * Wide far planes allow viewing the entire 25 km² three-island archipelago cleanly from high altitude.
 */

import * as THREE from 'three';
import type { GameSettings } from '../game/types';

export function getViewDistanceFarPlane(
  mapId: 'island' | 'west',
  viewDistance: GameSettings['viewDistance'],
): number {
  if (mapId === 'west') return 360;
  switch (viewDistance) {
    case 'reduced':
      return 4800;
    case 'balanced':
      return 7200;
    case 'extended':
      return 8400;
    case 'maximum':
      return 9600;
  }
}

export function applyRendererToneMapping(
  renderer: THREE.WebGLRenderer,
  exposure: number,
): void {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = THREE.MathUtils.clamp(exposure, 0.75, 1.35);
}
