# OUTPOST ZERO — Performance Baseline (Phase 0)

## 1. Benchmark Hardware & Environment

- **OS**: Windows 11 (Build `10.0.26340`)
- **Primary Hardware Target**: Intel Core i5-12450HX, NVIDIA RTX 3050 Laptop GPU (6 GB VRAM), 16 GB DDR5 RAM, 1920 × 1080
- **Node / Tooling**: Node `v26.13.0`, npm `11.20.0`, Vite `8.3.8`, TypeScript `7.0.2`, .NET SDK `10.0.403`, MSVC `14.51.36231`, Windows SDK `10.0.26100.0`, Windows App SDK `2.5.1`

---

## 2. Baseline Build, Lint & Test Measurements

- **`npm.cmd test`**: 48 tests passed, 0 failed (`duration_ms: 6391.11` in initial run).
- **`npm.cmd run lint` (`tsc --noEmit`)**: **FAILED** (4 TypeScript errors in `GameHud.tsx`, `TacticalHudPanels.tsx`, `TacticalMapModal.tsx`, `tests/battleRoyale.test.ts`).
- **Town Arena Geometry Batching (from test output)**:
  - Raw meshes: `3,974` -> `1,555` scene meshes (`461` colliders)
  - Decoration draws: `5,627` -> `312`
  - Static draws: `3,074` -> `655`
  - Multi-draw submission groups: `1,347` -> `52`
  - Weapon rigid draws: `86` -> `13`

---

## 3. Baseline Browser Runtime Audit (`http://localhost:3001/` at 1280×720)

- **Console Errors**: 0 fatal JS/WebGL page errors reported.
- **Failed Network Requests**: 0.
- **Observed Bottlenecks**:
  - Island terrain (`220x220` single mesh) has zero spatial chunking or LOD, causing full-island geometry submission every frame.
  - Under software/headless WebGL, `afterDraw` polls with `80 ms` timeout (~10–14× slower than real time), and `updateSimulation` lacks fixed-timestep physics accumulator clamping for smooth interpolation.
  - Multiple `new THREE.Vector3` allocations per frame in `engine.ts` (`launchOrdnance`, `segmentNearSphere`, `areaDamage`, `updateOrdnance`, `spawnAiParatrooperFromPlane`).
  - No developer performance overlay (`FPS`, frame time, CPU/GPU ms, draw calls, active chunks, triangles, memory) surfaced in-game.

---

## 4. Native Migration Baseline Summary (Pre-ZERO Engine Reference)

- **Post-Refactor Web / Browser Telemetry (`src/` current state)**:
  - Automated Test Suite: `66/66` passing (`5,138.07 ms`)
  - Production Client Bundle: `1,510.28 kB` (`412.43 kB` gzipped) main JS chunk; `1,784` modules built in `1.88 s`
  - Island 10.24 km² Runtime Telemetry (1920×1080 WebGL2 on RTX 3050 6GB): ~`137 FPS` (`7.3 ms` frame, `1,057` draws, `1,820.6k` tris, `64/64` chunks, `56 MB` JS heap) recorded in `docs/PERFORMANCE_REPORT.md` prior to native migration
  - Native Windows Hardware Query (`OutpostZero.Native.Tests.exe`): `NVIDIA GeForce RTX 3050 6GB Laptop GPU`, `6001 MB` VRAM, `144 Hz` primary display refresh
- **Target Native ZERO Engine Benchmarks (Phase 1+ Baseline to beat)**:
  - Eliminate JS/GC jitter and WebView2 IPC roundtrip completely
  - Achieve `< 16.67 ms` GPU frame time (`>= 60 FPS` Medium, `100–120 FPS` Low) at `1920×1080` native DX12 on i5-12450HX + RTX 3050 6GB (`< 4.5 GB` VRAM, `< 6 GB` RAM)
