import React, { useState } from 'react';
import type { HudSnapshot, WeaponId } from '../game/types';
import { WEAPON_SPECS } from '../game/types';
import { GRENADES } from '../game/loadout';
import { BrandHeaderLockup } from './BrandEmblem';
import { WeaponSilhouette } from './WeaponSilhouette';

interface InventoryModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onUseArmorPlate?: () => void;
  onUseMedkit?: () => void;
  onThrowGrenade?: () => void;
}

const SLOT_LABELS = ['1 PRIMARY WEAPON', '2 SECONDARY WEAPON', '3 SIDEARM', '4 LAUNCHER'];

/**
 * Full-screen Tactical Loadout & Backpack Inventory screen modeled directly after Shot 9.
 */
export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  onClose,
  onSelectWeapon,
  onUseArmorPlate,
  onUseMedkit,
  onThrowGrenade,
}) => {
  const [navTab, setNavTab] = useState<'inventory' | 'loadout' | 'progression'>('inventory');

  const armorPlates = hud.armorPlates ?? 0;
  const medkits = hud.medkits ?? 0;
  const weightKg = Number(
    (
      hud.inventory.length * 4.6 +
      armorPlates * 1.4 +
      medkits * 1.8 +
      hud.grenadesRemaining * 0.7 +
      hud.reserve * 0.04
    ).toFixed(1),
  );
  const weightPct = Math.min(100, Math.round((weightKg / 60) * 100));

  const gridItems: Array<{
    id: string;
    label: string;
    sub: string;
    count: number;
    accent: string;
    actionLabel?: string;
    onClick?: () => void;
  }> = [
    ...hud.inventory.map((slot) => ({
      id: `ammo-${slot.id}`,
      label: `${WEAPON_SPECS[slot.id].shortLabel} AMMO`,
      sub: 'Ammunition Box',
      count: slot.reserve,
      accent: '#E9B94C',
      actionLabel: 'EQUIP',
      onClick: () => onSelectWeapon(slot.id),
    })),
    {
      id: 'medkit',
      label: 'FIELD MEDKIT',
      sub: '+45 Health Restore',
      count: medkits,
      accent: '#60BE8B',
      actionLabel: 'USE [6]',
      onClick: onUseMedkit,
    },
    {
      id: 'plate',
      label: 'ARMOR PLATES',
      sub: '+25 Ballistic Plate',
      count: armorPlates,
      accent: '#52C7DE',
      actionLabel: 'PLATE [5]',
      onClick: onUseArmorPlate,
    },
    {
      id: 'grenade',
      label: GRENADES[hud.grenade].name.toUpperCase(),
      sub: 'Tactical Ordnance',
      count: hud.grenadesRemaining,
      accent: '#F59E0B',
      actionLabel: 'EQUIP [G]',
      onClick: onThrowGrenade,
    },
  ];

  while (gridItems.length < 20) {
    gridItems.push({
      id: `empty-${gridItems.length}`,
      label: '',
      sub: '',
      count: 0,
      accent: 'transparent',
    });
  }

  return (
    <div
      data-testid="inventory-modal"
      className="fixed inset-0 z-50 bg-[#0A111A]/90 backdrop-blur-md flex flex-col text-[#F2F4F5] select-none pointer-events-auto"
    >
      {/* Top Bar */}
      <div className="px-6 py-3.5 border-b border-white/12 bg-[#0D1622]/90 flex flex-wrap items-center justify-between gap-4">
        <BrandHeaderLockup subtitle="BATTLE ROYALE" />

        <div className="flex items-center gap-6 text-xs font-mono tracking-[0.18em]">
          {(
            [
              ['inventory', 'INVENTORY'],
              ['loadout', 'LOADOUT'],
              ['progression', 'MATCH STATS'],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => setNavTab(id)}
              className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${
                navTab === id
                  ? 'border-[#F5B301] text-[#F5B301] font-bold'
                  : 'border-transparent text-[#A8B0B8] hover:text-[#F2F4F5]'
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 bg-white/8 hover:bg-white/15 border border-white/15 rounded-xs text-[11px] font-mono font-bold tracking-wider cursor-pointer"
        >
          ESC · CLOSE
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-[1260px] w-full mx-auto p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Equipped Weapons & Gear */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 border-l-3 border-[#F5B301] pl-2.5 text-sm font-black tracking-[0.14em] uppercase">
            <span>LOADOUT</span>
          </div>

          <div className="space-y-3">
            {hud.inventory.map((slot, idx) => {
              const spec = WEAPON_SPECS[slot.id];
              const isActive = slot.id === hud.weaponId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectWeapon(slot.id)}
                  className={`w-full p-3.5 rounded-xs border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#162333] border-[#F5B301]'
                      : 'bg-[#101824]/92 border-white/12 hover:border-white/28'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono text-[#A8B0B8] tracking-wider">
                        {SLOT_LABELS[idx] ?? `SLOT ${idx + 1}`}
                      </div>
                      <div className="text-base font-black tracking-wide text-[#F2F4F5] mt-0.5">
                        {spec.shortLabel}
                      </div>
                      <div className="text-[10px] font-mono text-[#A8B0B8] uppercase">
                        {spec.name}
                      </div>
                    </div>

                    <div className="w-36 h-12 flex items-center justify-center text-[#F2F4F5]">
                      <WeaponSilhouette weaponId={slot.id} className="w-32 h-11" />
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div className="text-lg font-bold text-[#F5B301]">{slot.ammo}</div>
                      <div className="text-[11px] text-[#A8B0B8]">/ {slot.reserve}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Strip: Equipment, Healing, Armor */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={onThrowGrenade}
              className="p-3 bg-[#101824]/92 border border-white/12 hover:border-[#F5B301]/70 rounded-xs text-left cursor-pointer"
            >
              <div className="text-[10px] font-mono text-[#F5B301] font-bold tracking-wider mb-1">
                | EQUIPMENT
              </div>
              <div className="text-xs font-bold text-[#F2F4F5]">{GRENADES[hud.grenade].name}</div>
              <div className="text-[11px] font-mono text-[#A8B0B8] mt-0.5">x{hud.grenadesRemaining} [G]</div>
            </button>

            <button
              type="button"
              onClick={onUseMedkit}
              className="p-3 bg-[#101824]/92 border border-white/12 hover:border-[#60BE8B]/70 rounded-xs text-left cursor-pointer"
            >
              <div className="text-[10px] font-mono text-[#60BE8B] font-bold tracking-wider mb-1">
                | HEALING
              </div>
              <div className="text-xs font-bold text-[#F2F4F5]">Field Medkit</div>
              <div className="text-[11px] font-mono text-[#A8B0B8] mt-0.5">
                {hud.health}/{hud.maxHealth} HP · x{medkits}
              </div>
            </button>

            <button
              type="button"
              onClick={onUseArmorPlate}
              className="p-3 bg-[#101824]/92 border border-white/12 hover:border-[#52C7DE]/70 rounded-xs text-left cursor-pointer"
            >
              <div className="text-[10px] font-mono text-[#52C7DE] font-bold tracking-wider mb-1">
                | ARMOR
              </div>
              <div className="text-xs font-bold text-[#F2F4F5]">Tactical Vest</div>
              <div className="w-full h-1.5 bg-white/12 rounded-xs overflow-hidden mt-1.5">
                <div
                  className="h-full bg-[#52C7DE]"
                  style={{ width: `${Math.round((hud.shield / Math.max(1, hud.maxShield)) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-[#A8B0B8] mt-1">Plates x{armorPlates} [5]</div>
            </button>
          </div>
        </div>

        {/* Right Column: Tactical 20-Slot Backpack Grid OR Match Stats */}
        <div className="lg:col-span-6 space-y-4">
          {navTab === 'progression' ? (
            <div className="bg-[#101824]/92 border border-white/12 rounded-xs p-5 space-y-4">
              <div className="border-l-3 border-[#F5B301] pl-2.5 text-sm font-black tracking-[0.14em] uppercase">
                LIVE DEPLOYMENT TELEMETRY
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[#A8B0B8] text-[10px]">SECTOR / POI</div>
                  <div className="text-[#F2F4F5] font-bold mt-1">{hud.battleRoyale?.nearestPoi ?? 'ISLAND'}</div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[#A8B0B8] text-[10px]">ELIMINATIONS / DAMAGE</div>
                  <div className="text-[#F5B301] font-bold mt-1">
                    {hud.eliminations} KILLS · {hud.damageDealt ?? 0} DMG
                  </div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[#A8B0B8] text-[10px]">ACCURACY</div>
                  <div className="text-[#52C7DE] font-bold mt-1">
                    {hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0}% ({hud.headshots} HS)
                  </div>
                </div>
                <div className="p-3 bg-[#0B1117] border border-white/10 rounded-xs">
                  <div className="text-[#A8B0B8] text-[10px]">STORM PHASE</div>
                  <div className="text-[#F2F4F5] font-bold mt-1">
                    PHASE {hud.battleRoyale?.stormPhase ?? 1} · {hud.battleRoyale?.stormTimerSec ?? 0}s
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="border-l-3 border-[#F5B301] pl-2.5 text-sm font-black tracking-[0.14em] uppercase">
                  INVENTORY
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-[#A8B0B8]">WEIGHT</span>
                  <span className="text-[#F2F4F5] font-bold tabular-nums">{weightKg} / 60.0</span>
                  <div className="w-28 h-2 bg-white/12 rounded-xs overflow-hidden">
                    <div className="h-full bg-[#F5B301]" style={{ width: `${weightPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                {gridItems.map((cell) =>
                  cell.label ? (
                    <button
                      key={cell.id}
                      type="button"
                      onClick={cell.onClick}
                      className="aspect-square p-2 bg-[#131D2B] hover:bg-[#1A283A] border border-white/15 hover:border-[#F5B301] rounded-xs flex flex-col justify-between text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-2 h-2 rounded-xs"
                          style={{ backgroundColor: cell.accent }}
                        />
                        <span className="font-mono text-xs font-bold text-[#F2F4F5] tabular-nums">
                          {cell.count}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold leading-tight text-[#F2F4F5] line-clamp-2">
                          {cell.label}
                        </div>
                        {cell.actionLabel && (
                          <div className="text-[9px] font-mono text-[#F5B301] mt-1">
                            {cell.actionLabel}
                          </div>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div
                      key={cell.id}
                      className="aspect-square bg-[#0D1520]/80 border border-white/8 rounded-xs"
                    />
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Key Hints */}
      <div className="px-6 py-2.5 border-t border-white/10 bg-[#0A111A] flex items-center justify-between text-[10px] font-mono text-[#A8B0B8]">
        <span>[TAB] OR [ESC] RETURN TO COMBAT</span>
        <span>CLICK ANY ITEM SLOT TO USE OR EQUIP</span>
      </div>
    </div>
  );
};
