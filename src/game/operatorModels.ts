import * as THREE from 'three';
import { craftedBox, batchDecoration } from './geometry';
import { ProceduralTextures } from './textures';
import { WeaponId } from './types';

type Point = [number, number, number];

/** Closed, tapered fabric/leather surfaces. UVs follow the length of each limb. */
export function tailoredLimb(points: Point[], radii: Array<[number, number]>, segments = 24, sides = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPointAt(t);
    const f = t * (radii.length - 1), a = Math.min(radii.length - 2, Math.floor(f)), k = f - a;
    const rx = THREE.MathUtils.lerp(radii[a][0], radii[a + 1][0], k);
    const ry = THREE.MathUtils.lerp(radii[a][1], radii[a + 1][1], k);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const v = p.clone().addScaledVector(frames.normals[i], Math.cos(angle) * rx)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * ry);
      positions.push(v.x, v.y, v.z); uvs.push(j / sides, t * 2);
      if (i < segments && j < sides) {
        const q = i * (sides + 1) + j;
        indices.push(q, q + 1, q + sides + 1, q + 1, q + sides + 2, q + sides + 1);
      }
    }
  }
  // Both ends close against the wrist/palm; no visible open cylinder caps.
  for (const end of [0, segments]) {
    const p = curve.getPointAt(end / segments), center = positions.length / 3;
    positions.push(p.x, p.y, p.z); uvs.push(0.5, end / segments);
    for (let j = 0; j < sides; j++) {
      const q = end * (sides + 1) + j;
      indices.push(...(end === 0 ? [center, q + 1, q] : [center, q, q + 1]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  // Weld the UV seam's shading without welding its texture coordinates.
  const normals = geometry.attributes.normal, n = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const first = i * (sides + 1), last = first + sides;
    n.fromBufferAttribute(normals, first).add(b.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, n.x, n.y, n.z); normals.setXYZ(last, n.x, n.y, n.z);
  }
  return geometry;
}

/** Bespoke full-finger combat gloves, with a grip fitted to the actual weapon. */
export function buildOperatorHands(id: WeaponId, textures: ProceduralTextures,
  geometries: THREE.BufferGeometry[], materials: THREE.Material[]) {
  const makeMat = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(params); materials.push(m); return m;
  };
  const leather = makeMat({ map: textures.tacticalGloveColor, normalMap: textures.tacticalGloveNormal,
    normalScale: new THREE.Vector2(0.32, 0.32), color: 0xaaaeb1, roughness: 0.84, metalness: 0 });
  leather.name = 'Black pebbled leather';
  const fabric = makeMat({ map: textures.tacticalSleeveColor, bumpMap: textures.tacticalSleeveBump,
    bumpScale: 0.00055, color: 0x969ba0, roughness: 0.96 });
  fabric.name = 'Charcoal ripstop';
  const padding = makeMat({ map: textures.tacticalGloveColor, normalMap: textures.tacticalGloveNormal,
    normalScale: new THREE.Vector2(0.18, 0.18), color: 0x72787c, roughness: 0.93 });
  const stitch = makeMat({ color: 0x646765, roughness: 1 });
  const bezel = makeMat({ color: 0x272c30, roughness: 0.42, metalness: 0.72 });
  const glass = makeMat({ color: 0x0b1418, roughness: 0.18, metalness: 0.2 });
  const left = new THREE.Group(), right = new THREE.Group();
  left.name = 'operator-left-gloved-hand'; right.name = 'operator-right-gloved-hand';
  const mesh = (group: THREE.Group, g: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    geometries.push(g); const m = new THREE.Mesh(g, mat); m.name = name; group.add(m); return m;
  };
  const ellipsoid = (group: THREE.Group, p: Point, size: Point, mat: THREE.Material, name: string) => {
    const g = new THREE.SphereGeometry(1, 20, 14); g.scale(...size); g.translate(...p);
    return mesh(group, g, mat, name);
  };
  const limb = (group: THREE.Group, p: Point[], radii: Array<[number, number]>, mat: THREE.Material, name: string) =>
    mesh(group, tailoredLimb(p, radii), mat, name);
  const seam = (group: THREE.Group, p: Point[]) => {
    const curve = new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v)));
    mesh(group, new THREE.TubeGeometry(curve, 20, 0.00045, 4, false), stitch, 'Double stitched seam');
  };
  const sleeve = (group: THREE.Group, wrist: Point, sign: number) => {
    const [x,y,z] = wrist;
    limb(group, [[sign * 0.32,-0.37,0.28],[sign * 0.22,-0.25,z+0.2],
      [x+sign*0.023,y-0.03,z+0.05],[x,y,z]], [[0.065,0.061],[0.057,0.049],[0.044,0.037],[0.034,0.03]], fabric, 'Continuous combat sleeve');
    // Overlapping cuff and compression folds, following the arm instead of floating bands.
    for (let i = 0; i < 3; i++) {
      ellipsoid(group, [x+sign*0.003*i,y-0.006*i,z+0.012*i], [0.036+i*0.002,0.031,0.014], padding, 'Cuff fold');
    }
    seam(group, [[sign*0.29,-0.315,0.2],[sign*0.18,-0.205,z+0.15],[x-sign*0.025,y+0.012,z+0.035]]);
  };
  const pistol = ['usp','glock','deagle'].includes(id);
  const gripZ = id === 'carbine' ? 0.132 : id === 'railpistol' ? 0.115 : pistol ? -0.187 : -0.13;
  const firingHand = (group: THREE.Group, z: number, sign: number, support = false) => {
    const extra = support ? -0.018 : 0;
    const wrist: Point = [sign*0.063+extra,-0.16,z+0.1];
    sleeve(group, wrist, sign);
    limb(group, [wrist,[sign*0.047+extra,-0.115,z+0.053],[sign*0.03+extra,-0.077,z+0.022]],
      [[0.032,0.026],[0.036,0.025],[0.034,0.023]], leather, 'Sculpted glove palm');
    ellipsoid(group,[sign*0.044+extra,-0.1,z+0.038],[0.016,0.035,0.028],padding,'Dorsal reinforcement');
    for (let i=0;i<4;i++) {
      const y = -0.075-i*0.021;
      // Index finger reaches the trigger; the remaining fingers curl around the frontstrap.
      const trigger = i===0 && !support;
      const fz = z-(trigger ? 0.043 : 0.023);
      limb(group, [[sign*0.036+extra,y,z+0.015],[sign*0.033+extra,y-0.004,fz],
        [sign*0.008+extra,y-0.008,fz-0.012],[-sign*0.018+extra,y-0.004,fz+0.002]],
        [[0.010,0.010],[0.011,0.010],[0.009,0.009],[0.005,0.006]],leather,`Covered ${i===0?'index':'grip'} finger`);
      ellipsoid(group,[sign*0.039+extra,y,z+0.004],[0.007,0.009,0.012],padding,'Flexible knuckle pad');
    }
    limb(group,[[sign*0.038+extra,-0.075,z+0.047],[sign*0.006+extra,-0.05,z+0.025],[-sign*0.024+extra,-0.055,z-0.004]],
      [[0.015,0.012],[0.013,0.012],[0.008,0.008]],leather,'Opposing thumb');
    seam(group,[[sign*0.06+extra,-0.14,z+0.086],[sign*0.063+extra,-0.108,z+0.055],[sign*0.048+extra,-0.078,z+0.035]]);
  };
  firingHand(right,gripZ,1);
  if (pistol || id==='rpg') {
    firingHand(left,pistol ? gripZ+0.015 : -0.435,-1,pistol);
  } else {
    const z = id==='carbine' ? -0.36 : id==='railpistol' ? -0.38 : id==='smg' ? -0.43 : -0.56;
    sleeve(left,[-0.09,-0.105,z+0.11],-1);
    limb(left,[[-0.09,-0.105,z+0.11],[-0.068,-0.065,z+0.035],[-0.044,-0.029,z]],
      [[0.033,0.027],[0.037,0.025],[0.039,0.023]],leather,'Supporting glove palm');
    ellipsoid(left,[-0.071,-0.049,z+0.02],[0.013,0.033,0.038],padding,'Stitched dorsal leather panel');
    for(let i=0;i<4;i++) {
      const fz=z-0.036+i*0.022;
      limb(left,[[-0.047,-0.015,fz],[-0.034,-0.052,fz-0.004],[0.012,-0.055,fz-0.002],[0.035,-0.018,fz]],
        [[0.011,0.011],[0.011,0.010],[0.009,0.009],[0.005,0.006]],leather,'Wrapped support finger');
      ellipsoid(left,[-0.055,-0.023,fz],[0.009,0.012,0.011],padding,'Segmented knuckle');
    }
    limb(left,[[-0.065,-0.018,z+0.053],[-0.039,0.01,z+0.04],[-0.017,0.02,z+0.003]],
      [[0.014,0.013],[0.012,0.012],[0.007,0.008]],leather,'Support thumb');
    for(const offset of [-0.028,0.028]) seam(left,[[-0.08,-0.071,z+0.07+offset],[-0.086,-0.043,z+0.03+offset],[-0.065,-0.014,z+offset]]);
    // Field watch on the outer wrist, clear of the handguard.
    const watch = mesh(left, craftedBox(0.014,0.045,0.05,true),bezel,'Field watch case');
    watch.position.set(-0.122,-0.095,z+0.115); watch.rotation.z=-0.3;
    const face=mesh(left,craftedBox(0.002,0.032,0.035,true),glass,'Watch glass');
    face.position.copy(watch.position).x-=0.008; face.rotation.copy(watch.rotation);
  }
  // Each arm keeps its own reload pivot; small details share material submissions.
  for(const arm of [left,right]) batchDecoration(arm,new Set(),new Set(),geometries,true);
  return {left,right};
}
