import * as THREE from 'three';
import { ArenaData, OccludableKind } from './arena';

interface OccluderWall {
  /** Inset opaque core bounds (conservative inset prevents doorway/crack false positives) */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cy: number;
  cz: number;
  /** Surface area heuristic used to prioritize large thick walls */
  area: number;
  /** Per-frame distance squared from camera for front-to-back sorting */
  camDistSq: number;
}

interface StaticOccludableEntry {
  object: THREE.Object3D;
  kind: OccludableKind;
  buildingIdx: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cy: number;
  cz: number;
  /** Pre-allocated bounding box for zero-GC Three.js Frustum.intersectsBox() */
  box: THREE.Box3;
  /** Consecutive occluded frames (2-frame hysteresis prevents corner flicker; 0-frame instant reveal) */
  occludedFrames: number;
  culled: boolean;
}

export interface DynamicOccludableActor {
  root: THREE.Object3D;
  alive: boolean;
  radius: number;
  height?: number;
  hoverBaseY?: number;
}

export interface DynamicOccludablePickup {
  active: boolean;
  group: THREE.Group;
  pos: THREE.Vector3;
}

export interface OcclusionStats {
  totalTracked: number;
  culledStatic: number;
  culledDynamic: number;
  activeOccluders: number;
}

// Pre-allocated math scratch objects (zero per-frame GC allocations)
const _projScreenMat = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _camPos = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _tmpBox = new THREE.Box3();
const _dynBox = new THREE.Box3();

/**
 * Conservative 3D Wall Occlusion Culling System for OutpostGameEngine.
 *
 * Prevents Three.js from traversing & submitting draw calls for buildings,
 * interior furniture, street cover props, enemies, pickups, and bullet decals
 * hidden behind thick opaque architectural walls — dramatically boosting FPS
 * and reducing GPU overdraw during intense combat with ZERO pop-in or shadow artifacts.
 *
 * Pipeline (0 heap allocations per frame):
 * 1. View-Frustum pre-filter on entire scene clusters (skipping near shadow-casters so sun shadows never pop).
 * 2. Front-to-back active thick-wall occluder selection (top 28 closest/largest opaque walls in view).
 * 3. Exact single-occluder convex containment + conservative 13-point multi-wall slab occlusion test
 *    (8 AABB corners + 4 vertical mid-edges + center, with 0.06m occluder face inset so doorways stay clear).
 * 4. Asymmetric temporal hysteresis: 0-frame instant reveal on peek, 2-frame hold before culling.
 */
export class OcclusionCullingSystem {
  private readonly occluders: OccluderWall[] = [];
  private readonly activeOccluders: OccluderWall[] = [];
  private readonly statics: StaticOccludableEntry[] = [];
  private readonly buildingFootprints: Array<{ cx: number; cz: number; w: number; d: number }>;

  // Flat pre-allocated sample coordinate buffer for 13 conservative AABB silhouette test points
  private readonly sampleX = new Float32Array(13);
  private readonly sampleY = new Float32Array(13);
  private readonly sampleZ = new Float32Array(13);

  private readonly maxActiveOccluders = 28;
  private stats: OcclusionStats = {
    totalTracked: 0,
    culledStatic: 0,
    culledDynamic: 0,
    activeOccluders: 0,
  };

  constructor(arena: ArenaData) {
    this.buildingFootprints = arena.buildingFootprints;

    // Ensure all world matrices are current before computing static occludee AABBs
    arena.group.updateMatrixWorld(true);

    // 1. Extract thick opaque architectural wall occluders from solid building walls & upper slabs
    //    (Open doorways are naturally gaps between piers -> doorways are NEVER treated as occluders!)
    const inset = 0.05; // Conservative inset prevents false occlusion through narrow cracks or doorway edges
    for (let i = 0; i < arena.colliders.length; i++) {
      const c = arena.colliders[i];
      const sx = c.maxX - c.minX;
      const sy = c.maxY - c.minY;
      const sz = c.maxZ - c.minZ;
      const maxHoriz = sx > sz ? sx : sz;
      const minHoriz = sx < sz ? sx : sz;

      // Thick structural walls (wallT >= 0.35m, tall >= 2.15m, wide >= 1.75m) OR solid thick roof/floor slabs
      const isThickWall = sy >= 2.15 && maxHoriz >= 1.75 && minHoriz >= 0.35;
      const isThickStructure = sy >= 1.8 && sx >= 1.5 && sz >= 1.5;

      if (isThickWall || isThickStructure) {
        const minX = c.minX + Math.min(inset, sx * 0.12);
        const maxX = c.maxX - Math.min(inset, sx * 0.12);
        const minY = c.minY;
        const maxY = c.maxY - inset;
        const minZ = c.minZ + Math.min(inset, sz * 0.12);
        const maxZ = c.maxZ - Math.min(inset, sz * 0.12);
        if (maxX <= minX || maxY <= minY || maxZ <= minZ) continue;

        this.occluders.push({
          minX,
          maxX,
          minY,
          maxY,
          minZ,
          maxZ,
          cx: (minX + maxX) * 0.5,
          cy: (minY + maxY) * 0.5,
          cz: (minZ + maxZ) * 0.5,
          area: maxHoriz * sy,
          camDistSq: 0,
        });
      }
    }

    // 2. Register static occludable scene clusters (building exteriors, building interiors, street props)
    for (let i = 0; i < arena.occludables.length; i++) {
      const spec = arena.occludables[i];
      _tmpBox.setFromObject(spec.object);
      if (_tmpBox.isEmpty()) continue;

      const pad = spec.kind === 'building' ? 0.35 : 0.18;
      const minX = _tmpBox.min.x;
      const maxX = _tmpBox.max.x;
      const minY = _tmpBox.min.y;
      const maxY = _tmpBox.max.y;
      const minZ = _tmpBox.min.z;
      const maxZ = _tmpBox.max.z;

      const paddedBox = new THREE.Box3(
        new THREE.Vector3(minX - pad, minY - pad, minZ - pad),
        new THREE.Vector3(maxX + pad, maxY + pad, maxZ + pad),
      );

      this.statics.push({
        object: spec.object,
        kind: spec.kind,
        buildingIdx: spec.buildingIdx ?? -1,
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        cx: (minX + maxX) * 0.5,
        cy: (minY + maxY) * 0.5,
        cz: (minZ + maxZ) * 0.5,
        box: paddedBox,
        occludedFrames: 0,
        culled: false,
      });
    }
  }

  public getStats(): OcclusionStats {
    return this.stats;
  }

  /** Restores visibility on all tracked static clusters (e.g., for aerial title orbit or cleanup). */
  public revealAll(): void {
    for (let i = 0; i < this.statics.length; i++) {
      const e = this.statics[i];
      e.occludedFrames = 0;
      e.culled = false;
      e.object.visible = true;
    }
  }

  /**
   * Executes one frame of Frustum + Conservative Thick-Wall Occlusion Culling.
   * Call right after updating camera transform and immediately before renderer.render() / composer.render().
   */
  public update(
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    enemies: DynamicOccludableActor[],
    pickups: DynamicOccludablePickup[],
    decals: THREE.Mesh[],
  ): void {
    camera.updateMatrixWorld();
    _projScreenMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMat);
    _camPos.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(_camFwd);

    const camX = _camPos.x;
    const camY = _camPos.y;
    const camZ = _camPos.z;

    // Identify which building (if any) the player/camera currently occupies so its interior is NEVER culled
    let occupiedBuildingIdx = -1;
    for (let i = 0; i < this.buildingFootprints.length; i++) {
      const bf = this.buildingFootprints[i];
      if (Math.abs(playerPos.x - bf.cx) < bf.w * 0.58 && Math.abs(playerPos.z - bf.cz) < bf.d * 0.58) {
        occupiedBuildingIdx = i;
        break;
      }
    }

    // 1. Select & front-to-back sort the active visible thick-wall occluders
    this.selectActiveOccluders(camX, camY, camZ);
    const activeCount = this.activeOccluders.length;

    let culledStatic = 0;
    let culledDynamic = 0;

    // 2. Cull static scene clusters (building shells, building interiors, street cover props)
    for (let i = 0; i < this.statics.length; i++) {
      const e = this.statics[i];

      // Never cull the building or interior the player is currently inside (or standing on its porch)
      if (e.buildingIdx >= 0 && e.buildingIdx === occupiedBuildingIdx) {
        e.occludedFrames = 0;
        if (e.culled) {
          e.culled = false;
          e.object.visible = true;
        }
        continue;
      }

      // Never cull if camera lies inside or right against the cluster's padded bounding volume
      if (
        camX >= e.minX - 1.2 &&
        camX <= e.maxX + 1.2 &&
        camY >= e.minY - 0.8 &&
        camY <= e.maxY + 0.8 &&
        camZ >= e.minZ - 1.2 &&
        camZ <= e.maxZ + 1.2
      ) {
        e.occludedFrames = 0;
        if (e.culled) {
          e.culled = false;
          e.object.visible = true;
        }
        continue;
      }

      const ddx = e.cx - camX;
      const ddz = e.cz - camZ;
      const distSq = ddx * ddx + ddz * ddz;

      const inFrustum = _frustum.intersectsBox(e.box);
      let shouldHide = false;

      if (!inFrustum) {
        // Protect shadows cast into the visible street by nearby tall exterior buildings behind the camera
        if (e.kind === 'building' && distSq < 34 * 34) {
          shouldHide = false;
        } else {
          shouldHide = true;
        }
      } else if (activeCount > 0) {
        // Inside view frustum -> test conservative 3D occlusion behind active thick walls
        // For tall exterior building shells, only wall-cull beyond 18m so nearby shadows remain rock-solid
        if (e.kind !== 'building' || distSq > 18 * 18) {
          shouldHide = this.isBoxOccluded(camX, camY, camZ, e.minX, e.maxX, e.minY, e.maxY, e.minZ, e.maxZ);
        }
      }

      if (shouldHide) {
        // Asymmetric hysteresis: 2-frame grace before hiding behind a wall (instant for frustum-out non-buildings)
        if (!inFrustum || ++e.occludedFrames >= 2) {
          if (!e.culled) {
            e.culled = true;
            e.object.visible = false;
          }
          culledStatic++;
        }
      } else {
        // Instant 0-frame reveal -> zero visual pop-in when turning or peeking around corners
        e.occludedFrames = 0;
        if (e.culled) {
          e.culled = false;
          e.object.visible = true;
        }
      }
    }

    // 3. Cull dynamic combat actors (enemies behind thick walls or outside frustum)
    //    Note: AI, physics, and raycasting still run normally; only GPU draw calls are skipped!
    for (let i = 0; i < enemies.length; i++) {
      const en = enemies[i];
      if (!en.alive) continue;
      const p = en.root.position;
      const r = en.radius + 0.28;
      const minY = en.hoverBaseY ? Math.max(0.2, en.hoverBaseY - 0.85) : p.y;
      const maxY = en.hoverBaseY ? en.hoverBaseY + 0.85 : p.y + (en.height ?? 2.15);

      _dynBox.min.set(p.x - r, minY, p.z - r);
      _dynBox.max.set(p.x + r, maxY, p.z + r);

      const dSq = (p.x - camX) * (p.x - camX) + (p.z - camZ) * (p.z - camZ);
      let occluded = false;
      if (dSq > 6.5 * 6.5) {
        if (!_frustum.intersectsBox(_dynBox)) {
          occluded = true;
        } else if (activeCount > 0) {
          occluded = this.isBoxOccluded(camX, camY, camZ, p.x - r, p.x + r, minY, maxY, p.z - r, p.z + r);
        }
      }
      en.root.visible = !occluded;
      if (occluded) culledDynamic++;
    }

    // 4. Cull dynamic glowing supply pickups behind thick walls or outside frustum
    for (let i = 0; i < pickups.length; i++) {
      const pk = pickups[i];
      if (!pk.active) continue;
      const p = pk.pos;
      const r = 0.55;
      _dynBox.min.set(p.x - r, p.y - 0.5, p.z - r);
      _dynBox.max.set(p.x + r, p.y + 0.65, p.z + r);

      let occluded = false;
      if (!_frustum.intersectsBox(_dynBox)) {
        occluded = true;
      } else if (activeCount > 0) {
        occluded = this.isBoxOccluded(camX, camY, camZ, p.x - r, p.x + r, p.y - 0.5, p.y + 0.65, p.z - r, p.z + r);
      }
      pk.group.visible = !occluded;
      if (occluded) culledDynamic++;
    }

    // 5. Cull pooled bullet impact decals behind thick walls or behind camera
    for (let i = 0; i < decals.length; i++) {
      const d = decals[i];
      // Only test decals that have been placed (scale > 0 and active in scene)
      if (!d.userData.placed) continue;
      const p = d.position;
      const dx = p.x - camX;
      const dy = p.y - camY;
      const dz = p.z - camZ;
      const dotFwd = dx * _camFwd.x + dy * _camFwd.y + dz * _camFwd.z;
      if (dotFwd < -0.5) {
        d.visible = false;
        culledDynamic++;
        continue;
      }
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > 46 * 46) {
        d.visible = false;
        culledDynamic++;
        continue;
      }
      if (activeCount > 0 && distSq > 4.0) {
        const blocked = this.isPointBlockedByAnyOccluder(camX, camY, camZ, p.x, p.y, p.z);
        d.visible = !blocked;
        if (blocked) culledDynamic++;
      } else {
        d.visible = true;
      }
    }

    this.stats.totalTracked = this.statics.length + enemies.length + pickups.length;
    this.stats.culledStatic = culledStatic;
    this.stats.culledDynamic = culledDynamic;
    this.stats.activeOccluders = activeCount;
  }

  /**
   * Filters thick opaque wall occluders down to the closest, largest walls in front of the camera.
   * Uses insertion sort directly on the pre-allocated array (zero heap allocations).
   */
  private selectActiveOccluders(camX: number, camY: number, camZ: number): void {
    const active = this.activeOccluders;
    active.length = 0;

    const fx = _camFwd.x;
    const fy = _camFwd.y;
    const fz = _camFwd.z;
    const maxDistSq = 62 * 62;

    for (let i = 0; i < this.occluders.length; i++) {
      const w = this.occluders[i];
      // Skip occluder if camera is inside it
      if (camX >= w.minX && camX <= w.maxX && camY >= w.minY && camY <= w.maxY && camZ >= w.minZ && camZ <= w.maxZ) {
        continue;
      }

      const dx = w.cx - camX;
      const dy = w.cy - camY;
      const dz = w.cz - camZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > maxDistSq) continue;

      // Must be generally in front of camera (generous margin for wide walls close to player)
      const dot = dx * fx + dy * fy + dz * fz;
      if (dot < -5.5) continue;

      w.camDistSq = distSq;
      active.push(w);
    }

    // Insertion sort front-to-back by distance (n <= ~70, virtually sorted across frames -> O(n)!)
    for (let i = 1; i < active.length; i++) {
      const key = active[i];
      const keyDist = key.camDistSq;
      let j = i - 1;
      while (j >= 0 && active[j].camDistSq > keyDist) {
        active[j + 1] = active[j];
        j--;
      }
      active[j + 1] = key;
    }

    if (active.length > this.maxActiveOccluders) {
      active.length = this.maxActiveOccluders;
    }
  }

  /**
   * Conservative 3D occlusion test for an AABB against the active front-to-back thick wall occluders.
   *
   * 1. Fast Exact Convex Path: If ANY single thick wall occluder intercepts all 8 AABB corners
   *    strictly before reaching them, convexity mathematically guarantees 100% occlusion.
   * 2. Combined Multi-Wall Path: For L-shaped building corners & street facades, checks all
   *    13 conservative silhouette points (8 corners + 4 vertical mid-edges + center); only
   *    returns true if EVERY SINGLE point is blocked by an opaque wall occluder.
   */
  private isBoxOccluded(
    camX: number,
    camY: number,
    camZ: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
  ): boolean {
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    // Populate 13 conservative sample points on the occludee AABB (zero allocations)
    const sx = this.sampleX;
    const sy = this.sampleY;
    const sz = this.sampleZ;

    // 0: Center (tested first for ultra-fast early rejection when clearly visible!)
    sx[0] = cx; sy[0] = cy; sz[0] = cz;
    // 1..8: All 8 AABB corners
    sx[1] = minX; sy[1] = minY; sz[1] = minZ;
    sx[2] = maxX; sy[2] = minY; sz[2] = minZ;
    sx[3] = minX; sy[3] = maxY; sz[3] = minZ;
    sx[4] = maxX; sy[4] = maxY; sz[4] = minZ;
    sx[5] = minX; sy[5] = minY; sz[5] = maxZ;
    sx[6] = maxX; sy[6] = minY; sz[6] = maxZ;
    sx[7] = minX; sy[7] = maxY; sz[7] = maxZ;
    sx[8] = maxX; sy[8] = maxY; sz[8] = maxZ;
    // 9..12: 4 vertical face centers (catches wide buildings spanning across a doorway gap!)
    sx[9] = cx;   sy[9] = cy;   sz[9] = minZ;
    sx[10] = cx;  sy[10] = cy;  sz[10] = maxZ;
    sx[11] = minX; sy[11] = cy; sz[11] = cz;
    sx[12] = maxX; sy[12] = cy; sz[12] = cz;

    const active = this.activeOccluders;
    const activeLen = active.length;

    // Early out: if center point isn't blocked by ANY active thick wall, object is immediately visible!
    let centerBlockerIdx = -1;
    for (let j = 0; j < activeLen; j++) {
      if (this.rayBlockedByWall(camX, camY, camZ, cx, cy, cz, active[j])) {
        centerBlockerIdx = j;
        break;
      }
    }
    if (centerBlockerIdx < 0) return false;

    // Fast path: check if the SAME single wall occluder covers all 8 corners (exact convex occlusion!)
    const primaryWall = active[centerBlockerIdx];
    let singleCoversAll = true;
    for (let p = 1; p <= 8; p++) {
      if (!this.rayBlockedByWall(camX, camY, camZ, sx[p], sy[p], sz[p], primaryWall)) {
        singleCoversAll = false;
        break;
      }
    }
    if (singleCoversAll) return true;

    // Multi-wall conservative path: every single one of the remaining 12 silhouette points must be blocked
    for (let p = 1; p < 13; p++) {
      const px = sx[p];
      const py = sy[p];
      const pz = sz[p];
      let blocked = false;
      // Try primary blocker first for high branch-prediction hit rate
      if (this.rayBlockedByWall(camX, camY, camZ, px, py, pz, primaryWall)) {
        blocked = true;
      } else {
        for (let j = 0; j < activeLen; j++) {
          if (j === centerBlockerIdx) continue;
          if (this.rayBlockedByWall(camX, camY, camZ, px, py, pz, active[j])) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) return false;
    }

    return true;
  }

  private isPointBlockedByAnyOccluder(
    camX: number,
    camY: number,
    camZ: number,
    px: number,
    py: number,
    pz: number,
  ): boolean {
    const active = this.activeOccluders;
    for (let j = 0; j < active.length; j++) {
      if (this.rayBlockedByWall(camX, camY, camZ, px, py, pz, active[j])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Inline slab ray-segment vs. thick wall AABB test.
   * Returns true strictly when the segment (cam -> target) enters the opaque wall
   * strictly BEFORE reaching the target point (0.002 < tEnter < 0.985).
   */
  private rayBlockedByWall(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    w: OccluderWall,
  ): boolean {
    let tmin = 0.002;
    let tmax = 0.985;

    const dx = x1 - x0;
    if (dx === 0) {
      if (x0 < w.minX || x0 > w.maxX) return false;
    } else {
      const inv = 1 / dx;
      let t1 = (w.minX - x0) * inv;
      let t2 = (w.maxX - x0) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }

    const dy = y1 - y0;
    if (dy === 0) {
      if (y0 < w.minY || y0 > w.maxY) return false;
    } else {
      const inv = 1 / dy;
      let t1 = (w.minY - y0) * inv;
      let t2 = (w.maxY - y0) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }

    const dz = z1 - z0;
    if (dz === 0) {
      if (z0 < w.minZ || z0 > w.maxZ) return false;
    } else {
      const inv = 1 / dz;
      let t1 = (w.minZ - z0) * inv;
      let t2 = (w.maxZ - z0) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }

    return tmin < tmax;
  }
}
