import React from 'react';
import type { GameSettings, HudSnapshot, WeaponId } from '../game/types';
import { DynamicCrosshair } from './DynamicCrosshair';
import { TacticalHudPanels } from './TacticalHudPanels';
import { DevPerfOverlay } from '../ui/Components/DevPerfOverlay';

export interface GameHudProps {
  controls: GameSettings['controls'];
  hud: HudSnapshot;
  muted?: boolean;
  isMobile?: boolean;
  settings?: GameSettings;
  isTouchDevice?: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onToggleMap: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onThrowGrenade: () => void;
  onDash: () => void;
  onInspectHold: (held: boolean) => void;
  onToggleCrouch: () => void;
  onToggleScopeZoom: () => void;
  onInteractLoot?: () => void;
  onUseArmorPlate?: () => void;
  onUseMedkit?: () => void;
  onToggleInventory?: () => void;
  onCycleSpectator?: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onTouchFire: (held: boolean) => void;
  onTouchAdsToggle: () => void;
  onTouchSprintToggle: (active: boolean) => void;
  onTouchJump: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  controls,
  hud,
  isMobile = false,
  settings,
  isTouchDevice = false,
  onToggleMap,
  onSelectWeapon,
  onReload,
  onThrowGrenade,
  onDash,
  onToggleCrouch,
  onInteractLoot,
  onUseArmorPlate,
  onUseMedkit,
  onToggleInventory,
  onCycleSpectator,
  onTouchFire,
  onTouchJump,
}) => {
  const isIsland = hud.mapId === 'island';
  const deployStage = hud.battleRoyale?.stage ?? 'grounded';
  const inFlight = isIsland && deployStage !== 'grounded';
  const spectating = Boolean(hud.spectator?.active);
  const overlayBlocking = Boolean(hud.tacticalMapOpen || hud.inventoryOpen);
  const showCrosshair = !inFlight && !spectating && !overlayBlocking;
  const scopedIn = showCrosshair && hud.scopeAlpha > 0.12;

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden"
      style={{
        transform:
          hud.screenShakeX || hud.screenShakeY || hud.screenShakeRot
            ? `translate3d(${hud.screenShakeX.toFixed(1)}px, ${hud.screenShakeY.toFixed(1)}px, 0) rotate(${hud.screenShakeRot.toFixed(2)}deg)`
            : undefined,
      }}
    >
      {/* Subtle tactical vignettes (underwater dive tint, out-of-storm pulse, damage flash) */}
      {hud.underwater && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(16,84,116,0.12) 45%, rgba(8,44,68,0.52) 100%)' }}
        />
      )}
      {hud.battleRoyale?.outsideStorm && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(82, 199, 222, 0.34)',
          }}
        />
      )}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, transparent 52%, rgba(224, 82, 82, ${Math.min(0.42, hud.damageFlash * 0.45).toFixed(2)}) 100%)`,
          }}
        />
      )}

      {/* High-power optical scope reticle overlay */}
      {scopedIn && (
        <div
          className="fixed inset-0 z-25 pointer-events-none flex items-center justify-center"
          style={{
            opacity: Math.min(1, hud.scopeAlpha),
            background:
              'radial-gradient(circle at center, transparent 27%, rgba(5, 8, 12, 0.92) 42%, rgba(5, 8, 12, 0.99) 100%)',
          }}
        >
          <div className="relative w-72 h-72 rounded-full border border-white/25 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/35" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/35" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#E05252]" />
            <div className="absolute bottom-3 font-mono text-[10px] text-[#52C7DE] tracking-widest">
              {hud.scopeZoom}X OPTIC · [Z] TOGGLE ZOOM
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Tactical Crosshair (strictly hidden during C-130 flight, freefall, parachute, spectator & map) */}
      {showCrosshair && (
        <DynamicCrosshair
          weaponId={hud.weaponId}
          movementState={hud.movementState}
          moveSpeedRatio={hud.moveSpeedRatio}
          recoilIntensity={hud.recoilIntensity}
          ads={hud.ads}
          scopeAlpha={hud.scopeAlpha}
          reloading={hud.reloading}
          reloadProgress={hud.reloadProgress}
          hitMarker={hud.hitMarker}
          damagePops={hud.damagePops}
          damageArc={hud.damageArc}
          crosshairColor={settings?.crosshairColor}
          crosshairSize={settings?.crosshairSize}
        />
      )}

      {/* Main Tactical Wireframe HUD Panels */}
      <TacticalHudPanels
        hud={hud}
        settings={settings}
        controls={controls}
        onToggleMap={onToggleMap}
        onSelectWeapon={onSelectWeapon}
        onReload={onReload}
        onThrowGrenade={onThrowGrenade}
        onDash={onDash}
        onToggleCrouch={onToggleCrouch}
        onInteractLoot={onInteractLoot}
        onUseArmorPlate={onUseArmorPlate}
        onUseMedkit={onUseMedkit}
        onToggleInventory={onToggleInventory}
        onCycleSpectator={onCycleSpectator}
      />

      {/* Toggleable Dev Performance Telemetry (F8) */}
      <DevPerfOverlay hud={hud} visible={Boolean(settings?.showPerfOverlay)} />

      {/* Mobile Touch Controls (shown only on coarse pointer touch devices) */}
      {(isTouchDevice || isMobile) && !overlayBlocking && (
        <div className="fixed inset-x-4 bottom-24 flex justify-between pointer-events-auto sm:hidden">
          <button
            type="button"
            onTouchStart={() => onTouchJump()}
            className="px-4 py-3 bg-[#10161D]/85 border border-white/20 rounded-xs font-mono text-xs text-[#F2F4F5]"
          >
            {inFlight ? 'ACTION' : 'JUMP'}
          </button>
          {!inFlight && (
            <button
              type="button"
              onTouchStart={() => onTouchFire(true)}
              onTouchEnd={() => onTouchFire(false)}
              className="px-5 py-3 bg-[#E05252]/85 border border-white/20 rounded-xs font-mono text-xs font-bold text-[#F2F4F5]"
            >
              FIRE
            </button>
          )}
        </div>
      )}
    </div>
  );
};
