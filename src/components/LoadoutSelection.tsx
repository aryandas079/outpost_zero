import { useState } from 'react';
import { Check } from 'lucide-react';
import { Loadout, WeaponId, WEAPON_SPECS, GrenadeId } from '../game/types';
import { DEFAULT_LOADOUT, GRENADES, LAUNCHERS, PRIMARY_WEAPONS, SIDEARMS, normalizeLoadout } from '../game/loadout';
import { toAssetUrl } from '../utils/assets';
import { WeaponCardVisual } from './WeaponSilhouette';

interface LoadoutSelectionProps {
  initial?: Loadout;
  onBack: () => void;
  onDeploy: (loadout: Loadout) => void;
}

export function LoadoutSelection({ initial, onBack, onDeploy }: LoadoutSelectionProps) {
  const [loadout, setLoadout] = useState(() => normalizeLoadout(initial ?? DEFAULT_LOADOUT));
  const [editingSlot, setEditingSlot] = useState<0 | 1>(0);
  const [stage, setStage] = useState(0);
  const stages = ['Primary', 'Sidearm', 'Launcher', 'Equipment'];

  const chooseWeapon = (id: WeaponId) => {
    if (stage === 0) {
      setLoadout((previous) => {
        const primary = [...previous.primary] as [WeaponId, WeaponId];
        const existing = primary.indexOf(id);
        if (existing !== -1) {
          [primary[editingSlot], primary[existing]] = [primary[existing], primary[editingSlot]];
        } else {
          primary[editingSlot] = id;
        }
        return { ...previous, primary };
      });
      setEditingSlot(editingSlot === 0 ? 1 : 0);
    } else {
      setLoadout((previous) => ({ ...previous, [stage === 1 ? 'sidearm' : 'launcher']: id }));
    }
  };

  const weapons = stage === 0 ? PRIMARY_WEAPONS : stage === 1 ? SIDEARMS : LAUNCHERS;

  return (
    <div className="w-[min(820px,94vw)] max-h-[92dvh] flex flex-col bg-[#0e131b] border border-white/12 rounded-xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[#f5b301]">
            CUSTOM LOADOUT
          </span>
          <h2 className="font-display font-bold text-xl text-white uppercase tracking-wide">
            Armory Configuration
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-[#151c26] hover:bg-[#1f2937] border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
        >
          Cancel
        </button>
      </header>

      <nav className="grid grid-cols-4 border-b border-white/10 bg-[#121822]" aria-label="Loadout categories">
        {stages.map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => setStage(index)}
            aria-current={stage === index ? 'step' : undefined}
            className={`py-3 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              stage === index
                ? 'border-[#f5b301] text-[#f5b301] bg-[#f5b301]/8'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      <div className="p-6 overflow-y-auto flex-1 space-y-4">
        {stage === 0 && (
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Two primary weapon slots">
            {loadout.primary.map((id, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={editingSlot === index}
                onClick={() => setEditingSlot(index as 0 | 1)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  editingSlot === index
                    ? 'bg-[#f5b301]/12 border-[#f5b301] text-white'
                    : 'bg-[#141b25] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <span className="block text-[10px] font-mono uppercase text-slate-400">
                  Primary Slot {index + 1}
                </span>
                <strong className="font-display text-sm font-bold text-white">
                  {WEAPON_SPECS[id].name}
                </strong>
              </button>
            ))}
          </div>
        )}

        {stage < 3 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {weapons.map((id) => {
                const spec = WEAPON_SPECS[id];
                const selected =
                  stage === 0
                    ? loadout.primary.includes(id)
                    : stage === 1
                    ? loadout.sidearm === id
                    : loadout.launcher === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseWeapon(id)}
                    aria-pressed={selected}
                    className={`relative p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#f5b301]/12 border-[#f5b301]'
                        : 'bg-[#141b25] border-white/10 hover:border-white/25'
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full bg-[#f5b301] text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <div className="h-20 flex items-center justify-center mb-2.5 rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 p-2 shadow-inner">
                      <WeaponCardVisual
                        weaponId={id}
                        alt={spec.name}
                        imageUrl={toAssetUrl(`weapons/${id}.png`)}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <strong className="block font-display text-xs font-bold text-white uppercase">
                      {spec.shortLabel}
                    </strong>
                    <span className="block text-[11px] font-mono-num text-slate-400 mt-0.5">
                      DMG {spec.damage} · MAG {spec.magSize}
                    </span>
                  </button>
                );
              })}
            </div>
            {stage === 2 && (
              <button
                type="button"
                aria-pressed={loadout.launcher === null}
                onClick={() => setLoadout((previous) => ({ ...previous, launcher: null }))}
                className={`w-full py-2.5 px-4 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                  loadout.launcher === null
                    ? 'bg-[#f5b301]/12 border-[#f5b301] text-[#f5b301] font-bold'
                    : 'bg-[#141b25] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                No Heavy Launcher (Lighter Mobility)
              </button>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(GRENADES) as GrenadeId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={loadout.grenade === id}
                onClick={() => setLoadout((previous) => ({ ...previous, grenade: id }))}
                className={`relative p-3.5 rounded-lg border text-center transition-all cursor-pointer ${
                  loadout.grenade === id
                    ? 'bg-[#f5b301]/12 border-[#f5b301]'
                    : 'bg-[#141b25] border-white/10 hover:border-white/25'
                }`}
              >
                {loadout.grenade === id && (
                  <span className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full bg-[#f5b301] text-slate-950 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="h-24 flex items-center justify-center mb-2 rounded-md bg-gradient-to-b from-[#f4f6f9] to-[#e4e8ef] border border-white/15 p-2 shadow-inner">
                  <WeaponCardVisual
                    weaponId={id}
                    alt={GRENADES[id].name}
                    imageUrl={toAssetUrl(`weapons/${id}.png`)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <strong className="block font-display text-xs font-bold text-white uppercase">
                  {GRENADES[id].name}
                </strong>
                <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">
                  {GRENADES[id].description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="px-6 py-4 border-t border-white/10 bg-[#0b1017] flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => (stage === 0 ? onBack() : setStage(stage - 1))}
          className="px-4 py-2 text-xs font-display font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => (stage < 3 ? setStage(stage + 1) : onDeploy(loadout))}
          className="px-6 py-2.5 rounded-lg bg-[#f5b301] hover:bg-[#ffc11a] text-slate-950 font-display font-extrabold text-xs uppercase tracking-wider cursor-pointer"
        >
          {stage < 3 ? 'Next Category' : 'Confirm Loadout'}
        </button>
      </footer>
    </div>
  );
}
