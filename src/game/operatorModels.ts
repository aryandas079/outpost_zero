import * as THREE from 'three';
import { craftedBox, batchDecoration } from './geometry';
import { ProceduralTextures } from './textures';
import { GrenadeId, WeaponId } from './types';

type Point = [number, number, number];

/** Closed, tapered fabric/leather surfaces. UVs follow the length of each limb. */
export function tailoredLimb(
  points: Point[],
  radii: Array<[number, number]>,
  segments = 24,
  sides = 14,
) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const f = t * (radii.length - 1);
    const a = Math.min(radii.length - 2, Math.floor(f));
    const k = f - a;
    const rx = THREE.MathUtils.lerp(radii[a][0], radii[a + 1][0], k);
    const ry = THREE.MathUtils.lerp(radii[a][1], radii[a + 1][1], k);
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const v = p
        .clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * rx)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * ry);
      positions.push(v.x, v.y, v.z);
      uvs.push(j / sides, t * 2);
      if (i < segments && j < sides) {
        const q = i * (sides + 1) + j;
        indices.push(q, q + 1, q + sides + 1, q + 1, q + sides + 2, q + sides + 1);
      }
    }
  }
  // Both ends close cleanly against wrist/fingertip.
  for (const end of [0, segments]) {
    const p = curve.getPointAt(end / segments);
    const center = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, end / segments);
    for (let j = 0; j < sides; j++) {
      const q = end * (sides + 1) + j;
      indices.push(...(end === 0 ? [center, q + 1, q] : [center, q, q + 1]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const first = i * (sides + 1);
    const last = first + sides;
    n.fromBufferAttribute(normals, first).add(b.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, n.x, n.y, n.z);
    normals.setXYZ(last, n.x, n.y, n.z);
  }
  return geometry;
}

function createGlovePalette(
  textures: ProceduralTextures,
  materials: THREE.Material[],
) {
  const makeMat = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ flatShading: true, ...params });
    materials.push(m);
    return m;
  };
  const leather = makeMat({
    map: textures.tacticalGloveColor,
    normalMap: textures.tacticalGloveNormal,
    normalScale: new THREE.Vector2(0.26, 0.26),
    color: 0xb2b6ba,
    roughness: 0.78,
    metalness: 0.04,
  });
  leather.name = 'Black pebbled leather';

  const fabric = makeMat({
    map: textures.tacticalSleeveColor,
    bumpMap: textures.tacticalSleeveBump,
    bumpScale: 0.0005,
    color: 0x9da3a8,
    roughness: 0.94,
  });
  fabric.name = 'Charcoal ripstop';

  const armor = makeMat({
    map: textures.tacticalGloveColor,
    color: 0x52575c,
    roughness: 0.46,
    metalness: 0.22,
  });
  armor.name = 'Carbon knuckle guard';

  const cuff = makeMat({
    map: textures.tacticalGloveColor,
    color: 0x6c7176,
    roughness: 0.88,
  });

  const bezel = makeMat({ color: 0x1b1f24, roughness: 0.36, metalness: 0.72 });
  const glass = makeMat({ color: 0x0b161d, roughness: 0.14, metalness: 0.25 });
  const strap = makeMat({ color: 0x25282c, roughness: 0.85, metalness: 0.05 });
  const accent = makeMat({ color: 0xd0a448, roughness: 0.4, metalness: 0.7 });

  return { leather, fabric, armor, cuff, bezel, glass, strap, accent };
}

function addWatchOnLeftWrist(
  group: THREE.Group,
  wrist: Point,
  tiltZ: number,
  pal: ReturnType<typeof createGlovePalette>,
  geometries: THREE.BufferGeometry[],
) {
  const watchRoot = new THREE.Group();
  watchRoot.name = 'Tactical field watch';
  const [wx, wy, wz] = wrist;
  watchRoot.position.set(wx - 0.006, wy + 0.02, wz - 0.016);
  watchRoot.rotation.set(0.26, -0.24, tiltZ + 0.35);
  group.add(watchRoot);

  const strapGeo = new THREE.CylinderGeometry(0.038, 0.04, 0.026, 8);
  strapGeo.rotateX(Math.PI / 2);
  geometries.push(strapGeo);
  const watchBand = new THREE.Mesh(strapGeo, pal.strap);
  watchBand.position.set(0.01, -0.014, 0);
  watchRoot.add(watchBand);

  const caseGeo = craftedBox(0.026, 0.038, 0.044, true);
  geometries.push(caseGeo);
  const watchCase = new THREE.Mesh(caseGeo, pal.bezel);
  watchCase.position.set(-0.016, 0.016, 0);
  watchCase.rotation.z = 0.65;
  watchRoot.add(watchCase);

  const dialGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.006, 8);
  dialGeo.rotateZ(Math.PI / 2);
  geometries.push(dialGeo);
  const watchDial = new THREE.Mesh(dialGeo, pal.glass);
  watchDial.position.set(-0.022, 0.021, 0);
  watchDial.rotation.z = 0.65;
  watchRoot.add(watchDial);

  const bezelRingGeo = new THREE.TorusGeometry(0.016, 0.0024, 5, 8);
  bezelRingGeo.rotateY(Math.PI / 2);
  geometries.push(bezelRingGeo);
  const bezelRing = new THREE.Mesh(bezelRingGeo, pal.armor);
  bezelRing.position.set(-0.022, 0.021, 0);
  bezelRing.rotation.z = 0.65;
  watchRoot.add(bezelRing);
}

/** Low-poly full-finger combat gloves matching all reference weapon silhouettes & watch strap. */
export function buildOperatorHands(
  id: WeaponId,
  textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const pal = createGlovePalette(textures, materials);
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.name = 'operator-left-gloved-hand';
  right.name = 'operator-right-gloved-hand';

  const mesh = (
    group: THREE.Group,
    g: THREE.BufferGeometry,
    mat: THREE.Material,
    name: string,
  ) => {
    geometries.push(g);
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    group.add(m);
    return m;
  };
  const pod = (
    group: THREE.Group,
    p: Point,
    size: Point,
    mat: THREE.Material,
    name: string,
  ) => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(...size);
    g.translate(...p);
    return mesh(group, g, mat, name);
  };
  const limb = (
    group: THREE.Group,
    p: Point[],
    radii: Array<[number, number]>,
    mat: THREE.Material,
    name: string,
  ) => mesh(group, tailoredLimb(p, radii, 9, 7), mat, name);

  const sleeve = (group: THREE.Group, wrist: Point, sign: number) => {
    const [x, y, z] = wrist;
    limb(
      group,
      [
        [sign * 0.34, -0.37, 0.3],
        [sign * 0.22, -0.24, z + 0.19],
        [x + sign * 0.022, y - 0.028, z + 0.055],
        [x, y, z],
      ],
      [
        [0.064, 0.058],
        [0.056, 0.048],
        [0.043, 0.036],
        [0.033, 0.029],
      ],
      pal.fabric,
      'Continuous combat sleeve',
    );
    // Low-poly Velcro wrist cinch strap & overlapped leather cuff
    const strap = mesh(group, craftedBox(0.068, 0.058, 0.028, true), pal.cuff, 'Wrist cinch strap');
    strap.position.set(x + sign * 0.003, y - 0.005, z + 0.012);
    strap.rotation.set(0.15, sign * 0.2, 0);
    pod(group, [x, y, z], [0.035, 0.029, 0.015], pal.leather, 'Glove wrist base');
    if (sign < 0) addWatchOnLeftWrist(group, wrist, -0.32, pal, geometries);
  };

  const pistol = ['usp', 'glock', 'deagle'].includes(id);
  const heavyGrip = id === 'machinegun' || id === 'grenadelauncher';
  const gripZ =
    id === 'carbine'
      ? 0.134
      : id === 'railpistol'
        ? 0.12
        : pistol
          ? -0.205
          : id === 'rpg'
            ? -0.172
            : id === 'grenadelauncher'
              ? -0.18
              : id === 'machinegun'
                ? -0.145
                : -0.145;

  const firingHand = (group: THREE.Group, z: number, sign: number, support = false) => {
    const extra = support ? -0.022 : 0;
    const wy = support ? -0.132 : -0.156;
    const wrist: Point = [sign * 0.06 + extra, wy, z + (support ? 0.068 : 0.1)];
    sleeve(group, wrist, sign);
    limb(
      group,
      [
        wrist,
        [sign * 0.046 + extra, -0.112, z + 0.05],
        [sign * 0.029 + extra, -0.074, z + 0.019],
      ],
      [
        [0.032, 0.026],
        [0.036, 0.025],
        [0.034, 0.023],
      ],
      pal.leather,
      'Sculpted glove palm',
    );
    // Low-poly carbon armored knuckle shell across dorsal hand
    const shield = mesh(group, craftedBox(0.022, 0.068, 0.052, true), pal.armor, 'Armored dorsal guard');
    shield.position.set(sign * 0.045 + extra, -0.095, z + 0.025);
    shield.rotation.set(0.18, sign * 0.12, sign * 0.18);

    for (let i = 0; i < 4; i++) {
      const y = -0.072 - i * 0.02;
      const onTrigger = i === 0 && !support;
      const fz = z - (onTrigger ? 0.044 : support ? 0.026 : 0.023);
      limb(
        group,
        [
          [sign * 0.036 + extra, y, z + 0.014],
          [sign * 0.032 + extra, y - 0.004, fz],
          [sign * 0.007 + extra, y - 0.008, fz - 0.011],
          [-sign * 0.019 + extra, y - 0.004, fz + 0.003],
        ],
        [
          [0.0105, 0.0105],
          [0.011, 0.0105],
          [0.009, 0.009],
          [0.0055, 0.006],
        ],
        pal.leather,
        `Covered ${i === 0 ? 'index' : 'grip'} finger`,
      );
      pod(group, [sign * 0.039 + extra, y, z + 0.004], [0.0075, 0.0095, 0.012], pal.armor, 'Knuckle pod');
    }
    if (support && pistol) {
      // High thumbs-forward Weaver thumb resting cleanly along left side of pistol frame
      limb(
        group,
        [
          [-0.062, -0.088, z + 0.042],
          [-0.038, -0.034, z - 0.005],
          [-0.026, -0.02, z - 0.056],
        ],
        [
          [0.014, 0.012],
          [0.012, 0.011],
          [0.008, 0.008],
        ],
        pal.leather,
        'Forward Weaver thumb',
      );
    } else {
      limb(
        group,
        [
          [sign * 0.036 + extra, -0.074, z + 0.045],
          [sign * 0.006 + extra, -0.048, z + 0.024],
          [-sign * 0.022 + extra, -0.054, z - 0.004],
        ],
        [
          [0.014, 0.012],
          [0.012, 0.012],
          [0.008, 0.008],
        ],
        pal.leather,
        'Opposing thumb',
      );
    }
  };

  firingHand(right, gripZ, 1);

  if (pistol || id === 'rpg') {
    firingHand(left, pistol ? gripZ + 0.014 : -0.455, -1, pistol);
  } else if (heavyGrip) {
    // M249 LMG & GL-1 vertical foregrip hold matching M249 reference cleanly
    const fz = id === 'machinegun' ? -0.495 : -0.595;
    const wrist: Point = [-0.072, -0.124, fz + 0.095];
    sleeve(left, wrist, -1);
    limb(
      left,
      [wrist, [-0.054, -0.105, fz + 0.048], [-0.034, -0.082, fz + 0.014]],
      [
        [0.033, 0.027],
        [0.037, 0.025],
        [0.035, 0.023],
      ],
      pal.leather,
      'Vertical foregrip palm',
    );
    const guard = mesh(left, craftedBox(0.02, 0.068, 0.048, true), pal.armor, 'Armored knuckle plate');
    guard.position.set(-0.049, -0.095, fz + 0.016);
    guard.rotation.y = 0.25;
    for (let i = 0; i < 4; i++) {
      const fy = -0.065 - i * 0.018;
      limb(
        left,
        [
          [-0.034, fy, fz + 0.012],
          [-0.029, fy, fz - 0.024],
          [0.012, fy, fz - 0.028],
          [0.026, fy, fz + 0.004],
        ],
        [
          [0.0105, 0.0105],
          [0.011, 0.0105],
          [0.009, 0.009],
          [0.0055, 0.006],
        ],
        pal.leather,
        'Vertical foregrip finger',
      );
      pod(left, [-0.039, fy, fz - 0.002], [0.0075, 0.0095, 0.011], pal.armor, 'Knuckle pod');
    }
    limb(
      left,
      [
        [-0.048, -0.062, fz + 0.038],
        [-0.022, -0.046, fz + 0.022],
        [0.016, -0.048, fz + 0.012],
      ],
      [
        [0.014, 0.012],
        [0.012, 0.012],
        [0.008, 0.008],
      ],
      pal.leather,
      'Foregrip opposing thumb',
    );

    // GL-1 40mm grenade round held prominently by fingers for swing-out cylinder reload animation!
    if (id === 'grenadelauncher') {
      const roundGroup = new THREE.Group();
      roundGroup.name = 'gl-40mm-reload-round';
      roundGroup.position.set(0.042, -0.028, fz - 0.004);
      roundGroup.rotation.set(0.06, 0.34, -0.14);
      roundGroup.scale.setScalar(1.18);
      roundGroup.visible = false;

      const oliveShell = new THREE.MeshStandardMaterial({
        color: 0x566037,
        roughness: 0.56,
        metalness: 0.25,
        flatShading: true,
      });
      const brassRim = new THREE.MeshStandardMaterial({
        color: 0xc8a34f,
        roughness: 0.26,
        metalness: 0.88,
        flatShading: true,
      });
      const silverBand = new THREE.MeshStandardMaterial({
        color: 0xb6bbc0,
        roughness: 0.34,
        metalness: 0.78,
        flatShading: true,
      });
      materials.push(oliveShell, brassRim, silverBand);

      const gBrass = new THREE.CylinderGeometry(0.024, 0.025, 0.034, 10);
      gBrass.rotateX(Math.PI / 2);
      const gRim = new THREE.CylinderGeometry(0.027, 0.027, 0.006, 10);
      gRim.rotateX(Math.PI / 2);
      const gBand = new THREE.CylinderGeometry(0.0242, 0.0242, 0.008, 10);
      gBand.rotateX(Math.PI / 2);
      const gCone = new THREE.CylinderGeometry(0.014, 0.024, 0.042, 10);
      gCone.rotateX(Math.PI / 2);
      const gNose = new THREE.SphereGeometry(0.014, 10, 6);
      geometries.push(gBrass, gRim, gBand, gCone, gNose);

      const mBrass = new THREE.Mesh(gBrass, brassRim);
      mBrass.position.z = 0.02;
      const mRim = new THREE.Mesh(gRim, brassRim);
      mRim.position.z = 0.036;
      const mBand = new THREE.Mesh(gBand, silverBand);
      mBand.position.z = -0.001;
      const mCone = new THREE.Mesh(gCone, oliveShell);
      mCone.position.z = -0.024;
      const mNose = new THREE.Mesh(gNose, oliveShell);
      mNose.position.z = -0.044;

      roundGroup.add(mBrass, mRim, mBand, mCone, mNose);
      left.add(roundGroup);
      left.userData.reloadRound = roundGroup;
    }
  } else {
    // Rifles / SMGs / Shotguns C-clamp handguard support grip
    const z =
      id === 'carbine'
        ? -0.345
        : id === 'marksman'
          ? -0.375
          : id === 'railpistol'
            ? -0.38
            : id === 'smg'
              ? -0.425
              : -0.525;
    const wrist: Point = [-0.092, -0.104, z + 0.115];
    sleeve(left, wrist, -1);
    limb(
      left,
      [wrist, [-0.068, -0.062, z + 0.035], [-0.044, -0.027, z]],
      [
        [0.033, 0.027],
        [0.037, 0.025],
        [0.039, 0.023],
      ],
      pal.leather,
      'Supporting glove palm',
    );
    const guard = mesh(left, craftedBox(0.018, 0.056, 0.062, true), pal.armor, 'Armored knuckle guard');
    guard.position.set(-0.066, -0.042, z + 0.015);
    guard.rotation.z = 0.28;
    for (let i = 0; i < 4; i++) {
      const fz = z - 0.036 + i * 0.022;
      limb(
        left,
        [
          [-0.046, -0.014, fz],
          [-0.034, -0.05, fz - 0.004],
          [0.012, -0.054, fz - 0.002],
          [0.034, -0.018, fz],
        ],
        [
          [0.011, 0.011],
          [0.011, 0.01],
          [0.009, 0.009],
          [0.0055, 0.006],
        ],
        pal.leather,
        'Wrapped support finger',
      );
      pod(left, [-0.055, -0.022, fz], [0.009, 0.012, 0.011], pal.armor, 'Segmented knuckle');
    }
    limb(
      left,
      [
        [-0.064, -0.016, z + 0.052],
        [-0.038, 0.012, z + 0.038],
        [-0.017, 0.022, z + 0.002],
      ],
      [
        [0.014, 0.013],
        [0.012, 0.012],
        [0.007, 0.008],
      ],
      pal.leather,
      'Support thumb',
    );
  }

  // Keep GL-1's animated reloadRound unmerged so reload can toggle its visibility
  const keepSeparate = new Set<THREE.Object3D>();
  if (left.userData.reloadRound) keepSeparate.add(left.userData.reloadRound as THREE.Object3D);
  for (const arm of [left, right]) batchDecoration(arm, keepSeparate, keepSeparate, geometries, true);
  return { left, right };
}

/** Custom two-handed tactical throwable poses (pin-pull for grenades, balance guard for Molotov). */
export function buildThrowableHands(
  id: GrenadeId,
  textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const pal = createGlovePalette(textures, materials);
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.name = 'operator-left-throw-hand';
  right.name = 'operator-right-throw-hand';

  const mesh = (group: THREE.Group, g: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    geometries.push(g);
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    group.add(m);
    return m;
  };
  const limb = (group: THREE.Group, p: Point[], radii: Array<[number, number]>, name: string) =>
    mesh(group, tailoredLimb(p, radii, 9, 7), pal.leather, name);

  // Right hand cradles grenade / bottle tightly at (0.015, -0.085, -0.225)
  const rWrist: Point = [0.135, -0.175, -0.11];
  limb(right, [[0.34, -0.38, 0.25], [0.22, -0.25, 0.04], rWrist], [[0.062, 0.056], [0.052, 0.045], [0.033, 0.028]], 'Right sleeve');
  mesh(right, craftedBox(0.066, 0.056, 0.026, true), pal.cuff, 'Right wrist cinch').position.set(0.135, -0.17, -0.105);
  limb(right, [rWrist, [0.072, -0.12, -0.175], [0.035, -0.088, -0.215]], [[0.032, 0.026], [0.036, 0.024], [0.034, 0.022]], 'Right palm');
  mesh(right, craftedBox(0.022, 0.064, 0.05, true), pal.armor, 'Right knuckle armor').position.set(0.058, -0.095, -0.202);
  for (let i = 0; i < 4; i++) {
    const y = -0.062 - i * 0.019;
    limb(right, [[0.034, y, -0.205], [0.018, y - 0.004, -0.245], [-0.018, y - 0.005, -0.242]], [[0.0105, 0.01], [0.0105, 0.01], [0.007, 0.007]], 'Right wrap finger');
  }
  limb(right, [[0.042, -0.068, -0.195], [0.016, -0.042, -0.21], [-0.008, -0.046, -0.226]], [[0.014, 0.012], [0.012, 0.011], [0.008, 0.008]], 'Right opposing thumb');

  if (id === 'molotov') {
    // Open defensive balance guard hand at lower-left + prominent wrist watch (matching 42c37d8c)
    const lWrist: Point = [-0.155, -0.155, -0.14];
    mesh(left, tailoredLimb([[-0.35, -0.36, 0.24], [-0.24, -0.23, 0.03], lWrist], [[0.062, 0.056], [0.052, 0.045], [0.033, 0.028]], 9, 7), pal.fabric, 'Left sleeve');
    mesh(left, craftedBox(0.066, 0.056, 0.026, true), pal.cuff, 'Left cuff strap').position.set(-0.15, -0.15, -0.132);
    addWatchOnLeftWrist(left, lWrist, -0.28, pal, geometries);
    limb(left, [lWrist, [-0.105, -0.105, -0.205], [-0.068, -0.088, -0.245]], [[0.032, 0.026], [0.036, 0.024], [0.034, 0.021]], 'Left guard palm');
    mesh(left, craftedBox(0.048, 0.02, 0.052, true), pal.armor, 'Left knuckle plate').position.set(-0.082, -0.08, -0.22);
    for (let i = 0; i < 4; i++) {
      const fz = -0.258 + i * 0.016;
      limb(left, [[-0.065, -0.082 - i * 0.006, fz], [-0.025, -0.072 - i * 0.009, fz - 0.022], [-0.005, -0.092 - i * 0.01, fz - 0.024]], [[0.01, 0.01], [0.0095, 0.0095], [0.0065, 0.0065]], 'Left open guard finger');
    }
    limb(left, [[-0.078, -0.105, -0.228], [-0.035, -0.122, -0.255], [-0.01, -0.128, -0.255]], [[0.013, 0.011], [0.011, 0.01], [0.007, 0.007]], 'Left thumb');
  } else {
    // Left pinching/pulling safety pin ring with watch clearly angled on left wrist
    const lWrist: Point = [-0.135, -0.14, -0.12];
    mesh(left, tailoredLimb([[-0.35, -0.36, 0.24], [-0.23, -0.22, 0.03], lWrist], [[0.062, 0.056], [0.052, 0.045], [0.033, 0.028]], 9, 7), pal.fabric, 'Left sleeve');
    mesh(left, craftedBox(0.066, 0.056, 0.026, true), pal.cuff, 'Left cuff strap').position.set(-0.13, -0.135, -0.115);
    addWatchOnLeftWrist(left, lWrist, -0.3, pal, geometries);
    limb(left, [lWrist, [-0.085, -0.088, -0.185], [-0.055, -0.045, -0.22]], [[0.032, 0.026], [0.036, 0.024], [0.034, 0.022]], 'Left pin palm');
    mesh(left, craftedBox(0.042, 0.024, 0.048, true), pal.armor, 'Left knuckle shield').position.set(-0.072, -0.055, -0.195);
    // Thumb + index pinch right onto the silver pull ring (~x: -0.035, y: -0.025, z: -0.225)
    limb(left, [[-0.052, -0.042, -0.215], [-0.026, -0.024, -0.226], [-0.016, -0.032, -0.23]], [[0.011, 0.011], [0.0095, 0.0095], [0.0065, 0.0065]], 'Pinch index finger');
    limb(left, [[-0.065, -0.062, -0.21], [-0.038, -0.052, -0.222], [-0.022, -0.048, -0.226]], [[0.013, 0.011], [0.011, 0.01], [0.0075, 0.0075]], 'Pinch thumb');
    for (let i = 1; i < 4; i++) {
      const y = -0.054 - i * 0.018;
      limb(left, [[-0.054, y, -0.215], [-0.042, y - 0.012, -0.238], [-0.058, y - 0.022, -0.226]], [[0.0105, 0.01], [0.01, 0.01], [0.007, 0.007]], 'Tucked left finger');
    }
  }

  for (const arm of [left, right]) batchDecoration(arm, new Set(), new Set(), geometries, true);
  return { left, right };
}

/** Low-poly Bare Hands two-fisted CQC fighting guard for Slot 3 (BARE HANDS). */
export function buildMeleeHands(
  textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const pal = createGlovePalette(textures, materials);
  const left = new THREE.Group();
  const right = new THREE.Group();
  left.name = 'melee-left-fist';
  right.name = 'melee-right-fist';

  const makeFist = (group: THREE.Group, sign: number, zLead: number) => {
    const wrist: Point = [sign * 0.16, -0.18, -0.14 + zLead];
    const sleeveG = tailoredLimb(
      [[sign * 0.36, -0.4, 0.25], [sign * 0.25, -0.27, 0.04], wrist],
      [[0.064, 0.058], [0.054, 0.046], [0.034, 0.029]],
      9,
      7,
    );
    geometries.push(sleeveG);
    group.add(new THREE.Mesh(sleeveG, pal.fabric));

    const cuffG = craftedBox(0.068, 0.058, 0.028, true);
    geometries.push(cuffG);
    const cuffM = new THREE.Mesh(cuffG, pal.cuff);
    cuffM.position.set(wrist[0], wrist[1], wrist[2] + 0.008);
    group.add(cuffM);

    if (sign < 0) addWatchOnLeftWrist(group, wrist, -0.28, pal, geometries);

    const palmG = tailoredLimb(
      [wrist, [sign * 0.135, -0.125, -0.22 + zLead], [sign * 0.118, -0.095, -0.265 + zLead]],
      [[0.033, 0.027], [0.038, 0.026], [0.037, 0.024]],
      9,
      7,
    );
    geometries.push(palmG);
    group.add(new THREE.Mesh(palmG, pal.leather));

    const knucklePlateG = craftedBox(0.062, 0.024, 0.036, true);
    geometries.push(knucklePlateG);
    const kp = new THREE.Mesh(knucklePlateG, pal.armor);
    kp.position.set(sign * 0.112, -0.072, -0.272 + zLead);
    kp.rotation.set(0.24, -sign * 0.22, -sign * 0.2);
    group.add(kp);

    for (let i = 0; i < 4; i++) {
      const fx = sign * (0.088 + i * 0.017);
      const fg = tailoredLimb(
        [
          [fx, -0.08, -0.268 + zLead],
          [fx - sign * 0.004, -0.1, -0.295 + zLead],
          [fx, -0.122, -0.272 + zLead],
          [fx, -0.11, -0.248 + zLead],
        ],
        [[0.011, 0.011], [0.011, 0.011], [0.0095, 0.0095], [0.007, 0.007]],
        7,
        6,
      );
      geometries.push(fg);
      group.add(new THREE.Mesh(fg, pal.leather));
    }

    const tg = tailoredLimb(
      [
        [sign * 0.095, -0.105, -0.24 + zLead],
        [sign * 0.084, -0.105, -0.275 + zLead],
        [sign * 0.108, -0.118, -0.285 + zLead],
      ],
      [[0.014, 0.012], [0.012, 0.011], [0.0085, 0.0085]],
      7,
      6,
    );
    geometries.push(tg);
    group.add(new THREE.Mesh(tg, pal.leather));
  };

  makeFist(left, -1, -0.055);
  makeFist(right, 1, 0.03);
  left.position.set(0.032, 0.064, -0.025);
  right.position.set(-0.018, 0.044, -0.008);
  for (const arm of [left, right]) batchDecoration(arm, new Set(), new Set(), geometries, true);
  return { left, right };
}
