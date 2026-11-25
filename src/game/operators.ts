import { Loadout } from './types';
import { DEFAULT_LOADOUT, normalizeLoadout } from './loadout';
import { PlayerColorId } from './multiplayer/types';

export type OperatorId = 'nomad' | 'viper' | 'hawk' | 'rook';

export interface OperatorProfile {
  id: OperatorId;
  name: string;
  callsign: string;
  shortRole: string;
  roleTitle: string;
  bio: string;
  color: PlayerColorId;
  accentHex: string;
  stats: {
    focus: number;
    survivability: number;
    mobility: number;
  };
  presetLoadout: Loadout;
  defaultPerks: [string, string, string];
}

export const OPERATORS: OperatorProfile[] = [
  {
    id: 'nomad',
    name: 'Nomad',
    callsign: 'Nomad-6',
    shortRole: 'Recon',
    roleTitle: 'Recon Specialist',
    bio: 'Long-range reconnaissance and precision elimination.',
    color: 'amber',
    accentHex: '#f5b301',
    stats: {
      focus: 72,
      survivability: 42,
      mobility: 78,
    },
    presetLoadout: {
      primary: ['carbine', 'railpistol'],
      sidearm: 'glock',
      launcher: 'rpg',
      grenade: 'frag',
    },
    defaultPerks: ['Speed', 'Hardline', 'Focus'],
  },
  {
    id: 'viper',
    name: 'Viper',
    callsign: 'Viper-2',
    shortRole: 'Assault',
    roleTitle: 'Assault Specialist',
    bio: 'High-tempo entry breacher built for aggressive close-quarters sweeps.',
    color: 'emerald',
    accentHex: '#34d399',
    stats: {
      focus: 64,
      survivability: 58,
      mobility: 88,
    },
    presetLoadout: {
      primary: ['smg', 'shotgun'],
      sidearm: 'usp',
      launcher: 'grenadelauncher',
      grenade: 'flashbang',
    },
    defaultPerks: ['Speed', 'Quickdraw', 'Focus'],
  },
  {
    id: 'hawk',
    name: 'Hawk',
    callsign: 'Hawk-4',
    shortRole: 'Support',
    roleTitle: 'Support Specialist',
    bio: 'Sustained suppression fire and flank denial across open sectors.',
    color: 'cyan',
    accentHex: '#38bdf8',
    stats: {
      focus: 84,
      survivability: 68,
      mobility: 54,
    },
    presetLoadout: {
      primary: ['machinegun', 'marksman'],
      sidearm: 'deagle',
      launcher: 'rpg',
      grenade: 'smoke',
    },
    defaultPerks: ['Scavenger', 'Hardline', 'Focus'],
  },
  {
    id: 'rook',
    name: 'Rook',
    callsign: 'Rook-1',
    shortRole: 'Defense',
    roleTitle: 'Defense Specialist',
    bio: 'Heavy ballistic anchor specializing in fortified sector holds.',
    color: 'rose',
    accentHex: '#fb7185',
    stats: {
      focus: 58,
      survivability: 92,
      mobility: 46,
    },
    presetLoadout: {
      primary: ['shotgun', 'carbine'],
      sidearm: 'deagle',
      launcher: 'grenadelauncher',
      grenade: 'molotov',
    },
    defaultPerks: ['Flak Jacket', 'Hardline', 'Scavenger'],
  },
];

export interface SavedLoadoutSlot {
  id: string;
  name: string;
  loadout: Loadout;
  perks: [string, string, string];
}

export const PERK_CATALOG: Array<{
  id: string;
  name: string;
  summary: string;
  slot: 0 | 1 | 2;
}> = [
  { id: 'Speed', name: 'Speed', summary: 'Crisp sprint recovery and tactical mobility', slot: 0 },
  { id: 'Quickdraw', name: 'Quickdraw', summary: 'Rapid weapon swap and sight alignment', slot: 0 },
  { id: 'Hardline', name: 'Hardline', summary: 'Reinforced plate endurance under fire', slot: 1 },
  { id: 'Flak Jacket', name: 'Flak Jacket', summary: 'Blast resistance in tight quarters', slot: 1 },
  { id: 'Focus', name: 'Focus', summary: 'Reduced sway while aiming down sights', slot: 2 },
  { id: 'Scavenger', name: 'Scavenger', summary: 'Extended ammunition field discipline', slot: 2 },
];

const LOADOUT_SLOTS_STORAGE_KEY = 'outpost-zero-loadout-slots-v1';
const ACTIVE_OPERATOR_STORAGE_KEY = 'outpost-zero-operator-v1';

export const DEFAULT_SAVED_LOADOUTS: SavedLoadoutSlot[] = [
  {
    id: 'slot-1',
    name: 'Loadout 1',
    loadout: normalizeLoadout({
      primary: ['carbine', 'railpistol'],
      sidearm: 'usp',
      launcher: 'rpg',
      grenade: 'frag',
    }),
    perks: ['Speed', 'Hardline', 'Focus'],
  },
  {
    id: 'slot-2',
    name: 'Loadout 2',
    loadout: normalizeLoadout({
      primary: ['smg', 'shotgun'],
      sidearm: 'glock',
      launcher: 'grenadelauncher',
      grenade: 'flashbang',
    }),
    perks: ['Quickdraw', 'Hardline', 'Focus'],
  },
  {
    id: 'slot-3',
    name: 'Loadout 3',
    loadout: normalizeLoadout({
      primary: ['marksman', 'carbine'],
      sidearm: 'deagle',
      launcher: null,
      grenade: 'smoke',
    }),
    perks: ['Speed', 'Flak Jacket', 'Focus'],
  },
  {
    id: 'slot-4',
    name: 'Loadout 4',
    loadout: normalizeLoadout({
      primary: ['machinegun', 'shotgun'],
      sidearm: 'usp',
      launcher: 'rpg',
      grenade: 'molotov',
    }),
    perks: ['Quickdraw', 'Flak Jacket', 'Scavenger'],
  },
  {
    id: 'slot-5',
    name: 'Loadout 5',
    loadout: normalizeLoadout(DEFAULT_LOADOUT),
    perks: ['Speed', 'Hardline', 'Scavenger'],
  },
];

export function loadSavedLoadoutSlots(): SavedLoadoutSlot[] {
  if (typeof window === 'undefined') return DEFAULT_SAVED_LOADOUTS;
  try {
    const raw = window.localStorage.getItem(LOADOUT_SLOTS_STORAGE_KEY);
    if (!raw) return DEFAULT_SAVED_LOADOUTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SAVED_LOADOUTS;
    return parsed.slice(0, 8).map((item, index) => ({
      id: typeof item?.id === 'string' ? item.id : `slot-${index + 1}`,
      name: typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : `Loadout ${index + 1}`,
      loadout: normalizeLoadout(item?.loadout),
      perks:
        Array.isArray(item?.perks) && item.perks.length === 3
          ? [String(item.perks[0]), String(item.perks[1]), String(item.perks[2])]
          : ['Speed', 'Hardline', 'Focus'],
    }));
  } catch {
    return DEFAULT_SAVED_LOADOUTS;
  }
}

export function saveLoadoutSlots(slots: SavedLoadoutSlot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOADOUT_SLOTS_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Storage unavailable in restricted frames
  }
}

export function loadSavedOperatorId(): OperatorId {
  if (typeof window === 'undefined') return 'nomad';
  try {
    const saved = window.localStorage.getItem(ACTIVE_OPERATOR_STORAGE_KEY) as OperatorId | null;
    if (saved && OPERATORS.some((op) => op.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage error
  }
  return 'nomad';
}

export function saveOperatorId(id: OperatorId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_OPERATOR_STORAGE_KEY, id);
  } catch {
    // Ignore storage error
  }
}

export function getOperatorById(id: OperatorId): OperatorProfile {
  return OPERATORS.find((op) => op.id === id) ?? OPERATORS[0];
}

export function computeRankFromScore(bestScore: number): { level: number; progressPct: number } {
  const safeScore = Math.max(0, Math.floor(bestScore));
  const level = Math.min(99, 1 + Math.floor(safeScore / 600));
  const progressPct = Math.min(100, Math.round(((safeScore % 600) / 600) * 100));
  return { level, progressPct: safeScore === 0 ? 18 : Math.max(12, progressPct) };
}
