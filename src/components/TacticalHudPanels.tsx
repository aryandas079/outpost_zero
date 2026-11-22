import { Maximize2, Settings, Volume2, VolumeX, Shield, Plus, Footprints, RectangleEllipsis } from 'lucide-react';
import { HudSnapshot, KeyBindings, WeaponId, WEAPON_SPECS } from '../game/types';
import { GRENADES } from '../game/loadout';
import { RadarMinimap } from './RadarMinimap';
import { WeaponSilhouette } from './WeaponSilhouette';

interface Props {
  hud: HudSnapshot;
  muted: boolean;
  isMobile: boolean;
  controls: KeyBindings;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onReload: () => void;
  onThrowGrenade: () => void;
  onDash: () => void;
}

const directions: Record<number,string> = {0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SW',270:'W',315:'NW'};
const keyLabel = (key: string) => key.replace('Key','').replace('Digit','').replace('Left','').replace('Right','');
const clock = (seconds: number) => `${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds))%60).padStart(2,'0')}`;

export function TacticalHudPanels({hud,muted,isMobile,controls,onPause,onToggleMute,onToggleFullscreen,onSelectWeapon,onReload,onThrowGrenade,onDash}: Props) {
  const spec = WEAPON_SPECS[hud.weaponId];
  const heading = Math.round(hud.headingDeg)%360;
  const ticks = Array.from({length:13},(_,i)=>Math.floor(heading/15)*15+(i-6)*15);
  const deathmatch = hud.multiplayer?.mode==='deathmatch';
  const leader = Math.max(0,...(hud.multiplayer?.players.map(p=>p.kills)??[]));
  const topScore = hud.eliminations;
  const secondScore = deathmatch ? leader : hud.enemiesRemaining;
  const scoreLimit = deathmatch ? hud.multiplayer?.killLimit??30 : Math.max(10,topScore+secondScore);
  const health = Math.max(0,Math.min(100,hud.health/Math.max(1,hud.maxHealth)*100));
  const shield = Math.max(0,Math.min(100,hud.shield/Math.max(1,hud.maxShield)*100));
  const dashReady = hud.dashCooldown<=0.02;
  return <div className={`tactical-hud ${isMobile?'tactical-hud--mobile':''}`}>
    <div className="tac-match">
      <svg className="tac-crest" viewBox="0 0 64 68" fill="none" aria-hidden="true">
        <path d="M32 5 48 12 46 39 32 61 18 39 16 12Z" stroke="currentColor" strokeWidth="1.2" opacity=".65"/>
        <path d="m4 8 20 10 8-5 8 5L60 8 49 26l-9 4-8 23-8-23-9-4Zm17 11 6 13 5-8 5 8 6-13-11 5Z" fill="currentColor"/>
        <path d="m12 30 9 7 11 27 11-27 9-7M23 15l9-9 9 9" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <div className="tac-match-body">
        <div className="tac-mode">{deathmatch?'DEATHMATCH':hud.multiplayer?'CO-OP SURVIVAL':'SECTOR DEFENSE'}</div>
        <div className="tac-match-scores">
          <div className="tac-score-bars">
            <div><strong>{topScore}</strong><i><b style={{width:`${Math.min(100,topScore/scoreLimit*100)}%`}}/></i></div>
            <div><strong>{secondScore}</strong><i><b className="tac-score-hostile" style={{width:`${Math.min(100,secondScore/scoreLimit*100)}%`}}/></i></div>
          </div>
          <time>{clock(hud.multiplayer?.matchTimeRemaining??hud.matchTimeSec)}</time>
        </div>
        <div className="tac-status">{deathmatch?(topScore>=leader?'LEADING':'CONTESTED'):`WAVE ${hud.wave} / ${hud.endless?'∞':hud.maxWaves}`}</div>
      </div>
      <div className="tac-killfeed">{hud.killFeed.slice(0,3).map(entry=><div key={entry.id}>
        <span>{entry.killer}</span><WeaponSilhouette weaponId={entry.weapon}/><span>{entry.victim}</span>
      </div>)}</div>
    </div>

    <div className="tac-compass" aria-label={`Heading ${heading} degrees`}>
      {ticks.map(deg=>{
        const normalized=(deg%360+360)%360,offset=deg-heading;
        return <div key={deg} className={`tac-compass-tick ${directions[normalized]?'is-cardinal':''}`}
          style={{left:`${50+offset/75*50}%`,opacity:Math.abs(offset)<5?0:Math.max(0,1-Math.max(0,Math.abs(offset)-48)/35)}}>
          <i/><span>{directions[normalized]??normalized}</span>
        </div>;
      })}
      <div className="tac-bearing"><i/>{heading}</div>
    </div>

    <div className="tac-radar">
      <div className="tac-utilities">
        <button onClick={onPause} aria-label="Settings and pause"><Settings/></button>
        <button onClick={onToggleMute} aria-label={muted?'Unmute audio':'Mute audio'}>{muted?<VolumeX/>:<Volume2/>}</button>
        <button onClick={onToggleFullscreen} aria-label="Toggle fullscreen"><Maximize2/></button>
      </div>
      <RadarMinimap radar={hud.radar} compact={isMobile}/>
    </div>

    <div className="tac-vitals-equipment">
      <div className={`tac-vitals tac-panel ${hud.health<=30?'is-critical':''}`} aria-label={`Health ${hud.health}, shield ${hud.shield}`}>
        <div><Shield/><strong>{hud.shield}</strong><i><b style={{width:`${shield}%`}}/></i></div>
        <div><Plus/><strong>{hud.health}</strong><i><b style={{width:`${health}%`}}/></i></div>
      </div>
      <div className="tac-equipment">
        <button onClick={onThrowGrenade} disabled={hud.grenadesRemaining===0} aria-label={`Throw ${GRENADES[hud.grenade].name}`}>
          <WeaponSilhouette weaponId={hud.grenade}/><kbd>{keyLabel(controls.grenade)}</kbd><small>{hud.grenadesRemaining}</small>
        </button>
        <button onClick={onReload} aria-label="Reload weapon"><RectangleEllipsis/><kbd>{keyLabel(controls.reload)}</kbd></button>
        <button onClick={onDash} disabled={!dashReady} aria-label="Tactical dash"><Footprints/><div className="tac-dash-bars">{[0,1,2].map(i=><i key={i} style={{opacity:dashReady||1-hud.dashCooldown/hud.dashCooldownMax>(i+1)/3?1:0.2}}/>)}</div><kbd>{keyLabel(controls.dash)}</kbd></button>
      </div>
    </div>

    <div className="tac-weapon tac-panel" aria-label={`${spec.name}, ${hud.ammo} rounds, ${hud.reserve} reserve`}>
      <div className="tac-weapon-header"><span>{spec.shortLabel}</span><i>//</i><small>▮▮▮ {spec.automatic?'AUTO':spec.magSize===1?'SINGLE':'SEMI'}</small></div>
      <div className="tac-ammunition"><div><strong className={hud.ammo<=Math.ceil(hud.magSize*.25)?'is-low':''}>{hud.ammo}</strong><span>/ {hud.reserve}</span></div><WeaponSilhouette weaponId={hud.weaponId}/></div>
      {hud.reloading&&<div className="tac-reload" role="progressbar" aria-label="Reloading" aria-valuenow={Math.round(hud.reloadProgress*100)}><i style={{width:`${hud.reloadProgress*100}%`}}/></div>}
    </div>
    <div className="tac-inventory">{hud.inventory.map((weapon,i)=><button key={weapon.id} onClick={()=>onSelectWeapon(weapon.id)} aria-label={`Equip ${WEAPON_SPECS[weapon.id].name}`} aria-pressed={weapon.id===hud.weaponId}>
      <WeaponSilhouette weaponId={weapon.id}/><kbd>{i+1}</kbd>
    </button>)}</div>
  </div>;
}
