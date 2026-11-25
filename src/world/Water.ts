/**
 * Crisp Low-Poly 3-Island Water System (Zero Z-Fighting & Clean Aerial Rendering):
 * 1. Single uniform ocean & sea straits grid spanning [-2500, 2500] + outer horizon sea (y = -0.35 m).
 * 2. Elevated organic Inland Lakes (y = 8.6 m & 6.4 m) inside the 15 km² island (zero sea overlap!).
 * 3. Hydro Dam Canyon Reservoir Lake (y = 39.2 m) + Downstream & West-to-Center River channels
 *    stopping smoothly cleanly above ocean water level so planes never overlap/Z-fight.
 */

import * as THREE from 'three';
import { WORLD_CONFIG } from '../core/Config';
import {
  evalInlandLakeDist,
  INLAND_LAKES,
  ISLAND_HALF_SIZE,
  sampleIslandHeight,
  sampleRiverCenterX,
  sampleRiverWaterY,
} from './Terrain';

export interface IslandWaterSystem {
  group: THREE.Group;
  update: (elapsedSec: number, sunDir: THREE.Vector3, fogColor: THREE.Color, fogDensity: number) => void;
  dispose: () => void;
}

const OceanShader = {
  uniforms: {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.7, 0.4, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uSkyHorizon: { value: new THREE.Color(0xa6c5df) },
    uFogColor: { value: new THREE.Color(0x9fbcd6) },
    uFogDensity: { value: 0.00020 },
    uShallowColor: { value: new THREE.Color(0x28b6d0) },
    uDeepColor: { value: new THREE.Color(0x0c4b7a) },
  },
  vertexShader: `
    attribute float aBedDepth;
    varying float vBedDepth;
    varying vec3 vWorldPos;
    varying float vCamDist;
    void main() {
      vBedDepth = aBedDepth;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vCamDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyHorizon;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uShallowColor;
    uniform vec3 uDeepColor;

    varying float vBedDepth;
    varying vec3 vWorldPos;
    varying float vCamDist;

    float waveHeight(vec2 p, float t) {
      float w1 = sin(p.x * 0.07 + p.y * 0.05 + t * 1.2) * 0.30;
      float w2 = cos(p.x * 0.12 - p.y * 0.09 + t * 1.6) * 0.18;
      return w1 + w2;
    }

    void main() {
      if (vBedDepth < -0.25) discard;

      float eps = 0.65;
      vec2 p = vWorldPos.xz;
      float hC = waveHeight(p, uTime);
      float hX = waveHeight(p + vec2(eps, 0.0), uTime);
      float hZ = waveHeight(p + vec2(0.0, eps), uTime);
      vec3 normal = normalize(vec3((hC - hX) * 0.14, 1.0, (hC - hZ) * 0.14));

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fresnel = pow(1.0 - ndotv, 3.6) * 0.58 + 0.06;

      float depthFactor = clamp(vBedDepth / 3.8, 0.0, 1.0);
      vec3 waterCol = mix(uShallowColor, uDeepColor, depthFactor);

      waterCol = mix(waterCol, uSkyHorizon * 0.94, fresnel * 0.62);
      vec3 halfDir = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 160.0) * 0.58;
      waterCol += uSunColor * spec;

      // Crisp clean shoreline foam strictly at shallow coast edge (zero striped rings)
      float shoreFoam = (1.0 - smoothstep(0.02, 0.72, vBedDepth)) * 0.55;
      waterCol = mix(waterCol, vec3(0.92, 0.97, 1.0), shoreFoam);

      float edgeAlpha = smoothstep(-0.08, 0.28, vBedDepth);
      float fogFactor = 1.0 - exp(-pow(uFogDensity * vCamDist, 2.0));
      float farFade = smoothstep(5200.0, 8200.0, vCamDist);
      waterCol = mix(waterCol, uFogColor, clamp(max(fogFactor, farFade), 0.0, 1.0));

      gl_FragColor = vec4(waterCol, edgeAlpha);
    }
  `,
};

const InlandWaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.7, 0.4, 0.4).normalize() },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uSkyHorizon: { value: new THREE.Color(0xb2d8f2) },
    uFogColor: { value: new THREE.Color(0xb2d8f2) },
    uFogDensity: { value: 0.00014 },
    uFlowSpeed: { value: 1.8 },
  },
  vertexShader: `
    attribute float aShoreDepth;
    varying float vShoreDepth;
    varying vec3 vWorldPos;
    varying float vCamDist;
    void main() {
      vShoreDepth = aShoreDepth;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vec4 mv = viewMatrix * wp;
      vCamDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyHorizon;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uFlowSpeed;

    varying float vShoreDepth;
    varying vec3 vWorldPos;
    varying float vCamDist;

    float streamWave(vec2 p, float t, float flow) {
      float downstream = p.y - t * flow * 2.0;
      float w1 = sin(p.x * 0.36 + downstream * 0.22 + t * 1.4) * 0.28;
      float w2 = cos(p.x * 0.58 - downstream * 0.42 - t * 1.8) * 0.18;
      return w1 + w2;
    }

    void main() {
      if (vShoreDepth < -0.15) discard;

      vec2 p = vWorldPos.xz;
      float eps = 0.38;
      float hC = streamWave(p, uTime, uFlowSpeed);
      float hX = streamWave(p + vec2(eps, 0.0), uTime, uFlowSpeed);
      float hZ = streamWave(p + vec2(0.0, eps), uTime, uFlowSpeed);
      vec3 normal = normalize(vec3((hC - hX) * 0.18, 1.0, (hC - hZ) * 0.18));

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float ndotv = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fresnel = pow(1.0 - ndotv, 3.6) * 0.52 + 0.08;

      float depthT = clamp(vShoreDepth / 3.2, 0.0, 1.0);
      vec3 shallowCol = vec3(0.16, 0.62, 0.78);
      vec3 deepCol = vec3(0.06, 0.31, 0.54);
      vec3 col = mix(shallowCol, deepCol, depthT);

      col = mix(col, uSkyHorizon * 0.88, fresnel * 0.48);

      vec3 halfDir = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 150.0) * 0.52;
      col += uSunColor * spec;

      float shoreFoam = (1.0 - smoothstep(0.02, 0.48, vShoreDepth)) * 0.32;
      col = mix(col, vec3(0.88, 0.95, 1.0), shoreFoam);

      float edgeAlpha = smoothstep(-0.04, 0.22, vShoreDepth) * 0.96;
      float fogFactor = 1.0 - exp(-pow(uFogDensity * vCamDist, 2.0));
      col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

      gl_FragColor = vec4(col, edgeAlpha);
    }
  `,
};

export function createIslandWaterSystem(): IslandWaterSystem {
  const group = new THREE.Group();
  group.name = 'Island_Water_System';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Uniform 96×96 Sea Grid across [-2500, 2500]
  const gridSegs = 96;
  const cols = gridSegs + 1;
  const seaPos: number[] = [];
  const seaDepth: number[] = [];
  const seaIdx: number[] = [];
  const seaStep = (ISLAND_HALF_SIZE * 2) / gridSegs;

  for (let iz = 0; iz <= gridSegs; iz++) {
    const wz = -ISLAND_HALF_SIZE + iz * seaStep;
    for (let ix = 0; ix <= gridSegs; ix++) {
      const wx = -ISLAND_HALF_SIZE + ix * seaStep;
      seaPos.push(wx, WORLD_CONFIG.oceanWaterLevel, wz);
      const bedY = sampleIslandHeight(wx, wz);
      seaDepth.push(Math.max(-2.0, WORLD_CONFIG.oceanWaterLevel - bedY));
    }
  }
  for (let iz = 0; iz < gridSegs; iz++) {
    for (let ix = 0; ix < gridSegs; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      seaIdx.push(a, c, b, b, c, d);
    }
  }

  const oceanGeo = new THREE.BufferGeometry();
  oceanGeo.setAttribute('position', new THREE.Float32BufferAttribute(seaPos, 3));
  oceanGeo.setAttribute('aBedDepth', new THREE.Float32BufferAttribute(seaDepth, 1));
  oceanGeo.setIndex(seaIdx);
  geometries.push(oceanGeo);

  const oceanMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(OceanShader.uniforms),
    vertexShader: OceanShader.vertexShader,
    fragmentShader: OceanShader.fragmentShader,
    transparent: true,
    depthWrite: true,
  });
  materials.push(oceanMat);

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.name = 'Island_Ocean_And_Straits';
  oceanMesh.userData.noCollide = true;
  group.add(oceanMesh);

  // 1B. Outer Horizon Sea Ring beyond [-2500, 2500] out to 9,200 m
  const outerSegs = 64;
  const outerPos: number[] = [];
  const outerDepth: number[] = [];
  const outerIdx: number[] = [];
  const outerRadii = [2450, 4400, 9200];
  for (let r = 0; r < outerRadii.length; r++) {
    const rad = outerRadii[r];
    for (let s = 0; s <= outerSegs; s++) {
      const ang = (s / outerSegs) * Math.PI * 2;
      const vx = Math.cos(ang) * rad;
      const vz = Math.sin(ang) * rad;
      outerPos.push(vx, WORLD_CONFIG.oceanWaterLevel - 0.04, vz);
      outerDepth.push(8.0);
    }
  }
  const oStride = outerSegs + 1;
  for (let r = 0; r < outerRadii.length - 1; r++) {
    for (let s = 0; s < outerSegs; s++) {
      const i0 = r * oStride + s;
      const i1 = i0 + 1;
      const i2 = i0 + oStride;
      const i3 = i2 + 1;
      outerIdx.push(i0, i1, i2, i1, i3, i2);
    }
  }
  const outerGeo = new THREE.BufferGeometry();
  outerGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerPos, 3));
  outerGeo.setAttribute('aBedDepth', new THREE.Float32BufferAttribute(outerDepth, 1));
  outerGeo.setIndex(outerIdx);
  geometries.push(outerGeo);

  const outerOceanMesh = new THREE.Mesh(outerGeo, oceanMat);
  outerOceanMesh.name = 'Horizon_Outer_Ocean';
  outerOceanMesh.userData.noCollide = true;
  group.add(outerOceanMesh);

  // 1C. Elevated Organic Inland Lakes inside 15 km² island (zero sea overlap!)
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(InlandWaterShader.uniforms),
    vertexShader: InlandWaterShader.vertexShader,
    fragmentShader: InlandWaterShader.fragmentShader,
    transparent: true,
    depthWrite: true,
  });
  lakeMat.uniforms.uFlowSpeed.value = 0.18;
  materials.push(lakeMat);

  for (const lake of INLAND_LAKES) {
    const lSegs = 32;
    const lCols = lSegs + 1;
    const lPos: number[] = [];
    const lDepth: number[] = [];
    const lIdx: number[] = [];
    for (let iz = 0; iz <= lSegs; iz++) {
      const wz = lake.cz - lake.rz * 1.25 + (iz / lSegs) * lake.rz * 2.5;
      for (let ix = 0; ix <= lSegs; ix++) {
        const wx = lake.cx - lake.rx * 1.25 + (ix / lSegs) * lake.rx * 2.5;
        lPos.push(wx, lake.waterLevel, wz);
        const bedY = sampleIslandHeight(wx, wz);
        const inside = evalInlandLakeDist(wx, wz, lake) < 1.06;
        lDepth.push(inside ? lake.waterLevel - bedY : -1.0);
      }
    }
    for (let iz = 0; iz < lSegs; iz++) {
      for (let ix = 0; ix < lSegs; ix++) {
        const a = iz * lCols + ix;
        const b = a + 1;
        const c = a + lCols;
        const d = c + 1;
        lIdx.push(a, c, b, b, c, d);
      }
    }
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3));
    lGeo.setAttribute('aShoreDepth', new THREE.Float32BufferAttribute(lDepth, 1));
    lGeo.setIndex(lIdx);
    geometries.push(lGeo);

    const lMesh = new THREE.Mesh(lGeo, lakeMat);
    lMesh.name = `Inland_Lake_${lake.id}`;
    lMesh.userData.noCollide = true;
    group.add(lMesh);
  }

  // 2. Big Hoover Dam Canyon Reservoir Lake (y = 39.2 m spanning upstream canyon behind curved Hoover arch)
  const resSegs = 32;
  const resCols = resSegs + 1;
  const resPos: number[] = [];
  const resDepth: number[] = [];
  const resIdx: number[] = [];
  for (let iz = 0; iz <= resSegs; iz++) {
    const wz = -480 + (iz / resSegs) * 384; // -480 .. -96
    for (let ix = 0; ix <= resSegs; ix++) {
      const wx = -150 + (ix / resSegs) * 420;
      const wy = WORLD_CONFIG.reservoirWaterLevel;
      resPos.push(wx, wy, wz);
      const bedY = sampleIslandHeight(wx, wz);
      resDepth.push(wy - bedY);
    }
  }
  for (let iz = 0; iz < resSegs; iz++) {
    for (let ix = 0; ix < resSegs; ix++) {
      const a = iz * resCols + ix;
      const b = a + 1;
      const c = a + resCols;
      const d = c + 1;
      resIdx.push(a, c, b, b, c, d);
    }
  }
  const reservoirGeo = new THREE.BufferGeometry();
  reservoirGeo.setAttribute('position', new THREE.Float32BufferAttribute(resPos, 3));
  reservoirGeo.setAttribute('aShoreDepth', new THREE.Float32BufferAttribute(resDepth, 1));
  reservoirGeo.setIndex(resIdx);
  geometries.push(reservoirGeo);

  const reservoirMesh = new THREE.Mesh(reservoirGeo, lakeMat);
  reservoirMesh.name = 'Hydro_Reservoir_Lake';
  reservoirMesh.userData.noCollide = true;
  group.add(reservoirMesh);

  // 3. Flowing River Channels (ending cleanly above sea level to avoid ocean shader Z-fighting!)
  const riverMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(InlandWaterShader.uniforms),
    vertexShader: InlandWaterShader.vertexShader,
    fragmentShader: InlandWaterShader.fragmentShader,
    transparent: true,
    depthWrite: true,
  });
  riverMat.uniforms.uFlowSpeed.value = 2.2;
  materials.push(riverMat);

  const rPos: number[] = [];
  const rDepth: number[] = [];
  const rIdx: number[] = [];
  const acrossFracs = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
  let rowIdx = 0;
  for (let z = -54; z <= 920; z += 14) {
    const cx = sampleRiverCenterX(z);
    const wy = Math.max(WORLD_CONFIG.oceanWaterLevel + 0.14, sampleRiverWaterY(z));
    for (let c = 0; c < acrossFracs.length; c++) {
      const wx = cx + acrossFracs[c] * 12.5; // Scarce narrow stream down the deep rocky canyon bed
      const bedY = sampleIslandHeight(wx, z);
      rPos.push(wx, wy, z);
      rDepth.push(wy - bedY);
    }
    if (rowIdx > 0) {
      const rStride = acrossFracs.length;
      const i0 = (rowIdx - 1) * rStride;
      const n0 = rowIdx * rStride;
      for (let c = 0; c < rStride - 1; c++) {
        rIdx.push(i0 + c, n0 + c, i0 + c + 1, i0 + c + 1, n0 + c, n0 + c + 1);
      }
    }
    rowIdx++;
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  rGeo.setAttribute('aShoreDepth', new THREE.Float32BufferAttribute(rDepth, 1));
  rGeo.setIndex(rIdx);
  geometries.push(rGeo);
  const rMesh = new THREE.Mesh(rGeo, riverMat);
  rMesh.name = 'Downstream_Central_River';
  rMesh.userData.noCollide = true;
  group.add(rMesh);

  // West-to-center river tributary (kept strictly above sea level cleanly joining central river)
  const wPos: number[] = [];
  const wDepth: number[] = [];
  const wIdx: number[] = [];
  const wAcross = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0];
  let wRow = 0;
  for (let x = -300; x <= 110; x += 14) {
    const xt = Math.max(0, Math.min(1, (x - -380) / 520));
    const smoothT = xt * xt * (3 - 2 * xt);
    const cz = 150 + (260 - 150) * smoothT + Math.sin(x * 0.015) * 32;
    const wy = WORLD_CONFIG.oceanWaterLevel + 0.12 + (sampleRiverWaterY(240) - WORLD_CONFIG.oceanWaterLevel) * smoothT;
    for (let c = 0; c < wAcross.length; c++) {
      const wz = cz + wAcross[c] * 32;
      const bedY = sampleIslandHeight(x, wz);
      wPos.push(x, wy, wz);
      wDepth.push(wy - bedY);
    }
    if (wRow > 0) {
      const s = wAcross.length;
      const i0 = (wRow - 1) * s;
      const n0 = wRow * s;
      for (let c = 0; c < s - 1; c++) {
        wIdx.push(i0 + c, i0 + c + 1, n0 + c, i0 + c + 1, n0 + c + 1, n0 + c);
      }
    }
    wRow++;
  }
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  wGeo.setAttribute('aShoreDepth', new THREE.Float32BufferAttribute(wDepth, 1));
  wGeo.setIndex(wIdx);
  geometries.push(wGeo);
  const wMesh = new THREE.Mesh(wGeo, riverMat);
  wMesh.name = 'West_To_Center_River';
  wMesh.userData.noCollide = true;
  group.add(wMesh);

  return {
    group,
    update: (elapsedSec, sunDir, fogColor, fogDensity) => {
      oceanMat.uniforms.uTime.value = elapsedSec;
      (oceanMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
      (oceanMat.uniforms.uFogColor.value as THREE.Color).copy(fogColor);
      (oceanMat.uniforms.uSkyHorizon.value as THREE.Color).copy(fogColor);
      oceanMat.uniforms.uFogDensity.value = fogDensity;

      for (const m of [lakeMat, riverMat]) {
        m.uniforms.uTime.value = elapsedSec;
        (m.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
        (m.uniforms.uFogColor.value as THREE.Color).copy(fogColor);
        (m.uniforms.uSkyHorizon.value as THREE.Color).copy(fogColor);
        m.uniforms.uFogDensity.value = fogDensity;
      }
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
