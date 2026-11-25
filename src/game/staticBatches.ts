import * as THREE from 'three';

interface VisibilityLink {
  source: THREE.Mesh;
  batch: THREE.BatchedMesh;
  id: number;
  visible: boolean;
  layerMask: number;
  parent: THREE.Object3D | null;
  ancestry: THREE.Object3D[];
}

/** Multi-draw submission with the existing collision and visibility hierarchy intact. */
export class StaticSceneBatches {
  private readonly batches: THREE.BatchedMesh[] = [];
  private readonly links: VisibilityLink[] = [];
  public readonly sourceCount: number;
  public readonly batchCount: number;

  constructor(root: THREE.Object3D, animatedRoots: Set<THREE.Object3D>) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    const buckets = new Map<string, THREE.Mesh[]>();
    const collect = (object: THREE.Object3D) => {
      if (animatedRoots.has(object)) return;
      for (const child of object.children) collect(child);
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh ||
          object instanceof THREE.BatchedMesh || object.children.length || Array.isArray(object.material) ||
          object.material.transparent || object.renderOrder !== 0 || object.matrixWorld.determinant() < 0) return;
      const layout = (Object.entries(object.geometry.attributes) as Array<[string, THREE.BufferAttribute]>)
        .map(([name, attr]) => `${name}:${attr.itemSize}:${attr.normalized}`).sort().join(',');
      const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${layout}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(object);
      buckets.set(key, bucket);
    };
    collect(root);
    for (const sources of buckets.values()) {
      if (sources.length < 3) continue;
      try {
        const geometries = sources.map((source) =>
          source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone(),
        );
        const vertices = geometries.reduce(
          (sum, geometry) => sum + (geometry.attributes?.position?.count ?? 0),
          0,
        );
        const indices = geometries.reduce(
          (sum, geometry) => sum + (geometry.index ? geometry.index.count : 0),
          0,
        );
        if (vertices === 0) {
          geometries.forEach((g) => g.dispose());
          continue;
        }

        const batch = new THREE.BatchedMesh(
          sources.length,
          Math.max(vertices, 64),
          Math.max(indices, 0),
          sources[0].material as THREE.Material,
        );
        batch.name = 'Multi-draw static scenery';
        batch.sortObjects = false;
        batch.castShadow = sources[0].castShadow;
        batch.receiveShadow = sources[0].receiveShadow;
        batch.userData.noCollide = true;
        const matrix = new THREE.Matrix4();

        sources.forEach((source, index) => {
          const geometryId = batch.addGeometry(geometries[index]);
          const id = batch.addInstance(geometryId);
          batch.setMatrixAt(id, matrix.multiplyMatrices(inverse, source.matrixWorld));
          // The source stays available to raycasts and occlusion bounds, while
          // camera layer zero renders only its corresponding multi-draw instance.
          const ancestry: THREE.Object3D[] = [];
          for (let parent: THREE.Object3D | null = source; parent; parent = parent.parent) ancestry.push(parent);
          this.links.push({
            source,
            batch,
            id,
            visible: true,
            layerMask: source.layers.mask,
            parent: source.parent,
            ancestry,
          });
          source.layers.disable(0);
          source.layers.enable(31);
          // Raycasts use the retained world matrix. Rendering should traverse only
          // the batches, not another 1,350 masked source meshes every frame.
          source.removeFromParent();
          geometries[index].dispose();
        });
        batch.computeBoundingSphere();
        root.add(batch);
        this.batches.push(batch);
      } catch (err) {
        // Fall back gracefully to standard individual mesh rendering on unsupported devices/buffers
        console.warn('StaticSceneBatches fallback on bucket:', err);
      }
    }
    this.sourceCount = this.links.length;
    this.batchCount = this.batches.length;
    this.updateVisibility();
  }

  updateVisibility() {
    for (const link of this.links) {
      let visible = true;
      for (const ancestor of link.ancestry) {
        if (!ancestor.visible) { visible = false; break; }
      }
      if (visible !== link.visible) {
        link.batch.setVisibleAt(link.id, visible);
        link.visible = visible;
      }
    }
  }

  dispose() {
    for (const link of this.links) {
      link.source.layers.mask = link.layerMask;
      link.parent?.add(link.source);
    }
    for (const batch of this.batches) { batch.removeFromParent(); batch.dispose(); }
    this.links.length = 0;
    this.batches.length = 0;
  }
}
