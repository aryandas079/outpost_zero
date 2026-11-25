import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import type { GameSettings, HudSnapshot, WeaponId } from '../game/types';
import { WEAPON_SPECS } from '../game/types';
import { GRENADES, inventoryWeapons } from '../game/loadout';
import { InventoryModal } from './InventoryModal';
import { RadarMinimap } from './RadarMinimap';
import {
  AlivePlayerIconSvg,
  AmmoIconSvg,
  ArmorPlateIconSvg,
  GrenadeSvg,
  LowPolySoldierAvatar,
  MedkitIconSvg,
  SkullElimIconSvg,
  StaminaBoltSvg,
  WeaponSilhouette,
} from './WeaponSilhouette';

const COLORBLIND_ACCENTS: Record<GameSettings['colorblindMode'], { armor: string; danger: string; safe: string }> = {
  none: { armor: '#3B9DF8', danger: '#EF4444', safe: '#4ADE80' },
  deuteranope: { armor: '#56B4E9', danger: '#E69F00', safe: '#009E73' },
  protanope: { armor: '#56B4E9', danger: '#F0E442', safe: '#009E73' },
  tritanope: { armor: '#009E73', danger: '#D55E00', safe: '#56B4E9' },
};

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export interface TacticalHudShellProps {
  hud: HudSnapshot;
  settings?: GameSettings;
  controls: GameSettings['controls'];
  onToggleMap: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onThrowGrenade: () => void;
  onDash: () => void;
  onToggleCrouch: () => void;
  onInteractLoot?: () => void;
  onEquipCrateWeapon?: (id: WeaponId) => void;
  onCloseCrate?: () => void;
  onSelectBrMelee?: () => void;
  onUseArmorPlate?: () => void;
  onUseMedkit?: () => void;
  onToggleInventory?: () => void;
  onCycleSpectator?: () => void;
}

export const TacticalHudPanels: React.FC<TacticalHudShellProps> = ({
  hud,
  settings,
  controls,
  onToggleMap,
  onSelectWeapon,
  onThrowGrenade,
  onInteractLoot,
  onEquipCrateWeapon,
  onCloseCrate,
  onSelectBrMelee,
  onUseArmorPlate,
  onUseMedkit,
  onToggleInventory,
  onCycleSpectator,
}) => {
  const isIsland = hud.mapId === 'island';
  const br = hud.battleRoyale;
  const deployStage = br?.stage ?? 'grounded';
  const inAircraft = isIsland && deployStage === 'airdrop_plane';
  const inFlight = isIsland && (deployStage === 'airdrop_plane' || deployStage === 'freefall' || deployStage === 'parachute');
  const spectating = Boolean(hud.spectator?.active);
  const spec = WEAPON_SPECS[hud.weaponId];

  const weapons = inventoryWeapons({
    primary: [hud.inventory[0]?.id ?? 'carbine', hud.inventory[1]?.id ?? 'machinegun'],
    sidearm: hud.inventory[2]?.id ?? 'glock',
    launcher: hud.inventory[3]?.id ?? null,
    grenade: hud.grenade,
  });

  const ammoLookup = new Map<WeaponId, { ammo: number; reserve: number }>();
  for (const item of hud.inventory) {
    ammoLookup.set(item.id, { ammo: item.ammo, reserve: item.reserve });
  }
  ammoLookup.set(hud.weaponId, { ammo: hud.ammo, reserve: hud.reserve });

  const palette = COLORBLIND_ACCENTS[settings?.colorblindMode ?? 'none'];
  const hudScale = settings?.hudScale ?? 1;
  const minimapRotate = settings?.minimapRotate ?? false;

  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / Math.max(1, hud.maxShield)) * 100));
  const staminaVal = Math.round(
    (1 - Math.max(0, Math.min(1, hud.dashCooldown / Math.max(1, hud.dashCooldownMax)))) * 100,
  );

  const headingDeg = ((Math.round(hud.headingDeg) % 360) + 360) % 360;
  const compassStepPx = 2.9;
  const compassTicks = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
  const cardinalLabel = (deg: number): string => {
    const d = ((deg % 360) + 360) % 360;
    if (d === 0) return 'N';
    if (d === 45) return 'NE';
    if (d === 90) return 'E';
    if (d === 135) return 'SE';
    if (d === 180) return 'S';
    if (d === 225) return 'SW';
    if (d === 270) return 'W';
    if (d === 315) return 'NW';
    return String(d);
  };

  let waypointOffsetDeg: number | null = null;
  if (hud.radar.waypoint) {
    const dx = hud.radar.waypoint.x - hud.radar.playerX;
    const dz = hud.radar.waypoint.z - hud.radar.playerZ;
    const targetDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
    let diff = targetDeg - headingDeg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) <= 75) waypointOffsetDeg = diff;
  }

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden"
      style={{ transform: `scale(${hudScale})`, transformOrigin: 'center center' }}
    >
      {/* TOP BAR: Icon Alive/Kill Badges (Left) | Clean Compass & Banner (Center) | Square Minimap (Right) */}
      <div className="fixed inset-x-0 top-0 px-3 sm:px-4 pt-3 flex items-start justify-between gap-2 sm:gap-3">
        {/* 1. TOP-LEFT PURE ICON MATCH BADGES */}
        <div className="shrink-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="bg-[#333D47]/90 border border-white/15 px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-md text-[#F8FAFC] font-mono text-xs font-extrabold tabular-nums">
              <AlivePlayerIconSvg className="w-4 h-4 text-[#F8FAFC]" />
              <span>{isIsland ? br?.aliveCount ?? 24 : hud.wave}</span>
            </div>
            <div className="bg-[#333D47]/90 border border-white/15 px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-md text-[#F8FAFC] font-mono text-xs font-extrabold tabular-nums">
              <SkullElimIconSvg className="w-4 h-4 text-[#F8FAFC]" />
              <span>{hud.eliminations}</span>
            </div>
            {isIsland && br && (
              <div
                className={`bg-[#333D47]/90 border border-white/15 px-2.5 py-1 rounded-sm flex items-center gap-1 shadow-md font-mono text-xs font-bold tabular-nums ${
                  br.stormClosing ? 'animate-pulse' : ''
                }`}
                style={{
                  color: br.stormClosing
                    ? '#EF4444'
                    : br.stormWarmup
                      ? '#FFFFFF'
                      : '#FACC15',
                }}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatClock(br.stormTimerSec)}</span>
              </div>
            )}
          </div>

          {/* Icon-based Kill Feed */}
          {hud.killFeed.length > 0 && (
            <div className="flex flex-col gap-1 mt-0.5">
              {hud.killFeed.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="bg-[#28323D]/88 border border-white/12 px-2 py-0.5 rounded-sm text-[10px] font-mono text-[#F2F4F5] flex items-center gap-1.5 max-w-[230px]"
                >
                  <span className="text-[#38BDF8] font-bold truncate max-w-[66px]">{entry.killer}</span>
                  <WeaponSilhouette weaponId={entry.weapon} className="w-5 h-3 text-white shrink-0" />
                  <span className="text-[#E2E8F0] truncate max-w-[68px]">{entry.victim}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. TOP-CENTER CLEAN COMPASS & CORAL LOW-POLY SAFE ZONE BANNER */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 px-1">
          <div className="relative w-full max-w-[380px] min-w-[140px] h-9 flex items-center justify-center overflow-hidden">
            {compassTicks.map((offset) => {
              const tickDeg = Math.round((headingDeg + offset) / 15) * 15;
              const d = tickDeg - headingDeg;
              const px = d * compassStepPx;
              const isMajor = ((tickDeg % 45) + 45) % 45 === 0;
              return (
                <div
                  key={tickDeg}
                  className="absolute top-1 flex flex-col items-center"
                  style={{ transform: `translateX(${px}px)` }}
                >
                  <span className="w-px h-2 bg-white/75 mb-0.5" />
                  <span
                    className={`text-[10px] font-sans tracking-wider drop-shadow ${
                      isMajor ? 'text-[#FFFFFF] font-black' : 'text-white/75 font-semibold'
                    }`}
                  >
                    {cardinalLabel(tickDeg)}
                  </span>
                </div>
              );
            })}
            {waypointOffsetDeg !== null && (
              <div
                className="absolute top-0.5 w-2 h-2 rotate-45 bg-[#FACC15] border border-[#10161D]"
                style={{ transform: `translateX(${waypointOffsetDeg * compassStepPx}px) rotate(45deg)` }}
              />
            )}
            <div className="relative z-10 -translate-y-2.5 text-[#FACC15] text-[10px] leading-none drop-shadow">
              ▼
            </div>
          </div>

          {(hud.waveBanner || br?.outsideStorm) && (
            <div
              data-testid="wave-banner"
              className="max-w-full bg-[#D1564A]/92 border border-[#FCA5A5]/40 px-4 py-1 rounded-sm text-center shadow-lg flex items-center gap-2 text-[11px] font-black tracking-[0.12em] uppercase text-white"
            >
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
              <span>
                {br?.outsideStorm ? `SAFE ZONE · ${br.distanceToSafeZoneMeters}M` : hud.waveBanner}
              </span>
            </div>
          )}
        </div>

        {/* 3. TOP-RIGHT ULTRA-CLEAN MINIMAP */}
        <div className="shrink-0 flex flex-col items-end">
          <RadarMinimap
            radar={hud.radar}
            isIsland={isIsland}
            rotateWithPlayer={minimapRotate}
            onToggleMap={onToggleMap}
          />
        </div>
      </div>

      {/* AIRDROP / SKYDIVING HUD */}
      {inFlight && br && (
        <>
          <div className="fixed left-5 top-1/2 -translate-y-1/2 bg-[#2B3641]/86 border border-white/15 px-3 py-2.5 rounded-sm space-y-2.5 font-mono shadow-lg">
            <div>
              <div className="text-[9px] tracking-widest text-[#CBD5E1]">ALT</div>
              <div className="text-base font-black text-white tabular-nums">{br.altitudeMeters} m</div>
            </div>
            <div>
              <div className="text-[9px] tracking-widest text-[#CBD5E1]">SPD</div>
              <div className="text-base font-black text-white tabular-nums">{br.airspeedKmh} km/h</div>
            </div>
          </div>

          <div
            data-testid="deployment-hud"
            className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto"
          >
            <div className="bg-[#2B3641]/92 border-2 border-[#FACC15] px-5 py-2 rounded-sm flex items-center gap-3 shadow-2xl">
              <span className="px-2 py-0.5 bg-[#FACC15] text-[#0F172A] font-mono text-xs font-black rounded-xs">
                {inAircraft ? 'F / SPACE' : 'SPACE'}
              </span>
              <span className="text-sm font-black tracking-[0.12em] text-white uppercase">
                {inAircraft
                  ? br.canJumpFromPlane
                    ? 'JUMP'
                    : `${br.deploymentCountdownSec}s`
                  : deployStage === 'freefall'
                    ? 'DEPLOY'
                    : 'GLIDE'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* GROUND COMBAT PURE-ICON LOW-POLY HUD */}
      {!inFlight && !spectating && (
        <>
          {/* Clean Icon Prompt Pill */}
          {hud.nearbyLoot && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={onInteractLoot}
                className="bg-[#2B3641]/95 border border-[#FACC15] px-3.5 py-1.5 rounded-sm flex items-center gap-2.5 text-xs font-bold text-white shadow-lg cursor-pointer hover:bg-[#374553]"
              >
                <span className="px-1.5 py-0.5 bg-[#FACC15] text-[#0F172A] font-mono text-[10px] font-black rounded-xs">
                  {hud.nearbyLoot.keyHint}
                </span>
                <AmmoIconSvg className="w-3.5 h-3.5 text-[#FACC15]" />
                <span className="uppercase tracking-wider">{hud.nearbyLoot.label}</span>
              </button>
            </div>
          )}

          {/* BOTTOM BAR: Low-Poly Portrait + 3 Icon Bars (Left) & Pure-Icon Weapons + Utility Slots (Right) */}
          <div className="fixed inset-x-0 bottom-0 px-3 sm:px-4 pb-3 flex items-end justify-between gap-3">
            {/* Bottom-Left: Low-Poly Soldier Avatar + Armor / Health / Stamina Icon Bars */}
            <div className="shrink-0 flex items-end gap-2">
              <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-sm border-2 border-white/25 overflow-hidden shadow-lg bg-[#2B3641] shrink-0">
                <LowPolySoldierAvatar />
              </div>
              <div className="flex flex-col gap-1 w-[156px] sm:w-[178px]">
                {/* Armor / Shield */}
                <div className="bg-[#2B3641]/88 border border-white/15 px-2 py-0.5 rounded-xs flex items-center gap-1.5 shadow">
                  <ArmorPlateIconSvg className="w-3.5 h-3.5 shrink-0" />
                  <div className="flex-1 h-2 bg-black/40 rounded-xs overflow-hidden">
                    <div className="h-full transition-all duration-100" style={{ width: `${shieldPct}%`, backgroundColor: palette.armor }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white w-7 text-right tabular-nums">{hud.shield}</span>
                </div>
                {/* Health */}
                <div className="bg-[#2B3641]/88 border border-white/15 px-2 py-0.5 rounded-xs flex items-center gap-1.5 shadow">
                  <span className="w-3.5 h-3.5 flex items-center justify-center font-black text-xs text-[#4ADE80]">+</span>
                  <div className="flex-1 h-2 bg-black/40 rounded-xs overflow-hidden">
                    <div
                      className="h-full transition-all duration-100"
                      style={{ width: `${hpPct}%`, backgroundColor: hud.health <= 30 ? palette.danger : palette.safe }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white w-7 text-right tabular-nums">{hud.health}</span>
                </div>
                {/* Stamina / Dash Energy */}
                <div className="bg-[#2B3641]/88 border border-white/15 px-2 py-0.5 rounded-xs flex items-center gap-1.5 shadow">
                  <StaminaBoltSvg className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                  <div className="flex-1 h-2 bg-black/40 rounded-xs overflow-hidden">
                    <div className="h-full bg-[#FACC15] transition-all duration-100" style={{ width: `${staminaVal}%` }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white w-7 text-right tabular-nums">{staminaVal}</span>
                </div>
              </div>
            </div>

            {/* Bottom-Center/Right: Unified Pure-Icon Weapon Cards + Utility Icon Slots */}
            <div className="shrink-0 flex items-end gap-1.5 pointer-events-auto">
              {/* Weapon Slots: Max 2 Guns + 1 Melee (Bare Hands) in BR, with clear Gun Names */}
              <div className="flex items-end gap-1.5">
                {isIsland ? (
                  <>
                    {(hud.brGuns ?? ['glock', null]).map((wid, idx) => {
                      const active = Boolean(wid && wid === hud.weaponId && !hud.brMeleeActive);
                      const counts = wid ? ammoLookup.get(wid) : null;
                      return (
                        <button
                          key={`br-gun-${idx}`}
                          type="button"
                          onClick={() => wid && onSelectWeapon(wid)}
                          disabled={!wid}
                          className={`relative w-[96px] sm:w-[112px] h-14 px-2 py-1 rounded-sm border-2 flex flex-col items-center justify-between transition-all shadow-lg ${
                            active
                              ? 'bg-[#353F4B]/95 border-[#FACC15] shadow-[0_0_14px_rgba(250,204,21,0.3)] cursor-pointer'
                              : wid
                                ? 'bg-[#2B3641]/88 border-white/20 hover:border-white/45 cursor-pointer'
                                : 'bg-[#1F2730]/65 border-white/10 opacity-60 cursor-default'
                          }`}
                        >
                          <span className="absolute top-0.5 left-1 font-mono text-[9px] font-bold text-white/65">
                            {idx + 1}
                          </span>
                          <div className="text-[10px] font-mono font-black tracking-wide text-white truncate max-w-full mt-0.5">
                            {wid ? (WEAPON_SPECS[wid]?.shortLabel ?? wid.toUpperCase()) : 'EMPTY'}
                          </div>
                          {wid ? (
                            <div className="w-full flex items-center justify-end gap-0.5 font-mono text-[10px] leading-none tabular-nums">
                              <AmmoIconSvg className={`w-2.5 h-2.5 ${active ? 'text-[#FACC15]' : 'text-white/60'}`} />
                              <span className={`font-black ${active ? 'text-white' : 'text-[#CBD5E1]'}`}>
                                {counts?.ammo ?? WEAPON_SPECS[wid]?.magSize ?? 0}
                              </span>
                              <span className="text-white/55 text-[9px]">/{counts?.reserve ?? 0}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] font-mono text-white/40">NO GUN</div>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onSelectBrMelee?.()}
                      className={`relative w-[86px] sm:w-[98px] h-14 px-2 py-1 rounded-sm border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg ${
                        hud.brMeleeActive
                          ? 'bg-[#353F4B]/95 border-[#FACC15] shadow-[0_0_14px_rgba(250,204,21,0.3)]'
                          : 'bg-[#2B3641]/88 border-white/20 hover:border-white/45'
                      }`}
                    >
                      <span className="absolute top-0.5 left-1 font-mono text-[9px] font-bold text-white/65">3</span>
                      <div className="text-[10px] font-mono font-black tracking-wide text-white">BARE HANDS</div>
                      <div className="text-[9px] font-mono text-white/60">MELEE</div>
                    </button>
                  </>
                ) : (
                  weapons.map((wid, idx) => {
                    const active = wid === hud.weaponId;
                    const counts = ammoLookup.get(wid);
                    return (
                      <button
                        key={wid}
                        type="button"
                        onClick={() => onSelectWeapon(wid)}
                        title={WEAPON_SPECS[wid]?.shortLabel ?? wid}
                        className={`relative w-[92px] sm:w-[106px] h-14 px-2 py-1 rounded-sm border-2 flex flex-col items-center justify-between transition-all cursor-pointer shadow-lg ${
                          active
                            ? 'bg-[#353F4B]/95 border-[#FACC15] shadow-[0_0_14px_rgba(250,204,21,0.3)]'
                            : 'bg-[#2B3641]/88 border-white/20 hover:border-white/45'
                        }`}
                      >
                        <span className="absolute top-0.5 left-1 font-mono text-[9px] font-bold text-white/65">
                          {idx + 1}
                        </span>
                        <div className="text-[10px] font-mono font-black tracking-wide text-white truncate max-w-full mt-0.5">
                          {WEAPON_SPECS[wid]?.shortLabel ?? wid.toUpperCase()}
                        </div>
                        <div className="w-full flex items-center justify-end gap-0.5 font-mono text-[10px] leading-none tabular-nums">
                          <AmmoIconSvg className={`w-2.5 h-2.5 ${active ? 'text-[#FACC15]' : 'text-white/60'}`} />
                          <span className={`font-black ${active ? 'text-white' : 'text-[#CBD5E1]'}`}>
                            {counts?.ammo ?? spec.magSize}
                          </span>
                          <span className="text-white/55 text-[9px]">/{counts?.reserve ?? 0}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Pure-Icon Medkit Slot */}
              <button
                type="button"
                onClick={onUseMedkit}
                title={`Medkit [${controls.medkit.replace(/^Digit/, '')}]`}
                className="relative w-12 sm:w-14 h-13 sm:h-14 bg-[#2B3641]/88 hover:bg-[#374553] border-2 border-white/20 hover:border-white/45 rounded-sm flex items-center justify-center cursor-pointer shadow-lg"
              >
                <MedkitIconSvg className="w-7 h-7" />
                <span className="absolute bottom-0.5 right-1 font-mono text-[10px] font-black text-white tabular-nums">
                  {hud.medkits ?? 0}
                </span>
              </button>

              {/* Pure-Icon Armor Plate Slot */}
              <button
                type="button"
                onClick={onUseArmorPlate}
                title={`Armor Plate [${controls.armorPlate.replace(/^Digit/, '')}]`}
                className="relative w-12 sm:w-14 h-13 sm:h-14 bg-[#2B3641]/88 hover:bg-[#374553] border-2 border-white/20 hover:border-white/45 rounded-sm flex items-center justify-center cursor-pointer shadow-lg"
              >
                <ArmorPlateIconSvg className="w-6 h-6" />
                <span className="absolute bottom-0.5 right-1 font-mono text-[10px] font-black text-white tabular-nums">
                  {hud.armorPlates ?? 0}
                </span>
              </button>

              {/* Pure-Icon Low-Poly Grenade Slot */}
              <button
                type="button"
                onClick={onThrowGrenade}
                title={`${GRENADES[hud.grenade].name} [G]`}
                className="relative w-12 sm:w-14 h-13 sm:h-14 bg-[#2B3641]/88 hover:bg-[#374553] border-2 border-white/20 hover:border-white/45 rounded-sm flex items-center justify-center cursor-pointer shadow-lg"
              >
                <GrenadeSvg className="w-7 h-7" />
                <span className="absolute bottom-0.5 right-1 font-mono text-[10px] font-black text-white tabular-nums">
                  {hud.grenadesRemaining}
                </span>
              </button>

              {/* Compact Reload progress bar when active */}
              {hud.reloading && (
                <div className="fixed bottom-20 right-4 w-28 h-1.5 bg-black/50 rounded-xs overflow-hidden border border-white/20">
                  <div className="h-full bg-[#FACC15]" style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }} />
                </div>
              )}

              {/* Subtle backpack click hook preserved cleanly on Tab */}
              {onToggleInventory && (
                <button
                  type="button"
                  onClick={onToggleInventory}
                  aria-label="Open Inventory"
                  className="hidden"
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* SPECTATOR OVERLAY */}
      {spectating && hud.spectator && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2B3641]/92 border border-[#FACC15]/65 px-5 py-2.5 rounded-sm flex items-center gap-5 pointer-events-auto shadow-xl">
          <div>
            <div className="text-[9px] font-mono tracking-widest text-[#FACC15]">SPECTATING</div>
            <div className="text-sm font-bold text-white">{hud.spectator.targetName}</div>
          </div>
          <div className="font-mono text-xs text-white/80 tabular-nums">
            HP <span className="text-white font-bold">{hud.spectator.targetHealth}</span> · ARM{' '}
            <span className="text-[#38BDF8] font-bold">{hud.spectator.targetShield}</span>
          </div>
          {hud.spectator.canSwitch && (
            <button
              type="button"
              onClick={onCycleSpectator}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold text-white rounded-xs cursor-pointer"
            >
              [SPACE] NEXT
            </button>
          )}
        </div>
      )}

      {/* SUPPLY CRATE LOOT MENU ([E]) */}
      {hud.crateOpen && !inFlight && (
        <div
          className="fixed inset-0 z-40 bg-black/55 flex items-center justify-center p-4 pointer-events-auto"
          onClick={() => onCloseCrate?.()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(420px,92vw)] bg-[#1B242F] border-2 border-[#FACC15] rounded-sm p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <span className="font-mono text-xs font-black tracking-widest text-[#FACC15] uppercase">
                SUPPLY CRATE · MAX 2 GUNS
              </span>
              <button
                type="button"
                onClick={() => onCloseCrate?.()}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-xs font-mono text-[10px] text-white cursor-pointer"
              >
                [E] CLOSE
              </button>
            </div>
            <div className="space-y-2">
              {hud.crateOpen.weapons.map((wid) => (
                <button
                  key={wid}
                  type="button"
                  onClick={() => onEquipCrateWeapon?.(wid)}
                  className="w-full bg-[#2B3641] hover:bg-[#374553] border border-white/20 hover:border-[#FACC15] rounded-sm px-3 py-2 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="text-left">
                    <div className="font-mono text-xs font-black text-white">
                      {WEAPON_SPECS[wid]?.name ?? wid.toUpperCase()}
                    </div>
                    <div className="font-mono text-[10px] text-white/60">
                      MAG {WEAPON_SPECS[wid]?.magSize ?? 0} · RESERVE {WEAPON_SPECS[wid]?.reserveMax ?? 0}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-[#FACC15] text-[#0F172A] font-mono text-[10px] font-black rounded-xs">
                    EQUIP
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY MODAL ([TAB]) */}
      {hud.inventoryOpen && !inFlight && (
        <InventoryModal
          hud={hud}
          onClose={() => onToggleInventory?.()}
          onSelectWeapon={onSelectWeapon}
          onUseArmorPlate={onUseArmorPlate}
          onUseMedkit={onUseMedkit}
          onThrowGrenade={onThrowGrenade}
        />
      )}
    </div>
  );
};
