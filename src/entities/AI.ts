/**
 * Staggered, Terrain-Aware, Storm-Aware AI Combatant Controller.
 * Prevents bots from getting stuck on walls, seeing through solids, or lingering indefinitely in storm.
 */

import * as THREE from 'three';
import { EnemyEntity } from '../game/enemies';
import { PhysicsWorld } from '../game/physics';
import { StormController } from '../gameplay/Storm';

export interface AiSteerContext {
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  physics: PhysicsWorld;
  storm?: StormController;
  isIsland: boolean;
}

export function stepGroundEnemyMovement(
  e: EnemyEntity,
  allEnemies: EnemyEntity[],
  selfIndex: number,
  dt: number,
  ctx: AiSteerContext,
): { distToPlayer: number; moveSpeedNow: number; dxToPlayer: number; dzToPlayer: number } {
  // Check if bot is outside or close to storm boundary on island -> prioritize moving inward!
  let targetX = ctx.playerPos.x;
  let targetZ = ctx.playerPos.z;
  let stormUrgency = false;

  if (ctx.isIsland && ctx.storm) {
    const distStormCenter = Math.hypot(e.root.position.x - ctx.storm.centerX, e.root.position.z - ctx.storm.centerZ);
    if (distStormCenter > Math.max(20, ctx.storm.radius - 18)) {
      targetX = ctx.storm.centerX;
      targetZ = ctx.storm.centerZ;
      stormUrgency = true;
    }
  }

  const dx = targetX - e.root.position.x;
  const dz = targetZ - e.root.position.z;
  const dist = Math.hypot(dx, dz) || 0.001;

  const dxPlayer = ctx.playerPos.x - e.root.position.x;
  const dzPlayer = ctx.playerPos.z - e.root.position.z;
  const distToPlayer = Math.hypot(dxPlayer, dzPlayer) || 0.001;

  // Smoothly face engagement target (player if within combat radius, otherwise movement direction)
  const faceDx = !stormUrgency && distToPlayer < 85 ? dxPlayer : dx;
  const faceDz = !stormUrgency && distToPlayer < 85 ? dzPlayer : dz;
  const desiredYaw = Math.atan2(faceDx, faceDz);
  let yawDiff = desiredYaw - e.root.rotation.y;
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
  e.root.rotation.y += yawDiff * Math.min(1, dt * 8);

  e.strafeTimer -= dt;
  if (e.strafeTimer <= 0) {
    e.strafeDir *= -1;
    e.strafeTimer = 1.4 + Math.random() * 1.6;
  }

  const moveFactor = e.isWindingUp ? 0.25 : 1.0;
  const nx = dx / dist;
  const nz = dz / dist;
  const rx = -nz;
  const rz = nx;

  let vx = 0;
  let vz = 0;
  if (stormUrgency || dist > e.preferredRange + 2.0) {
    vx += nx * e.speed;
    vz += nz * e.speed;
  } else if (dist < e.preferredRange - 3.5) {
    vx -= nx * e.speed * 0.65;
    vz -= nz * e.speed * 0.65;
  }
  vx += rx * e.strafeDir * e.speed * (stormUrgency ? 0.22 : 0.58);
  vz += rz * e.strafeDir * e.speed * (stormUrgency ? 0.22 : 0.58);

  // Soft entity separation
  for (let j = 0; j < allEnemies.length; j++) {
    if (selfIndex === j || !allEnemies[j].alive) continue;
    const other = allEnemies[j];
    const sx = e.root.position.x - other.root.position.x;
    const sz = e.root.position.z - other.root.position.z;
    const sdSq = sx * sx + sz * sz;
    const minSep = e.radius + other.radius + 0.6;
    if (sdSq < minSep * minSep && sdSq > 0.001) {
      const sd = Math.sqrt(sdSq);
      vx += (sx / sd) * 3.5;
      vz += (sz / sd) * 3.5;
    }
  }

  const edx = vx * moveFactor * dt;
  const edz = vz * moveFactor * dt;

  if (e.kind !== 'wasp') {
    const prevX = e.root.position.x;
    const prevZ = e.root.position.z;
    const subSteps = Math.max(1, Math.ceil(Math.hypot(edx, edz) / 0.18));
    const stepX = edx / subSteps;
    const stepZ = edz / subSteps;
    for (let s = 0; s < subSteps; s++) {
      e.root.position.x += stepX;
      e.root.position.z += stepZ;
      ctx.physics.resolveCapsuleHorizontal(e.root.position, e.radius, 1.85, 0.32);
    }
    // Stuck recovery: flip strafe direction if blocked against wall/corner
    if (Math.hypot(e.root.position.x - prevX, e.root.position.z - prevZ) < Math.hypot(edx, edz) * 0.15) {
      e.strafeDir *= -1;
      e.strafeTimer = 0.7;
    }

    const targetFloor = ctx.physics.sampleGroundAt(
      e.root.position.x,
      e.root.position.z,
      e.root.position.y,
      e.radius,
      0.32,
    ).y;
    e.root.position.y = THREE.MathUtils.damp(e.root.position.y, targetFloor, 14, dt);
  } else {
    const nextPos = new THREE.Vector3(e.root.position.x + edx, e.hoverBaseY, e.root.position.z + edz);
    ctx.physics.resolveSphere(nextPos, e.radius + 0.16);
    e.root.position.x = nextPos.x;
    e.root.position.z = nextPos.z;
  }

  return {
    distToPlayer,
    moveSpeedNow: Math.hypot(vx, vz) * moveFactor,
    dxToPlayer: dxPlayer,
    dzToPlayer: dzPlayer,
  };
}
