import * as THREE from 'three';
import { craftedBox } from './geometry';
import { ProceduralTextures } from './textures';
import { GrenadeId } from './types';
import { weaponDecal } from './modelDecals';

/** Low-poly stylized ordnance matching M67 Frag, M84 Flashbang, M18 Smoke & Flaming Molotov references. */
export function buildThrowable(
  id: GrenadeId,
  textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const root = new THREE.Group();
  root.name = `${id}-throwable`;

  const mat = (
    color: number,
    metalness: number,
    roughness: number,
    flatShading = true,
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      flatShading,
      normalMap: textures.gunMetalNormal,
      normalScale: new THREE.Vector2(0.08, 0.08),
    });
    materials.push(m);
    return m;
  };

  const add = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    target: THREE.Group = root,
  ) => {
    geometries.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    target.add(mesh);
    return mesh;
  };

  if (id === 'molotov') {
    const glassAmber = new THREE.MeshPhysicalMaterial({
      color: 0x6f4318,
      metalness: 0.06,
      roughness: 0.14,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });
    materials.push(glassAmber);

    const bottleProfile = [
      new THREE.Vector2(0, -0.095),
      new THREE.Vector2(0.032, -0.095),
      new THREE.Vector2(0.034, -0.072),
      new THREE.Vector2(0.033, 0.008),
      new THREE.Vector2(0.014, 0.048),
      new THREE.Vector2(0.013, 0.082),
      new THREE.Vector2(0.016, 0.087),
      new THREE.Vector2(0.011, 0.087),
    ];
    add(new THREE.LatheGeometry(bottleProfile, 10), glassAmber);

    // Dark amber liquid fill inside lower half of low-poly bottle
    const liquidMat = mat(0x3a1c08, 0.1, 0.25);
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.092, 10), liquidMat, 0, -0.042, 0);

    // Torn parchment bottle label + red flammable hazard diamond
    const labelPaper = mat(0xcbb793, 0, 0.92);
    const labelMesh = add(
      new THREE.CylinderGeometry(0.0342, 0.0342, 0.056, 10, 1, true, -0.95, 1.9),
      labelPaper,
      0,
      -0.028,
      0,
    );
    labelMesh.rotation.y = Math.PI * 0.5;
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xbf2c22 });
    const innerHazard = new THREE.MeshBasicMaterial({ color: 0xf4a836 });
    materials.push(hazardMat, innerHazard);
    const diamond = add(new THREE.PlaneGeometry(0.026, 0.026), hazardMat, -0.015, -0.028, 0.033);
    diamond.rotation.set(0, -0.35, Math.PI / 4);
    const flameCoreIcon = add(new THREE.PlaneGeometry(0.014, 0.014), innerHazard, -0.0155, -0.028, 0.0335);
    flameCoreIcon.rotation.set(0, -0.35, Math.PI / 4);

    // Twisted soaked cloth wick emerging from neck
    const wickMat = mat(0xb89c78, 0, 0.96);
    const wickLower = add(new THREE.CylinderGeometry(0.009, 0.01, 0.038, 7), wickMat, 0.004, 0.096, 0);
    wickLower.rotation.z = 0.28;
    const wickTip = add(new THREE.ConeGeometry(0.011, 0.032, 7), wickMat, 0.015, 0.118, 0);
    wickTip.rotation.z = 0.55;

    // Stylized flickering low-poly flame plume on wick tip
    const flameGroup = new THREE.Group();
    flameGroup.name = 'molotov-flame';
    flameGroup.position.set(0.016, 0.125, 0);
    root.add(flameGroup);

    const outerFlame = new THREE.MeshBasicMaterial({
      color: 0xff6a14,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerFlame = new THREE.MeshBasicMaterial({
      color: 0xffdf59,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(outerFlame, innerFlame);

    const flameConeA = add(new THREE.ConeGeometry(0.022, 0.072, 6), outerFlame, 0, 0.026, 0, flameGroup);
    flameConeA.rotation.z = -0.18;
    const flameConeB = add(new THREE.ConeGeometry(0.013, 0.048, 5), innerFlame, -0.002, 0.018, 0, flameGroup);
    flameConeB.rotation.z = -0.12;
    const flameConeC = add(new THREE.ConeGeometry(0.015, 0.045, 5), outerFlame, 0.008, 0.022, 0.004, flameGroup);
    flameConeC.rotation.z = -0.34;
    root.userData.flameGroup = flameGroup;
    return root;
  }

  const bodyColor =
    id === 'frag' ? 0x4b5328 : id === 'flashbang' ? 0x3b403c : 0x626c47;
  const olive = mat(bodyColor, id === 'flashbang' ? 0.55 : 0.3, 0.6);
  const dark = mat(0x202325, 0.52, 0.54);
  const steel = mat(0xa8abb0, 0.85, 0.3);
  const collarMat = mat(id === 'smoke' ? 0x868a84 : 0x2f3335, 0.68, 0.4);

  if (id === 'frag') {
    // Low-poly M67 Frag baseball steel sphere (12x8 crisp faceted low-poly)
    const body = add(new THREE.SphereGeometry(0.047, 12, 8), olive, 0, -0.011, 0);
    body.scale.set(1, 1.06, 1);
    add(new THREE.CylinderGeometry(0.0475, 0.0475, 0.004, 12), mat(0xcfa842, 0.2, 0.55), 0, -0.024, 0);
    add(new THREE.CylinderGeometry(0.018, 0.025, 0.018, 10), dark, 0, 0.039, 0);
    // Bold yellow M67 FRAG stencil curved neatly across front-facing hemisphere
    const label = weaponDecal(textures, 4, 0.088, 0.022, geometries, materials);
    label.position.set(-0.008, -0.005, 0.0465);
    label.rotation.y = -0.18;
    root.add(label);
  } else if (id === 'flashbang') {
    // M84 stun canister: faceted dark steel cylinder + chamfered hex top nut + bottom vents
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.118, 10), olive, 0, -0.008, 0);
    add(new THREE.CylinderGeometry(0.024, 0.029, 0.015, 6), collarMat, 0, 0.048, 0);
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.016, 10), dark, 0, -0.058, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const hole = add(
        new THREE.CircleGeometry(0.0042, 6),
        dark,
        Math.cos(a) * 0.0292,
        -0.058,
        Math.sin(a) * 0.0292,
      );
      hole.lookAt(Math.cos(a), hole.position.y, Math.sin(a));
    }
    const label = weaponDecal(textures, 5, 0.072, 0.017, geometries, materials);
    label.position.set(-0.006, 0.002, 0.0285);
    label.rotation.y = -0.22;
    root.add(label);
  } else {
    // M18 Smoke canister: matte olive cylinder + chamfered silver neck + top ring band
    add(new THREE.CylinderGeometry(0.0285, 0.0285, 0.118, 12), olive, 0, -0.008, 0);
    add(new THREE.CylinderGeometry(0.022, 0.0285, 0.016, 12), collarMat, 0, 0.049, 0);
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.008, 12), mat(0xd8dcd4, 0.1, 0.7), 0, 0.036, 0);
    add(new THREE.CylinderGeometry(0.029, 0.029, 0.008, 12), dark, 0, -0.064, 0);
    const label = weaponDecal(textures, 6, 0.075, 0.019, geometries, materials);
    label.position.set(-0.006, 0.002, 0.0292);
    label.rotation.y = -0.22;
    root.add(label);
  }

  // Fuze head, safety spoon lever & pull ring (exposed to left fingers during grenade arming)
  const fuze = add(craftedBox(0.022, 0.014, 0.034, true), dark, 0.002, 0.059, 0.004);
  fuze.rotation.z = -0.1;
  const spoon = add(craftedBox(0.011, 0.068, 0.006, true), id === 'frag' ? mat(0x7c7e76, 0.7, 0.42) : dark, 0.029, 0.023, 0.018);
  spoon.rotation.z = 0.25;

  const pinGroup = new THREE.Group();
  pinGroup.name = 'safety-pin-ring';
  pinGroup.position.set(-0.016, 0.051, 0.01);
  root.add(pinGroup);
  add(new THREE.TorusGeometry(0.018, 0.0021, 6, 14), steel, -0.014, -0.002, 0, pinGroup).rotation.y = 0.25;
  const cotterPin = add(new THREE.CylinderGeometry(0.0017, 0.0017, 0.038, 6), steel, 0.01, 0, 0, pinGroup);
  cotterPin.rotation.z = Math.PI / 2;
  root.userData.pullRing = pinGroup;

  return root;
}
