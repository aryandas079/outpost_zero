/**
 * Battle Royale Aircraft Deployment, Freefall & Parachute State Machine.
 * Launches the C-130 from one outer edge of the 25 km² archipelago and flies across all 3 islands
 * (Main 15 km², Cliff 7 km², Desert 3 km²) to the opposite boundary.
 */

import * as THREE from 'three';
import { WORLD_CONFIG } from '../core/Config';
import { SeededRng } from '../utilities/SeededRng';

export class DeploymentSystem {
  public readonly planeStart = new THREE.Vector3(-2400, WORLD_CONFIG.planeAltitudeMeters, 2100);
  public readonly planeEnd = new THREE.Vector3(2400, WORLD_CONFIG.planeAltitudeMeters, -2100);
  public readonly planePos = new THREE.Vector3(-2400, WORLD_CONFIG.planeAltitudeMeters, 2100);
  public readonly planeDir = new THREE.Vector3(1, 0, -1).normalize();
  public planeProgress = 0;
  public readonly planeSpeed = WORLD_CONFIG.planeSpeedMps;
  public nextBotDropProgress = 0.14;
  public botsRemainingToSpawn = 23;
  public countdownSec = 2;

  public reset(seed = WORLD_CONFIG.defaultSeed): void {
    const rng = new SeededRng(seed + 109);
    // Randomize flight direction (0..2pi) and lateral offset across the entire 25 km² 3-island map
    const angle = rng.range(0, Math.PI * 2);
    const halfLen = 2450;
    const alt = WORLD_CONFIG.planeAltitudeMeters;
    const perpX = -Math.sin(angle);
    const perpZ = Math.cos(angle);
    const lateralOffset = rng.range(-650, 650);
    this.planeStart.set(-Math.cos(angle) * halfLen + perpX * lateralOffset, alt, -Math.sin(angle) * halfLen + perpZ * lateralOffset);
    this.planeEnd.set(Math.cos(angle) * halfLen + perpX * lateralOffset, alt, Math.sin(angle) * halfLen + perpZ * lateralOffset);
    this.planeDir.subVectors(this.planeEnd, this.planeStart).normalize();
    this.planeProgress = 0.02;
    this.planePos.lerpVectors(this.planeStart, this.planeEnd, this.planeProgress);
    this.nextBotDropProgress = 0.12;
    this.botsRemainingToSpawn = WORLD_CONFIG.totalBattleRoyaleCombatants - 1;
    this.countdownSec = 1.5;
  }

  public canJump(): boolean {
    return this.countdownSec <= 0 && this.planeProgress < 0.94;
  }

  public getRemainingPassengers(playerInPlane: boolean): number {
    return Math.max(0, this.botsRemainingToSpawn + (playerInPlane ? 1 : 0));
  }
}
