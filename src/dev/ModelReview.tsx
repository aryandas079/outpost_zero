import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FirstPersonWeaponRig} from '../game/weapon';
import {createProceduralTextures} from '../game/textures';
import {buildWestTownArena} from '../game/arena';
import {EnemyFactory} from '../game/enemies';
import {WeaponId,WEAPON_SPECS} from '../game/types';

/** Development-only art review. Uses the shipping geometry and materials without combat. */
export default function ModelReview() {
  const mount=useRef<HTMLDivElement>(null);
  const state=useRef({id:'carbine' as WeaponId,ads:false,reload:-1,inspect:false,enemy:false,grenade:false});
  const [id,setId]=useState<WeaponId>('carbine');
  useEffect(()=>{
    const container=mount.current!;
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=.98; container.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x86afce);scene.fog=new THREE.FogExp2(0xdec096,.0044);
    const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment(),.04);
    scene.environment=env.texture;scene.environmentIntensity=.42;pmrem.dispose();
    const camera=new THREE.PerspectiveCamera(75,1,.085,340);
    camera.position.set(-10,1.6,1.4);camera.rotation.y=-Math.PI/2;scene.add(camera);
    scene.add(new THREE.HemisphereLight(0x74a8dc,0x6b4a2b,.48));
    const sun=new THREE.DirectionalLight(0xffdba2,1.38);sun.position.set(68,34,42);scene.add(sun);
    const rim=new THREE.DirectionalLight(0x6c9fd4,.22);rim.position.set(-48,22,-40);scene.add(rim);
    const textures=createProceduralTextures(8),arena=buildWestTownArena(textures);
    scene.add(arena.group);arena.optimizeRendering();
    const rig=new FirstPersonWeaponRig(textures);camera.add(rig.root);
    const factory=new EnemyFactory(textures);
    const enemies=[factory.createEnemy('striker',new THREE.Vector3(-5,0,.2),1),factory.createEnemy('sentinel',new THREE.Vector3(-4,0,2.6),1)];
    enemies.forEach(e=>{e.root.rotation.y=-Math.PI/2;scene.add(e.root);});
    const resize=()=>{camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight);};
    resize();window.addEventListener('resize',resize);
    let frame=0,last=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(.033,(now-last)/1000);last=now;const s=state.current;
      rig.setWeapon(s.id);rig.root.visible=!s.enemy;
      enemies.forEach(e=>{e.root.visible=s.enemy;});
      if(s.reload>=0) {s.reload+=dt/WEAPON_SPECS[s.id].reloadTime;if(s.reload>1)s.reload=-1;}
      if(s.grenade) {rig.triggerGrenadeThrow('frag');s.grenade=false;}
      rig.update(dt,0,true,s.ads,s.reload>=0,Math.max(0,s.reload),1,0,0,false,false,false,s.inspect);
      camera.fov=s.ads?WEAPON_SPECS[s.id].adsFov:75;camera.updateProjectionMatrix();
      renderer.render(scene,camera);frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);rig.dispose();enemies.forEach(e=>factory.disposeEnemyMaterials(e));factory.dispose();arena.dispose();textures.dispose();env.dispose();renderer.dispose();container.replaceChildren();};
  },[]);
  return <div style={{position:'absolute',inset:0}}>
    <div ref={mount} style={{position:'absolute',inset:0}}/>
    <div style={{position:'absolute',left:20,top:18,fontFamily:'Arial Narrow,Arial',fontSize:13,color:'#f0f2ec',textShadow:'0 1px 3px #000'}}>OUTPOST ZERO / MODEL REVIEW<br/><span style={{color:'#65d3e4'}}>{WEAPON_SPECS[id].name}</span></div>
    <div className="model-review-tools" style={{position:'absolute',bottom:20,left:20,right:20,display:'flex',flexWrap:'wrap',justifyContent:'center',gap:6}}>
      {(['carbine','glock','machinegun','rpg','shotgun','smg','marksman','railpistol','usp','deagle','grenadelauncher'] as WeaponId[]).map(weapon=><button key={weapon} aria-pressed={weapon===id} onClick={()=>{state.current.id=weapon;state.current.enemy=false;setId(weapon);}}>{WEAPON_SPECS[weapon].shortLabel}</button>)}
      <button onClick={()=>state.current.ads=!state.current.ads}>Aim</button>
      <button onClick={()=>state.current.reload=0}>Reload</button>
      <button onClick={()=>state.current.inspect=!state.current.inspect}>Inspect</button>
      <button onClick={()=>state.current.grenade=true}>Throw frag</button>
      <button onClick={()=>state.current.enemy=!state.current.enemy}>Enemies</button>
    </div>
  </div>;
}
