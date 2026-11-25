# OUTPOST ZERO — Codebase & Architecture Audit (Phase 0)

## 1. Executive Summary

This document presents the verified baseline audit of **OUTPOST ZERO** prior to the comprehensive Battle Royale architectural refactoring and WinUI 3 desktop conversion. Note that a partial earlier pass (`1.1.0`) left unfinished regressions in `tsc --noEmit`, retained a monolithic 5,558-line `src/game/engine.ts`, and left multiple rendering, world-generation, UI, and gameplay-lifecycle gaps identified in live browser inspection.

---

## 2. Technology Stack & Entry Points

| Subsystem | Technology | Verified Version / Location | Notes |
|---|---|---|---|
| **3D Engine** | Three.js (WebGL2) | `^0.187.0` (`src/game/engine.ts`) | Custom monolithic engine with dedicated depth-cleared viewmodel pass (`weaponScene`) and `PMREMGenerator` IBL |
| **UI Framework** | React + TypeScript | `^19.0.1`, TS `^7.0.2` (`src/main.tsx`, `src/App.tsx`) | Functional components in `src/components/` |
| **Styling** | Tailwind CSS + Vite | `^4.3.3`, `@tailwindcss/vite` `^4.3.3`, Vite `^8.3.0` | `src/index.css` |
| **Physics & Collision** | Custom 2D Spatial Hash + Capsule | `src/game/physics.ts` | Continuous sub-stepped capsule vs AABB, ramp surfaces, camera sphere pushout |
| **Audio** | Web Audio API + Three.js PositionalAudio | `src/game/audio.ts`, `src/game/audioCompression.ts` | Procedural synth, DRC presets (`wide`, `balanced`, `boost`) |
| **Networking** | PeerJS / WebRTC DataChannels | `peerjs ^1.5.5`, `src/game/multiplayer/` | P2P room mesh up to 4 players for Co-op & Deathmatch |
| **Desktop Runtime (Legacy)** | Electron | `electron ^45.4.1`, `electron-builder ^26.18.0` | `electron/main.cjs`, `electron/preload.cjs` — to be superseded by native C++ / C# / WinUI 3 app |
| **Test Runner** | Node built-in `node:test` + `tsx` | `tsx ^4.21.0`, `tests/*.test.ts` | 48 baseline tests |

---

## 3. Dependency & Dead-Code Findings

- **Build & Typecheck Health**:
  - `npm.cmd test`: 48/48 tests pass (~6.39 s), **but** `npm.cmd run lint` (`tsc --noEmit`) **fails** with 4 compilation errors:
    1. `src/components/GameHud.tsx(386,79)`: `Property 'canJumpFromPlane' does not exist on type 'BattleRoyaleHudState'`.
    2. `src/components/TacticalHudPanels.tsx(74,10)`: `Property 'stormShrinking' does not exist on type 'BattleRoyaleHudState'`.
    3. `src/components/TacticalMapModal.tsx(92,43)`: `Property 'stormShrinking' does not exist on type 'BattleRoyaleHudState'`.
    4. `tests/battleRoyale.test.ts(101,5)`: `optimizeRendering: () => void` incompatible with `{ before: number; after: number }`.
- **Monolithic Files**:
  - `src/game/engine.ts` (5,558 lines, 211 KB): tightly couples rendering loop, sky/weather, input/pointer lock, player physics, Battle Royale state, storm, AI bots, weapons, ordnance, VFX pools, and HUD serialization.
  - `src/game/battleRoyaleIsland.ts` (1,806 lines, 61 KB): mixes heightfield math, POI definitions, identical compound buildings, static ocean, river ribbon, and foliage placement without spatial chunking/streaming or LOD.
  - `src/game/arena.ts` (3,624 lines, 137 KB): Frontier Town (`west`) arena builder.
  - `src/game/textures.ts` (2,397 lines, 87 KB) and `src/game/weapon.ts` (1,699 lines, 72 KB).
  - `src/components/TitleOverlay.tsx` (2,056 lines, 100 KB): single large menu component.
- **Configuration & State Coupling**:
  - HUD state (`HudSnapshot`) mixes Survival Wave concepts (`wave`, `maxWaves`, `endless`) with Battle Royale concepts without a clean match-state machine (`loading` -> `lobby` -> `airdrop` -> `freefall` -> `parachute` -> `grounded` -> `eliminated`/`spectating` -> `victory`/`results`).
  - Camera `far` clipping (`4600`), ocean plane extent (`9200x9200`), sky dome cubemap (`512x512`), and storm wall cylinder (`height = 340`) are hardcoded inside `engine.ts` and `battleRoyaleIsland.ts`.

---

## 4. Visual, World & Gameplay Defects Identified in Baseline Audit

1. **Sky & Storm Wall Seams**:
   - Looking upward during grounded combat reveals a sharp diagonal cyan edge from the top rim of `buildStormWallMesh` (`CylinderGeometry(1, 1, 340)` at `y = 140`) slicing across the sky, plus soft/blurry cloud texels from the 512×512 cubemap.
   - Looking toward the ocean horizon from altitude reveals the polygonal edge of the `9200×9200` ocean plane against `camera.far = 4600` and sky horizon haze mismatch.
2. **Water & River Geometry**:
   - Ocean is a 1×1 flat plane (`MeshStandardMaterial`) with excessive specular glare and a sharp dark shoreline ring (`foamGeo` at `y = -0.22`) that does not blend softly with terrain depth.
   - `sampleIslandHeight` sets `HYDRO DAM & RESERVOIR` (`(60, -40)`) pad to `baseElevation: 48.0` *after* river carving (`z in [-90, 740]`), burying the northern river head (`rz = -60`, `y = 1.15`) inside a 47 m hill with no reservoir lake water surface on top.
3. **Terrain, Roads, POIs & Vegetation**:
   - Single non-chunked `220×220` terrain mesh (14.5 m vertex spacing) causes blocky slopes, visible texture grid tiling, and jagged vertex-colored roads with no bridges, markings, sidewalks, or roadside props.
   - All 12 POIs copy-paste the same two `buildTacticalCompoundBuilding` boxes plus one simple landmark primitive; no loot/inventory/armor plates/ground pickups at POIs, no world streaming chunks or LODs.
   - One compound structure near North Quarry Depot rendered near-black in shadow due to lighting/material balance.
4. **Aircraft & Deployment**:
   - `buildTransportAirplane` uses dark charcoal `0x4b5358` + `0x22272c` boxes with flat rectangular wing slabs and an almost pure-black open cargo hold.
   - `canJumpFromPlane` check in `GameHud.tsx` references a non-existent property (preventing the jump button from appearing cleanly in TypeScript!).
5. **HUD, Minimap & Tactical Map**:
   - Top-center wave banner (`whitespace-nowrap`) clips underneath the top-left match card and top-right utilities/minimap at `1280×720`.
   - Circular minimap rotates world geometry with `playerYaw` while keeping `N/E/S/W` labels fixed; all 12 POI labels pile over each other; `M MAP` button is nested inside a clickable container and clipped by circular `overflow-hidden`.
   - Tactical Map (`M`) draws a circular green landmass instead of the true coastline shape, overlaps `MOUNTAIN RADAR` / `CLIFFSIDE COASTAL VILLAGE` and `MT. VERDANT PEAK (+52M)` / `HYDRO DAM & RESERVOIR` and `AGRI FARM DISTRICT` / flight line, clips outer storm ring, reveals every AI bot across the entire island, and lacks zoom/pan/recenter/waypoints.
   - Freefall/Parachute HUD duplicates altitude/airspeed on both the right altimeter and bottom bar, and wraps badges awkwardly.
   - Pause & Game Over modals display `OPERATION NOMAD`, `RESTART CHECKPOINT`, and `0% · Wave 1` while playing Battle Royale.
6. **Desktop Packaging**:
   - Uses Electron rather than a native C++ / C# / WinUI 3 Windows standalone application.
