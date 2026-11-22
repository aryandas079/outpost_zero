import * as THREE from 'three';

/** Retain texture relief and shaped highlights without the PBR/IBL shader cost. */
export class PerformanceMaterials {
  private readonly materials = new Map<THREE.MeshStandardMaterial, THREE.MeshPhongMaterial>();

  apply(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (Array.isArray(object.material)) {
        object.material = object.material.map(material => this.convert(material));
      } else object.material = this.convert(object.material);
    });
  }

  private convert(material: THREE.Material): THREE.Material {
    // Transparent glass keeps its original optical properties.
    if (!(material instanceof THREE.MeshStandardMaterial) || material.transparent) return material;
    let fast = this.materials.get(material);
    if (fast) return fast;
    fast = new THREE.MeshPhongMaterial({
      name: `${material.name || 'Surface'} (performance)`,
      color: material.color,
      map: material.map,
      normalMap: material.normalMap,
      normalMapType: material.normalMapType,
      normalScale: material.normalScale,
      bumpMap: material.bumpMap,
      bumpScale: material.bumpScale,
      aoMap: material.aoMap,
      aoMapIntensity: material.aoMapIntensity,
      alphaMap: material.alphaMap,
      alphaTest: material.alphaTest,
      emissive: material.emissive,
      emissiveMap: material.emissiveMap,
      emissiveIntensity: material.emissiveIntensity,
      shininess: 3 + Math.pow(1 - material.roughness, 3) * 95,
      specular: new THREE.Color().lerpColors(new THREE.Color(0x111111), material.color, material.metalness * 0.5),
      side: material.side,
      vertexColors: material.vertexColors,
      flatShading: material.flatShading,
      fog: material.fog,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      polygonOffset: material.polygonOffset,
      polygonOffsetFactor: material.polygonOffsetFactor,
      polygonOffsetUnits: material.polygonOffsetUnits,
    });
    fast.userData = { ...material.userData };
    this.materials.set(material, fast);
    return fast;
  }

  dispose() {
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }
}
