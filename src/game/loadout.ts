import { GrenadeId, Loadout, WeaponId } from './types';

export const PRIMARY_WEAPONS: WeaponId[] = ['shotgun', 'railpistol', 'carbine', 'smg', 'machinegun', 'marksman'];
export const SIDEARMS: WeaponId[] = ['usp', 'deagle', 'glock'];
export const LAUNCHERS: WeaponId[] = ['rpg', 'grenadelauncher'];
export const GRENADES: Record<GrenadeId, { name: string; description: string; color: string }> = {
  frag: { name: 'Frag', description: 'Explosive area damage', color: '#a3b86c' },
  smoke: { name: 'Smoke', description: 'Blocks enemy sight for 8 seconds', color: '#b7c8d8' },
  molotov: { name: 'Molotov', description: 'Burning area for 6 seconds', color: '#fb923c' },
  flashbang: { name: 'Flashbang', description: 'Stuns nearby hostiles for 4 seconds', color: '#fde68a' },
};
export const DEFAULT_LOADOUT: Loadout = { primary: ['carbine', 'machinegun'], sidearm: 'glock', launcher: 'rpg', grenade: 'frag' };

export function normalizeLoadout(value?: Loadout): Loadout {
  const candidate = value ?? DEFAULT_LOADOUT;
  const first = PRIMARY_WEAPONS.includes(candidate.primary?.[0]) ? candidate.primary[0] : 'carbine';
  const second = PRIMARY_WEAPONS.includes(candidate.primary?.[1]) && candidate.primary[1] !== first
    ? candidate.primary[1] : PRIMARY_WEAPONS.find(id => id !== first)!;
  return {
    primary: [first, second],
    sidearm: SIDEARMS.includes(candidate.sidearm) ? candidate.sidearm : 'usp',
    launcher: candidate.launcher === null ? null : LAUNCHERS.includes(candidate.launcher) ? candidate.launcher : 'rpg',
    grenade: candidate.grenade && candidate.grenade in GRENADES ? candidate.grenade : 'frag',
  };
}

export function inventoryWeapons(loadout: Loadout): WeaponId[] {
  return [...loadout.primary, loadout.sidearm, ...(loadout.launcher ? [loadout.launcher] : [])];
}

export const WEAPON_CLASSES: Partial<Record<WeaponId, string>> = {
  shotgun: 'Shotgun', railpistol: 'Sniper', carbine: 'Assault rifle', smg: 'SMG', machinegun: 'Machine gun', marksman: 'Marksman rifle',
};
