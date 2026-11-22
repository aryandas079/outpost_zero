import * as THREE from 'three';
import { craftedBox, batchDecoration, optimizeStaticArena } from './geometry';
import { ProceduralTextures } from './textures';

export interface BoxCollider {
  surface?: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  lowEdge: number;
  highEdge: number;
  lowY: number;
  highY: number;
}

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ArenaAnimatedProps {
  windmillWheel: THREE.Group | null;
  flagMesh: THREE.Mesh | null;
  tumbleweeds: Array<{
    mesh: THREE.Group;
    baseX: number;
    baseZ: number;
    speed: number;
    phase: number;
    rangeX: number;
  }>;
}

export type OccludableKind = 'building' | 'interior' | 'prop';

export interface OccludableSpec {
  object: THREE.Object3D;
  kind: OccludableKind;
  buildingIdx?: number;
}

export interface ArenaData {
  mapName: string;
  group: THREE.Group;
  colliders: BoxCollider[];
  ramps: RampSurface[];
  shootableMeshes: THREE.Object3D[];
  walkableMeshes: THREE.Object3D[];
  occludables: OccludableSpec[];
  spawnPoints: THREE.Vector3[];
  pickupSpots: THREE.Vector3[];
  buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }>;
  arenaHalfSize: number;
  bounds: ArenaBounds;
  animatedProps: ArenaAnimatedProps;
  optimizeRendering: () => { before: number; after: number };
  dispose: () => void;
}

interface WesternBuildingOptions {
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
  rotY: number;
  wallStyle: 'light' | 'dark' | 'red' | 'brick';
  roofStyle: 'gable' | 'flat' | 'falsefront';
  signTitle: string;
  signSubtitle?: string;
  signVariant?: 'dark' | 'cream' | 'red';
  twoStory?: boolean;
  porchDepth?: number;
  porchWhitePosts?: boolean;
  backDoor?: boolean;
  interiorTheme:
    | 'saloon'
    | 'bank'
    | 'sheriff'
    | 'store'
    | 'office'
    | 'hotel'
    | 'barber'
    | 'blacksmith'
    | 'depot'
    | 'barn';
  balconyWalkable?: boolean;
}

export function buildWestTownArena(textures: ProceduralTextures): ArenaData {
  const group = new THREE.Group();
  const colliders: BoxCollider[] = [];
  const ramps: RampSurface[] = [];
  const shootableMeshes: THREE.Object3D[] = [];
  const walkableMeshes: THREE.Object3D[] = [];
  const occludables: OccludableSpec[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }> = [];
  const animatedProps: ArenaAnimatedProps = {
    windmillWheel: null,
    flagMesh: null,
    tumbleweeds: [],
  };

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Playable rectangular perimeter enclosing the full WEST frontier town (Railroad -> Blacksmith, Barn -> Flagpole)
  const bounds: ArenaBounds = {
    minX: -50,
    maxX: 46,
    minZ: -38,
    maxZ: 34,
  };

  // =========================================================================
  // CALIBRATED HIGH-CRAFT PBR WESTERN ARCHITECTURAL & NATURAL MATERIALS
  // =========================================================================
  const desertSandMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.desertSandColor,
      normalMap: textures.desertSandNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: textures.desertSandRoughness,
      color: 0xe0cfa8,
      roughness: 0.96,
      metalness: 0.0,
      vertexColors: true,
    }),
  );
  desertSandMat.userData.surface = 'dirt';

  const dirtRoadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.dirtRoadColor,
      normalMap: textures.dirtRoadNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      color: 0xd8c39c,
      roughness: 0.94,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  dirtRoadMat.userData.surface = 'dirt';

  const ballastMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.concreteColor,
      normalMap: textures.canyonRockNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      color: 0x6f6458,
      roughness: 0.96,
      metalness: 0.02,
    }),
  );
  ballastMat.userData.surface = 'stone';

  const canyonRidgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.canyonRockColor,
      normalMap: textures.canyonRockNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      color: 0xd9b489,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  canyonRidgeMat.userData.surface = 'stone';

  const mesaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.canyonRockColor,
      normalMap: textures.canyonRockNormal,
      normalScale: new THREE.Vector2(1.45, 1.45),
      color: 0xc28a5d,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );
  mesaMat.userData.surface = 'stone';

  const boulderMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.canyonRockColor,
      normalMap: textures.canyonRockNormal,
      normalScale: new THREE.Vector2(1.35, 1.35),
      color: 0xffffff,
      roughness: 0.93,
      metalness: 0.02,
    }),
  );
  boulderMat.userData.surface = 'stone';

  const scrubMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );

  const woodLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankLightColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: textures.woodPlankRoughness,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  woodLightMat.userData.surface = 'wood';

  const woodDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankDarkColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: textures.woodPlankRoughness,
      roughness: 0.89,
      metalness: 0.03,
    }),
  );
  woodDarkMat.userData.surface = 'wood';

  const woodRedMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankRedColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: textures.woodPlankRoughness,
      roughness: 0.82,
      metalness: 0.02,
    }),
  );
  woodRedMat.userData.surface = 'wood';

  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brickAdobeColor,
      normalMap: textures.brickAdobeNormal,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughnessMap: textures.brickAdobeRoughness,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );
  brickMat.userData.surface = 'stone';

  const woodFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodFloorColor,
      normalMap: textures.woodFloorNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.78,
      metalness: 0.04,
    }),
  );
  woodFloorMat.userData.surface = 'wood';

  const interiorWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankLightColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xd9c29e,
      roughness: 0.85,
      metalness: 0.02,
    }),
  );
  interiorWallMat.userData.surface = 'wood';

  const whiteTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankLightColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: 0xd6cdbc,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  whiteTrimMat.userData.surface = 'wood';

  const darkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankDarkColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: 0x4b3322,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  darkTrimMat.userData.surface = 'wood';

  const shutterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlankDarkColor,
      normalMap: textures.woodPlankNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x3b4942,
      roughness: 0.84,
      metalness: 0.03,
    }),
  );
  shutterMat.userData.surface = 'wood';

  const roofShingleMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.roofShingleColor,
      normalMap: textures.roofShingleNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 0.9,
      metalness: 0.03,
    }),
  );
  roofShingleMat.userData.surface = 'wood';

  const roofDarkShingleMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.roofShingleColor,
      normalMap: textures.roofShingleNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      color: 0x707478,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  roofDarkShingleMat.userData.surface = 'wood';

  const ironMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brushedMetal,
      color: 0x2b3036,
      roughness: 0.34,
      metalness: 0.88,
    }),
  );
  ironMat.userData.surface = 'metal';

  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brushedMetal,
      color: 0xc2994c,
      roughness: 0.28,
      metalness: 0.9,
    }),
  );
  brassMat.userData.surface = 'metal';

  const steelRailMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brushedMetal,
      color: 0x8d959e,
      roughness: 0.26,
      metalness: 0.94,
    }),
  );
  steelRailMat.userData.surface = 'metal';

  const windowGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x8eb8d4,
      roughness: 0.08,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );
  windowGlassMat.userData.surface = 'glass';

  const windowBackdropMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161b22,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  windowBackdropMat.userData.surface = 'glass';

  const floorGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x7da4b8,
      roughness: 0.09,
      metalness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.07,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  floorGlassMat.userData.surface = 'glass';

  const brutalistConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.concreteColor,
      bumpMap: textures.concreteBump,
      bumpScale: 0.024,
      color: 0xa8a196,
      roughness: 0.9,
      metalness: 0.03,
    }),
  );
  brutalistConcreteMat.userData.surface = 'concrete';

  const steelPlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brushedMetal,
      color: 0x454c54,
      roughness: 0.38,
      metalness: 0.86,
    }),
  );
  steelPlateMat.userData.surface = 'metal';

  const lanternGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4a0,
      emissive: 0xffa838,
      emissiveIntensity: 1.32,
      roughness: 0.22,
    }),
  );

  const forgeEmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff7722,
      emissive: 0xff4c0a,
      emissiveIntensity: 1.85,
      roughness: 0.4,
    }),
  );

  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.crateColor,
      normalMap: textures.crateNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.84,
      metalness: 0.05,
    }),
  );
  crateMat.userData.surface = 'wood';

  const barrelWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodFloorColor,
      normalMap: textures.woodFloorNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      color: 0xa27048,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  barrelWoodMat.userData.surface = 'wood';

  const canvasMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.canvasClothColor,
      color: 0xcabca1,
      roughness: 0.96,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );
  canvasMat.userData.surface = 'wood';

  const waterSurfaceMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2b3c3c,
      roughness: 0.09,
      metalness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.88,
    }),
  );
  waterSurfaceMat.userData.surface = 'dirt';

  const porcelainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7ea6a8,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );

  const hayMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.hayBaleColor,
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  hayMat.userData.surface = 'dirt';

  const cactusMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.woodFloorColor,
      normalMap: textures.woodFloorNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x528246,
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  cactusMat.userData.surface = 'wood';

  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.concreteColor,
      normalMap: textures.canyonRockNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0xb7ab98,
      roughness: 0.91,
      metalness: 0.02,
    }),
  );
  stoneMat.userData.surface = 'stone';

  const contactShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );

  const goldBullionMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brushedMetal,
      color: 0xe6b83a,
      roughness: 0.22,
      metalness: 0.94,
    }),
  );
  goldBullionMat.userData.surface = 'metal';

  const posterPaperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdccaa4,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );
  posterPaperMat.userData.surface = 'wood';

  const buntingRedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9e3226,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );

  const buntingGoldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc99a44,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );

  // High-Craft Shared Reusable Prop Geometries (Lathe-turned curved oak barrels, spokes, shadows)
  const barrelProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.34, 0.06),
    new THREE.Vector2(0.39, 0.24),
    new THREE.Vector2(0.425, 0.5),
    new THREE.Vector2(0.39, 0.76),
    new THREE.Vector2(0.34, 0.94),
    new THREE.Vector2(0.32, 1.0),
  ];
  const barrelBodyGeo = trackGeo(new THREE.LatheGeometry(barrelProfile, 18));
  const barrelLidGeo = trackGeo(new THREE.CylinderGeometry(0.315, 0.315, 0.03, 16));
  const barrelRimBandGeo = trackGeo(new THREE.TorusGeometry(0.352, 0.018, 6, 18));
  barrelRimBandGeo.rotateX(Math.PI / 2);
  const barrelMidBandGeo = trackGeo(new THREE.TorusGeometry(0.405, 0.02, 6, 18));
  barrelMidBandGeo.rotateX(Math.PI / 2);
  const barrelShadowGeo = trackGeo(new THREE.PlaneGeometry(1.18, 1.18));
  barrelShadowGeo.rotateX(-Math.PI / 2);

  const wheelRimGeo = trackGeo(new THREE.TorusGeometry(0.68, 0.055, 10, 22));
  const wheelIronTireGeo = trackGeo(new THREE.TorusGeometry(0.725, 0.022, 6, 22));
  const wheelHubGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.12, 0.18, 12));
  wheelHubGeo.rotateX(Math.PI / 2);
  const wheelSpokeGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 1.32, 6));

  const tagSurface = (mesh: THREE.Mesh, mat: THREE.Material) => {
    mesh.userData.surface = (mat.userData?.surface as string) || 'wood';
  };

  // Helper: Add world-space solid box
  const addWorldBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    collide = true,
    shootable = true,
    castShadow = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(trackGeo(craftedBox(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    tagSurface(mesh, mat);
    group.add(mesh);
    if (collide) {
      colliders.push({
        surface: mesh.userData.surface,
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    if (shootable) shootableMeshes.push(mesh);
    return mesh;
  };

  // Helper: High-Craft Lathe-Turned Oak Stave Barrel with 4 Iron Hoops & Contact Shadow
  const addWoodenBarrel = (x: number, y: number, z: number, collide = true) => {
    const barrel = new THREE.Group();
    barrel.position.set(x, y, z);

    const body = new THREE.Mesh(barrelBodyGeo, barrelWoodMat);
    body.castShadow = true;
    body.receiveShadow = true;
    tagSurface(body, barrelWoodMat);
    barrel.add(body);

    // Recessed wooden barrel lid & bung plug
    const lid = new THREE.Mesh(barrelLidGeo, woodDarkMat);
    lid.position.y = 0.95;
    lid.receiveShadow = true;
    barrel.add(lid);

    // 4 forged iron stave hoops (top, upper bilge, lower bilge, bottom)
    for (const [hy, geo] of [
      [0.09, barrelRimBandGeo],
      [0.31, barrelMidBandGeo],
      [0.69, barrelMidBandGeo],
      [0.91, barrelRimBandGeo],
    ] as Array<[number, THREE.BufferGeometry]>) {
      const band = new THREE.Mesh(geo, ironMat);
      band.position.y = hy;
      tagSurface(band, ironMat);
      barrel.add(band);
    }

    if (y <= 0.05) {
      const shadow = new THREE.Mesh(barrelShadowGeo, contactShadowMat);
      shadow.position.y = 0.048;
      shadow.renderOrder = 1;
      shadow.userData.noCollide = true;
      barrel.add(shadow);
    }

    group.add(barrel);
    occludables.push({ object: barrel, kind: 'prop' });
    shootableMeshes.push(body);
    if (collide) {
      colliders.push({
        minX: x - 0.45,
        maxX: x + 0.45,
        minY: y,
        maxY: y + 1.02,
        minZ: z - 0.45,
        maxZ: z + 0.45,
      });
    }
  };

  // Helper: High-Craft Framed Frontier Cargo Crate (zero coplanar corner rail overlap!)
  const addFramedCrate = (size: number, x: number, z: number, rotY = 0) => {
    const cGroup = new THREE.Group();
    cGroup.position.set(x, 0, z);
    cGroup.rotation.y = rotY;

    const core = new THREE.Mesh(trackGeo(craftedBox(size * 0.88, size * 0.88, size * 0.88)), crateMat);
    core.position.y = size * 0.5;
    core.castShadow = true;
    core.receiveShadow = true;
    tagSurface(core, crateMat);
    cGroup.add(core);

    // Raised 3D outer timber corner rails with clean non-overlapping butt joints
    const railT = size * 0.1;
    const half = size * 0.45;
    const innerSpan = Math.max(0.1, size - railT * 2.02);
    const vPostGeo = trackGeo(craftedBox(railT, size, railT));
    const hRailXGeo = trackGeo(craftedBox(innerSpan, railT, railT));
    const hRailZGeo = trackGeo(craftedBox(railT, railT, innerSpan));

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(vPostGeo, woodDarkMat);
        post.position.set(sx * half, size * 0.5, sz * half);
        post.castShadow = true;
        post.receiveShadow = true;
        cGroup.add(post);
      }
      for (const sy of [railT * 0.5, size - railT * 0.5]) {
        const railZ = new THREE.Mesh(hRailZGeo, woodDarkMat);
        railZ.position.set(sx * half, sy, 0);
        railZ.receiveShadow = true;
        cGroup.add(railZ);
      }
    }
    for (const sz of [-1, 1]) {
      for (const sy of [railT * 0.5, size - railT * 0.5]) {
        const railX = new THREE.Mesh(hRailXGeo, woodDarkMat);
        railX.position.set(0, sy, sz * half);
        railX.receiveShadow = true;
        cGroup.add(railX);
      }
    }

    // Iron reinforcement brackets seated cleanly proud of top 4 corners
    const bracketGeo = trackGeo(craftedBox(railT * 1.24, railT * 1.24, railT * 1.24));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(bracketGeo, ironMat);
        b.position.set(sx * half, size - railT * 0.44, sz * half);
        cGroup.add(b);
      }
    }

    const sh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(size * 1.45, size * 1.45)), contactShadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.048;
    sh.renderOrder = 1;
    sh.userData.noCollide = true;
    cGroup.add(sh);

    group.add(cGroup);
    occludables.push({ object: cGroup, kind: 'prop' });
    shootableMeshes.push(core);
    colliders.push({
      minX: x - size * 0.54,
      maxX: x + size * 0.54,
      minY: 0,
      maxY: size,
      minZ: z - size * 0.54,
      maxZ: z + size * 0.54,
    });
  };

  // Helper: Composite Spoked Wooden Wagon Wheel with Forged Iron Tire Band
  const buildWagonWheel = (scale = 1): THREE.Group => {
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(wheelRimGeo, woodDarkMat);
    rim.castShadow = true;
    wheel.add(rim);
    const tire = new THREE.Mesh(wheelIronTireGeo, ironMat);
    wheel.add(tire);
    const hub = new THREE.Mesh(wheelHubGeo, ironMat);
    wheel.add(hub);
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(wheelSpokeGeo, woodLightMat);
      spoke.rotation.z = (i * Math.PI) / 6;
      wheel.add(spoke);
    }
    wheel.scale.setScalar(scale);
    return wheel;
  };

  // Helper: High-Craft Ornamental Wrought-Iron Frontier Street Lantern
  const addStreetLamp = (x: number, z: number) => {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0, z);

    const plinth = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 0.36, 8)), ironMat);
    plinth.position.y = 0.18;
    plinth.castShadow = true;
    lamp.add(plinth);

    const collar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.17, 0.32, 8)), ironMat);
    collar.position.y = 0.52;
    lamp.add(collar);

    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.09, 3.35, 10)), ironMat);
    post.position.y = 2.25;
    post.castShadow = true;
    tagSurface(post, ironMat);
    lamp.add(post);
    shootableMeshes.push(post);

    // Ornamental cross-arm ladder rest
    const crossBar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 6)), ironMat);
    crossBar.rotation.z = Math.PI / 2;
    crossBar.position.y = 3.55;
    lamp.add(crossBar);

    // Hexagonal iron lantern cradle + glowing amber gas mantle + brass dome finial
    const cradle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.19, 0.11, 0.12, 6)), ironMat);
    cradle.position.y = 3.88;
    lamp.add(cradle);

    const globe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.12, 0.36, 6)), lanternGlowMat);
    globe.position.y = 4.12;
    lamp.add(globe);

    const glassCage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.21, 0.16, 0.4, 6)), windowGlassMat);
    glassCage.position.y = 4.12;
    lamp.add(glassCage);

    const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.26, 0.24, 6)), ironMat);
    cap.position.y = 4.44;
    lamp.add(cap);

    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 8, 8)), brassMat);
    finial.position.y = 4.58;
    lamp.add(finial);

    group.add(lamp);
    occludables.push({ object: lamp, kind: 'prop' });
    colliders.push({
      minX: x - 0.22,
      maxX: x + 0.22,
      minY: 0,
      maxY: 4.5,
      minZ: z - 0.22,
      maxZ: z + 0.22,
    });
  };

  // Helper: Solid Hitching Post (5-part mortised wooden rail with iron tie rings & collider)
  const addHitchingPost = (x: number, z: number, rotY = 0) => {
    const hitch = new THREE.Group();
    hitch.position.set(x, 0, z);
    hitch.rotation.y = rotY;
    for (const px of [-1.25, 1.25]) {
      const p = new THREE.Mesh(trackGeo(craftedBox(0.15, 1.18, 0.15)), woodDarkMat);
      p.position.set(px, 0.59, 0);
      p.castShadow = true;
      p.receiveShadow = true;
      tagSurface(p, woodDarkMat);
      hitch.add(p);
      shootableMeshes.push(p);
      const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.06, 0.015, 6, 10)), ironMat);
      ring.position.set(px, 0.9, 0.095);
      hitch.add(ring);
    }
    const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.058, 0.062, 2.9, 8)), woodLightMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.06;
    bar.castShadow = true;
    bar.receiveShadow = true;
    tagSurface(bar, woodLightMat);
    hitch.add(bar);
    shootableMeshes.push(bar);
    group.add(hitch);
    occludables.push({ object: hitch, kind: 'prop' });

    const cosH = Math.abs(Math.cos(rotY));
    const hw = cosH > 0.7 ? 1.48 : 0.24;
    const hd = cosH > 0.7 ? 0.24 : 1.48;
    colliders.push({
      minX: x - hw,
      maxX: x + hw,
      minY: 0,
      maxY: 1.16,
      minZ: z - hd,
      maxZ: z + hd,
    });
  };

  // =========================================================================
  // 1. REALISTIC SCULPTED DESERT TERRAIN, DUNES & STRATIFIED CANYON MESAS
  // =========================================================================
  const evalTerrainHeight = (wx: number, wz: number): number => {
    // Keep the playable town basin + railroad corridor cleanly level so all 15 enterable buildings sit flush
    const distOutX = Math.max(0, Math.max(-52 - wx, wx - 48));
    const distOutZ = Math.max(0, Math.max(-40 - wz, wz - 36));
    const outDist = Math.hypot(distOutX, distOutZ);
    if (outDist <= 0.01) return 0;

    // Smooth quintic blend from flat town floor -> rolling desert dunes & canyon foothills
    const blend = Math.min(1, outDist / 26);
    const smooth = blend * blend * (3 - 2 * blend);

    // Multi-octave organic desert dunes & eroded washes
    const n1 = Math.sin(wx * 0.028 + 0.6) * Math.cos(wz * 0.026 - 0.4) * 5.8;
    const n2 = Math.sin(wx * 0.065 - wz * 0.048) * 2.4;
    const n3 = Math.cos(wx * 0.14 + wz * 0.12) * 0.75;
    const rimRise = Math.pow(Math.min(1, outDist / 95), 1.65) * 18.5;

    // Keep the north-south railroad bed cut cleanly through the hills
    const railCut = Math.max(0, 1 - Math.abs(wx - -46.5) / 8.5);
    const rawH = Math.max(0, (rimRise + n1 + n2 + n3 + 3.2) * smooth);
    return rawH * (1 - railCut * 0.94);
  };

  const terrainGeo = trackGeo(new THREE.PlaneGeometry(460, 460, 64, 64));
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);
  const colFlat = new THREE.Color(0xf2e2c4);
  const colRoad = new THREE.Color(0xdcc39b);
  const colSlope = new THREE.Color(0xc99668);
  const colRidge = new THREE.Color(0xb0754b);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i);
    const vz = tPos.getZ(i);
    const vy = evalTerrainHeight(vx, vz);
    tPos.setY(i, vy);

    // Per-vertex natural biome tinting (sunlit sand basin -> red-ochre slopes & rocky ridges)
    const slopeBlend = THREE.MathUtils.clamp(vy / 11, 0, 1);
    const ridgeBlend = THREE.MathUtils.clamp((vy - 8) / 14, 0, 1);
    const patch = 0.5 + 0.5 * Math.sin(vx * 0.07) * Math.cos(vz * 0.07);
    tmpCol.copy(colFlat).lerp(colRoad, patch * 0.25);
    tmpCol.lerp(colSlope, slopeBlend * 0.75);
    tmpCol.lerp(colRidge, ridgeBlend * 0.7);
    tColors[i * 3] = tmpCol.r;
    tColors[i * 3 + 1] = tmpCol.g;
    tColors[i * 3 + 2] = tmpCol.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();

  const desertGround = new THREE.Mesh(terrainGeo, desertSandMat);
  desertGround.receiveShadow = true;
  desertGround.userData.noCollide = true;
  tagSurface(desertGround, desertSandMat);
  group.add(desertGround);
  shootableMeshes.push(desertGround);
  walkableMeshes.push(desertGround);

  // Packed Dirt Main Street running West (Railroad x=-51) -> East Square seam (x=13) — ZERO overlap with East Plaza!
  const mainStreet = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(64, 13.5)), dirtRoadMat);
  mainStreet.rotation.x = -Math.PI / 2;
  mainStreet.position.set(-19, 0.032, 0.8);
  mainStreet.receiveShadow = true;
  mainStreet.userData.noCollide = true;
  tagSurface(mainStreet, dirtRoadMat);
  group.add(mainStreet);
  shootableMeshes.push(mainStreet);
  walkableMeshes.push(mainStreet);

  // Town Square dirt plaza on the East side (x=13 -> x=37) meeting Main Street cleanly at x=13
  const eastPlaza = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(24, 34)), dirtRoadMat);
  eastPlaza.rotation.x = -Math.PI / 2;
  eastPlaza.position.set(25, 0.032, 6);
  eastPlaza.receiveShadow = true;
  eastPlaza.userData.noCollide = true;
  tagSurface(eastPlaza, dirtRoadMat);
  group.add(eastPlaza);
  shootableMeshes.push(eastPlaza);
  walkableMeshes.push(eastPlaza);

  // Embedded gravel breaks the perfectly flat road silhouette. A single draw call
  // covers the whole street; stones stay below the player's step threshold.
  const gravelGeo = trackGeo(new THREE.IcosahedronGeometry(1, 0));
  const gravel = new THREE.InstancedMesh(gravelGeo, boulderMat, 480);
  gravel.name = 'Wind-scoured street gravel';
  gravel.receiveShadow = true;
  gravel.userData.noCollide = true;
  const gravelPose = new THREE.Object3D();
  const gravelTint = new THREE.Color();
  let gravelSeed = 7251;
  const gravelRandom = () => {
    gravelSeed = (Math.imul(gravelSeed, 1664525) + 1013904223) >>> 0;
    return gravelSeed / 4294967296;
  };
  for (let i = 0; i < gravel.count; i++) {
    const x = -48 + gravelRandom() * 86;
    // Keep the center of the carriageway comparatively worn and clear.
    const side = gravelRandom() > 0.5 ? 1 : -1;
    const z = 0.8 + side * (2.8 + gravelRandom() * 3.6);
    const radius = 0.018 + gravelRandom() ** 2 * 0.095;
    gravelPose.position.set(x, 0.035 + radius * 0.18, z);
    gravelPose.rotation.set(gravelRandom(), gravelRandom() * Math.PI, gravelRandom());
    gravelPose.scale.set(radius * 1.5, radius * 0.48, radius);
    gravelPose.updateMatrix();
    gravel.setMatrixAt(i, gravelPose.matrix);
    gravelTint.setHSL(0.085 + gravelRandom() * 0.035, 0.18 + gravelRandom() * 0.18, 0.35 + gravelRandom() * 0.2);
    gravel.setColorAt(i, gravelTint);
  }
  gravel.computeBoundingSphere();
  group.add(gravel);

  // Architectural Walkable Concrete Aprons, Riveted Steel Plates & Tempered Glass Inspection Panels
  // Elevated cleanly above street plane (0.032) with non-overlapping iron corner borders -> ZERO Z-fighting!
  const addWalkablePad = (
    w: number,
    h: number,
    d: number,
    x: number,
    z: number,
    mat: THREE.Material,
    framed = false,
    baseY = 0.038,
  ) => {
    const isGlass = mat === floorGlassMat;
    if (framed) {
      // Recessed dark steel utility shaft sitting below the top surface
      const pit = new THREE.Mesh(trackGeo(craftedBox(w - 0.06, 0.024, d - 0.06)), ironMat);
      pit.position.set(x, baseY + 0.012, z);
      pit.receiveShadow = true;
      pit.userData.noCollide = true;
      group.add(pit);

      // Non-overlapping bolted iron perimeter frame (edgeZ fits strictly between North/South edgeX!)
      const frameH = h + 0.022;
      const frameY = baseY + frameH * 0.5;
      for (const sz of [-1, 1]) {
        const edgeX = new THREE.Mesh(trackGeo(craftedBox(w + 0.22, frameH, 0.11)), ironMat);
        edgeX.position.set(x, frameY, z + sz * (d * 0.5 + 0.055));
        edgeX.receiveShadow = true;
        edgeX.userData.noCollide = true;
        group.add(edgeX);
      }
      for (const sx of [-1, 1]) {
        const edgeZ = new THREE.Mesh(trackGeo(craftedBox(0.11, frameH, d)), ironMat);
        edgeZ.position.set(x + sx * (w * 0.5 + 0.055), frameY, z);
        edgeZ.receiveShadow = true;
        edgeZ.userData.noCollide = true;
        group.add(edgeZ);
      }
    }

    const padGeo = isGlass
      ? trackGeo(new THREE.PlaneGeometry(w, d))
      : trackGeo(craftedBox(w, h, d));
    if (isGlass) padGeo.rotateX(-Math.PI / 2);
    const pad = new THREE.Mesh(padGeo, mat);
    pad.position.set(x, isGlass ? baseY + h : baseY + h * 0.5, z);
    pad.receiveShadow = true;
    pad.castShadow = !isGlass && h > 0.06;
    pad.userData.noCollide = true;
    if (isGlass) pad.renderOrder = 2;
    tagSurface(pad, mat);
    group.add(pad);
    shootableMeshes.push(pad);
    walkableMeshes.push(pad);
    return pad;
  };

  // Brushed Concrete Forecourts & Plazas (State Bank apron, Town Hall courtyard, Flagpole plaza, Crossroads threshold)
  addWalkablePad(9.4, 0.06, 4.2, -13.6, -3.4, brutalistConcreteMat);
  addWalkablePad(5.2, 0.06, 14.2, 27.6, -2.4, brutalistConcreteMat);
  addWalkablePad(6.4, 0.06, 6.4, 26.5, 25.5, brutalistConcreteMat);
  addWalkablePad(2.2, 0.03, 12.6, 13.0, 0.8, brutalistConcreteMat); // Stone crosswalk threshold bridging Main St & Square

  // Heavy Riveted Steel Crossing Deck Plates & Industrial Loading Grates
  // Railroad crossing plate raised cleanly above wooden ties (0.16) so ZERO Z-fighting with ballast or street!
  addWalkablePad(3.8, 0.045, 10.6, -46.5, 0.8, steelPlateMat, true, 0.165);
  addWalkablePad(3.8, 0.06, 5.4, 30.2, 18.8, steelPlateMat, true);
  addWalkablePad(3.4, 0.06, 5.8, -34.8, 14.0, steelPlateMat, true);

  // Tempered Reinforced Glass Utility Skylight / Vault Observation Panels (framed in bolted iron)
  addWalkablePad(3.4, 0.055, 2.8, -10.8, 1.4, floorGlassMat, true);
  addWalkablePad(3.6, 0.055, 3.6, 24.4, 2.2, floorGlassMat, true);
  addWalkablePad(3.2, 0.055, 2.6, 4.2, -2.2, floorGlassMat, true);

  // Helper: Sculpted Multi-Strata Sandstone Butte / Canyon Ridge (organic displaced rock, zero generic boxes!)
  const addSculptedMesa = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotY: number,
    mat: THREE.Material,
    seed: number,
  ) => {
    const mesa = new THREE.Group();
    const baseY = evalTerrainHeight(x, z) - 2.2;
    mesa.position.set(x, baseY, z);
    mesa.rotation.y = rotY;

    // 3 stepped sedimentary geological tiers: wide talus skirt -> eroded cliff wall -> flat sandstone caprock
    const tiers: Array<[number, number, number, number, number]> = [
      [w * 0.54, w * 0.36, h * 0.38, h * 0.19, 1.0],
      [w * 0.37, w * 0.31, h * 0.44, h * 0.56, 0.92],
      [w * 0.32, w * 0.27, h * 0.22, h * 0.86, 0.88],
    ];

    for (let t = 0; t < tiers.length; t++) {
      const [radBot, radTop, tierH, posY, aspect] = tiers[t];
      const geo = trackGeo(new THREE.CylinderGeometry(radTop, radBot, tierH, 14, 4));
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const ang = Math.atan2(pz, px);
        const crag =
          1 +
          0.14 * Math.sin(ang * 3 + seed + t * 1.4) +
          0.08 * Math.cos(ang * 5 - seed * 0.7 + py * 0.18) +
          0.05 * Math.sin(ang * 7 + py * 0.35);
        pos.setXYZ(i, px * crag, py, pz * crag * (d / w) * aspect);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = posY;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesa.add(mesh);
    }

    mesa.userData.noCollide = true;
    group.add(mesa);
  };

  // Sculpted Mid-Ground Canyon Berms framing WEST Valley
  addSculptedMesa(-22, 82, 138, 19, 44, 0.05, canyonRidgeMat, 1.1);
  addSculptedMesa(84, 60, 102, 18, 46, -0.35, canyonRidgeMat, 2.3);
  addSculptedMesa(-16, -84, 134, 17, 42, -0.06, canyonRidgeMat, 3.7);
  addSculptedMesa(94, -34, 96, 19, 48, 0.42, canyonRidgeMat, 4.9);
  addSculptedMesa(-104, -12, 92, 16, 54, 0.15, canyonRidgeMat, 6.2);

  // Towering Distant Layered Red-Rock Monument Buttes encircling the horizon
  const mesaSpecs: Array<[number, number, number, number, number, number]> = [
    [-128, -118, 72, 36, 40, 0.25],
    [12, -138, 94, 42, 42, -0.08],
    [128, -108, 68, 34, 40, 0.45],
    [146, 22, 56, 38, 78, 0.14],
    [118, 132, 80, 32, 42, -0.32],
    [-35, 142, 88, 36, 42, 0.1],
    [-136, 100, 66, 32, 46, -0.4],
  ];
  for (let i = 0; i < mesaSpecs.length; i++) {
    const [x, z, w, h, d, ry] = mesaSpecs[i];
    addSculptedMesa(x, z, w, h, d, ry, mesaMat, 10 + i * 2.17);
  }

  // Instanced Sculpted Desert Sandstone Boulders & Dry Sagebrush Scrub (zero generic spheres/boxes!)
  const boulderGeo = trackGeo(new THREE.DodecahedronGeometry(1.0, 1));
  const bPos = boulderGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const bx = bPos.getX(i);
    const by = bPos.getY(i);
    const bz = bPos.getZ(i);
    const n = 0.84 + 0.26 * Math.sin(bx * 3.1 + by * 2.4) * Math.cos(bz * 2.9 - bx);
    bPos.setXYZ(i, bx * n, by * n * 0.68, bz * n);
  }
  boulderGeo.computeVertexNormals();

  const boulderSpots: Array<[number, number, number, number]> = [
    [-38, -24, 1.5, 0.3],
    [-35, -26, 0.9, 1.2],
    [-28, -32, 1.8, 2.1],
    [-19, -34, 1.2, 0.8],
    [22, -31, 1.6, 1.9],
    [39, -28, 2.1, 0.5],
    [41, -24, 1.1, 2.7],
    [43, -12, 1.4, 1.1],
    [43, 27, 1.9, 0.4],
    [38, 30, 1.1, 2.2],
    [16, 29, 1.5, 1.5],
    [-4, 29, 1.7, 0.9],
    [-29, 28, 1.8, 2.4],
    [-33, 26, 1.0, 0.2],
    [-42, -10, 1.3, 1.7],
    [-55, -26, 2.6, 0.6],
    [-58, 6, 2.4, 1.8],
    [54, -18, 2.8, 2.2],
    [56, 14, 2.5, 0.9],
    [4, -46, 3.1, 1.4],
    [-24, 45, 2.9, 2.8],
    [26, 44, 2.7, 0.4],
  ];
  const boulderInst = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderSpots.length);
  boulderInst.castShadow = true;
  boulderInst.receiveShadow = true;
  const bDummy = new THREE.Object3D();
  const bCol = new THREE.Color();
  for (let i = 0; i < boulderSpots.length; i++) {
    const [bx, bz, sc, ry] = boulderSpots[i];
    const by = evalTerrainHeight(bx, bz) + sc * 0.28;
    bDummy.position.set(bx, by, bz);
    bDummy.rotation.set(0.12 * Math.sin(i), ry, 0.1 * Math.cos(i));
    bDummy.scale.set(sc * 1.15, sc * 0.82, sc);
    bDummy.updateMatrix();
    boulderInst.setMatrixAt(i, bDummy.matrix);
    bCol.setRGB(0.82 + (i % 3) * 0.06, 0.65 + (i % 4) * 0.04, 0.48 + (i % 3) * 0.04);
    boulderInst.setColorAt(i, bCol);
    if (bx > bounds.minX - 2 && bx < bounds.maxX + 2 && bz > bounds.minZ - 2 && bz < bounds.maxZ + 2 && sc >= 0.85) {
      colliders.push({
        minX: bx - sc * 0.9,
        maxX: bx + sc * 0.9,
        minY: 0,
        maxY: sc * 1.15,
        minZ: bz - sc * 0.9,
        maxZ: bz + sc * 0.9,
      });
    }
  }
  boulderInst.instanceMatrix.needsUpdate = true;
  if (boulderInst.instanceColor) boulderInst.instanceColor.needsUpdate = true;
  boulderInst.computeBoundingSphere();
  tagSurface(boulderInst as unknown as THREE.Mesh, boulderMat);
  group.add(boulderInst);
  shootableMeshes.push(boulderInst);

  // Instanced Dry Desert Sagebrush / Scrub Tufts (organic low-poly clusters with tint variation)
  const scrubGeo = trackGeo(new THREE.IcosahedronGeometry(0.55, 1));
  const sPos = scrubGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const sx = sPos.getX(i);
    const sy = sPos.getY(i);
    const sz = sPos.getZ(i);
    const puff = 0.72 + 0.42 * Math.abs(Math.sin(sx * 5.2 + sz * 4.7));
    sPos.setXYZ(i, sx * puff * 1.25, Math.max(0, sy * puff * 0.85 + 0.18), sz * puff * 1.25);
  }
  scrubGeo.computeVertexNormals();

  const scrubSpots: Array<[number, number, number]> = [
    [-39, -22, 0.95], [-34, -29, 1.1], [-22, -33, 1.0], [-14, -36, 0.85],
    [16, -24, 0.9], [25, -29, 1.15], [35, -27, 1.0], [42, -17, 1.1],
    [43, -4, 0.85], [44, 15, 1.05], [34, 28, 1.1], [21, 29, 0.95],
    [10, 27, 0.9], [-9, 26, 1.1], [-22, 27, 1.0], [-36, 26, 1.15],
    [-41, 4, 0.9], [-43, -15, 1.0], [-51, -12, 1.3], [-52, 19, 1.2],
    [49, -8, 1.25], [48, 22, 1.2], [2, -40, 1.35], [-16, 39, 1.3],
    [18, 37, 1.25], [-30, -40, 1.2], [32, -38, 1.3], [-50, -32, 1.25],
  ];
  const scrubInst = new THREE.InstancedMesh(scrubGeo, scrubMat, scrubSpots.length);
  scrubInst.castShadow = true;
  scrubInst.receiveShadow = true;
  for (let i = 0; i < scrubSpots.length; i++) {
    const [sx, sz, sc] = scrubSpots[i];
    const sy = evalTerrainHeight(sx, sz);
    bDummy.position.set(sx, sy, sz);
    bDummy.rotation.set(0, i * 1.37, 0);
    bDummy.scale.set(sc, sc * (0.85 + (i % 3) * 0.12), sc);
    bDummy.updateMatrix();
    scrubInst.setMatrixAt(i, bDummy.matrix);
    // Dry dusty olive-sage & sunlit golden scrub tint variation
    if (i % 3 === 0) bCol.setHex(0x6e734c);
    else if (i % 3 === 1) bCol.setHex(0x8a7d52);
    else bCol.setHex(0x5b6844);
    scrubInst.setColorAt(i, bCol);
  }
  scrubInst.instanceMatrix.needsUpdate = true;
  if (scrubInst.instanceColor) scrubInst.instanceColor.needsUpdate = true;
  scrubInst.computeBoundingSphere();
  scrubInst.userData.noCollide = true;
  group.add(scrubInst);

  // =========================================================================
  // 2. WESTERN RAILROAD TRACKS (Ballast Bed + Ties + Twin Steel Rails + Telegraph Line + Crossing)
  // =========================================================================
  const railX = -46.5;
  const trackLength = 210;

  // Crushed gravel railway ballast berm (clean non-overlapping center bed + flanking shoulders)
  const ballastBed = new THREE.Mesh(trackGeo(craftedBox(3.25, 0.085, trackLength)), ballastMat);
  ballastBed.position.set(railX, 0.0425, 0);
  ballastBed.receiveShadow = true;
  ballastBed.userData.noCollide = true;
  tagSurface(ballastBed, ballastMat);
  group.add(ballastBed);
  walkableMeshes.push(ballastBed);
  for (const side of [-1, 1]) {
    const ballastShoulder = new THREE.Mesh(trackGeo(craftedBox(0.55, 0.045, trackLength)), ballastMat);
    ballastShoulder.position.set(railX + side * 1.9, 0.0225, 0);
    ballastShoulder.receiveShadow = true;
    ballastShoulder.userData.noCollide = true;
    group.add(ballastShoulder);
  }

  const tieCount = 190;
  const tieGeo = trackGeo(craftedBox(2.55, 0.075, 0.24));
  const tieInst = new THREE.InstancedMesh(tieGeo, woodDarkMat, tieCount);
  tieInst.receiveShadow = true;
  tieInst.userData.noCollide = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < tieCount; i++) {
    const z = -trackLength / 2 + (i / (tieCount - 1)) * trackLength;
    dummy.position.set(railX, 0.1225, z);
    dummy.rotation.set(0, (Math.random() - 0.5) * 0.02, 0);
    dummy.updateMatrix();
    tieInst.setMatrixAt(i, dummy.matrix);
  }
  tieInst.instanceMatrix.needsUpdate = true;
  tieInst.computeBoundingSphere();
  group.add(tieInst);

  // Twin gleaming steel rails running North-South with base flanges
  for (const dx of [-0.74, 0.74]) {
    const railBase = new THREE.Mesh(trackGeo(craftedBox(0.18, 0.036, trackLength)), ironMat);
    railBase.position.set(railX + dx, 0.178, 0);
    railBase.receiveShadow = true;
    railBase.userData.noCollide = true;
    tagSurface(railBase, ironMat);
    group.add(railBase);

    const rail = new THREE.Mesh(trackGeo(craftedBox(0.1, 0.12, trackLength)), steelRailMat);
    rail.position.set(railX + dx, 0.256, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    rail.userData.noCollide = true;
    tagSurface(rail, steelRailMat);
    group.add(rail);
    walkableMeshes.push(rail);
  }

  // Telegraph poles running alongside the Railroad with glass insulators, sagging catenary wires & solid colliders
  const poleZList: number[] = [];
  const insulatorGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.055, 0.13, 8));
  for (let z = -66; z <= 66; z += 22) {
    poleZList.push(z);
    const poleX = railX - 2.8;
    const pole = new THREE.Group();
    pole.position.set(poleX, 0, z);
    const mast = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.17, 7.6, 8)), woodDarkMat);
    mast.position.y = 3.8;
    mast.castShadow = true;
    mast.receiveShadow = true;
    tagSurface(mast, woodDarkMat);
    pole.add(mast);
    shootableMeshes.push(mast);

    // Upper & lower timber crossarms with diagonal iron struts & glass insulators
    for (const cy of [6.95, 6.28]) {
      const cross = new THREE.Mesh(trackGeo(craftedBox(1.9, 0.13, 0.13)), woodDarkMat);
      cross.position.y = cy;
      cross.castShadow = true;
      pole.add(cross);

      for (const sx of [-1, 1]) {
        const brace = new THREE.Mesh(trackGeo(craftedBox(0.05, 0.56, 0.05)), ironMat);
        brace.position.set(sx * 0.26, cy - 0.22, 0.09);
        brace.rotation.z = sx * 0.78;
        pole.add(brace);
      }

      for (const ix of [-0.76, 0.76]) {
        const ins = new THREE.Mesh(insulatorGeo, porcelainMat);
        ins.position.set(ix, cy + 0.11, 0);
        pole.add(ins);
      }
    }
    group.add(pole);
    occludables.push({ object: pole, kind: 'prop' });
    if (z >= bounds.minZ - 2 && z <= bounds.maxZ + 2) {
      colliders.push({
        minX: poleX - 0.24,
        maxX: poleX + 0.24,
        minY: 0,
        maxY: 7.6,
        minZ: z - 0.24,
        maxZ: z + 0.24,
      });
    }
  }

  // Sagging catenary iron telegraph wires connecting consecutive poles
  for (let i = 0; i < poleZList.length - 1; i++) {
    const z0 = poleZList[i];
    const z1 = poleZList[i + 1];
    const zm = (z0 + z1) * 0.5;
    for (const [wx, wy] of [
      [-0.76, 7.08],
      [0.76, 7.08],
      [-0.76, 6.41],
      [0.76, 6.41],
    ]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(railX - 2.8 + wx, wy, z0),
        new THREE.Vector3(railX - 2.8 + wx, wy - 0.78, zm),
        new THREE.Vector3(railX - 2.8 + wx, wy, z1),
      );
      const wire = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 10, 0.016, 4, false)), ironMat);
      wire.userData.noCollide = true;
      group.add(wire);
    }
  }

  // Wooden Railroad Crossing X-Buck Signpost where Main Street meets the Tracks
  const xBuck = new THREE.Group();
  xBuck.position.set(railX + 3.2, 0, -5.2);
  xBuck.rotation.y = Math.PI * 0.35;
  const xPost = new THREE.Mesh(trackGeo(craftedBox(0.18, 3.6, 0.18)), whiteTrimMat);
  xPost.position.y = 1.8;
  xPost.castShadow = true;
  xBuck.add(xPost);
  for (const ang of [0.62, -0.62]) {
    const blade = new THREE.Mesh(trackGeo(craftedBox(1.75, 0.24, 0.07)), whiteTrimMat);
    blade.position.set(0, 3.05, 0.1);
    blade.rotation.z = ang;
    blade.castShadow = true;
    xBuck.add(blade);
    const stripe = new THREE.Mesh(trackGeo(craftedBox(1.62, 0.07, 0.085)), darkTrimMat);
    stripe.position.set(0, 3.05, 0.105);
    stripe.rotation.z = ang;
    xBuck.add(stripe);
  }
  const xPlinth = new THREE.Mesh(trackGeo(craftedBox(0.46, 0.24, 0.46)), stoneMat);
  xPlinth.position.y = 0.12;
  xBuck.add(xPlinth);
  group.add(xBuck);
  occludables.push({ object: xBuck, kind: 'prop' });
  colliders.push({
    minX: railX + 3.0,
    maxX: railX + 3.4,
    minY: 0,
    maxY: 3.5,
    minZ: -5.4,
    maxZ: -5.0,
  });

  // =========================================================================
  // 3. ENTERABLE 3D WESTERN BUILDING BUILDER (Hollow Interiors + Doors + Windows + Furniture)
  // =========================================================================
  const buildWesternBuilding = (opts: WesternBuildingOptions) => {
    const {
      cx,
      cz,
      w,
      d,
      h,
      rotY,
      wallStyle,
      roofStyle,
      signTitle,
      signSubtitle,
      signVariant = 'dark',
      twoStory = false,
      porchDepth = 2.2,
      porchWhitePosts = false,
      backDoor = false,
      interiorTheme,
      balconyWalkable = false,
    } = opts;

    const bGroup = new THREE.Group();
    bGroup.position.set(cx, 0, cz);
    bGroup.rotation.y = rotY;
    group.add(bGroup);

    const interiorGroup = new THREE.Group();
    bGroup.add(interiorGroup);

    const cosR = Math.round(Math.cos(rotY));
    const sinR = Math.round(Math.sin(rotY));

    const buildingIdx = buildingFootprints.length;
    buildingFootprints.push({
      cx,
      cz,
      w: Math.abs(cosR) === 1 ? w : d,
      d: Math.abs(cosR) === 1 ? d : w,
    });
    occludables.push({ object: bGroup, kind: 'building', buildingIdx });

    const pushLocalCollider = (lx: number, ly: number, lz: number, bw: number, bh: number, bd: number) => {
      const wx = cx + lx * cosR + lz * sinR;
      const wz = cz - lx * sinR + lz * cosR;
      const worldW = Math.abs(cosR) === 1 ? bw : bd;
      const worldD = Math.abs(cosR) === 1 ? bd : bw;
      colliders.push({
        minX: wx - worldW / 2,
        maxX: wx + worldW / 2,
        minY: ly - bh / 2,
        maxY: ly + bh / 2,
        minZ: wz - worldD / 2,
        maxZ: wz + worldD / 2,
      });
    };

    const addPart = (
      bw: number,
      bh: number,
      bd: number,
      lx: number,
      ly: number,
      lz: number,
      mat: THREE.Material,
      collide = true,
      shootable = true,
      castShadow = true,
      parentObj: THREE.Object3D = bGroup,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(trackGeo(craftedBox(bw, bh, bd)), mat);
      m.position.set(lx, ly, lz);
      m.castShadow = castShadow;
      m.receiveShadow = true;
      if (!collide) m.userData.noCollide = true;
      tagSurface(m, mat);
      parentObj.add(m);
      // Raised lap boards give the facades a real silhouette and self-shadowing.
      // The backing wall remains the uninterrupted collision / bullet surface.
      if ((mat === woodLightMat || mat === woodDarkMat || mat === woodRedMat) &&
          bh > 2 && Math.min(bw, bd) > 0.35 && Math.min(bw, bd) < 0.5 && Math.max(bw, bd) > 1.5) {
        const alongX = bw > bd;
        const span = alongX ? bw : bd;
        const rows = Math.ceil(bh / 0.26);
        const pitch = bh / rows;
        for (const side of [-1, 1]) {
          for (let row = 0; row < rows; row++) {
            const boardGeo = trackGeo(craftedBox(alongX ? span : 0.038, pitch - 0.009, alongX ? 0.038 : span));
            // Match the underlying wall's texture scale instead of stretching a full
            // wall's worth of grain onto every individual board.
            const uv = boardGeo.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
              uv.setY(i, (uv.getY(i) * (pitch - 0.009) + row * pitch) / bh);
            }
            const board = new THREE.Mesh(boardGeo, mat);
            board.position.set(lx + (alongX ? 0 : side * (bw / 2 + 0.012)),
              ly - bh / 2 + (row + 0.5) * pitch,
              lz + (alongX ? side * (bd / 2 + 0.012) : 0));
            board.rotation[alongX ? 'x' : 'z'] = side * 0.035;
            board.castShadow = true;
            board.receiveShadow = true;
            board.userData.noCollide = true;
            parentObj.add(board);
          }
        }
      }
      if (collide) pushLocalCollider(lx, ly, lz, bw, bh, bd);
      if (shootable) shootableMeshes.push(m);
      return m;
    };

    const wallMat =
      wallStyle === 'dark'
        ? woodDarkMat
        : wallStyle === 'red'
          ? woodRedMat
          : wallStyle === 'brick'
            ? brickMat
            : woodLightMat;
    const postMat = porchWhitePosts ? whiteTrimMat : darkTrimMat;
    const roofMat = wallStyle === 'dark' || interiorTheme === 'barn' ? roofDarkShingleMat : roofShingleMat;

    const floorH = 0.24; // Smooth walk-on step height (<= 0.29 engine auto-step!)
    const wallT = 0.44; // Thick solid architectural walls — visually authentic & physically impenetrable
    const doorW = interiorTheme === 'barn' ? 4.4 : 2.5;
    const doorH = interiorTheme === 'barn' ? 3.4 : 2.75;
    const story1H = twoStory ? 3.85 : h;
    const totalH = twoStory ? Math.max(h, 7.2) : h;

    // 1. Recessed Stone Foundation Plinth Skirt (strictly below floorH so ZERO floor Z-fighting!)
    const plinthH = floorH - 0.045;
    const plinthSkirt = new THREE.Mesh(trackGeo(craftedBox(w + 0.24, plinthH, d + 0.24)), stoneMat);
    plinthSkirt.position.set(0, plinthH * 0.5, 0);
    plinthSkirt.receiveShadow = true;
    plinthSkirt.userData.noCollide = true;
    tagSurface(plinthSkirt, stoneMat);
    bGroup.add(plinthSkirt);

    // Exterior timber baseboard kickplates shortened cleanly between corner trims (zero corner overlap!)
    addPart(0.09, 0.2, Math.max(0.5, d - 0.26), -w / 2 - 0.05, floorH + 0.1, 0, darkTrimMat, false, false, false);
    addPart(0.09, 0.2, Math.max(0.5, d - 0.26), w / 2 + 0.05, floorH + 0.1, 0, darkTrimMat, false, false, false);
    addPart(Math.max(0.5, w - 0.26), 0.2, 0.09, 0, floorH + 0.1, -d / 2 - 0.05, darkTrimMat, false, false, false);

    const floorMesh = addPart(w, floorH, d, 0, floorH / 2, 0, woodFloorMat, true, true, false);
    walkableMeshes.push(floorMesh);
    if (porchDepth > 0) {
      const porchMesh = addPart(w + 0.4, floorH, porchDepth, 0, floorH / 2, d / 2 + porchDepth / 2, woodFloorMat, true, true, false);
      walkableMeshes.push(porchMesh);
      // Boardwalk timber curb fascia + low wooden entry step plank + stone pier blocks (zero coplanar seam!)
      addPart(w + 0.48, 0.14, 0.1, 0, floorH - 0.075, d / 2 + porchDepth + 0.055, darkTrimMat, false, false, true);
      addPart(doorW + 0.9, 0.11, 0.34, 0, 0.055, d / 2 + porchDepth + 0.275, woodDarkMat, false, false, true);
      const joistCount = Math.max(3, Math.floor(w / 2.2));
      for (let j = 0; j <= joistCount; j++) {
        const jx = -w / 2 + (j / joistCount) * w;
        const joist = new THREE.Mesh(trackGeo(craftedBox(0.18, 0.14, 0.22)), stoneMat);
        joist.position.set(jx, 0.07, d / 2 + porchDepth - 0.12);
        bGroup.add(joist);
      }
    }

    // 2. FRONT WALL (+d/2) WITH GENEROUS ENTERABLE DOORWAY & FRAMED WINDOWS
    const sideWallSegW = Math.max(0.6, (w - doorW) / 2);
    const frontZ = d / 2 - wallT / 2;

    // Left & right ground-floor front wall piers around the open doorway
    addPart(sideWallSegW, story1H, wallT, -(doorW / 2 + sideWallSegW / 2), floorH + story1H / 2, frontZ, wallMat);
    addPart(sideWallSegW, story1H, wallT, doorW / 2 + sideWallSegW / 2, floorH + story1H / 2, frontZ, wallMat);

    // Header lintel sized EXACTLY to doorW so it butts flush with piers (ZERO coplanar Z-fighting!)
    const lintelH = Math.max(0.4, story1H - doorH);
    addPart(doorW, lintelH, wallT, 0, floorH + doorH + lintelH / 2, frontZ, wallMat);

    // Crisp Wooden Door Frame Jambs & Overhead Trim proud of wall face
    addPart(0.11, doorH, wallT + 0.08, -doorW / 2 + 0.06, floorH + doorH / 2, frontZ, postMat, false, false, false);
    addPart(0.11, doorH, wallT + 0.08, doorW / 2 - 0.06, floorH + doorH / 2, frontZ, postMat, false, false, false);
    addPart(doorW + 0.18, 0.13, wallT + 0.1, 0, floorH + doorH + 0.065, frontZ, postMat, false, false, false);

    // Flanking Wrought-Iron Wall Sconce Entry Lanterns (warm inviting frontier porch atmosphere!)
    if (interiorTheme !== 'barn') {
      for (const sx of [-1, 1]) {
        const scX = sx * (doorW / 2 + 0.36);
        const scY = floorH + 2.28;
        const scZ = frontZ + wallT / 2 + 0.02;
        const backPlate = new THREE.Mesh(trackGeo(craftedBox(0.11, 0.28, 0.04)), ironMat);
        backPlate.position.set(scX, scY, scZ);
        const arm = new THREE.Mesh(trackGeo(craftedBox(0.05, 0.05, 0.22)), ironMat);
        arm.position.set(scX, scY + 0.04, scZ + 0.12);
        const lantern = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.065, 0.22, 6)), lanternGlowMat);
        lantern.position.set(scX, scY - 0.06, scZ + 0.22);
        const hood = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.13, 0.1, 6)), ironMat);
        hood.position.set(scX, scY + 0.09, scZ + 0.22);
        bGroup.add(backPlate, arm, lantern, hood);
      }
    }

    // Iconic Building Facade Accents (Sheriff Star Crest, Barber Pole)
    if (interiorTheme === 'sheriff') {
      const starPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 6)), brassMat);
      starPlate.rotation.x = Math.PI / 2;
      starPlate.position.set(0, floorH + doorH + 0.56, frontZ + wallT / 2 + 0.04);
      bGroup.add(starPlate);
    } else if (interiorTheme === 'barber') {
      const bpGroup = new THREE.Group();
      bpGroup.position.set(doorW / 2 + 0.58, floorH + 1.48, frontZ + wallT / 2 + 0.14);
      const bpBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 10)), brassMat);
      bpBase.position.y = -0.46;
      const bpTop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.11, 0.12, 10)), brassMat);
      bpTop.position.y = 0.46;
      const bpBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 8)), whiteTrimMat);
      bpBall.position.y = 0.58;
      const bpCore = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.82, 12)), whiteTrimMat);
      bpGroup.add(bpBase, bpTop, bpBall, bpCore);
      for (const ry of [-0.26, 0.0, 0.26]) {
        const stripe = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.095, 0.02, 6, 12)), woodRedMat);
        stripe.rotation.x = Math.PI / 2 + 0.35;
        stripe.position.y = ry;
        bpGroup.add(stripe);
      }
      bGroup.add(bpGroup);
    }

    // Saloon swinging batwing half-doors (left slightly ajar on sides so player runs right through!)
    if (interiorTheme === 'saloon') {
      const batL = new THREE.Mesh(trackGeo(craftedBox(0.95, 1.35, 0.08)), woodDarkMat);
      batL.position.set(-doorW / 2 + 0.25, floorH + 1.25, frontZ + 0.38);
      batL.rotation.y = -0.95;
      batL.castShadow = true;
      batL.userData.noCollide = true;
      bGroup.add(batL);
      const batR = new THREE.Mesh(trackGeo(craftedBox(0.95, 1.35, 0.08)), woodDarkMat);
      batR.position.set(doorW / 2 - 0.25, floorH + 1.25, frontZ + 0.38);
      batR.rotation.y = 0.95;
      batR.castShadow = true;
      batR.userData.noCollide = true;
      bGroup.add(batR);
    }

    // Layered Zero-Flicker Framed Windows (Recessed dark interior backing + single-plane glass + non-overlapping sash + shutters)
    const addWindowDetail = (wx: number, wy: number, wz: number, rotWinY = 0) => {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      wg.rotation.y = rotWinY;
      wg.userData.noCollide = true;

      // Dark window recess backing flush proud of wall (gives genuine architectural depth)
      const back = new THREE.Mesh(trackGeo(craftedBox(1.18, 1.44, 0.03)), windowBackdropMat);
      back.position.z = 0.018;
      wg.add(back);

      // 4 non-overlapping sash casing bars framing the window cleanly
      const casingTop = new THREE.Mesh(trackGeo(craftedBox(1.42, 0.12, 0.09)), postMat);
      casingTop.position.set(0, 0.78, 0.045);
      const casingBot = new THREE.Mesh(trackGeo(craftedBox(1.42, 0.12, 0.09)), postMat);
      casingBot.position.set(0, -0.78, 0.045);
      const casingL = new THREE.Mesh(trackGeo(craftedBox(0.12, 1.44, 0.09)), postMat);
      casingL.position.set(-0.65, 0, 0.045);
      const casingR = new THREE.Mesh(trackGeo(craftedBox(0.12, 1.44, 0.09)), postMat);
      casingR.position.set(0.65, 0, 0.045);
      wg.add(casingTop, casingBot, casingL, casingR);

      // Single-sided reflective glass pane cleanly separated from backing & muntins -> ZERO Z-fighting!
      const glass = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.16, 1.42)), windowGlassMat);
      glass.position.z = 0.056;
      glass.renderOrder = 2;
      wg.add(glass);

      // Non-overlapping cross muntin bars in front of glass
      const barV = new THREE.Mesh(trackGeo(craftedBox(0.055, 1.42, 0.03)), postMat);
      barV.position.z = 0.078;
      const barHL = new THREE.Mesh(trackGeo(craftedBox(0.55, 0.055, 0.03)), postMat);
      barHL.position.set(-0.305, 0, 0.078);
      const barHR = new THREE.Mesh(trackGeo(craftedBox(0.55, 0.055, 0.03)), postMat);
      barHR.position.set(0.305, 0, 0.078);
      wg.add(barV, barHL, barHR);

      // Projecting wooden window sill & pediment drip cap
      const sill = new THREE.Mesh(trackGeo(craftedBox(1.58, 0.11, 0.22)), darkTrimMat);
      sill.position.set(0, -0.895, 0.09);
      wg.add(sill);
      const headerCap = new THREE.Mesh(trackGeo(craftedBox(1.6, 0.12, 0.2)), darkTrimMat);
      headerCap.position.set(0, 0.9, 0.085);
      wg.add(headerCap);

      // Open louvered frontier wooden shutters flanking each window cleanly outside casing
      for (const sx of [-1, 1]) {
        const shutter = new THREE.Mesh(trackGeo(craftedBox(0.36, 1.54, 0.055)), shutterMat);
        shutter.position.set(sx * 0.91, 0, 0.04);
        shutter.castShadow = true;
        wg.add(shutter);
        for (let slat = 0; slat < 10; slat++) {
          const louver = new THREE.Mesh(trackGeo(craftedBox(0.3, 0.105, 0.045)), shutterMat);
          louver.position.set(sx * 0.91, -0.64 + slat * 0.142, 0.08);
          louver.rotation.x = -0.32;
          louver.castShadow = true;
          louver.receiveShadow = true;
          louver.userData.noCollide = true;
          wg.add(louver);
        }
      }
      bGroup.add(wg);
    };

    if (sideWallSegW >= 2.1 && interiorTheme !== 'barn') {
      const winOff = doorW / 2 + sideWallSegW * 0.5;
      addWindowDetail(-winOff, floorH + 1.85, frontZ + wallT / 2 + 0.008);
      addWindowDetail(winOff, floorH + 1.85, frontZ + wallT / 2 + 0.008);
    }

    // 3. BACK WALL (-d/2) — Either Open Rear Tactical Exit Doorway or Solid Wall
    const backZ = -d / 2 + wallT / 2;
    if (backDoor) {
      addPart(sideWallSegW, story1H, wallT, -(doorW / 2 + sideWallSegW / 2), floorH + story1H / 2, backZ, wallMat);
      addPart(sideWallSegW, story1H, wallT, doorW / 2 + sideWallSegW / 2, floorH + story1H / 2, backZ, wallMat);
      addPart(doorW, lintelH, wallT, 0, floorH + doorH + lintelH / 2, backZ, wallMat);
      addPart(0.11, doorH, wallT + 0.08, -doorW / 2 + 0.06, floorH + doorH / 2, backZ, postMat, false, false, false);
      addPart(0.11, doorH, wallT + 0.08, doorW / 2 - 0.06, floorH + doorH / 2, backZ, postMat, false, false, false);
      addPart(doorW + 0.18, 0.13, wallT + 0.1, 0, floorH + doorH + 0.065, backZ, postMat, false, false, false);
    } else {
      addPart(w, story1H, wallT, 0, floorH + story1H / 2, backZ, wallMat);
    }

    // 4. LEFT & RIGHT SIDE WALLS (-w/2, +w/2) fitting cleanly between front & back walls
    addPart(wallT, story1H, d - wallT * 2, -w / 2 + wallT / 2, floorH + story1H / 2, 0, wallMat);
    addPart(wallT, story1H, d - wallT * 2, w / 2 - wallT / 2, floorH + story1H / 2, 0, wallMat);

    // Side exterior windows for rich 360-degree silhouette
    if (d >= 7.0) {
      for (const wz of [-1.8, 1.8]) {
        addWindowDetail(-w / 2 - 0.008, floorH + 1.85, wz, -Math.PI / 2);
        addWindowDetail(w / 2 + 0.008, floorH + 1.85, wz, Math.PI / 2);
      }
    }

    // 5. INTERIOR CEILING / 2ND FLOOR DECK + OPTIONAL WALKABLE BALCONY STAIRS
    const ceilingY = floorH + story1H;
    if (twoStory) {
      const upperH = totalH - story1H;
      if (balconyWalkable) {
        // Exact non-overlapping split between main 2nd-floor deck & front stair landing (ZERO Z-fighting!)
        const stairW = 1.9;
        const innerLeft = -w / 2 + wallT;
        const innerRight = w / 2 - wallT;
        const innerBack = -d / 2 + wallT;
        const innerFront = d / 2 - wallT;
        const xSplit = innerLeft + stairW;

        const mainW = Math.max(1.0, innerRight - xSplit);
        const deckMain = addPart(
          mainW,
          0.26,
          innerFront - innerBack,
          (xSplit + innerRight) * 0.5,
          ceilingY,
          0,
          woodFloorMat,
          true,
          true,
          false,
        );
        walkableMeshes.push(deckMain);

        // Front walkway connecting stairs seamlessly to upper balcony doorway
        const stairStartZ = -d / 2 + 0.85;
        const stairEndZ = d * 0.1;
        const landingDepth = Math.max(0.8, innerFront - stairEndZ);
        const deckFront = addPart(
          stairW,
          0.26,
          landingDepth,
          innerLeft + stairW * 0.5,
          ceilingY,
          stairEndZ + landingDepth * 0.5,
          woodFloorMat,
          true,
          true,
          false,
        );
        walkableMeshes.push(deckFront);

        // Build walkable interior wooden staircase rising from rear-left toward front-left
        const stairLen = stairEndZ - stairStartZ;
        const stairLocalX = innerLeft + stairW * 0.5;

        const stairShape = new THREE.Shape();
        stairShape.moveTo(0, 0);
        stairShape.lineTo(stairLen, 0);
        stairShape.lineTo(stairLen, story1H);
        stairShape.closePath();
        const stairGeo = trackGeo(new THREE.ExtrudeGeometry(stairShape, { depth: stairW - 0.12, bevelEnabled: false }));
        stairGeo.rotateY(-Math.PI / 2);
        const stairMesh = new THREE.Mesh(stairGeo, woodFloorMat);
        stairMesh.position.set(stairLocalX + (stairW - 0.12) / 2, floorH, stairStartZ);
        stairMesh.castShadow = true;
        stairMesh.receiveShadow = true;
        stairMesh.userData.noCollide = true; // Analytical ramp surface handles smooth stair ascent
        tagSurface(stairMesh, woodFloorMat);
        bGroup.add(stairMesh);
        shootableMeshes.push(stairMesh);
        walkableMeshes.push(stairMesh);

        // Register world-space walkable ramp corresponding to staircase
        const pLowX = cx + stairLocalX * cosR + stairStartZ * sinR;
        const pLowZ = cz - stairLocalX * sinR + stairStartZ * cosR;
        const pHighX = cx + stairLocalX * cosR + stairEndZ * sinR;
        const pHighZ = cz - stairLocalX * sinR + stairEndZ * cosR;
        const halfW = (stairW - 0.08) / 2;
        if (Math.abs(cosR) === 1) {
          ramps.push({
            minX: pLowX - halfW,
            maxX: pLowX + halfW,
            minZ: Math.min(pLowZ, pHighZ),
            maxZ: Math.max(pLowZ, pHighZ),
            axis: 'z',
            lowEdge: pLowZ,
            highEdge: pHighZ,
            lowY: floorH,
            highY: ceilingY + 0.13,
          });
        } else {
          ramps.push({
            minX: Math.min(pLowX, pHighX),
            maxX: Math.max(pLowX, pHighX),
            minZ: pLowZ - halfW,
            maxZ: pLowZ + halfW,
            axis: 'x',
            lowEdge: pLowX,
            highEdge: pHighX,
            lowY: floorH,
            highY: ceilingY + 0.13,
          });
        }

        // Upper front wall with center doorway opening onto the outdoor 2nd-story balcony (exact non-overlapping lintel!)
        const uDoorW = 2.2;
        const uSideW = (w - uDoorW) / 2;
        addPart(uSideW, upperH, wallT, -(uDoorW / 2 + uSideW / 2), ceilingY + upperH / 2, frontZ, wallMat);
        addPart(uSideW, upperH, wallT, uDoorW / 2 + uSideW / 2, ceilingY + upperH / 2, frontZ, wallMat);
        addPart(uDoorW, 0.7, wallT, 0, ceilingY + upperH - 0.35, frontZ, wallMat);
      } else {
        // Solid 2nd floor ceiling slab & enclosed upper facade
        addPart(w - wallT * 2, 0.28, d - wallT * 2, 0, ceilingY, 0, woodFloorMat, true, true, false);
        addPart(w, upperH, wallT, 0, ceilingY + upperH / 2, frontZ, wallMat);
      }

      // Upper back, left, right walls & top roof slab
      addPart(w, upperH, wallT, 0, ceilingY + upperH / 2, backZ, wallMat);
      addPart(wallT, upperH, d - wallT * 2, -w / 2 + wallT / 2, ceilingY + upperH / 2, 0, wallMat);
      addPart(wallT, upperH, d - wallT * 2, w / 2 - wallT / 2, ceilingY + upperH / 2, 0, wallMat);
      addPart(w + 0.12, 0.3, d + 0.12, 0, floorH + totalH + 0.15, 0, roofMat, true, true, true);

      // Second-story front windows row
      const upperWinCount = w >= 11 ? 4 : 3;
      for (let i = 0; i < upperWinCount; i++) {
        const wx = -w * 0.35 + (upperWinCount > 1 ? (i / (upperWinCount - 1)) * w * 0.7 : 0);
        if (balconyWalkable && Math.abs(wx) < 1.35) continue;
        addWindowDetail(wx, ceilingY + upperH * 0.52, frontZ + wallT / 2 + 0.008);
      }
    } else {
      // Single-story solid ceiling slab sitting cleanly atop walls
      addPart(w + 0.08, 0.28, d + 0.08, 0, ceilingY + 0.14, 0, woodFloorMat, true, true, false);
    }

    // Exposed Interior Ceiling Timber Joists / Rafters (rich indoor architectural texture!)
    const beamCount = Math.max(3, Math.floor(d / 2.2));
    for (let bi = 1; bi < beamCount; bi++) {
      const bz = -d / 2 + wallT + (bi / beamCount) * (d - wallT * 2);
      const beam = new THREE.Mesh(trackGeo(craftedBox(w - wallT * 2.04, 0.18, 0.16)), darkTrimMat);
      beam.position.set(0, ceilingY - 0.22, bz);
      beam.receiveShadow = true;
      beam.userData.noCollide = true;
      interiorGroup.add(beam);
    }

    // Framed Frontier Wanted Posters / Maps mounted on Interior Side Walls
    if (interiorTheme !== 'barn') {
      for (const sx of [-1, 1]) {
        const pFrame = new THREE.Mesh(trackGeo(craftedBox(0.05, 0.86, 0.66)), darkTrimMat);
        pFrame.position.set(sx * (w / 2 - wallT - 0.03), floorH + 1.85, 0.4);
        pFrame.userData.noCollide = true;
        const pPaper = new THREE.Mesh(trackGeo(craftedBox(0.03, 0.72, 0.52)), posterPaperMat);
        pPaper.position.set(sx * (w / 2 - wallT - 0.06), floorH + 1.85, 0.4);
        pPaper.userData.noCollide = true;
        interiorGroup.add(pFrame, pPaper);
      }
    }

    // 6. ROOF ARCHITECTURE (Zero-Flicker Gable Pitched Shingle, Western False-Front Crown, or Flat Timber Parapet)
    const roofBaseY = floorH + totalH + 0.29;
    if (roofStyle === 'gable') {
      const peakH = Math.min(2.6, w * 0.24);
      const slopeLen = Math.hypot(w / 2 + 0.45, peakH);
      const slopeAngle = Math.atan2(peakH, w / 2 + 0.45);

      // Left & right pitched shingle slopes offset minutely in Z so ridge junction never flickers
      const slopeL = new THREE.Mesh(trackGeo(craftedBox(slopeLen, 0.22, d + 0.9)), roofMat);
      slopeL.position.set(-(w / 4 + 0.12), roofBaseY + peakH / 2, 0);
      slopeL.rotation.z = slopeAngle;
      slopeL.castShadow = true;
      slopeL.receiveShadow = true;
      tagSurface(slopeL, roofMat);
      bGroup.add(slopeL);
      shootableMeshes.push(slopeL);

      const slopeR = new THREE.Mesh(trackGeo(craftedBox(slopeLen, 0.22, d + 0.89)), roofMat);
      slopeR.position.set(w / 4 + 0.12, roofBaseY + peakH / 2, 0);
      slopeR.rotation.z = -slopeAngle;
      slopeR.castShadow = true;
      slopeR.receiveShadow = true;
      tagSurface(slopeR, roofMat);
      bGroup.add(slopeR);
      shootableMeshes.push(slopeR);

      // Timber ridge cap beam crowning the gable peak
      const ridgeBeam = new THREE.Mesh(trackGeo(craftedBox(0.38, 0.28, d + 1.08)), darkTrimMat);
      ridgeBeam.position.set(0, roofBaseY + peakH + 0.08, 0);
      ridgeBeam.castShadow = true;
      bGroup.add(ridgeBeam);

      // Front & rear triangular gable walls inset by 0.03m from outer wall plane -> ZERO coplanar Z-fighting!
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-w / 2 + 0.04, 0);
      gableShape.lineTo(w / 2 - 0.04, 0);
      gableShape.lineTo(0, peakH - 0.04);
      gableShape.closePath();
      const gableGeo = trackGeo(new THREE.ExtrudeGeometry(gableShape, { depth: 0.3, bevelEnabled: false }));
      const gFront = new THREE.Mesh(gableGeo, wallMat);
      gFront.position.set(0, roofBaseY, d / 2 - 0.33);
      tagSurface(gFront, wallMat);
      bGroup.add(gFront);
      shootableMeshes.push(gFront);

      const gBack = new THREE.Mesh(gableGeo, wallMat);
      gBack.position.set(0, roofBaseY, -d / 2 + 0.03);
      tagSurface(gBack, wallMat);
      bGroup.add(gBack);
      shootableMeshes.push(gBack);

      // Timber bargeboard fascia trim cleanly outside slope Z ends
      for (const gz of [d / 2 + 0.51, -d / 2 - 0.51]) {
        const bargeL = new THREE.Mesh(trackGeo(craftedBox(slopeLen + 0.1, 0.25, 0.09)), darkTrimMat);
        bargeL.position.set(-(w / 4 + 0.12), roofBaseY + peakH / 2 - 0.04, gz);
        bargeL.rotation.z = slopeAngle;
        bGroup.add(bargeL);
        const bargeR = new THREE.Mesh(trackGeo(craftedBox(slopeLen + 0.1, 0.25, 0.09)), darkTrimMat);
        bargeR.position.set(w / 4 + 0.12, roofBaseY + peakH / 2 - 0.04, gz);
        bargeR.rotation.z = -slopeAngle;
        bGroup.add(bargeR);
      }
    } else if (roofStyle === 'falsefront') {
      // Iconic Tall Western False-Front Stepped Facade Crown (proud overhang, solid & shootable!)
      const crownH = 1.65;
      addPart(w + 0.16, crownH, 0.46, 0, roofBaseY + crownH / 2 + 0.01, frontZ + 0.025, wallMat, true, true, true);
      // Stepped center arch parapet
      addPart(w * 0.56, 0.72, 0.48, 0, roofBaseY + crownH + 0.37, frontZ + 0.03, wallMat, true, true, true);
      // Cornice molding caps clearly above crowns
      addPart(w + 0.44, 0.2, 0.7, 0, roofBaseY + crownH + 0.11, frontZ + 0.1, postMat, false, false, false);
      addPart(w * 0.56 + 0.34, 0.2, 0.7, 0, roofBaseY + crownH + 0.83, frontZ + 0.1, postMat, false, false, false);
      // Sloped shingle roof hidden behind false front
      const shedRoof = new THREE.Mesh(trackGeo(craftedBox(w - 0.08, 0.22, d - 0.2)), roofMat);
      shedRoof.position.set(0, roofBaseY + 0.48, -0.2);
      shedRoof.rotation.x = 0.08;
      shedRoof.castShadow = true;
      shedRoof.receiveShadow = true;
      bGroup.add(shedRoof);
    } else {
      // Flat parapet roof with non-overlapping corner joints (solid & shootable!)
      addPart(w + 0.16, 0.7, 0.34, 0, roofBaseY + 0.36, frontZ + 0.02, wallMat, true, true, true);
      addPart(w + 0.16, 0.45, 0.34, 0, roofBaseY + 0.23, backZ - 0.02, wallMat, true, true, false);
      const sideParapetD = Math.max(0.5, d - 0.76);
      addPart(0.32, 0.5, sideParapetD, -w / 2 + 0.16, roofBaseY + 0.26, 0, wallMat, true, true, false);
      addPart(0.32, 0.5, sideParapetD, w / 2 - 0.16, roofBaseY + 0.26, 0, wallMat, true, true, false);
      addPart(w - 0.7, 0.14, d - 0.76, 0, roofBaseY + 0.08, 0, roofMat, false, false, false);
    }

    // Stovepipe chimney accent on roof with flashing collar & rain hood cap
    if (interiorTheme !== 'barn') {
      const chX = w * 0.26;
      const chZ = -d * 0.22;
      const chimney = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.18, 1.55, 8)), ironMat);
      chimney.position.set(chX, roofBaseY + 1.22, chZ);
      chimney.castShadow = true;
      bGroup.add(chimney);
      const chCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 8)), ironMat);
      chCollar.position.set(chX, roofBaseY + 0.52, chZ);
      bGroup.add(chCollar);
      const chCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.28, 0.18, 8)), ironMat);
      chCap.position.set(chX, roofBaseY + 2.12, chZ);
      bGroup.add(chCap);
    }

    // 7. SOLID FRONT COVERED PORCH COLUMNS, CORBEL BRACES, RAFTER TAILS & 2ND-STORY BALCONY RAILING
    if (porchDepth > 0) {
      const porchOuterZ = d / 2 + porchDepth - 0.14;
      const postPositions: number[] = [-w / 2 + 0.2, w / 2 - 0.2];
      const postCount = w >= 11 ? 5 : 4;
      for (let i = 1; i < postCount - 1; i++) {
        const px = -w / 2 + 0.25 + (i / (postCount - 1)) * (w - 0.5);
        if (Math.abs(px) < doorW / 2 + 0.15) continue;
        postPositions.push(px);
      }

      // Continuous overhead porch header beam tying all posts together
      addPart(w + 0.36, 0.2, 0.22, 0, ceilingY - 0.14, porchOuterZ, postMat, false, true, true);

      const braceGeo = trackGeo(craftedBox(0.11, 0.62, 0.11));
      for (const px of postPositions) {
        const isCorner = Math.abs(Math.abs(px) - (w / 2 - 0.2)) < 0.05;
        const postW = isCorner ? 0.2 : 0.18;
        // Solid & shootable main column shaft!
        addPart(postW, story1H, postW, px, floorH + story1H / 2, porchOuterZ, postMat, true, true, true);
        // Architectural base plinth & top capital collar
        addPart(postW + 0.1, 0.24, postW + 0.1, px, floorH + 0.12, porchOuterZ, darkTrimMat, false, false, false);
        addPart(postW + 0.08, 0.14, postW + 0.08, px, ceilingY - 0.24, porchOuterZ, darkTrimMat, false, false, false);

        // 45-degree diagonal wooden knee braces (corbels) linking post to overhead header
        if (px > -w / 2 + 0.45) {
          const braceL = new THREE.Mesh(braceGeo, postMat);
          braceL.position.set(px - 0.24, ceilingY - 0.42, porchOuterZ);
          braceL.rotation.z = -Math.PI / 4;
          braceL.castShadow = true;
          bGroup.add(braceL);
        }
        if (px < w / 2 - 0.45) {
          const braceR = new THREE.Mesh(braceGeo, postMat);
          braceR.position.set(px + 0.24, ceilingY - 0.42, porchOuterZ);
          braceR.rotation.z = Math.PI / 4;
          braceR.castShadow = true;
          bGroup.add(braceR);
        }
      }

      // Exposed timber roof rafter tails beneath the porch eave
      const rafterCount = Math.max(5, Math.floor(w / 1.1));
      for (let r = 0; r <= rafterCount; r++) {
        const rx = -w / 2 + 0.15 + (r / rafterCount) * (w - 0.3);
        const rafter = new THREE.Mesh(trackGeo(craftedBox(0.09, 0.12, porchDepth + 0.42)), darkTrimMat);
        rafter.position.set(rx, twoStory ? roofBaseY - 0.52 : ceilingY - 0.22, d / 2 + porchDepth / 2);
        rafter.rotation.x = twoStory ? 0.14 : 0.16;
        bGroup.add(rafter);
      }

      // Porch roof deck (walkable balcony deck if 2-story!)
      if (twoStory) {
        const balconyDeck = addPart(
          w + 0.4,
          0.24,
          porchDepth + 0.2,
          0,
          ceilingY,
          d / 2 + porchDepth / 2,
          woodFloorMat,
          balconyWalkable,
          true,
          true,
        );
        if (balconyWalkable) walkableMeshes.push(balconyDeck);
        // Upper balcony waist-high wooden railing (visual rail + FULL-HEIGHT waist collider so nobody slips under!)
        addPart(w + 0.3, 0.14, 0.14, 0, ceilingY + 1.02, porchOuterZ, postMat, false, true, false);
        addPart(0.14, 0.14, porchDepth, -w / 2 - 0.08, ceilingY + 1.02, d / 2 + porchDepth / 2, postMat, false, true, false);
        addPart(0.14, 0.14, porchDepth, w / 2 + 0.08, ceilingY + 1.02, d / 2 + porchDepth / 2, postMat, false, true, false);
        if (balconyWalkable) {
          pushLocalCollider(0, ceilingY + 0.62, porchOuterZ, w + 0.3, 1.12, 0.22);
          pushLocalCollider(-w / 2 - 0.08, ceilingY + 0.62, d / 2 + porchDepth / 2, 0.22, 1.12, porchDepth);
          pushLocalCollider(w / 2 + 0.08, ceilingY + 0.62, d / 2 + porchDepth / 2, 0.22, 1.12, porchDepth);
        }
        const balusterCount = Math.floor(w / 0.9);
        for (let i = 0; i <= balusterCount; i++) {
          const bx = -w / 2 + (i / balusterCount) * w;
          const bPost = new THREE.Mesh(trackGeo(craftedBox(0.08, 0.96, 0.08)), postMat);
          bPost.position.set(bx, ceilingY + 0.52, porchOuterZ);
          bGroup.add(bPost);
        }
        // Solid upper balcony corner support posts linking rail up to canopy
        for (const ux of [-w / 2 + 0.2, w / 2 - 0.2]) {
          addPart(0.16, roofBaseY - ceilingY - 0.35, 0.16, ux, (roofBaseY - 0.25 + ceilingY) * 0.5, porchOuterZ, postMat, balconyWalkable, true, true);
        }
        // Upper porch awning roof over 2nd-story balcony
        const upperCanopy = new THREE.Mesh(trackGeo(craftedBox(w + 0.5, 0.16, porchDepth + 0.3)), roofMat);
        upperCanopy.position.set(0, roofBaseY - 0.4, d / 2 + porchDepth / 2);
        upperCanopy.rotation.x = 0.14;
        upperCanopy.castShadow = true;
        bGroup.add(upperCanopy);
      } else {
        // Sloped single-story porch canopy
        const canopy = new THREE.Mesh(trackGeo(craftedBox(w + 0.5, 0.16, porchDepth + 0.35)), roofMat);
        canopy.position.set(0, ceilingY - 0.12, d / 2 + porchDepth / 2);
        canopy.rotation.x = 0.16;
        canopy.castShadow = true;
        bGroup.add(canopy);
      }
    }

    // 8. CRISP LAYERED WESTERN STOREFRONT SIGNBOARD (Zero Coplanar Overlap!)
    if (signTitle) {
      const signTex = textures.createSignTexture(signTitle, signSubtitle, signVariant);
      const signMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: signTex,
          color: signVariant === 'cream' ? 0xdcd3c2 : 0xffffff,
          roughness: 0.84,
          metalness: 0.04,
        }),
      );
      const signW = Math.min(w * 0.78, 6.2);
      const signH = 1.38;
      const signY = twoStory
        ? roofStyle === 'falsefront'
          ? roofBaseY + 0.88
          : ceilingY + 0.9
        : roofStyle === 'falsefront'
          ? roofBaseY + 0.88
          : ceilingY + 0.65;
      const signZ =
        twoStory && roofStyle !== 'falsefront' && porchDepth > 0
          ? d / 2 + porchDepth + 0.08
          : frontZ + wallT / 2 + 0.16;

      // Recessed dark timber backing frame + projecting top cornice cap + flanking iron straps
      const frameBack = new THREE.Mesh(trackGeo(craftedBox(signW + 0.24, signH + 0.22, 0.08)), darkTrimMat);
      frameBack.position.set(0, signY, signZ - 0.05);
      frameBack.castShadow = true;
      bGroup.add(frameBack);

      const signCap = new THREE.Mesh(trackGeo(craftedBox(signW + 0.38, 0.11, 0.22)), darkTrimMat);
      signCap.position.set(0, signY + signH / 2 + 0.165, signZ + 0.01);
      bGroup.add(signCap);

      // Forged iron mounting straps strictly outside painted sign edges so zero overlap!
      for (const sx of [-1, 1]) {
        const strap = new THREE.Mesh(trackGeo(craftedBox(0.08, signH + 0.22, 0.14)), ironMat);
        strap.position.set(sx * (signW * 0.5 + 0.07), signY, signZ - 0.01);
        bGroup.add(strap);
      }

      const signMesh = new THREE.Mesh(trackGeo(craftedBox(signW, signH, 0.06)), signMat);
      signMesh.position.set(0, signY, signZ + 0.025);
      signMesh.castShadow = true;
      signMesh.receiveShadow = true;
      tagSurface(signMesh, signMat);
      bGroup.add(signMesh);
      shootableMeshes.push(signMesh);
    }

    // 9. WARM INTERIOR HANGING OIL LANTERN + THEMED 3D INTERIOR FURNITURE (Grouped for Occlusion Culling!)
    const lampCord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6)), ironMat);
    lampCord.position.set(0, ceilingY - 0.45, 0);
    lampCord.userData.noCollide = true;
    interiorGroup.add(lampCord);
    const lampBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 8)), lanternGlowMat);
    lampBody.position.set(0, ceilingY - 0.88, 0);
    lampBody.userData.noCollide = true;
    interiorGroup.add(lampBody);
    const lampShade = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.38, 0.16, 8)), ironMat);
    lampShade.position.set(0, ceilingY - 0.68, 0);
    lampShade.userData.noCollide = true;
    interiorGroup.add(lampShade);

    // Interior Furniture by Building Theme (with solid colliders & shootable meshes, culled behind thick walls!)
    if (interiorTheme === 'saloon') {
      // Long polished mahogany saloon bar counter + brass footrail along right interior wall
      addPart(1.1, 1.12, d - 3.0, w / 2 - 1.85, floorH + 0.56, -0.3, woodDarkMat, true, true, true, interiorGroup);
      addPart(1.3, 0.1, d - 2.9, w / 2 - 1.85, floorH + 1.17, -0.3, woodLightMat, false, false, false, interiorGroup);
      const footRail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, d - 3.2, 8)), brassMat);
      footRail.rotation.x = Math.PI / 2;
      footRail.position.set(w / 2 - 2.52, floorH + 0.18, -0.3);
      footRail.userData.noCollide = true;
      interiorGroup.add(footRail);
      // Back bar liquor shelf & whiskey bottles silhouette row
      addPart(0.55, 2.3, d - 3.6, w / 2 - 0.72, floorH + 1.15, -0.3, woodDarkMat, true, true, false, interiorGroup);
      for (let bz = -2.0; bz <= 1.4; bz += 0.42) {
        const bottle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.28, 6)), iThemeGlassOrBrass(bz));
        bottle.position.set(w / 2 - 0.85, floorH + 1.56, bz);
        bottle.userData.noCollide = true;
        interiorGroup.add(bottle);
      }
      // Round saloon poker tables on left/center floor
      for (const tz of [-1.2, 1.6]) {
        const tbl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 12)), woodLightMat);
        tbl.position.set(-1.1, floorH + 0.82, tz);
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.22, 0.8, 8)), woodDarkMat);
        leg.position.set(-1.1, floorH + 0.4, tz);
        interiorGroup.add(tbl, leg);
        shootableMeshes.push(tbl);
        pushLocalCollider(-1.1, floorH + 0.45, tz, 1.48, 0.92, 1.48);
      }
    } else if (interiorTheme === 'bank') {
      // Bank teller counter with iron security grille bars
      addPart(w - 2.6, 1.12, 0.85, 0, floorH + 0.56, -0.6, woodDarkMat, true, true, true, interiorGroup);
      for (let bx = -(w / 2 - 1.6); bx <= w / 2 - 1.6; bx += 0.38) {
        if (Math.abs(bx) < 0.7) continue;
        const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6)), ironMat);
        bar.position.set(bx, floorH + 1.82, -0.6);
        bar.userData.noCollide = true;
        interiorGroup.add(bar);
      }
      // Heavy riveted iron bank vault safe + stacked gold bullion bars!
      addPart(1.8, 2.1, 1.5, w / 2 - 1.65, floorH + 1.05, -d / 2 + 1.45, ironMat, true, true, true, interiorGroup);
      for (let g = 0; g < 3; g++) {
        const bar = new THREE.Mesh(trackGeo(craftedBox(0.28, 0.1, 0.14)), goldBullionMat);
        bar.position.set(-1.1 + g * 0.34, floorH + 1.17, -0.62);
        bar.userData.noCollide = true;
        interiorGroup.add(bar);
      }
    } else if (interiorTheme === 'sheriff') {
      // Sheriff's wooden desk in front-left
      addPart(2.2, 0.92, 1.05, -w / 2 + 2.05, floorH + 0.46, 1.1, woodDarkMat, true, true, true, interiorGroup);
      // Twin iron-barred frontier jail cell divider along rear half
      addPart(w - 1.0, 0.16, 0.16, 0, floorH + 2.65, -1.2, ironMat, false, false, false, interiorGroup);
      for (let jx = -w / 2 + 0.9; jx <= w / 2 - 0.9; jx += 0.34) {
        if (jx > -0.8 && jx < 1.0) continue;
        const bar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 2.65, 6)), ironMat);
        bar.position.set(jx, floorH + 1.32, -1.2);
        bar.userData.noCollide = true;
        interiorGroup.add(bar);
      }
      pushLocalCollider(-w / 4 - 0.4, floorH + 1.3, -1.2, w / 2 - 1.2, 2.6, 0.32);
      pushLocalCollider(w / 4 + 0.5, floorH + 1.3, -1.2, w / 2 - 1.4, 2.6, 0.32);
    } else if (interiorTheme === 'blacksmith') {
      // Brick blacksmith forge hearth with glowing orange embers + solid chimney hood!
      addPart(2.2, 1.15, 1.5, -w / 2 + 1.75, floorH + 0.58, -d / 2 + 1.35, brickMat, true, true, true, interiorGroup);
      const embers = new THREE.Mesh(trackGeo(craftedBox(1.4, 0.18, 0.9)), forgeEmberMat);
      embers.position.set(-w / 2 + 1.75, floorH + 1.24, -d / 2 + 1.35);
      embers.userData.noCollide = true;
      interiorGroup.add(embers);
      addPart(1.6, 2.2, 1.2, -w / 2 + 1.75, floorH + 2.75, -d / 2 + 1.15, brickMat, true, true, true, interiorGroup);
      addPart(0.65, 0.72, 0.65, 1.4, floorH + 0.36, -0.4, woodDarkMat, true, true, true, interiorGroup);
      addPart(0.85, 0.34, 0.38, 1.4, floorH + 0.89, -0.4, ironMat, true, true, true, interiorGroup);
    } else if (interiorTheme === 'barn') {
      // Wooden horse stall partitions on left & right interior flanks + stacked golden hay bales
      addPart(3.2, 1.45, 0.24, -w / 2 + 2.05, floorH + 0.72, 0, woodDarkMat, true, true, true, interiorGroup);
      addPart(3.2, 1.45, 0.24, w / 2 - 2.05, floorH + 0.72, 0, woodDarkMat, true, true, true, interiorGroup);
      addPart(1.5, 0.95, 1.1, -w / 2 + 1.5, floorH + 0.48, -2.1, hayMat, true, true, true, interiorGroup);
      addPart(1.5, 0.95, 1.1, -w / 2 + 1.6, floorH + 1.44, -2.1, hayMat, true, true, true, interiorGroup);
      addPart(1.5, 0.95, 1.1, w / 2 - 1.5, floorH + 0.48, 2.0, hayMat, true, true, true, interiorGroup);
    } else if (interiorTheme === 'store' || interiorTheme === 'office' || interiorTheme === 'depot') {
      addPart(w * 0.46, 1.05, 0.88, -w * 0.16, floorH + 0.52, -0.8, woodLightMat, true, true, true, interiorGroup);
      addPart(1.15, 1.15, 1.15, w / 2 - 1.25, floorH + 0.58, -d / 2 + 1.35, crateMat, true, true, true, interiorGroup);
      addPart(0.95, 0.95, 0.95, w / 2 - 1.3, floorH + 1.64, -d / 2 + 1.4, crateMat, true, true, true, interiorGroup);
    } else if (interiorTheme === 'hotel') {
      addPart(2.8, 1.08, 0.9, w / 2 - 2.35, floorH + 0.54, -0.8, woodDarkMat, true, true, true, interiorGroup);
      addPart(1.8, 0.55, 0.65, -1.6, floorH + 0.28, 1.2, woodLightMat, true, true, true, interiorGroup);
    } else if (interiorTheme === 'barber') {
      addPart(w - 2.4, 1.0, 0.65, 0, floorH + 0.5, -d / 2 + 0.9, woodDarkMat, true, true, true, interiorGroup);
      addPart(0.9, 0.95, 0.9, -1.1, floorH + 0.48, 0.3, woodRedMat, true, true, true, interiorGroup);
      addPart(0.9, 0.95, 0.9, 1.2, floorH + 0.48, 0.3, woodRedMat, true, true, true, interiorGroup);
    }

    occludables.push({ object: interiorGroup, kind: 'interior', buildingIdx });

    // Crisp wooden corner trim boards sitting cleanly proud of exterior wall faces (ZERO wall Z-fighting!)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const trim = new THREE.Mesh(trackGeo(craftedBox(0.22, totalH, 0.22)), postMat);
        trim.position.set(sx * (w / 2 + 0.03), floorH + totalH / 2, sz * (d / 2 + 0.03));
        trim.castShadow = true;
        trim.userData.noCollide = true;
        bGroup.add(trim);
      }
    }
  };

  const iThemeGlassOrBrass = (seed: number): THREE.Material => (Math.round(seed * 10) % 2 === 0 ? brassMat : porcelainMat);

  // =========================================================================
  // 4. POPULATE ALL 15 ENTERABLE BUILDINGS OF "WEST" (Faithful to Reference Layout!)
  // =========================================================================

  // --- WEST RAILROAD STATION ---
  buildWesternBuilding({
    cx: -40.5,
    cz: 14,
    w: 13.0,
    d: 6.2,
    h: 4.1,
    rotY: Math.PI / 2, // Facing East toward town
    wallStyle: 'dark',
    roofStyle: 'gable',
    signTitle: 'WEST DEPOT',
    signSubtitle: 'PACIFIC RAILROAD',
    signVariant: 'cream',
    porchDepth: 2.3,
    backDoor: true,
    interiorTheme: 'depot',
  });

  // --- NORTH ROW OF MAIN STREET (Facing South, rotY = 0) ---
  // 1. Grand Corner Saloon (2-story, walkable interior staircase to upper balcony!)
  buildWesternBuilding({
    cx: -24.0,
    cz: -12.0,
    w: 12.0,
    d: 9.0,
    h: 7.4,
    rotY: 0,
    wallStyle: 'light',
    roofStyle: 'falsefront',
    signTitle: 'SALOON',
    signSubtitle: 'BILLIARDS & SPIRITS',
    signVariant: 'dark',
    twoStory: true,
    porchDepth: 2.3,
    backDoor: true,
    interiorTheme: 'saloon',
    balconyWalkable: true,
  });

  // 2. State Bank (attached East of Saloon, bold cream sign)
  buildWesternBuilding({
    cx: -13.6,
    cz: -11.6,
    w: 8.6,
    d: 8.2,
    h: 5.2,
    rotY: 0,
    wallStyle: 'red',
    roofStyle: 'flat',
    signTitle: 'STATE BANK',
    signSubtitle: 'GOLD & BULLION',
    signVariant: 'cream',
    porchDepth: 2.1,
    backDoor: true,
    interiorTheme: 'bank',
  });

  // 3. Land Office (dark weathered plank, pitched shingle roof)
  buildWesternBuilding({
    cx: 1.5,
    cz: -12.0,
    w: 8.6,
    d: 8.2,
    h: 4.3,
    rotY: 0,
    wallStyle: 'dark',
    roofStyle: 'gable',
    signTitle: 'LAND OFFICE',
    signSubtitle: 'DEEDS & CLAIMS',
    signVariant: 'cream',
    porchDepth: 2.2,
    backDoor: true,
    interiorTheme: 'office',
  });

  // 4. General Store / Mercantile (2-story with white porch columns!)
  buildWesternBuilding({
    cx: 11.2,
    cz: -12.0,
    w: 8.6,
    d: 8.2,
    h: 7.2,
    rotY: 0,
    wallStyle: 'dark',
    roofStyle: 'gable',
    signTitle: 'GENERAL STORE',
    signSubtitle: 'DRY GOODS & AMMO',
    signVariant: 'dark',
    twoStory: true,
    porchDepth: 2.2,
    porchWhitePosts: true,
    backDoor: true,
    interiorTheme: 'store',
  });

  // 5. Post Office (East end of North Row)
  buildWesternBuilding({
    cx: 20.4,
    cz: -12.0,
    w: 7.4,
    d: 7.6,
    h: 4.4,
    rotY: 0,
    wallStyle: 'light',
    roofStyle: 'falsefront',
    signTitle: 'POST OFFICE',
    signSubtitle: 'PONY EXPRESS',
    signVariant: 'dark',
    porchDepth: 2.1,
    backDoor: true,
    interiorTheme: 'office',
  });

  // --- NORTH RANCH BACKYARD: HORSE BARN ---
  buildWesternBuilding({
    cx: 6.2,
    cz: -28.0,
    w: 13.6,
    d: 8.2,
    h: 4.6,
    rotY: 0,
    wallStyle: 'dark',
    roofStyle: 'gable',
    signTitle: 'LIVERY BARN',
    signVariant: 'dark',
    porchDepth: 0,
    backDoor: true,
    interiorTheme: 'barn',
  });

  // --- SOUTH ROW OF MAIN STREET (Facing North, rotY = Math.PI) ---
  // 6. Grand Hotel (South-West corner, 2-story, walkable staircase to upper balcony!)
  buildWesternBuilding({
    cx: -23.5,
    cz: 14.5,
    w: 12.6,
    d: 9.0,
    h: 7.5,
    rotY: Math.PI,
    wallStyle: 'light',
    roofStyle: 'flat',
    signTitle: 'GRAND HOTEL',
    signSubtitle: 'ROOMS & BOARD',
    signVariant: 'dark',
    twoStory: true,
    porchDepth: 2.3,
    backDoor: true,
    interiorTheme: 'hotel',
    balconyWalkable: true,
  });

  // 7. Tonsorial Palace (arched wooden false front)
  buildWesternBuilding({
    cx: -6.0,
    cz: 13.6,
    w: 8.6,
    d: 8.0,
    h: 4.5,
    rotY: Math.PI,
    wallStyle: 'light',
    roofStyle: 'falsefront',
    signTitle: 'TONSORIAL PALACE',
    signSubtitle: 'SHAVE & HAIRCUT',
    signVariant: 'dark',
    porchDepth: 2.2,
    backDoor: true,
    interiorTheme: 'barber',
  });

  // 8. Frontier Print & Goods Shop
  buildWesternBuilding({
    cx: 2.4,
    cz: 13.6,
    w: 7.4,
    d: 7.8,
    h: 4.4,
    rotY: Math.PI,
    wallStyle: 'dark',
    roofStyle: 'falsefront',
    signTitle: 'WEST GAZETTE',
    signSubtitle: 'PRINT SHOP',
    signVariant: 'cream',
    porchDepth: 2.1,
    backDoor: false,
    interiorTheme: 'office',
  });

  // 9. Sheriff's Office & Jail (Iconic Red 2-Story Building with White Columns!)
  buildWesternBuilding({
    cx: 12.2,
    cz: 13.8,
    w: 9.4,
    d: 8.6,
    h: 7.4,
    rotY: Math.PI,
    wallStyle: 'red',
    roofStyle: 'falsefront',
    signTitle: "SHERIFF'S OFFICE",
    signSubtitle: 'COUNTY JAIL',
    signVariant: 'dark',
    twoStory: true,
    porchDepth: 2.3,
    porchWhitePosts: true,
    backDoor: true,
    interiorTheme: 'sheriff',
  });

  // 10. Feed & Grain Annex (East of Sheriff's Office)
  buildWesternBuilding({
    cx: 20.8,
    cz: 13.8,
    w: 7.2,
    d: 7.8,
    h: 4.5,
    rotY: Math.PI,
    wallStyle: 'light',
    roofStyle: 'falsefront',
    signTitle: 'FEED & GRAIN',
    signVariant: 'dark',
    porchDepth: 2.0,
    backDoor: true,
    interiorTheme: 'store',
  });

  // --- EAST TOWN SQUARE ROW (Facing West, rotY = -Math.PI / 2) ---
  // 11. Town Hall / Western Hotel (long 2-story brick building)
  buildWesternBuilding({
    cx: 36.5,
    cz: -2.4,
    w: 13.2,
    d: 7.8,
    h: 7.2,
    rotY: -Math.PI / 2,
    wallStyle: 'brick',
    roofStyle: 'flat',
    signTitle: 'TOWN HALL',
    signSubtitle: 'FRONTIER HOTEL',
    signVariant: 'cream',
    twoStory: true,
    porchDepth: 2.2,
    backDoor: true,
    interiorTheme: 'hotel',
  });

  // 12. Barber Shop
  buildWesternBuilding({
    cx: 36.5,
    cz: 9.2,
    w: 7.6,
    d: 7.2,
    h: 4.6,
    rotY: -Math.PI / 2,
    wallStyle: 'dark',
    roofStyle: 'falsefront',
    signTitle: 'BARBER SHOP',
    signVariant: 'red',
    porchDepth: 2.1,
    porchWhitePosts: true,
    backDoor: false,
    interiorTheme: 'barber',
  });

  // 13. Blacksmith Forge Shop
  buildWesternBuilding({
    cx: 36.5,
    cz: 18.8,
    w: 8.6,
    d: 7.4,
    h: 4.4,
    rotY: -Math.PI / 2,
    wallStyle: 'light',
    roofStyle: 'gable',
    signTitle: 'BLACKSMITH',
    signSubtitle: 'IRONWORKS & SHOEING',
    signVariant: 'dark',
    porchDepth: 2.2,
    backDoor: true,
    interiorTheme: 'blacksmith',
  });

  // =========================================================================
  // 5. ICONIC LANDMARKS: WATER TOWER, OCTAGONAL CORRAL, COVERED WAGON, FLAGPOLE
  // =========================================================================

  // 5A. Tall Wooden Water Tower (North-East Landmark, 15.5m tall!)
  const buildWaterTower = (x: number, z: number) => {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);

    const legH = 10.6;
    const spreadBot = 2.55;
    const spreadTop = 1.95;
    const legGeo = trackGeo(craftedBox(0.32, legH, 0.32));

    // 4 slightly canted heavy timber support legs seated on concrete/stone footing piers
    const pierGeo = trackGeo(craftedBox(0.72, 0.56, 0.72));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pier = new THREE.Mesh(pierGeo, stoneMat);
        pier.position.set(sx * spreadBot, 0.28, sz * spreadBot);
        pier.castShadow = true;
        pier.receiveShadow = true;
        tower.add(pier);

        const leg = new THREE.Mesh(legGeo, woodDarkMat);
        leg.position.set(sx * ((spreadBot + spreadTop) / 2), legH / 2, sz * ((spreadBot + spreadTop) / 2));
        leg.rotation.z = sx * 0.055;
        leg.rotation.x = -sz * 0.055;
        leg.castShadow = true;
        tower.add(leg);
      }
    }

    // Horizontal girts & diagonal timber X-bracing across 3 tiers
    const tierYs = [0.4, 3.4, 6.6, 9.8];
    for (let t = 0; t < tierYs.length - 1; t++) {
      const y0 = tierYs[t];
      const y1 = tierYs[t + 1];
      const ym = (y0 + y1) * 0.5;
      const dh = y1 - y0;
      const spanTop = THREE.MathUtils.lerp(spreadBot * 2, spreadTop * 2, y1 / legH);
      const spanMid = THREE.MathUtils.lerp(spreadBot * 2, spreadTop * 2, ym / legH);
      const diagLen = Math.hypot(spanMid * 0.92, dh * 0.92);
      const diagAng = Math.atan2(spanMid * 0.92, dh * 0.92);

      // Horizontal girt beams at top of tier + non-overlapping offset X-braces (zero Z-fighting at crossing!)
      for (const sz of [-1, 1]) {
        const beam = new THREE.Mesh(trackGeo(craftedBox(spanTop, 0.22, 0.22)), woodDarkMat);
        beam.position.set(0, y1, sz * (spanTop / 2));
        tower.add(beam);
        for (const dir of [-1, 1]) {
          const strut = new THREE.Mesh(trackGeo(craftedBox(0.13, diagLen, 0.13)), woodLightMat);
          strut.position.set(0, ym, sz * (spanMid / 2) + dir * 0.065);
          strut.rotation.z = dir * diagAng;
          tower.add(strut);
        }
      }
      for (const sx of [-1, 1]) {
        const beam = new THREE.Mesh(trackGeo(craftedBox(0.22, 0.22, spanTop - 0.24)), woodDarkMat);
        beam.position.set(sx * (spanTop / 2), y1, 0);
        tower.add(beam);
        for (const dir of [-1, 1]) {
          const strut = new THREE.Mesh(trackGeo(craftedBox(0.13, diagLen, 0.13)), woodLightMat);
          strut.position.set(sx * (spanMid / 2) + dir * 0.065, ym, 0);
          strut.rotation.x = dir * diagAng;
          tower.add(strut);
        }
      }
    }

    // Wooden maintenance access ladder climbing up the south face
    for (const lx of [-0.28, 0.28]) {
      const rail = new THREE.Mesh(trackGeo(craftedBox(0.08, legH + 0.4, 0.08)), woodDarkMat);
      rail.position.set(lx, legH / 2 + 0.1, (spreadBot + spreadTop) * 0.5 + 0.18);
      rail.rotation.x = -0.055;
      tower.add(rail);
    }
    for (let ry = 0.6; ry <= legH; ry += 0.46) {
      const rz = THREE.MathUtils.lerp(spreadBot, spreadTop, ry / legH) + 0.2;
      const rung = new THREE.Mesh(trackGeo(craftedBox(0.62, 0.05, 0.05)), woodLightMat);
      rung.position.set(0, ry, rz);
      tower.add(rung);
    }

    // Timber platform deck with support joists
    const deck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.65, 2.65, 0.34, 16)), woodFloorMat);
    deck.position.y = legH;
    deck.castShadow = true;
    tower.add(deck);

    // Banded wooden stave water tank
    const tank = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(2.15, 2.22, 3.6, 18)), woodLightMat);
    tank.position.y = legH + 1.95;
    tank.castShadow = true;
    tank.receiveShadow = true;
    tower.add(tank);

    for (const hy of [legH + 0.65, legH + 1.45, legH + 2.35, legH + 3.2]) {
      const hoop = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(2.22, 0.05, 6, 20)), ironMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      tower.add(hoop);
    }

    // Hinged railway iron water spout chute + counterweight chain
    const spout = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.26, 2.4, 10)), ironMat);
    spout.position.set(-2.45, legH + 1.55, 0);
    spout.rotation.z = 0.72;
    spout.castShadow = true;
    tower.add(spout);
    const pulleyArm = new THREE.Mesh(trackGeo(craftedBox(1.1, 0.12, 0.12)), woodDarkMat);
    pulleyArm.position.set(-2.35, legH + 3.5, 0);
    tower.add(pulleyArm);
    const chainRod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6)), ironMat);
    chainRod.position.set(-2.85, legH + 2.75, 0);
    tower.add(chainRod);

    // Conical cedar shingle roof + brass lightning finial
    const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.7, 1.9, 18)), roofShingleMat);
    cone.position.y = legH + 4.65;
    cone.castShadow = true;
    tower.add(cone);
    const spire = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 6)), ironMat);
    spire.position.y = legH + 5.85;
    tower.add(spire);

    // Central insulated water riser pipe
    const pipe = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.26, 0.28, legH, 10)), ironMat);
    pipe.position.y = legH / 2;
    tower.add(pipe);

    group.add(tower);
    occludables.push({ object: tower, kind: 'prop' });
    shootableMeshes.push(tank, deck);
    // Ground-level colliders on the 4 corner legs + center pipe
    colliders.push({ minX: x - 0.35, maxX: x + 0.35, minY: 0, maxY: legH, minZ: z - 0.35, maxZ: z + 0.35 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        colliders.push({
          minX: x + sx * spreadBot - 0.32,
          maxX: x + sx * spreadBot + 0.32,
          minY: 0,
          maxY: legH,
          minZ: z + sz * spreadBot - 0.32,
          maxZ: z + sz * spreadBot + 0.32,
        });
      }
    }
  };

  buildWaterTower(30.5, -23.5);

  // 5A-2. Tall Frontier Wooden Windmill Water Pump (North-East Ranch Skyline Landmark!)
  const buildWindmill = (x: number, z: number) => {
    const mill = new THREE.Group();
    mill.position.set(x, 0, z);

    const h = 11.4;
    const bot = 1.55;
    const top = 0.48;
    const legLen = Math.hypot(bot - top, h);
    const tilt = Math.atan2(bot - top, h);
    const legGeo = trackGeo(craftedBox(0.18, legLen, 0.18));

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pier = new THREE.Mesh(trackGeo(craftedBox(0.44, 0.36, 0.44)), stoneMat);
        pier.position.set(sx * bot, 0.18, sz * bot);
        mill.add(pier);

        const leg = new THREE.Mesh(legGeo, woodDarkMat);
        leg.position.set(sx * ((bot + top) * 0.5), h * 0.5, sz * ((bot + top) * 0.5));
        leg.rotation.z = sx * tilt;
        leg.rotation.x = -sz * tilt;
        leg.castShadow = true;
        mill.add(leg);
      }
    }

    // 4 horizontal bracing tiers
    for (const ty of [2.6, 5.4, 8.2, 10.6]) {
      const span = THREE.MathUtils.lerp(bot * 2, top * 2, ty / h);
      for (const sz of [-1, 1]) {
        const girt = new THREE.Mesh(trackGeo(craftedBox(span, 0.13, 0.13)), woodLightMat);
        girt.position.set(0, ty, sz * (span * 0.5));
        mill.add(girt);
      }
      for (const sx of [-1, 1]) {
        const girt = new THREE.Mesh(trackGeo(craftedBox(0.13, 0.13, span)), woodLightMat);
        girt.position.set(sx * (span * 0.5), ty, 0);
        mill.add(girt);
      }
    }

    // Service deck & vertical steel pump rod
    const plat = new THREE.Mesh(trackGeo(craftedBox(1.5, 0.16, 1.5)), woodFloorMat);
    plat.position.y = h - 0.6;
    mill.add(plat);
    const pumpRod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, h + 0.6, 6)), ironMat);
    pumpRod.position.y = (h + 0.6) * 0.5;
    mill.add(pumpRod);

    // Turbine head housing + 12-blade galvanized steel wheel + directional tail vane
    const headGroup = new THREE.Group();
    headGroup.position.set(0, h + 0.45, 0);
    headGroup.rotation.y = 0.55;
    const gearbox = new THREE.Mesh(trackGeo(craftedBox(0.45, 0.42, 0.72)), ironMat);
    headGroup.add(gearbox);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 0, 0.62);
    const wheelRingOuter = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.82, 0.035, 6, 20)), ironMat);
    const wheelRingInner = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.88, 0.025, 6, 16)), ironMat);
    wheelGroup.add(wheelRingOuter, wheelRingInner);
    const bladeGeo = trackGeo(craftedBox(0.32, 1.25, 0.025));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const blade = new THREE.Mesh(bladeGeo, steelRailMat);
      blade.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0);
      blade.rotation.z = a - Math.PI / 2;
      blade.rotation.y = 0.34;
      blade.castShadow = true;
      wheelGroup.add(blade);
    }
    headGroup.add(wheelGroup);
    animatedProps.windmillWheel = wheelGroup;

    const tailBoom = new THREE.Mesh(trackGeo(craftedBox(0.08, 0.08, 2.3)), ironMat);
    tailBoom.position.set(0, 0, -1.45);
    headGroup.add(tailBoom);
    const tailVane = new THREE.Mesh(trackGeo(craftedBox(0.04, 1.05, 1.15)), woodRedMat);
    tailVane.position.set(0, 0.08, -2.45);
    tailVane.castShadow = true;
    headGroup.add(tailVane);

    mill.add(headGroup);
    group.add(mill);
    occludables.push({ object: mill, kind: 'prop' });
    colliders.push({ minX: x - 1.65, maxX: x + 1.65, minY: 0, maxY: 6.5, minZ: z - 1.65, maxZ: z + 1.65 });
  };

  buildWindmill(21.5, -27.5);

  // 5B. Octagonal Wooden Horse Corral Fence (North-West of Barn, open South gate!)
  const buildOctagonalCorral = (cx: number, cz: number, radius: number) => {
    const sides = 8;
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 + Math.PI / 8;
      const a1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / 8;
      const x0 = cx + Math.cos(a0) * radius;
      const z0 = cz + Math.sin(a0) * radius;
      const x1 = cx + Math.cos(a1) * radius;
      const z1 = cz + Math.sin(a1) * radius;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(x1 - x0, z1 - z0);

      // Leave the South-facing segment (i === 1) as an open overhead gate archway with solid gate posts!
      if (i === 1) {
        const gate = new THREE.Group();
        gate.position.set(mx, 0, mz);
        gate.rotation.y = ang + Math.PI / 2;
        for (const gx of [-1.7, 1.7]) {
          const gp = new THREE.Mesh(trackGeo(craftedBox(0.24, 3.2, 0.24)), woodDarkMat);
          gp.position.set(gx, 1.6, 0);
          gp.castShadow = true;
          tagSurface(gp, woodDarkMat);
          gate.add(gp);
          shootableMeshes.push(gp);
          const worldRot = ang + Math.PI / 2;
          const gwx = mx + gx * Math.cos(worldRot);
          const gwz = mz - gx * Math.sin(worldRot);
          colliders.push({
            minX: gwx - 0.22,
            maxX: gwx + 0.22,
            minY: 0,
            maxY: 3.2,
            minZ: gwz - 0.22,
            maxZ: gwz + 0.22,
          });
        }
        const header = new THREE.Mesh(trackGeo(craftedBox(3.8, 0.26, 0.24)), woodDarkMat);
        header.position.y = 3.15;
        gate.add(header);
        group.add(gate);
        occludables.push({ object: gate, kind: 'prop' });
        continue;
      }

      const panel = new THREE.Group();
      panel.position.set(mx, 0, mz);
      panel.rotation.y = ang + Math.PI / 2;

      // Fence posts & 3 horizontal weathered plank rails (offset slightly proud of posts -> zero Z-fighting!)
      for (const px of [-segLen / 2, 0, segLen / 2]) {
        const post = new THREE.Mesh(trackGeo(craftedBox(0.18, 1.75, 0.18)), woodDarkMat);
        post.position.set(px, 0.875, 0);
        post.castShadow = true;
        panel.add(post);
      }
      for (const ry of [0.45, 0.95, 1.45]) {
        const rail = new THREE.Mesh(trackGeo(craftedBox(segLen, 0.22, 0.08)), woodLightMat);
        rail.position.set(0, ry, 0.13);
        rail.castShadow = true;
        rail.receiveShadow = true;
        tagSurface(rail, woodLightMat);
        panel.add(rail);
        shootableMeshes.push(rail);
      }
      group.add(panel);
      occludables.push({ object: panel, kind: 'prop' });

      // Continuous tightly-spaced solid collider chain along entire fence edge (zero pass-through gaps!)
      for (const t of [0.08, 0.29, 0.5, 0.71, 0.92]) {
        const px = THREE.MathUtils.lerp(x0, x1, t);
        const pz = THREE.MathUtils.lerp(z0, z1, t);
        colliders.push({
          minX: px - 0.62,
          maxX: px + 0.62,
          minY: 0,
          maxY: 1.75,
          minZ: pz - 0.62,
          maxZ: pz + 0.62,
        });
      }
    }

    // Corral corner barrel stacks & hay bales
    addWoodenBarrel(cx - radius * 0.62, 0, cz - radius * 0.42);
    addWoodenBarrel(cx - radius * 0.54, 0, cz - radius * 0.56);
    addWoodenBarrel(cx + radius * 0.55, 0, cz - radius * 0.45);
    addWorldBox(1.6, 0.9, 1.1, cx + 1.8, 0.45, cz - 2.6, hayMat, true, true, true);
  };

  buildOctagonalCorral(-9.0, -26.5, 7.2);

  // 5C. Covered Prairie Wagon on Main Street (High-Craft Hooped Canvas, Hitch Tongue, Cargo & Shadows)
  const buildCoveredWagon = (x: number, z: number, rotY = 0) => {
    const wagon = new THREE.Group();
    wagon.position.set(x, 0, z);
    wagon.rotation.y = rotY;

    // Under-chassis timber axles & kingpin beam
    const axleR = new THREE.Mesh(trackGeo(craftedBox(0.18, 0.16, 2.1)), woodDarkMat);
    axleR.position.set(-1.35, 0.72, 0);
    const axleF = new THREE.Mesh(trackGeo(craftedBox(0.18, 0.16, 2.1)), woodDarkMat);
    axleF.position.set(1.35, 0.62, 0);
    const reachBeam = new THREE.Mesh(trackGeo(craftedBox(3.2, 0.14, 0.16)), woodDarkMat);
    reachBeam.position.set(0, 0.68, 0);
    wagon.add(axleR, axleF, reachBeam);

    // Wooden wagon bed, recessed floor, iron side straps & external oak rib stakes
    const bed = new THREE.Mesh(trackGeo(craftedBox(4.2, 0.92, 1.85)), woodDarkMat);
    bed.position.y = 1.18;
    bed.castShadow = true;
    bed.receiveShadow = true;
    wagon.add(bed);
    shootableMeshes.push(bed);

    for (const sx of [-1.85, -0.92, 0, 0.92, 1.85]) {
      for (const sz of [-0.95, 0.95]) {
        const stake = new THREE.Mesh(trackGeo(craftedBox(0.09, 0.96, 0.06)), woodLightMat);
        stake.position.set(sx, 1.2, sz);
        wagon.add(stake);
      }
    }
    for (const sz of [-0.94, 0.94]) {
      const rubRail = new THREE.Mesh(trackGeo(craftedBox(4.24, 0.08, 0.06)), ironMat);
      rubRail.position.set(0, 1.62, sz);
      wagon.add(rubRail);
    }

    // Driver seat bench, angled footboard, front hitch tongue & wooden doubletree yoke
    const seat = new THREE.Mesh(trackGeo(craftedBox(0.45, 0.16, 1.82)), woodLightMat);
    seat.position.set(1.78, 1.76, 0);
    seat.castShadow = true;
    wagon.add(seat);

    const footboard = new THREE.Mesh(trackGeo(craftedBox(0.48, 0.09, 1.72)), woodDarkMat);
    footboard.position.set(2.26, 1.22, 0);
    footboard.rotation.z = -0.35;
    wagon.add(footboard);

    const hitchTongue = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.065, 2.65, 8)), woodDarkMat);
    hitchTongue.rotation.z = Math.PI / 2 - 0.14;
    hitchTongue.position.set(3.25, 0.42, 0);
    hitchTongue.castShadow = true;
    wagon.add(hitchTongue);

    const doubletree = new THREE.Mesh(trackGeo(craftedBox(0.11, 0.09, 1.55)), woodLightMat);
    doubletree.position.set(2.45, 0.54, 0);
    wagon.add(doubletree);

    // Interior cargo boxes visible inside the rear open hoop
    const cargoCrate = new THREE.Mesh(trackGeo(craftedBox(0.85, 0.72, 0.85)), crateMat);
    cargoCrate.position.set(-1.3, 1.72, 0.25);
    cargoCrate.rotation.y = 0.18;
    wagon.add(cargoCrate);

    // Curved arched prairie schooner weathered canvas canopy + 5 bent-wood rib hoops
    const canopyGeo = trackGeo(new THREE.CylinderGeometry(1.02, 1.02, 3.85, 18, 1, true, 0, Math.PI));
    canopyGeo.rotateZ(Math.PI / 2);
    canopyGeo.rotateY(Math.PI / 2);
    const canopy = new THREE.Mesh(canopyGeo, canvasMat);
    canopy.position.set(-0.15, 1.62, 0);
    canopy.scale.set(1, 1.18, 0.96);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    wagon.add(canopy);
    shootableMeshes.push(canopy);

    const hoopGeo = trackGeo(new THREE.TorusGeometry(0.99, 0.032, 6, 18, Math.PI));
    hoopGeo.rotateY(Math.PI / 2);
    for (const hx of [-2.05, -1.1, -0.15, 0.8, 1.75]) {
      const hoop = new THREE.Mesh(hoopGeo, woodDarkMat);
      hoop.position.set(hx, 1.62, 0);
      hoop.scale.set(1, 1.18, 0.96);
      wagon.add(hoop);
    }

    // 4 Spoked wooden wheels (larger rear wheels, slightly smaller front wheels)
    for (const [wx, wz, sc] of [
      [-1.35, 1.0, 1.06],
      [-1.35, -1.0, 1.06],
      [1.35, 1.0, 0.92],
      [1.35, -1.0, 0.92],
    ]) {
      const wheel = buildWagonWheel(sc);
      wheel.position.set(wx, 0.68 * sc, wz);
      wagon.add(wheel);
    }

    // Grounded wagon undercarriage shadow cleanly above street plane
    const wShadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.1, 2.75)), contactShadowMat);
    wShadow.rotation.x = -Math.PI / 2;
    wShadow.position.set(0, 0.048, 0);
    wShadow.renderOrder = 1;
    wShadow.userData.noCollide = true;
    wagon.add(wShadow);

    group.add(wagon);
    occludables.push({ object: wagon, kind: 'prop' });
    shootableMeshes.push(cargoCrate);
    // Solid full-hull collider covering wagon bed, wheels & front driver/hitch yoke
    colliders.push({
      minX: x - 2.32,
      maxX: x + 2.55,
      minY: 0,
      maxY: 2.82,
      minZ: z - 1.26,
      maxZ: z + 1.26,
    });
  };

  buildCoveredWagon(-6.2, -1.8, 0.08);

  // 5D. Town Square Flagpole Monument (South-East Square, matching reference!)
  const buildFlagpole = (x: number, z: number) => {
    const fg = new THREE.Group();
    fg.position.set(x, 0, z);
    const plinth = new THREE.Mesh(trackGeo(craftedBox(3.2, 0.32, 3.2)), stoneMat);
    plinth.position.y = 0.16;
    plinth.receiveShadow = true;
    fg.add(plinth);
    const plinthTop = new THREE.Mesh(trackGeo(craftedBox(1.9, 0.22, 1.9)), stoneMat);
    plinthTop.position.y = 0.43;
    plinthTop.castShadow = true;
    plinthTop.receiveShadow = true;
    fg.add(plinthTop);
    const baseCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 0.36, 10)), ironMat);
    baseCollar.position.y = 0.72;
    fg.add(baseCollar);

    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.14, 9.2, 10)), whiteTrimMat);
    pole.position.y = 4.7;
    pole.castShadow = true;
    fg.add(pole);

    const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 8, 8)), brassMat);
    finial.position.y = 9.35;
    fg.add(finial);

    const flagPivot = new THREE.Group();
    flagPivot.position.set(0.05, 8.45, 0);
    const flag = new THREE.Mesh(trackGeo(craftedBox(2.1, 1.1, 0.05)), woodRedMat);
    flag.position.set(1.05, 0, 0);
    flag.castShadow = true;
    flag.userData.noCollide = true;
    flagPivot.add(flag);
    fg.add(flagPivot);
    animatedProps.flagMesh = flag;

    group.add(fg);
    occludables.push({ object: fg, kind: 'prop' });
    shootableMeshes.push(plinth, plinthTop, pole);
    // Stepped solid colliders for stone monument base & flagpole
    colliders.push({ minX: x - 1.6, maxX: x + 1.6, minY: 0, maxY: 0.32, minZ: z - 1.6, maxZ: z + 1.6 });
    colliders.push({ minX: x - 0.95, maxX: x + 0.95, minY: 0.32, maxY: 0.56, minZ: z - 0.95, maxZ: z + 0.95 });
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minY: 0, maxY: 9.2, minZ: z - 0.3, maxZ: z + 0.3 });
  };

  buildFlagpole(26.5, 25.5);

  // =========================================================================
  // 6. STREET PROPS: BARRELS, CRATE COVER, TROUGHS, BENCHES, WOODPILES, LAMP POSTS & CACTI
  // =========================================================================

  // Helper: Timber Horse Watering Trough with Non-Overlapping Corner Walls & Reflective Water Surface
  const addWaterTrough = (x: number, z: number, rotY = 0) => {
    const tr = new THREE.Group();
    tr.position.set(x, 0, z);
    tr.rotation.y = rotY;
    // 4 non-overlapping timber trough walls + recessed bottom (ZERO corner Z-fighting!)
    const wallF = new THREE.Mesh(trackGeo(craftedBox(2.12, 0.66, 0.12)), woodDarkMat);
    wallF.position.set(0, 0.42, 0.42);
    wallF.castShadow = true;
    wallF.receiveShadow = true;
    const wallB = new THREE.Mesh(trackGeo(craftedBox(2.12, 0.66, 0.12)), woodDarkMat);
    wallB.position.set(0, 0.42, -0.42);
    wallB.castShadow = true;
    const wallL = new THREE.Mesh(trackGeo(craftedBox(0.12, 0.66, 0.96)), woodDarkMat);
    wallL.position.set(-1.12, 0.42, 0);
    wallL.castShadow = true;
    const wallR = new THREE.Mesh(trackGeo(craftedBox(0.12, 0.66, 0.96)), woodDarkMat);
    wallR.position.set(1.12, 0.42, 0);
    wallR.castShadow = true;
    const floor = new THREE.Mesh(trackGeo(craftedBox(2.12, 0.1, 0.72)), woodDarkMat);
    floor.position.set(0, 0.18, 0);
    tr.add(wallF, wallB, wallL, wallR, floor);

    // Timber skid feet + iron reinforcement end bands
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(trackGeo(craftedBox(0.22, 0.14, 1.02)), darkTrimMat);
      skid.position.set(sx, 0.07, 0);
      tr.add(skid);
      const strap = new THREE.Mesh(trackGeo(craftedBox(0.06, 0.69, 1.0)), ironMat);
      strap.position.set(sx * 1.18, 0.42, 0);
      tr.add(strap);
    }

    // Reflective water fill surface
    const water = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.1, 0.7)), waterSurfaceMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.64, 0);
    tr.add(water);

    const sh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(2.8, 1.35)), contactShadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.048;
    sh.renderOrder = 1;
    sh.userData.noCollide = true;
    tr.add(sh);

    group.add(tr);
    occludables.push({ object: tr, kind: 'prop' });
    shootableMeshes.push(wallF, wallB, wallL, wallR);
    const cosT = Math.abs(Math.cos(rotY));
    const hw = cosT > 0.7 ? 1.24 : 0.56;
    const hd = cosT > 0.7 ? 0.56 : 1.24;
    colliders.push({ minX: x - hw, maxX: x + hw, minY: 0, maxY: 0.78, minZ: z - hd, maxZ: z + hd });
  };

  addWaterTrough(-28.6, -5.0, 0);
  addWaterTrough(0.4, -23.6, 0);
  addWaterTrough(29.8, 22.8, Math.PI / 2);

  // Helper: Solid Weathered Wooden Boardwalk Porch Bench (tucked tight to building wall, never blocks doorways)
  const addPorchBench = (x: number, y: number, z: number, rotY = 0) => {
    const bench = new THREE.Group();
    bench.position.set(x, y, z);
    bench.rotation.y = rotY;
    const seat = new THREE.Mesh(trackGeo(craftedBox(1.7, 0.08, 0.46)), woodLightMat);
    seat.position.set(0, 0.46, 0);
    seat.castShadow = true;
    tagSurface(seat, woodLightMat);
    const back = new THREE.Mesh(trackGeo(craftedBox(1.7, 0.34, 0.07)), woodLightMat);
    back.position.set(0, 0.76, -0.2);
    back.rotation.x = -0.14;
    back.castShadow = true;
    tagSurface(back, woodLightMat);
    bench.add(seat, back);
    for (const lx of [-0.72, 0.72]) {
      const leg = new THREE.Mesh(trackGeo(craftedBox(0.1, 0.44, 0.42)), woodDarkMat);
      leg.position.set(lx, 0.22, 0);
      bench.add(leg);
      const post = new THREE.Mesh(trackGeo(craftedBox(0.08, 0.46, 0.08)), woodDarkMat);
      post.position.set(lx, 0.68, -0.2);
      bench.add(post);
    }
    group.add(bench);
    occludables.push({ object: bench, kind: 'prop' });
    shootableMeshes.push(seat, back);
    const cosB = Math.abs(Math.cos(rotY));
    const hw = cosB > 0.7 ? 0.88 : 0.3;
    const hd = cosB > 0.7 ? 0.3 : 0.88;
    colliders.push({ minX: x - hw, maxX: x + hw, minY: y, maxY: y + 0.92, minZ: z - hd, maxZ: z + hd });
  };

  addPorchBench(-27.2, 0.24, 9.6, Math.PI); // Grand Hotel boardwalk
  addPorchBench(13.8, 0.24, -7.5, 0); // General Store boardwalk
  addPorchBench(32.1, 0.24, -6.2, -Math.PI / 2); // Town Hall boardwalk

  // Helper: Solid Stacked Split Firewood / Timber Logs Pile
  const addWoodpile = (x: number, z: number, rotY = 0) => {
    const wp = new THREE.Group();
    wp.position.set(x, 0, z);
    wp.rotation.y = rotY;
    const logGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.125, 1.55, 7));
    logGeo.rotateZ(Math.PI / 2);
    const rows = [
      { y: 0.11, count: 4, zOff: -0.34 },
      { y: 0.3, count: 3, zOff: -0.23 },
      { y: 0.49, count: 2, zOff: -0.11 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const log = new THREE.Mesh(logGeo, i % 2 === 0 ? barrelWoodMat : woodDarkMat);
        log.position.set((i % 2) * 0.04, row.y, row.zOff + i * 0.23);
        log.castShadow = true;
        log.receiveShadow = true;
        tagSurface(log, barrelWoodMat);
        wp.add(log);
        if (row.y > 0.4) shootableMeshes.push(log);
      }
    }
    const sh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.9, 1.2)), contactShadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.048;
    sh.renderOrder = 1;
    sh.userData.noCollide = true;
    wp.add(sh);
    group.add(wp);
    occludables.push({ object: wp, kind: 'prop' });
    colliders.push({ minX: x - 0.85, maxX: x + 0.85, minY: 0, maxY: 0.65, minZ: z - 0.56, maxZ: z + 0.56 });
  };

  addWoodpile(31.4, 24.4, 0.15);
  addWoodpile(6.2, -7.2, -0.22);
  addWoodpile(-35.4, 19.6, 0.05); // Stacked railroad timber ties beside West Depot

  // Helper: Town Square Wooden Crossroads Direction Signpost
  const addDirectionSignpost = (x: number, z: number) => {
    const sp = new THREE.Group();
    sp.position.set(x, 0, z);
    const post = new THREE.Mesh(trackGeo(craftedBox(0.17, 3.1, 0.17)), woodDarkMat);
    post.position.y = 1.55;
    post.castShadow = true;
    sp.add(post);
    const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.34, 0.28, 7)), stoneMat);
    base.position.y = 0.14;
    sp.add(base);
    const arms: Array<[number, number, number]> = [
      [2.65, 0.12, 1.15],
      [2.32, -1.45, 1.05],
      [1.98, 2.75, 1.1],
    ];
    for (const [ay, rot, len] of arms) {
      const arm = new THREE.Mesh(trackGeo(craftedBox(len, 0.22, 0.06)), woodLightMat);
      arm.position.set(Math.cos(rot) * (len * 0.38), ay, -Math.sin(rot) * (len * 0.38));
      arm.rotation.y = rot;
      arm.castShadow = true;
      sp.add(arm);
    }
    group.add(sp);
    occludables.push({ object: sp, kind: 'prop' });
    colliders.push({ minX: x - 0.2, maxX: x + 0.2, minY: 0, maxY: 3.0, minZ: z - 0.2, maxZ: z + 0.2 });
  };

  addDirectionSignpost(23.2, 8.8);

  // Street Lamps lining Main Street & Town Square
  addStreetLamp(-18.2, -4.6);
  addStreetLamp(-3.4, -4.8);
  addStreetLamp(16.2, -4.8);
  addStreetLamp(29.8, -8.2);
  addStreetLamp(-16.5, 6.8);
  addStreetLamp(6.8, 6.6);
  addStreetLamp(29.8, 5.2);
  addStreetLamp(-34.8, 10.5);

  // Hitching Posts in front of Saloon, General Store, Sheriff's Office & Town Hall
  addHitchingPost(-24.0, -4.7, 0);
  addHitchingPost(11.2, -4.7, 0);
  addHitchingPost(12.2, 6.4, 0);
  addHitchingPost(29.6, -2.4, Math.PI / 2);

  // Tactical Barrel & Wooden Crate Cover Clusters along Main Street & Alleys
  const barrelSpots: Array<[number, number]> = [
    [-17.4, -5.2],
    [-16.5, -5.5],
    [6.1, -5.4],
    [6.9, -5.8],
    [24.6, -6.2],
    [25.3, -5.5],
    [6.6, 7.6],
    [7.4, 7.2],
    [16.8, 7.4],
    [29.8, 14.5],
    [30.5, 15.2],
    [-35.0, 18.2],
    [-34.2, 17.6],
  ];
  for (const [bx, bz] of barrelSpots) {
    addWoodenBarrel(bx, 0, bz, true);
  }

  // High-Craft Framed Wooden Cargo Crate Stacks (authentic waist-high gunfight cover in Main Street & Square)
  const addCrateCluster = (x: number, z: number) => {
    addFramedCrate(1.35, x, z, 0.06);
    addFramedCrate(1.08, x + 1.28, z + 0.22, -0.14);
  };
  addCrateCluster(17.5, 0.6);
  addCrateCluster(-18.5, 2.2);
  addCrateCluster(25.2, -1.5);
  addCrateCluster(-31.5, 11.5);

  // Solid Leaning Decorative Wagon Wheels near Blacksmith, Saloon & Land Office
  for (const [wx, wz, ry] of [
    [30.4, 21.8, 0.3],
    [31.2, 22.6, 0.9],
    [-17.8, -6.4, 0.1],
    [5.8, -6.5, -0.2],
    [-29.5, 18.8, 0.5],
  ]) {
    const wMesh = buildWagonWheel(0.95);
    wMesh.position.set(wx, 0.64, wz);
    wMesh.rotation.set(0.24, ry, 0);
    group.add(wMesh);
    occludables.push({ object: wMesh, kind: 'prop' });
    colliders.push({
      minX: wx - 0.55,
      maxX: wx + 0.55,
      minY: 0,
      maxY: 1.28,
      minZ: wz - 0.55,
      maxZ: wz + 0.55,
    });
  }

  // Overhead Frontier Street Lines & Festive Sunlit Bunting Pennants Spanning Main Street!
  const addStreetOverheadLine = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, withFlags: boolean) => {
    const xm = (x0 + x1) * 0.5;
    const ym = (y0 + y1) * 0.5 - 0.95;
    const zm = (z0 + z1) * 0.5;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(xm, ym, zm),
      new THREE.Vector3(x1, y1, z1),
    );
    const cable = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 12, 0.015, 4, false)), ironMat);
    cable.userData.noCollide = true;
    group.add(cable);

    if (withFlags) {
      const flagShape = new THREE.Shape();
      flagShape.moveTo(-0.18, 0);
      flagShape.lineTo(0.18, 0);
      flagShape.lineTo(0, -0.34);
      flagShape.closePath();
      const flagGeo = trackGeo(new THREE.ShapeGeometry(flagShape));
      const count = 9;
      for (let f = 1; f < count; f++) {
        const t = f / count;
        const pt = curve.getPoint(t);
        const pennant = new THREE.Mesh(flagGeo, f % 2 === 0 ? buntingRedMat : buntingGoldMat);
        pennant.position.copy(pt);
        pennant.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
        pennant.rotation.x = 0.08 * Math.sin(f * 1.4);
        pennant.userData.noCollide = true;
        group.add(pennant);
      }
    }
  };
  addStreetOverheadLine(-22, 6.8, -6.2, -21.5, 6.8, 8.8, true); // Saloon -> Grand Hotel
  addStreetOverheadLine(11.2, 6.6, -6.6, 12.2, 6.6, 8.2, true); // General Store -> Sheriff's Office
  addStreetOverheadLine(-4.2, 4.9, -7.0, -5.2, 4.9, 8.6, false); // Telegraph drop wire across mid-street
  addStreetOverheadLine(21.4, 5.1, -7.2, 31.4, 6.6, -4.5, false); // Post Office -> Town Hall

  // Natural Weathered Timber Ranch Perimeter Fence Framing the Playable Frontier Boundary
  const addPerimeterFenceRun = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const segs = Math.max(1, Math.round(len / 4.2));
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const sx = THREE.MathUtils.lerp(x0, x1, t0);
      const sz = THREE.MathUtils.lerp(z0, z1, t0);
      const ex = THREE.MathUtils.lerp(x0, x1, t1);
      const ez = THREE.MathUtils.lerp(z0, z1, t1);
      const mx = (sx + ex) * 0.5;
      const mz = (sz + ez) * 0.5;
      const segLen = Math.hypot(ex - sx, ez - sz);

      const post = new THREE.Mesh(trackGeo(craftedBox(0.18, 1.42, 0.18)), woodDarkMat);
      post.position.set(sx, 0.71, sz);
      post.castShadow = true;
      group.add(post);

      const railGroup = new THREE.Group();
      railGroup.position.set(mx, 0, mz);
      railGroup.rotation.y = ang + Math.PI / 2;
      for (const ry of [0.52, 1.08]) {
        const rail = new THREE.Mesh(trackGeo(craftedBox(segLen, 0.14, 0.07)), woodLightMat);
        rail.position.set(0, ry, 0.11);
        rail.castShadow = true;
        rail.receiveShadow = true;
        railGroup.add(rail);
      }
      group.add(railGroup);
    }
    const endPost = new THREE.Mesh(trackGeo(craftedBox(0.18, 1.42, 0.18)), woodDarkMat);
    endPost.position.set(x1, 0.71, z1);
    endPost.castShadow = true;
    group.add(endPost);
  };
  addPerimeterFenceRun(-41, -37.2, 43, -37.2); // North Ranch Fence
  addPerimeterFenceRun(-41, 33.2, 43, 33.2); // South Town Edge Fence
  addPerimeterFenceRun(45.2, -35, 45.2, 31); // East Canyon Edge Fence

  // Instanced Desert Agave / Prickly-Pear Rosette Clusters for Lush Desert Ground Richness
  const agaveBladeGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.68, 5));
  agaveBladeGeo.translate(0, 0.34, 0);
  const agaveSpots: Array<[number, number, number]> = [
    [-37, -23, 1.1], [-26, -31, 0.95], [17, -26, 1.05], [37, -25, 1.2],
    [42, -9, 0.9], [42, 24, 1.15], [14, 28, 1.0], [-14, 27, 1.1],
    [-34, 27, 0.95], [-43, -12, 1.05], [31, 30, 1.1], [-2, -35, 1.0],
  ];
  const agaveInst = new THREE.InstancedMesh(agaveBladeGeo, cactusMat, agaveSpots.length * 6);
  agaveInst.castShadow = true;
  agaveInst.receiveShadow = true;
  agaveInst.userData.noCollide = true;
  let agIdx = 0;
  for (let i = 0; i < agaveSpots.length; i++) {
    const [ax, az, sc] = agaveSpots[i];
    const ay = evalTerrainHeight(ax, az);
    for (let b = 0; b < 6; b++) {
      const yawA = (b / 6) * Math.PI * 2 + i * 0.7;
      bDummy.position.set(ax, ay, az);
      bDummy.rotation.set(0.62 + (b % 2) * 0.18, yawA, 0);
      bDummy.scale.setScalar(sc * (0.85 + (b % 3) * 0.12));
      bDummy.updateMatrix();
      agaveInst.setMatrixAt(agIdx++, bDummy.matrix);
    }
  }
  agaveInst.instanceMatrix.needsUpdate = true;
  agaveInst.computeBoundingSphere();
  group.add(agaveInst);

  // 3 Rolling Sunlit Desert Tumbleweeds (gently animated by wind in engine.ts!)
  const twTorusGeo = trackGeo(new THREE.TorusGeometry(0.32, 0.035, 5, 10));
  const tumbleweedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9b8255,
      roughness: 0.96,
      metalness: 0.0,
    }),
  );
  const twConfigs: Array<[number, number, number, number, number]> = [
    [-20, 30.5, 2.2, 0.0, 22],
    [12, -33.8, 1.85, 2.4, 20],
    [-12, 2.6, 1.65, 4.7, 18],
  ];
  for (const [bx, bz, spd, ph, rx] of twConfigs) {
    const tw = new THREE.Group();
    tw.userData.noCollide = true;
    for (let k = 0; k < 4; k++) {
      const ring = new THREE.Mesh(twTorusGeo, tumbleweedMat);
      ring.rotation.set(k * 0.85, k * 1.15, k * 0.55);
      ring.castShadow = true;
      tw.add(ring);
    }
    tw.position.set(bx, 0.36, bz);
    group.add(tw);
    animatedProps.tumbleweeds.push({
      mesh: tw,
      baseX: bx,
      baseZ: bz,
      speed: spd,
      phase: ph,
      rangeX: rx,
    });
  }

  // Composite 3D Saguaro Cacti dotted around the sunlit desert outskirts (grounded on sculpted terrain height)
  const addSaguaroCactus = (x: number, z: number, scale = 1, rotY = 0) => {
    const cGroup = new THREE.Group();
    const gy = evalTerrainHeight(x, z);
    cGroup.position.set(x, gy - 0.12, z);
    cGroup.rotation.y = rotY;
    cGroup.scale.setScalar(scale);

    const trunk = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.28, 3.2, 6, 12)), cactusMat);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tagSurface(trunk, cactusMat);
    cGroup.add(trunk);
    shootableMeshes.push(trunk);

    // Left bent saguaro arm
    const armL1 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.2, 0.65, 5, 10)), cactusMat);
    armL1.rotation.z = Math.PI / 2;
    armL1.position.set(-0.52, 1.85, 0);
    cGroup.add(armL1);
    const armL2 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.2, 1.15, 5, 10)), cactusMat);
    armL2.position.set(-0.84, 2.48, 0);
    armL2.castShadow = true;
    cGroup.add(armL2);

    // Right bent saguaro arm
    const armR1 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.18, 0.55, 5, 10)), cactusMat);
    armR1.rotation.z = Math.PI / 2;
    armR1.position.set(0.48, 1.45, 0);
    cGroup.add(armR1);
    const armR2 = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.18, 0.95, 5, 10)), cactusMat);
    armR2.position.set(0.75, 1.98, 0);
    armR2.castShadow = true;
    cGroup.add(armR2);

    group.add(cGroup);
    occludables.push({ object: cGroup, kind: 'prop' });
    if (x > bounds.minX - 2 && x < bounds.maxX + 2 && z > bounds.minZ - 2 && z < bounds.maxZ + 2) {
      colliders.push({
        minX: x - 0.44 * scale,
        maxX: x + 0.44 * scale,
        minY: 0,
        maxY: 3.6 * scale,
        minZ: z - 0.44 * scale,
        maxZ: z + 0.44 * scale,
      });
    }
  };

  addSaguaroCactus(-54, -18, 1.15, 0.4);
  addSaguaroCactus(-36, -38, 1.05, 1.2);
  addSaguaroCactus(-12, -46, 1.25, 2.1);
  addSaguaroCactus(18, -42, 0.95, 0.8);
  addSaguaroCactus(48, -28, 1.2, 1.7);
  addSaguaroCactus(52, -24, 0.85, 0.3);
  addSaguaroCactus(48, 28, 1.1, 2.6);
  addSaguaroCactus(24, 34, 1.0, 0.5);
  addSaguaroCactus(-42, 36, 1.18, 1.9);
  addSaguaroCactus(-56, 24, 0.95, 0.9);

  // =========================================================================
  // 7. TACTICAL ENEMY SPAWN POINTS & INDOOR/OUTDOOR SUPPLY PICKUPS
  // =========================================================================
  const spawnPoints: THREE.Vector3[] = [
    new THREE.Vector3(-33, 0, 1.0), // West Main Street near Railroad
    new THREE.Vector3(24, 0, 1.0), // East Town Square
    new THREE.Vector3(-12, 0, 2.2), // Front of State Bank
    new THREE.Vector3(14, 0, 2.5), // Front of Sheriff's Office
    new THREE.Vector3(-9, 0, -24), // Inside Horse Corral
    new THREE.Vector3(26, 0, -16), // Near Water Tower
    new THREE.Vector3(24, 0, 20), // South-East Blacksmith Plaza
    new THREE.Vector3(-33, 0, 14), // Train Depot Boardwalk
    new THREE.Vector3(-15, 0, 22), // South Alley behind Hotel
    new THREE.Vector3(16, 0, -21), // North Alley between Barn & General Store
  ];

  // Supply Pickups placed inside enterable landmark buildings & Main Street cover!
  const pickupSpots: THREE.Vector3[] = [
    new THREE.Vector3(-24.0, 0.85, -11.5), // Inside Grand Saloon
    new THREE.Vector3(12.2, 0.85, 13.8), // Inside Sheriff's Office
    new THREE.Vector3(-13.6, 0.85, -10.5), // Inside State Bank
    new THREE.Vector3(6.2, 0.85, -28.0), // Inside Horse Barn
    new THREE.Vector3(36.5, 0.85, 18.8), // Inside Blacksmith Forge
    new THREE.Vector3(11.2, 0.85, -11.5), // Inside General Store
  ];

  const protectedObjects = new Set<THREE.Object3D>([
    ...shootableMeshes, ...walkableMeshes, ...occludables.map(spec => spec.object),
  ]);
  const animatedRoots = new Set<THREE.Object3D>(animatedProps.tumbleweeds.map(item => item.mesh));
  if (animatedProps.windmillWheel) animatedRoots.add(animatedProps.windmillWheel);
  if (animatedProps.flagMesh) animatedRoots.add(animatedProps.flagMesh);
  const batching = batchDecoration(group, protectedObjects, animatedRoots, geometries);
  group.userData.decorationBatching = batching;

  return {
    mapName: 'WEST',
    group,
    colliders,
    ramps,
    shootableMeshes,
    walkableMeshes,
    occludables,
    spawnPoints,
    pickupSpots,
    buildingFootprints,
    arenaHalfSize: 48,
    bounds,
    animatedProps,
    optimizeRendering: () => optimizeStaticArena(group, occludables.map(spec => spec.object), animatedRoots, geometries),
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

// Keep alias export for backwards compatibility
export const buildOutpostArena = buildWestTownArena;
