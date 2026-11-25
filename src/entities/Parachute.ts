/**
 * Tactical Ram-Air Parachute Canopy, Suspension Harness & Third-Person Skydiver Character Rig.
 */

import * as THREE from 'three';
import { craftedBox } from '../game/geometry';

export interface PlayerSkydiverRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  canopyGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

export function buildTacticalParachute(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Tactical_RamAir_Parachute';

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d3c,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf5b301,
    roughness: 0.58,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });

  const lineMat = new THREE.MeshBasicMaterial({ color: 0x22262a });

  const cellCount = 7;
  const cellWidth = 0.86;
  for (let i = 0; i < cellCount; i++) {
    const offsetIndex = i - (cellCount - 1) * 0.5;
    const x = offsetIndex * cellWidth;
    const archY = 4.85 - Math.abs(offsetIndex) * Math.abs(offsetIndex) * 0.095;
    const archRoll = -offsetIndex * 0.085;
    const isAccent = Math.abs(offsetIndex) === 2;

    const cell = new THREE.Mesh(craftedBox(cellWidth * 0.96, 0.34, 2.45), isAccent ? accentMat : canopyMat);
    cell.position.set(x, archY, 0);
    cell.rotation.z = archRoll;
    cell.castShadow = true;
    group.add(cell);
  }

  const riserAnchors: Array<[number, number, number, number]> = [
    [-0.35, 1.4, -2.1, 0.55],
    [-0.35, 1.4, -2.1, -0.55],
    [0.35, 1.4, 2.1, 0.55],
    [0.35, 1.4, 2.1, -0.55],
  ];
  for (let i = 0; i < riserAnchors.length; i++) {
    const [sx, sy, tx, tz] = riserAnchors[i];
    const start = new THREE.Vector3(sx, sy, 0);
    const end = new THREE.Vector3(tx, 4.55, tz);
    const delta = end.clone().sub(start);
    const len = delta.length();
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 5), lineMat);
    riser.position.copy(start).addScaledVector(delta, 0.5);
    riser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    group.add(riser);
  }

  group.traverse((obj) => {
    obj.userData.noCollide = true;
  });

  return group;
}

/**
 * Articulated Third-Person Skydiver & Paratrooper Operative Rig for freefall diving & parachute descent.
 */
export function buildPlayerSkydiverRig(): PlayerSkydiverRig {
  const root = new THREE.Group();
  root.name = 'Player_ThirdPerson_Skydiver';

  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 1.0, 0);
  root.add(bodyPivot);

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x2a313c, roughness: 0.76, metalness: 0.12 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.68, metalness: 0.18 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.45, metalness: 0.25 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x222832, roughness: 0.55, metalness: 0.28 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.65 });

  // Torso & Tactical Vest + Chute Pack
  const torso = new THREE.Mesh(craftedBox(0.52, 0.68, 0.3), vestMat);
  torso.position.set(0, 0.08, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  const chutePack = new THREE.Mesh(craftedBox(0.42, 0.54, 0.24), suitMat);
  chutePack.position.set(0, 0.1, 0.23);
  chutePack.castShadow = true;
  bodyPivot.add(chutePack);

  const packStripe = new THREE.Mesh(craftedBox(0.43, 0.09, 0.25), goldTrimMat);
  packStripe.position.set(0, 0.25, 0.23);
  bodyPivot.add(packStripe);

  // Helmet & Visor
  const head = new THREE.Mesh(craftedBox(0.32, 0.32, 0.34), helmetMat);
  head.position.set(0, 0.62, -0.02);
  head.castShadow = true;
  bodyPivot.add(head);

  const visor = new THREE.Mesh(craftedBox(0.26, 0.11, 0.06), visorMat);
  visor.position.set(0, 0.63, -0.18);
  bodyPivot.add(visor);

  // Articulated Arms
  const makeLimb = (w: number, h: number, d: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(craftedBox(w, h, d), mat);
    mesh.position.set(0, -h * 0.5, 0);
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };

  const leftArm = makeLimb(0.16, 0.58, 0.16, suitMat);
  leftArm.position.set(-0.35, 0.34, 0);
  bodyPivot.add(leftArm);

  const rightArm = makeLimb(0.16, 0.58, 0.16, suitMat);
  rightArm.position.set(0.35, 0.34, 0);
  bodyPivot.add(rightArm);

  // Articulated Legs
  const leftLeg = makeLimb(0.2, 0.76, 0.2, suitMat);
  leftLeg.position.set(-0.15, -0.26, 0);
  bodyPivot.add(leftLeg);

  const rightLeg = makeLimb(0.2, 0.76, 0.2, suitMat);
  rightLeg.position.set(0.15, -0.26, 0);
  bodyPivot.add(rightLeg);

  // Ram-air canopy attached cleanly over the harness
  const canopyGroup = buildTacticalParachute();
  canopyGroup.visible = false;
  root.add(canopyGroup);

  root.traverse((obj) => {
    obj.userData.noCollide = true;
  });

  return { root, bodyPivot, canopyGroup, leftArm, rightArm, leftLeg, rightLeg };
}

export function updateSkydiverRigPose(
  rig: PlayerSkydiverRig,
  stage: 'freefall' | 'parachute',
  moveFwd: number,
  moveRight: number,
  elapsedSec: number,
): void {
  const flutter = Math.sin(elapsedSec * (stage === 'freefall' ? 14 : 4)) * (stage === 'freefall' ? 0.14 : 0.04);

  if (stage === 'freefall') {
    rig.canopyGroup.visible = false;
    // Aerodynamic belly-to-earth / head-forward skydiving posture
    rig.bodyPivot.rotation.set(1.18 + moveFwd * 0.22, 0, -moveRight * 0.42);
    rig.leftArm.rotation.set(0.55 + flutter, 0, -0.68);
    rig.rightArm.rotation.set(0.55 - flutter, 0, 0.68);
    rig.leftLeg.rotation.set(-0.35 + flutter * 0.8, 0, -0.18);
    rig.rightLeg.rotation.set(-0.35 - flutter * 0.8, 0, 0.18);
  } else {
    rig.canopyGroup.visible = true;
    rig.canopyGroup.rotation.set(0.08 * moveFwd, 0, -0.16 * moveRight);
    // Upright suspended harness holding parachute risers
    rig.bodyPivot.rotation.set(-0.12 + moveFwd * 0.14, 0, -moveRight * 0.28);
    rig.leftArm.rotation.set(2.55, 0, -0.24);
    rig.rightArm.rotation.set(2.55, 0, 0.24);
    rig.leftLeg.rotation.set(0.16 + flutter, 0, -0.08);
    rig.rightLeg.rotation.set(-0.08 - flutter, 0, 0.08);
  }
}
