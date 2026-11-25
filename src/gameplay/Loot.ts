/**
 * Seeded Ground Loot Spawner & Interactive Pickup System for Battle Royale POIs.
 */

import * as THREE from 'three';
import { GrenadeId, LootPromptHud, WeaponId, WEAPON_SPECS } from '../game/types';
import { GRENADES } from '../game/loadout';
import { SeededRng } from '../utilities/SeededRng';
import { sampleIslandHeight } from '../world/Terrain';

export type LootCategory = 'crate' | 'weapon' | 'ammo' | 'armor' | 'medical' | 'grenade';
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface WorldLootItem {
  id: string;
  active: boolean;
  category: LootCategory;
  rarity: LootRarity;
  label: string;
  weaponId?: WeaponId;
  crateWeapons?: WeaponId[];
  grenadeId?: GrenadeId;
  amount: number;
  pos: THREE.Vector3;
  mesh: THREE.Group;
}

const RARITY_HEX: Record<LootRarity, number> = {
  common: 0x94a3b8,
  uncommon: 0x60be8b,
  rare: 0x52c7de,
  epic: 0xe9b94c,
};

export class LootManager {
  public readonly items: WorldLootItem[] = [];
  private readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private nextId = 1;

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'BattleRoyale_GroundLoot';
    scene.add(this.root);
  }

  public clear(): void {
    for (const item of this.items) {
      item.mesh.removeFromParent();
    }
    this.items.length = 0;
  }

  public spawnSeededPoiLoot(
    anchors: Array<{ pos: THREE.Vector3; poiId: string; tier: 'standard' | 'high' | 'military' }>,
    seed: number,
  ): void {
    this.clear();
    const rng = new SeededRng(seed + 8821);

    const standardWeapons: WeaponId[] = ['smg', 'shotgun', 'carbine', 'glock', 'usp'];
    const highWeapons: WeaponId[] = ['carbine', 'marksman', 'shotgun', 'deagle', 'smg'];
    const milWeapons: WeaponId[] = ['railpistol', 'machinegun', 'marksman', 'rpg', 'grenadelauncher', 'deagle'];
    const grenades: GrenadeId[] = ['frag', 'smoke', 'molotov', 'flashbang'];

    const boxGeo = new THREE.BoxGeometry(0.56, 0.24, 0.36);
    const plateGeo = new THREE.BoxGeometry(0.42, 0.14, 0.46);
    const beaconGeo = new THREE.RingGeometry(0.32, 0.42, 16);
    beaconGeo.rotateX(-Math.PI / 2);
    this.geometries.push(boxGeo, plateGeo, beaconGeo);

    const tierMats: Record<LootRarity, THREE.MeshBasicMaterial> = {
      common: new THREE.MeshBasicMaterial({ color: RARITY_HEX.common, side: THREE.DoubleSide }),
      uncommon: new THREE.MeshBasicMaterial({ color: RARITY_HEX.uncommon, side: THREE.DoubleSide }),
      rare: new THREE.MeshBasicMaterial({ color: RARITY_HEX.rare, side: THREE.DoubleSide }),
      epic: new THREE.MeshBasicMaterial({ color: RARITY_HEX.epic, side: THREE.DoubleSide }),
    };
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x3a434d, roughness: 0.55, metalness: 0.45 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x2a697a, roughness: 0.45, metalness: 0.35 });
    const medMat = new THREE.MeshStandardMaterial({ color: 0xdce5eb, roughness: 0.42, metalness: 0.15 });
    this.materials.push(tierMats.common, tierMats.uncommon, tierMats.rare, tierMats.epic, caseMat, armorMat, medMat);

    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const pool = a.tier === 'military' ? milWeapons : a.tier === 'high' ? highWeapons : standardWeapons;
      const w1 = rng.pick(pool);
      const w2 = rng.pick(highWeapons);
      const w3 = rng.pick(standardWeapons);
      const crateWeapons: WeaponId[] = Array.from(new Set<WeaponId>([w1, w2, w3])).slice(0, 3);
      if (crateWeapons.length < 2) crateWeapons.push('carbine');

      const category: LootCategory = 'crate';
      const rarity: LootRarity = a.tier === 'military' ? 'epic' : a.tier === 'high' ? 'rare' : 'uncommon';
      const label = 'SUPPLY CRATE';
      const amount = 1;

      const ox = rng.range(-1.8, 1.8);
      const oz = rng.range(-1.8, 1.8);
      const wx = a.pos.x + ox;
      const wz = a.pos.z + oz;
      const wy = Math.max(a.pos.y, sampleIslandHeight(wx, wz));
      if (wy < 0.1) continue;

      const mesh = new THREE.Group();
      mesh.position.set(wx, wy + 0.36, wz);
      const crateBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.85), caseMat);
      crateBody.castShadow = true;
      crateBody.receiveShadow = true;
      const ringMesh = new THREE.Mesh(beaconGeo, tierMats[rarity]);
      ringMesh.position.y = -0.32;
      mesh.add(crateBody, ringMesh);
      mesh.traverse((o) => {
        o.userData.noCollide = true;
      });
      this.root.add(mesh);

      this.items.push({
        id: `loot-${this.nextId++}`,
        active: true,
        category,
        rarity,
        label,
        crateWeapons,
        amount,
        pos: new THREE.Vector3(wx, wy, wz),
        mesh,
      });
    }
  }

  public findClosestInteractable(playerPos: THREE.Vector3, maxDist = 2.8): WorldLootItem | null {
    let best: WorldLootItem | null = null;
    let bestD2 = maxDist * maxDist;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const dx = it.pos.x - playerPos.x;
      const dz = it.pos.z - playerPos.z;
      const dy = Math.abs(it.pos.y - (playerPos.y + 0.6));
      if (dy > 2.2) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = it;
      }
    }
    return best;
  }

  public toPromptHud(item: WorldLootItem | null, interactKey: string): LootPromptHud | null {
    if (!item || !item.active) return null;
    return {
      id: item.id,
      label: item.label,
      category: item.category,
      rarity: item.rarity,
      keyHint: interactKey.replace(/^Key/, ''),
    };
  }

  public consumeItem(item: WorldLootItem): void {
    item.active = false;
    item.mesh.visible = false;
  }

  public update(dt: number, playerPos: THREE.Vector3): void {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const distSq = (it.pos.x - playerPos.x) ** 2 + (it.pos.z - playerPos.z) ** 2;
      const near = distSq < 75 * 75;
      it.mesh.visible = near;
      if (near) {
        it.mesh.rotation.y += dt * 1.1;
      }
    }
  }

  public dispose(): void {
    this.clear();
    this.root.removeFromParent();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
