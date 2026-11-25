/**
 * High-Craft C-130J Tactical Transport Aircraft (matte tactical livery, tapered wings with dihedral,
 * 4 Allison turboprop nacelles, spinning 4-blade propellers, cockpit glass, and illuminated rear cargo ramp).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { craftedBox } from '../game/geometry';
import { ProceduralTextures } from '../game/textures';

export interface TransportAirplaneRig {
  group: THREE.Group;
  propellers: THREE.Object3D[];
  rampLight: THREE.PointLight | null;
}

export function buildTransportAirplane(textures?: ProceduralTextures): TransportAirplaneRig {
  const group = new THREE.Group();
  group.name = 'C130_Hercules_Transport';

  // Sleek dark gunmetal C-130J livery with high-visibility tactical gold stripes (matching reference Shot 2 & 10)
  const airframeMat = new THREE.MeshStandardMaterial({
    color: 0x2c333d,
    map: textures?.concreteColor ?? null,
    roughness: 0.56,
    metalness: 0.34,
  });

  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0x212730,
    roughness: 0.62,
    metalness: 0.28,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x161b22,
    roughness: 0.52,
    metalness: 0.42,
  });

  const cockpitGlassMat = new THREE.MeshStandardMaterial({
    color: 0x7bc6ed,
    emissive: 0x1e4f6e,
    emissiveIntensity: 0.5,
    roughness: 0.14,
    metalness: 0.85,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf5b301,
    roughness: 0.42,
    metalness: 0.22,
  });

  // 1. Main cylindrical fuselage
  const fuselageGeo = new THREE.CylinderGeometry(2.45, 2.45, 21.0, 22);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, airframeMat);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  group.add(fuselage);

  // 2. Sculpted nose & radome
  const noseGeo = new THREE.CylinderGeometry(1.15, 2.45, 4.6, 20);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, airframeMat);
  nose.position.set(0, -0.18, 12.6);
  group.add(nose);

  const radome = new THREE.Mesh(new THREE.SphereGeometry(1.18, 16, 12), darkTrimMat);
  radome.scale.set(1.0, 0.92, 1.45);
  radome.position.set(0, -0.3, 15.0);
  group.add(radome);

  // Multi-pane armored cockpit canopy
  const visor = new THREE.Mesh(craftedBox(2.9, 0.95, 2.4), cockpitGlassMat);
  visor.position.set(0, 1.15, 11.4);
  visor.rotation.x = 0.28;
  group.add(visor);

  // 3. Tactical invasion stripe
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.51, 2.51, 1.15, 22), stripeMat);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.set(0, 0, -4.6);
  group.add(stripe);

  // 4. Tapered swept high-mounted transport wings (inner & outer wing panels with slight dihedral)
  const centerWing = new THREE.Mesh(craftedBox(14.0, 0.62, 4.6), airframeMat);
  centerWing.position.set(0, 2.25, 1.2);
  centerWing.castShadow = true;
  group.add(centerWing);

  for (const side of [-1, 1]) {
    const outerWing = new THREE.Mesh(craftedBox(12.2, 0.44, 3.2), airframeMat);
    outerWing.position.set(side * 12.6, 2.15, 0.6);
    outerWing.rotation.y = side * -0.1;
    outerWing.rotation.z = side * -0.025;
    outerWing.castShadow = true;
    group.add(outerWing);

    const tipTank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.4, 12), stripeMat);
    tipTank.rotation.x = Math.PI / 2;
    tipTank.position.set(side * 18.7, 2.0, 0.3);
    group.add(tipTank);
  }

  // 5. Four Allison T56 turboprop engine nacelles + 4-blade spinning propellers
  const propellers: THREE.Object3D[] = [];
  const engineOffsets = [-12.2, -6.2, 6.2, 12.2];
  for (let i = 0; i < engineOffsets.length; i++) {
    const ex = engineOffsets[i];
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 4.6, 12), bellyMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(ex, 1.65, 2.4);
    group.add(nacelle);

    const propPivot = new THREE.Group();
    propPivot.position.set(ex, 1.65, 4.85);

    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 12), stripeMat);
    spinner.rotation.x = Math.PI / 2;
    propPivot.add(spinner);

    const blade1 = new THREE.Mesh(craftedBox(3.5, 0.24, 0.06, true), darkTrimMat);
    const blade2 = new THREE.Mesh(craftedBox(0.24, 3.5, 0.06, true), darkTrimMat);
    propPivot.add(blade1, blade2);

    const blurDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 18),
      new THREE.MeshBasicMaterial({
        color: 0xd0d8e0,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    propPivot.add(blurDisc);

    group.add(propPivot);
    propellers.push(propPivot);
  }

  // 6. Upswept aft tail + illuminated interior cargo ramp bay
  const tailGeo = new THREE.CylinderGeometry(1.5, 2.45, 7.2, 18);
  tailGeo.rotateX(Math.PI / 2);
  const tailCone = new THREE.Mesh(tailGeo, airframeMat);
  tailCone.position.set(0, 0.55, -13.2);
  tailCone.rotation.x = -0.14;
  group.add(tailCone);

  const openRamp = new THREE.Mesh(craftedBox(3.4, 0.24, 4.8), bellyMat);
  openRamp.position.set(0, -1.7, -12.6);
  openRamp.rotation.x = 0.32;
  group.add(openRamp);

  // Warm interior cargo hold recess + bright green go-jump light bar
  const cargoBay = new THREE.Mesh(
    craftedBox(3.2, 2.4, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x26313c, emissive: 0x1b2b34, emissiveIntensity: 0.5, roughness: 0.7 }),
  );
  cargoBay.position.set(0, 0.05, -10.2);
  group.add(cargoBay);

  const jumpLightBar = new THREE.Mesh(
    craftedBox(2.2, 0.22, 0.28, true),
    new THREE.MeshBasicMaterial({ color: 0x4cff8f }),
  );
  jumpLightBar.position.set(0, 1.55, -11.4);
  group.add(jumpLightBar);

  // 7. Swept vertical tail fin + horizontal stabilizers
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(4.8, 0);
  finShape.lineTo(3.2, 6.8);
  finShape.lineTo(1.1, 6.8);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.5, bevelEnabled: false });
  finGeo.translate(-2.4, 0, -0.25);
  finGeo.rotateY(Math.PI / 2);
  const verticalFin = new THREE.Mesh(finGeo, airframeMat);
  verticalFin.position.set(0, 1.9, -13.2);
  group.add(verticalFin);

  const rudderStripe = new THREE.Mesh(craftedBox(0.56, 1.3, 2.8), stripeMat);
  rudderStripe.position.set(0, 7.3, -13.8);
  group.add(rudderStripe);

  const horizStabilizer = new THREE.Mesh(craftedBox(13.8, 0.38, 2.8), airframeMat);
  horizStabilizer.position.set(0, 2.1, -14.2);
  group.add(horizStabilizer);

  // 8. Undercarriage sponsons
  for (const side of [-1, 1]) {
    const sponson = new THREE.Mesh(craftedBox(1.05, 1.15, 6.4), bellyMat);
    sponson.position.set(side * 2.55, -1.35, 0.5);
    group.add(sponson);
  }

  group.traverse((obj) => {
    obj.userData.noCollide = true;
  });

  // Asynchronously swap in the user's uploaded battle_royale_plane.glb in browser / Electron
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const loader = new GLTFLoader();
    loader.load(
      './models/battle_royale_plane.glb',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(0.001, size.x, size.y, size.z);
        const scale = 38.0 / maxDim;

        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        model.scale.setScalar(scale);
        model.traverse((obj) => {
          obj.userData.noCollide = true;
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        group.clear();
        propellers.length = 0;
        group.add(model);
      },
      undefined,
      () => {
        // Fallback to procedural C-130J if GLB is unavailable
      }
    );
  }

  return { group, propellers, rampLight: null };
}
