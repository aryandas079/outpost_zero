import * as THREE from 'three';
import { craftedBox } from './geometry';
import { ProceduralTextures } from './textures';
import { WeaponId } from './types';
import { weaponDecal } from './modelDecals';

/** First-person models in metres; barrels point down -Z. */
export function buildArmoryWeapon(id: WeaponId, textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const root = new THREE.Group();
  let attachment = root;
  root.name = `${id}-weapon`;
  const material = (color: number, metalness: number, roughness: number, textured = true) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness,
      normalMap: textured ? textures.gunMetalNormal : null,
      normalScale: new THREE.Vector2(0.08, 0.08) });
    materials.push(m); return m;
  };
  // Neutral finishes keep the procedural texture from painting broad scratches on every part.
  const steel = material(id === 'deagle' ? 0x9a9c9c : 0x555b60, 0.78, 0.36);
  const dark = material(0x111519, 0.55, 0.46);
  const rubber = material(0x181b1e, 0, 0.86);
  const polymer = material(0x282c2e, 0.04, 0.69);
  const tan = material(0x8c7857, 0.35, 0.58);
  const olive = material(0x55583b, 0.25, 0.58);
  const wood = material(0x6b3520, 0, 0.62);
  const brass = material(0xb69a56, 0.8, 0.3, false);
  steel.roughnessMap = textures.gunMetalRoughness;
  steel.roughness = 0.55;
  tan.roughnessMap = textures.gunFdeRoughness;
  wood.map = textures.woodPlankDarkColor;
  wood.color.setHex(0xbb8861);
  wood.normalMap = textures.woodPlankNormal;
  wood.normalScale.setScalar(0.17);
  const sight = material(0xc9cbb8, 0, 0.5, false);
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); attachment.add(m); return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat = steel) =>
    mesh(craftedBox(w, h, d, true), mat, x, y, z);
  const tube = (r: number, length: number, x: number, y: number, z: number, mat = steel, r2 = r) => {
    const m = mesh(new THREE.CylinderGeometry(r, r2, length, 32), mat, x, y, z);
    m.rotation.x = Math.PI / 2; return m;
  };
  const ring = (r: number, thickness: number, x: number, y: number, z: number, mat = steel) =>
    mesh(new THREE.TorusGeometry(r, thickness, 8, 32), mat, x, y, z);
  // Side profiles are extruded across the weapon, allowing tapered frames and real openings.
  const profile = (points: number[][], width: number, mat = steel, holes: number[][][] = []) => {
    const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([z, y]) => new THREE.Vector2(z, y))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - 0.002, bevelEnabled: true,
      bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 2, steps: 1, curveSegments: 8 });
    g.translate(0, 0, -(width - 0.002) / 2); g.rotateY(-Math.PI / 2);
    return mesh(g, mat, 0, 0, 0);
  };
  const rail = (start: number, end: number, y: number, width = 0.035) => {
    box(width * 0.75, 0.009, end - start, 0, y - 0.004, (start + end) / 2, dark);
    for (let z = start; z < end; z += 0.013) box(width, 0.006, 0.007, 0, y + 0.003, z, dark);
  };
  const muzzle = (z: number, radius: number, y = 0) => {
    root.userData.flashOrigin = new THREE.Vector3(0, y, z);
    ring(radius, 0.003, 0, y, z, dark);
    tube(radius - 0.003, 0.003, 0, y, z + 0.007, rubber);
  };
  const screws = (width: number, positions: number[][]) => {
    for (const side of [-1, 1]) for (const [z, y] of positions) {
      const bolt = tube(0.0032, 0.0018, side * width / 2, y, z, dark);
      bolt.rotation.set(0, 0, Math.PI / 2);
      box(0.002, 0.0007, 0.0038, side * (width / 2 + 0.001), y, z, steel);
    }
  };
  const trigger = (z: number) => {
    profile([[z + 0.025,-0.04],[z - 0.052,-0.04],[z - 0.063,-0.084],[z - 0.044,-0.103],[z + 0.022,-0.103]],0.019,dark,
      [[[z+0.015,-0.048],[z+0.015,-0.094],[z-0.04,-0.094],[z-0.053,-0.081],[z-0.045,-0.048]]]);
    const t = box(0.009,0.028,0.009,0,-0.063,z-0.019,dark); t.rotation.x=-0.2;
  };
  const grip = (z: number, mat = polymer) => {
    profile([[z-0.027,-0.037],[z+0.024,-0.04],[z+0.055,-0.173],[z-0.014,-0.18],[z-0.029,-0.148]],0.044,mat);
    box(0.048,0.009,0.065,0,-0.176,z+0.02,rubber);
  };
  const stock = (mat = polymer) => {
    tube(0.019,0.15,0,-0.01,0.055,dark);
    profile([[0.02,0.012],[0.18,0.012],[0.21,-0.025],[0.21,-0.13],[0.17,-0.13],[0.12,-0.06],[0.02,-0.04]],0.045,mat);
    box(0.05,0.145,0.018,0,-0.055,0.21,rubber);
  };
  const sights = (front: number) => {
    for (const x of [-0.018,0.018]) box(0.008,0.022,0.016,x,0.073,-0.15,dark);
    box(0.044,0.008,0.02,0,0.059,-0.15,dark);
    box(0.008,0.03,0.014,0,0.072,front,dark);
  };
  const holographic = () => {
    const optic = new THREE.Group(); optic.name = 'holographic-sight'; root.add(optic);
    attachment = optic;
    // An actual open window, with a beveled hood and a faint coated glass pane.
    box(0.069,0.021,0.09,0,0.08,-0.24,dark);
    for(const x of [-0.03,0.03]) {
      const side=box(0.012,0.069,0.043,x,0.12,-0.24,dark); side.rotation.z=x>0?0.07:-0.07;
    }
    box(0.063,0.012,0.043,0,0.155,-0.24,dark);
    const glass = new THREE.MeshPhysicalMaterial({color:0x9c7455,transparent:true,opacity:0.10,
      roughness:0.12,metalness:0.12,depthWrite:false,side:THREE.DoubleSide});
    materials.push(glass);
    mesh(new THREE.PlaneGeometry(0.045,0.052),glass,0,0.121,-0.24);
    const reticle = new THREE.MeshBasicMaterial({map:textures.holoReticle,color:0xff6438,
      transparent:true,opacity:0.9,depthWrite:false,side:THREE.DoubleSide});
    materials.push(reticle);
    mesh(new THREE.PlaneGeometry(0.021,0.021),reticle,0,0.121,-0.238);
    for(const x of [-0.017,0.017]) box(0.009,0.006,0.002,x,0.085,-0.193,polymer);
    attachment=root;
    screws(0.07,[[-0.24,0.081]]);
    root.userData.sightHeight=0.121;
  };
  const pistol = ['usp', 'glock', 'deagle'].includes(id);
  if (pistol) {
    const heavy = id === 'deagle';
    const front = heavy ? -0.46 : id === 'usp' ? -0.414 : -0.4;
    const width = heavy ? 0.049 : 0.036;
    const slide = new THREE.Group();
    slide.name = 'slide';
    root.add(slide);
    attachment = slide;
    profile([[front,0.023],[front+0.014,0.034],[-0.181,0.034],[-0.163,0.023],[-0.163,-0.018],[front,-0.018]],width,steel);
    attachment = root;
    profile([[front+0.008,-0.019],[-0.167,-0.019],[-0.165,-0.052],[-0.22,-0.058],[front+0.018,-0.04]],width-0.003,heavy ? steel : polymer);
    grip(-0.207,heavy ? rubber : polymer); trigger(-0.245);
    tube(0.011,0.016,0,0.004,front-0.003,dark); muzzle(front-0.013,0.011,0.004);
    // Slide serrations only on the sides: no floating strips crossing the slide.
    attachment = slide;
    for (const side of [-1,1]) for(let i=0;i<7;i++) {
      const cut=box(0.0012,0.032,0.0018,side*(width/2+0.0004),0.003,-0.18-i*0.005,dark);
      cut.rotation.x=-0.13;
    }
    box(0.015,0.0014,0.035,0.009,0.035,-0.267,dark);
    box(0.012,0.002,0.029,0.009,0.034,-0.267,steel);
    for(const x of [-0.012,0.012]) {
      box(0.007,0.009,0.011,x,0.039,-0.184,dark);
      tube(0.0016,0.002,x,0.041,-0.177,sight);
    }
    box(0.004,0.01,0.012,0,0.039,front+0.018,dark);
    tube(0.0016,0.002,0,0.042,front+0.025,sight);
    attachment = root;
    box(0.003,0.007,0.028,-width/2-0.002,-0.031,-0.228,dark);
    // Molded grip panels, a magazine release and the accessory rail under the dust cover.
    for(const side of [-1,1]) {
      const panel=box(0.002,0.073,0.036,side*0.023,-0.112,-0.186,rubber); panel.rotation.x=-0.18;
      box(0.003,0.006,0.008,side*0.025,-0.06,-0.203,dark);
    }
    for(let i=0;i<3;i++) box(width,0.003,0.002,0,-0.04,front+0.03+i*0.012,dark);
    if(heavy) {
      profile([[front,0.034],[front+0.035,0.046],[-0.26,0.046],[-0.252,0.034]],0.019,steel);
      box(0.012,0.022,0.014,0,0.012,-0.15,dark);
    }
    screws(width, [[-0.23,-0.033]]);
  } else if (id === 'rpg') {
    root.userData.flashOrigin = new THREE.Vector3(0, 0, -1.11);
    tube(0.035,0.88,0,0,-0.36,dark);
    tube(0.039,0.31,0,0,-0.19,wood);
    tube(0.065,0.105,0,0,0.11,dark,0.035);
    tube(0.038,0.13,0,0,-0.83,olive,0.077);
    tube(0.077,0.16,0,0,-0.975,olive,0.014);
    tube(0.014,0.055,0,0,-1.08,olive,0.005);
    grip(-0.17,wood); grip(-0.46,wood); trigger(-0.21);
    for(const z of [-0.37,-0.03]) ring(0.04,0.003,0,0,z,dark);
    for(const z of [-0.34,-0.29,-0.24,-0.19,-0.14,-0.09]) ring(0.04,0.0011,0,0,z,steel);
    for(const z of [-0.62,-0.58]) ring(0.036,0.002,0,0,z,steel);
    // Folding front ladder and a near-eye rear aperture with a real sight opening.
    profile([[-0.21,0.034],[-0.21,0.204],[-0.177,0.224],[-0.15,0.204],[-0.15,0.034]],0.009,dark,
      [[[-0.197,0.075],[-0.163,0.075],[-0.163,0.192],[-0.178,0.207],[-0.197,0.19]]]);
    for(const y of [0.08,0.11,0.14,0.17]) box(0.014,0.003,0.031,0,y,-0.18,steel);
    ring(0.011,0.003,0,0.11,-0.185,steel);
    profile([[-0.53,0.035],[-0.51,0.19],[-0.48,0.19],[-0.48,0.035]],0.007,dark,
      [[[-0.518,0.07],[-0.489,0.07],[-0.489,0.174],[-0.511,0.174]]]);
    box(0.018,0.024,0.02,0,0.049,-0.75,dark);
  } else if (id === 'grenadelauncher') {
    tube(0.048,0.28,0,0,-0.64,dark); muzzle(-0.785,0.048);
    tube(0.091,0.205,0,-0.045,-0.375,steel);
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      tube(0.028,0.196,Math.sin(a)*0.065,-0.045+Math.cos(a)*0.065,-0.375,dark);
    }
    for(const z of [-0.481,-0.269]) tube(0.093,0.012,0,-0.045,z,steel);
    profile([[-0.49,0.065],[-0.17,0.065],[-0.13,-0.035],[-0.27,-0.065],[-0.27,0.035],[-0.49,0.035]],0.043,steel);
    rail(-0.69,-0.26,0.076); grip(-0.18); trigger(-0.22); stock();
    box(0.035,0.13,0.04,0,-0.1,-0.6,polymer);
    for(let i=0;i<7;i++) for(const side of [-1,1]) box(0.002,0.014,0.012,side*0.048,0,-0.56-i*0.027,rubber);
  } else {
    const smg = id === 'smg', shotgun = id === 'shotgun', lmg = id === 'machinegun';
    const finish = id === 'marksman' ? tan : steel;
    const front = smg ? -0.63 : shotgun ? -0.89 : -0.92;
    profile([[-0.4,-0.04],[-0.4,0.026],[-0.36,0.047],[-0.1,0.047],[-0.06,0.018],[-0.07,-0.042]],smg ? 0.044 : 0.06,finish);
    grip(-0.15); trigger(-0.19); stock(id === 'marksman' ? tan : polymer);
    tube(shotgun ? 0.014 : 0.011,Math.abs(front+0.36),0,0.017,(front-0.36)/2,dark);
    muzzle(front,shotgun ? 0.014 : 0.011,0.017);
    if(smg) {
      tube(0.023,0.24,0,0.017,-0.4,steel);
      profile([[-0.55,0.01],[-0.38,0.01],[-0.36,-0.033],[-0.54,-0.025]],0.047,polymer);
      profile([[-0.31,-0.04],[-0.269,-0.04],[-0.268,-0.13],[-0.24,-0.235],[-0.283,-0.246],[-0.31,-0.14]],0.026,dark);
      ring(0.018,0.003,0,0.065,-0.57,dark);
      tube(0.016,0.014,0,0.066,-0.145,dark);
    } else if(shotgun) {
      tube(0.016,0.43,0,-0.02,-0.61,dark);
      profile([[-0.65,0.001],[-0.41,0.001],[-0.4,-0.047],[-0.63,-0.047]],0.048,polymer);
      for(let i=0;i<14;i++) for(const side of [-1,1]) box(0.001,0.029,0.002,side*0.025,-0.022,-0.43-i*0.014,rubber);
      rail(-0.32,-0.12,0.055); sights(-0.82);
    } else {
      profile([[-0.7,0.034],[-0.39,0.034],[-0.39,-0.038],[-0.67,-0.034]],0.055,finish);
      rail(-0.69,-0.1,0.055);
      for(let i=0;i<9;i++) for(const side of [-1,1]) {
        box(0.001,0.013,0.019,side*0.028,-0.002,-0.43-i*0.027,dark);
      }
      if(lmg) {
        box(0.115,0.125,0.14,0,-0.105,-0.32,olive);
        box(0.076,0.018,0.26,0,0.047,-0.255,dark);
        // Linked 5.56 rounds curve from feed tray into the textile ammunition bag.
        for(let i=0;i<10;i++) {
          const x=-0.047-Math.sin(i*0.14)*0.065,y=0.012-(1-Math.cos(i*0.14))*0.13;
          tube(0.005,0.041,x,y,-0.28,brass);
          tube(0.005,0.014,x,y,-0.307,brass,0.001);
          ring(0.0056,0.0012,x,y,-0.266,dark);
        }
        const bag=box(0.132,0.122,0.148,-0.028,-0.117,-0.32,olive);
        bag.material=material(0x636a4b,0,0.98);
        (bag.material as THREE.MeshStandardMaterial).map=textures.tacticalSleeveColor;
        for(const side of [-1,1]) for(let i=0;i<7;i++) {
          const hole=tube(0.006,0.002,side*0.029,0.005,-0.43-i*0.03,rubber);
          hole.rotation.set(0,0,Math.PI/2);
        }
        for(const side of [-1,1]) {
          const leg=box(0.009,0.24,0.012,side*0.055,-0.11,-0.69,dark); leg.rotation.z=side*0.28;
        }
        sights(-0.7); holographic();
      } else {
        profile([[-0.32,-0.035],[-0.235,-0.035],[-0.235,-0.16],[-0.31,-0.17]],0.039,dark);
        tube(0.022,0.22,0,0.12,-0.29,dark);
        for(const z of [-0.4,-0.18]) {
          tube(0.037,0.06,0,0.12,z,dark); ring(0.037,0.002,0,0.12,z+0.032);
          box(0.032,0.045,0.024,0,0.076,z,steel);
        }
        const lens=material(0x14232b,0.25,0.13,false);
        tube(0.031,0.002,0,0.12,-0.147,lens);
        const dial=tube(0.017,0.022,0,0.153,-0.29,dark); dial.rotation.x=0;
      }
    }
    // Bolt opening and charging handle sit on the side of the receiver.
    box(0.001,0.016,0.072,smg ? 0.023 : 0.031,0.009,-0.25,dark);
    box(0.014,0.009,0.012,smg ? 0.029 : 0.037,0.009,-0.222,steel);
    screws(smg ? 0.044 : 0.06,[[-0.12,-0.014],[-0.35,-0.018]]);
  }
  if(['usp','glock','deagle','rpg','machinegun'].includes(id)) {
    const row=id==='rpg'?3:id==='machinegun'?2:1;
    const decal=weaponDecal(textures,row,id==='rpg'?.16:.14,.014,geometries,materials);
    decal.rotation.y=-Math.PI/2;
    decal.position.set(id==='rpg'?-.04:id==='machinegun'?-.031:-.019,.008,id==='rpg'?-.21:-.27);
    root.add(decal);
  }
  return root;
}
