import { useState } from 'react';
import { Check } from 'lucide-react';
import { Loadout, WeaponId, WEAPON_SPECS, GrenadeId } from '../game/types';
import { DEFAULT_LOADOUT, GRENADES, LAUNCHERS, PRIMARY_WEAPONS, SIDEARMS, normalizeLoadout } from '../game/loadout';
import { toAssetUrl } from '../utils/assets';

interface LoadoutSelectionProps {
  initial?: Loadout;
  onBack: () => void;
  onDeploy: (loadout: Loadout) => void;
}

export function LoadoutSelection({ initial, onBack, onDeploy }: LoadoutSelectionProps) {
  const [loadout, setLoadout] = useState(() => normalizeLoadout(initial ?? DEFAULT_LOADOUT));
  const [editingSlot, setEditingSlot] = useState<0 | 1>(0);
  const [stage, setStage] = useState(0);
  const stages = ['Primary', 'Sidearm', 'Launcher', 'Grenades'];

  const chooseWeapon = (id: WeaponId) => {
    if (stage === 0) {
      setLoadout(previous => {
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
      setLoadout(previous => ({ ...previous, [stage === 1 ? 'sidearm' : 'launcher']: id }));
    }
  };

  const weapons = stage === 0 ? PRIMARY_WEAPONS : stage === 1 ? SIDEARMS : LAUNCHERS;

  return (
    <div className="loadout-shell">
      <header className="loadout-header"><h2 className="font-display">Loadout</h2></header>
      <nav className="loadout-steps" aria-label="Loadout categories">
        {stages.map((name, index) => (
          <button key={name} type="button" onClick={() => setStage(index)} aria-current={stage === index ? 'step' : undefined}>
            {name}
          </button>
        ))}
      </nav>
      <div className="loadout-content">
        {stage === 0 && (
          <div className="loadout-slots" role="group" aria-label="Two primary weapon slots">
            {loadout.primary.map((id, index) => (
              <button key={index} type="button" aria-pressed={editingSlot === index} onClick={() => setEditingSlot(index as 0 | 1)}>
                <span>Primary {index + 1}</span>
                <strong>{WEAPON_SPECS[id].shortLabel}</strong>
              </button>
            ))}
          </div>
        )}
        {stage < 3 ? (
          <>
            <div className="loadout-grid">
              {weapons.map(id => {
                const spec = WEAPON_SPECS[id];
                const selected = stage === 0 ? loadout.primary.includes(id) : stage === 1 ? loadout.sidearm === id : loadout.launcher === id;
                return (
                  <button key={id} type="button" className={'weapon-choice' + (selected ? ' selected' : '')} onClick={() => chooseWeapon(id)} aria-pressed={selected}>
                    {selected && <Check className="choice-check" size={17} aria-hidden="true" />}
                    <div className="weapon-photo"><img src={toAssetUrl('weapons/' + id + '.png')} alt={spec.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>
                    <strong>{spec.shortLabel}</strong>
                  </button>
                );
              })}
            </div>
            {stage === 2 && (
              <button type="button" className="no-launcher" aria-pressed={loadout.launcher === null} onClick={() => setLoadout(previous => ({ ...previous, launcher: null }))}>
                <span className="selection-dot" aria-hidden="true" />No launcher
              </button>
            )}
          </>
        ) : (
          <div className="loadout-grid grenade-grid">
            {(Object.keys(GRENADES) as GrenadeId[]).map(id => (
              <button key={id} type="button" className={'weapon-choice' + (loadout.grenade === id ? ' selected' : '')} aria-pressed={loadout.grenade === id} onClick={() => setLoadout(previous => ({ ...previous, grenade: id }))}>
                {loadout.grenade === id && <Check className="choice-check" size={17} aria-hidden="true" />}
                <div className="weapon-photo grenade-photo"><img src={toAssetUrl('weapons/' + id + '.png')} alt={GRENADES[id].name} onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>
                <strong>{GRENADES[id].name}</strong>
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className="loadout-footer">
        <button type="button" className="loadout-back" onClick={() => stage === 0 ? onBack() : setStage(stage - 1)}>Back</button>
        <button type="button" className="loadout-deploy" onClick={() => stage < 3 ? setStage(stage + 1) : onDeploy(loadout)}>
          {stage < 3 ? 'Next' : 'Start Game'}
        </button>
      </footer>
    </div>
  );
}
