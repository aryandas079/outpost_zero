/**
 * Graphics post-processing & shadow quality helpers (exposure, vignette, subtle screen effects).
 */

import * as THREE from 'three';
import type { GameSettings } from '../game/types';

export function applyShadowQuality(
  renderer: THREE.WebGLRenderer,
  sunLight: THREE.DirectionalLight,
  shadowQuality: GameSettings['shadowQuality'],
  isSoftwareGl: boolean,
): void {
  const shadowsEnabled = !isSoftwareGl && shadowQuality !== 'off';
  const shadowSize = shadowQuality === 'high' ? 2048 : 1024;
  const sizeChanged = sunLight.shadow.mapSize.width !== shadowSize;
  renderer.shadowMap.enabled = shadowsEnabled;
  sunLight.castShadow = shadowsEnabled;
  if (sizeChanged) {
    sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
  }
  renderer.shadowMap.needsUpdate = shadowsEnabled;
}
