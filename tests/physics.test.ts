import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWestTownArena, ArenaData } from '../src/game/arena';
import { PhysicsWorld } from '../src/game/physics';
import type { ProceduralTextures } from '../src/game/textures';

function createStubTextures(): ProceduralTextures {
  const tex = new THREE.DataTexture(new Uint8Array([200, 180, 150, 255]), 1, 1);
  tex.needsUpdate = true;
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'dispose') return () => tex.dispose();
        if (prop === 'createSignTexture') return () => tex;
        return tex;
      },
    },
  ) as ProceduralTextures;
}

function buildTestPhysics(): { arena: ArenaData; physics: PhysicsWorld } {
  const textures = createStubTextures();
  const arena = buildWestTownArena(textures);
  const physics = new PhysicsWorld(arena);
  return { arena, physics };
}

test('building walls and corners block a sprinting/dashing player capsule without tunneling', () => {
  const { arena, physics } = buildTestPhysics();
  // Find a tall thick wall on the WEST map (e.g. a building exterior wall)
  const wall = physics.bodies.find(
    (b) => b.isThickWall && b.minY <= 0.3 && b.maxY >= 3.2 && b.maxX - b.minX >= 3.0 && b.maxZ - b.minZ <= 0.7,
  );
  assert.ok(wall, 'Expected to find a solid building wall body');

  const centerX = (wall.minX + wall.maxX) * 0.5;
  const startZ = wall.maxZ + 1.8;
  const body = PhysicsWorld.createCapsuleBody(
    new THREE.Vector3(centerX, 0.24, startZ),
    new THREE.Vector3(0, 0, -24),
    0.56,
    1.84,
    0.32,
  );

  // Charge hard into the wall for 0.6s at dash speed
  for (let i = 0; i < 36; i++) {
    body.velocity.z = -24;
    physics.stepCapsule(body, 1 / 60, 0);
  }

  assert.ok(
    body.position.z >= wall.maxZ + body.radius - 0.02,
    `Player capsule penetrated wall: posZ=${body.position.z.toFixed(3)}, expected >= ${(wall.maxZ + body.radius).toFixed(3)}`,
  );
  assert.equal(body.hitWall, true);
  arena.dispose();
});

test('interior staircases have solid underside colliders while top ramps remain walkable', () => {
  const { arena, physics } = buildTestPhysics();
  assert.ok(arena.ramps.length > 0, 'Expected at least one walkable interior staircase ramp');
  const ramp = arena.ramps[0];

  // Top surface of the ramp should elevate as we move from lowEdge to highEdge
  const midX = (ramp.minX + ramp.maxX) * 0.5;
  const midZ = (ramp.minZ + ramp.maxZ) * 0.5;
  const groundAtMid = physics.sampleGroundAt(midX, midZ, (ramp.lowY + ramp.highY) * 0.5 + 0.1, 0.4, 0.32);
  assert.ok(groundAtMid.y > ramp.lowY + 0.5, 'Staircase ramp should support player smoothly mid-flight');

  // High end of the staircase must contain solid core colliders beneath the stairs (preventing hollow clip-through)
  const highEndX = ramp.axis === 'x' ? ramp.lowEdge + (ramp.highEdge - ramp.lowEdge) * 0.8 : midX;
  const highEndZ = ramp.axis === 'z' ? ramp.lowEdge + (ramp.highEdge - ramp.lowEdge) * 0.8 : midZ;
  const hasUnderStairSolid = physics.bodies.some(
    (b) =>
      highEndX >= b.minX - 0.25 &&
      highEndX <= b.maxX + 0.25 &&
      highEndZ >= b.minZ - 0.25 &&
      highEndZ <= b.maxZ + 0.25 &&
      b.minY <= ramp.lowY + 0.2 &&
      b.maxY >= ramp.lowY + 1.2 &&
      b.maxY <= ramp.highY + 0.2,
  );
  assert.equal(hasUnderStairSolid, true, 'Expected solid structural core colliders underneath interior staircase');
  arena.dispose();
});

test('resolveCameraSphere pushes camera cleanly outside walls and ceilings in full 3D', () => {
  const { arena, physics } = buildTestPhysics();
  const wall = physics.bodies.find(
    (b) => b.isThickWall && b.minY <= 0.3 && b.maxY >= 3.2 && b.maxX - b.minX >= 3.0 && b.maxZ - b.minZ <= 0.7,
  );
  assert.ok(wall, 'Expected a solid wall body');

  // Place camera flush inside the +Z face of the wall and verify it is pushed outside by full camera radius
  const camRadius = 0.28;
  const camPos = new THREE.Vector3((wall.minX + wall.maxX) * 0.5, 1.7, wall.maxZ - 0.05);
  const collided = physics.resolveCameraSphere(camPos, camRadius);

  assert.equal(collided, true);
  assert.ok(
    camPos.z >= wall.maxZ + camRadius - 0.005,
    `Camera sphere still too close to wall: camZ=${camPos.z.toFixed(3)}, expected >= ${(wall.maxZ + camRadius).toFixed(3)}`,
  );
  arena.dispose();
});
