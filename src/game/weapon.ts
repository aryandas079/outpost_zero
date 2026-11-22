import * as THREE from 'three';
import { craftedBox, batchDecoration } from './geometry';
import { ProceduralTextures } from './textures';
import { WeaponId } from './types';

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
  private recoilZ = 0;
  private recoilPitch = 0;
  private recoilVelZ = 0;
  private recoilVelPitch = 0;
  private boltKick = 0;
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

  // Authentic tactical FPS framing matching reference: authoritative foreground dark rifle & gloved support hand
  private readonly hipPosCarbine = new THREE.Vector3(0.188, -0.205, -0.305);
  private readonly hipRotCarbine = new THREE.Euler(0.018, 0.105, -0.03);
  // True look-through holographic optic ADS alignment (reticle centered at y = 0.156)
  private readonly adsPosCarbine = new THREE.Vector3(0.0, -0.156, -0.215);
  private readonly adsRotCarbine = new THREE.Euler(0.0, 0.0, 0.0);

  // Precision Scoped Sniper Rifle (Slot 2) — raises smoothly into full optical scope overlay
  private readonly hipPosRail = new THREE.Vector3(0.198, -0.212, -0.315);
  private readonly hipRotRail = new THREE.Euler(0.016, 0.098, -0.028);
  // Scope optical axis aligned cleanly with camera center before seamless optical lens handoff
  private readonly adsPosRail = new THREE.Vector3(0.0, -0.154, -0.175);
  private readonly adsRotRail = new THREE.Euler(0.0, 0.0, 0.0);

  private readonly leftArmRestPos = new THREE.Vector3(0, 0, 0);
  private readonly leftArmRestRot = new THREE.Euler(0, 0, 0);

  constructor(textures: ProceduralTextures) {
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
        map: textures.gunFdeColor,
        roughnessMap: textures.gunFdeRoughness,
        normalMap: textures.gunFdeNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: 0x3b4046,
        roughness: 0.58,
        metalness: 0.44,
        clearcoat: 0.06,
        clearcoatRoughness: 0.54,
      }),
    );

    const wornGunmetalMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        map: textures.gunMetalColor,
        roughnessMap: textures.gunMetalRoughness,
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        color: 0x545b64,
        roughness: 0.42,
        metalness: 0.86,
        clearcoat: 0.12,
        clearcoatRoughness: 0.44,
      }),
    );

    const anodizedBlackMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.gunMetalColor,
        roughnessMap: textures.gunMetalRoughness,
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.42, 0.42),
        color: 0x262a30,
        roughness: 0.52,
        metalness: 0.76,
      }),
    );

    const scopeMatteBodyMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.gunMetalColor,
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

    // High-resolution etched mil-dot sniper scope glass reticle (Image 1!)
    this.scopeLensMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.scopeLensReticle,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    const sleeveMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.tacticalSleeveColor,
        bumpMap: textures.tacticalSleeveBump,
        bumpScale: 0.004,
        color: 0x42474c,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );

    const humanSkinMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        map: textures.humanSkinColor,
        normalMap: textures.humanSkinNormal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        color: 0xf4e4d8,
        roughness: 0.62,
        metalness: 0.0,
        sheen: 0.22,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(0xd99b82),
      }),
    );

    const fingernailMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd8b29e,
        roughness: 0.34,
        metalness: 0.03,
      }),
    );

    const watchStrapMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1d2024,
        roughness: 0.72,
        metalness: 0.16,
      }),
    );

    const watchBezelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2a2e34,
        roughness: 0.38,
        metalness: 0.78,
      }),
    );

    const watchFaceMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b0f13,
        roughness: 0.14,
        metalness: 0.25,
      }),
    );

    const brutalistGloveMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.tacticalGloveColor,
        normalMap: textures.tacticalGloveNormal,
        normalScale: new THREE.Vector2(0.75, 0.75),
        color: 0x3b3f44,
        roughness: 0.82,
        metalness: 0.1,
      }),
    );

    const brutalistArmorMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        normalMap: textures.gunMetalNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        color: 0x1c2026,
        roughness: 0.44,
        metalness: 0.52,
        clearcoat: 0.16,
        clearcoatRoughness: 0.48,
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
    // 1. M13-MOD2 BATTLE-WORN TACTICAL CARBINE + HOLO SIGHT & BUIS (Image 2!)
    // =========================================================================
    this.carbineGroup = new THREE.Group();

    // Sculpted beveled multi-faceted FDE upper receiver
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
        bevelSegments: 2,
      }),
    );
    receiverGeo.translate(0, 0, -0.21);
    scaleExtrudeUVs(receiverGeo, 2.8);
    const upperReceiver = new THREE.Mesh(receiverGeo, fdeCerakoteMat);
    upperReceiver.position.set(0, 0.004, 0.045);
    this.carbineGroup.add(upperReceiver);

    // Lower receiver chassis with flared magwell & matte steel trim
    const lowerReceiver = new THREE.Mesh(trackGeo(craftedBox(0.056, 0.052, 0.34)), fdeCerakoteMat);
    lowerReceiver.position.set(0, -0.04, 0.03);
    this.carbineGroup.add(lowerReceiver);

    const magWell = new THREE.Mesh(trackGeo(craftedBox(0.062, 0.048, 0.095)), anodizedBlackMat);
    magWell.position.set(0, -0.056, -0.088);
    this.carbineGroup.add(magWell);

    // Rear buffer tube & tactical adjustable crane buttstock extending into shoulder
    const bufferTube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.023, 0.24, 14)), anodizedBlackMat);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.012, 0.36);
    this.carbineGroup.add(bufferTube);

    const rearStock = new THREE.Mesh(trackGeo(craftedBox(0.052, 0.082, 0.2)), fdeCerakoteMat);
    rearStock.position.set(0, -0.012, 0.39);
    rearStock.rotation.x = -0.06;
    this.carbineGroup.add(rearStock);

    // Rear T-handle charging latch perched right behind the rear BUIS (matches Image 2 foreground!)
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

    const brassDeflector = new THREE.Mesh(trackGeo(craftedBox(0.018, 0.022, 0.024)), fdeCerakoteMat);
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
        bevelSegments: 2,
      }),
    );
    handguardGeo.translate(0, 0, -0.155);
    scaleExtrudeUVs(handguardGeo, 2.8);
    const handguard = new THREE.Mesh(handguardGeo, fdeCerakoteMat);
    handguard.position.set(0, 0.008, -0.32);
    this.carbineGroup.add(handguard);

    // Dark recessed M-LOK ventilation slots along both sides of handguard
    const ventSlotGeo = trackGeo(craftedBox(0.004, 0.009, 0.044));
    for (let i = 0; i < 4; i++) {
      const vz = -0.215 - i * 0.062;
      const vl = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      vl.position.set(-0.0335, 0.008, vz);
      const vr = new THREE.Mesh(ventSlotGeo, bluedBarrelMat);
      vr.position.set(0.0335, 0.008, vz);
      this.carbineGroup.add(vl, vr);
    }

    // Crisp Full-Length Machined 1913 Picatinny Top Rail (prominent specular highlights like Image 2!)
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
    // DETAILED REAR FLIP-UP BACKUP IRON SIGHT (BUIS) — Foreground Image 2 Detail!
    // =========================================================================
    const buisGroup = new THREE.Group();
    buisGroup.position.set(0, 0.062, 0.145);
    this.carbineGroup.add(buisGroup);

    const buisBase = new THREE.Mesh(trackGeo(craftedBox(0.042, 0.018, 0.062)), fdeCerakoteMat);
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

    // Knurled side windage adjustment knob (matches right/left metallic dial in Image 2!)
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

    // Side-mounted AN/PEQ-15 Tactical Laser Illuminator Module + top-rail pressure switch & cable
    const peqBody = new THREE.Mesh(trackGeo(craftedBox(0.038, 0.024, 0.088)), fdeCerakoteMat);
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

    // Lathe-turned Heavy Steel Barrel + Multi-Port Tactical Compensator Muzzle Brake
    const barrelPts = [
      new THREE.Vector2(0.0125, 0.0),
      new THREE.Vector2(0.0125, 0.13),
      new THREE.Vector2(0.016, 0.145),
      new THREE.Vector2(0.016, 0.175),
      new THREE.Vector2(0.019, 0.185),
      new THREE.Vector2(0.019, 0.245),
      new THREE.Vector2(0.0145, 0.255),
      new THREE.Vector2(0.0095, 0.255),
    ];
    const barrelGeo = trackGeo(new THREE.LatheGeometry(barrelPts, 16));
    barrelGeo.rotateX(-Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, bluedBarrelMat);
    barrel.position.set(0, 0.008, -0.46);
    this.carbineGroup.add(barrel);

    // Machined side compensator gas ports
    for (const pz of [-0.665, -0.688]) {
      const port = new THREE.Mesh(trackGeo(craftedBox(0.04, 0.01, 0.011)), rubberMat);
      port.position.set(0, 0.008, pz);
      this.carbineGroup.add(port);
    }

    // Low-profile folded front iron sight post
    const frontSightBase = new THREE.Mesh(trackGeo(craftedBox(0.022, 0.014, 0.034)), anodizedBlackMat);
    frontSightBase.position.set(0, 0.064, -0.465);
    this.carbineGroup.add(frontSightBase);

    // Ergonomic Stippled Pistol Grip & Curved Ribbed Tactical PMAG with Brass Cartridge Window
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
    this.carbineMag = new THREE.Mesh(magGeo, fdeCerakoteMat);
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

    // =========================================================================
    // FIRST-PERSON REAL ANATOMICAL BRUTALIST-TACTICAL HANDS & SLEEVES
    // =========================================================================
    this.carbineLeftArm = this.buildTacticalLeftArm(
      trackGeo,
      sleeveMat,
      humanSkinMat,
      fingernailMat,
      watchStrapMat,
      watchBezelMat,
      watchFaceMat,
      brutalistGloveMat,
      brutalistArmorMat,
    );
    this.carbineLeftArm.position.copy(this.leftArmRestPos);
    this.carbineLeftArm.rotation.copy(this.leftArmRestRot);
    this.carbineGroup.add(this.carbineLeftArm);

    const rightArm = this.buildTacticalRightArm(
      trackGeo,
      sleeveMat,
      humanSkinMat,
      fingernailMat,
      brutalistGloveMat,
      brutalistArmorMat,
    );
    this.carbineGroup.add(rightArm);

    this.weaponPivot.add(this.carbineGroup);

    // =========================================================================
    // 2. K-9 PRECISION MARKSMAN RIFLE + OPTICAL MIL-DOT SCOPE (Image 1!)
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
    // AUTHENTIC PRECISION VARIABLE-POWER OPTICAL SCOPE (Matches Image 1!)
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

    // Thick Matte-Black Rubberized Ocular Eyepiece Bezel Ring (creates the signature circular frame of Image 1!)
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

    // Protruding Knurled Elevation Turret (top) & Parallax/Windage Turrets (sides — visible in Image 1!)
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

    // Real anatomical operator hands for marksman rifle
    this.railLeftArm = this.buildTacticalLeftArm(
      trackGeo,
      sleeveMat,
      humanSkinMat,
      fingernailMat,
      watchStrapMat,
      watchBezelMat,
      watchFaceMat,
      brutalistGloveMat,
      brutalistArmorMat,
    );
    this.railLeftArm.position.copy(this.leftArmRestPos);
    this.railLeftArm.rotation.copy(this.leftArmRestRot);
    this.railGroup.add(this.railLeftArm);

    const railRightArm = this.buildTacticalRightArm(
      trackGeo,
      sleeveMat,
      humanSkinMat,
      fingernailMat,
      brutalistGloveMat,
      brutalistArmorMat,
    );
    this.railGroup.add(railRightArm);

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

  /**
   * Builds a smooth, continuous, rotation-minimizing elliptical loft along a 3D spline
   * with organic hemispherical dome end-caps (zero flat cylinder circles or seam gaps).
   */
  private buildLoftedLimb(
    points: THREE.Vector3[],
    radii: Array<[number, number]>,
    radialSegs = 16,
    tubularSegs = 18,
    capStart = true,
    capEnd = true,
    refUp = new THREE.Vector3(0, 1, 0),
  ): THREE.BufferGeometry {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);

    const sampleRadius = (t: number): [number, number] => {
      const scaled = THREE.MathUtils.clamp(t, 0, 1) * (radii.length - 1);
      const idx = Math.min(radii.length - 2, Math.floor(scaled));
      const frac = scaled - idx;
      // Smoothstep interpolation for natural anatomical taper
      const s = frac * frac * (3 - 2 * frac);
      return [
        THREE.MathUtils.lerp(radii[idx][0], radii[idx + 1][0], s),
        THREE.MathUtils.lerp(radii[idx][1], radii[idx + 1][1], s),
      ];
    };

    interface RingSpec {
      center: THREE.Vector3;
      N: THREE.Vector3;
      B: THREE.Vector3;
      rN: number;
      rB: number;
      v: number;
    }

    // 1. Sample backbone frames with parallel transport to avoid twisting
    const coreCenters: THREE.Vector3[] = [];
    const coreTangents: THREE.Vector3[] = [];
    const coreNormals: THREE.Vector3[] = [];
    const coreBinormals: THREE.Vector3[] = [];
    const coreRadii: Array<[number, number]> = [];
    const q = new THREE.Quaternion();

    for (let i = 0; i <= tubularSegs; i++) {
      const t = i / tubularSegs;
      const p = curve.getPoint(t);
      const T = curve.getTangent(t).normalize();
      let N: THREE.Vector3;

      if (i === 0) {
        const hint = Math.abs(T.dot(refUp)) > 0.92 ? new THREE.Vector3(1, 0, 0) : refUp.clone();
        N = hint.addScaledVector(T, -hint.dot(T)).normalize();
      } else {
        q.setFromUnitVectors(coreTangents[i - 1], T);
        N = coreNormals[i - 1].clone().applyQuaternion(q);
        N.addScaledVector(T, -N.dot(T)).normalize();
      }
      const B = new THREE.Vector3().crossVectors(T, N).normalize();

      coreCenters.push(p);
      coreTangents.push(T);
      coreNormals.push(N);
      coreBinormals.push(B);
      coreRadii.push(sampleRadius(t));
    }

    // 2. Assemble ring sequence including smooth hemispherical dome caps
    const rings: RingSpec[] = [];
    const capSteps = 3;

    if (capStart) {
      const c0 = coreCenters[0];
      const T0 = coreTangents[0];
      const N0 = coreNormals[0];
      const B0 = coreBinormals[0];
      const [rN0, rB0] = coreRadii[0];
      const domeDepth = (rN0 + rB0) * 0.46;
      for (let k = capSteps; k >= 1; k--) {
        const phi = (k / capSteps) * (Math.PI * 0.495);
        const radialScale = Math.cos(phi);
        const axialOff = Math.sin(phi) * domeDepth;
        rings.push({
          center: c0.clone().addScaledVector(T0, -axialOff),
          N: N0,
          B: B0,
          rN: Math.max(0.0002, rN0 * radialScale),
          rB: Math.max(0.0002, rB0 * radialScale),
          v: 0,
        });
      }
    }

    for (let i = 0; i <= tubularSegs; i++) {
      rings.push({
        center: coreCenters[i],
        N: coreNormals[i],
        B: coreBinormals[i],
        rN: coreRadii[i][0],
        rB: coreRadii[i][1],
        v: i / tubularSegs,
      });
    }

    if (capEnd) {
      const last = tubularSegs;
      const c1 = coreCenters[last];
      const T1 = coreTangents[last];
      const N1 = coreNormals[last];
      const B1 = coreBinormals[last];
      const [rN1, rB1] = coreRadii[last];
      const domeDepth = (rN1 + rB1) * 0.48;
      for (let k = 1; k <= capSteps; k++) {
        const phi = (k / capSteps) * (Math.PI * 0.495);
        const radialScale = Math.cos(phi);
        const axialOff = Math.sin(phi) * domeDepth;
        rings.push({
          center: c1.clone().addScaledVector(T1, axialOff),
          N: N1,
          B: B1,
          rN: Math.max(0.0002, rN1 * radialScale),
          rB: Math.max(0.0002, rB1 * radialScale),
          v: 1,
        });
      }
    }

    // 3. Emit indexed vertices & outward-facing triangles
    const stride = radialSegs + 1;
    const positions = new Float32Array(rings.length * stride * 3);
    const uvs = new Float32Array(rings.length * stride * 2);
    const indices: number[] = [];

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      for (let j = 0; j <= radialSegs; j++) {
        const u = j / radialSegs;
        const theta = u * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const vx = ring.center.x + cosT * ring.rN * ring.N.x + sinT * ring.rB * ring.B.x;
        const vy = ring.center.y + cosT * ring.rN * ring.N.y + sinT * ring.rB * ring.B.y;
        const vz = ring.center.z + cosT * ring.rN * ring.N.z + sinT * ring.rB * ring.B.z;

        const vIdx = i * stride + j;
        positions[vIdx * 3] = vx;
        positions[vIdx * 3 + 1] = vy;
        positions[vIdx * 3 + 2] = vz;

        uvs[vIdx * 2] = u;
        uvs[vIdx * 2 + 1] = ring.v;
      }
    }

    for (let i = 0; i < rings.length - 1; i++) {
      const row0 = i * stride;
      const row1 = (i + 1) * stride;
      for (let j = 0; j < radialSegs; j++) {
        const a = row0 + j;
        const b = row0 + j + 1;
        const c = row1 + j;
        const d = row1 + j + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildTacticalLeftArm(
    trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
    sleeveMat: THREE.Material,
    skinMat: THREE.Material,
    fingernailMat: THREE.Material,
    watchStrapMat: THREE.Material,
    watchBezelMat: THREE.Material,
    watchFaceMat: THREE.Material,
    brutalistGloveMat: THREE.Material,
    brutalistArmorMat: THREE.Material,
  ): THREE.Group {
    const group = new THREE.Group();

    // 1. Continuous Olive-Charcoal Ripstop Combat Sleeve with folded cuff lip
    const sleeveGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(-0.31, -0.31, 0.23),
          new THREE.Vector3(-0.21, -0.205, 0.045),
          new THREE.Vector3(-0.132, -0.122, -0.092),
          new THREE.Vector3(-0.09, -0.08, -0.152),
          new THREE.Vector3(-0.082, -0.072, -0.162),
        ],
        [
          [0.056, 0.052],
          [0.049, 0.045],
          [0.041, 0.039],
          [0.043, 0.041],
          [0.029, 0.027],
        ],
        20,
        24,
        false,
        false,
      ),
    );
    group.add(new THREE.Mesh(sleeveGeo, sleeveMat));

    // 2. Rugged Brutalist Tactical Field Watch encircling the bare wrist ahead of the cuff
    const watchGroup = new THREE.Group();
    watchGroup.position.set(-0.077, -0.067, -0.172);
    watchGroup.lookAt(-0.048, -0.032, -0.258);
    const strap = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.0252, 0.0044, 10, 22)), watchStrapMat);
    strap.scale.set(0.92, 1.08, 1.0);
    watchGroup.add(strap);
    const watchCase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0135, 0.014, 0.0068, 16)), watchBezelMat);
    watchCase.rotation.z = Math.PI / 2;
    watchCase.position.set(-0.0245, 0.004, 0.0);
    watchGroup.add(watchCase);
    const watchDial = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.0105, 0.0105, 0.0074, 16)), watchFaceMat);
    watchDial.rotation.z = Math.PI / 2;
    watchDial.position.set(-0.025, 0.004, 0.0);
    watchGroup.add(watchDial);
    group.add(watchGroup);

    // 3. Continuous Seamless Bare Human Forearm/Wrist -> Sculpted Anatomical Palm & Metacarpals
    // Tucked 3 cm INSIDE the sleeve so zero seam gap or cylinder cap can ever appear!
    const wristHandGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(-0.102, -0.092, -0.132),
          new THREE.Vector3(-0.075, -0.065, -0.176),
          new THREE.Vector3(-0.058, -0.046, -0.214),
          new THREE.Vector3(-0.048, -0.032, -0.246),
          new THREE.Vector3(-0.044, -0.025, -0.278),
          new THREE.Vector3(-0.04, -0.023, -0.302),
        ],
        [
          [0.029, 0.025],
          [0.0245, 0.0195],
          [0.031, 0.018],
          [0.036, 0.017],
          [0.037, 0.016],
          [0.031, 0.014],
        ],
        22,
        26,
        false,
        true,
      ),
    );
    group.add(new THREE.Mesh(wristHandGeo, skinMat));

    // Subtle ulna wrist bone bump & dorsal metacarpal extensor tendons along the bare wrist/back of hand
    const ulnaBump = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.0068, 10, 8)), skinMat);
    ulnaBump.scale.set(0.75, 0.85, 1.35);
    ulnaBump.position.set(-0.088, -0.072, -0.184);
    group.add(ulnaBump);

    for (let t = 0; t < 3; t++) {
      const tendonGeo = trackGeo(
        this.buildLoftedLimb(
          [
            new THREE.Vector3(-0.078, -0.06 + t * 0.004, -0.188),
            new THREE.Vector3(-0.064, -0.044 + t * 0.005, -0.228),
            new THREE.Vector3(-0.057, -0.028 + t * 0.004, -0.268),
          ],
          [
            [0.0024, 0.0018],
            [0.0028, 0.0022],
            [0.0024, 0.0018],
          ],
          8,
          10,
          true,
          true,
        ),
      );
      group.add(new THREE.Mesh(tendonGeo, skinMat));
    }

    // 4. Brutalist Fingerless Tactical Half-Glove Wrap & Faceted Carbon Knuckle Shell
    // Leaves wrist, thumb, and articulated bare human fingers exposed while fitting the brutalist aesthetic!
    const halfGloveGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(-0.062, -0.05, -0.206),
          new THREE.Vector3(-0.05, -0.034, -0.244),
          new THREE.Vector3(-0.044, -0.026, -0.278),
          new THREE.Vector3(-0.041, -0.024, -0.294),
        ],
        [
          [0.0295, 0.0195],
          [0.0372, 0.0188],
          [0.0384, 0.018],
          [0.0335, 0.0162],
        ],
        20,
        14,
        false,
        false,
      ),
    );
    group.add(new THREE.Mesh(halfGloveGeo, brutalistGloveMat));

    // Matte Velcro wrist cinch band at proximal edge of half-glove
    const gloveCinch = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.0265, 0.0038, 8, 18)), brutalistArmorMat);
    gloveCinch.position.set(-0.062, -0.05, -0.206);
    gloveCinch.lookAt(-0.044, -0.026, -0.278);
    gloveCinch.scale.set(0.84, 1.15, 1.0);
    group.add(gloveCinch);

    // Beveled Brutalist Carbon-Composite Knuckle Armor Plate across dorsal MCP bridge
    const knucklePlateShape = new THREE.Shape();
    knucklePlateShape.moveTo(-0.034, -0.014);
    knucklePlateShape.lineTo(0.034, -0.012);
    knucklePlateShape.lineTo(0.038, 0.006);
    knucklePlateShape.lineTo(0.024, 0.016);
    knucklePlateShape.lineTo(-0.024, 0.016);
    knucklePlateShape.lineTo(-0.038, 0.004);
    knucklePlateShape.closePath();
    const knucklePlateGeo = trackGeo(
      new THREE.ExtrudeGeometry(knucklePlateShape, {
        depth: 0.007,
        bevelEnabled: true,
        bevelThickness: 0.0022,
        bevelSize: 0.002,
        bevelSegments: 2,
      }),
    );
    knucklePlateGeo.rotateY(-Math.PI / 2);
    const knucklePlate = new THREE.Mesh(knucklePlateGeo, brutalistArmorMat);
    knucklePlate.position.set(-0.059, -0.026, -0.274);
    knucklePlate.rotation.set(0.06, 0.16, -0.14);
    group.add(knucklePlate);

    // 5. Sculpted Thenar Muscle (Thumb Base Pad) & First Interosseous Thumb-Index Webbing
    const thenarGeo = trackGeo(new THREE.SphereGeometry(1, 14, 12));
    const thenarPad = new THREE.Mesh(thenarGeo, skinMat);
    thenarPad.scale.set(0.0165, 0.022, 0.029);
    thenarPad.position.set(-0.047, -0.01, -0.236);
    thenarPad.rotation.set(0.35, 0.22, -0.24);
    group.add(thenarPad);

    const thumbWeb = new THREE.Mesh(thenarGeo, skinMat);
    thumbWeb.scale.set(0.011, 0.015, 0.022);
    thumbWeb.position.set(-0.043, 0.003, -0.27);
    thumbWeb.rotation.set(0.45, 0.15, -0.18);
    group.add(thumbWeb);

    // 6. Articulated Bare Human Thumb (7-Station Anatomical Joint Profile + Curved Thumbnail)
    const thumbGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(-0.051, -0.014, -0.224), // CMC base inside thenar
          new THREE.Vector3(-0.048, 0.002, -0.246), // Proximal shaft
          new THREE.Vector3(-0.045, 0.014, -0.268), // MCP joint swell
          new THREE.Vector3(-0.041, 0.024, -0.288), // IP knuckle joint swell
          new THREE.Vector3(-0.037, 0.03, -0.305), // Distal phalanx
          new THREE.Vector3(-0.0345, 0.032, -0.318), // Rounded thumb pad
        ],
        [
          [0.0148, 0.0138],
          [0.0118, 0.011],
          [0.0124, 0.0116], // subtle anatomical knuckle swell
          [0.0108, 0.0102], // IP joint swell
          [0.0092, 0.0082],
          [0.0082, 0.0068],
        ],
        16,
        20,
        true,
        true,
      ),
    );
    group.add(new THREE.Mesh(thumbGeo, skinMat));

    // Natural curved thumbnail nestled on top of distal thumb phalanx
    const thumbNail = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 10, 8)), fingernailMat);
    thumbNail.scale.set(0.0046, 0.0022, 0.0078);
    thumbNail.position.set(-0.038, 0.0362, -0.312);
    thumbNail.rotation.set(-0.18, -0.16, 0.42);
    group.add(thumbNail);

    // 7. Four Anatomically Articulated Bare Human Fingers with MCP/PIP/DIP Joint Contours Wrapping Under Handguard
    const fingerSpecs: Array<{
      z: number;
      yOff: number;
      rBase: number;
      rPip: number;
      rDip: number;
      rTip: number;
      curlReach: number;
    }> = [
      { z: -0.298, yOff: 0.0, rBase: 0.0094, rPip: 0.009, rDip: 0.0079, rTip: 0.0066, curlReach: 0.033 }, // Index
      { z: -0.28, yOff: -0.001, rBase: 0.0098, rPip: 0.0093, rDip: 0.0082, rTip: 0.0069, curlReach: 0.035 }, // Middle
      { z: -0.262, yOff: -0.002, rBase: 0.0089, rPip: 0.0084, rDip: 0.0074, rTip: 0.0062, curlReach: 0.032 }, // Ring
      { z: -0.245, yOff: -0.0035, rBase: 0.0078, rPip: 0.0073, rDip: 0.0065, rTip: 0.0054, curlReach: 0.026 }, // Pinky
    ];

    const knuckleGeo = trackGeo(new THREE.SphereGeometry(0.0095, 10, 10));
    for (let i = 0; i < fingerSpecs.length; i++) {
      const f = fingerSpecs[i];
      // Exposed MCP bare knuckle joint emerging cleanly from the brutalist half-glove edge
      const mcp = new THREE.Mesh(knuckleGeo, skinMat);
      const ks = f.rBase / 0.0094;
      mcp.scale.set(0.86 * ks, 0.94 * ks, 1.04 * ks);
      mcp.position.set(-0.043, -0.031 + f.yOff, f.z);
      group.add(mcp);

      // Multi-joint articulated finger loft with subtle PIP/DIP knuckle swells
      const fGeo = trackGeo(
        this.buildLoftedLimb(
          [
            new THREE.Vector3(-0.041, -0.029 + f.yOff, f.z),
            new THREE.Vector3(-0.03, -0.037 + f.yOff, f.z - 0.001),
            new THREE.Vector3(-0.015, -0.041 + f.yOff, f.z - 0.002),
            new THREE.Vector3(0.008, -0.04 + f.yOff, f.z - 0.003),
            new THREE.Vector3(0.024, -0.031 + f.yOff, f.z - 0.002),
            new THREE.Vector3(f.curlReach, -0.019 + f.yOff, f.z - 0.001),
          ],
          [
            [f.rBase, f.rBase * 0.95],
            [f.rBase * 0.92, f.rBase * 0.9],
            [f.rPip, f.rPip * 0.96], // PIP knuckle joint
            [f.rPip * 0.88, f.rPip * 0.85],
            [f.rDip, f.rDip * 0.94], // DIP knuckle joint
            [f.rTip, f.rTip * 0.88],
          ],
          14,
          18,
          true,
          true,
          new THREE.Vector3(0, 0, 1),
        ),
      );
      group.add(new THREE.Mesh(fGeo, skinMat));
    }

    return group;
  }

  private buildTacticalRightArm(
    trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
    sleeveMat: THREE.Material,
    skinMat: THREE.Material,
    fingernailMat: THREE.Material,
    brutalistGloveMat: THREE.Material,
    brutalistArmorMat: THREE.Material,
  ): THREE.Group {
    const rightArm = new THREE.Group();

    // Continuous right sleeve forearm entering from lower-right off-screen
    const rSleeveGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(0.175, -0.25, 0.44),
          new THREE.Vector3(0.105, -0.175, 0.305),
          new THREE.Vector3(0.064, -0.128, 0.212),
          new THREE.Vector3(0.056, -0.119, 0.198),
        ],
        [
          [0.052, 0.048],
          [0.044, 0.041],
          [0.039, 0.037],
          [0.028, 0.026],
        ],
        18,
        18,
        false,
        false,
      ),
    );
    rightArm.add(new THREE.Mesh(rSleeveGeo, sleeveMat));

    // Seamless bare human right wrist & contoured hand gripping the pistol grip
    const rHandGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(0.072, -0.138, 0.228),
          new THREE.Vector3(0.048, -0.112, 0.184),
          new THREE.Vector3(0.026, -0.098, 0.15),
          new THREE.Vector3(0.016, -0.095, 0.124),
        ],
        [
          [0.027, 0.023],
          [0.025, 0.02],
          [0.034, 0.019],
          [0.028, 0.017],
        ],
        18,
        18,
        false,
        true,
      ),
    );
    rightArm.add(new THREE.Mesh(rHandGeo, skinMat));

    // Matching brutalist fingerless half-glove wrap & carbon dorsal guard on right hand
    const rGloveGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(0.042, -0.108, 0.174),
          new THREE.Vector3(0.026, -0.098, 0.15),
          new THREE.Vector3(0.018, -0.095, 0.13),
        ],
        [
          [0.027, 0.021],
          [0.0355, 0.0205],
          [0.03, 0.0185],
        ],
        16,
        10,
        false,
        false,
      ),
    );
    rightArm.add(new THREE.Mesh(rGloveGeo, brutalistGloveMat));

    const rKnuckleGuard = new THREE.Mesh(trackGeo(craftedBox(0.01, 0.044, 0.026)), brutalistArmorMat);
    rKnuckleGuard.position.set(0.037, -0.096, 0.136);
    rKnuckleGuard.rotation.x = 0.26;
    rightArm.add(rKnuckleGuard);

    // Right bare thumb wrapping securely around the upper-left grip backstrap
    const rThumbGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(0.014, -0.072, 0.156),
          new THREE.Vector3(-0.008, -0.064, 0.16),
          new THREE.Vector3(-0.024, -0.066, 0.142),
        ],
        [
          [0.011, 0.0105],
          [0.0098, 0.0092],
          [0.0082, 0.0074],
        ],
        12,
        10,
        true,
        true,
      ),
    );
    rightArm.add(new THREE.Mesh(rThumbGeo, skinMat));

    // Right articulated bare trigger finger resting cleanly on the machined steel trigger
    const triggerFingerGeo = trackGeo(
      this.buildLoftedLimb(
        [
          new THREE.Vector3(0.024, -0.076, 0.134),
          new THREE.Vector3(0.026, -0.072, 0.106),
          new THREE.Vector3(0.018, -0.073, 0.084),
          new THREE.Vector3(0.004, -0.075, 0.068),
        ],
        [
          [0.0088, 0.0085],
          [0.0084, 0.0081],
          [0.0076, 0.0072],
          [0.0064, 0.0058],
        ],
        12,
        12,
        true,
        true,
      ),
    );
    rightArm.add(new THREE.Mesh(triggerFingerGeo, skinMat));

    const triggerNail = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(1, 8, 6)), fingernailMat);
    triggerNail.scale.set(0.0038, 0.0018, 0.0062);
    triggerNail.position.set(0.008, -0.072, 0.07);
    rightArm.add(triggerNail);

    // Three bare lower fingers wrapping cleanly around the pistol grip frontstrap
    for (let f = 0; f < 3; f++) {
      const yOff = -0.095 - f * 0.017;
      const zOff = 0.135 + f * 0.005;
      const gFingerGeo = trackGeo(
        this.buildLoftedLimb(
          [
            new THREE.Vector3(0.022, yOff, zOff),
            new THREE.Vector3(0.016, yOff - 0.002, zOff - 0.024),
            new THREE.Vector3(-0.016, yOff - 0.002, zOff - 0.026),
          ],
          [
            [0.0085 - f * 0.0006, 0.0082 - f * 0.0006],
            [0.0078 - f * 0.0005, 0.0076 - f * 0.0005],
            [0.0066 - f * 0.0004, 0.0062 - f * 0.0004],
          ],
          10,
          10,
          true,
          true,
          new THREE.Vector3(0, 1, 0),
        ),
      );
      rightArm.add(new THREE.Mesh(gFingerGeo, skinMat));
    }

    return rightArm;
  }

  public setWeapon(id: WeaponId) {
    if (this.activeWeapon === id) return;
    this.activeWeapon = id;
    this.swapBlend = 1;
    this.carbineGroup.visible = id === 'carbine';
    this.railGroup.visible = id === 'railpistol';
    this.muzzleFlashGroup.position.set(
      0,
      id === 'carbine' ? 0.012 : 0.014,
      id === 'carbine' ? -0.74 : -0.85,
    );
    this.muzzleLight.color.setHex(id === 'carbine' ? 0xff9d3b : 0xffb357);
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
    this.weaponPivot.visible = !hidden;
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
    const canInspect = inspecting && !ads && !reloading && !sprinting;
    this.inspectBlend = THREE.MathUtils.damp(this.inspectBlend, canInspect ? 1 : 0, canInspect ? 7.2 : 14.0, dt);
    if (canInspect) {
      this.inspectPhase += dt;
    } else if (this.inspectBlend < 0.015) {
      this.inspectPhase = 0;
      this.inspectBlend = 0;
    }

    const targetAds = ads && !reloading ? 1 : 0;
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

    if (reloading) {
      if (this.activeWeapon === 'carbine') {
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
      } else {
        // K-9 Precision Sniper: tactical vs. empty bolt-action magazine reload
        const env = Math.sin(p * Math.PI);
        reloadShiftY = -0.046 * env;
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

    // Apply bolt, magazine & articulated left arm transforms
    this.carbineBolt.position.z = carbineBoltZ;
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

    // 8. Compose Realistic Camera-Space Tactical Transform (Hip / ADS / Sprint Low-Ready / Crouch Cant / Inspect)
    const hipPos = this.activeWeapon === 'carbine' ? this.hipPosCarbine : this.hipPosRail;
    const adsPos = this.activeWeapon === 'carbine' ? this.adsPosCarbine : this.adsPosRail;
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
