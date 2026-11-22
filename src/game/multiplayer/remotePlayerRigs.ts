import * as THREE from 'three';
import { craftedBox } from '../geometry';
import { ProceduralTextures } from '../textures';
import { WeaponId, WEAPON_SPECS } from '../types';
import { PLAYER_COLORS, PlayerColorId, PlayerProfile, RemotePlayerNetworkState } from './types';

interface RemotePlayerEntity {
  profile: PlayerProfile;
  root: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  weaponGroup: THREE.Group;
  currentWeaponId: WeaponId;
  muzzleFlash: THREE.Mesh;
  muzzleFlashTimer: number;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  hitMeshes: THREE.Mesh[];
  bodyMaterials: THREE.MeshStandardMaterial[];
  visorMaterial: THREE.MeshStandardMaterial;
  nameplateSprite: THREE.Sprite;
  nameplateCanvas: HTMLCanvasElement;
  nameplateCtx: CanvasRenderingContext2D;
  nameplateTex: THREE.CanvasTexture;
  // Interpolation targets
  targetPos: THREE.Vector3;
  targetYaw: number;
  targetPitch: number;
  currentYaw: number;
  currentPitch: number;
  velocity: THREE.Vector3;
  stridePhase: number;
  crouching: boolean;
  sprinting: boolean;
  hitFlashTimer: number;
  dead: boolean;
  deathFallProgress: number; // 0..1
}

export class RemotePlayerManager {
  private readonly scene: THREE.Scene;
  private readonly textures: ProceduralTextures;
  private readonly players = new Map<string, RemotePlayerEntity>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly sharedShadowMat: THREE.MeshBasicMaterial;
  private readonly sharedFlashMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, textures: ProceduralTextures) {
    this.scene = scene;
    this.textures = textures;

    this.sharedShadowMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.55,
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

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  public addOrUpdatePlayer(profile: PlayerProfile, initialPos = new THREE.Vector3(0, 0, 0)) {
    let entity = this.players.get(profile.id);
    if (!entity) {
      entity = this.createPlayerEntity(profile, initialPos);
      this.players.set(profile.id, entity);
      this.scene.add(entity.root);
    } else {
      entity.profile = profile;
      this.updateNameplate(entity);
      if (profile.equippedWeapon && profile.equippedWeapon !== entity.currentWeaponId) {
        this.switchWeaponModel(entity, profile.equippedWeapon);
      }
    }
  }

  public removePlayer(playerId: string) {
    const entity = this.players.get(playerId);
    if (entity) {
      this.scene.remove(entity.root);
      entity.nameplateTex.dispose();
      this.players.delete(playerId);
    }
  }

  public updateNetworkState(state: RemotePlayerNetworkState) {
    const entity = this.players.get(state.id);
    if (!entity) return;

    entity.targetPos.set(state.pos[0], state.pos[1], state.pos[2]);
    entity.velocity.set(state.vel[0], state.vel[1], state.vel[2]);
    entity.targetYaw = state.yaw;
    entity.targetPitch = state.pitch;
    entity.crouching = state.crouching;
    entity.sprinting = state.sprinting;

    if (state.weaponId && state.weaponId !== entity.currentWeaponId) {
      this.switchWeaponModel(entity, state.weaponId);
    }

    if (state.alive !== !entity.dead) {
      entity.dead = !state.alive;
      if (entity.dead) {
        entity.deathFallProgress = 0;
      }
    }

    if (state.health !== entity.profile.health || state.shield !== entity.profile.shield) {
      entity.profile.health = state.health;
      entity.profile.shield = state.shield;
      this.updateNameplate(entity);
    }
  }

  public triggerShot(playerId: string, weaponId: WeaponId, muzzleOrigin?: THREE.Vector3, targetPoint?: THREE.Vector3) {
    const entity = this.players.get(playerId);
    if (!entity) return;
    entity.muzzleFlash.visible = true;
    entity.muzzleFlashTimer = 0.065;
    entity.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
  }

  public triggerDamage(playerId: string, amount: number, isHeadshot: boolean) {
    const entity = this.players.get(playerId);
    if (!entity) return;
    entity.hitFlashTimer = 0.12;
    for (const m of entity.bodyMaterials) {
      m.emissive.setHex(isHeadshot ? 0xffb703 : 0xff3333);
      m.emissiveIntensity = 0.7;
    }
  }

  public triggerKilled(playerId: string) {
    const entity = this.players.get(playerId);
    if (!entity) return;
    entity.dead = true;
    entity.deathFallProgress = 0;
    entity.weaponGroup.visible = false;
    this.updateNameplate(entity);
  }

  public triggerRespawn(playerId: string, pos: THREE.Vector3) {
    const entity = this.players.get(playerId);
    if (!entity) return;
    entity.dead = false;
    entity.deathFallProgress = 0;
    entity.root.position.copy(pos);
    entity.targetPos.copy(pos);
    entity.torsoGroup.rotation.set(0, 0, 0);
    entity.headGroup.rotation.set(0, 0, 0);
    entity.root.rotation.set(0, 0, 0);
    entity.weaponGroup.visible = true;
    entity.profile.health = entity.profile.maxHealth;
    entity.profile.shield = entity.profile.maxShield;
    this.updateNameplate(entity);
  }

  public getHitMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const entity of this.players.values()) {
      if (!entity.dead) {
        meshes.push(...entity.hitMeshes);
      }
    }
    return meshes;
  }

  public getPlayerPositions(): Array<{ id: string; x: number; z: number; color: PlayerColorId; name: string; health: number; maxHealth: number }> {
    const list: Array<{ id: string; x: number; z: number; color: PlayerColorId; name: string; health: number; maxHealth: number }> = [];
    for (const entity of this.players.values()) {
      list.push({
        id: entity.profile.id,
        x: entity.root.position.x,
        z: entity.root.position.z,
        color: entity.profile.color,
        name: entity.profile.name,
        health: entity.profile.health,
        maxHealth: entity.profile.maxHealth,
      });
    }
    return list;
  }

  public update(dt: number, camera: THREE.Camera) {
    for (const entity of this.players.values()) {
      // 1. Smooth transform interpolation
      const lerpFactor = Math.min(1, dt * 16);
      entity.root.position.lerp(entity.targetPos, lerpFactor);

      // Interpolate angles
      entity.currentYaw = THREE.MathUtils.lerp(entity.currentYaw, entity.targetYaw, lerpFactor);
      entity.currentPitch = THREE.MathUtils.lerp(entity.currentPitch, entity.targetPitch, lerpFactor);

      if (!entity.dead) {
        entity.root.rotation.y = entity.currentYaw;
        entity.torsoGroup.rotation.x = entity.currentPitch * 0.45;
        entity.headGroup.rotation.x = entity.currentPitch * 0.55;

        // Crouch interpolation
        const targetTorsoY = entity.crouching ? 0.72 : 0.98;
        entity.torsoGroup.position.y = THREE.MathUtils.lerp(entity.torsoGroup.position.y, targetTorsoY, lerpFactor);

        // Stride animation
        const speed = entity.velocity.length();
        if (speed > 0.25) {
          entity.stridePhase += dt * (entity.sprinting ? 12 : 8.5);
          const swing = Math.sin(entity.stridePhase) * (entity.sprinting ? 0.72 : 0.48);
          entity.leftHip.rotation.x = swing;
          entity.rightHip.rotation.x = -swing;
          entity.leftKnee.rotation.x = Math.max(0, -swing * 0.9);
          entity.rightKnee.rotation.x = Math.max(0, swing * 0.9);
        } else {
          entity.leftHip.rotation.x = THREE.MathUtils.lerp(entity.leftHip.rotation.x, 0, dt * 8);
          entity.rightHip.rotation.x = THREE.MathUtils.lerp(entity.rightHip.rotation.x, 0, dt * 8);
          entity.leftKnee.rotation.x = THREE.MathUtils.lerp(entity.leftKnee.rotation.x, 0, dt * 8);
          entity.rightKnee.rotation.x = THREE.MathUtils.lerp(entity.rightKnee.rotation.x, 0, dt * 8);
        }
      } else {
        // Ragdoll collapse animation
        if (entity.deathFallProgress < 1) {
          entity.deathFallProgress = Math.min(1, entity.deathFallProgress + dt * 2.8);
          entity.root.rotation.x = entity.deathFallProgress * (-Math.PI / 2);
          entity.root.position.y = Math.max(0.1, entity.targetPos.y - entity.deathFallProgress * 0.75);
        }
      }

      // 2. Muzzle flash fade
      if (entity.muzzleFlashTimer > 0) {
        entity.muzzleFlashTimer -= dt;
        if (entity.muzzleFlashTimer <= 0) {
          entity.muzzleFlash.visible = false;
        }
      }

      // 3. Hit flash decay
      if (entity.hitFlashTimer > 0) {
        entity.hitFlashTimer -= dt;
        if (entity.hitFlashTimer <= 0) {
          for (const m of entity.bodyMaterials) {
            m.emissiveIntensity = 0;
          }
        }
      }

      // 4. Billboard nameplate
      entity.nameplateSprite.position.set(0, entity.crouching ? 1.6 : 2.05, 0);
    }
  }

  private createPlayerEntity(profile: PlayerProfile, initialPos: THREE.Vector3): RemotePlayerEntity {
    const root = new THREE.Group();
    root.position.copy(initialPos);

    const hitMeshes: THREE.Mesh[] = [];
    const bodyMaterials: THREE.MeshStandardMaterial[] = [];

    const tagHit = (mesh: THREE.Mesh, isHeadshot: boolean) => {
      mesh.userData.remotePlayerId = profile.id;
      mesh.userData.isHeadshot = isHeadshot;
      mesh.userData.isPlayer = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      hitMeshes.push(mesh);
    };

    const makeMat = (params: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial(params);
      bodyMaterials.push(m);
      return m;
    };

    const colorSpec = PLAYER_COLORS[profile.color] ?? PLAYER_COLORS.cyan;

    // Contact shadow
    const shadowDisc = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(1.4, 1.4)), this.sharedShadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    root.add(shadowDisc);

    // Torso group (hips / pelvis / chest)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.98, 0);
    root.add(torsoGroup);

    // Pelvis
    const pelvisMat = makeMat({
      color: 0x22262b,
      roughness: 0.88,
      metalness: 0.1,
    });
    const pelvis = new THREE.Mesh(this.trackGeo(craftedBox(0.32, 0.18, 0.22)), pelvisMat);
    pelvis.position.set(0, -0.06, 0);
    tagHit(pelvis, false);
    torsoGroup.add(pelvis);

    // Tactical chest plate carrier
    const vestMat = makeMat({
      map: this.textures.tacticalSleeveColor,
      bumpMap: this.textures.tacticalSleeveBump,
      bumpScale: 0.006,
      color: 0x1e2329,
      roughness: 0.82,
      metalness: 0.18,
    });
    const chest = new THREE.Mesh(this.trackGeo(craftedBox(0.38, 0.42, 0.26)), vestMat);
    chest.position.set(0, 0.22, 0);
    tagHit(chest, false);
    torsoGroup.add(chest);

    // Team color shoulder pauldrons & chest insignia
    const teamAccentMat = makeMat({
      color: colorSpec.hex,
      emissive: colorSpec.hex,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.6,
    });
    const chevron = new THREE.Mesh(this.trackGeo(craftedBox(0.18, 0.08, 0.02)), teamAccentMat);
    chevron.position.set(0, 0.28, 0.135);
    torsoGroup.add(chevron);

    // Head group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.48, 0);
    torsoGroup.add(headGroup);

    // Ballistic combat helmet
    const helmetMat = makeMat({
      color: 0x161a1f,
      roughness: 0.65,
      metalness: 0.35,
    });
    const helmet = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.165, 12, 10)), helmetMat);
    helmet.scale.set(1.0, 1.1, 1.08);
    tagHit(helmet, true);
    headGroup.add(helmet);

    // Glowing team visor
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: colorSpec.hex,
      emissive: colorSpec.hex,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.8,
    });
    const visor = new THREE.Mesh(this.trackGeo(craftedBox(0.24, 0.07, 0.08)), visorMaterial);
    visor.position.set(0, 0.01, 0.13);
    headGroup.add(visor);

    // Tactical legs
    const pantsMat = makeMat({
      color: 0x272c32,
      roughness: 0.9,
      metalness: 0.05,
    });
    const bootMat = makeMat({
      color: 0x121417,
      roughness: 0.8,
      metalness: 0.2,
    });

    const buildLeg = (isRight: boolean) => {
      const hip = new THREE.Group();
      hip.position.set(isRight ? 0.11 : -0.11, -0.1, 0);
      torsoGroup.add(hip);

      const thigh = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.08, 0.3, 6, 10)), pantsMat);
      thigh.position.set(0, -0.18, 0);
      tagHit(thigh, false);
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.38, 0);
      hip.add(knee);

      const shin = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.068, 0.28, 6, 10)), pantsMat);
      shin.position.set(0, -0.16, 0);
      tagHit(shin, false);
      knee.add(shin);

      const boot = new THREE.Mesh(this.trackGeo(craftedBox(0.12, 0.09, 0.24)), bootMat);
      boot.position.set(0, -0.36, 0.04);
      knee.add(boot);

      return { hip, knee };
    };

    const leftLeg = buildLeg(false);
    const rightLeg = buildLeg(true);

    // Weapon group
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0.18, 0.18, 0.22);
    torsoGroup.add(weaponGroup);

    // Muzzle flash
    const muzzleFlash = new THREE.Mesh(this.trackGeo(new THREE.PlaneGeometry(0.4, 0.4)), this.sharedFlashMat);
    muzzleFlash.position.set(0, 0.02, 0.55);
    muzzleFlash.visible = false;
    weaponGroup.add(muzzleFlash);

    // Nameplate canvas sprite
    const { sprite, canvas, ctx, tex } = this.createNameplate(profile, colorSpec.css);
    root.add(sprite);

    const entity: RemotePlayerEntity = {
      profile,
      root,
      torsoGroup,
      headGroup,
      weaponGroup,
      currentWeaponId: profile.equippedWeapon ?? 'carbine',
      muzzleFlash,
      muzzleFlashTimer: 0,
      leftHip: leftLeg.hip,
      leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip,
      rightKnee: rightLeg.knee,
      hitMeshes,
      bodyMaterials,
      visorMaterial,
      nameplateSprite: sprite,
      nameplateCanvas: canvas,
      nameplateCtx: ctx,
      nameplateTex: tex,
      targetPos: initialPos.clone(),
      targetYaw: 0,
      targetPitch: 0,
      currentYaw: 0,
      currentPitch: 0,
      velocity: new THREE.Vector3(),
      stridePhase: 0,
      crouching: false,
      sprinting: false,
      hitFlashTimer: 0,
      dead: false,
      deathFallProgress: 0,
    };

    this.switchWeaponModel(entity, entity.currentWeaponId);
    return entity;
  }

  private switchWeaponModel(entity: RemotePlayerEntity, weaponId: WeaponId) {
    entity.currentWeaponId = weaponId;
    // Remove previous weapon meshes (keep muzzle flash)
    for (let i = entity.weaponGroup.children.length - 1; i >= 0; i--) {
      const child = entity.weaponGroup.children[i];
      if (child !== entity.muzzleFlash) {
        entity.weaponGroup.remove(child);
      }
    }

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x22262a,
      roughness: 0.45,
      metalness: 0.75,
    });
    const polyMat = new THREE.MeshStandardMaterial({
      color: 0x14171a,
      roughness: 0.8,
      metalness: 0.15,
    });

    const model = new THREE.Group();
    const isHeavy = ['machinegun', 'rpg', 'grenadelauncher'].includes(weaponId);
    const isSniper = ['railpistol', 'marksman'].includes(weaponId);
    const isPistol = ['usp', 'deagle', 'glock'].includes(weaponId);

    if (isPistol) {
      const slide = new THREE.Mesh(this.trackGeo(craftedBox(0.045, 0.055, 0.2)), gunMat);
      slide.position.set(0, 0, 0.08);
      model.add(slide);
      const grip = new THREE.Mesh(this.trackGeo(craftedBox(0.038, 0.12, 0.06)), polyMat);
      grip.position.set(0, -0.07, 0.02);
      grip.rotation.x = -0.22;
      model.add(grip);
      entity.muzzleFlash.position.set(0, 0.02, 0.22);
    } else if (isHeavy) {
      const body = new THREE.Mesh(this.trackGeo(craftedBox(0.09, 0.12, 0.58)), gunMat);
      model.add(body);
      const barrel = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.028, 0.028, 0.38, 10)), gunMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.42);
      model.add(barrel);
      entity.muzzleFlash.position.set(0, 0.02, 0.65);
    } else {
      // Carbine / Rifle / Shotgun / SMG
      const receiver = new THREE.Mesh(this.trackGeo(craftedBox(0.058, 0.085, 0.42)), gunMat);
      model.add(receiver);
      const barrel = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.016, 0.018, 0.32, 8)), gunMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.01, 0.32);
      model.add(barrel);
      const mag = new THREE.Mesh(this.trackGeo(craftedBox(0.034, 0.15, 0.07)), polyMat);
      mag.position.set(0, -0.09, 0.05);
      mag.rotation.x = 0.2;
      model.add(mag);
      if (isSniper) {
        const scope = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.022, 0.024, 0.22, 8)), gunMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.07, -0.02);
        model.add(scope);
      }
      entity.muzzleFlash.position.set(0, 0.01, 0.52);
    }

    entity.weaponGroup.add(model);
  }

  private createNameplate(profile: PlayerProfile, colorCss: string) {
    if (typeof document === 'undefined') {
      const tex = new THREE.CanvasTexture({ width: 1, height: 1 } as any);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
      const sprite = new THREE.Sprite(mat);
      return {
        sprite,
        canvas: {} as any,
        ctx: {
          clearRect: () => {},
          beginPath: () => {},
          roundRect: () => {},
          fill: () => {},
          stroke: () => {},
          fillText: () => {},
          fillRect: () => {},
          save: () => {},
          restore: () => {},
        } as any,
        tex,
      };
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.4, 1);

    this.renderNameplateCanvas(ctx, canvas, profile, colorCss);
    tex.needsUpdate = true;

    return { sprite, canvas, ctx, tex };
  }

  private updateNameplate(entity: RemotePlayerEntity) {
    if (typeof document === 'undefined') return;
    const colorSpec = PLAYER_COLORS[entity.profile.color] ?? PLAYER_COLORS.cyan;
    this.renderNameplateCanvas(entity.nameplateCtx, entity.nameplateCanvas, entity.profile, colorSpec.css);
    entity.nameplateTex.needsUpdate = true;
  }

  private renderNameplateCanvas(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    profile: PlayerProfile,
    colorCss: string,
  ) {
    if (!ctx || !canvas || !canvas.width) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pill background
    ctx.fillStyle = 'rgba(11, 16, 23, 0.85)';
    ctx.strokeStyle = colorCss;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(8, 6, canvas.width - 16, canvas.height - 12, 10);
    ctx.fill();
    ctx.stroke();

    // Call-sign & Status
    ctx.font = 'bold 20px "Oxanium", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(profile.name.slice(0, 12), 22, 32);

    // Health bar background
    const barX = 22;
    const barY = 40;
    const barW = canvas.width - 44;
    const barH = 12;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barW, barH);

    // Shield fill
    const shieldFrac = Math.max(0, Math.min(1, profile.shield / Math.max(1, profile.maxShield)));
    const healthFrac = Math.max(0, Math.min(1, profile.health / Math.max(1, profile.maxHealth)));

    if (shieldFrac > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(barX, barY, barW * shieldFrac, barH * 0.4);
    }

    // Health fill
    ctx.fillStyle = healthFrac > 0.5 ? '#10b981' : healthFrac > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY + (shieldFrac > 0 ? barH * 0.4 : 0), barW * healthFrac, shieldFrac > 0 ? barH * 0.6 : barH);
  }

  public dispose() {
    for (const entity of this.players.values()) {
      this.scene.remove(entity.root);
      entity.nameplateTex.dispose();
    }
    this.players.clear();
    for (const g of this.geometries) {
      g.dispose();
    }
    this.geometries.length = 0;
  }
}
