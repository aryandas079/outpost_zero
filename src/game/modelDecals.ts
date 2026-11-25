import * as THREE from 'three';
import { ProceduralTextures } from './textures';

export function weaponDecal(
  textures: ProceduralTextures,
  row: number,
  width: number,
  height: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, (uv.getY(i) + 11 - row) / 12);
  }
  const material = new THREE.MeshStandardMaterial({
    map: textures.weaponMarkings,
    transparent: true,
    alphaTest: 0.08,
    opacity: 0.92,
    roughness: 0.62,
    metalness: 0.18,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  geometries.push(geometry);
  materials.push(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Etched factory markings';
  return mesh;
}
