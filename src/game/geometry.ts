import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small, actual edge radii catch light without changing an object's overall size. */
export function craftedBox(width = 1, height = 1, depth = 1, smallPart = false): THREE.BufferGeometry {
  const shortest = Math.min(width, height, depth);
  // Paper-thin strips and very large structural slabs need no extra tessellation.
  if (shortest < (smallPart ? 0.003 : 0.06) || Math.max(width, height, depth) > 18) {
    return new THREE.BoxGeometry(width, height, depth);
  }
  // Six faces, twelve beveled edges and eight clipped corners: 44 triangles,
  // versus 108 for a subdivided rounded box. Thin siding stays at 12 triangles.
  const radius = Math.min(smallPart ? 0.002 : 0.035, shortest * 0.12);
  const half = [width / 2, height / 2, depth / 2];
  const inner = half.map(value => value - radius);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const axisNormal = (axis: number, sign: number) => new THREE.Vector3().setComponent(axis, sign);
  const vertex = (axis: number, signs: number[]) => new THREE.Vector3(
    signs[0] * (axis === 0 ? half[0] : inner[0]),
    signs[1] * (axis === 1 ? half[1] : inner[1]),
    signs[2] * (axis === 2 ? half[2] : inner[2]),
  );
  const emit = (points: THREE.Vector3[], directions: THREE.Vector3[], outward: THREE.Vector3) => {
    const face = new THREE.Vector3().subVectors(points[1], points[0])
      .cross(new THREE.Vector3().subVectors(points[2], points[0]));
    const order = face.dot(outward) >= 0 ? [0, 1, 2] : [0, 2, 1];
    const dominant = Math.abs(outward.x) >= Math.abs(outward.y) && Math.abs(outward.x) >= Math.abs(outward.z)
      ? 0 : Math.abs(outward.y) >= Math.abs(outward.z) ? 1 : 2;
    for (const index of order) {
      const p = points[index];
      positions.push(p.x, p.y, p.z);
      normals.push(directions[index].x, directions[index].y, directions[index].z);
      if (dominant === 0) uvs.push(0.5 - Math.sign(outward.x) * p.z / depth, 0.5 + p.y / height);
      else if (dominant === 1) uvs.push(0.5 + p.x / width, 0.5 - Math.sign(outward.y) * p.z / depth);
      else uvs.push(0.5 + Math.sign(outward.z) * p.x / width, 0.5 + p.y / height);
    }
  };
  for (let axis = 0; axis < 3; axis++) {
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    for (const side of [-1, 1]) {
      const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sb, sc]) => {
        const signs = [0, 0, 0]; signs[axis] = side; signs[b] = sb; signs[c] = sc;
        return vertex(axis, signs);
      });
      const n = axisNormal(axis, side);
      emit([points[0], points[1], points[2]], [n, n, n], n);
      emit([points[0], points[2], points[3]], [n, n, n], n);
    }
  }
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    const c = 3 - a - b;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const signs = [0, 0, 0]; signs[a] = sa; signs[b] = sb; signs[c] = -1;
      const p0 = vertex(a, signs); const p1 = vertex(b, signs);
      signs[c] = 1;
      const p2 = vertex(b, signs); const p3 = vertex(a, signs);
      const na = axisNormal(a, sa); const nb = axisNormal(b, sb);
      const out = na.clone().add(nb);
      emit([p0, p1, p2], [na, nb, nb], out);
      emit([p0, p2, p3], [na, nb, na], out);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const signs = [sx, sy, sz];
    emit([vertex(0, signs), vertex(1, signs), vertex(2, signs)],
      [axisNormal(0, sx), axisNormal(1, sy), axisNormal(2, sz)], new THREE.Vector3(sx, sy, sz));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  Object.assign(geometry, { parameters: { width, height, depth, radius } });
  return geometry;
}

/** Merge only non-colliding opaque decoration, retaining each parent's culling boundary. */
export function batchDecoration(
  root: THREE.Object3D,
  protectedObjects: Set<THREE.Object3D>,
  animatedRoots: Set<THREE.Object3D>,
  ownedGeometries: THREE.BufferGeometry[],
  includeSolidMeshes = false,
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  const visit = (parent: THREE.Object3D) => {
    if (animatedRoots.has(parent)) return;
    for (const child of [...parent.children]) visit(child);
    const buckets = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || child.children.length ||
          !child.visible || protectedObjects.has(child) || (!includeSolidMeshes && !child.userData.noCollide) ||
          Array.isArray(child.material) || child.material.transparent || child.renderOrder !== 0) continue;
      const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:` +
        `${Math.floor(child.position.x / 12)}:${Math.floor(child.position.z / 12)}`;
      const list = buckets.get(key) ?? [];
      list.push(child);
      buckets.set(key, list);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 3) continue;
      const parts = meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geometry.clearGroups();
        return geometry.applyMatrix4(mesh.matrix);
      });
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      ownedGeometries.push(geometry);
      geometry.computeBoundingSphere();
      const combined = new THREE.Mesh(geometry, meshes[0].material);
      combined.name = 'Batched architectural detail';
      combined.castShadow = meshes[0].castShadow;
      combined.receiveShadow = meshes[0].receiveShadow;
      combined.userData.noCollide = true;
      parent.add(combined);
      meshes.forEach(mesh => parent.remove(mesh));
      before += meshes.length;
      after++;
    }
  };
  visit(root);
  return { before, after };
}

/** Call after physics extraction. Detached ray targets retain their world matrices. */
export function optimizeStaticArena(
  root: THREE.Object3D,
  cullingRoots: THREE.Object3D[] = [],
  animatedRoots: Set<THREE.Object3D> = new Set(),
  ownedGeometries: THREE.BufferGeometry[] = [],
) {
  root.updateMatrixWorld(true);
  const boundaries = new Set(cullingRoots);
  const result = { before: 0, after: 0 };
  // Furniture and window subgroups can share a batch, but independently culled
  // interiors/buildings and animated subtrees must remain separate islands.
  const processIsland = (island: THREE.Object3D) => {
    const inverse = island.matrixWorld.clone().invert();
    const buckets = new Map<string, THREE.Mesh[]>();
    const collect = (object: THREE.Object3D) => {
      if (animatedRoots.has(object)) return;
      if (object !== island && boundaries.has(object)) {
        if (!(object instanceof THREE.Mesh)) processIsland(object);
        return;
      }
      for (const child of object.children) collect(child);
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh ||
          object.children.length || !object.visible || object === island ||
          Array.isArray(object.material) || object.material.transparent || object.renderOrder !== 0 ||
          object.matrixWorld.determinant() < 0) return;
      const point = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld).applyMatrix4(inverse);
      const attributes = Object.keys(object.geometry.attributes).sort().join(',');
      const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}:${attributes}:` +
        `${Math.floor(point.x / 12)}:${Math.floor(point.z / 12)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(object);
      buckets.set(key, bucket);
    };
    collect(island);
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => {
        const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        part.clearGroups();
        return part.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      });
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      ownedGeometries.push(geometry);
      geometry.computeBoundingSphere();
      const batch = new THREE.Mesh(geometry, meshes[0].material);
      batch.name = 'Static scenery batch';
      batch.castShadow = meshes[0].castShadow;
      batch.receiveShadow = meshes[0].receiveShadow;
      batch.userData.noCollide = true;
      island.add(batch);
      meshes.forEach(mesh => mesh.removeFromParent());
      result.before += meshes.length;
      result.after++;
    }
  };
  processIsland(root);
  root.updateMatrixWorld(true);
  const freeze = (object: THREE.Object3D) => {
    if (animatedRoots.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
    for (const child of object.children) freeze(child);
  };
  freeze(root);
  return result;
}
