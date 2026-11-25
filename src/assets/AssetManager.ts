/**
 * Centralized asset manager & resource lifecycle registry.
 * Tracks geometries, materials, textures, and procedural caches for clean disposal.
 */

import * as THREE from 'three';
import { createProceduralTextures, ProceduralTextures } from '../game/textures';

export class AssetManager {
  public readonly textures: ProceduralTextures;
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];

  constructor(maxAnisotropy = 4) {
    this.textures = createProceduralTextures(maxAnisotropy);
  }

  trackGeometry<T extends THREE.BufferGeometry>(geo: T): T {
    this.ownedGeometries.push(geo);
    return geo;
  }

  trackMaterial<T extends THREE.Material>(mat: T): T {
    this.ownedMaterials.push(mat);
    return mat;
  }

  trackTexture<T extends THREE.Texture>(tex: T): T {
    this.ownedTextures.push(tex);
    return tex;
  }

  setTextureAnisotropy(anisotropy: number): void {
    for (const value of Object.values(this.textures)) {
      if (value instanceof THREE.Texture && value.anisotropy !== anisotropy) {
        value.anisotropy = anisotropy;
        value.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.ownedTextures) t.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.ownedTextures.length = 0;
    this.textures.dispose();
  }
}
