import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { DEFAULT_LOADOUT, inventoryWeapons, normalizeLoadout, PRIMARY_WEAPONS } from '../src/game/loadout';
import { WEAPON_SPECS, Loadout, WeaponId } from '../src/game/types';
import { FirstPersonWeaponRig } from '../src/game/weapon';
import { OutpostGameEngine } from '../src/game/engine';
import type { ProceduralTextures } from '../src/game/textures';

test('loadouts enforce two distinct primary weapons and valid equipment categories', () => {
  for (const first of PRIMARY_WEAPONS) {
    for (const second of PRIMARY_WEAPONS) {
      const result = normalizeLoadout({ ...DEFAULT_LOADOUT, primary: [first, second] });
      assert.equal(result.primary.length, 2);
      assert.notEqual(result.primary[0], result.primary[1]);
      assert.equal(result.primary[0], first);
      assert.equal(inventoryWeapons(result).length, 4);
    }
  }
  const invalid = normalizeLoadout({ primary: ['usp', 'rpg'], sidearm: 'carbine', launcher: 'shotgun', grenade: 'bad' } as unknown as Loadout);
  assert.deepEqual(invalid, { primary: ['carbine', 'shotgun'], sidearm: 'usp', launcher: 'rpg', grenade: 'frag' });
  const light = normalizeLoadout({ ...DEFAULT_LOADOUT, launcher: null });
  assert.equal(inventoryWeapons(light).length, 3);
  assert.ok(!inventoryWeapons(light).includes('rpg'));
  const copy = normalizeLoadout();
  copy.primary[0] = 'smg';
  assert.equal(DEFAULT_LOADOUT.primary[0], 'carbine');
});

test('every selectable weapon has a visible exclusive first person model', () => {
  const texture = new THREE.CanvasTexture({ width: 1, height: 1 } as HTMLCanvasElement);
  const rig = new FirstPersonWeaponRig(new Proxy({}, { get: () => texture }) as ProceduralTextures);
  const parts = rig as any;
  for (const id of [...Object.keys(WEAPON_SPECS), 'carbine', 'shotgun', 'carbine'] as WeaponId[]) {
    rig.setWeapon(id);
    const models = [parts.carbineGroup, parts.railGroup, ...parts.equipmentModels.values()] as THREE.Group[];
    assert.equal(models.filter(model => model.visible).length, 1, id);
    const visible = models.find(model => model.visible)!;
    assert.ok(!new THREE.Box3().setFromObject(visible).isEmpty(), id);
    if (id !== 'carbine' && id !== 'railpistol') {
      for (const name of ['operator-left-gloved-hand', 'operator-right-gloved-hand']) {
        const hand = visible.getObjectByName(name);
        assert.ok(hand && hand.visible, id + ': missing ' + name);
        assert.ok(!new THREE.Box3().setFromObject(hand).isEmpty());
      }
    }
    const muzzle = new THREE.Vector3();
    rig.getMuzzleWorldPosition(muzzle);
    assert.ok(muzzle.toArray().every(Number.isFinite));
  }
  rig.dispose();
  texture.dispose();
});

test('unequipped weapons cannot be selected; equipped sidearm and launcher can', () => {
  const engine = Object.create(OutpostGameEngine.prototype) as any;
  engine.phase = 'playing';
  engine.loadout = normalizeLoadout({ ...DEFAULT_LOADOUT, primary: ['shotgun', 'smg'] });
  engine.weaponId = 'shotgun';
  engine.weaponRig = { setWeapon: () => {}, setScopeOverlayHidden: () => {} };
  engine.emitHud = () => {};
  engine.selectWeapon('railpistol');
  assert.equal(engine.weaponId, 'shotgun');
  for (const id of ['smg', engine.loadout.sidearm, 'rpg']) { engine.selectWeapon(id); assert.equal(engine.weaponId, id); }
});

test('grenades respect phase, inventory, cooldown and selected type', () => {
  const engine = Object.create(OutpostGameEngine.prototype) as any;
  engine.phase = 'title'; engine.grenadesRemaining = 3; engine.grenadeCooldown = 0;
  engine.loadout = { ...DEFAULT_LOADOUT, grenade: 'smoke' };
  const launched: unknown[][] = [];
  engine.launchOrdnance = (...args: unknown[]) => launched.push(args);
  const presented: string[] = [];
  engine.weaponRig = { triggerGrenadeThrow: (id:string) => presented.push(id) };
  engine.ordnance=[]; engine.zones=[];
  engine.emitHud = () => {};
  engine.throwGrenade(); assert.equal(engine.grenadesRemaining, 3);
  engine.phase = 'playing'; engine.throwGrenade();
  assert.equal(engine.grenadesRemaining, 2); assert.deepEqual(presented,['smoke']);
  assert.equal(launched.length,0,'Projectile waits for the hand release');
  engine.updateOrdnance(.2); assert.equal(launched.length,0);
  engine.updateOrdnance(.19); assert.equal(launched[0][0],'smoke');
  engine.throwGrenade(); assert.equal(engine.grenadesRemaining, 2);
  engine.grenadeCooldown = 0; engine.grenadesRemaining = 0;
  engine.throwGrenade(); assert.equal(launched.length, 1);
});

test('area damage respects walls, range, dead targets and kill attribution', () => {
  const engine = Object.create(OutpostGameEngine.prototype) as any;
  const makeEnemy = (x: number, alive = true) => ({ alive, hp: 50, root: new THREE.Group(), kind: 'striker', x });
  engine.enemies = [makeEnemy(1), makeEnemy(3), makeEnemy(12), makeEnemy(1, false)];
  engine.enemies.forEach((e: any) => e.root.position.set(e.x, 0, 0));
  engine.physics = { raycastSegment: (_x: number, _y: number, _z: number, x: number) => x === 3 };
  engine.projRayHit = {};
  engine.hitMarkerSeq = 0;
  engine.spawnDamageNumber = () => {};
  let killedWith = '';
  engine.handleEnemyKilled = (_e: unknown, _head: boolean, _point: unknown, source: string) => { killedWith = source; };
  engine.areaDamage(new THREE.Vector3(0, 0.9, 0), 6, 180, 'rpg');
  assert.ok(engine.enemies[0].hp <= 0);
  assert.equal(engine.enemies[1].hp, 50);
  assert.equal(engine.enemies[2].hp, 50);
  assert.equal(engine.enemies[3].hp, 50);
  assert.equal(killedWith, 'rpg');
});

test('scope zoom works for sniper and marksman, and ignores pistols', () => {
  const engine = Object.create(OutpostGameEngine.prototype) as any;
  engine.phase = 'playing'; engine.scopeZoomLevel = 6; engine.emitHud = () => {};
  for (const id of ['railpistol', 'marksman']) {
    engine.weaponId = id;
    engine.scopeZoomLevel = 6;
    engine.toggleScopeZoom(); assert.equal(engine.scopeZoomLevel, 10);
    engine.toggleScopeZoom(); assert.equal(engine.scopeZoomLevel, 6);
  }
  engine.weaponId = 'glock'; engine.toggleScopeZoom();
  assert.equal(engine.scopeZoomLevel, 6);
});
