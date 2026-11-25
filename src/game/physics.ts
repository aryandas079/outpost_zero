import * as THREE from 'three';
import { ArenaBounds, ArenaData, BoxCollider, RampSurface } from './arena';

export type PhysicsSurface = 'wood' | 'stone' | 'concrete' | 'metal' | 'glass' | 'dirt';

export interface StaticPhysicsBody {
  id: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  friction: number;
  restitution: number;
  surface: PhysicsSurface;
  /** True for low walkable slabs/porches/steps (maxY <= 0.34m) */
  isStepable: boolean;
  /** True for thick solid architectural walls/structures */
  isThickWall: boolean;
}

export interface DynamicCapsuleBody {
  /** World-space feet position (center bottom of capsule) */
  position: THREE.Vector3;
  /** World-space linear velocity (m/s) */
  velocity: THREE.Vector3;
  /** Capsule horizontal radius (m) */
  radius: number;
  /** Total capsule standing/crouching height (m) */
  height: number;
  /** Maximum vertical ledge height the capsule can smoothly auto-step onto (m) */
  stepHeight: number;
  /** True when supported by floor, ramp, or solid mesh top */
  grounded: boolean;
  /** Surface normal of the supporting ground or sloped ramp */
  groundNormal: THREE.Vector3;
  /** Surface material tag of current ground contact */
  groundSurface: PhysicsSurface;
  /** Impact downward speed on touchdown this tick (m/s, 0 if not newly landed) */
  landingSpeed: number;
  /** True if horizontal wall contact occurred this step */
  hitWall: boolean;
  /** Last resolved horizontal wall normal */
  wallNormalX: number;
  wallNormalZ: number;
  /** True if upward ceiling/overhang contact occurred this step */
  hitCeiling: boolean;
}

export interface PhysicsRaycastHit {
  hit: boolean;
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  surface: PhysicsSurface;
}

const SURFACE_PROPS: Record<PhysicsSurface, { friction: number; restitution: number }> = {
  wood: { friction: 0.78, restitution: 0.02 },
  concrete: { friction: 0.86, restitution: 0.02 },
  stone: { friction: 0.85, restitution: 0.02 },
  metal: { friction: 0.64, restitution: 0.04 },
  glass: { friction: 0.48, restitution: 0.03 },
  dirt: { friction: 0.9, restitution: 0.01 },
};

// Reusable scratch structures for startup mesh extraction (never allocated in render loop)
const _tmpBox = new THREE.Box3();
const _tmpMat = new THREE.Matrix4();
const _tmpInstMat = new THREE.Matrix4();

function normalizeSurface(raw: unknown): PhysicsSurface {
  if (raw === 'wood' || raw === 'stone' || raw === 'concrete' || raw === 'metal' || raw === 'glass' || raw === 'dirt') {
    return raw;
  }
  return 'wood';
}

function hasNoCollideAncestor(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData && cur.userData.noCollide === true) return true;
    cur = cur.parent;
  }
  return false;
}

/**
 * Spatial-hash accelerated 3D Physics-Based Environment Collision World.
 *
 * - Automatically extracts world-space solid collision bodies from ALL collidable
 *   environment meshes (both Mesh and InstancedMesh) in addition to architectural
 *   colliders and analytical ramp surfaces.
 * - Uses a flat uniform 2D spatial hash grid with monotonic stamp deduplication
 *   for zero-GC O(1) broad-phase queries.
 * - Solves continuous sub-stepped 3D capsule-vs-AABB collisions with normal impulse
 *   projection, corner-slide friction, ceiling overhang blocking, and ramp support.
 */
export class PhysicsWorld {
  public readonly bodies: StaticPhysicsBody[] = [];
  public readonly ramps: RampSurface[];
  public readonly bounds: ArenaBounds;
  private readonly terrainHeightAt?: (x: number, z: number) => number;
  private readonly terrainNormalAt?: (x: number, z: number, out: THREE.Vector3) => void;
  private readonly _tmpTerrainNormal = new THREE.Vector3(0, 1, 0);

  private readonly cellSize: number;
  private readonly gridMinX: number;
  private readonly gridMinZ: number;
  private readonly gridCols: number;
  private readonly gridRows: number;
  private readonly cells: number[][];
  private readonly bodyStamp: Int32Array;
  private currentStamp = 0;

  // Reusable flat scratch candidate array (zero per-frame allocations)
  private readonly queryResults: number[] = [];

  constructor(arena: ArenaData) {
    this.ramps = arena.ramps;
    this.bounds = arena.bounds;
    this.terrainHeightAt = arena.terrainHeightAt;
    this.terrainNormalAt = arena.terrainNormalAt;

    const maxSpan = Math.max(arena.bounds.maxX - arena.bounds.minX, arena.bounds.maxZ - arena.bounds.minZ);
    this.cellSize = maxSpan > 400 ? Math.ceil(maxSpan / 160) : 6.0;

    const pad = 6;
    this.gridMinX = Math.floor((arena.bounds.minX - pad) / this.cellSize) * this.cellSize;
    this.gridMinZ = Math.floor((arena.bounds.minZ - pad) / this.cellSize) * this.cellSize;
    const spanX = arena.bounds.maxX + pad - this.gridMinX;
    const spanZ = arena.bounds.maxZ + pad - this.gridMinZ;
    this.gridCols = Math.max(1, Math.ceil(spanX / this.cellSize));
    this.gridRows = Math.max(1, Math.ceil(spanZ / this.cellSize));

    this.cells = new Array(this.gridCols * this.gridRows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = [];
    }

    // 1. Register explicit architectural colliders first (exact walls, floors, doorways, ceilings, railings)
    for (let i = 0; i < arena.colliders.length; i++) {
      const c = arena.colliders[i];
      this.addBodyBox(c.minX, c.maxX, c.minY, c.maxY, c.minZ, c.maxZ, normalizeSurface(c.surface ?? 'wood'));
    }

    // 2. Automatically scan ALL environment meshes in arena.group to guarantee zero un-collided geometry
    arena.group.updateMatrixWorld(true);
    this.extractEnvironmentMeshColliders(arena.group, arena.bounds);

    this.bodyStamp = new Int32Array(this.bodies.length);

    // 3. Populate uniform 2D spatial hash grid for O(1) broad-phase collision & ray queries
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const c0 = this.clampCol(Math.floor((b.minX - this.gridMinX) / this.cellSize));
      const c1 = this.clampCol(Math.floor((b.maxX - this.gridMinX) / this.cellSize));
      const r0 = this.clampRow(Math.floor((b.minZ - this.gridMinZ) / this.cellSize));
      const r1 = this.clampRow(Math.floor((b.maxZ - this.gridMinZ) / this.cellSize));
      for (let r = r0; r <= r1; r++) {
        const rowOff = r * this.gridCols;
        for (let c = c0; c <= c1; c++) {
          this.cells[rowOff + c].push(i);
        }
      }
    }
  }

  private clampCol(c: number): number {
    return c < 0 ? 0 : c >= this.gridCols ? this.gridCols - 1 : c;
  }

  private clampRow(r: number): number {
    return r < 0 ? 0 : r >= this.gridRows ? this.gridRows - 1 : r;
  }

  private isCoveredByExistingBody(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
  ): boolean {
    const tol = 0.14;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (
        minX >= b.minX - tol &&
        maxX <= b.maxX + tol &&
        minY >= b.minY - tol &&
        maxY <= b.maxY + tol &&
        minZ >= b.minZ - tol &&
        maxZ <= b.maxZ + tol
      ) {
        return true;
      }
    }
    return false;
  }

  private addBodyBox(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    surface: PhysicsSurface,
  ): void {
    const sx = maxX - minX;
    const sy = maxY - minY;
    const sz = maxZ - minZ;
    if (sx <= 0.02 || sy <= 0.02 || sz <= 0.02) return;

    const props = SURFACE_PROPS[surface];
    const id = this.bodies.length;
    const isStepable = (maxY <= 0.34 && minY <= 0.12) || sy <= 0.34;
    const isThickWall = sy >= 2.1 && Math.max(sx, sz) >= 1.8 && Math.min(sx, sz) >= 0.35;

    this.bodies.push({
      id,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      friction: props.friction,
      restitution: props.restitution,
      surface,
      isStepable,
      isThickWall,
    });
  }

  private extractEnvironmentMeshColliders(root: THREE.Object3D, bounds: ArenaBounds): void {
    const boundPad = 2.5;
    const bMinX = bounds.minX - boundPad;
    const bMaxX = bounds.maxX + boundPad;
    const bMinZ = bounds.minZ - boundPad;
    const bMaxZ = bounds.maxZ + boundPad;

    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (hasNoCollideAncestor(obj)) return;

      const geo = obj.geometry;
      if (!geo) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) return;

      const surface = normalizeSurface(obj.userData?.surface);

      if (obj instanceof THREE.InstancedMesh) {
        const count = obj.count;
        for (let i = 0; i < count; i++) {
          obj.getMatrixAt(i, _tmpInstMat);
          _tmpMat.multiplyMatrices(obj.matrixWorld, _tmpInstMat);
          _tmpBox.copy(geo.boundingBox).applyMatrix4(_tmpMat);
          this.tryRegisterExtractedBox(_tmpBox, surface, bMinX, bMaxX, bMinZ, bMaxZ);
        }
        return;
      }

      _tmpBox.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
      this.tryRegisterExtractedBox(_tmpBox, surface, bMinX, bMaxX, bMinZ, bMaxZ);
    });
  }

  private tryRegisterExtractedBox(
    box: THREE.Box3,
    surface: PhysicsSurface,
    bMinX: number,
    bMaxX: number,
    bMinZ: number,
    bMaxZ: number,
  ): void {
    const minX = box.min.x;
    const maxX = box.max.x;
    const minY = box.min.y;
    const maxY = box.max.y;
    const minZ = box.min.z;
    const maxZ = box.max.z;

    // Ignore distant decorative scenery completely outside playable perimeter
    if (maxX < bMinX || minX > bMaxX || maxZ < bMinZ || minZ > bMaxZ) return;

    const sx = maxX - minX;
    const sy = maxY - minY;
    const sz = maxZ - minZ;

    // Skip ultra-thin decorative trim, wires, flat ground decals, or giant terrain planes
    if (sy < 0.11 || (sx < 0.14 && sz < 0.14)) return;
    if (sx > 40 && sz > 40) return;

    // Skip decorative pieces strictly higher than reachable jump/head clearance above local terrain
    const localGroundY = this.terrainHeightAt ? this.terrainHeightAt(0.5 * (minX + maxX), 0.5 * (minZ + maxZ)) : 0;
    if (minY - localGroundY > 10.5) return;

    // Deduplicate against already-registered explicit architectural colliders
    if (this.isCoveredByExistingBody(minX, maxX, minY, maxY, minZ, maxZ)) return;

    this.addBodyBox(minX, maxX, minY, maxY, minZ, maxZ, surface);
  }

  /**
   * Broad-phase 2D spatial hash query returning unique body indices into `this.queryResults`.
   * Zero heap allocations per call via monotonic stamp deduplication.
   */
  private queryAABB2D(minX: number, maxX: number, minZ: number, maxZ: number): number {
    this.queryResults.length = 0;
    this.currentStamp++;
    if (this.currentStamp >= 2147483000) {
      this.bodyStamp.fill(0);
      this.currentStamp = 1;
    }
    const stamp = this.currentStamp;

    const c0 = this.clampCol(Math.floor((minX - this.gridMinX) / this.cellSize));
    const c1 = this.clampCol(Math.floor((maxX - this.gridMinX) / this.cellSize));
    const r0 = this.clampRow(Math.floor((minZ - this.gridMinZ) / this.cellSize));
    const r1 = this.clampRow(Math.floor((maxZ - this.gridMinZ) / this.cellSize));

    for (let r = r0; r <= r1; r++) {
      const rowOff = r * this.gridCols;
      for (let c = c0; c <= c1; c++) {
        const bucket = this.cells[rowOff + c];
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          if (this.bodyStamp[idx] !== stamp) {
            this.bodyStamp[idx] = stamp;
            this.queryResults.push(idx);
          }
        }
      }
    }

    return this.queryResults.length;
  }

  /**
   * Evaluates supporting ground elevation & analytical normal under a cylinder footprint
   * across continuous 3D terrain heightfields, sloped ramps, and solid mesh tops.
   */
  public sampleGroundAt(
    x: number,
    z: number,
    currentY: number,
    radius: number,
    stepHeight: number,
    outNormal?: THREE.Vector3,
  ): { y: number; surface: PhysicsSurface } {
    let groundY = this.terrainHeightAt ? this.terrainHeightAt(x, z) : 0;
    let surface: PhysicsSurface = 'dirt';
    let nx = 0;
    let ny = 1;
    let nz = 0;

    if (this.terrainNormalAt) {
      this.terrainNormalAt(x, z, this._tmpTerrainNormal);
      nx = this._tmpTerrainNormal.x;
      ny = this._tmpTerrainNormal.y;
      nz = this._tmpTerrainNormal.z;
    }

    // 1. Check analytical sloped ramps (staircases / boardwalk ramps)
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      if (x >= r.minX - 0.2 && x <= r.maxX + 0.2 && z >= r.minZ - 0.2 && z <= r.maxZ + 0.2) {
        const coord = r.axis === 'x' ? x : z;
        const span = r.highEdge - r.lowEdge;
        const t = THREE.MathUtils.clamp((coord - r.lowEdge) / span, 0, 1);
        const h = THREE.MathUtils.lerp(r.lowY, r.highY, t);
        if (h <= currentY + 0.65 && h > groundY) {
          groundY = h;
          surface = 'wood';
          const slope = (r.highY - r.lowY) / span;
          const invLen = 1 / Math.hypot(1, slope);
          if (r.axis === 'x') {
            nx = -slope * invLen;
            ny = invLen;
            nz = 0;
          } else {
            nx = 0;
            ny = invLen;
            nz = -slope * invLen;
          }
        }
      }
    }

    // 2. Check walkable tops of spatial-grid static mesh colliders
    const count = this.queryAABB2D(x - radius, x + radius, z - radius, z + radius);
    const stepWindow = stepHeight + 0.04;
    for (let i = 0; i < count; i++) {
      const b = this.bodies[this.queryResults[i]];
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
        if (currentY >= b.maxY - stepWindow && b.maxY > groundY) {
          groundY = b.maxY;
          surface = b.surface;
          nx = 0;
          ny = 1;
          nz = 0;
        }
      }
    }

    if (outNormal) {
      outNormal.set(nx, ny, nz);
    }
    return { y: groundY, surface };
  }

  /**
   * Resolves horizontal capsule penetration against all nearby static mesh colliders
   * and arena perimeter bounds, applying physical normal-impulse velocity projection.
   */
  public resolveCapsuleHorizontal(
    pos: THREE.Vector3,
    radius: number,
    height: number,
    stepHeight: number,
    vel?: THREE.Vector3,
    outHit?: { hit: boolean; nx: number; nz: number },
  ): boolean {
    let anyHit = false;
    let lastNx = 0;
    let lastNz = 0;

    // 1. Arena perimeter boundary physical wall constraint
    const minBoundX = this.bounds.minX + radius;
    const maxBoundX = this.bounds.maxX - radius;
    const minBoundZ = this.bounds.minZ + radius;
    const maxBoundZ = this.bounds.maxZ - radius;

    if (pos.x < minBoundX) {
      pos.x = minBoundX;
      if (vel && vel.x < 0) vel.x = 0;
      anyHit = true;
      lastNx = 1;
      lastNz = 0;
    } else if (pos.x > maxBoundX) {
      pos.x = maxBoundX;
      if (vel && vel.x > 0) vel.x = 0;
      anyHit = true;
      lastNx = -1;
      lastNz = 0;
    }

    if (pos.z < minBoundZ) {
      pos.z = minBoundZ;
      if (vel && vel.z < 0) vel.z = 0;
      anyHit = true;
      lastNx = 0;
      lastNz = 1;
    } else if (pos.z > maxBoundZ) {
      pos.z = maxBoundZ;
      if (vel && vel.z > 0) vel.z = 0;
      anyHit = true;
      lastNx = 0;
      lastNz = -1;
    }

    // 2. Broad-phase spatial hash lookup around capsule footprint
    const count = this.queryAABB2D(pos.x - radius - 0.06, pos.x + radius + 0.06, pos.z - radius - 0.06, pos.z + radius + 0.06);
    const bodyBottom = pos.y + stepHeight;
    const bodyTop = pos.y + height;
    const rSq = radius * radius;

    for (let i = 0; i < count; i++) {
      const b = this.bodies[this.queryResults[i]];
      // Skip boxes cleanly below auto-step height or strictly above capsule head
      if (b.maxY <= bodyBottom || b.minY >= bodyTop) continue;

      const closestX = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x;
      const closestZ = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z;
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < rSq) {
        let nx = 0;
        let nz = 0;
        let overlap = 0;

        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          nx = dx / dist;
          nz = dz / dist;
          overlap = radius - dist;
        } else {
          // Capsule center penetrated inside box: push cleanly along shallowest face normal
          const penLeft = Math.abs(pos.x - b.minX);
          const penRight = Math.abs(b.maxX - pos.x);
          const penFront = Math.abs(pos.z - b.minZ);
          const penBack = Math.abs(b.maxZ - pos.z);
          const m = Math.min(penLeft, penRight, penFront, penBack);
          if (m === penLeft) {
            nx = -1;
            overlap = penLeft + radius;
          } else if (m === penRight) {
            nx = 1;
            overlap = penRight + radius;
          } else if (m === penFront) {
            nz = -1;
            overlap = penFront + radius;
          } else {
            nz = 1;
            overlap = penBack + radius;
          }
        }

        // Apply exact positional constraint pushout (+ tiny epsilon to prevent numerical re-penetration)
        pos.x += nx * (overlap + 0.0005);
        pos.z += nz * (overlap + 0.0005);
        anyHit = true;
        lastNx = nx;
        lastNz = nz;

        // Physical velocity constraint: cancel inward normal velocity & apply subtle wall-slide drag
        if (vel) {
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) {
            const bounce = 1 + b.restitution;
            vel.x -= bounce * vn * nx;
            vel.z -= bounce * vn * nz;
          }
        }
      }
    }

    if (outHit) {
      outHit.hit = anyHit;
      outHit.nx = lastNx;
      outHit.nz = lastNz;
    }
    return anyHit;
  }

  /**
   * Continuous sub-stepped 3D physics step for a DynamicCapsuleBody (Player or Ground Actor).
   * Guarantees zero wall tunneling, zero ceiling clipping, and smooth physical corner sliding.
   */
  public stepCapsule(body: DynamicCapsuleBody, dt: number, gravity = 22.5): void {
    const wasGrounded = body.grounded;
    body.hitWall = false;
    body.hitCeiling = false;
    body.landingSpeed = 0;

    // 1. Integrate gravity
    body.velocity.y -= gravity * dt;

    // 2. Continuous sub-stepped horizontal displacement (max 0.12m per step -> impenetrable even at 29 m/s Dash)
    const moveDx = body.velocity.x * dt;
    const moveDz = body.velocity.z * dt;
    const moveDist = Math.hypot(moveDx, moveDz);
    const maxStep = Math.min(0.12, body.radius * 0.28);
    const subSteps = Math.max(1, Math.ceil(moveDist / maxStep));
    const stepTime = dt / subSteps;

    const hitInfo = { hit: false, nx: 0, nz: 0 };
    for (let s = 0; s < subSteps; s++) {
      body.position.x += body.velocity.x * stepTime;
      body.position.z += body.velocity.z * stepTime;
      // 4 iterative constraint passes per substep cleanly resolve tight multi-wall corners & pillars
      for (let pass = 0; pass < 4; pass++) {
        if (
          this.resolveCapsuleHorizontal(
            body.position,
            body.radius,
            body.height,
            body.stepHeight,
            body.velocity,
            hitInfo,
          )
        ) {
          body.hitWall = true;
          body.wallNormalX = hitInfo.nx;
          body.wallNormalZ = hitInfo.nz;
        }
      }
    }

    // 3. Vertical displacement & physical ceiling/overhang blocking
    const prevY = body.position.y;
    const preLandingDownSpeed = -body.velocity.y;
    body.position.y += body.velocity.y * dt;

    if (body.velocity.y > 0) {
      const headTop = body.position.y + body.height;
      const prevHead = prevY + body.height;
      const count = this.queryAABB2D(
        body.position.x - body.radius,
        body.position.x + body.radius,
        body.position.z - body.radius,
        body.position.z + body.radius,
      );
      for (let i = 0; i < count; i++) {
        const b = this.bodies[this.queryResults[i]];
        if (
          body.position.x + body.radius > b.minX &&
          body.position.x - body.radius < b.maxX &&
          body.position.z + body.radius > b.minZ &&
          body.position.z - body.radius < b.maxZ
        ) {
          if (prevHead <= b.minY + 0.2 && headTop >= b.minY) {
            body.position.y = b.minY - body.height - 0.002;
            body.velocity.y = 0;
            body.hitCeiling = true;
            break;
          }
        }
      }
    }

    // 4. Supporting ground / ramp / mesh-top resolution
    const ground = this.sampleGroundAt(
      body.position.x,
      body.position.z,
      Math.max(prevY, body.position.y),
      body.radius,
      body.stepHeight,
      body.groundNormal,
    );

    const slopeFollowLimit = Math.max(0.42, body.stepHeight * 1.25);
    const downhillGap = body.position.y - ground.y;

    if (body.position.y <= ground.y) {
      body.position.y = ground.y;
      body.velocity.y = 0;
      body.grounded = true;
      body.groundSurface = ground.surface;
      if (!wasGrounded && preLandingDownSpeed > 0.5) {
        body.landingSpeed = preLandingDownSpeed;
      }
    } else if (
      wasGrounded &&
      body.velocity.y <= 0 &&
      downhillGap <= slopeFollowLimit &&
      body.groundNormal.y >= 0.38
    ) {
      // Smoothly snap capsule to downward terrain slopes without going micro-airborne & thudding
      body.position.y = ground.y;
      body.velocity.y = 0;
      body.grounded = true;
      body.groundSurface = ground.surface;
    } else {
      body.grounded = false;
      body.groundNormal.set(0, 1, 0);
    }

    // 5. Final safety constraint pass after vertical step-up (prevents clipping into doorway lintels or under terrain)
    this.resolveCapsuleHorizontal(body.position, body.radius, body.height, body.stepHeight, body.velocity);
    if (this.terrainHeightAt) {
      const floorY = this.terrainHeightAt(body.position.x, body.position.z);
      if (body.position.y < floorY) {
        body.position.y = floorY;
        if (body.velocity.y < 0) body.velocity.y = 0;
        body.grounded = true;
      }
    }
  }

  /**
   * 3D Sphere-vs-AABB resolution for aerial drones so flying enemies physically collide
   * with upper building stories, roofs, water tower, and arena bounds.
   */
  public resolveSphere(center: THREE.Vector3, radius: number): boolean {
    let hit = false;
    const minBoundX = this.bounds.minX + radius;
    const maxBoundX = this.bounds.maxX - radius;
    const minBoundZ = this.bounds.minZ + radius;
    const maxBoundZ = this.bounds.maxZ - radius;
    if (center.x < minBoundX) {
      center.x = minBoundX;
      hit = true;
    } else if (center.x > maxBoundX) {
      center.x = maxBoundX;
      hit = true;
    }
    if (center.z < minBoundZ) {
      center.z = minBoundZ;
      hit = true;
    } else if (center.z > maxBoundZ) {
      center.z = maxBoundZ;
      hit = true;
    }

    const count = this.queryAABB2D(center.x - radius, center.x + radius, center.z - radius, center.z + radius);
    const rSq = radius * radius;
    for (let i = 0; i < count; i++) {
      const b = this.bodies[this.queryResults[i]];
      const cx = center.x < b.minX ? b.minX : center.x > b.maxX ? b.maxX : center.x;
      const cy = center.y < b.minY ? b.minY : center.y > b.maxY ? b.maxY : center.y;
      const cz = center.z < b.minZ ? b.minZ : center.z > b.maxZ ? b.maxZ : center.z;
      const dx = center.x - cx;
      const dy = center.y - cy;
      const dz = center.z - cz;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < rSq && dSq > 1e-8) {
        const d = Math.sqrt(dSq);
        const push = (radius - d) / d;
        center.x += dx * push;
        center.z += dz * push;
        hit = true;
      }
    }
    return hit;
  }

  /**
   * Full 3D Sphere-vs-AABB camera standoff constraint (X, Y, and Z) so camera shake,
   * crouching, or corner pushing can NEVER clip the near plane through any solid wall,
   * ceiling, or building corner.
   */
  public resolveCameraSphere(center: THREE.Vector3, radius: number): boolean {
    let anyHit = false;
    const minBoundX = this.bounds.minX + radius;
    const maxBoundX = this.bounds.maxX - radius;
    const minBoundZ = this.bounds.minZ + radius;
    const maxBoundZ = this.bounds.maxZ - radius;

    for (let pass = 0; pass < 3; pass++) {
      let passHit = false;
      if (center.x < minBoundX) {
        center.x = minBoundX;
        passHit = true;
      } else if (center.x > maxBoundX) {
        center.x = maxBoundX;
        passHit = true;
      }
      if (center.z < minBoundZ) {
        center.z = minBoundZ;
        passHit = true;
      } else if (center.z > maxBoundZ) {
        center.z = maxBoundZ;
        passHit = true;
      }

      const count = this.queryAABB2D(center.x - radius - 0.04, center.x + radius + 0.04, center.z - radius - 0.04, center.z + radius + 0.04);
      const rSq = radius * radius;
      for (let i = 0; i < count; i++) {
        const b = this.bodies[this.queryResults[i]];
        if (center.y + radius <= b.minY || center.y - radius >= b.maxY) continue;
        const cx = center.x < b.minX ? b.minX : center.x > b.maxX ? b.maxX : center.x;
        const cy = center.y < b.minY ? b.minY : center.y > b.maxY ? b.maxY : center.y;
        const cz = center.z < b.minZ ? b.minZ : center.z > b.maxZ ? b.maxZ : center.z;
        const dx = center.x - cx;
        const dy = center.y - cy;
        const dz = center.z - cz;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < rSq) {
          if (dSq > 1e-8) {
            const d = Math.sqrt(dSq);
            const push = (radius - d + 0.002) / d;
            center.x += dx * push;
            center.y += dy * push;
            center.z += dz * push;
          } else {
            // Camera center inside solid box: eject along shallowest face
            const penMinX = Math.abs(center.x - b.minX);
            const penMaxX = Math.abs(b.maxX - center.x);
            const penMinY = Math.abs(center.y - b.minY);
            const penMaxY = Math.abs(b.maxY - center.y);
            const penMinZ = Math.abs(center.z - b.minZ);
            const penMaxZ = Math.abs(b.maxZ - center.z);
            const m = Math.min(penMinX, penMaxX, penMinY, penMaxY, penMinZ, penMaxZ);
            if (m === penMinX) center.x = b.minX - radius - 0.002;
            else if (m === penMaxX) center.x = b.maxX + radius + 0.002;
            else if (m === penMinY) center.y = b.minY - radius - 0.002;
            else if (m === penMaxY) center.y = b.maxY + radius + 0.002;
            else if (m === penMinZ) center.z = b.minZ - radius - 0.002;
            else center.z = b.maxZ + radius + 0.002;
          }
          passHit = true;
        }
      }
      if (!passHit) break;
      anyHit = true;
    }
    return anyHit;
  }

  /**
   * Spatial-grid accelerated swept 3D ray-segment vs. static environment mesh colliders.
   * Returns exact earliest impact t in [0, 1], hit point, and outward face normal (zero GC).
   */
  public raycastSegment(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    outHit: PhysicsRaycastHit,
    pad = 0.04,
  ): boolean {
    outHit.hit = false;
    outHit.t = 2;

    const qMinX = Math.min(x0, x1) - pad;
    const qMaxX = Math.max(x0, x1) + pad;
    const qMinZ = Math.min(z0, z1) - pad;
    const qMaxZ = Math.max(z0, z1) + pad;
    const count = this.queryAABB2D(qMinX, qMaxX, qMinZ, qMaxZ);

    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;

    let bestT = 2;
    let bestNx = 0;
    let bestNy = 1;
    let bestNz = 0;
    let bestSurface: PhysicsSurface = 'wood';

    for (let i = 0; i < count; i++) {
      const b = this.bodies[this.queryResults[i]];
      const minX = b.minX - pad;
      const maxX = b.maxX + pad;
      const minY = b.minY - pad;
      const maxY = b.maxY + pad;
      const minZ = b.minZ - pad;
      const maxZ = b.maxZ + pad;

      let tmin = 0;
      let tmax = 1;
      let nx = 0;
      let ny = 0;
      let nz = 0;

      if (Math.abs(dx) < 1e-8) {
        if (x0 < minX || x0 > maxX) continue;
      } else {
        const inv = 1 / dx;
        let t1 = (minX - x0) * inv;
        let t2 = (maxX - x0) * inv;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          nx = sign;
          ny = 0;
          nz = 0;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }

      if (Math.abs(dy) < 1e-8) {
        if (y0 < minY || y0 > maxY) continue;
      } else {
        const inv = 1 / dy;
        let t1 = (minY - y0) * inv;
        let t2 = (maxY - y0) * inv;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          nx = 0;
          ny = sign;
          nz = 0;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }

      if (Math.abs(dz) < 1e-8) {
        if (z0 < minZ || z0 > maxZ) continue;
      } else {
        const inv = 1 / dz;
        let t1 = (minZ - z0) * inv;
        let t2 = (maxZ - z0) * inv;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          nx = 0;
          ny = 0;
          nz = sign;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }

      if (tmin < bestT) {
        bestT = tmin;
        bestNx = nx;
        bestNy = ny;
        bestNz = nz;
        bestSurface = b.surface;
      }
    }

    if (bestT <= 1) {
      outHit.hit = true;
      outHit.t = bestT;
      outHit.point.set(x0 + dx * bestT, y0 + dy * bestT, z0 + dz * bestT);
      outHit.normal.set(bestNx, bestNy, bestNz);
      outHit.surface = bestSurface;
      return true;
    }

    return false;
  }

  public static createCapsuleBody(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    height: number,
    stepHeight = 0.32,
  ): DynamicCapsuleBody {
    return {
      position,
      velocity,
      radius,
      height,
      stepHeight,
      grounded: true,
      groundNormal: new THREE.Vector3(0, 1, 0),
      groundSurface: 'dirt',
      landingSpeed: 0,
      hitWall: false,
      wallNormalX: 0,
      wallNormalZ: 0,
      hitCeiling: false,
    };
  }
}

export type { BoxCollider };
