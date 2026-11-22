import * as THREE from 'three';
import { craftedBox } from './geometry';
import { ProceduralTextures } from './textures';
import { GrenadeId } from './types';
import { weaponDecal } from './modelDecals';

export function buildThrowable(id: GrenadeId, textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const root = new THREE.Group(); root.name=`${id}-throwable`;
  const mat=(color:number,metalness:number,roughness:number)=>{
    const m=new THREE.MeshStandardMaterial({color,metalness,roughness,normalMap:textures.gunMetalNormal,normalScale:new THREE.Vector2(.12,.12)});
    materials.push(m);return m;
  };
  const olive=mat(id==='flashbang'?0x989b8c:0x62633b,.35,.63),steel=mat(0x939184,.8,.35),dark=mat(0x292c2b,.5,.57);
  const add=(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{
    geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  if(id==='frag') {
    const body=add(new THREE.SphereGeometry(.046,32,24),olive,0,-.009,0);body.scale.set(1,1.08,1);
    add(new THREE.CylinderGeometry(.018,.025,.017,20),dark,0,.041,0);
    add(new THREE.TorusGeometry(.045,.0011,6,32),dark,0,-.015,0).rotation.x=Math.PI/2;
    const label=weaponDecal(textures,4,.10,.018,geometries,materials);
    label.position.set(0,-.008,.046);root.add(label);
  } else if(id==='molotov') {
    const bottle=mat(0x5c6b35,.12,.25);
    add(new THREE.LatheGeometry([new THREE.Vector2(0,-.08),new THREE.Vector2(.028,-.08),new THREE.Vector2(.03,-.065),
      new THREE.Vector2(.03,.015),new THREE.Vector2(.012,.045),new THREE.Vector2(.01,.075)],24),bottle);
    add(new THREE.CylinderGeometry(.009,.009,.035,12),mat(0xb7a181,0,.99),0,.082,0).rotation.z=-.3;
    return root;
  } else {
    add(new THREE.CylinderGeometry(.026,.026,.115,24),olive,0,-.008,0);
    for(const y of [-.062,.048]) add(new THREE.CylinderGeometry(.028,.028,.005,24),dark,0,y,0);
    if(id==='flashbang') for(let y=0;y<4;y++) for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      const vent=add(new THREE.CircleGeometry(.0032,8),dark,Math.cos(a)*.0262,-.046+y*.023,Math.sin(a)*.0262);
      vent.lookAt(Math.cos(a),vent.position.y,Math.sin(a));
    }
  }
  const spoon=add(craftedBox(.018,.008,.045,true),steel,.005,.057,.006);spoon.rotation.z=-.12;
  const lever=add(craftedBox(.012,.064,.005,true),steel,.026,.024,.023);lever.rotation.z=.27;
  add(new THREE.TorusGeometry(.018,.0016,8,24),steel,-.024,.045,.009).rotation.y=.3;
  const pin=add(new THREE.CylinderGeometry(.0015,.0015,.048,8),steel,-.006,.047,.008);pin.rotation.z=Math.PI/2;
  return root;
}
