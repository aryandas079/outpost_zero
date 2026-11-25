/**
 * Player Inventory & Consumables Controller (Weapons, Ammo Reserves, Armor Plates, Medkits, Grenades).
 * Enforces capacity limits, stack limits, and safe swap/drop validation.
 */

import { GrenadeId, Loadout, WeaponId, WEAPON_SPECS } from '../game/types';
import { DEFAULT_LOADOUT, inventoryWeapons, normalizeLoadout } from '../game/loadout';

export const MAX_ARMOR_PLATES = 5;
export const MAX_MEDKITS = 3;
export const MAX_GRENADES = 4;

export class InventorySystem {
  public loadout: Loadout = normalizeLoadout(DEFAULT_LOADOUT);
  public activeWeaponId: WeaponId = 'carbine';
  public ammoMap: Record<WeaponId, number>;
  public reserveMap: Record<WeaponId, number>;
  public grenadesRemaining = 3;
  public armorPlates = 2;
  public medkits = 1;

  constructor() {
    this.ammoMap = Object.fromEntries(Object.values(WEAPON_SPECS).map((s) => [s.id, s.magSize])) as Record<WeaponId, number>;
    this.reserveMap = Object.fromEntries(Object.values(WEAPON_SPECS).map((s) => [s.id, s.reserveMax])) as Record<WeaponId, number>;
  }

  public reset(loadout?: Loadout): void {
    this.loadout = normalizeLoadout(loadout ?? this.loadout);
    this.activeWeaponId = this.loadout.primary[0];
    for (const spec of Object.values(WEAPON_SPECS)) {
      this.ammoMap[spec.id] = spec.magSize;
      this.reserveMap[spec.id] = spec.reserveMax;
    }
    this.grenadesRemaining = 3;
    this.armorPlates = 2;
    this.medkits = 1;
  }

  public getOwnedWeapons(): WeaponId[] {
    return inventoryWeapons(this.loadout);
  }

  public addAmmo(weaponId: WeaponId, amount: number): number {
    if (amount <= 0) return 0;
    const spec = WEAPON_SPECS[weaponId];
    const current = this.reserveMap[weaponId];
    const next = Math.min(spec.reserveMax, current + amount);
    this.reserveMap[weaponId] = next;
    return next - current;
  }

  public addArmorPlate(count = 1): number {
    const before = this.armorPlates;
    this.armorPlates = Math.min(MAX_ARMOR_PLATES, this.armorPlates + count);
    return this.armorPlates - before;
  }

  public consumeArmorPlate(currentShield: number, maxShield: number): number {
    if (this.armorPlates <= 0 || currentShield >= maxShield) return 0;
    this.armorPlates--;
    return Math.min(25, maxShield - currentShield);
  }

  public addMedkit(count = 1): number {
    const before = this.medkits;
    this.medkits = Math.min(MAX_MEDKITS, this.medkits + count);
    return this.medkits - before;
  }

  public consumeMedkit(currentHealth: number, maxHealth: number): number {
    if (this.medkits <= 0 || currentHealth >= maxHealth) return 0;
    this.medkits--;
    return Math.min(45, maxHealth - currentHealth);
  }

  public addGrenade(kind: GrenadeId, count = 1): boolean {
    if (this.grenadesRemaining >= MAX_GRENADES && this.loadout.grenade === kind) return false;
    this.loadout = { ...this.loadout, grenade: kind };
    this.grenadesRemaining = Math.min(MAX_GRENADES, this.grenadesRemaining + count);
    return true;
  }

  public equipWeaponPickup(newId: WeaponId): { replaced: WeaponId | null; addedAmmoOnly: boolean } {
    const owned = this.getOwnedWeapons();
    if (owned.includes(newId)) {
      this.addAmmo(newId, WEAPON_SPECS[newId].magSize * 2);
      return { replaced: null, addedAmmoOnly: true };
    }
    const spec = WEAPON_SPECS[newId];
    if (spec.slot === 3) {
      const old = this.loadout.sidearm;
      this.loadout = normalizeLoadout({ ...this.loadout, sidearm: newId });
      this.ammoMap[newId] = spec.magSize;
      this.reserveMap[newId] = Math.max(this.reserveMap[newId], spec.magSize * 3);
      return { replaced: old, addedAmmoOnly: false };
    }
    if (spec.slot === 4) {
      const old = this.loadout.launcher;
      this.loadout = normalizeLoadout({ ...this.loadout, launcher: newId });
      this.ammoMap[newId] = spec.magSize;
      this.reserveMap[newId] = Math.max(this.reserveMap[newId], spec.magSize * 2);
      return { replaced: old, addedAmmoOnly: false };
    }
    // Primary slot swap (replace currently active primary or slot 2)
    const replaceIdx = this.activeWeaponId === this.loadout.primary[1] ? 1 : 0;
    const old = this.loadout.primary[replaceIdx];
    const nextPrimary: [WeaponId, WeaponId] = [...this.loadout.primary];
    nextPrimary[replaceIdx] = newId;
    this.loadout = normalizeLoadout({ ...this.loadout, primary: nextPrimary });
    this.ammoMap[newId] = spec.magSize;
    this.reserveMap[newId] = Math.max(this.reserveMap[newId], spec.magSize * 3);
    return { replaced: old, addedAmmoOnly: false };
  }
}
