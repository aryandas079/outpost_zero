/**
 * Calibrated PBR lighting & shadow cascade/bounds controller.
 * Keeps world lighting, viewmodel lighting, IBL reflections, and weather transitions coherent.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SUN_DIRECTION } from './Sky';

export class LightingRig {
  public readonly envTarget: THREE.WebGLRenderTarget;
  public readonly hemiLight: THREE.HemisphereLight;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly saloonGlow: THREE.PointLight;
  public readonly forgeGlow: THREE.PointLight;
  public readonly impactLight: THREE.PointLight;

  public readonly weaponHemiLight: THREE.HemisphereLight;
  public readonly weaponSunLight: THREE.DirectionalLight;
  public readonly weaponRimLight: THREE.DirectionalLight;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    weaponScene: THREE.Scene,
  ) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = this.envTarget.texture;
    scene.environmentIntensity = 0.56;
    weaponScene.environment = this.envTarget.texture;
    weaponScene.environmentIntensity = 0.68;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0x8bb6e2, 0x3b4834, 0.72);
    this.hemiLight.position.set(0, 120, 0);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0d6, 1.55);
    this.sunLight.position.copy(SUN_DIRECTION).multiplyScalar(120);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.radius = 2.4;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 260;
    const shadowBound = 72;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.00018;
    this.sunLight.shadow.normalBias = 0.025;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x7fb0e0, 0.34);
    this.rimLight.position.set(-55, 28, -45);
    scene.add(this.rimLight);

    this.saloonGlow = new THREE.PointLight(0xffb45c, 3.0, 16, 2);
    this.saloonGlow.position.set(-24, 3.1, -12);
    scene.add(this.saloonGlow);

    this.forgeGlow = new THREE.PointLight(0xff6b26, 4.0, 13, 2);
    this.forgeGlow.position.set(35.2, 2.2, 17.8);
    scene.add(this.forgeGlow);

    this.impactLight = new THREE.PointLight(0xffbe6b, 0, 6.8, 2);
    scene.add(this.impactLight);

    // Viewmodel lighting stays balanced & readable regardless of shadow occluders
    this.weaponHemiLight = new THREE.HemisphereLight(0x9bc4ec, 0x4b4a3e, 0.72);
    this.weaponHemiLight.position.set(0, 70, 0);
    weaponScene.add(this.weaponHemiLight);

    this.weaponSunLight = new THREE.DirectionalLight(0xfff0d6, 1.48);
    this.weaponSunLight.position.copy(SUN_DIRECTION).multiplyScalar(80);
    weaponScene.add(this.weaponSunLight);

    this.weaponRimLight = new THREE.DirectionalLight(0x88bae8, 0.42);
    this.weaponRimLight.position.set(-48, 22, -40);
    weaponScene.add(this.weaponRimLight);
  }

  /**
   * Moves the directional shadow frustum cleanly on texel-snapped steps around the player
   * on the 10 km² island so nearby buildings, trees, and terrain always cast crisp shadows.
   */
  public updateIslandShadowFocus(
    playerPos: THREE.Vector3,
    sunDir: THREE.Vector3,
    renderer: THREE.WebGLRenderer,
    enabled: boolean,
  ): void {
    if (!enabled) return;
    const bound = 88;
    const texelWorld = (bound * 2) / Math.max(512, this.sunLight.shadow.mapSize.width);
    const snapX = Math.round(playerPos.x / texelWorld) * texelWorld;
    const snapZ = Math.round(playerPos.z / texelWorld) * texelWorld;
    const dx = Math.abs(this.sunLight.target.position.x - snapX);
    const dz = Math.abs(this.sunLight.target.position.z - snapZ);
    if (dx > 8 || dz > 8) {
      this.sunLight.target.position.set(snapX, playerPos.y, snapZ);
      this.sunLight.position.set(
        snapX + sunDir.x * 140,
        playerPos.y + sunDir.y * 140,
        snapZ + sunDir.z * 140,
      );
      this.sunLight.target.updateMatrixWorld();
      renderer.shadowMap.needsUpdate = true;
    }
  }

  public syncWeaponLights(envIntensity: number, weaponScene: THREE.Scene): void {
    this.weaponSunLight.color.copy(this.sunLight.color);
    this.weaponSunLight.intensity = Math.max(1.25, this.sunLight.intensity);
    this.weaponHemiLight.color.copy(this.hemiLight.color);
    this.weaponHemiLight.groundColor.copy(this.hemiLight.groundColor);
    this.weaponHemiLight.intensity = Math.max(0.65, this.hemiLight.intensity);
    this.weaponRimLight.color.copy(this.rimLight.color);
    this.weaponRimLight.intensity = Math.max(0.35, this.rimLight.intensity);
    weaponScene.environmentIntensity = Math.max(0.58, envIntensity);
  }

  public dispose(): void {
    this.envTarget.dispose();
  }
}
