import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDynamicCrosshair,
  computeRecoilIntensity,
  resolveMovementState,
} from '../src/game/crosshair';

test('resolveMovementState prioritizes dashing, sliding, airborne, sprinting, crouching, walking, idle', () => {
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: true,
      sliding: true,
      sprinting: true,
      crouching: true,
      horizontalSpeed: 10,
    }),
    'dashing',
  );
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: false,
      sliding: true,
      sprinting: true,
      crouching: true,
      horizontalSpeed: 10,
    }),
    'sliding',
  );
  assert.equal(
    resolveMovementState({
      grounded: false,
      dashing: false,
      sliding: false,
      sprinting: true,
      crouching: false,
      horizontalSpeed: 6,
    }),
    'airborne',
  );
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: false,
      sliding: false,
      sprinting: true,
      crouching: false,
      horizontalSpeed: 9.5,
    }),
    'sprinting',
  );
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: false,
      sliding: false,
      sprinting: false,
      crouching: true,
      horizontalSpeed: 0,
    }),
    'crouching',
  );
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: false,
      sliding: false,
      sprinting: false,
      crouching: false,
      horizontalSpeed: 4.2,
    }),
    'walking',
  );
  assert.equal(
    resolveMovementState({
      grounded: true,
      dashing: false,
      sliding: false,
      sprinting: false,
      crouching: false,
      horizontalSpeed: 0.05,
    }),
    'idle',
  );
});

test('dynamic crosshair contracts on crouch and expands monotonically with movement state and recoil intensity', () => {
  const crouchIdle = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'crouching',
    moveSpeedRatio: 0,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const standingIdle = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const walking = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'walking',
    moveSpeedRatio: 0.55,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const sprinting = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'sprinting',
    moveSpeedRatio: 0.95,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const airborne = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'airborne',
    moveSpeedRatio: 0.6,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });

  assert.ok(crouchIdle.gapPx < standingIdle.gapPx, 'Crouching should contract the crosshair tighter than standing idle');
  assert.ok(standingIdle.gapPx < walking.gapPx, 'Walking should expand the crosshair wider than idle');
  assert.ok(walking.gapPx < sprinting.gapPx, 'Sprinting should expand the crosshair wider than walking');
  assert.ok(sprinting.gapPx <= airborne.gapPx, 'Airborne spread should be at least as wide as sprinting');

  const midRecoil = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0.45,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const highRecoil = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0.95,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });

  assert.ok(standingIdle.gapPx < midRecoil.gapPx && midRecoil.gapPx < highRecoil.gapPx);
  assert.ok(highRecoil.tickLengthPx > standingIdle.tickLengthPx);
  assert.ok(highRecoil.recoilHeat > midRecoil.recoilHeat);
});

test('computeRecoilIntensity stays clamped within [0, 1] and increases with spread and kick', () => {
  const calm = computeRecoilIntensity({ dynamicSpread: 0, gunShakeTrauma: 0, gunKickPitch: 0 });
  const burst = computeRecoilIntensity({ dynamicSpread: 0.015, gunShakeTrauma: 0.4, gunKickPitch: 0.02 });
  const maxed = computeRecoilIntensity({ dynamicSpread: 0.1, gunShakeTrauma: 2, gunKickPitch: 0.2 });

  assert.equal(calm, 0);
  assert.ok(burst > 0.3 && burst < 1);
  assert.equal(maxed, 1);
});

test('dynamic crosshair adapts reticle style per weapon and hides cleanly during ADS or scope', () => {
  const shotgun = computeDynamicCrosshair({
    weaponId: 'shotgun',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const rpg = computeDynamicCrosshair({
    weaponId: 'rpg',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0,
    ads: false,
    scopeAlpha: 0,
    reloading: false,
  });
  const adsCarbine = computeDynamicCrosshair({
    weaponId: 'carbine',
    movementState: 'idle',
    moveSpeedRatio: 0,
    recoilIntensity: 0.2,
    ads: true,
    scopeAlpha: 0,
    reloading: false,
  });

  assert.equal(shotgun.style, 'circle');
  assert.equal(rpg.style, 'bracket');
  assert.equal(adsCarbine.outerOpacity, 0);
  assert.equal(adsCarbine.centerDotOpacity, 0);
});
