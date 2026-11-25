import * as THREE from 'three';
import { craftedBox as baseCraftedBox, batchDecoration } from './geometry';
import { buildArmoryWeapon } from './weaponModels';
import { buildOperatorHands, buildThrowableHands, buildMeleeHands } from './operatorModels';
import { buildThrowable } from './ordnanceModels';
import { weaponDecal } from './modelDecals';
import { ProceduralTextures } from './textures';
import { GrenadeId, WeaponId } from './types';

const craftedBox = (w: number, h: number, d: number) => baseCraftedBox(w, h, d, true);

interface ShellCasing {
  mesh: THREE.Mesh;
  active: boolean;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

export class FirstPersonWeaponRig {
  public readonly root: THREE.Group;
  private readonly weaponPivot: THREE.Group;
  private readonly carbineGroup: THREE.Group;
  private readonly railGroup: THREE.Group;

  // Animated weapon sub-components
  private readonly carbineMag: THREE.Mesh;
  private readonly carbineBolt: THREE.Group;
  private readonly carbineLeftArm: THREE.Group;
  private readonly railMag: THREE.Mesh;
  private readonly railBolt: THREE.Group;
  private readonly railLeftArm: THREE.Group;
  private readonly holoReticleMat: THREE.MeshBasicMaterial;
  private readonly scopeLensMat: THREE.MeshBasicMaterial;

  private readonly muzzleFlashGroup: THREE.Group;
  private readonly muzzleFlameCards: THREE.Mesh[] = [];
  private readonly muzzleLight: THREE.PointLight;
  private readonly shells: ShellCasing[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  private activeWeapon: WeaponId = 'carbine';
  private equippedWeapon: WeaponId = 'carbine';
  private equipmentModels = new Map<WeaponId, THREE.Group>();
  private throwableModels = new Map<GrenadeId, THREE.Group>();
  private throwTimer = 0;
  private activeThrowable?: THREE.Group;
  private recoilZ = 0;
  private recoilPitch = 0;
  private recoilVelZ = 0;
  private recoilVelPitch = 0;
  private boltKick = 0;
  private activeSlide?: THREE.Object3D;
  private muzzleFlashTimer = 0;
  private swapBlend = 0;
  private swayPhase = 0;
  private currentAds = 0;
  private sprintBlend = 0;
  private crouchBlend = 0;
  private scopeHidden = false;
  private lookSwayX = 0;
  private lookSwayY = 0;
  private flinchX = 0;
  private flinchY = 0;
  private flinchZ = 0;
  private flinchPitch = 0;
  private flinchRoll = 0;
  private inspectBlend = 0;
  private inspectPhase = 0;
  private inspectTiltX = 0;
  private inspectTiltY = 0;
  private landDip = 0;
  private landDipVel = 0;

  // Camera-space hip framing and look-through optic alignment.
  private readonly hipPosCarbine = new THREE.Vector3(0.188, -0.205, -0.305);
  private readonly hipRotCarbine = new THREE.Euler(0.018, 0.105, -0.03);
  // True look-through holographic optic ADS alignment (reticle centered at y = 0.156)
  private readonly adsPosCarbine = new THREE.Vector3(0.0, -0.156, -0.215);
  private readonly adsRotCarbine = new THREE.Euler(0.0, 0.0, 0.0);

  // Precision Scoped Sniper Rifle (Slot 2) — raises smoothly into full optical scope overlay
  private readonly hipPosRail = new THREE.Vector3(0.198, -0.212, -0.315);
  private readonly hipPosPistol = new THREE.Vector3(0.17, -0.125, -0.13);
  private readonly hipPosHeavy = new THREE.Vector3(0.215, -0.18, -0.23);
  private readonly hipRotRail = new THREE.Euler(0.016, 0.098, -0.028);
  // Scope optical axis aligned cleanly with camera center before seamless optical lens handoff
  private readonly adsPosPistol = new THREE.Vector3(0, -0.046, -0.215);
  private readonly adsPosMarksman = new THREE.Vector3(0, -0.12, -0.215);
  private readonly adsPosIron = new THREE.Vector3(0, -0.075, -0.215);
  private readonly adsPosRail = new THREE.Vector3(0.0, -0.154, -0.175);
  private readonly adsRotRail = new THREE.Euler(0.0, 0.0, 0.0);

  private readonly leftArmRestPos = new THREE.Vector3(0, 0, 0);
  private readonly leftArmRestRot = new THREE.Euler(0, 0, 0);

  constructor(private readonly textures: ProceduralTextures) {
    this.root = new THREE.Group();
    this.weaponPivot = new THREE.Group();
    this.weaponPivot.position.copy(this.hipPosCarbine);
    this.weaponPivot.rotation.copy(this.hipRotCarbine);
    this.root.add(this.weaponPivot);

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.materials.push(m);
      return m;
    };
    const scaleExtrudeUVs = (geo: THREE.BufferGeometry, scale: number) => {
      const uv = geo.attributes.uv;
      if (!uv) return;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
      }
      uv.needsUpdate = true;
    };

    // =========================================================================
    // CALIBRATED PHOTOREALISTIC MILITARY PBR WEAPON & OPERATOR MATERIALS
    // =========================================================================
    const fdeCerakoteMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        roughnessMap: textures.gunFdeRoughness,
        normalMap: textures.gunFdeNormal,
        normalScale: new THREE.Vector2(0.18, 0.18),
        color: 0x3b4046,
        roughness: 0.58,
        metalness: 0.44,
        clearcoat: 0.06,
        clearcoatRoughness: 0.54,
      }),
    );

    const wornGunmetalMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        roughnessMap: textures.gunMetalRoughness,
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.18, 0.18),
        color: 0x545b64,
        roughness: 0.42,
        metalness: 0.86,
        clearcoat: 0.12,
        clearcoatRoughness: 0.44,
      }),
    );

    const anodizedBlackMat = trackMat(
      new THREE.MeshStandardMaterial({
        roughnessMap: textures.gunMetalRoughness,
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.14, 0.14),
        color: 0x262a30,
        roughness: 0.52,
        metalness: 0.76,
      }),
    );

    const scopeMatteBodyMat = trackMat(
      new THREE.MeshStandardMaterial({
        roughnessMap: textures.gunMetalRoughness,
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        color: 0x454a52,
        roughness: 0.64,
        metalness: 0.66,
      }),
    );

    // Clean matte-black anodized aluminum shroud for the SOLOZERO holographic optic
    const holoShroudMat = trackMat(
      new THREE.MeshStandardMaterial({
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.22, 0.22),
        color: 0x1d2024,
        roughness: 0.54,
        metalness: 0.72,
      }),
    );

    const rubberMat = trackMat(
      new THREE.MeshStandardMaterial({
        bumpMap: textures.gunMetalBump,
        bumpScale: 0.002,
        color: 0x16191c,
        roughness: 0.88,
        metalness: 0.06,
      }),
    );

    const mattePolymerMat = trackMat(
      new THREE.MeshStandardMaterial({
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        color: 0x202326,
        roughness: 0.8,
        metalness: 0.1,
      }),
    );

    const bluedBarrelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a1e24,
        roughness: 0.28,
        metalness: 0.94,
      }),
    );

    const brassAccentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc9964a,
        roughness: 0.24,
        metalness: 0.92,
      }),
    );

    const opticDialMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.opticDialColor,
        roughness: 0.44,
        metalness: 0.64,
      }),
    );

    const holoBackFaceMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.holoHousingBack,
        roughness: 0.58,
        metalness: 0.46,
      }),
    );

    // Emerald-teal coated anti-reflective holographic sight lens
    const holoGlassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x5fa898,
        roughness: 0.05,
        metalness: 0.08,
        transparent: true,
        opacity: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    this.holoReticleMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.holoReticle,
        color: 0xff5a36,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    // Etched mil-dot sniper scope glass reticle.
    this.scopeLensMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.scopeLensReticle,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    const stainlessGasMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x9aa2aa,
        roughness: 0.26,
        metalness: 0.92,
      }),
    );

    // =========================================================================
    // 1. M4A1 CARBINE + SUPPRESSOR + BOXY EOTECH HOLOGRAPHIC SIGHT (64055fb6)
    // =========================================================================
    this.carbineGroup = new THREE.Group();
    const marking = weaponDecal(textures, 0, 0.12, 0.013, this.geometries, this.materials);
    marking.rotation.y = -Math.PI / 2;
    marking.position.set(-0.041, -0.012, 0.026);
    this.carbineGroup.add(marking);

    // Sculpted beveled matte charcoal-black anodized M4A1 upper receiver
    const receiverShape = new THREE.Shape();
    receiverShape.moveTo(-0.032, -0.028);
    receiverShape.lineTo(0.032, -0.028);
    receiverShape.lineTo(0.037, 0.008);
    receiverShape.lineTo(0.033, 0.032);
    receiverShape.lineTo(0.023, 0.048);
    receiverShape.lineTo(-0.023, 0.048);
    receiverShape.lineTo(-0.033, 0.032);
    receiverShape.lineTo(-0.037, 0.008);
    receiverShape.closePath();

    const receiverGeo = trackGeo(
      new THREE.ExtrudeGeometry(receiverShape, {
        depth: 0.42,
        bevelEnabled: true,
        bevelThickness: 0.0045,
        bevelSize: 0.0035,
        bevelSegments: 1,
      }),
    );
    receiverGeo.translate(0, 0, -0.21);
    scaleExtrudeUVs(receiverGeo, 2.8);
    const upperReceiver = new THREE.Mesh(receiverGeo, anodizedBlackMat);
    upperReceiver.position.set(0, 0.004, 0.045);
    this.carbineGroup.add(upperReceiver);

    // Lower receiver chassis with flared magwell & matte steel trim
    const lowerReceiver = new THREE.Mesh(trackGeo(craftedBox(0.056, 0.052, 0.34)), anodizedBlackMat);
    lowerReceiver.position.set(0, -0.04, 0.03);
    this.carbineGroup.add(lowerReceiver);

    const magWell = new THREE.Mesh(trackGeo(craftedBox(0.062, 0.048, 0.095)), mattePolymerMat);
    magWell.position.set(0, -0.056, -0.088);
    this.carbineGroup.add(magWell);

    // Rear buffer tube & tactical adjustable crane buttstock extending into shoulder
    const bufferTube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.023, 0.24, 10)), anodizedBlackMat);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.012, 0.36);
    this.carbineGroup.add(bufferTube);

    const rearStock = new THREE.Mesh(trackGeo(craftedBox(0.052, 0.082, 0.2)), mattePolymerMat);
    rearStock.position.set(0, -0.012, 0.39);
    rearStock.rotation.x = -0.06;
    this.carbineGroup.add(rearStock);

    // Rear T-handle charging latch behind the backup sight.
    const chLatchBase = new THREE.Mesh(trackGeo(craftedBox(0.056, 0.014, 0.026)), anodizedBlackMat);
    chLatchBase.position.set(0, 0.042, 0.248);
    this.carbineGroup.add(chLatchBase);
    const chLatchHook = new THREE.Mesh(trackGeo(craftedBox(0.022, 0.016, 0.014)), wornGunmetalMat);
    chLatchHook.position.set(-0.026, 0.042, 0.256);
    this.carbineGroup.add(chLatchHook);

    // Left-side recessed bolt catch, fire selector lever & structural rib (prominent in hipfire)
    const leftSideRib = new THREE.Mesh(trackGeo(craftedBox(0.008, 0.022, 0.36)), anodizedBlackMat);
    leftSideRib.position.set(-0.037, 0.008, 0.02);
    this.carbineGroup.add(leftSideRib);

    const boltCatch = new THREE.Mesh(trackGeo(craftedBox(0.01, 0.026, 0.018)), wornGunmetalMat);
    boltCatch.position.set(-0.038, -0.012, -0.04);
    this.carbineGroup.add(boltCatch);

    const selectorDrum = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12)), wornGunmetalMat);
    selectorDrum.rotation.z = Math.PI / 2;
    selectorDrum.position.set(-0.035, -0.022, 0.095);
    this.carbineGroup.add(selectorDrum);

    const selectorLever = new THREE.Mesh(trackGeo(craftedBox(0.012, 0.007, 0.028)), anodizedBlackMat);
    selectorLever.position.set(-0.039, -0.022, 0.082);
    selectorLever.rotation.x = 0.22;
    this.carbineGroup.add(selectorLever);

    // Reciprocating side charging carrier & right ejection port + angled brass deflector
    this.carbineBolt = new THREE.Group();
    const boltPlate = new THREE.Mesh(trackGeo(craftedBox(0.012, 0.02, 0.072)), wornGunmetalMat);
    boltPlate.position.set(0.034, 0.014, -0.03);
    this.carbineBolt.add(boltPlate);
    const boltHandle = new THREE.Mesh(trackGeo(craftedBox(0.026, 0.011, 0.022)), bluedBarrelMat);
    boltHandle.position.set(-0.041, 0.024, -0.055);
    this.carbineBolt.add(boltHandle);
    this.carbineGroup.add(this.carbineBolt);

    const brassDeflector = new THREE.Mesh(trackGeo(craftedBox(0.018, 0.022, 0.024)), anodizedBlackMat);
    brassDeflector.position.set(0.036, 0.016, 0.026);
    brassDeflector.rotation.y = 0.45;
    this.carbineGroup.add(brassDeflector);

    // Forward assist plunger, hinged dust cover, takedown pins & trigger guard + machined steel trigger
    const fwdAssistHousing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0085, 0.01, 0.038, 12)), anodizedBlackMat);
    fwdAssistHousing.rotation.set(Math.PI / 2 - 0.28, 0, -0.35);
    fwdAssistHousing.position.set(0.035, 0.004, 0.092);
    this.carbineGroup.add(fwdAssistHousing);
    const fwdAssistCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 12)), wornGunmetalMat);
    fwdAssistCap.rotation.copy(fwdAssistHousing.rotation);
    fwdAssistCap.position.set(0.041, 0.001, 0.111);
    this.carbineGroup.add(fwdAssistCap);

    const dustCover = new THREE.Mesh(trackGeo(craftedBox(0.004, 0.022, 0.078)), anodizedBlackMat);
    dustCover.position.set(0.0365, -0.008, -0.028);
    dustCover.rotation.z = -0.32;
    this.carbineGroup.add(dustCover);

    // Left/Right receiver takedown pins & mag release button
    const pinGeo = trackGeo(new THREE.CylinderGeometry(0.0045, 0.0045, 0.064, 10));
    pinGeo.rotateZ(Math.PI / 2);
    for (const pz of [-0.048, 0.145]) {
      const pin = new THREE.Mesh(pinGeo, wornGunmetalMat);
      pin.position.set(0, -0.032, pz);
      this.carbineGroup.add(pin);
    }

    // Trigger guard housing + curved steel trigger
    const trigGuardBottom = new THREE.Mesh(trackGeo(craftedBox(0.014, 0.005, 0.068)), anodizedBlackMat);
    trigGuardBottom.position.set(0, -0.095, 0.065);
    this.carbineGroup.add(trigGuardBottom);
    const trigGuardFront = new THREE.Mesh(trackGeo(craftedBox(0.014, 0.034, 0.006)), anodizedBlackMat);
    trigGuardFront.position.set(0, -0.08, 0.033);
    trigGuardFront.rotation.x = 0.25;
    this.carbineGroup.add(trigGuardFront);
    const triggerBlade = new THREE.Mesh(trackGeo(craftedBox(0.005, 0.026, 0.006)), wornGunmetalMat);
    triggerBlade.position.set(0, -0.074, 0.068);
    triggerBlade.rotation.x = -0.36;
    this.carbineGroup.add(triggerBlade);

    // Visible internal heavy barrel, low-profile gas block & stainless steel gas tube inside handguard
    const innerBarrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 12)), bluedBarrelMat);
    innerBarrel.rotation.x = Math.PI / 2;
    innerBarrel.position.set(0, 0.008, -0.32);
    this.carbineGroup.add(innerBarrel);
    const gasTube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0032, 0.0032, 0.3, 8)), stainlessGasMat);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.032, -0.29);
    this.carbineGroup.add(gasTube);
    const gasBlock = new THREE.Mesh(trackGeo(craftedBox(0.024, 0.034, 0.034)), anodizedBlackMat);
    gasBlock.position.set(0, 0.018, -0.43);
    this.carbineGroup.add(gasBlock);

    // Free-float Tactical M-LOK Handguard with recessed cooling slots
    const handguardShape = new THREE.Shape();
    handguardShape.moveTo(-0.024, -0.03);
    handguardShape.lineTo(0.024, -0.03);
    handguardShape.lineTo(0.032, -0.016);
    handguardShape.lineTo(0.032, 0.022);
    handguardShape.lineTo(0.022, 0.038);
    handguardShape.lineTo(-0.022, 0.038);
    handguardShape.lineTo(-0.032, 0.022);
    handguardShape.lineTo(-0.032, -0.016);
    handguardShape.closePath();

    const handguardGeo = trackGeo(
      new THREE.ExtrudeGeometry(handguardShape, {
        depth: 0.31,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.0025,
        bevelSegments: 1,
      }),
    );
    handguardGeo.translate(0, 0, -0.155);
    scaleExtrudeUVs(handguardGeo, 2.8);
    const handguard = new THREE.Mesh(handguardGeo, anodizedBlackMat);
    handguard.position.set(0, 0.008, -0.32);
    this.carbineGroup.add(handguard);

    // Side cooling vent slots + Quad-rail teeth along black M4A1 handguard
    const ventSlotGeo = trackGeo(craftedBox(0.004, 0.009, 0.044));
    for (let i = 0; i < 4; i++) {
      const vz = -0.215 - i * 0.062;
      const vl = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      vl.position.set(-0.0335, 0.008, vz);
      const vr = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      vr.position.set(0.0335, 0.008, vz);
      this.carbineGroup.add(vl, vr);
    }

    // Full-length machined 1913 Picatinny top rail.
    const topRailSpine = new THREE.Mesh(trackGeo(craftedBox(0.028, 0.011, 0.68)), anodizedBlackMat);
    topRailSpine.position.set(0, 0.056, -0.115);
    this.carbineGroup.add(topRailSpine);

    const railToothGeo = trackGeo(craftedBox(0.033, 0.007, 0.012));
    for (let i = 0; i < 26; i++) {
      const zPos = 0.19 - i * 0.0245;
      // Leave clean mounting beds under the rear BUIS and forward Holo sight
      if (zPos > 0.105 && zPos < 0.175) continue;
      if (zPos > -0.185 && zPos < -0.055) continue;
      const tooth = new THREE.Mesh(railToothGeo, wornGunmetalMat);
      tooth.position.set(0, 0.064, zPos);
      this.carbineGroup.add(tooth);
    }

    // =========================================================================
    // Rear flip-up backup iron sight.
    // =========================================================================
    const buisGroup = new THREE.Group();
    buisGroup.position.set(0, 0.062, 0.145);
    this.carbineGroup.add(buisGroup);

    const buisBase = new THREE.Mesh(trackGeo(craftedBox(0.042, 0.018, 0.062)), anodizedBlackMat);
    buisBase.position.set(0, 0.006, 0);
    buisGroup.add(buisBase);

    // Side protective sight ears & folded dual-aperture sight leaf
    const buisEarGeo = trackGeo(craftedBox(0.008, 0.024, 0.044));
    const earL = new THREE.Mesh(buisEarGeo, wornGunmetalMat);
    earL.position.set(-0.017, 0.02, -0.004);
    const earR = new THREE.Mesh(buisEarGeo, wornGunmetalMat);
    earR.position.set(0.017, 0.02, -0.004);
    buisGroup.add(earL, earR);

    const buisLeaf = new THREE.Mesh(trackGeo(craftedBox(0.024, 0.012, 0.036)), anodizedBlackMat);
    buisLeaf.position.set(0, 0.022, -0.006);
    buisGroup.add(buisLeaf);

    const buisAperture = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.007, 0.0022, 8, 14)), wornGunmetalMat);
    buisAperture.rotation.x = Math.PI / 2;
    buisAperture.position.set(0, 0.029, -0.006);
    buisGroup.add(buisAperture);

    // Knurled side windage adjustment knob.
    const windageKnob = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 16)), opticDialMat);
    windageKnob.rotation.z = Math.PI / 2;
    windageKnob.position.set(-0.026, 0.016, -0.006);
    buisGroup.add(windageKnob);

    const buisClampBolt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.048, 10)), wornGunmetalMat);
    buisClampBolt.rotation.z = Math.PI / 2;
    buisClampBolt.position.set(0, 0.004, 0.018);
    buisGroup.add(buisClampBolt);

    // =========================================================================
    // AUTHENTIC BOXY EOTECH-STYLE HOLOGRAPHIC OPTIC ("SOLOZERO OPTICS / S2 MOD NV")
    // =========================================================================
    const holoGroup = new THREE.Group();
    holoGroup.position.set(0, 0.064, -0.12);
    this.carbineGroup.add(holoGroup);

    // Heavy Picatinny riser clamp base + side quick-detach bolt
    const holoMount = new THREE.Mesh(trackGeo(craftedBox(0.058, 0.024, 0.132)), anodizedBlackMat);
    holoMount.position.set(0, 0.012, 0.0);
    holoGroup.add(holoMount);

    const holoThumbBolt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.018, 14)), wornGunmetalMat);
    holoThumbBolt.rotation.z = Math.PI / 2;
    holoThumbBolt.position.set(-0.034, 0.012, 0.018);
    holoGroup.add(holoThumbBolt);

    // Forward battery compartment pod extending toward barrel
    const holoBatteryPod = new THREE.Mesh(trackGeo(craftedBox(0.056, 0.036, 0.068)), mattePolymerMat);
    holoBatteryPod.position.set(0, 0.038, -0.046);
    holoGroup.add(holoBatteryPod);

    // Rear angled emitter/control box with crisp "S2 MOD NV / SOLOZERO OPTICS" panel facing player!
    const holoRearMats = [
      anodizedBlackMat,
      anodizedBlackMat,
      anodizedBlackMat,
      anodizedBlackMat,
      holoBackFaceMat, // +Z face looking right at the player!
      anodizedBlackMat,
    ];
    const holoRearPanel = new THREE.Mesh(trackGeo(craftedBox(0.064, 0.034, 0.054)), holoRearMats);
    holoRearPanel.position.set(0, 0.037, 0.026);
    holoGroup.add(holoRearPanel);

    // Heavy Armored Protective Boxy Aluminum Shroud (ExtrudeGeometry with rounded-rectangle aperture!)
    const shroudOuter = new THREE.Shape();
    shroudOuter.moveTo(-0.039, 0.004);
    shroudOuter.lineTo(0.039, 0.004);
    shroudOuter.lineTo(0.041, 0.062);
    shroudOuter.quadraticCurveTo(0.041, 0.082, 0.024, 0.084);
    shroudOuter.lineTo(-0.024, 0.084);
    shroudOuter.quadraticCurveTo(-0.041, 0.082, -0.041, 0.062);
    shroudOuter.closePath();

    const shroudHole = new THREE.Path();
    shroudHole.moveTo(-0.029, 0.014);
    shroudHole.lineTo(0.029, 0.014);
    shroudHole.lineTo(0.031, 0.058);
    shroudHole.quadraticCurveTo(0.031, 0.072, 0.019, 0.074);
    shroudHole.lineTo(-0.019, 0.074);
    shroudHole.quadraticCurveTo(-0.031, 0.072, -0.031, 0.058);
    shroudHole.closePath();
    shroudOuter.holes.push(shroudHole);

    const shroudGeo = trackGeo(
      new THREE.ExtrudeGeometry(shroudOuter, {
        depth: 0.064,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.0025,
        bevelSegments: 2,
      }),
    );
    shroudGeo.translate(0, 0, -0.032);
    scaleExtrudeUVs(shroudGeo, 6.0);
    const holoShroud = new THREE.Mesh(shroudGeo, holoShroudMat);
    holoShroud.position.set(0, 0.046, 0.008);
    holoGroup.add(holoShroud);

    // Recessed inner dark bezel collar around the lens
    const innerBezelGeo = trackGeo(
      new THREE.ExtrudeGeometry(shroudOuter, {
        depth: 0.022,
        bevelEnabled: false,
      }),
    );
    innerBezelGeo.scale(0.92, 0.92, 1);
    innerBezelGeo.translate(0, 0.003, -0.011);
    const innerBezel = new THREE.Mesh(innerBezelGeo, rubberMat);
    innerBezel.position.set(0, 0.046, 0.01);
    holoGroup.add(innerBezel);

    // Anti-reflective coated optical lens glass
    const holoLensShape = new THREE.Shape();
    holoLensShape.moveTo(-0.029, 0.014);
    holoLensShape.lineTo(0.029, 0.014);
    holoLensShape.lineTo(0.031, 0.058);
    holoLensShape.quadraticCurveTo(0.031, 0.072, 0.019, 0.074);
    holoLensShape.lineTo(-0.019, 0.074);
    holoLensShape.quadraticCurveTo(-0.031, 0.072, -0.031, 0.058);
    holoLensShape.closePath();
    const holoLens = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(holoLensShape)), holoGlassMat);
    holoLens.position.set(0, 0.046, 0.008);
    holoGroup.add(holoLens);

    // Crisp Glowing Red Holographic Reticle centered at local y = 0.092 -> carbine y = 0.156
    const holoReticleMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.044, 0.044)), this.holoReticleMat);
    holoReticleMesh.position.set(0, 0.092, 0.006);
    holoGroup.add(holoReticleMesh);

    // Side-mounted AN/PEQ-15 Tactical Laser Illuminator Module (Matte Black matching M4A1)
    const peqBody = new THREE.Mesh(trackGeo(craftedBox(0.038, 0.024, 0.088)), mattePolymerMat);
    peqBody.position.set(0.024, 0.038, -0.41);
    this.carbineGroup.add(peqBody);
    const peqEmitter = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10)), bluedBarrelMat);
    peqEmitter.rotation.x = Math.PI / 2;
    peqEmitter.position.set(0.028, 0.04, -0.458);
    this.carbineGroup.add(peqEmitter);
    const peqLens = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 10)), holoGlassMat);
    peqLens.rotation.x = Math.PI / 2;
    peqLens.position.set(0.015, 0.039, -0.456);
    this.carbineGroup.add(peqLens);
    const pressurePad = new THREE.Mesh(trackGeo(craftedBox(0.024, 0.006, 0.068)), rubberMat);
    pressurePad.position.set(0, 0.069, -0.32);
    this.carbineGroup.add(pressurePad);

    // Side M-LOK rail segment & quick-detach sling socket on left handguard rear
    const qdSlingSocket = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.009, 0.0022, 8, 14)), wornGunmetalMat);
    qdSlingSocket.rotation.y = Math.PI / 2;
    qdSlingSocket.position.set(-0.036, 0.006, -0.178);
    this.carbineGroup.add(qdSlingSocket);

    // Tactical Matte-Black Sound Suppressor + Folding Front Sight Post (64055fb6)
    const barrelPts = [
      new THREE.Vector2(0.012, 0.0),
      new THREE.Vector2(0.012, 0.085),
      new THREE.Vector2(0.021, 0.095),
      new THREE.Vector2(0.021, 0.255),
      new THREE.Vector2(0.016, 0.262),
      new THREE.Vector2(0.0095, 0.262),
    ];
    const barrelGeo = trackGeo(new THREE.LatheGeometry(barrelPts, 10));
    barrelGeo.rotateX(-Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, anodizedBlackMat);
    barrel.position.set(0, 0.008, -0.46);
    this.carbineGroup.add(barrel);

    // Suppressor baffle collar seam ring
    const supRing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0222, 0.0222, 0.012, 10)), wornGunmetalMat);
    supRing.rotation.x = Math.PI / 2;
    supRing.position.set(0, 0.008, -0.575);
    this.carbineGroup.add(supRing);

    // Front backup flip-up iron post
    const frontSightBase = new THREE.Mesh(trackGeo(craftedBox(0.022, 0.018, 0.032)), anodizedBlackMat);
    frontSightBase.position.set(0, 0.066, -0.465);
    this.carbineGroup.add(frontSightBase);

    // Ergonomic Stippled Pistol Grip & Curved Matte Dark Steel STANAG Magazine
    const pistolGrip = new THREE.Mesh(trackGeo(craftedBox(0.038, 0.132, 0.054)), mattePolymerMat);
    pistolGrip.position.set(0, -0.106, 0.138);
    pistolGrip.rotation.x = 0.28;
    this.carbineGroup.add(pistolGrip);
    const gripBackstrap = new THREE.Mesh(trackGeo(craftedBox(0.032, 0.122, 0.018)), rubberMat);
    gripBackstrap.position.set(0, -0.108, 0.163);
    gripBackstrap.rotation.x = 0.28;
    this.carbineGroup.add(gripBackstrap);

    const magShape = new THREE.Shape();
    magShape.moveTo(-0.03, 0);
    magShape.lineTo(0.032, 0);
    magShape.quadraticCurveTo(0.044, -0.088, 0.068, -0.174);
    magShape.lineTo(0.012, -0.186);
    magShape.quadraticCurveTo(-0.014, -0.092, -0.03, 0);
    const magGeo = trackGeo(
      new THREE.ExtrudeGeometry(magShape, {
        depth: 0.032,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
      }),
    );
    magGeo.rotateY(Math.PI / 2);
    magGeo.translate(-0.016, 0, 0);
    scaleExtrudeUVs(magGeo, 3.0);
    this.carbineMag = new THREE.Mesh(magGeo, anodizedBlackMat);
    this.carbineMag.position.set(0, -0.056, -0.088);
    // Magazine floorplate & recessed cartridge window showing stacked brass rounds
    const magFloorplate = new THREE.Mesh(trackGeo(craftedBox(0.04, 0.014, 0.066)), rubberMat);
    magFloorplate.position.set(0, -0.184, -0.038);
    magFloorplate.rotation.x = -0.22;
    this.carbineMag.add(magFloorplate);
    const magWindow = new THREE.Mesh(trackGeo(craftedBox(0.037, 0.058, 0.014)), brassAccentMat);
    magWindow.position.set(0, -0.105, -0.016);
    magWindow.rotation.x = -0.18;
    this.carbineMag.add(magWindow);
    this.carbineGroup.add(this.carbineMag);

    const carbineHands = buildOperatorHands('carbine', textures, this.geometries, this.materials);
    this.carbineLeftArm = carbineHands.left;
    this.carbineGroup.add(carbineHands.left, carbineHands.right);

    this.weaponPivot.add(this.carbineGroup);

    // =========================================================================
    // 2. K-9 PRECISION RIFLE + OPTICAL MIL-DOT SCOPE
    // =========================================================================
    this.railGroup = new THREE.Group();
    this.railGroup.visible = false;

    // Weathered dark-steel & olive-tan precision marksman chassis
    const snpReceiverGeo = trackGeo(
      new THREE.ExtrudeGeometry(receiverShape, {
        depth: 0.46,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.0035,
        bevelSegments: 2,
      }),
    );
    snpReceiverGeo.translate(0, 0, -0.23);
    scaleExtrudeUVs(snpReceiverGeo, 2.8);
    const snpReceiver = new THREE.Mesh(snpReceiverGeo, wornGunmetalMat);
    snpReceiver.position.set(0, 0.002, 0.02);
    this.railGroup.add(snpReceiver);

    // Matte-tan distressed cheek-rest stock & lower chassis
    const snpLower = new THREE.Mesh(trackGeo(craftedBox(0.054, 0.048, 0.38)), fdeCerakoteMat);
    snpLower.position.set(0, -0.038, 0.02);
    this.railGroup.add(snpLower);

    const snpStock = new THREE.Mesh(trackGeo(craftedBox(0.054, 0.086, 0.28)), fdeCerakoteMat);
    snpStock.position.set(0, -0.008, 0.34);
    this.railGroup.add(snpStock);

    const snpCheekPad = new THREE.Mesh(trackGeo(craftedBox(0.058, 0.024, 0.16)), rubberMat);
    snpCheekPad.position.set(0, 0.042, 0.32);
    this.railGroup.add(snpCheekPad);

    // Top Picatinny Rail beneath the scope mount
    const snpRail = new THREE.Mesh(trackGeo(craftedBox(0.03, 0.012, 0.66)), anodizedBlackMat);
    snpRail.position.set(0, 0.055, -0.14);
    this.railGroup.add(snpRail);

    for (let i = 0; i < 22; i++) {
      const zPos = 0.14 - i * 0.026;
      const tooth = new THREE.Mesh(railToothGeo, wornGunmetalMat);
      tooth.position.set(0, 0.063, zPos);
      this.railGroup.add(tooth);
    }

    // Long Free-Float Marksman Shroud + Folded Tactical Bipod + Heavy Fluted Suppressed Barrel
    const snpHandguard = new THREE.Mesh(trackGeo(craftedBox(0.054, 0.058, 0.38)), fdeCerakoteMat);
    snpHandguard.position.set(0, 0.006, -0.37);
    this.railGroup.add(snpHandguard);

    // Side ventilation slots & folded precision bipod tucked beneath forend
    for (let i = 0; i < 4; i++) {
      const vz = -0.24 - i * 0.072;
      const sl = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      sl.position.set(-0.028, 0.008, vz);
      const sr = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      sr.position.set(0.028, 0.008, vz);
      this.railGroup.add(sl, sr);
    }
    const bipodClamp = new THREE.Mesh(trackGeo(craftedBox(0.044, 0.022, 0.048)), anodizedBlackMat);
    bipodClamp.position.set(0, -0.032, -0.49);
    this.railGroup.add(bipodClamp);
    for (const bx of [-0.026, 0.026]) {
      const bLeg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0065, 0.0075, 0.19, 10)), anodizedBlackMat);
      bLeg.rotation.x = Math.PI / 2;
      bLeg.position.set(bx, -0.036, -0.39);
      this.railGroup.add(bLeg);
      const bFoot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.01, 0.009, 0.02, 10)), rubberMat);
      bFoot.rotation.x = Math.PI / 2;
      bFoot.position.set(bx, -0.036, -0.295);
      this.railGroup.add(bFoot);
    }

    const snpSuppressor = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.021, 0.021, 0.28, 16)),
      bluedBarrelMat,
    );
    snpSuppressor.rotation.x = Math.PI / 2;
    snpSuppressor.position.set(0, 0.012, -0.68);
    this.railGroup.add(snpSuppressor);
    const supCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.028, 16)), opticDialMat);
    supCollar.rotation.x = Math.PI / 2;
    supCollar.position.set(0, 0.012, -0.555);
    this.railGroup.add(supCollar);

    // Reciprocating tactical bolt handle (right side)
    this.railBolt = new THREE.Group();
    const boltShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.042, 10)), wornGunmetalMat);
    boltShaft.rotation.z = Math.PI / 2;
    boltShaft.position.set(0.046, 0.018, 0.075);
    this.railBolt.add(boltShaft);
    const boltKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.013, 12, 10)), rubberMat);
    boltKnob.position.set(0.068, 0.012, 0.075);
    this.railBolt.add(boltKnob);
    this.railGroup.add(this.railBolt);

    // Straight heavy .308 box magazine, trigger guard & grip
    this.railMag = new THREE.Mesh(trackGeo(craftedBox(0.036, 0.145, 0.082)), anodizedBlackMat);
    this.railMag.position.set(0, -0.095, -0.095);
    this.railGroup.add(this.railMag);

    const snpTrigGuard = new THREE.Mesh(trackGeo(craftedBox(0.014, 0.005, 0.068)), anodizedBlackMat);
    snpTrigGuard.position.set(0, -0.094, 0.064);
    this.railGroup.add(snpTrigGuard);
    const snpTrigger = new THREE.Mesh(trackGeo(craftedBox(0.005, 0.024, 0.006)), wornGunmetalMat);
    snpTrigger.position.set(0, -0.074, 0.066);
    snpTrigger.rotation.x = -0.34;
    this.railGroup.add(snpTrigger);

    const snpGrip = new THREE.Mesh(trackGeo(craftedBox(0.038, 0.13, 0.054)), rubberMat);
    snpGrip.position.set(0, -0.105, 0.135);
    snpGrip.rotation.x = 0.25;
    this.railGroup.add(snpGrip);

    // =========================================================================
    // VARIABLE-POWER OPTICAL SCOPE
    // Optical center: y = 0.154, ocular rear rim: z = +0.015
    // =========================================================================
    const scopeGroup = new THREE.Group();
    scopeGroup.position.set(0, 0.154, -0.11);
    this.railGroup.add(scopeGroup);

    // Dual heavy tactical scope mount rings clamping scope to top rail
    const ringClampGeo = trackGeo(craftedBox(0.048, 0.068, 0.03));
    const mountRingRear = new THREE.Mesh(ringClampGeo, anodizedBlackMat);
    mountRingRear.position.set(0, -0.056, 0.035);
    const mountRingFront = new THREE.Mesh(ringClampGeo, anodizedBlackMat);
    mountRingFront.position.set(0, -0.056, -0.095);
    scopeGroup.add(mountRingRear, mountRingFront);

    // Open-ended hollow optical scope tube (outer shell + dark interior baffle so you see straight through!)
    const scopeOuterPts = [
      new THREE.Vector2(0.036, 0.0), // Ocular rubberized rim (rear z = +0.125 -> world local z = +0.015)
      new THREE.Vector2(0.0365, 0.042), // Knurled zoom bell
      new THREE.Vector2(0.029, 0.072), // Taper into 34mm tube
      new THREE.Vector2(0.025, 0.095),
      new THREE.Vector2(0.025, 0.24), // Main central 34mm tube
      new THREE.Vector2(0.034, 0.295), // Flared objective bell
      new THREE.Vector2(0.036, 0.36), // Front objective rim
    ];
    const scopeOuterGeo = trackGeo(new THREE.LatheGeometry(scopeOuterPts, 32));
    scopeOuterGeo.rotateX(-Math.PI / 2);
    const scopeTubeOuter = new THREE.Mesh(scopeOuterGeo, scopeMatteBodyMat);
    scopeTubeOuter.position.set(0, 0, 0.125);
    scopeGroup.add(scopeTubeOuter);

    // Matte rubberized ocular eyepiece bezel.
    const eyepieceOuter = new THREE.Shape();
    eyepieceOuter.absarc(0, 0, 0.0372, 0, Math.PI * 2, false);
    const eyepieceHole = new THREE.Path();
    eyepieceHole.absarc(0, 0, 0.0296, 0, Math.PI * 2, true);
    eyepieceOuter.holes.push(eyepieceHole);

    const eyepieceGeo = trackGeo(
      new THREE.ExtrudeGeometry(eyepieceOuter, {
        depth: 0.022,
        bevelEnabled: true,
        bevelThickness: 0.0028,
        bevelSize: 0.0022,
        bevelSegments: 3,
        curveSegments: 36,
      }),
    );
    eyepieceGeo.translate(0, 0, -0.011);
    const eyepieceBezel = new THREE.Mesh(eyepieceGeo, rubberMat);
    eyepieceBezel.position.set(0, 0, 0.115);
    scopeGroup.add(eyepieceBezel);

    // Dark matte-black inner ocular shadow sleeve behind bezel
    const innerTubeGeo = trackGeo(new THREE.CylinderGeometry(0.0298, 0.0298, 0.06, 32, 1, true));
    innerTubeGeo.rotateX(Math.PI / 2);
    const innerTubeMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x050709,
        side: THREE.BackSide,
      }),
    );
    const innerTube = new THREE.Mesh(innerTubeGeo, innerTubeMat);
    innerTube.position.set(0, 0, 0.09);
    scopeGroup.add(innerTube);

    // Precision Optical Scope Glass + Etched Mil-Dot Reticle & Red Center Dot!
    const scopeLens = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.0302, 40)), this.scopeLensMat);
    scopeLens.position.set(0, 0, 0.106);
    scopeGroup.add(scopeLens);

    // Knurled elevation and windage turrets.
    const elevTurret = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.017, 0.018, 0.026, 20)), opticDialMat);
    elevTurret.position.set(0, 0.036, -0.025);
    scopeGroup.add(elevTurret);
    const elevCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.017, 0.006, 20)), scopeMatteBodyMat);
    elevCap.position.set(0, 0.051, -0.025);
    scopeGroup.add(elevCap);

    const sideTurretL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.015, 0.016, 0.024, 18)), opticDialMat);
    sideTurretL.rotation.z = Math.PI / 2;
    sideTurretL.position.set(-0.034, 0, -0.025);
    scopeGroup.add(sideTurretL);

    const sideTurretR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.015, 0.022, 18)), scopeMatteBodyMat);
    sideTurretR.rotation.z = Math.PI / 2;
    sideTurretR.position.set(0.033, 0, -0.025);
    scopeGroup.add(sideTurretR);

    // Knurled power magnification ring with throw lever nub
    const magRing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0375, 0.0375, 0.016, 24)), opticDialMat);
    magRing.rotation.x = Math.PI / 2;
    magRing.position.set(0, 0, 0.078);
    scopeGroup.add(magRing);
    const throwLever = new THREE.Mesh(trackGeo(craftedBox(0.008, 0.018, 0.01)), wornGunmetalMat);
    throwLever.position.set(-0.033, 0.026, 0.078);
    throwLever.rotation.z = 0.85;
    scopeGroup.add(throwLever);

    const sniperHands = buildOperatorHands('railpistol', textures, this.geometries, this.materials);
    this.railLeftArm = sniperHands.left;
    this.railGroup.add(sniperHands.left, sniperHands.right);

    this.weaponPivot.add(this.railGroup);

    // =========================================================================
    // 3. FIERY VOLUMETRIC MUZZLE FLASH PLUME + DYNAMIC ORANGE LIGHTING
    // =========================================================================
    this.muzzleFlashGroup = new THREE.Group();
    this.muzzleFlashGroup.position.set(0, 0.012, -0.74);
    this.muzzleFlashGroup.visible = false;

    const flameMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.muzzleFlame,
        color: 0xffffff,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    const frontCard = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.32, 0.32)), flameMat);
    this.muzzleFlashGroup.add(frontCard);
    this.muzzleFlameCards.push(frontCard);

    const sideCard1 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.36, 0.24)), flameMat);
    sideCard1.rotation.y = Math.PI / 2;
    sideCard1.position.z = -0.07;
    this.muzzleFlashGroup.add(sideCard1);
    this.muzzleFlameCards.push(sideCard1);

    const sideCard2 = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.36, 0.24)), flameMat);
    sideCard2.rotation.x = Math.PI / 2;
    sideCard2.position.z = -0.07;
    this.muzzleFlashGroup.add(sideCard2);
    this.muzzleFlameCards.push(sideCard2);

    this.weaponPivot.add(this.muzzleFlashGroup);

    this.muzzleLight = new THREE.PointLight(0xff9d3b, 0, 8, 2);
    this.muzzleLight.position.set(-0.04, 0.06, -0.66);
    this.weaponPivot.add(this.muzzleLight);

    // =========================================================================
    // 4. POOLED EJECTED BRASS SHELL CASINGS (6 pooled in viewmodel space)
    // =========================================================================
    const shellGeo = trackGeo(new THREE.CylinderGeometry(0.0042, 0.0042, 0.024, 8));
    shellGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(shellGeo, brassAccentMat);
      m.visible = false;
      this.root.add(m);
      this.shells.push({
        mesh: m,
        active: false,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
      });
    }
    // Merge rigid receiver/rail/hand details while retaining reload pivots,
    // magazines, muzzle cards and individually moving shell casings.
    const protectedParts = new Set<THREE.Object3D>([
      this.carbineMag, this.railMag, ...this.shells.map(shell => shell.mesh),
    ]);
    this.root.userData.rigidBatching = batchDecoration(
      this.root, protectedParts, new Set([this.muzzleFlashGroup]), this.geometries, true,
    );
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh && !protectedParts.has(object) && !this.muzzleFlameCards.includes(object)) {
        object.updateMatrix();
        object.matrixAutoUpdate = false;
      }
    });
  }

  private meleeGroup?: THREE.Group;
  private meleeLeft?: THREE.Group;
  private meleeRight?: THREE.Group;
  private meleeActive = false;
  private meleePunchTimer = 0;
  private meleePunchHand = 1;

  private buildEquipmentModel(id: WeaponId): THREE.Group {
    const group = buildArmoryWeapon(id, this.textures, this.geometries, this.materials);
    const hands = buildOperatorHands(id, this.textures, this.geometries, this.materials);
    group.add(hands.left, hands.right);
    group.userData.supportHand = hands.left;
    const animNames = [
      'slide',
      'mag',
      'chargingHandle',
      'pump',
      'topCover',
      'ammoBelt',
      'warhead',
      'drum',
      'drumRound',
    ];
    const animated = [
      hands.left,
      hands.right,
      ...animNames.map((n) => group.getObjectByName(n)),
    ].filter(Boolean) as THREE.Object3D[];
    const protectedSet = new Set<THREE.Object3D>(animated);
    batchDecoration(group, protectedSet, protectedSet, this.geometries, true);
    return group;
  }

  public setMeleeActive(active: boolean) {
    this.meleeActive = active;
    if (active && !this.meleeGroup) {
      this.meleeGroup = new THREE.Group();
      this.meleeGroup.name = 'bare-hands-melee-rig';
      const hands = buildMeleeHands(this.textures, this.geometries, this.materials);
      this.meleeLeft = hands.left;
      this.meleeRight = hands.right;
      this.meleeGroup.add(hands.left, hands.right);
      this.root.add(this.meleeGroup);
    }
    if (this.meleeGroup) this.meleeGroup.visible = active && !this.scopeHidden && this.throwTimer <= 0;
    this.weaponPivot.visible = !active && !this.scopeHidden && this.throwTimer <= 0;
  }

  public triggerMeleePunch() {
    this.meleePunchTimer = 0.34;
    this.meleePunchHand = -this.meleePunchHand;
    this.recoilVelPitch -= 2.2;
  }

  public setWeapon(id: WeaponId) {
    this.meleeActive = false;
    if (this.meleeGroup) this.meleeGroup.visible = false;
    if (this.equippedWeapon === id) return;
    this.equippedWeapon = id;
    this.activeWeapon = id === 'railpistol' ? 'railpistol' : 'carbine';
    for (const [key, model] of this.equipmentModels) model.visible = key === id;
    if (id !== 'carbine' && id !== 'railpistol' && !this.equipmentModels.has(id)) {
      const model = this.buildEquipmentModel(id);
      this.equipmentModels.set(id, model);
      this.weaponPivot.add(model);
    }
    this.swapBlend = 1;
    const equipment = this.equipmentModels.get(id);
    this.activeSlide = equipment?.getObjectByName('slide');
    this.boltKick = 0;
    this.carbineGroup.visible = id === 'carbine';
    this.railGroup.visible = id === 'railpistol';
    this.muzzleFlashGroup.position.set(
      0,
      id === 'carbine' ? 0.012 : 0.014,
      id === 'carbine' ? -0.74 : id === 'railpistol' ? -0.85 : ['usp', 'deagle', 'glock'].includes(id) ? -0.48 : id === 'rpg' ? -1.25 : id === 'grenadelauncher' ? -0.82 : -0.93,
    );
    this.muzzleLight.color.setHex(id === 'carbine' ? 0xff9d3b : 0xffb357);
    if (equipment?.userData.flashOrigin) {
      this.muzzleFlashGroup.position.copy(equipment.userData.flashOrigin);
    }
  }

  public triggerGrenadeThrow(id: GrenadeId) {
    if (!this.throwableModels.has(id)) {
      const group = new THREE.Group();
      const hands = buildThrowableHands(id, this.textures, this.geometries, this.materials);
      const grenade = buildThrowable(id, this.textures, this.geometries, this.materials);
      if (id === 'molotov') {
        grenade.position.set(0.015, -0.055, -0.228);
        grenade.rotation.set(0.08, -0.15, 0.34);
      } else {
        grenade.position.set(0.008, -0.072, -0.228);
        grenade.rotation.set(0.04, 0.14, 0.14);
      }
      group.add(hands.left, hands.right, grenade);
      group.userData.pinHand = hands.left;
      group.userData.grenade = grenade;
      group.userData.grenadeId = id;
      this.throwableModels.set(id, group);
      this.root.add(group);
    }
    if(this.activeThrowable) this.activeThrowable.visible=false;
    this.activeThrowable=this.throwableModels.get(id)!;
    this.activeThrowable.visible=true; this.throwTimer=0.68;
  }

  public cancelGrenadeThrow() {
    this.throwTimer=0;
    if(this.activeThrowable) this.activeThrowable.visible=false;
    this.weaponPivot.visible=true;
  }

  public triggerShot(kickZ: number, kickPitch: number) {
    // Dampen backward Z-kick slightly during deep sniper scope ADS so eye relief stays crystal-clear
    const adsDamp = this.activeWeapon === 'railpistol' ? 1 - this.currentAds * 0.52 : 1 - this.currentAds * 0.25;
    this.recoilVelZ += kickZ * 26 * adsDamp;
    this.recoilVelPitch += kickPitch * 22 * (1 - this.currentAds * 0.22);
    this.boltKick = 1.0;

    // Fiery muzzle blast burst (subdued on suppressed marksman rifle)
    this.muzzleFlashTimer = this.activeWeapon === 'carbine' ? 0.056 : 0.042;
    this.muzzleFlashGroup.visible = true;
    this.muzzleFlameCards[0].rotation.z = Math.random() * Math.PI * 2;
    const scale = (this.activeWeapon === 'carbine' ? 0.92 : 0.52) + Math.random() * 0.35;
    this.muzzleFlashGroup.scale.set(scale, scale, scale * (0.9 + Math.random() * 0.35));
    this.muzzleLight.intensity = this.activeWeapon === 'carbine' ? 6.2 : 3.8;

    // Eject spinning brass shell casing from right ejection port
    const casing = this.shells.find((s) => !s.active) || this.shells[0];
    casing.active = true;
    casing.life = 0.48;
    casing.mesh.position.set(
      this.weaponPivot.position.x + 0.055,
      this.weaponPivot.position.y + 0.025,
      this.weaponPivot.position.z - 0.04,
    );
    casing.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    casing.vel.set(1.1 + Math.random() * 0.55, 0.75 + Math.random() * 0.45, 0.15 + Math.random() * 0.3);
    casing.rotVel.set(16 + Math.random() * 10, 12 + Math.random() * 10, 18 + Math.random() * 12);
    casing.mesh.visible = true;
  }

  public getAdsBlend(): number {
    return this.currentAds;
  }

  public triggerDamageFlinch(intensity: number, lateralDir: number) {
    const scale = THREE.MathUtils.clamp(intensity, 0.25, 1.8);
    const adsDamp = 1 - this.currentAds * 0.45;
    const side = Math.abs(lateralDir) > 0.15 ? -Math.sign(lateralDir) : Math.random() < 0.5 ? -1 : 1;
    this.flinchX = THREE.MathUtils.clamp(this.flinchX + side * 0.018 * scale * adsDamp, -0.042, 0.042);
    this.flinchY = THREE.MathUtils.clamp(this.flinchY - 0.022 * scale * adsDamp, -0.052, 0.02);
    this.flinchZ = THREE.MathUtils.clamp(this.flinchZ + 0.026 * scale * adsDamp, -0.02, 0.062);
    this.flinchPitch = THREE.MathUtils.clamp(this.flinchPitch + 0.048 * scale * adsDamp, -0.04, 0.14);
    this.flinchRoll = THREE.MathUtils.clamp(this.flinchRoll + side * 0.095 * scale * adsDamp, -0.22, 0.22);
  }

  public triggerLanding(impactSpeed: number) {
    const k = THREE.MathUtils.clamp((impactSpeed - 2.5) / 11, 0.15, 1.0);
    this.landDipVel -= 0.48 * k * (1 - this.currentAds * 0.65);
  }

  public setScopeOverlayHidden(hidden: boolean) {
    if (this.scopeHidden === hidden) return;
    this.scopeHidden = hidden;
    this.weaponPivot.visible = !hidden && this.throwTimer<=0;
  }

  public getMuzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    if (this.scopeHidden) {
      this.root.getWorldPosition(target);
      return target;
    }
    this.muzzleFlashGroup.getWorldPosition(target);
    return target;
  }

  private smoothRange(p: number, start: number, end: number): number {
    if (p <= start) return 0;
    if (p >= end) return 1;
    const t = (p - start) / (end - start);
    return t * t * (3 - 2 * t);
  }

  private bellPulse(p: number, start: number, peak: number, end: number): number {
    if (p <= start || p >= end) return 0;
    if (p < peak) {
      const t = (p - start) / (peak - start);
      return t * t * (3 - 2 * t);
    }
    const t = 1 - (p - peak) / (end - peak);
    return t * t * (3 - 2 * t);
  }

  public update(
    dt: number,
    moveSpeedRatio: number,
    grounded: boolean,
    ads: boolean,
    reloading: boolean,
    reloadProgress: number,
    ammoRatio: number,
    lookDeltaX = 0,
    lookDeltaY = 0,
    sprinting = false,
    crouching = false,
    reloadEmpty = false,
    inspecting = false,
  ) {
    this.throwTimer = Math.max(0, this.throwTimer - dt);
    this.meleePunchTimer = Math.max(0, this.meleePunchTimer - dt);
    const throwing = this.throwTimer > 0;
    this.weaponPivot.visible = !throwing && !this.scopeHidden && !this.meleeActive;
    if (this.meleeGroup) {
      this.meleeGroup.visible = this.meleeActive && !throwing && !this.scopeHidden;
      if (this.meleeGroup.visible && this.meleeLeft && this.meleeRight) {
        const sprintDip = this.sprintBlend * 0.045;
        const bobX = Math.sin(this.swayPhase) * 0.008 * moveSpeedRatio;
        const bobY = Math.abs(Math.cos(this.swayPhase)) * 0.008 * moveSpeedRatio;
        this.meleeGroup.position.set(bobX, -0.015 - bobY - sprintDip, 0);
        this.meleeGroup.rotation.set(-0.08 * this.sprintBlend, 0.06 * this.sprintBlend, 0);

        const punchK = this.meleePunchTimer > 0 ? Math.sin((1 - this.meleePunchTimer / 0.34) * Math.PI) : 0;
        const leadIsLeft = this.meleePunchHand < 0;
        this.meleeLeft.position.set(
          leadIsLeft ? punchK * 0.075 : -punchK * 0.018,
          leadIsLeft ? punchK * 0.025 : -punchK * 0.015,
          leadIsLeft ? -punchK * 0.24 : punchK * 0.04,
        );
        this.meleeLeft.rotation.set(leadIsLeft ? punchK * 0.16 : 0, leadIsLeft ? -punchK * 0.22 : 0, leadIsLeft ? -punchK * 0.35 : 0);

        this.meleeRight.position.set(
          !leadIsLeft ? -punchK * 0.085 : punchK * 0.02,
          !leadIsLeft ? punchK * 0.03 : -punchK * 0.015,
          !leadIsLeft ? -punchK * 0.26 : punchK * 0.045,
        );
        this.meleeRight.rotation.set(!leadIsLeft ? punchK * 0.18 : 0, !leadIsLeft ? punchK * 0.24 : 0, !leadIsLeft ? punchK * 0.38 : 0);
      }
    }
    if (this.activeThrowable) {
      this.activeThrowable.visible = throwing;
      const t = 1 - this.throwTimer / 0.68;
      const pin = this.activeThrowable.userData.pinHand as THREE.Group;
      const grenade = this.activeThrowable.userData.grenade as THREE.Group;
      const throwId = this.activeThrowable.userData.grenadeId as GrenadeId | undefined;
      const pullRing = grenade.userData.pullRing as THREE.Object3D | undefined;
      const flameGroup = grenade.userData.flameGroup as THREE.Object3D | undefined;
      if (throwId === 'molotov') {
        pin.position.set(-Math.min(1, t * 2) * 0.045, -Math.sin(t * Math.PI) * 0.03, 0);
      } else {
        const pull = Math.min(1, Math.max(0, (t - 0.05) * 2.8));
        pin.position.set(-pull * 0.058, Math.sin(t * Math.PI) * 0.032, 0);
        if (pullRing) {
          pullRing.position.set(-0.016 - pull * 0.042, 0.051 + Math.sin(pull * Math.PI) * 0.014, 0.01);
        }
      }
      if (flameGroup) {
        const now = performance.now();
        const flicker = 0.88 + 0.24 * Math.abs(Math.sin(now * 0.025));
        flameGroup.scale.set(flicker, 0.9 + flicker * 0.26, flicker);
        flameGroup.rotation.z = Math.sin(now * 0.031) * 0.14;
      }
      const release = Math.max(0, (t - 0.48) / 0.52);
      this.activeThrowable.position.set(0.035 - release * 0.02, -0.04 + Math.sin(release * Math.PI) * 0.14, -0.06 - release * 0.22);
      this.activeThrowable.rotation.x = -release * 1.15;
      grenade.visible = t < 0.56;
    }
    // 1. Muzzle flash decay & flicker
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      const peak = this.activeWeapon === 'carbine' ? 6.2 : 3.8;
      const dur = this.activeWeapon === 'carbine' ? 0.056 : 0.042;
      this.muzzleLight.intensity = Math.max(0, (this.muzzleFlashTimer / dur) * peak);
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashGroup.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    // 2. Reciprocating bolt blowback + Last-Round Bolt Hold-Open on primary carbine
    this.boltKick = THREE.MathUtils.damp(this.boltKick, 0, this.activeWeapon === 'railpistol' ? 11 : 26, dt);
    const carbineEmptyLock = !reloading && ammoRatio <= 0.0001;
    let carbineBoltZ = carbineEmptyLock ? 0.068 : this.boltKick * 0.072;
    let railBoltZ = this.boltKick * 0.088;

    // 3. Ejected brass casings update
    for (const s of this.shells) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 5.4 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.rotVel.x * dt;
      s.mesh.rotation.y += s.rotVel.y * dt;
      s.mesh.rotation.z += s.rotVel.z * dt;
    }

    // 4. Second-order spring recoil & landing weight recovery
    const stiffness = this.activeWeapon === 'railpistol' ? 190 : 275;
    const damping = this.activeWeapon === 'railpistol' ? 21 : 25;
    const accZ = -stiffness * this.recoilZ - damping * this.recoilVelZ;
    this.recoilVelZ += accZ * dt;
    const maxZ = this.activeWeapon === 'railpistol' && this.currentAds > 0.5 ? 0.055 : 0.11;
    this.recoilZ = THREE.MathUtils.clamp(this.recoilZ + this.recoilVelZ * dt, -0.015, maxZ);

    const accP = -stiffness * this.recoilPitch - damping * this.recoilVelPitch;
    this.recoilVelPitch += accP * dt;
    this.recoilPitch = THREE.MathUtils.clamp(this.recoilPitch + this.recoilVelPitch * dt, -0.025, 0.18);

    // Weighted vertical landing spring
    const landAcc = -165 * this.landDip - 18 * this.landDipVel;
    this.landDipVel += landAcc * dt;
    this.landDip = THREE.MathUtils.clamp(this.landDip + this.landDipVel * dt, -0.042, 0.014);

    // 5. Smooth ADS, Sprint low-ready, Crouch stability, Inspect, Swap & Inertial Look Sway
    const canInspect = inspecting && !ads && !reloading && !sprinting && !throwing;
    this.inspectBlend = THREE.MathUtils.damp(this.inspectBlend, canInspect ? 1 : 0, canInspect ? 7.2 : 14.0, dt);
    if (canInspect) {
      this.inspectPhase += dt;
    } else if (this.inspectBlend < 0.015) {
      this.inspectPhase = 0;
      this.inspectBlend = 0;
    }

    const targetAds = ads && !reloading && !throwing ? 1 : 0;
    const adsLambda = this.activeWeapon === 'railpistol' ? 11.5 : 15.5;
    this.currentAds = THREE.MathUtils.damp(this.currentAds, targetAds, adsLambda, dt);
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, sprinting && !ads && !reloading ? 1 : 0, 10, dt);
    this.crouchBlend = THREE.MathUtils.damp(this.crouchBlend, crouching ? 1 : 0, 11, dt);
    this.swapBlend = THREE.MathUtils.damp(this.swapBlend, 0, 11, dt);

    // Subtle optic reticle brightening when looking cleanly through ADS
    this.holoReticleMat.opacity = THREE.MathUtils.lerp(0.76, 1.0, this.currentAds);
    this.scopeLensMat.opacity = THREE.MathUtils.lerp(0.84, 0.99, this.currentAds);

    const crouchSteady = 1 - this.crouchBlend * 0.34;
    const swayScale = (1 - this.currentAds * (this.activeWeapon === 'railpistol' ? 0.94 : 0.8)) * crouchSteady;
    const targetSwayX = THREE.MathUtils.clamp(-lookDeltaX * 0.00046, -0.019, 0.019) * swayScale;
    const targetSwayY = THREE.MathUtils.clamp(lookDeltaY * 0.00038, -0.014, 0.014) * swayScale;
    this.lookSwayX = THREE.MathUtils.damp(this.lookSwayX, targetSwayX, 11, dt);
    this.lookSwayY = THREE.MathUtils.damp(this.lookSwayY, targetSwayY, 11, dt);

    // Interactive gentle look-tilt during hold-to-inspect so sunlight glides across brushed steel & optics
    const targetInspectTiltX = canInspect ? THREE.MathUtils.clamp(lookDeltaX * 0.0045, -0.22, 0.22) : 0;
    const targetInspectTiltY = canInspect ? THREE.MathUtils.clamp(-lookDeltaY * 0.0038, -0.16, 0.16) : 0;
    this.inspectTiltX = THREE.MathUtils.damp(this.inspectTiltX, targetInspectTiltX, 6.5, dt);
    this.inspectTiltY = THREE.MathUtils.damp(this.inspectTiltY, targetInspectTiltY, 6.5, dt);

    // Smooth recovery from physical damage-impact weapon flinch
    this.flinchX = THREE.MathUtils.damp(this.flinchX, 0, 12, dt);
    this.flinchY = THREE.MathUtils.damp(this.flinchY, 0, 12, dt);
    this.flinchZ = THREE.MathUtils.damp(this.flinchZ, 0, 13, dt);
    this.flinchPitch = THREE.MathUtils.damp(this.flinchPitch, 0, 11, dt);
    this.flinchRoll = THREE.MathUtils.damp(this.flinchRoll, 0, 10, dt);

    // 6. Grounded Weighted Stride Bob + Natural Subtle Breathing Sway
    const breathPhase = performance.now() * 0.0016;
    const breathScale = (1 - this.currentAds * (this.activeWeapon === 'railpistol' ? 0.88 : 0.72)) * crouchSteady;
    const breathX = Math.cos(breathPhase * 0.7) * 0.0009 * breathScale;
    const breathY = Math.sin(breathPhase) * 0.0016 * breathScale;
    if (grounded && moveSpeedRatio > 0.05) {
      const cadence = sprinting ? 10.6 : crouching ? 5.6 : 7.6;
      this.swayPhase += dt * (cadence + moveSpeedRatio * 2.2);
    }
    const bobAmp = grounded ? moveSpeedRatio * (1 - this.currentAds * 0.9) * (1 - this.crouchBlend * 0.35) : 0;
    const bobX = Math.sin(this.swayPhase) * (0.0075 + this.sprintBlend * 0.009) * bobAmp + breathX;
    const bobY = -Math.abs(Math.cos(this.swayPhase)) * (0.007 + this.sprintBlend * 0.008) * bobAmp + breathY;
    const bobRoll = Math.sin(this.swayPhase) * (0.016 + this.sprintBlend * 0.028) * bobAmp;

    // 7. Multi-Stage Tactical vs. Empty Dry Reload Choreography
    const p = THREE.MathUtils.clamp(reloadProgress, 0, 1);
    let reloadShiftX = 0;
    let reloadShiftY = 0;
    let reloadShiftZ = 0;
    let reloadRotX = 0;
    let reloadRotY = 0;
    let reloadRotZ = 0;

    let magOffsetX = 0;
    let magOffsetY = 0;
    let magOffsetZ = 0;
    let magRotX = 0;
    let magRotZ = 0;

    let armOffsetX = 0;
    let armOffsetY = 0;
    let armOffsetZ = 0;
    let armRotX = 0;
    let armRotY = 0;
    let armRotZ = 0;

    let slidePullZ = this.boltKick * 0.025;
    let chOffsetZ = 0;
    let chOffsetY = 0;
    let pumpOffsetZ = this.equippedWeapon === 'shotgun' && this.boltKick > 0.05 ? Math.sin(this.boltKick * Math.PI) * 0.075 : 0;
    let lmgCoverRotX = 0;
    let lmgBeltOffsetY = 0;
    let rpgWarheadY = 0;
    let rpgWarheadZ = 0;
    let rpgWarheadVisible = ammoRatio > 0 || !reloading;
    let glDrumRotZ = 0;
    let glDrumRoundVisible = true;
    let glHandRoundVisible = false;

    if (reloading) {
      const ew = this.equippedWeapon;
      if (ew === 'carbine') {
        if (!reloadEmpty) {
          // ===================================================================
          // PRIMARY CARBINE: FAST TACTICAL RELOAD (PARTIAL MAG, ROUND CHAMBERED)
          // Controlled mag retention swap -> crisp upward mag lock -> fast ready
          // ===================================================================
          const enter = this.smoothRange(p, 0.0, 0.16);
          const exit = 1 - this.smoothRange(p, 0.8, 1.0);
          const poseEnv = enter * exit;

          // Compact workspace tilt keeping sight picture close to eye-line
          reloadShiftX = -0.032 * poseEnv;
          reloadShiftY = -0.028 * poseEnv;
          reloadShiftZ = 0.018 * poseEnv;
          reloadRotX = 0.16 * poseEnv; // lift muzzle slightly to inspect magwell
          reloadRotY = -0.1 * poseEnv;
          reloadRotZ = 0.39 * poseEnv; // roll left side up so magwell is clearly visible

          // Stage 1-2: Reach to magwell, pull partial mag down smoothly, bring fresh mag up
          if (p < 0.14) {
            const k = this.smoothRange(p, 0.0, 0.14);
            armOffsetX = 0.048 * k;
            armOffsetY = -0.072 * k;
            armOffsetZ = 0.125 * k;
            armRotX = 0.14 * k;
            armRotZ = -0.16 * k;
          } else if (p < 0.44) {
            // Pull retained partial magazine smoothly out & tuck down
            const k = this.smoothRange(p, 0.14, 0.42);
            magOffsetY = -0.22 * k;
            magOffsetZ = 0.024 * k;
            magRotX = -0.15 * k;
            armOffsetX = 0.048 - 0.018 * k;
            armOffsetY = -0.072 - 0.145 * k;
            armOffsetZ = 0.125 + 0.042 * k;
            armRotX = 0.14 + 0.16 * k;
            armRotZ = -0.16 - 0.1 * k;
          } else if (p < 0.72) {
            // Seat fresh magazine smoothly straight up into the flared magwell
            const k = this.smoothRange(p, 0.44, 0.67);
            const inv = 1 - k;
            magOffsetY = -0.22 * inv;
            magOffsetZ = 0.018 * inv;
            magRotX = -0.1 * inv;
            armOffsetX = 0.03 + 0.018 * k;
            armOffsetY = -0.217 + 0.142 * k;
            armOffsetZ = 0.167 - 0.042 * k;
            armRotX = 0.3 - 0.16 * k;
            armRotZ = -0.26 + 0.1 * k;
          } else {
            // Crisp return of left support hand onto M-LOK handguard
            const inv = 1 - this.smoothRange(p, 0.72, 0.96);
            armOffsetX = 0.048 * inv;
            armOffsetY = -0.075 * inv;
            armOffsetZ = 0.125 * inv;
            armRotX = 0.14 * inv;
            armRotZ = -0.16 * inv;
          }

          // Subtle physical rifle impulses on mag extraction & fresh mag seating lock-in
          const pullDip = this.bellPulse(p, 0.14, 0.22, 0.34);
          const seatJolt = this.bellPulse(p, 0.63, 0.68, 0.79);
          reloadShiftY += -0.008 * pullDip + 0.016 * seatJolt;
          reloadRotX += 0.028 * seatJolt - 0.016 * pullDip;
          reloadRotZ += 0.032 * seatJolt;
          // Bolt remains closed throughout a tactical reload (round already in chamber)
          carbineBoltZ = 0;
        } else {
          // ===================================================================
          // PRIMARY CARBINE: FULL EMPTY DRY RELOAD (BOLT LOCKED BACK)
          // Drop spent mag free -> seat fresh mag -> slap/rack side bolt -> ready
          // ===================================================================
          const enter = this.smoothRange(p, 0.0, 0.11);
          const exit = 1 - this.smoothRange(p, 0.86, 1.0);
          const poseEnv = enter * exit;
          const rackShowcase = this.bellPulse(p, 0.56, 0.72, 0.88);

          // Deeper inspection cant exposing locked-back bolt & magwell, rotating smoothly for bolt rack
          reloadShiftX = (-0.046 + 0.014 * rackShowcase) * poseEnv;
          reloadShiftY = (-0.046 + 0.018 * rackShowcase) * poseEnv;
          reloadShiftZ = (0.026 + 0.014 * rackShowcase) * poseEnv;
          reloadRotX = (0.21 - 0.06 * rackShowcase) * poseEnv;
          reloadRotY = (-0.16 - 0.09 * rackShowcase) * poseEnv;
          reloadRotZ = (0.58 - 0.14 * rackShowcase) * poseEnv;

          // Stage 1 (0.00 -> 0.25): Press mag release — empty mag drops rapidly & tumbles clear
          if (p < 0.25) {
            const dropK = this.smoothRange(p, 0.05, 0.23);
            const dropAccel = dropK * dropK;
            magOffsetY = -0.36 * dropAccel;
            magOffsetX = -0.035 * dropAccel;
            magOffsetZ = 0.032 * dropAccel;
            magRotX = -0.34 * dropAccel;
            magRotZ = 0.2 * dropAccel;

            // Left hand drops directly down to draw a fresh magazine from chest rig
            const drawK = this.smoothRange(p, 0.02, 0.24);
            armOffsetX = 0.022 * drawK;
            armOffsetY = -0.24 * drawK;
            armOffsetZ = 0.16 * drawK;
            armRotX = 0.34 * drawK;
            armRotZ = -0.24 * drawK;
          } else if (p < 0.57) {
            // Stage 2 (0.25 -> 0.57): Drive fresh magazine sharply up into magwell & confirm seat
            const insertK = this.smoothRange(p, 0.26, 0.49);
            const inv = 1 - insertK;
            magOffsetY = -0.27 * inv;
            magOffsetZ = 0.02 * inv;
            magRotX = -0.12 * inv;

            const tapPulse = this.bellPulse(p, 0.49, 0.53, 0.57);
            armOffsetX = 0.022 + 0.026 * insertK;
            armOffsetY = -0.24 + 0.166 * insertK + 0.014 * tapPulse;
            armOffsetZ = 0.16 - 0.035 * insertK;
            armRotX = 0.34 - 0.2 * insertK;
            armRotZ = -0.24 + 0.08 * insertK;
          } else if (p < 0.85) {
            // Stage 3 (0.57 -> 0.85): Left hand sweeps up to side charging handle / bolt release & racks bolt
            const reachK = this.smoothRange(p, 0.57, 0.68);
            const pullK = this.bellPulse(p, 0.68, 0.72, 0.78);
            const returnK = this.smoothRange(p, 0.78, 0.85);
            const onHandle = reachK * (1 - returnK);

            const fromMag = 1 - reachK;
            armOffsetX = 0.048 * fromMag + (-0.032 * onHandle);
            armOffsetY = -0.074 * fromMag + (0.056 * onHandle);
            armOffsetZ = 0.125 * fromMag + (0.165 + 0.052 * pullK) * onHandle;
            armRotX = 0.14 * fromMag + (-0.22 * onHandle);
            armRotY = 0.14 * onHandle;
            armRotZ = -0.16 * fromMag + (0.26 * onHandle);
          } else {
            // Stage 4 (0.85 -> 1.00): Smooth settle back onto M-LOK handguard
            const settleInv = 1 - this.smoothRange(p, 0.85, 0.98);
            armOffsetX = -0.008 * settleInv;
            armOffsetY = -0.015 * settleInv;
            armOffsetZ = 0.04 * settleInv;
          }

          // Mechanical Bolt Hold-Open -> Tension Release -> Authoritative Forward Bolt Slam!
          if (p < 0.68) {
            carbineBoltZ = 0.068;
          } else if (p < 0.72) {
            const k = this.smoothRange(p, 0.68, 0.72);
            carbineBoltZ = THREE.MathUtils.lerp(0.068, 0.078, k);
          } else if (p < 0.78) {
            const k = this.smoothRange(p, 0.72, 0.78);
            carbineBoltZ = THREE.MathUtils.lerp(0.078, 0.0, k * k);
          } else {
            carbineBoltZ = 0.0;
          }

          // Physical rifle impulses: mag release flick, authoritative mag slam-in, and heavy bolt slam forward
          const ejectFlick = this.bellPulse(p, 0.04, 0.09, 0.18);
          const magSlam = this.bellPulse(p, 0.46, 0.51, 0.6);
          const boltSlam = this.bellPulse(p, 0.73, 0.77, 0.86);

          reloadShiftY += -0.01 * ejectFlick + 0.022 * magSlam - 0.008 * boltSlam;
          reloadShiftZ += -0.022 * boltSlam;
          reloadRotX += 0.048 * magSlam - 0.052 * boltSlam;
          reloadRotZ += 0.045 * ejectFlick + 0.036 * magSlam - 0.062 * boltSlam;
        }
      } else if (ew === 'glock' || ew === 'usp' || ew === 'deagle') {
        // Pistols: cant sidearm up-inward, drop mag out grip, seat fresh mag, thumb-release locked slide
        const env = Math.sin(p * Math.PI);
        reloadShiftX = -0.03 * env;
        reloadShiftY = -0.022 * env;
        reloadRotX = 0.22 * env;
        reloadRotY = 0.28 * env;
        reloadRotZ = 0.44 * env;

        if (reloadEmpty && p < 0.78) {
          slidePullZ = 0.026;
        } else if (reloadEmpty && p < 0.88) {
          const releaseK = this.smoothRange(p, 0.78, 0.88);
          slidePullZ = THREE.MathUtils.lerp(0.026, 0, releaseK * releaseK);
        }

        if (p < 0.36) {
          const dropK = this.smoothRange(p, 0.06, 0.34);
          magOffsetY = -0.22 * dropK * dropK;
          magOffsetZ = 0.04 * dropK;
          armOffsetY = -0.18 * dropK;
          armOffsetZ = 0.08 * dropK;
        } else if (p < 0.7) {
          const insertK = this.smoothRange(p, 0.36, 0.65);
          const inv = 1 - insertK;
          magOffsetY = -0.22 * inv;
          magOffsetZ = 0.035 * inv;
          armOffsetY = -0.18 * inv;
          armOffsetZ = 0.08 * inv;
        } else {
          const thumbSnap = this.bellPulse(p, 0.7, 0.79, 0.92);
          armOffsetY = 0.032 * thumbSnap;
          armOffsetZ = -0.018 * thumbSnap;
          reloadShiftY += 0.015 * this.bellPulse(p, 0.76, 0.82, 0.9);
          reloadRotX += 0.04 * this.bellPulse(p, 0.76, 0.82, 0.9);
        }
      } else if (ew === 'smg') {
        // HK MP5: roll receiver left, swap curved stick mag, perform classic forward HK Slap on empty
        const env = Math.sin(p * Math.PI);
        reloadShiftX = -0.03 * env;
        reloadShiftY = -0.038 * env;
        reloadRotX = 0.16 * env;
        reloadRotZ = 0.44 * env;

        const magEnd = reloadEmpty ? 0.64 : 0.86;
        if (p > 0.1 && p < magEnd) {
          const phase = (p - 0.1) / (magEnd - 0.1);
          const curve = Math.sin(phase * Math.PI);
          magOffsetY = -0.22 * curve;
          armOffsetY = -0.16 * curve;
          armOffsetZ = 0.12 * curve;
          armOffsetX = 0.035 * curve;
        }
        if (reloadEmpty) {
          if (p < 0.72) {
            chOffsetZ = 0.048;
            chOffsetY = 0.008;
          } else if (p < 0.9) {
            const slapK = this.bellPulse(p, 0.66, 0.76, 0.88);
            const closeK = this.smoothRange(p, 0.74, 0.84);
            chOffsetZ = THREE.MathUtils.lerp(0.048, 0, closeK);
            chOffsetY = THREE.MathUtils.lerp(0.008, 0, closeK);
            armOffsetY = 0.05 * slapK;
            armOffsetZ = -0.095 * slapK;
            reloadRotZ -= 0.12 * slapK;
          }
        }
      } else if (ew === 'machinegun') {
        // M249 LMG: flip hinged top feed cover UPWARD (-X), swap olive canvas pouch, seat brass belt & slam cover shut
        const env = Math.sin(p * Math.PI);
        reloadShiftY = -0.048 * env;
        reloadRotX = 0.1 * env;
        reloadRotZ = 0.26 * env;

        if (p < 0.22) {
          const openK = this.smoothRange(p, 0.06, 0.2);
          lmgCoverRotX = -0.82 * openK;
          lmgBeltOffsetY = 0.045 * openK;
          armOffsetY = 0.09 * openK;
          armOffsetZ = 0.18 * openK;
        } else if (p < 0.58) {
          lmgCoverRotX = -0.82;
          const boxPhase = (p - 0.22) / 0.36;
          const boxCurve = Math.sin(boxPhase * Math.PI);
          magOffsetY = -0.23 * boxCurve;
          lmgBeltOffsetY = 0.06 * boxCurve;
          armOffsetY = -0.18 * boxCurve;
          armOffsetZ = 0.14 * boxCurve;
          armOffsetX = 0.04 * boxCurve;
        } else if (p < 0.8) {
          lmgCoverRotX = -0.82;
          const beltK = 1 - this.smoothRange(p, 0.58, 0.76);
          lmgBeltOffsetY = 0.075 * beltK;
          armOffsetY = 0.04 + 0.05 * beltK;
          armOffsetZ = 0.16 * beltK;
        } else {
          const closeK = this.smoothRange(p, 0.8, 0.92);
          lmgCoverRotX = -0.82 * (1 - closeK);
          const slam = this.bellPulse(p, 0.88, 0.92, 0.98);
          armOffsetY = 0.08 * (1 - closeK);
          reloadShiftY -= 0.025 * slam;
          reloadRotX -= 0.06 * slam;
        }
      } else if (ew === 'shotgun') {
        // Pump Shotgun: roll ejection/loading port sideways, feed shells upward, rack pump forend
        const env = Math.sin(p * Math.PI);
        reloadShiftY = -0.03 * env;
        reloadRotX = 0.14 * env;
        reloadRotZ = -0.58 * env;

        if (p > 0.14 && p < 0.72) {
          const pulse = Math.abs(Math.sin(((p - 0.14) / 0.58) * Math.PI * 2));
          magOffsetY = -0.09 * (1 - pulse);
          armOffsetY = -0.11 * (1 - pulse);
          armOffsetZ = 0.18;
          armOffsetX = 0.04;
        } else if (p >= 0.72) {
          const pumpPulse = this.bellPulse(p, 0.74, 0.82, 0.94);
          pumpOffsetZ = pumpPulse * 0.095;
          armOffsetZ = pumpPulse * 0.095;
          reloadShiftZ -= 0.02 * pumpPulse;
        }
      } else if (ew === 'rpg') {
        // RPG 7: lift launcher tube skyward & slide fresh PG-7V warhead cleanly into front muzzle
        const env = Math.sin(p * Math.PI);
        reloadShiftY = -0.058 * env;
        reloadRotX = 0.34 * env;
        reloadRotZ = -0.22 * env;

        if (p < 0.25) {
          rpgWarheadVisible = false;
          armOffsetY = -0.16 * this.smoothRange(p, 0.05, 0.25);
          armOffsetZ = 0.12 * this.smoothRange(p, 0.05, 0.25);
        } else if (p < 0.82) {
          rpgWarheadVisible = true;
          const loadK = this.smoothRange(p, 0.26, 0.74);
          const inv = 1 - loadK;
          rpgWarheadZ = -0.34 * inv;
          rpgWarheadY = -0.12 * inv;
          armOffsetZ = -0.32 * inv;
          armOffsetY = -0.12 * inv;
          const clickBump = this.bellPulse(p, 0.72, 0.77, 0.84);
          reloadShiftZ += 0.028 * clickBump;
        } else {
          rpgWarheadVisible = true;
          const inv = 1 - this.smoothRange(p, 0.82, 0.98);
          armOffsetY = -0.04 * inv;
        }
      } else if (ew === 'grenadelauncher') {
        // GL-1 Launcher: swing rotary breech drum LEFT on Z crane, raise left hand w/ olive+brass 40mm round into chamber, snap shut (215fb7dc!)
        const env = Math.sin(p * Math.PI);
        reloadShiftX = 0.015 * env;
        reloadShiftY = 0.015 * env;
        reloadRotX = 0.08 * env;
        reloadRotY = 0.18 * env;
        reloadRotZ = -0.22 * env;

        if (p < 0.22) {
          const swingK = this.smoothRange(p, 0.04, 0.2);
          glDrumRotZ = 0.95 * swingK;
          glDrumRoundVisible = false;
          glHandRoundVisible = true;
          armOffsetX = -0.055 * swingK;
          armOffsetY = 0.03 * swingK;
          armOffsetZ = 0.26 * swingK;
          armRotZ = 0.16 * swingK;
        } else if (p < 0.76) {
          glDrumRotZ = 0.95;
          const pushK = this.smoothRange(p, 0.24, 0.66);
          glHandRoundVisible = p < 0.66;
          glDrumRoundVisible = p >= 0.62;
          armOffsetX = THREE.MathUtils.lerp(-0.075, -0.022, pushK);
          armOffsetY = THREE.MathUtils.lerp(0.02, 0.068, pushK);
          armOffsetZ = THREE.MathUtils.lerp(0.28, 0.23, pushK);
          armRotZ = THREE.MathUtils.lerp(0.18, 0.28, pushK);
        } else {
          const closeK = this.smoothRange(p, 0.78, 0.92);
          glDrumRotZ = 0.95 * (1 - closeK);
          glDrumRoundVisible = true;
          glHandRoundVisible = false;
          armOffsetX = -0.022 * (1 - closeK);
          armOffsetY = 0.05 * (1 - closeK);
          armOffsetZ = 0.22 * (1 - closeK);
          armRotZ = 0.2 * (1 - closeK);
          const latch = this.bellPulse(p, 0.88, 0.92, 0.98);
          reloadRotZ += 0.07 * latch;
        }
      } else {
        // SCAR 20S DMR & K-9 Precision Rifle: cant weapon, swap box magazine, cycle side bolt handle
        const env = Math.sin(p * Math.PI);
        reloadShiftY = -0.044 * env;
        reloadRotX = 0.18 * env;
        reloadRotZ = (reloadEmpty ? 0.5 : 0.4) * env;

        const magEnd = reloadEmpty ? 0.66 : 0.84;
        if (p > 0.12 && p < magEnd) {
          const magPhase = (p - 0.12) / (magEnd - 0.12);
          const magCurve = Math.sin(magPhase * Math.PI);
          magOffsetY = -magCurve * 0.2;
          armOffsetY = -magCurve * 0.15;
          armOffsetZ = magCurve * 0.13;
          armOffsetX = magCurve * 0.045;
        }
        if (reloadEmpty && p > 0.66 && p < 0.92) {
          const boltPulse = this.bellPulse(p, 0.68, 0.77, 0.88);
          railBoltZ = boltPulse * 0.092;
          chOffsetZ = boltPulse * 0.068;
          reloadRotZ -= 0.09 * boltPulse;
          reloadShiftZ -= 0.016 * boltPulse;
        }
      }
    }

    // 7b. Procedural Multi-Angle Weapon Inspect Showcase (Hold I)
    let inspectX = 0;
    let inspectY = 0;
    let inspectZ = 0;
    let inspectRotX = 0;
    let inspectRotY = 0;
    let inspectRotZ = 0;
    if (this.inspectBlend > 0.001 && !reloading) {
      const ib = this.inspectBlend;
      const cycle = this.inspectPhase % 7.2;

      // Smooth 4-stage multi-angle inspection cycle:
      // Stage A (0.0 -> 2.1s): Left-receiver, optic markings & tactical watch tilt
      // Stage B (2.1 -> 4.3s): Right-side ejection port & chamber brass press-check
      // Stage C (4.3 -> 5.8s): Elevated underside magwell, curved PMAG & barrel profile
      // Stage D (5.8 -> 7.2s): Top Picatinny rail & sightline return sweep
      let poseX = 0;
      let poseY = 0;
      let poseZ = 0;
      let poseRX = 0;
      let poseRY = 0;
      let poseRZ = 0;

      if (cycle < 2.1) {
        const k = this.smoothRange(cycle, 0.0, 0.85);
        const drift = Math.sin(cycle * 1.4) * 0.04;
        poseX = THREE.MathUtils.lerp(-0.155, -0.185, k);
        poseY = THREE.MathUtils.lerp(0.085, 0.118, k);
        poseZ = THREE.MathUtils.lerp(0.045, 0.068, k);
        poseRX = 0.11 + drift;
        poseRY = 0.34 + 0.06 * k;
        poseRZ = 0.56 + 0.08 * k;
      } else if (cycle < 4.3) {
        const flipK = this.smoothRange(cycle, 2.1, 2.75);
        const holdDrift = Math.sin((cycle - 2.1) * 1.6) * 0.035;
        poseX = THREE.MathUtils.lerp(-0.185, -0.115, flipK);
        poseY = THREE.MathUtils.lerp(0.118, 0.105, flipK);
        poseZ = THREE.MathUtils.lerp(0.068, 0.075, flipK);
        poseRX = THREE.MathUtils.lerp(0.11, 0.07, flipK) + holdDrift;
        poseRY = THREE.MathUtils.lerp(0.4, -0.44, flipK);
        poseRZ = THREE.MathUtils.lerp(0.64, -0.72, flipK);

        // Realistic brass chamber press-check peek on right-side inspection
        const pressCheck = this.bellPulse(cycle, 2.8, 3.22, 3.68);
        if (this.activeWeapon === 'carbine' && !carbineEmptyLock) {
          carbineBoltZ = Math.max(carbineBoltZ, pressCheck * 0.034 * ib);
        } else if (this.activeWeapon === 'railpistol') {
          railBoltZ = Math.max(railBoltZ, pressCheck * 0.042 * ib);
        }
        // Left hand shifts subtly rearward during press-check
        armOffsetZ += pressCheck * 0.075 * ib;
        armOffsetY += pressCheck * 0.025 * ib;
        armRotZ += pressCheck * 0.12 * ib;
      } else if (cycle < 5.8) {
        const k = this.smoothRange(cycle, 4.3, 4.95);
        poseX = THREE.MathUtils.lerp(-0.115, -0.195, k);
        poseY = THREE.MathUtils.lerp(0.105, 0.135, k);
        poseZ = THREE.MathUtils.lerp(0.075, 0.048, k);
        poseRX = THREE.MathUtils.lerp(0.07, 0.28, k);
        poseRY = THREE.MathUtils.lerp(-0.44, 0.52, k);
        poseRZ = THREE.MathUtils.lerp(-0.72, 0.24, k);
      } else {
        const k = this.smoothRange(cycle, 5.8, 7.2);
        poseX = THREE.MathUtils.lerp(-0.195, -0.155, k);
        poseY = THREE.MathUtils.lerp(0.135, 0.085, k);
        poseZ = THREE.MathUtils.lerp(0.048, 0.045, k);
        poseRX = THREE.MathUtils.lerp(0.28, 0.11, k);
        poseRY = THREE.MathUtils.lerp(0.52, 0.34, k);
        poseRZ = THREE.MathUtils.lerp(0.24, 0.56, k);
      }

      // Slight length adjustment for longer K-9 Sniper profile
      const sniperZBias = this.activeWeapon === 'railpistol' ? -0.022 : 0;
      const idleFloatY = Math.sin(this.inspectPhase * 1.9) * 0.0055;
      inspectX = poseX * ib;
      inspectY = (poseY + idleFloatY) * ib;
      inspectZ = (poseZ + sniperZBias) * ib;
      inspectRotX = (poseRX + this.inspectTiltY) * ib;
      inspectRotY = (poseRY + this.inspectTiltX) * ib;
      inspectRotZ = (poseRZ - this.inspectTiltX * 0.35) * ib;
    }

    // Apply bolt, slide, magazine & weapon-specific animated sub-parts
    this.carbineBolt.position.z = carbineBoltZ;
    if (this.activeSlide) this.activeSlide.position.z = slidePullZ;
    this.railBolt.position.z = railBoltZ;

    this.carbineMag.position.set(magOffsetX, -0.056 + magOffsetY, -0.088 + magOffsetZ);
    this.carbineMag.rotation.set(magRotX, 0, magRotZ);
    this.railMag.position.y = -0.095 + magOffsetY * 0.9;

    this.carbineLeftArm.position.set(
      this.leftArmRestPos.x + armOffsetX,
      this.leftArmRestPos.y + armOffsetY,
      this.leftArmRestPos.z + armOffsetZ,
    );
    this.carbineLeftArm.rotation.set(
      this.leftArmRestRot.x + armRotX,
      this.leftArmRestRot.y + armRotY,
      this.leftArmRestRot.z + armRotZ,
    );
    this.railLeftArm.position.set(
      this.leftArmRestPos.x + armOffsetX,
      this.leftArmRestPos.y + armOffsetY,
      this.leftArmRestPos.z + armOffsetZ,
    );

    const equipment = this.equipmentModels.get(this.equippedWeapon);
    if (equipment) {
      const mag = equipment.getObjectByName('mag');
      if (mag) {
        mag.position.set(magOffsetX, magOffsetY, magOffsetZ);
        mag.rotation.set(magRotX, 0, magRotZ);
      }
      const ch = equipment.getObjectByName('chargingHandle');
      if (ch) ch.position.set(0, chOffsetY, chOffsetZ);
      const pump = equipment.getObjectByName('pump');
      if (pump) pump.position.set(0, 0, pumpOffsetZ);
      const topCover = equipment.getObjectByName('topCover');
      if (topCover) topCover.rotation.x = lmgCoverRotX;
      const belt = equipment.getObjectByName('ammoBelt');
      if (belt) belt.position.set(0, lmgBeltOffsetY, 0);
      const warhead = equipment.getObjectByName('warhead');
      if (warhead) {
        warhead.visible = rpgWarheadVisible;
        warhead.position.set(0, rpgWarheadY, rpgWarheadZ);
      }
      const drum = equipment.getObjectByName('drum');
      if (drum) drum.rotation.z = glDrumRotZ;
      const drumRound = equipment.getObjectByName('drumRound');
      if (drumRound) drumRound.visible = glDrumRoundVisible;
    }
    const support = equipment?.userData.supportHand as THREE.Group | undefined;
    if (support) {
      support.position.set(armOffsetX, armOffsetY, armOffsetZ);
      support.rotation.set(armRotX, armRotY, armRotZ);
      const handRound = support.userData.reloadRound as THREE.Object3D | undefined;
      if (handRound) handRound.visible = glHandRoundVisible;
    }

    // 8. Compose Custom Camera-Space Stances per Weapon Class (Hip / ADS / Sprint / Crouch / Inspect)
    const ew = this.equippedWeapon;
    const isPistol = ew === 'usp' || ew === 'glock' || ew === 'deagle';
    const baseHip = isPistol
      ? this.hipPosPistol
      : ew === 'machinegun' || ew === 'rpg' || ew === 'grenadelauncher'
        ? this.hipPosHeavy
        : this.activeWeapon === 'carbine'
          ? this.hipPosCarbine
          : this.hipPosRail;
    const hipPos = baseHip.clone();
    if (isPistol) {
      hipPos.y += 0.045;
      hipPos.x -= 0.018;
    } else if (ew === 'machinegun' || ew === 'rpg' || ew === 'grenadelauncher') {
      hipPos.y += 0.062;
      hipPos.x -= 0.022;
    }
    const adsPos = isPistol
      ? this.adsPosPistol
      : ew === 'marksman'
        ? this.adsPosMarksman
        : ew === 'railpistol'
          ? this.adsPosRail
          : ew === 'carbine'
            ? this.adsPosCarbine
            : ew === 'machinegun'
              ? new THREE.Vector3(0, -0.11, -0.15)
              : ew === 'smg'
                ? this.adsPosRail
                : this.adsPosIron;
    const hipRot = this.activeWeapon === 'carbine' ? this.hipRotCarbine : this.hipRotRail;
    const adsRot = this.activeWeapon === 'carbine' ? this.adsRotCarbine : this.adsRotRail;

    const sprintX = -0.048 * this.sprintBlend;
    const sprintY = -0.042 * this.sprintBlend;
    const sprintZ = 0.028 * this.sprintBlend;
    const sprintRotX = -0.15 * this.sprintBlend;
    const sprintRotY = 0.36 * this.sprintBlend;
    const sprintRotZ = 0.24 * this.sprintBlend;

    const crouchX = -0.012 * this.crouchBlend * (1 - this.currentAds) * (1 - this.inspectBlend);
    const crouchY = -0.008 * this.crouchBlend * (1 - this.currentAds) * (1 - this.inspectBlend);
    const crouchRoll = 0.06 * this.crouchBlend * (1 - this.currentAds) * (1 - this.inspectBlend);

    const px =
      THREE.MathUtils.lerp(hipPos.x, adsPos.x, this.currentAds) +
      sprintX +
      crouchX +
      bobX +
      this.lookSwayX +
      reloadShiftX +
      inspectX +
      this.flinchX;
    const py =
      THREE.MathUtils.lerp(hipPos.y, adsPos.y, this.currentAds) +
      sprintY +
      crouchY +
      bobY +
      this.lookSwayY +
      reloadShiftY +
      inspectY +
      this.flinchY +
      this.landDip -
      this.swapBlend * 0.24;
    const pz =
      THREE.MathUtils.lerp(hipPos.z, adsPos.z, this.currentAds) +
      sprintZ +
      this.recoilZ +
      reloadShiftZ +
      inspectZ +
      this.flinchZ;

    this.weaponPivot.position.set(px, py, pz);
    this.weaponPivot.rotation.set(
      THREE.MathUtils.lerp(hipRot.x, adsRot.x, this.currentAds) +
        sprintRotX +
        this.recoilPitch +
        reloadRotX +
        inspectRotX +
        this.flinchPitch +
        this.landDip * 1.15 -
        this.swapBlend * 0.42 +
        this.lookSwayY * 1.15,
      THREE.MathUtils.lerp(hipRot.y, adsRot.y, this.currentAds) +
        sprintRotY +
        reloadRotY +
        inspectRotY +
        this.lookSwayX * 1.25,
      THREE.MathUtils.lerp(hipRot.z, adsRot.z, this.currentAds) +
        sprintRotZ +
        crouchRoll +
        bobRoll +
        reloadRotZ +
        inspectRotZ +
        this.flinchRoll -
        this.lookSwayX * 1.1,
    );
  }

  public dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
