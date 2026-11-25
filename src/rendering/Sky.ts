/**
 * Atmospheric Sky System:
 * - Analytical Rayleigh/Mie atmospheric shader dome centered on the active camera.
 * - Soft multi-octave procedural cloud deck with crisp pixel-level evaluation (eliminating blurry low-res cubemap seams).
 * - Seamless maritime horizon blending & configurable time-of-day presets.
 * - Optional low-frequency CachedSky IBL/fallback cubemap update preserving pending shadow maps.
 */

import * as THREE from 'three';
import { CachedSky } from '../game/cachedSky';

export type WeatherKind = 'sunny' | 'overcast' | 'light_fog';
export type TimeOfDayPreset = 'daylight' | 'golden' | 'overcast';

export interface WeatherPreset {
  zenith: THREE.Color;
  midSky: THREE.Color;
  horizon: THREE.Color;
  groundHaze: THREE.Color;
  sunDiscColor: THREE.Color;
  cloudCover: number;
  sunStrength: number;
  fogColor: THREE.Color;
  fogDensity: number;
  sunLightColor: THREE.Color;
  sunLightIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  saloonIntensity: number;
  forgeIntensity: number;
  coronaColor: THREE.Color;
  coronaOpacity: number;
  coronaScale: number;
  moteColor: THREE.Color;
  moteOpacity: number;
  wispColor: THREE.Color;
  wispOpacity: number;
  wispSize: number;
  exposure: number;
  envIntensity: number;
  windIntensity: number;
}

export const SUN_DIRECTION = new THREE.Vector3(68, 38, 42).normalize();
export const GOLDEN_SUN_DIRECTION = new THREE.Vector3(82, 18, 48).normalize();

export const SkyDomeShader = {
  uniforms: {
    uZenithColor: { value: new THREE.Color(0x164e96) },
    uMidSkyColor: { value: new THREE.Color(0x4b93d2) },
    uHorizonColor: { value: new THREE.Color(0xc5e1f5) },
    uGroundHazeColor: { value: new THREE.Color(0xa9cbe3) },
    uSunColor: { value: new THREE.Color(0xfff5dc) },
    uSunDir: { value: SUN_DIRECTION.clone() },
    uCloudCover: { value: 0.34 },
    uSunStrength: { value: 0.92 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vWorldDir;
    void main() {
      vWorldDir = normalize(position);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uZenithColor;
    uniform vec3 uMidSkyColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uGroundHazeColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uCloudCover;
    uniform float uSunStrength;
    uniform float uTime;
    varying vec3 vWorldDir;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbmClouds(vec2 p) {
      float v = 0.0;
      float amp = 0.52;
      for (int i = 0; i < 4; i++) {
        v += amp * noise2(p);
        p = p * 2.08 + vec2(13.7, 7.3);
        amp *= 0.48;
      }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldDir);
      float h = clamp(dir.y, 0.0, 1.0);

      // Continuous multi-band Rayleigh gradient from horizon to zenith
      vec3 lowerSky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.28, h));
      vec3 sky = mix(lowerSky, uZenithColor, pow(h, 0.72));

      // Seamless horizon band below eye level (no dark band or sharp seam)
      float below = smoothstep(0.02, -0.22, dir.y);
      sky = mix(sky, uGroundHazeColor, below * 0.92);

      // Solar Mie scatter & subtle disc
      float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
      float horizonScatter = (1.0 - smoothstep(0.0, 0.45, h)) * pow(sunAmt, 4.0);
      sky += vec3(1.0, 0.80, 0.52) * horizonScatter * 0.11 * uSunStrength;
      sky += uSunColor * pow(sunAmt, 20.0) * 0.11 * uSunStrength;
      sky += uSunColor * pow(sunAmt, 120.0) * 0.22 * uSunStrength;
      float sunDisc = smoothstep(0.9991, 0.99975, sunAmt);
      sky += vec3(1.05, 0.96, 0.82) * sunDisc * uSunStrength;

      // Crisp procedural cloud deck fading gracefully toward the horizon
      if (dir.y > 0.01) {
        vec2 cloudUv = dir.xz / (dir.y + 0.24);
        cloudUv.x *= 0.72;
        cloudUv += vec2(uTime * 0.0085, uTime * 0.0032);
        float c1 = fbmClouds(cloudUv * 1.45);
        float c2 = fbmClouds(cloudUv * 3.2 - vec2(uTime * 0.005, 0.0));
        float cloudNoise = c1 * 0.72 + c2 * 0.28;

        float lowEdge = mix(0.56, 0.24, uCloudCover);
        float highEdge = mix(0.86, 0.64, uCloudCover);
        float cloudDensity = smoothstep(lowEdge, highEdge, cloudNoise);
        float horizonFade = smoothstep(0.015, 0.20, dir.y) * (1.0 - smoothstep(0.76, 0.99, dir.y) * 0.22);
        cloudDensity *= horizonFade * mix(0.45, 0.90, uCloudCover);

        vec3 sunnyLit = mix(vec3(0.96, 0.92, 0.86), vec3(1.0, 0.95, 0.82), pow(sunAmt, 2.5));
        vec3 overcastLit = vec3(0.76, 0.79, 0.84);
        vec3 cloudLit = mix(overcastLit, sunnyLit, uSunStrength);

        vec3 sunnyShadow = vec3(0.68, 0.72, 0.79);
        vec3 overcastShadow = vec3(0.47, 0.52, 0.58);
        vec3 cloudShadow = mix(overcastShadow, sunnyShadow, uSunStrength);

        float litFactor = clamp(0.38 + c2 * 0.42 + sunAmt * 0.42 * uSunStrength, 0.0, 1.0);
        vec3 cloudCol = mix(cloudShadow, cloudLit, litFactor);
        sky = mix(sky, cloudCol, cloudDensity);
      }

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export class SkySystem {
  public readonly skyMat: THREE.ShaderMaterial;
  public readonly skyDomeMesh: THREE.Mesh;
  public readonly sunCoronaMat: THREE.SpriteMaterial;
  public readonly sunCoronaSprite: THREE.Sprite;
  public readonly cachedSky: CachedSky;
  private readonly skyGeo: THREE.SphereGeometry;
  private readonly cubemapDome: THREE.Mesh;

  constructor(scene: THREE.Scene, sunCoronaTexture: THREE.Texture) {
    this.skyGeo = new THREE.SphereGeometry(280, 48, 32);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SkyDomeShader.uniforms),
      vertexShader: SkyDomeShader.vertexShader,
      fragmentShader: SkyDomeShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });

    // Direct camera-anchored sky dome prevents blurry cubemap seams at every angle & altitude
    this.skyDomeMesh = new THREE.Mesh(this.skyGeo, this.skyMat);
    this.skyDomeMesh.name = 'AtmosphericSkyDome';
    this.skyDomeMesh.frustumCulled = false;
    this.skyDomeMesh.renderOrder = -1000;
    this.skyDomeMesh.scale.setScalar(14);
    scene.add(this.skyDomeMesh);

    // Secondary cubemap dome kept for scene.background fallback & test compatibility
    this.cubemapDome = new THREE.Mesh(this.skyGeo, this.skyMat);
    this.cachedSky = new CachedSky(this.cubemapDome, scene);

    this.sunCoronaMat = new THREE.SpriteMaterial({
      map: sunCoronaTexture,
      color: 0xffdfa0,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.sunCoronaSprite = new THREE.Sprite(this.sunCoronaMat);
    this.sunCoronaSprite.scale.set(22, 22, 1);
    this.sunCoronaSprite.position.copy(SUN_DIRECTION).multiplyScalar(235);
    scene.add(this.sunCoronaSprite);
  }

  public syncToCamera(
    camera: THREE.PerspectiveCamera,
    isIsland: boolean,
    elapsedSec: number,
    renderer: THREE.WebGLRenderer,
    dt: number,
  ): void {
    this.skyMat.uniforms.uTime.value = elapsedSec;
    // Scale sky dome safely inside the active camera far plane (far * 0.72 / 280)
    const targetScale = isIsland ? 14 : 0.95;
    if (Math.abs(this.skyDomeMesh.scale.x - targetScale) > 0.01) {
      this.skyDomeMesh.scale.setScalar(targetScale);
    }
    this.skyDomeMesh.position.copy(camera.position);
    const sunDir = this.skyMat.uniforms.uSunDir.value as THREE.Vector3;
    const coronaDist = isIsland ? 2600 : 235;
    this.sunCoronaSprite.position.copy(camera.position).addScaledVector(sunDir, coronaDist);
    this.cachedSky.update(renderer, dt);
  }

  public setSunDirection(dir: THREE.Vector3): void {
    (this.skyMat.uniforms.uSunDir.value as THREE.Vector3).copy(dir).normalize();
  }

  public dispose(): void {
    this.skyDomeMesh.removeFromParent();
    this.sunCoronaSprite.removeFromParent();
    this.cachedSky.dispose();
    this.skyGeo.dispose();
    this.skyMat.dispose();
    this.sunCoronaMat.dispose();
  }
}
