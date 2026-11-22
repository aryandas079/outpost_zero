import * as THREE from 'three';

/** Evaluate the cloud shader on a small cubemap rather than every screen pixel. */
export class CachedSky {
  private readonly scene = new THREE.Scene();
  private readonly target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  private readonly camera = new THREE.CubeCamera(1, 340, this.target);
  private elapsed = 1;

  constructor(private readonly dome: THREE.Mesh, scene: THREE.Scene) {
    this.scene.add(dome);
    scene.background = this.target.texture;
  }

  update(renderer: THREE.WebGLRenderer, dt: number) {
    this.elapsed += dt;
    if (this.elapsed < 0.5) return;
    this.elapsed = 0;
    // Capturing the sky must not consume the town's pending shadow update.
    const shadowUpdate = renderer.shadowMap.needsUpdate;
    this.camera.update(renderer, this.scene);
    renderer.shadowMap.needsUpdate = shadowUpdate;
  }

  dispose() {
    this.dome.removeFromParent();
    this.target.dispose();
  }
}
