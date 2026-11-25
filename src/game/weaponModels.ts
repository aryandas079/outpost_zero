import * as THREE from 'three';
import { craftedBox } from './geometry';
import { ProceduralTextures } from './textures';
import { WeaponId } from './types';
import { weaponDecal } from './modelDecals';

/** First-person low-poly armory models in metres; barrels point down -Z. */
export function buildArmoryWeapon(
  id: WeaponId,
  textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const root = new THREE.Group();
  let attachment = root;
  root.name = `${id}-weapon`;

  const material = (
    color: number,
    metalness: number,
    roughness: number,
    textured = true,
    flatShading = true,
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      flatShading,
      normalMap: textured ? textures.gunMetalNormal : null,
      normalScale: new THREE.Vector2(0.06, 0.06),
    });
    materials.push(m);
    return m;
  };

  const brushedSilver = id === 'deagle';
  const steel = material(
    brushedSilver ? 0xc0c6cc : id === 'usp' || id === 'glock' ? 0x454a4f : 0x484e54,
    brushedSilver ? 0.86 : 0.72,
    brushedSilver ? 0.26 : 0.42,
  );
  steel.roughnessMap = textures.gunMetalRoughness;
  const dark = material(0x16191d, 0.52, 0.44);
  const matteBlack = material(0x1e2227, 0.25, 0.56);
  const rubber = material(0x16181b, 0.02, 0.88);
  const polymer = material(0x25292c, 0.06, 0.68);
  const tan = material(0xa2885c, 0.24, 0.54);
  tan.roughnessMap = textures.gunFdeRoughness;
  const olive = material(0x525a38, 0.2, 0.62);
  const canvasOlive = material(0x5d6442, 0, 0.94);
  canvasOlive.map = textures.tacticalSleeveColor;
  const wood = material(0x7c391d, 0.04, 0.58);
  wood.map = textures.woodPlankDarkColor;
  wood.color.setHex(0xb8734b);
  wood.normalMap = textures.woodPlankNormal;
  wood.normalScale.setScalar(0.16);
  const brass = material(0xd2ad56, 0.85, 0.26, false);
  const copper = material(0xb86d3f, 0.78, 0.34, false);

  const glowAmber = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const glowWhite = new THREE.MeshBasicMaterial({ color: 0xf4f9f6 });
  materials.push(glowAmber, glowWhite);

  const mesh = (
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    attachment.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
  ) => mesh(craftedBox(w, h, d, true), mat, x, y, z);
  const tube = (
    r: number,
    length: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    r2 = r,
    sides = 10,
  ) => {
    const m = mesh(new THREE.CylinderGeometry(r, r2, length, sides), mat, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const ring = (
    r: number,
    thickness: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material = steel,
    sides = 10,
  ) => mesh(new THREE.TorusGeometry(r, thickness, 6, sides), mat, x, y, z);

  const profile = (
    points: number[][],
    width: number,
    mat: THREE.Material = steel,
    holes: number[][][] = [],
  ) => {
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width - 0.002,
      bevelEnabled: true,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 6,
    });
    g.translate(0, 0, -(width - 0.002) / 2);
    g.rotateY(-Math.PI / 2);
    return mesh(g, mat, 0, 0, 0);
  };

  const rail = (start: number, end: number, y: number, width = 0.034) => {
    box(width * 0.72, 0.008, end - start, 0, y - 0.004, (start + end) / 2, dark);
    for (let z = start; z < end; z += 0.015) {
      box(width, 0.006, 0.008, 0, y + 0.003, z, dark);
    }
  };
  const muzzle = (z: number, radius: number, y = 0) => {
    root.userData.flashOrigin = new THREE.Vector3(0, y, z);
    ring(radius, 0.0032, 0, y, z, dark, 10);
    tube(radius - 0.003, 0.004, 0, y, z + 0.006, rubber, radius - 0.003, 8);
  };
  const screws = (width: number, positions: number[][]) => {
    for (const side of [-1, 1]) {
      for (const [z, y] of positions) {
        const bolt = tube(0.0032, 0.002, (side * width) / 2, y, z, dark, 0.0032, 6);
        bolt.rotation.set(0, 0, Math.PI / 2);
      }
    }
  };
  const trigger = (z: number) => {
    profile(
      [
        [z + 0.025, -0.04],
        [z - 0.052, -0.04],
        [z - 0.063, -0.084],
        [z - 0.044, -0.103],
        [z + 0.022, -0.103],
      ],
      0.019,
      dark,
      [
        [
          [z + 0.015, -0.048],
          [z + 0.015, -0.094],
          [z - 0.04, -0.094],
          [z - 0.053, -0.081],
          [z - 0.045, -0.048],
        ],
      ],
    );
    const t = box(0.008, 0.028, 0.009, 0, -0.063, z - 0.019, dark);
    t.rotation.x = -0.22;
  };
  const grip = (z: number, mat: THREE.Material = polymer) => {
    profile(
      [
        [z - 0.027, -0.037],
        [z + 0.024, -0.04],
        [z + 0.055, -0.173],
        [z - 0.014, -0.18],
        [z - 0.029, -0.148],
      ],
      0.043,
      mat,
    );
    box(0.046, 0.009, 0.064, 0, -0.176, z + 0.02, rubber);
  };
  const stock = (mat: THREE.Material = polymer) => {
    tube(0.019, 0.15, 0, -0.01, 0.055, dark, 0.019, 8);
    profile(
      [
        [0.02, 0.012],
        [0.18, 0.012],
        [0.21, -0.025],
        [0.21, -0.13],
        [0.17, -0.13],
        [0.12, -0.06],
        [0.02, -0.04],
      ],
      0.045,
      mat,
    );
    box(0.05, 0.145, 0.018, 0, -0.055, 0.21, rubber);
  };
  const sights = (front: number) => {
    for (const x of [-0.017, 0.017]) box(0.008, 0.024, 0.016, x, 0.073, -0.15, dark);
    box(0.042, 0.009, 0.02, 0, 0.059, -0.15, dark);
    box(0.008, 0.032, 0.014, 0, 0.072, front, dark);
    ring(0.014, 0.0028, 0, 0.088, front, dark, 8);
  };
  const holographic = (z = -0.24, yBase = 0.08) => {
    const host = attachment;
    const optic = new THREE.Group();
    optic.name = 'holographic-sight';
    host.add(optic);
    attachment = optic;
    box(0.068, 0.022, 0.092, 0, yBase, z, dark);
    for (const x of [-0.031, 0.031]) {
      const side = box(0.012, 0.07, 0.044, x, yBase + 0.04, z, matteBlack);
      side.rotation.z = x > 0 ? 0.06 : -0.06;
    }
    box(0.064, 0.013, 0.044, 0, yBase + 0.076, z, matteBlack);
    // Low-poly armored hood visor + coated lens + glowing crimson reticle
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x3b635c,
      transparent: true,
      opacity: 0.14,
      roughness: 0.08,
      metalness: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(glass);
    mesh(new THREE.PlaneGeometry(0.046, 0.054), glass, 0, yBase + 0.041, z);
    const reticle = new THREE.MeshBasicMaterial({
      map: textures.holoReticle,
      color: 0xff4526,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(reticle);
    mesh(new THREE.PlaneGeometry(0.024, 0.024), reticle, 0, yBase + 0.041, z + 0.002);
    for (const x of [-0.017, 0.017]) {
      box(0.009, 0.006, 0.003, x, yBase + 0.006, z + 0.048, polymer);
    }
    attachment = host;
    screws(0.068, [[z, yBase]]);
    root.userData.sightHeight = yBase + 0.041;
  };

  const pistol = ['usp', 'glock', 'deagle'].includes(id);
  if (pistol) {
    const heavy = id === 'deagle';
    const isUsp = id === 'usp';
    const front = heavy ? -0.465 : isUsp ? -0.415 : -0.402;
    const width = heavy ? 0.05 : 0.036;
    const slide = new THREE.Group();
    slide.name = 'slide';
    root.add(slide);
    attachment = slide;

    // Chamfered faceted pistol slide with crisp low-poly bevels
    profile(
      [
        [front, 0.021],
        [front + 0.016, 0.035],
        [-0.184, 0.035],
        [-0.165, 0.022],
        [-0.165, -0.018],
        [front, -0.018],
      ],
      width,
      heavy ? steel : steel,
    );

    if (heavy) {
      // Iconic Desert Eagle triangular front shroud & integral ventilated barrel rib
      profile(
        [
          [front, 0.034],
          [front + 0.04, 0.046],
          [-0.258, 0.046],
          [-0.25, 0.034],
        ],
        0.024,
        steel,
      );
      for (let i = 0; i < 6; i++) {
        box(0.025, 0.004, 0.008, 0, 0.047, front + 0.055 + i * 0.02, dark);
      }
    }

    // Slide serrations & ejection port
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const cut = box(
          0.0014,
          0.03,
          0.0022,
          side * (width / 2 + 0.0004),
          0.004,
          -0.18 - i * 0.006,
          dark,
        );
        cut.rotation.x = -0.14;
      }
    }
    box(0.016, 0.0016, 0.036, 0.009, 0.036, -0.268, dark);
    box(0.012, 0.0022, 0.029, 0.009, 0.035, -0.268, heavy ? steel : dark);

    // Three-dot glowing iron sights (yellow tritium on Glock 17, crisp white dots on USP 9, dark blade on Deagle)
    const dotMat = id === 'glock' ? glowAmber : isUsp ? glowWhite : steel;
    for (const x of [-0.012, 0.012]) {
      box(0.007, 0.01, 0.011, x, 0.04, -0.182, dark);
      tube(0.002, 0.002, x, 0.042, -0.175, dotMat, 0.002, 6);
    }
    box(0.0045, 0.011, 0.013, 0, 0.04, front + 0.019, dark);
    tube(0.002, 0.002, 0, 0.043, front + 0.026, dotMat, 0.002, 6);

    attachment = root;
    // Frame, trigger guard, wrap-around grip, exposed spur hammer & removable magazine
    profile(
      [
        [front + 0.008, -0.019],
        [-0.168, -0.019],
        [-0.165, -0.052],
        [-0.222, -0.058],
        [front + 0.018, -0.041],
      ],
      width - 0.003,
      heavy ? steel : polymer,
    );

    grip(-0.205, heavy ? rubber : polymer);
    trigger(-0.245);

    // Removable magazine inside pistol grip for tactile/empty reload drop-and-insert
    const magPivot = new THREE.Group();
    magPivot.name = 'mag';
    root.add(magPivot);
    attachment = magPivot;
    const pMag = box(0.028, 0.115, 0.042, 0, -0.125, -0.186, heavy ? steel : dark);
    pMag.rotation.x = 0.24;
    const magPad = box(0.038, 0.012, 0.052, 0, -0.182, -0.172, rubber);
    magPad.rotation.x = 0.24;
    attachment = root;

    tube(heavy ? 0.013 : 0.011, 0.018, 0, 0.004, front - 0.003, dark, heavy ? 0.013 : 0.011, 10);
    muzzle(front - 0.013, heavy ? 0.013 : 0.011, 0.004);
    box(0.004, 0.007, 0.028, -width / 2 - 0.002, -0.031, -0.228, dark);

    // Exposed external hammer spur on USP 9 & Desert Eagle
    if (isUsp || heavy) {
      const hammer = box(0.012, 0.022, 0.016, 0, 0.014, -0.155, heavy ? steel : dark);
      hammer.rotation.x = -0.35;
    }

    for (const side of [-1, 1]) {
      const panel = box(0.0025, 0.074, 0.038, side * 0.023, -0.112, -0.184, rubber);
      panel.rotation.x = -0.18;
      box(0.003, 0.006, 0.009, side * 0.025, -0.06, -0.202, dark);
    }
    for (let i = 0; i < 3; i++) {
      box(width, 0.003, 0.0025, 0, -0.04, front + 0.03 + i * 0.013, dark);
    }
    screws(width, [[-0.23, -0.033]]);
  } else if (id === 'rpg') {
    root.userData.flashOrigin = new THREE.Vector3(0, 0, -1.11);
    tube(0.036, 0.88, 0, 0, -0.36, dark, 0.036, 12);
    // Warm reddish-brown mahogany wooden heatshield & steel clamp rings
    tube(0.041, 0.31, 0, 0, -0.19, wood, 0.041, 10);
    tube(0.066, 0.11, 0, 0, 0.11, dark, 0.036, 10);
    for (const z of [-0.37, -0.03]) ring(0.042, 0.0035, 0, 0, z, dark, 10);
    for (const z of [-0.34, -0.29, -0.24, -0.19, -0.14, -0.09]) {
      ring(0.042, 0.0014, 0, 0, z, steel, 10);
    }
    for (const z of [-0.62, -0.58]) ring(0.038, 0.0025, 0, 0, z, steel, 10);

    // Front & rear dark wood/polymer RPG pistol grips
    grip(-0.172, wood);
    grip(-0.455, polymer);
    trigger(-0.212);

    // Detachable / reloadable PG-7V conical green warhead
    const warhead = new THREE.Group();
    warhead.name = 'warhead';
    root.add(warhead);
    attachment = warhead;
    tube(0.038, 0.135, 0, 0, -0.83, olive, 0.078, 10);
    tube(0.078, 0.16, 0, 0, -0.975, olive, 0.015, 10);
    tube(0.015, 0.056, 0, 0, -1.08, dark, 0.006, 8);
    ring(0.078, 0.0025, 0, 0, -0.898, steel, 10);
    attachment = root;

    // Iconic tall open ladder & aperture sights matching 26534f87
    profile(
      [
        [-0.215, 0.034],
        [-0.215, 0.21],
        [-0.178, 0.232],
        [-0.148, 0.21],
        [-0.148, 0.034],
      ],
      0.01,
      dark,
      [
        [
          [-0.2, 0.076],
          [-0.162, 0.076],
          [-0.162, 0.198],
          [-0.179, 0.214],
          [-0.2, 0.196],
        ],
      ],
    );
    for (const y of [0.08, 0.115, 0.15, 0.185]) box(0.016, 0.003, 0.032, 0, y, -0.182, steel);
    ring(0.011, 0.003, 0, 0.115, -0.185, steel, 8);
    profile(
      [
        [-0.535, 0.035],
        [-0.514, 0.198],
        [-0.48, 0.198],
        [-0.48, 0.035],
      ],
      0.008,
      dark,
      [
        [
          [-0.522, 0.072],
          [-0.489, 0.072],
          [-0.489, 0.18],
          [-0.514, 0.18],
        ],
      ],
    );
    box(0.018, 0.024, 0.02, 0, 0.049, -0.75, dark);
  } else if (id === 'grenadelauncher') {
    // GL-1 Heavy Barrel, Tall Calibrated Ladder Sight & Swing-Out Rotary Drum
    tube(0.049, 0.29, 0, 0, -0.64, dark, 0.049, 10);
    muzzle(-0.79, 0.049);

    // Z-axis crane hinge below-left of drum (-0.048, -0.105, -0.375) so rotation.z = +0.95 swings cylinder OPEN LEFT facing camera!
    const drumPivot = new THREE.Group();
    drumPivot.name = 'drum';
    drumPivot.position.set(-0.048, -0.105, -0.375);
    root.add(drumPivot);
    attachment = drumPivot;
    tube(0.082, 0.195, 0.048, 0.06, 0, steel, 0.082, 12);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      tube(0.028, 0.198, 0.048 + Math.sin(a) * 0.056, 0.06 + Math.cos(a) * 0.056, 0, dark, 0.028, 8);
    }
    for (const z of [-0.102, 0.102]) tube(0.085, 0.012, 0.048, 0.06, z, steel, 0.085, 12);

    // Visible 40mm grenade round inside chamber mouth during lock-in phase of reload
    const chamberRound = new THREE.Group();
    chamberRound.name = 'drumRound';
    chamberRound.position.set(0.048, 0.116, 0.02);
    tube(0.025, 0.095, 0, 0, 0, olive, 0.025, 8).parent?.remove;
    const cShell = new THREE.CylinderGeometry(0.024, 0.025, 0.082, 8);
    cShell.rotateX(Math.PI / 2);
    const cRim = new THREE.CylinderGeometry(0.027, 0.027, 0.012, 8);
    cRim.rotateX(Math.PI / 2);
    geometries.push(cShell, cRim);
    const mShell = new THREE.Mesh(cShell, olive);
    mShell.position.z = -0.018;
    const mRim = new THREE.Mesh(cRim, brass);
    mRim.position.z = 0.026;
    chamberRound.add(mShell, mRim);
    drumPivot.add(chamberRound);

    attachment = root;
    profile(
      [
        [-0.495, 0.066],
        [-0.17, 0.066],
        [-0.13, -0.036],
        [-0.27, -0.066],
        [-0.27, 0.035],
        [-0.495, 0.035],
      ],
      0.046,
      matteBlack,
    );
    rail(-0.7, -0.25, 0.077);
    grip(-0.18, polymer);
    trigger(-0.22);
    stock(polymer);

    // Vertical forward grip held by left hand
    box(0.034, 0.128, 0.038, 0, -0.098, -0.595, polymer);
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        box(0.003, 0.015, 0.013, side * 0.049, 0, -0.55 - i * 0.028, rubber);
      }
    }

    // Tall folding GL-1 range-finder ladder sight matching 215fb7dc
    profile(
      [
        [-0.64, 0.078],
        [-0.635, 0.255],
        [-0.595, 0.255],
        [-0.59, 0.078],
      ],
      0.014,
      dark,
      [
        [
          [-0.63, 0.105],
          [-0.6, 0.105],
          [-0.6, 0.238],
          [-0.63, 0.238],
        ],
      ],
    );
    for (const ry of [0.125, 0.155, 0.185, 0.215]) {
      box(0.024, 0.003, 0.026, 0, ry, -0.615, steel);
    }
    const glMarking = weaponDecal(textures, 11, 0.12, 0.016, geometries, materials);
    glMarking.rotation.y = -Math.PI / 2;
    glMarking.position.set(-0.025, 0.01, -0.26);
    root.add(glMarking);
    box(0.044, 0.028, 0.028, 0, 0.09, -0.22, dark);
  } else {
    // SMG (HK MP5), SHOTGUN, MACHINEGUN (M249 LMG), MARKSMAN (SCAR 20S DMR)
    const smg = id === 'smg';
    const shotgun = id === 'shotgun';
    const lmg = id === 'machinegun';
    const dmr = id === 'marksman';
    const finish = dmr ? tan : matteBlack;
    const front = smg ? -0.635 : shotgun ? -0.895 : dmr ? -0.95 : -0.93;

    // Upper & lower receiver silhouette
    profile(
      [
        [-0.41, -0.04],
        [-0.41, 0.028],
        [-0.365, 0.048],
        [-0.095, 0.048],
        [-0.055, 0.018],
        [-0.068, -0.042],
      ],
      smg ? 0.045 : 0.062,
      finish,
    );
    if (dmr) {
      box(0.056, 0.048, 0.31, 0, -0.018, -0.22, tan);
      box(0.054, 0.016, 0.03, 0, 0.046, -0.1, dark);
    }
    grip(-0.148, rubber);
    trigger(-0.19);
    stock(dmr ? tan : polymer);

    tube(
      shotgun ? 0.014 : 0.0115,
      Math.abs(front + 0.36),
      0,
      0.017,
      (front - 0.36) / 2,
      dark,
      shotgun ? 0.014 : 0.0115,
      10,
    );
    muzzle(front, shotgun ? 0.014 : 0.0115, 0.017);

    if (smg) {
      // HK MP5: cocking tube + animated HK-slap charging handle + wide ribbed handguard + curved stick mag + hooded front sight
      tube(0.023, 0.25, 0, 0.017, -0.4, steel, 0.023, 10);
      profile(
        [
          [-0.56, 0.01],
          [-0.38, 0.01],
          [-0.36, -0.036],
          [-0.55, -0.028],
        ],
        0.049,
        rubber,
      );
      for (let i = 0; i < 6; i++) {
        box(0.051, 0.004, 0.008, 0, -0.018, -0.41 - i * 0.024, dark);
      }

      // Removable curved HK MP5 magazine
      const magGroup = new THREE.Group();
      magGroup.name = 'mag';
      root.add(magGroup);
      attachment = magGroup;
      profile(
        [
          [-0.31, -0.04],
          [-0.268, -0.04],
          [-0.265, -0.132],
          [-0.236, -0.236],
          [-0.281, -0.248],
          [-0.31, -0.14],
        ],
        0.026,
        dark,
      );
      attachment = root;

      // Iconic HK front hooded circular ring + rear rotary diopter drum sight
      ring(0.019, 0.0035, 0, 0.068, -0.575, dark, 10);
      box(0.003, 0.016, 0.004, 0, 0.061, -0.575, steel);
      tube(0.017, 0.016, 0, 0.068, -0.145, dark, 0.017, 10);

      // Left-side MP5 cocking handle ('chargingHandle') for HK Slap empty reload
      const ch = new THREE.Group();
      ch.name = 'chargingHandle';
      root.add(ch);
      attachment = ch;
      box(0.022, 0.01, 0.012, -0.024, 0.046, -0.5, steel);
      attachment = root;
    } else if (shotgun) {
      // Tactical Pump Shotgun with movable ribbed pump forend & underside mag tube
      tube(0.016, 0.44, 0, -0.02, -0.61, dark, 0.016, 10);
      const pump = new THREE.Group();
      pump.name = 'pump';
      root.add(pump);
      attachment = pump;
      profile(
        [
          [-0.65, 0.002],
          [-0.41, 0.002],
          [-0.4, -0.048],
          [-0.63, -0.048],
        ],
        0.049,
        rubber,
      );
      for (let i = 0; i < 12; i++) {
        for (const side of [-1, 1]) {
          box(0.002, 0.03, 0.004, side * 0.026, -0.022, -0.43 - i * 0.016, dark);
        }
      }
      attachment = root;
      const sMag = new THREE.Group();
      sMag.name = 'mag';
      root.add(sMag);
      attachment = sMag;
      tube(0.01, 0.056, 0.015, -0.042, -0.27, copper, 0.01, 8);
      attachment = root;
      rail(-0.32, -0.12, 0.055);
      sights(-0.82);
    } else {
      // Shared quad-rail forend for M249 LMG & SCAR 20S DMR
      profile(
        [
          [-0.71, 0.034],
          [-0.39, 0.034],
          [-0.39, -0.038],
          [-0.68, -0.034],
        ],
        0.056,
        finish,
      );
      rail(-0.7, -0.1, 0.055);
      for (let i = 0; i < 9; i++) {
        for (const side of [-1, 1]) {
          box(0.002, 0.013, 0.019, side * 0.029, -0.002, -0.43 - i * 0.027, dark);
        }
      }

      if (lmg) {
        // Hinged Top Feed Cover (flips up on reload!) + Mounted EOTech Sight (b0f15c39!)
        const topCover = new THREE.Group();
        topCover.name = 'topCover';
        topCover.position.set(0, 0.048, -0.39);
        root.add(topCover);
        attachment = topCover;
        box(0.074, 0.018, 0.27, 0, 0, 0.135, matteBlack);
        rail(-0.01, 0.24, 0.014, 0.034);
        holographic(0.145, 0.021);
        attachment = root;

        // Removable 100-rd Olive-Drab Canvas Box Magazine ('mag')
        const ammoBox = new THREE.Group();
        ammoBox.name = 'mag';
        root.add(ammoBox);
        attachment = ammoBox;
        box(0.126, 0.124, 0.148, -0.022, -0.114, -0.32, canvasOlive);
        box(0.108, 0.018, 0.132, -0.022, -0.05, -0.32, olive);
        attachment = root;

        // Articulated Brass 5.56mm Bullet Belt draping into feed tray ('ammoBelt')
        const beltGroup = new THREE.Group();
        beltGroup.name = 'ammoBelt';
        root.add(beltGroup);
        attachment = beltGroup;
        for (let i = 0; i < 10; i++) {
          const x = -0.045 - Math.sin(i * 0.14) * 0.064;
          const y = 0.012 - (1 - Math.cos(i * 0.14)) * 0.125;
          tube(0.0052, 0.042, x, y, -0.28, brass, 0.0052, 7);
          tube(0.0052, 0.015, x, y, -0.308, copper, 0.0012, 7);
          ring(0.0058, 0.0014, x, y, -0.266, dark, 6);
        }
        attachment = root;

        // Prominent perforated steel barrel heatshield (matching b0f15c39!) + vertical foregrip + compact bipod
        box(0.056, 0.044, 0.28, 0, 0.026, -0.54, steel);
        for (let i = 0; i < 6; i++) {
          box(0.046, 0.004, 0.018, 0, 0.049, -0.43 - i * 0.04, rubber);
          for (const side of [-1, 1]) {
            const hole = tube(0.007, 0.003, side * 0.029, 0.026, -0.43 - i * 0.04, rubber, 0.007, 6);
            hole.rotation.set(0, 0, Math.PI / 2);
          }
        }
        tube(0.019, 0.105, 0, -0.072, -0.495, polymer, 0.016, 8).rotation.x = 0;
        for (const side of [-1, 1]) {
          const leg = box(0.011, 0.18, 0.012, side * 0.042, -0.085, -0.66, dark);
          leg.rotation.set(0.32, 0, side * 0.18);
        }
        sights(-0.71);
        root.userData.sightHeight = 0.11;
      } else {
        // SCAR 20S DMR: coyote-tan FDE chassis + black mag + black side charging handle + big sniper optic!
        const dmrMag = new THREE.Group();
        dmrMag.name = 'mag';
        root.add(dmrMag);
        attachment = dmrMag;
        profile(
          [
            [-0.32, -0.035],
            [-0.232, -0.035],
            [-0.232, -0.168],
            [-0.312, -0.176],
          ],
          0.039,
          matteBlack,
        );
        attachment = root;

        // SCAR charging handle ('chargingHandle')
        const ch = new THREE.Group();
        ch.name = 'chargingHandle';
        root.add(ch);
        attachment = ch;
        box(0.024, 0.011, 0.015, -0.041, 0.016, -0.315, dark);
        attachment = root;

        // Heavy Flared Black Magnifier Sniper Scope (8x/10x) matching d82e05cd!
        tube(0.023, 0.23, 0, 0.122, -0.295, matteBlack, 0.023, 12);
        tube(0.037, 0.065, 0, 0.122, -0.18, matteBlack, 0.028, 12);
        tube(0.04, 0.085, 0, 0.122, -0.41, dark, 0.026, 12);
        for (const z of [-0.4, -0.18]) {
          ring(0.038, 0.0025, 0, 0.122, z + 0.033, matteBlack, 10);
          box(0.034, 0.046, 0.025, 0, 0.077, z, dark);
        }
        // Sky-reflective blue/amber coated objective/eyepiece lenses + knurled turrets
        const scopeLens = new THREE.MeshPhysicalMaterial({
          color: 0x3b6f8c,
          emissive: 0x1e2c36,
          emissiveIntensity: 0.45,
          roughness: 0.08,
          metalness: 0.3,
        });
        materials.push(scopeLens);
        tube(0.032, 0.003, 0, 0.122, -0.146, scopeLens, 0.032, 12);
        const topTurret = tube(0.017, 0.024, 0, 0.155, -0.29, dark, 0.018, 10);
        topTurret.rotation.x = 0;
        const sideTurret = tube(0.015, 0.024, -0.034, 0.122, -0.29, dark, 0.016, 10);
        sideTurret.rotation.set(0, 0, Math.PI / 2);
        // Folded backup iron sight at front rail
        box(0.022, 0.014, 0.03, 0, 0.064, -0.66, dark);
      }
    }

    // Bolt ejection window & receiver screws
    box(0.002, 0.016, 0.072, smg ? 0.024 : 0.032, 0.009, -0.25, dark);
    screws(smg ? 0.045 : 0.062, [
      [-0.12, -0.014],
      [-0.35, -0.018],
    ]);
  }

  // Sharp stenciled markings on side of frame/slide matching reference captures
  const decalMap: Partial<Record<WeaponId, { row: number; w: number; h: number; x: number; y: number; z: number }>> = {
    glock: { row: 1, w: 0.14, h: 0.014, x: -0.0195, y: 0.008, z: -0.268 },
    usp: { row: 8, w: 0.135, h: 0.014, x: -0.0195, y: 0.008, z: -0.268 },
    deagle: { row: 10, w: 0.155, h: 0.015, x: -0.0265, y: 0.01, z: -0.295 },
    marksman: { row: 7, w: 0.15, h: 0.016, x: -0.0325, y: 0.004, z: -0.22 },
    machinegun: { row: 2, w: 0.15, h: 0.015, x: -0.0325, y: 0.008, z: -0.265 },
    smg: { row: 9, w: 0.135, h: 0.014, x: -0.024, y: 0.012, z: -0.255 },
    rpg: { row: 3, w: 0.16, h: 0.017, x: -0.04, y: 0.006, z: -0.22 },
  };
  const d = decalMap[id];
  if (d) {
    const decal = weaponDecal(textures, d.row, d.w, d.h, geometries, materials);
    decal.rotation.y = -Math.PI / 2;
    decal.position.set(d.x, d.y, d.z);
    root.add(decal);
  }

  return root;
}
