# OUTPOST ZERO — Final Performance Report

## 1. Optimization & Streaming Improvements

1. **Spatial Chunk Streaming & Multi-LOD Island Terrain (`src/world/WorldStreaming.ts`)**:
   - Replaced the single fixed `220×220` island mesh with **64 `400m × 400m` spatial chunks** across 3 LOD resolutions (`40×40` high near player, `20×20` medium, `10×10` coarse silhouette), downward skirts to eliminate LOD cracks, bounded per-frame chunk builds (`maxBuildsPerFrame = 3`), predictive velocity lookahead during C-130 flight/skydiving, and automatic LRU geometry disposal (`> 900` idle frames).
2. **Fixed-Timestep Simulation Loop (`src/core/GameLoop.ts`)**:
   - Eliminated the `80ms` software-renderer `afterDraw` poll delay (down to `16ms` yield when falling back to software WebGL) and stabilized physics updates with a clamped fixed-step accumulator (`1/60s`).
3. **Instancing & Batching (`tests/rendering.test.ts` & `src/world/Vegetation.ts`)**:
   - WEST arena batching preserved (`3,974` raw meshes -> `1,555` scene meshes; decoration draws `5,627` -> `312`; multi-draw `1,347` -> `52`; weapon rigid `86` -> `13`).
   - Island vegetation (`trees`, `shrubs`, `logs`, `grass`, `boulders`, `utility poles`) uses batched `THREE.InstancedMesh` draws with biome, slope, road, river, and POI exclusion zones.
4. **Directional Shadow Focus (`src/rendering/Lighting.ts`)**:
   - Implemented texel-snapped moving directional shadow frustum tracking (`88m` radius) across the 10.24 km² island, triggering shadow re-renders only when the snapped world grid shifts (`> 8m`).

## 2. Measured Runtime & Build Metrics

- **Production Vite Bundle (`npm run build`)**:
  - Modules transformed: `1,784` in `1.88 s`
  - `dist/index.html`: `1.77 kB` (`0.71 kB` gzip)
  - `dist/assets/index-CRuDnwUs.css`: `87.26 kB` (`15.99 kB` gzip)
  - `dist/assets/bundler-DGha_DYU.js`: `114.62 kB` (`30.58 kB` gzip)
  - `dist/assets/index-BifbQEZS.js`: `1,510.28 kB` (`412.43 kB` gzip)
- **Automated Test Execution Time (`npm test`)**:
  - `5,138.07 ms` for 66 tests (including synchronous LOD 0 dam terrain verification & 3D skydiver rig unit checks).
- **Live `1920×1080` WebGL2 Telemetry (`TELEMETRY · F8` on NVIDIA GeForce RTX 3050 6GB Laptop GPU)**:
  - Grounded 10.24 km² Island (`v2` active session): `137 FPS`, `7.3 ms` frame (`10.7 ms` worst), `6.2 ms` CPU, `3.1 ms` GPU, `1,057` draws, `1,820.6k` tris, `64/64` chunks, `56 MB` heap.
  - Note on automated screenshot-step variance: during heavy headless software screenshot capture steps (`v4`), frame rate throttles transiently down to `12 FPS` (`83.3 ms`) while GPU readback/capture completes, whereas interactive WebGL frames run smoothly (`137 FPS` in Island `v2`, `144 FPS` baseline / `75 FPS` active `v1` in WEST).
  - Active Memory / GPU Resources (Island): `108` textures, `362`–`373` geometries, `55`–`66 MB` JS heap.
- **Native Hardware Query (`OutpostZero.Native.Tests.exe`)**:
  - Hardware GPU: `NVIDIA GeForce RTX 3050 6GB Laptop GPU`
  - Dedicated VRAM: `6,001 MB`
  - Display Refresh Rate: `144 Hz`
