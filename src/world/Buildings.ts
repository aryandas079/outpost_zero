/**
 * Differentiated 16-POI Architectural Compound Builders.
 * Each POI has its own recognizable silhouette, multi-route interiors/exteriors, cover props, and loot anchors.
 */

import * as THREE from 'three';
import type { BoxCollider, RampSurface } from '../game/arena';
import { craftedBox } from '../game/geometry';
import { ProceduralTextures } from '../game/textures';
import { ISLAND_POIS, ISLAND_ROAD_SPECS, IslandPoiSpec, sampleIslandHeight, sampleRoadElevation, sampleRoadSegmentPoint, sampleRiverCenterX } from './Terrain';

export interface PoiBuildResult {
  group: THREE.Group;
  colliders: BoxCollider[];
  ramps: RampSurface[];
  shootableMeshes: THREE.Object3D[];
  walkableMeshes: THREE.Object3D[];
  buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }>;
  spawnPoints: THREE.Vector3[];
  pickupSpots: THREE.Vector3[];
  lootAnchors: Array<{ pos: THREE.Vector3; poiId: string; tier: 'standard' | 'high' | 'military' }>;
}

export function buildAllIslandPois(textures: ProceduralTextures): PoiBuildResult {
  const group = new THREE.Group();
  group.name = 'Island_16_POIs';
  const colliders: BoxCollider[] = [];
  const ramps: RampSurface[] = [];
  const shootableMeshes: THREE.Object3D[] = [];
  const walkableMeshes: THREE.Object3D[] = [];
  const buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }> = [];
  const spawnPoints: THREE.Vector3[] = [];
  const pickupSpots: THREE.Vector3[] = [];
  const lootAnchors: Array<{ pos: THREE.Vector3; poiId: string; tier: 'standard' | 'high' | 'military' }> = [];

  // Shared calibrated PBR materials (avoid pitch-black surfaces; maintain readable albedos)
  const concreteWallMat = new THREE.MeshStandardMaterial({
    color: 0xc2bcb0,
    map: textures.concreteColor,
    bumpMap: textures.concreteBump,
    bumpScale: 0.03,
    roughness: 0.78,
  });
  const oliveBunkerMat = new THREE.MeshStandardMaterial({
    color: 0x6f7964,
    map: textures.concreteColor,
    roughness: 0.78,
  });
  const warmStuccoMat = new THREE.MeshStandardMaterial({
    color: 0xd4c3a3,
    map: textures.brickAdobeColor,
    normalMap: textures.brickAdobeNormal,
    roughness: 0.82,
  });
  const slateRoofMat = new THREE.MeshStandardMaterial({
    color: 0x454d58,
    map: textures.roofShingleColor,
    normalMap: textures.roofShingleNormal,
    roughness: 0.75,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x65717e,
    map: textures.brushedMetal,
    roughness: 0.45,
    metalness: 0.55,
  });
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    map: textures.concreteColor,
    roughness: 0.88,
  });
  const rustContainerMat = new THREE.MeshStandardMaterial({
    color: 0xa84c2d,
    map: textures.woodPlankRedColor,
    normalMap: textures.woodPlankNormal,
    roughness: 0.65,
    metalness: 0.2,
  });
  const tealContainerMat = new THREE.MeshStandardMaterial({
    color: 0x2b6b78,
    map: textures.brushedMetal,
    roughness: 0.58,
    metalness: 0.28,
  });
  const redBarnMat = new THREE.MeshStandardMaterial({
    color: 0x9b3026,
    map: textures.woodPlankRedColor,
    normalMap: textures.woodPlankNormal,
    roughness: 0.76,
  });
  const woodPlankMat = new THREE.MeshStandardMaterial({
    color: 0xb68a5c,
    map: textures.woodPlankLightColor,
    normalMap: textures.woodPlankNormal,
    roughness: 0.78,
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x1d4f8a,
    roughness: 0.25,
    metalness: 0.62,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    map: textures.crateColor,
    normalMap: textures.crateNormal,
    roughness: 0.74,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x4b7496,
    metalness: 0.85,
    roughness: 0.14,
  });
  const yellowAccentMat = new THREE.MeshStandardMaterial({
    color: 0xdca02a,
    roughness: 0.52,
    metalness: 0.18,
  });

  const addBox = (
    wx: number,
    wy: number,
    wz: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material,
    surface: 'concrete' | 'metal' | 'wood' = 'concrete',
    walkable = false,
    collide = true,
  ) => {
    const mesh = new THREE.Mesh(craftedBox(sx, sy, sz), mat);
    mesh.position.set(wx, wy, wz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.surface = surface;
    if (!collide) mesh.userData.noCollide = true;
    group.add(mesh);
    shootableMeshes.push(mesh);
    if (walkable) walkableMeshes.push(mesh);
    if (collide) {
      colliders.push({
        surface,
        minX: wx - sx * 0.5,
        maxX: wx + sx * 0.5,
        minY: wy - sy * 0.5,
        maxY: wy + sy * 0.5,
        minZ: wz - sz * 0.5,
        maxZ: wz + sz * 0.5,
      });
    }
    return mesh;
  };

  /** Sample exact maximum terrain elevation across a building footprint so zero walls float over hillsides. */
  const sampleFootprintHighY = (cx: number, cz: number, hw: number, hd: number): number => {
    const samples = [
      sampleIslandHeight(cx, cz),
      sampleIslandHeight(cx - hw, cz - hd),
      sampleIslandHeight(cx + hw, cz - hd),
      sampleIslandHeight(cx - hw, cz + hd),
      sampleIslandHeight(cx + hw, cz + hd),
    ];
    return Math.max(...samples);
  };

  /** Solid reinforced concrete foundation plinth + front/back entry steps + multi-doorway structure. */
  const addEnterableBuilding = (
    cx: number,
    _baseY: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    wallMat: THREE.Material,
    trimMat: THREE.Material,
    roofMat: THREE.Material,
    withRoofRamp: boolean,
    poi: IslandPoiSpec,
  ) => {
    buildingFootprints.push({ cx, cz, w, d });
    const baseY = sampleFootprintHighY(cx, cz, w * 0.45, d * 0.45);
    const wallT = 0.46;
    const doorW = Math.min(2.8, w * 0.34);
    const doorH = 2.75;
    const floorH = 0.34;
    const plinthDepth = 8.0; // Anchored 8m deep into terrain so buildings never hover on hillsides

    // Solid concrete foundation plinth extending 8m below floor slab into sloped hills
    addBox(cx, baseY - plinthDepth * 0.5 + floorH, cz, w + 0.6, plinthDepth, d + 0.6, concreteWallMat, 'concrete', true);

    // Wide stepped concrete entrance aprons at +Z and -Z doors bridging terrain seamlessly
    for (const zSign of [-1, 1]) {
      const doorZ = cz + zSign * (d * 0.5 + 1.1);
      addBox(cx, baseY - 1.2, doorZ, doorW + 1.8, 2.7, 2.2, concreteWallMat, 'concrete', true);
    }

    // Front (+Z) & Back (-Z) walls with clear doorways & corner pilasters
    const sideSegW = (w - doorW) * 0.5;
    for (const zSign of [-1, 1]) {
      const wz = cz + zSign * (d * 0.5 - wallT * 0.5);
      addBox(cx - (doorW * 0.5 + sideSegW * 0.5), baseY + floorH + h * 0.5, wz, sideSegW, h, wallT, wallMat);
      addBox(cx + (doorW * 0.5 + sideSegW * 0.5), baseY + floorH + h * 0.5, wz, sideSegW, h, wallT, wallMat);
      const lintelH = h - doorH;
      if (lintelH > 0.2) {
        addBox(cx, baseY + floorH + doorH + lintelH * 0.5, wz, doorW, lintelH, wallT, trimMat);
      }
    }

    // Left & Right walls with firing windows & exterior structural pilasters
    const winW = Math.min(3.4, d * 0.35);
    const zSegD = (d - wallT * 2 - winW) * 0.5;
    for (const xSign of [-1, 1]) {
      const wx = cx + xSign * (w * 0.5 - wallT * 0.5);
      addBox(wx, baseY + floorH + h * 0.5, cz - (winW * 0.5 + zSegD * 0.5), wallT, h, zSegD, wallMat);
      addBox(wx, baseY + floorH + h * 0.5, cz + (winW * 0.5 + zSegD * 0.5), wallT, h, zSegD, wallMat);
      addBox(wx, baseY + floorH + 0.6, cz, wallT, 1.2, winW, wallMat);
      const headH = h - 2.45;
      if (headH > 0.2) addBox(wx, baseY + floorH + 2.45 + headH * 0.5, cz, wallT, headH, winW, trimMat);
      // Structural exterior concrete buttress columns
      for (const zOff of [-d * 0.42, d * 0.42]) {
        addBox(wx + xSign * 0.32, baseY + floorH + h * 0.5 - 1.5, cz + zOff, 0.7, h + 3.0, 0.85, trimMat);
      }
    }

    // Interior structural support column in large halls + solid roof + rooftop parapet trim
    if (w >= 16 && d >= 14) {
      addBox(cx - 2.8, baseY + floorH + h * 0.5, cz, 0.8, h, 0.8, trimMat, 'concrete');
      addBox(cx + 2.8, baseY + floorH + h * 0.5, cz, 0.8, h, 0.8, trimMat, 'concrete');
    }

    const roofY = baseY + floorH + h + 0.2;
    addBox(cx, roofY, cz, w + 0.6, 0.42, d + 0.6, roofMat, 'concrete', true);
    // Walkable rooftop HVAC unit & cover parapet
    addBox(cx - w * 0.22, roofY + 0.72, cz, 2.4, 1.05, 2.0, steelMat, 'metal', true);

    if (withRoofRamp) {
      addBox(cx, roofY + 0.62, cz - d * 0.5 + 0.22, w, 0.9, 0.34, trimMat);
      addBox(cx - w * 0.5 + 0.22, roofY + 0.62, cz, 0.34, 0.9, d * 0.8, trimMat);
      const rampW = 2.4;
      const rampX = cx + w * 0.5 + rampW * 0.5 + 0.16;
      const rampMinZ = cz - d * 0.45;
      const rampMaxZ = cz + d * 0.45;
      const groundAtFoot = sampleIslandHeight(rampX, rampMinZ);
      const rampStartY = Math.min(baseY, groundAtFoot);
      const rampTopY = roofY + 0.2;
      const rampLen = Math.hypot(rampMaxZ - rampMinZ, rampTopY - rampStartY);
      const rampAngle = Math.atan2(rampTopY - rampStartY, rampMaxZ - rampMinZ);
      const rampMesh = new THREE.Mesh(craftedBox(rampW, 0.42, rampLen), concreteWallMat);
      rampMesh.position.set(rampX, (rampStartY + rampTopY) * 0.5, cz);
      rampMesh.rotation.x = -rampAngle;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampMesh.userData.noCollide = true;
      group.add(rampMesh);
      shootableMeshes.push(rampMesh);
      // Solid concrete staircase foundation blocks underneath ramp down into slope
      addBox(rampX, rampStartY - 1.5, rampMinZ + 1.0, rampW + 0.2, 3.2, 2.4, concreteWallMat, 'concrete', true);
      addBox(rampX, baseY + h * 0.38 - 1.5, rampMaxZ - 1.4, rampW + 0.2, h * 0.76 + 3.2, 2.8, concreteWallMat, 'concrete');
      ramps.push({
        minX: rampX - rampW * 0.5,
        maxX: rampX + rampW * 0.5,
        minZ: rampMinZ,
        maxZ: rampMaxZ,
        axis: 'z',
        lowEdge: rampMinZ,
        highEdge: rampMaxZ,
        lowY: rampStartY,
        highY: rampTopY,
      });
    }

    lootAnchors.push({ pos: new THREE.Vector3(cx, baseY + floorH + 0.28, cz), poiId: poi.id, tier: poi.lootTier });
    if (withRoofRamp) {
      lootAnchors.push({ pos: new THREE.Vector3(cx, roofY + 0.42, cz), poiId: poi.id, tier: poi.lootTier });
    }
  };

  const addCrate = (wx: number, _wy: number, wz: number, size = 1.6) => {
    const gy = sampleIslandHeight(wx, wz);
    addBox(wx, gy + size * 0.5, wz, size, size, size, crateMat, 'wood', true);
  };

  /** Place perimeter reinforced concrete jersey barriers / compound walls grounded cleanly at each midpoint. */
  const addPerimeterBarrier = (wx: number, wz: number, lenX: number, lenZ: number) => {
    const gy = sampleIslandHeight(wx, wz);
    addBox(wx, gy + 0.55, wz, lenX, 2.3, lenZ, concreteWallMat, 'concrete', true);
  };

  for (let i = 0; i < ISLAND_POIS.length; i++) {
    const poi = ISLAND_POIS[i];
    const py = sampleIslandHeight(poi.x, poi.z);

    switch (poi.theme) {
      case 'city': {
        // Urban core (Shot 6): concrete blocks, enclosed skybridge corridor, colonnades, HVAC units, yellow barriers & plaza walls
        addEnterableBuilding(poi.x - 24, py, poi.z - 16, 18, 14, 5.2, concreteWallMat, steelMat, slateRoofMat, true, poi);
        addEnterableBuilding(poi.x + 22, py, poi.z + 18, 16, 15, 4.8, warmStuccoMat, steelMat, slateRoofMat, true, poi);
        addEnterableBuilding(poi.x + 22, py, poi.z - 22, 14, 12, 4.4, concreteWallMat, oliveBunkerMat, slateRoofMat, false, poi);
        addEnterableBuilding(poi.x - 2, py, poi.z + 28, 14, 11, 4.6, warmStuccoMat, steelMat, slateRoofMat, false, poi);
        // Enclosed elevated skybridge connecting west & east city towers (anchored via steel column piers to ground)
        const sbY = Math.max(sampleIslandHeight(poi.x - 24, poi.z - 16), sampleIslandHeight(poi.x + 22, poi.z - 22)) + 7.6;
        addBox(poi.x - 1, sbY, poi.z - 16, 30, 3.2, 4.4, concreteWallMat, 'concrete', true);
        addBox(poi.x - 1, sbY, poi.z - 16, 26, 1.8, 4.55, glassMat, 'metal', false, false);
        addBox(poi.x - 24, sbY - 1.2, poi.z - 16, 4.2, 1.8, 3.6, steelMat, 'metal', true); // Rooftop HVAC
        addBox(poi.x + 22, sbY - 1.5, poi.z + 18, 3.6, 1.6, 3.6, yellowAccentMat, 'metal');
        // Street jersey barriers, security checkpoint booth & yellow awnings
        addPerimeterBarrier(poi.x - 6, poi.z + 2, 5.2, 1.0);
        addPerimeterBarrier(poi.x + 7, poi.z - 4, 5.2, 1.0);
        addPerimeterBarrier(poi.x - 36, poi.z + 2, 1.1, 14);
        addPerimeterBarrier(poi.x + 34, poi.z - 2, 1.1, 14);
        addBox(poi.x - 24, py + 3.2, poi.z - 8.4, 8, 0.28, 2.2, yellowAccentMat, 'metal');
        // Tall multi-tier skyline office tower with concrete floor spandrel bands, curtain windows & rooftop penthouse
        const towerX = poi.x - 22;
        const towerZ = poi.z + 24;
        const towerY = sampleFootprintHighY(towerX, towerZ, 9, 8);
        addBox(towerX, towerY - 4, towerZ, 19.2, 8.5, 17.2, concreteWallMat, 'concrete', true);
        addBox(towerX, towerY + 11.5, towerZ, 17.6, 23, 15.6, concreteWallMat, 'concrete', true);
        // Five architectural glass curtain tiers separated by horizontal structural slabs & vertical corner mullions
        for (let tier = 0; tier < 5; tier++) {
          const fy = towerY + 2.8 + tier * 4.2;
          addBox(towerX, fy, towerZ, 18.0, 2.3, 14.0, glassMat, 'metal', false, false);
          addBox(towerX, fy, towerZ, 15.6, 2.3, 16.0, glassMat, 'metal', false, false);
          addBox(towerX, fy + 1.65, towerZ, 18.6, 0.65, 16.6, steelMat, 'concrete', true);
        }
        // Rooftop parapet trim, mechanical penthouse & comms mast
        addBox(towerX, towerY + 23.4, towerZ, 18.8, 0.75, 16.8, yellowAccentMat, 'metal');
        addBox(towerX - 2.4, towerY + 25.0, towerZ + 1.2, 6.8, 2.8, 5.8, steelMat, 'metal', true);
        addBox(towerX + 4.5, towerY + 27.2, towerZ - 3.5, 0.35, 7.2, 0.35, steelMat, 'metal');
        buildingFootprints.push({ cx: towerX, cz: towerZ, w: 18, d: 16 });
        break;
      }
      case 'airbase': {
        // 240m Asphalt Runway + Concrete Plinth + 3 Open-Bay Arched Hangars + ATC Tower + Fuel Tank Farm + Perimeter Blast Walls
        const rBase = sampleIslandHeight(poi.x, poi.z + 18);
        addBox(poi.x, rBase - 1.4, poi.z + 18, 152, 3.2, 26, asphaltMat, 'concrete', true, false);
        for (let rx = -62; rx <= 62; rx += 16) {
          addBox(poi.x + rx, rBase + 0.24, poi.z + 18, 8, 0.06, 1.2, yellowAccentMat, 'concrete', false, false);
        }
        // Three drive-through steel hangars rooted deeply via concrete slab plinths
        for (const hz of [-22, -46, -70]) {
          const hw = 26;
          const hd = 16;
          const hh = 8.6;
          const hY = sampleFootprintHighY(poi.x - 16, poi.z + hz, hw * 0.45, hd * 0.45);
          buildingFootprints.push({ cx: poi.x - 16, cz: poi.z + hz, w: hw, d: hd });
          addBox(poi.x - 16, hY - 2.8, poi.z + hz, hw + 1.2, 6.2, hd + 1.2, concreteWallMat, 'concrete', true);
          addBox(poi.x - 16, hY + hh * 0.5, poi.z + hz - hd * 0.5 + 0.4, hw, hh, 0.8, steelMat, 'metal');
          addBox(poi.x - 16, hY + hh * 0.5, poi.z + hz + hd * 0.5 - 0.4, hw, hh, 0.8, steelMat, 'metal');
          addBox(poi.x - 16, hY + hh, poi.z + hz, hw + 0.8, 0.6, hd + 0.8, slateRoofMat, 'metal', true);
          lootAnchors.push({ pos: new THREE.Vector3(poi.x - 16, hY + 0.45, poi.z + hz), poiId: poi.id, tier: 'military' });
        }
        // Air Traffic Control Tower on reinforced concrete pedestal + Radar Spinner
        const atcY = sampleFootprintHighY(poi.x + 28, poi.z - 22, 5, 5);
        addBox(poi.x + 28, atcY - 3, poi.z - 22, 11.5, 6.5, 11.5, concreteWallMat, 'concrete', true);
        addBox(poi.x + 28, atcY + 8, poi.z - 22, 9, 16, 9, concreteWallMat, 'concrete', true);
        addBox(poi.x + 28, atcY + 17.5, poi.z - 22, 11.5, 3.2, 11.5, glassMat, 'metal');
        addBox(poi.x + 28, atcY + 19.6, poi.z - 22, 12.2, 0.8, 12.2, steelMat, 'metal', true);
        // Fuel depot tanks + blast revetment wall
        for (const fz of [-10, -20]) {
          const fy = sampleIslandHeight(poi.x + 48, poi.z + fz);
          addBox(poi.x + 48, fy - 0.5, poi.z + fz, 10, 2.2, 7, concreteWallMat, 'concrete', true);
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 8.2, 14), rustContainerMat);
          tank.rotation.z = Math.PI / 2;
          tank.position.set(poi.x + 48, fy + 2.8, poi.z + fz);
          tank.castShadow = true;
          group.add(tank);
        }
        addEnterableBuilding(poi.x + 28, py, poi.z - 4, 14, 11, 4.2, oliveBunkerMat, steelMat, slateRoofMat, true, poi);
        addPerimeterBarrier(poi.x - 52, poi.z - 12, 1.2, 42);
        addPerimeterBarrier(poi.x + 56, poi.z + 2, 1.2, 36);
        break;
      }
      case 'dam': {
        // Monumental Gravity Hydroelectric Dam sealed 34m down into gorge + Intake Towers + Crest Gantry Crane + Penstocks + Powerhouse
        const damCenterZ = poi.z - 24;
        const crestTopY = Math.max(43.2, sampleIslandHeight(poi.x, damCenterZ));
        // Massive stepped gravity concrete dam wall reaching -34m deep into bedrock across entire gorge
        addBox(poi.x, crestTopY - 17, damCenterZ, 128, 34, 18, concreteWallMat, 'concrete', true);
        addBox(poi.x, crestTopY - 22, damCenterZ + 7, 124, 24, 12, concreteWallMat, 'concrete', true); // Sloped downstream toe apron
        // Crest parapet walls & road surface
        addBox(poi.x, crestTopY + 0.65, damCenterZ - 8.5, 128, 1.35, 0.7, steelMat, 'metal');
        addBox(poi.x, crestTopY + 0.65, damCenterZ + 8.5, 128, 1.35, 0.7, steelMat, 'metal');
        // Twin concrete reservoir intake gate towers + crest yellow gantry crane
        for (const ix of [-26, 26]) {
          addBox(poi.x + ix, crestTopY + 4.5, damCenterZ - 9, 8.5, 12, 8.5, concreteWallMat, 'concrete', true);
          addBox(poi.x + ix, crestTopY + 11.2, damCenterZ - 9, 9.5, 1.2, 9.5, steelMat, 'metal', true);
        }
        addBox(poi.x, crestTopY + 5.0, damCenterZ, 4.2, 10, 4.2, yellowAccentMat, 'metal');
        addBox(poi.x, crestTopY + 9.6, damCenterZ, 20, 1.5, 4.8, yellowAccentMat, 'metal');
        // Spillway structural concrete buttresses & slanted penstock conduits
        for (const bx of [-42, -20, 0, 20, 42]) {
          addBox(poi.x + bx, crestTopY - 14, damCenterZ + 11, 3.8, 28, 10, concreteWallMat, 'concrete');
        }
        for (const px of [-14, 0, 14]) {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 22, 12), steelMat);
          pipe.rotation.x = 0.65;
          pipe.position.set(poi.x + px, crestTopY - 11, damCenterZ + 13);
          pipe.castShadow = true;
          group.add(pipe);
        }
        // White-foaming concrete spillway tailrace basin at canyon floor
        const spillwayWater = new THREE.Mesh(
          craftedBox(48, 0.8, 22),
          new THREE.MeshBasicMaterial({ color: 0xaadcf2 }),
        );
        spillwayWater.position.set(poi.x, 11.4, damCenterZ + 26);
        spillwayWater.userData.noCollide = true;
        group.add(spillwayWater);
        // Enterable Dam Control House + Downstream Powerhouse Turbine Hall seated on solid terrace
        addEnterableBuilding(poi.x - 32, py, poi.z + 12, 16, 12, 4.6, concreteWallMat, steelMat, slateRoofMat, true, poi);
        addEnterableBuilding(poi.x + 28, py, poi.z + 14, 15, 12, 4.6, oliveBunkerMat, steelMat, slateRoofMat, true, poi);
        addPerimeterBarrier(poi.x - 48, poi.z + 24, 18, 1.2);
        addPerimeterBarrier(poi.x + 48, poi.z + 24, 18, 1.2);
        lootAnchors.push({ pos: new THREE.Vector3(poi.x, crestTopY + 0.35, damCenterZ), poiId: poi.id, tier: 'high' });
        break;
      }
      case 'quarry': {
        // Industrial Rock Crusher + Deep Ore Conveyor Truss + Retaining Bastions + Concrete Silos + Containers
        addEnterableBuilding(poi.x - 22, py, poi.z - 12, 16, 13, 4.8, steelMat, yellowAccentMat, slateRoofMat, true, poi);
        const crushY = sampleFootprintHighY(poi.x + 14, poi.z - 18, 9, 6);
        addBox(poi.x + 14, crushY + 2.5, poi.z - 18, 19, 17, 13, steelMat, 'metal', true);
        addBox(poi.x + 14, crushY + 12.2, poi.z - 18, 6.5, 4.5, 6.5, yellowAccentMat, 'metal');
        // Sloping conveyor gantry spanning toward quarry pit
        const convMesh = new THREE.Mesh(craftedBox(4.2, 2.2, 34), steelMat);
        convMesh.position.set(poi.x + 6, crushY + 3.5, poi.z + 4);
        convMesh.rotation.x = 0.28;
        convMesh.castShadow = true;
        group.add(convMesh);
        for (const cx of [-6, 6]) {
          const cY = sampleIslandHeight(poi.x + cx, poi.z + 22);
          addBox(poi.x + cx, cY - 0.8, poi.z + 22, 4.2, 2.0, 9.2, concreteWallMat, 'concrete', true);
          addBox(poi.x + cx, cY + 1.55, poi.z + 22, 3.2, 3.1, 8.0, cx < 0 ? rustContainerMat : tealContainerMat, 'metal', true);
        }
        addPerimeterBarrier(poi.x - 36, poi.z + 18, 22, 1.2);
        break;
      }
      case 'solar': {
        // Solar Research Array (Shot 7): Lab HQ + Geodesic Dome + Radio Tower + Concrete-Pedestal Photovoltaic Arrays + Perimeter Walls
        addEnterableBuilding(poi.x - 20, py, poi.z + 8, 18, 13, 4.8, concreteWallMat, yellowAccentMat, slateRoofMat, true, poi);
        const hqY = sampleFootprintHighY(poi.x - 20, poi.z + 8, 8, 6);
        const solarDome = new THREE.Mesh(
          new THREE.SphereGeometry(4.2, 16, 12),
          new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.32, metalness: 0.14 }),
        );
        solarDome.position.set(poi.x - 20, hqY + 7.4, poi.z + 8);
        solarDome.castShadow = true;
        solarDome.userData.noCollide = true;
        group.add(solarDome);
        const mastY = sampleIslandHeight(poi.x - 32, poi.z + 14);
        addBox(poi.x - 32, mastY - 1, poi.z + 14, 4.2, 3.2, 4.2, concreteWallMat, 'concrete', true);
        const solarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 1.05, 19, 6), steelMat);
        solarMast.position.set(poi.x - 32, mastY + 9.5, poi.z + 14);
        solarMast.castShadow = true;
        group.add(solarMast);

        for (let row = 0; row < 3; row++) {
          for (let col = -1; col <= 3; col++) {
            const px = poi.x + col * 10.5;
            const pz = poi.z - 12 - row * 12;
            const pGround = sampleIslandHeight(px, pz);
            addBox(px, pGround - 0.5, pz, 2.2, 3.2, 2.2, concreteWallMat, 'concrete', true);
            const panel = new THREE.Mesh(craftedBox(8.6, 0.28, 4.4), solarMat);
            panel.position.set(px, pGround + 2.15, pz);
            panel.rotation.x = 0.36;
            panel.castShadow = true;
            panel.userData.noCollide = true;
            group.add(panel);
          }
        }
        addPerimeterBarrier(poi.x + 10, poi.z + 24, 34, 1.1);
        addPerimeterBarrier(poi.x + 42, poi.z - 10, 1.1, 32);
        break;
      }
      case 'harbor': {
        // Coastal Port (Shot 8): Deep-Seabed Quay Wall (-8m) + Arched Warehouses + Twin Gantry Cranes + Harbormaster Tower + Freighter Ship
        addEnterableBuilding(poi.x - 22, py, poi.z - 14, 18, 13, 4.6, steelMat, rustContainerMat, slateRoofMat, true, poi);
        addEnterableBuilding(poi.x + 2, py, poi.z - 16, 16, 12, 4.6, steelMat, tealContainerMat, slateRoofMat, false, poi);
        // Massive solid concrete harbor quay rooted down -8m into seabed
        addBox(poi.x + 12, -2.2, poi.z + 24, 62, 10.2, 26, concreteWallMat, 'concrete', true);
        const quayTopY = 2.9;
        const containerSpecs: Array<[number, number, number, THREE.Material]> = [
          [poi.x + 4, quayTopY + 1.55, poi.z + 22, rustContainerMat],
          [poi.x + 13, quayTopY + 1.55, poi.z + 22, tealContainerMat],
          [poi.x + 4, quayTopY + 4.65, poi.z + 22, oliveBunkerMat],
          [poi.x + 24, quayTopY + 1.55, poi.z + 20, rustContainerMat],
          [poi.x + 18, sampleIslandHeight(poi.x + 18, poi.z - 10) + 1.55, poi.z - 10, tealContainerMat],
          [poi.x + 28, quayTopY + 1.55, poi.z + 28, yellowAccentMat],
        ];
        for (const [cx, cy, cz, mat] of containerSpecs) {
          addBox(cx, cy, cz, 3.2, 3.1, 8.2, mat, 'metal', true);
        }
        for (const craneX of [poi.x + 22, poi.x + 36]) {
          addBox(craneX, quayTopY + 9.5, poi.z + 26, 3.6, 20, 3.6, yellowAccentMat, 'metal');
          addBox(craneX - 6, quayTopY + 19.2, poi.z + 26, 24, 2.0, 2.6, yellowAccentMat, 'metal');
        }
        // Harbormaster watchtower
        addBox(poi.x - 16, quayTopY + 5, poi.z + 18, 6.5, 11, 6.5, concreteWallMat, 'concrete', true);
        addBox(poi.x - 16, quayTopY + 11.4, poi.z + 18, 7.6, 2.2, 7.6, glassMat, 'metal');
        addBox(poi.x + 38, -0.5, poi.z + 52, 40, 7.8, 12, slateRoofMat, 'metal', true);
        addBox(poi.x + 48, 5.2, poi.z + 52, 8, 5.4, 9, concreteWallMat, 'concrete', true);
        addBox(poi.x + 32, 4.6, poi.z + 52, 16, 3.0, 8, rustContainerMat, 'metal', true);
        break;
      }
      case 'radar': {
        // Comms Station: Geodesic Radome on Reinforced Concrete Bastion + Lattice Radio Tower + Perimeter Walls
        addEnterableBuilding(poi.x - 18, py, poi.z + 10, 14, 12, 4.2, oliveBunkerMat, steelMat, slateRoofMat, true, poi);
        const radBaseY = sampleFootprintHighY(poi.x + 14, poi.z - 12, 5.5, 5.5);
        addBox(poi.x + 14, radBaseY - 0.5, poi.z - 12, 11.5, 11, 11.5, concreteWallMat, 'concrete', true);
        const radome = new THREE.Mesh(
          new THREE.SphereGeometry(5.8, 20, 14),
          new THREE.MeshStandardMaterial({ color: 0xe6eaee, roughness: 0.35, metalness: 0.15 }),
        );
        radome.position.set(poi.x + 14, radBaseY + 7.2, poi.z - 12);
        radome.castShadow = true;
        radome.userData.noCollide = true;
        group.add(radome);
        const mastY = sampleIslandHeight(poi.x - 6, poi.z - 22);
        addBox(poi.x - 6, mastY - 1.5, poi.z - 22, 4.8, 4.2, 4.8, concreteWallMat, 'concrete', true);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.4, 28, 6), steelMat);
        mast.position.set(poi.x - 6, mastY + 14, poi.z - 22);
        mast.castShadow = true;
        group.add(mast);
        addPerimeterBarrier(poi.x - 30, poi.z - 8, 1.1, 24);
        break;
      }
      case 'residential': {
        // 4 Differentiated Suburban Houses on Deep Stone/Concrete Foundations with Pitched Roofs & Garden Walls
        const houses: Array<[number, number, number, number]> = [
          [-22, -16, 12, 10],
          [16, -18, 13, 11],
          [-20, 18, 11, 11],
          [18, 16, 14, 10],
        ];
        for (let hIdx = 0; hIdx < houses.length; hIdx++) {
          const [ox, oz, w, d] = houses[hIdx];
          const hx = poi.x + ox;
          const hz = poi.z + oz;
          const hy = sampleFootprintHighY(hx, hz, w * 0.45, d * 0.45);
          addEnterableBuilding(hx, hy, hz, w, d, 3.8, hIdx % 2 === 0 ? warmStuccoMat : woodPlankMat, steelMat, slateRoofMat, false, poi);
          const peak = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.8, 4), slateRoofMat);
          peak.position.set(hx, hy + 5.7, hz);
          peak.rotation.y = Math.PI / 4;
          peak.userData.noCollide = true;
          group.add(peak);
          // Brick chimney & garden fence
          addBox(hx + w * 0.28, hy + 5.6, hz - d * 0.22, 1.2, 3.8, 1.2, redBarnMat, 'concrete');
        }
        addPerimeterBarrier(poi.x - 2, poi.z - 26, 20, 1.0);
        break;
      }
      case 'factory': {
        // Heavy Industrial Hall + Twin Grounded Smokestacks + Horizontal Boiler Tanks + Steel Loading Dock
        addEnterableBuilding(poi.x - 14, py, poi.z, 22, 16, 5.4, steelMat, rustContainerMat, slateRoofMat, true, poi);
        for (const sx of [poi.x + 14, poi.x + 22]) {
          const sy = sampleFootprintHighY(sx, poi.z - 18, 2.2, 2.2);
          addBox(sx, sy - 1.5, poi.z - 18, 5.2, 5.0, 5.2, concreteWallMat, 'concrete', true);
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 22, 12), concreteWallMat);
          stack.position.set(sx, sy + 11, poi.z - 18);
          stack.castShadow = true;
          group.add(stack);
          colliders.push({
            surface: 'concrete',
            minX: sx - 2,
            maxX: sx + 2,
            minY: sy - 2,
            maxY: sy + 22,
            minZ: poi.z - 20,
            maxZ: poi.z - 16,
          });
        }
        addEnterableBuilding(poi.x + 16, py, poi.z + 16, 12, 10, 4.0, warmStuccoMat, steelMat, slateRoofMat, false, poi);
        addPerimeterBarrier(poi.x - 32, poi.z + 18, 1.2, 24);
        break;
      }
      case 'bunker': {
        // Reinforced Fortified Forest Bunker + Concrete Helipad Pedestal + Pillbox Bastions
        addEnterableBuilding(poi.x, py, poi.z - 8, 20, 16, 4.4, oliveBunkerMat, concreteWallMat, oliveBunkerMat, true, poi);
        const heliY = sampleFootprintHighY(poi.x - 24, poi.z + 18, 8, 8);
        addBox(poi.x - 24, heliY - 2.0, poi.z + 18, 17, 4.4, 17, concreteWallMat, 'concrete', true);
        addBox(poi.x - 24, heliY + 0.25, poi.z + 18, 16, 0.2, 16, asphaltMat, 'concrete', true);
        addBox(poi.x - 24, heliY + 0.37, poi.z + 18, 7, 0.04, 1.4, yellowAccentMat, 'concrete', false, false);
        addBox(poi.x - 26.8, heliY + 0.37, poi.z + 18, 1.4, 0.04, 7, yellowAccentMat, 'concrete', false, false);
        addBox(poi.x - 21.2, heliY + 0.37, poi.z + 18, 1.4, 0.04, 7, yellowAccentMat, 'concrete', false, false);
        addPerimeterBarrier(poi.x + 20, poi.z + 14, 1.4, 24);
        break;
      }
      case 'outpost': {
        // High-Altitude Watchtowers Rooted in Bedrock + Fortified Retaining Walls + Command Barracks
        addEnterableBuilding(poi.x - 10, py, poi.z + 6, 15, 11, 4.2, oliveBunkerMat, steelMat, slateRoofMat, true, poi);
        for (const [wx, wz] of [
          [poi.x + 18, poi.z - 14],
          [poi.x - 24, poi.z - 16],
        ]) {
          const wy = sampleFootprintHighY(wx, wz, 3.2, 3.2);
          addBox(wx, wy + 2.5, wz, 6.2, 15, 6.2, concreteWallMat, 'concrete', true);
          addBox(wx, wy + 10.4, wz, 7.6, 0.5, 7.6, oliveBunkerMat, 'concrete', true);
          addBox(wx, wy + 11.4, wz - 3.4, 7.2, 1.4, 0.5, steelMat, 'metal');
          lootAnchors.push({ pos: new THREE.Vector3(wx, wy + 10.7, wz), poiId: poi.id, tier: 'military' });
        }
        addPerimeterBarrier(poi.x + 4, poi.z - 24, 34, 1.4);
        break;
      }
      case 'railway': {
        // Concrete Rail Embankment + Freight Depot + Boxcars + Signal Gantry + Water Tower
        addEnterableBuilding(poi.x - 20, py, poi.z - 12, 18, 12, 4.5, warmStuccoMat, steelMat, slateRoofMat, true, poi);
        const railY = sampleFootprintHighY(poi.x + 8, poi.z + 4, 38, 12);
        addBox(poi.x + 8, railY - 1.6, poi.z + 4, 84, 3.4, 22, concreteWallMat, 'concrete', true);
        for (const tz of [-2, 10]) {
          addBox(poi.x + 8, railY + 0.16, poi.z + tz, 82, 0.2, 3.4, asphaltMat, 'concrete', true, false);
        }
        addBox(poi.x + 4, railY + 2.2, poi.z - 2, 15, 4.0, 3.4, rustContainerMat, 'metal', true);
        addBox(poi.x + 24, railY + 2.2, poi.z - 2, 15, 4.0, 3.4, tealContainerMat, 'metal', true);
        addBox(poi.x + 14, railY + 2.2, poi.z + 10, 15, 4.0, 3.4, oliveBunkerMat, 'metal', true);
        const twY = sampleFootprintHighY(poi.x + 32, poi.z - 16, 2.5, 2.5);
        addBox(poi.x + 32, twY + 1.5, poi.z - 16, 4.8, 10, 4.8, woodPlankMat, 'wood');
        const towerTank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.5, 14), woodPlankMat);
        towerTank.position.set(poi.x + 32, twY + 8.6, poi.z - 16);
        towerTank.castShadow = true;
        group.add(towerTank);
        break;
      }
      case 'farm': {
        // Gambrel Red Barn + Grounded Twin Grain Silos w/ Catwalk + Farmhouse + Courtyard Walls
        addEnterableBuilding(poi.x - 16, py, poi.z - 10, 16, 20, 5.2, redBarnMat, woodPlankMat, slateRoofMat, true, poi);
        addEnterableBuilding(poi.x + 22, py, poi.z + 14, 12, 10, 3.8, warmStuccoMat, woodPlankMat, slateRoofMat, false, poi);
        const siloBaseY = sampleFootprintHighY(poi.x + 12.5, poi.z - 16, 8, 4);
        addBox(poi.x + 12.5, siloBaseY - 1.5, poi.z - 16, 18, 4.0, 9.5, concreteWallMat, 'concrete', true);
        for (const sx of [poi.x + 8, poi.x + 17]) {
          const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 13, 16), steelMat);
          silo.position.set(sx, siloBaseY + 6.5, poi.z - 16);
          silo.castShadow = true;
          group.add(silo);
          colliders.push({
            surface: 'metal',
            minX: sx - 3.5,
            maxX: sx + 3.5,
            minY: siloBaseY - 2,
            maxY: siloBaseY + 13,
            minZ: poi.z - 19.5,
            maxZ: poi.z - 12.5,
          });
        }
        addBox(poi.x + 12.5, siloBaseY + 12.4, poi.z - 16, 10, 1.0, 2.4, yellowAccentMat, 'metal');
        addPerimeterBarrier(poi.x - 4, poi.z + 24, 32, 0.9);
        break;
      }
      case 'lighthouse': {
        // Stone Cliff Breakwater + Deep-Rooted Concrete Lighthouse + Coastal Cottages
        addEnterableBuilding(poi.x - 16, py, poi.z + 10, 12, 10, 3.8, warmStuccoMat, woodPlankMat, slateRoofMat, false, poi);
        addEnterableBuilding(poi.x + 14, py, poi.z + 14, 11, 9, 3.8, woodPlankMat, concreteWallMat, slateRoofMat, false, poi);
        const lhY = sampleFootprintHighY(poi.x + 2, poi.z - 18, 4, 4);
        addBox(poi.x + 2, lhY - 2.0, poi.z - 18, 9.5, 6.0, 9.5, concreteWallMat, 'concrete', true);
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.8, 19, 16), concreteWallMat);
        tower.position.set(poi.x + 2, lhY + 9.5, poi.z - 18);
        tower.castShadow = true;
        group.add(tower);
        colliders.push({
          surface: 'concrete',
          minX: poi.x - 1.5,
          maxX: poi.x + 5.5,
          minY: lhY - 3,
          maxY: lhY + 19,
          minZ: poi.z - 21.5,
          maxZ: poi.z - 14.5,
        });
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2.6, 14), new THREE.MeshBasicMaterial({ color: 0xffe48c }));
        beacon.position.set(poi.x + 2, lhY + 20.3, poi.z - 18);
        beacon.userData.noCollide = true;
        group.add(beacon);
        break;
      }
      case 'substation': {
        // Reinforced Transformer Concrete Apron + Heavy Busbar Gantry + Control Blockhouse
        addEnterableBuilding(poi.x - 16, py, poi.z + 8, 14, 11, 4.2, concreteWallMat, steelMat, slateRoofMat, true, poi);
        const subPadY = sampleFootprintHighY(poi.x + 16, poi.z - 12, 16, 6);
        addBox(poi.x + 16, subPadY - 1.6, poi.z - 12, 34, 4.0, 12, concreteWallMat, 'concrete', true);
        for (const tx of [4, 16, 28]) {
          addBox(poi.x + tx, subPadY + 2.5, poi.z - 12, 5.2, 4.8, 6.2, steelMat, 'metal', true);
          addBox(poi.x + tx, subPadY + 6.3, poi.z - 12, 0.8, 2.8, 0.8, yellowAccentMat, 'metal');
        }
        addBox(poi.x + 16, subPadY + 8.6, poi.z - 12, 28, 0.9, 1.2, steelMat, 'metal');
        addPerimeterBarrier(poi.x + 16, poi.z + 4, 34, 1.0);
        break;
      }
      case 'research': {
        // Remote Cleanroom Bio-Dome on Reinforced Pad + Lab Wing + Security Perimeter Walls
        addEnterableBuilding(poi.x - 20, py, poi.z + 12, 16, 12, 4.4, concreteWallMat, glassMat, slateRoofMat, true, poi);
        const domeY = sampleFootprintHighY(poi.x + 12, poi.z - 14, 9, 9);
        addBox(poi.x + 12, domeY - 2.0, poi.z - 14, 21, 5.0, 21, concreteWallMat, 'concrete', true);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(9.2, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
          new THREE.MeshStandardMaterial({ color: 0xdce5ed, roughness: 0.25, metalness: 0.45 }),
        );
        dome.position.set(poi.x + 12, domeY + 0.5, poi.z - 14);
        dome.castShadow = true;
        dome.receiveShadow = true;
        group.add(dome);
        colliders.push({
          surface: 'metal',
          minX: poi.x + 3,
          maxX: poi.x + 21,
          minY: domeY - 2,
          maxY: domeY + 9.7,
          minZ: poi.z - 23,
          maxZ: poi.z - 5,
        });
        lootAnchors.push({ pos: new THREE.Vector3(poi.x + 12, domeY + 0.7, poi.z - 4), poiId: poi.id, tier: 'military' });
        addPerimeterBarrier(poi.x - 4, poi.z - 24, 34, 1.2);
        break;
      }
    }

    // Cover crates, jersey barriers & tactical spots grounded accurately at every POI
    addCrate(poi.x, py, poi.z, 1.65);
    addCrate(poi.x - 6, py, poi.z + 6, 1.5);
    addCrate(poi.x + 7, py, poi.z - 5, 1.5);
    addPerimeterBarrier(poi.x - 14, py >= 2 ? poi.z + 26 : poi.z - 20, 5.4, 1.0);

    spawnPoints.push(
      new THREE.Vector3(poi.x, sampleIslandHeight(poi.x, poi.z), poi.z),
      new THREE.Vector3(poi.x - 22, sampleIslandHeight(poi.x - 22, poi.z + 18), poi.z + 18),
      new THREE.Vector3(poi.x + 24, sampleIslandHeight(poi.x + 24, poi.z - 18), poi.z - 18),
    );
    pickupSpots.push(
      new THREE.Vector3(poi.x + 2.5, sampleIslandHeight(poi.x + 2.5, poi.z + 2.5) + 0.25, poi.z + 2.5),
      new THREE.Vector3(poi.x - 10, sampleIslandHeight(poi.x - 10, poi.z - 6) + 0.25, poi.z - 6),
    );
  }

  // Inter-POI Roadside Fortified Checkpoints, Relay Bunkers & Defensive Barricades across highway corridors
  for (let rIdx = 0; rIdx < ISLAND_ROAD_SPECS.length; rIdx += 2) {
    const road = ISLAND_ROAD_SPECS[rIdx];
    const mid = sampleRoadSegmentPoint(road, 0.5);
    const riverX = sampleRiverCenterX(mid.z);
    if (mid.z > -18 && mid.z < 1050 && Math.abs(mid.x - riverX) < 38) continue;
    const deckY = sampleRoadElevation(rIdx, 0.5);
    if (deckY < 3.5) continue;

    const dx = road.x1 - road.x0;
    const dz = road.z1 - road.z0;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    const sideX = mid.x + nx * 11.5;
    const sideZ = mid.z + nz * 11.5;
    const gy = sampleFootprintHighY(sideX, sideZ, 3.5, 3.5);
    if (gy < 3.0) continue;

    // Grounded concrete pillbox shelter + shipping container + barriers at highway pullouts
    addBox(sideX, gy - 2.0, sideZ, 7.6, 5.2, 6.6, concreteWallMat, 'concrete', true);
    addBox(sideX, gy + 1.9, sideZ - 2.6, 7.0, 2.8, 0.5, oliveBunkerMat, 'concrete');
    addBox(sideX - 2.8, gy + 1.9, sideZ, 0.5, 2.8, 5.6, oliveBunkerMat, 'concrete');
    addBox(sideX + 2.8, gy + 1.9, sideZ, 0.5, 2.8, 5.6, oliveBunkerMat, 'concrete');
    addBox(sideX, gy + 3.4, sideZ, 7.4, 0.45, 6.0, slateRoofMat, 'concrete', true);
    addBox(mid.x - nx * 6.8, sampleIslandHeight(mid.x - nx * 6.8, mid.z - nz * 6.8) + 0.4, mid.z - nz * 6.8, 3.2, 1.8, 3.2, concreteWallMat, 'concrete');
    addCrate(sideX + 0.5, gy, sideZ + 0.6, 1.4);
    buildingFootprints.push({ cx: sideX, cz: sideZ, w: 9, d: 8 });
  }

  return {
    group,
    colliders,
    ramps,
    shootableMeshes,
    walkableMeshes,
    buildingFootprints,
    spawnPoints,
    pickupSpots,
    lootAnchors,
  };
}
