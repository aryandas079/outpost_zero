import * as THREE from 'three';
import { ProceduralTextures } from './textures';

export type EnemyKind = 'striker' | 'sentinel' | 'wasp';

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  displayName: string;
  root: THREE.Group;
  hitMeshes: THREE.Object3D[];
  bodyMaterials: THREE.MeshStandardMaterial[];
  coreMaterial: THREE.MeshStandardMaterial;
  torsoGroup?: THREE.Group;
  headGroup?: THREE.Group;
  weaponGroup?: THREE.Group;
  muzzleFlash?: THREE.Mesh;
  muzzleFlashTimer: number;
  recoilKick: number;
  flinchKick: number;
  leftLeg?: THREE.Group;
  leftKnee?: THREE.Group;
  rightLeg?: THREE.Group;
  rightKnee?: THREE.Group;
  rotors?: THREE.Object3D[];
  muzzleOffset: THREE.Vector3;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  scoreValue: number;
  preferredRange: number;
  fireCooldown: number;
  windupTimer: number;
  windupDuration: number;
  isWindingUp: boolean;
  strafeDir: number;
  strafeTimer: number;
  hitFlashTimer: number;
  stridePhase: number;
  hoverBaseY: number;
  alive: boolean;
  deathTimer: number;
  deathDuration: number;
  deathFallDir: number;
  deathTiltAxis: THREE.Vector3;
}

const STRIKER_CALLSIGNS = ['GhostX', 'Viper', 'Kestrel', 'Outlaw', 'Reaper', 'Nomad', 'Spectre', 'Cinder'];
const SENTINEL_CALLSIGNS = ['Juggernaut', 'Bastion', 'Titan-4', 'Ironclad', 'Warden'];
const WASP_CALLSIGNS = ['MQ-7 UAV', 'Recon-9', 'Hornet UAV', 'Talon-2'];

export class EnemyFactory {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly sharedContactMat: THREE.MeshBasicMaterial;
  private readonly sharedFlashMat: THREE.MeshBasicMaterial;
  private readonly textures: ProceduralTextures;
  private nextId = 1;

  constructor(textures: ProceduralTextures) {
    this.textures = textures;
    this.sharedContactMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.sharedFlashMat = new THREE.MeshBasicMaterial({
      map: textures.muzzleFlame,
      color: 0xffd180,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /**
   * Builds an articulated realistic human tactical leg (hip pivot -> sculpted thigh -> knee pivot -> shin -> combat boot).
   */
  private buildArticulatedLeg(
    pantsMat: THREE.Material,
    kneePadMat: THREE.Material,
    bootMat: THREE.Material,
    tagHit: (mesh: THREE.Mesh, isHeadshot: boolean) => void,
    scale = 1.0,
  ): { hip: THREE.Group; knee: THREE.Group } {
    const hip = new THREE.Group();

    // Sculpted upper thigh
    const thigh = new THREE.Mesh(
      this.trackGeo(new THREE.CapsuleGeometry(0.088 * scale, 0.29 * scale, 6, 12)),
      pantsMat,
    );
    thigh.position.set(0, -0.22 * scale, 0);
    tagHit(thigh, false);
    hip.add(thigh);

    // Side cargo pocket detail on thigh
    const pocket = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.045 * scale, 0.14 * scale, 0.12 * scale)),
      pantsMat,
    );
    pocket.position.set(0.075 * scale, -0.21 * scale, 0);
    hip.add(pocket);

    // Articulated knee pivot
    const knee = new THREE.Group();
    knee.position.set(0, -0.44 * scale, 0);
    hip.add(knee);

    // Molded tactical hard-shell kneepad
    const kneepad = new THREE.Mesh(
      this.trackGeo(new THREE.SphereGeometry(0.074 * scale, 10, 8)),
      kneePadMat,
    );
    kneepad.scale.set(0.95, 1.1, 0.72);
    kneepad.position.set(0, 0.01 * scale, 0.068 * scale);
    knee.add(kneepad);

    // Tapered calf / shin
    const shin = new THREE.Mesh(
      this.trackGeo(new THREE.CapsuleGeometry(0.072 * scale, 0.28 * scale, 6, 12)),
      pantsMat,
    );
    shin.position.set(0, -0.21 * scale, -0.01 * scale);
    tagHit(shin, false);
    knee.add(shin);

    // Rugged tactical lace-up combat boot
    const bootAnkle = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.074 * scale, 0.082 * scale, 0.14 * scale, 10)),
      bootMat,
    );
    bootAnkle.position.set(0, -0.37 * scale, 0);
    knee.add(bootAnkle);

    const bootFoot = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.135 * scale, 0.095 * scale, 0.27 * scale)),
      bootMat,
    );
    bootFoot.position.set(0, -0.425 * scale, 0.058 * scale);
    knee.add(bootFoot);

    return { hip, knee };
  }

  /**
   * Builds a grounded, photorealistic two-handed tactical rifle/LMG held by an operator.
   */
  private buildOperatorRifle(
    heavy: boolean,
    gunMetalMat: THREE.Material,
    polymerMat: THREE.Material,
  ): { rifle: THREE.Group; muzzleFlash: THREE.Mesh; muzzleZ: number } {
    const rifle = new THREE.Group();

    const receiverLen = heavy ? 0.52 : 0.36;
    const receiver = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(heavy ? 0.085 : 0.058, heavy ? 0.115 : 0.082, receiverLen)),
      gunMetalMat,
    );
    rifle.add(receiver);

    // Handguard / shroud
    const handguard = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(heavy ? 0.072 : 0.052, heavy ? 0.078 : 0.062, heavy ? 0.36 : 0.28)),
      polymerMat,
    );
    handguard.position.set(0, 0.008, receiverLen * 0.5 + (heavy ? 0.16 : 0.12));
    rifle.add(handguard);

    // Cold-hammer-forged steel barrel + flash hider
    const barrelLen = heavy ? 0.34 : 0.24;
    const barrel = new THREE.Mesh(
      this.trackGeo(new THREE.CylinderGeometry(0.014, 0.016, barrelLen, 8)),
      gunMetalMat,
    );
    barrel.rotation.x = Math.PI / 2;
    const barrelZ = receiverLen * 0.5 + (heavy ? 0.34 : 0.26) + barrelLen * 0.5;
    barrel.position.set(0, 0.014, barrelZ);
    rifle.add(barrel);

    // Buttstock resting firmly into operator's right shoulder
    const stock = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(0.044, 0.1, 0.24)),
      polymerMat,
    );
    stock.position.set(0, -0.014, -receiverLen * 0.5 - 0.11);
    rifle.add(stock);

    // Magazine (curved rifle mag or heavy LMG box drum)
    if (heavy) {
      const drum = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.12)), polymerMat);
      drum.position.set(0, -0.1, 0.04);
      rifle.add(drum);
    } else {
      const mag = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.036, 0.16, 0.07)), polymerMat);
      mag.position.set(0, -0.1, 0.06);
      mag.rotation.x = 0.18;
      rifle.add(mag);
    }

    // Top holographic sight
    const optic = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.046, 0.052, 0.09)), gunMetalMat);
    optic.position.set(0, heavy ? 0.08 : 0.065, 0.02);
    rifle.add(optic);

    // Muzzle flash star card (toggled briefly when enemy fires)
    const muzzleZ = barrelZ + barrelLen * 0.5 + 0.06;
    const flash = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.36, 0.36)), this.sharedFlashMat);
    flash.position.set(0, 0.014, muzzleZ);
    flash.visible = false;
    rifle.add(flash);

    return { rifle, muzzleFlash: flash, muzzleZ };
  }

  public createEnemy(kind: EnemyKind, spawnPos: THREE.Vector3, waveScale: number): EnemyEntity {
    const id = this.nextId++;
    const root = new THREE.Group();
    root.position.copy(spawnPos);

    const hitMeshes: THREE.Object3D[] = [];
    const bodyMaterials: THREE.MeshStandardMaterial[] = [];

    const tagHit = (mesh: THREE.Mesh, isHeadshot: boolean) => {
      mesh.userData.enemyId = id;
      mesh.userData.isHeadshot = isHeadshot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      hitMeshes.push(mesh);
    };

    const makeMat = (params: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial(params);
      bodyMaterials.push(m);
      return m;
    };

    // Grounded soft contact shadow disc
    const shadowDisc = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.45, 1.45)), this.sharedContactMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.025;
    root.add(shadowDisc);

    if (kind === 'striker' || kind === 'sentinel') {
      const heavy = kind === 'sentinel';
      const scale = heavy ? 1.12 : 1.0;

      // Grounded military / frontier mercenary PBR fabrics & ballistic armor (zero cartoon neon blocks)
      const jacketMat = makeMat({
        map: this.textures.tacticalSleeveColor,
        bumpMap: this.textures.tacticalSleeveBump,
        bumpScale: 0.005,
        color: heavy ? 0x3b423c : 0x4b463e,
        roughness: 0.9,
        metalness: 0.05,
      });
      const pantsMat = makeMat({
        map: this.textures.tacticalSleeveColor,
        color: heavy ? 0x2d3236 : 0x3a3d40,
        roughness: 0.92,
        metalness: 0.04,
      });
      const vestMat = makeMat({
        map: this.textures.tacticalSleeveColor,
        bumpMap: this.textures.tacticalSleeveBump,
        bumpScale: 0.008,
        color: heavy ? 0x252c28 : 0x2c3035,
        roughness: 0.82,
        metalness: 0.16,
      });
      const gearAccentMat = makeMat({
        color: heavy ? 0x61543d : 0x564b3b,
        roughness: 0.84,
        metalness: 0.12,
      });
      const bootMat = makeMat({
        color: 0x1c1a18,
        roughness: 0.78,
        metalness: 0.14,
      });
      const helmetMat = makeMat({
        map: this.textures.gunMetalColor,
        roughnessMap: this.textures.gunMetalRoughness,
        color: heavy ? 0x313834 : 0x34383b,
        roughness: 0.62,
        metalness: 0.34,
      });
      const balaclavaMat = makeMat({
        color: 0x202226,
        roughness: 0.94,
        metalness: 0.02,
      });
      const gunMetalMat = makeMat({
        map: this.textures.gunMetalColor,
        color: 0x2a2e34,
        roughness: 0.44,
        metalness: 0.82,
      });
      const polymerMat = makeMat({
        color: 0x1a1d21,
        roughness: 0.76,
        metalness: 0.14,
      });
      // Subtle tactical goggles / optic glint (brightens gently during telegraph so combat stays readable)
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: heavy ? 0xd98a2b : 0xb8382c,
        emissive: heavy ? 0xd97706 : 0x991b1b,
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.5,
      });

      // 1. Articulated Bipedal Legs (hip y = 0.89 * scale so boots stand flush on floor)
      const hipY = 0.89 * scale;
      const hipOffset = (heavy ? 0.17 : 0.135) * scale;
      const { hip: leftLeg, knee: leftKnee } = this.buildArticulatedLeg(pantsMat, bootMat, bootMat, tagHit, scale);
      leftLeg.position.set(-hipOffset, hipY, 0);
      root.add(leftLeg);

      const { hip: rightLeg, knee: rightKnee } = this.buildArticulatedLeg(pantsMat, bootMat, bootMat, tagHit, scale);
      rightLeg.position.set(hipOffset, hipY, 0);
      root.add(rightLeg);

      // 2. Articulated Upper Body Group (pivots at waist for breathing, aim lean, and hit flinch)
      const torsoGroup = new THREE.Group();
      torsoGroup.position.set(0, hipY, 0);
      root.add(torsoGroup);

      // Pelvis & tactical duty belt with magazine/utility pouches
      const pelvis = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.195 * scale, 0.185 * scale, 0.19 * scale, 12)),
        pantsMat,
      );
      pelvis.scale.set(1.16, 1, 0.76);
      pelvis.position.y = 0.05 * scale;
      tagHit(pelvis, false);
      torsoGroup.add(pelvis);

      const dutyBelt = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.215 * scale, 0.215 * scale, 0.075 * scale, 12)),
        bootMat,
      );
      dutyBelt.scale.set(1.18, 1, 0.78);
      dutyBelt.position.y = 0.13 * scale;
      torsoGroup.add(dutyBelt);

      for (const sx of [-0.21, 0.21]) {
        const hipPouch = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(0.08 * scale, 0.13 * scale, 0.11 * scale)),
          gearAccentMat,
        );
        hipPouch.position.set(sx * scale, 0.1 * scale, 0.02);
        torsoGroup.add(hipPouch);
      }

      // Tapered athletic ribcage / tactical combat jacket
      const chest = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.245 * scale, 0.19 * scale, 0.48 * scale, 12)),
        jacketMat,
      );
      chest.scale.set(1.18, 1, 0.74);
      chest.position.y = 0.37 * scale;
      tagHit(chest, false);
      torsoGroup.add(chest);

      // Ballistic MOLLE Plate Carrier Vest (Front + Back plates + 3 mag pouches + shoulder straps)
      const frontPlate = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry((heavy ? 0.42 : 0.34) * scale, 0.37 * scale, 0.095 * scale)),
        vestMat,
      );
      frontPlate.position.set(0, 0.41 * scale, 0.145 * scale);
      tagHit(frontPlate, false);
      torsoGroup.add(frontPlate);

      const backPlate = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry((heavy ? 0.4 : 0.32) * scale, 0.39 * scale, 0.1 * scale)),
        vestMat,
      );
      backPlate.position.set(0, 0.41 * scale, -0.145 * scale);
      tagHit(backPlate, false);
      torsoGroup.add(backPlate);

      // Front triple rifle magazine pouches
      for (const mx of [-0.095, 0, 0.095]) {
        const magPouch = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(0.068 * scale, 0.135 * scale, 0.055 * scale)),
          gearAccentMat,
        );
        magPouch.position.set(mx * scale, 0.29 * scale, 0.2 * scale);
        torsoGroup.add(magPouch);
      }

      // Tactical hydration / radio backpack on back plate
      const pack = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(0.24 * scale, 0.32 * scale, 0.11 * scale)),
        gearAccentMat,
      );
      pack.position.set(0, 0.42 * scale, -0.22 * scale);
      torsoGroup.add(pack);

      // Shoulder caps (heavier curved ballistic pads on Sentinel breacher)
      for (const sx of [-1, 1]) {
        const shoulder = new THREE.Mesh(
          this.trackGeo(new THREE.SphereGeometry((heavy ? 0.125 : 0.095) * scale, 10, 8)),
          heavy ? vestMat : jacketMat,
        );
        shoulder.scale.set(1.0, 1.15, 0.95);
        shoulder.position.set(sx * (heavy ? 0.32 : 0.275) * scale, 0.54 * scale, 0);
        tagHit(shoulder, false);
        torsoGroup.add(shoulder);
      }

      if (heavy) {
        // Ballistic collar / gorget guard
        const collar = new THREE.Mesh(
          this.trackGeo(new THREE.CylinderGeometry(0.145 * scale, 0.175 * scale, 0.1 * scale, 12)),
          vestMat,
        );
        collar.position.set(0, 0.62 * scale, 0.01);
        torsoGroup.add(collar);
      }

      // 3. Anatomically Proportioned Head, Balaclava, Tactical Combat Helmet & Goggles (HEADSHOT HITBOX)
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.63 * scale, 0.015 * scale);
      torsoGroup.add(headGroup);

      const neck = new THREE.Mesh(
        this.trackGeo(new THREE.CylinderGeometry(0.068 * scale, 0.078 * scale, 0.1 * scale, 10)),
        balaclavaMat,
      );
      neck.position.y = 0.03 * scale;
      headGroup.add(neck);

      // Human head cranium + jaw wrapped in matte balaclava
      const headSkull = new THREE.Mesh(
        this.trackGeo(new THREE.SphereGeometry(0.118 * scale, 12, 10)),
        balaclavaMat,
      );
      headSkull.scale.set(0.92, 1.12, 1.0);
      headSkull.position.set(0, 0.155 * scale, 0.01 * scale);
      tagHit(headSkull, true);
      headGroup.add(headSkull);

      // MICH / FAST Tactical Ballistic Helmet dome + brim
      const helmetDome = new THREE.Mesh(
        this.trackGeo(new THREE.SphereGeometry(0.136 * scale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)),
        helmetMat,
      );
      helmetDome.scale.set(0.98, 1.02, 1.08);
      helmetDome.position.set(0, 0.185 * scale, 0.005 * scale);
      tagHit(helmetDome, true);
      headGroup.add(helmetDome);

      // Helmet NVG front mount shroud + tactical comms ear cups
      const nvgMount = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry(0.055 * scale, 0.052 * scale, 0.032 * scale)),
        bootMat,
      );
      nvgMount.position.set(0, 0.235 * scale, 0.132 * scale);
      headGroup.add(nvgMount);

      for (const sx of [-1, 1]) {
        const earCup = new THREE.Mesh(
          this.trackGeo(new THREE.CylinderGeometry(0.042 * scale, 0.042 * scale, 0.036 * scale, 10)),
          bootMat,
        );
        earCup.rotation.z = Math.PI / 2;
        earCup.position.set(sx * 0.125 * scale, 0.145 * scale, 0.0);
        headGroup.add(earCup);
      }

      // Ballistic Goggles / Visor lens (subtle tinted military lens, glows warmly during firing telegraph)
      const goggles = new THREE.Mesh(
        this.trackGeo(new THREE.BoxGeometry((heavy ? 0.185 : 0.165) * scale, (heavy ? 0.072 : 0.054) * scale, 0.042 * scale)),
        coreMaterial,
      );
      goggles.position.set(0, 0.165 * scale, 0.108 * scale);
      tagHit(goggles, true);
      headGroup.add(goggles);

      // 4. Articulated Two-Handed Rifle Stance & Weapon Assembly
      const weaponGroup = new THREE.Group();
      weaponGroup.position.set(0, 0.44 * scale, 0.06 * scale);
      torsoGroup.add(weaponGroup);

      // Right trigger arm (shoulder -> bent elbow -> forearm -> gloved grip hand)
      const rUpperArm = new THREE.Mesh(
        this.trackGeo(new THREE.CapsuleGeometry(0.064 * scale, 0.22 * scale, 6, 10)),
        jacketMat,
      );
      rUpperArm.position.set(0.25 * scale, -0.02 * scale, 0.06 * scale);
      rUpperArm.rotation.set(0.75, 0, 0.18);
      tagHit(rUpperArm, false);
      weaponGroup.add(rUpperArm);

      const rForearm = new THREE.Mesh(
        this.trackGeo(new THREE.CapsuleGeometry(0.055 * scale, 0.22 * scale, 6, 10)),
        jacketMat,
      );
      rForearm.position.set(0.18 * scale, -0.06 * scale, 0.23 * scale);
      rForearm.rotation.set(1.42, -0.32, 0.1);
      tagHit(rForearm, false);
      weaponGroup.add(rForearm);

      // Left support arm reaching across chest to grip the rifle handguard
      const lUpperArm = new THREE.Mesh(
        this.trackGeo(new THREE.CapsuleGeometry(0.064 * scale, 0.22 * scale, 6, 10)),
        jacketMat,
      );
      lUpperArm.position.set(-0.23 * scale, -0.03 * scale, 0.1 * scale);
      lUpperArm.rotation.set(0.95, 0, -0.36);
      tagHit(lUpperArm, false);
      weaponGroup.add(lUpperArm);

      const lForearm = new THREE.Mesh(
        this.trackGeo(new THREE.CapsuleGeometry(0.054 * scale, 0.24 * scale, 6, 10)),
        jacketMat,
      );
      lForearm.position.set(-0.06 * scale, -0.05 * scale, 0.31 * scale);
      lForearm.rotation.set(1.5, 0.65, -0.1);
      tagHit(lForearm, false);
      weaponGroup.add(lForearm);

      // Gloved hands gripping pistol grip & forend
      const rHand = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.048 * scale, 8, 8)), bootMat);
      rHand.position.set(0.12 * scale, -0.05 * scale, 0.32 * scale);
      weaponGroup.add(rHand);
      const lHand = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.048 * scale, 8, 8)), bootMat);
      lHand.position.set(0.07 * scale, -0.03 * scale, 0.49 * scale);
      weaponGroup.add(lHand);

      // Detailed 3D Tactical Rifle/LMG aimed downrange
      const { rifle, muzzleFlash, muzzleZ } = this.buildOperatorRifle(heavy, gunMetalMat, polymerMat);
      rifle.position.set(0.11 * scale, -0.01 * scale, 0.36 * scale);
      rifle.scale.setScalar(scale);
      weaponGroup.add(rifle);

      const muzzleOffset = new THREE.Vector3(
        0.11 * scale,
        (hipY + 0.44 * scale - 0.01 * scale),
        0.06 * scale + 0.36 * scale + muzzleZ * scale,
      );

      const callsigns = heavy ? SENTINEL_CALLSIGNS : STRIKER_CALLSIGNS;
      const displayName = callsigns[(id - 1) % callsigns.length];
      const baseHp = heavy ? 170 : 82;
      const hp = Math.round(baseHp * waveScale);

      return {
        id,
        kind,
        displayName,
        root,
        hitMeshes,
        bodyMaterials,
        coreMaterial,
        torsoGroup,
        headGroup,
        weaponGroup,
        muzzleFlash,
        muzzleFlashTimer: 0,
        recoilKick: 0,
        flinchKick: 0,
        leftLeg,
        leftKnee,
        rightLeg,
        rightKnee,
        muzzleOffset,
        hp,
        maxHp: hp,
        speed: heavy ? 2.85 : 4.25,
        radius: heavy ? 0.78 : 0.6,
        scoreValue: heavy ? 300 : 150,
        preferredRange: heavy ? 12 : 15,
        fireCooldown: (heavy ? 1.4 : 1.05) + Math.random() * 1.0,
        windupTimer: 0,
        windupDuration: heavy ? 0.62 : 0.46,
        isWindingUp: false,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        strafeTimer: (heavy ? 2.1 : 1.6) + Math.random() * 1.4,
        hitFlashTimer: 0,
        stridePhase: Math.random() * Math.PI * 2,
        hoverBaseY: 0,
        alive: true,
        deathTimer: 0,
        deathDuration: 0.72,
        deathFallDir: Math.random() < 0.5 ? -1 : 1,
        deathTiltAxis: new THREE.Vector3(1, 0, 0),
      };
    }

    // =====================================================================
    // MQ-7 RECON TACTICAL UAV: Realistic Matte Dark-Graphite Military Quadcopter
    // =====================================================================
    const droneBodyMat = makeMat({
      map: this.textures.gunMetalColor,
      roughnessMap: this.textures.gunMetalRoughness,
      color: 0x353b42,
      roughness: 0.56,
      metalness: 0.52,
    });
    const carbonMat = makeMat({
      color: 0x1d2126,
      roughness: 0.44,
      metalness: 0.74,
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9463e,
      emissive: 0xc22820,
      emissiveIntensity: 1.05,
      roughness: 0.16,
      metalness: 0.4,
    });

    const hoverBaseY = 2.55 + Math.random() * 0.7;
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = hoverBaseY;
    root.add(bodyGroup);

    // Sleek central military avionics fuselage
    const hull = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.46, 0.18, 0.66)), droneBodyMat);
    tagHit(hull, false);
    bodyGroup.add(hull);

    const topCanopy = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.36, 0.08, 0.48)), carbonMat);
    topCanopy.position.set(0, 0.11, -0.02);
    bodyGroup.add(topCanopy);

    // Four angled carbon-fiber booms + shrouded quad-rotors
    const rotors: THREE.Object3D[] = [];
    const armCoords: Array<[number, number]> = [
      [-0.44, 0.34],
      [0.44, 0.34],
      [-0.44, -0.34],
      [0.44, -0.34],
    ];
    for (const [ax, az] of armCoords) {
      const boomLen = Math.hypot(ax, az);
      const boom = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.055, 0.036, boomLen)), carbonMat);
      boom.position.set(ax * 0.5, 0.02, az * 0.5);
      boom.rotation.y = Math.atan2(ax, az);
      tagHit(boom, false);
      bodyGroup.add(boom);

      const shroud = new THREE.Mesh(this.trackGeo(new THREE.TorusGeometry(0.2, 0.024, 8, 16)), carbonMat);
      shroud.rotation.x = Math.PI / 2;
      shroud.position.set(ax, 0.05, az);
      bodyGroup.add(shroud);

      const hub = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.038, 0.042, 0.06, 8)), droneBodyMat);
      hub.position.set(ax, 0.04, az);
      bodyGroup.add(hub);

      const blade = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.35, 0.012, 0.042)), droneBodyMat);
      blade.position.set(ax, 0.075, az);
      bodyGroup.add(blade);
      rotors.push(blade);
    }

    // Underbelly gyro-stabilized optical gimbal turret (HEADSHOT WEAKPOINT)
    const gimbal = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.12, 12, 10)), carbonMat);
    gimbal.position.set(0, -0.14, 0.16);
    tagHit(gimbal, true);
    bodyGroup.add(gimbal);

    const lens = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.065, 0.072, 0.06, 12)), coreMaterial);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, -0.14, 0.25);
    tagHit(lens, true);
    bodyGroup.add(lens);

    shadowDisc.scale.set(0.75, 0.75, 1);

    const hp = Math.round(56 * waveScale);
    const displayName = WASP_CALLSIGNS[(id - 1) % WASP_CALLSIGNS.length];

    return {
      id,
      kind,
      displayName,
      root,
      hitMeshes,
      bodyMaterials,
      coreMaterial,
      rotors,
      muzzleFlashTimer: 0,
      recoilKick: 0,
      flinchKick: 0,
      muzzleOffset: new THREE.Vector3(0, hoverBaseY - 0.16, 0.34),
      hp,
      maxHp: hp,
      speed: 5.7,
      radius: 0.68,
      scoreValue: 200,
      preferredRange: 16,
      fireCooldown: 0.95 + Math.random() * 0.85,
      windupTimer: 0,
      windupDuration: 0.44,
      isWindingUp: false,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1.2 + Math.random() * 1.1,
      hitFlashTimer: 0,
      stridePhase: Math.random() * Math.PI * 2,
      hoverBaseY,
      alive: true,
      deathTimer: 0,
      deathDuration: 0.55,
      deathFallDir: Math.random() < 0.5 ? -1 : 1,
      deathTiltAxis: new THREE.Vector3(0, 0, 1),
    };
  }

  public disposeEnemyMaterials(enemy: EnemyEntity) {
    enemy.bodyMaterials.forEach((m) => m.dispose());
    enemy.coreMaterial.dispose();
  }

  public dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.sharedContactMat.dispose();
    this.sharedFlashMat.dispose();
  }
}
