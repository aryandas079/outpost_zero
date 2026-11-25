# OUTPOST ZERO — Known Issues & Defect Resolution Tracker

## Resolved Audit Defects

| ID | Category | Severity | Root Cause | Resolution |
|---|---|---|---|---|
| **TS-01** | Build/Types | Critical | Missing `BattleRoyaleHudState` fields & test `optimizeRendering` type mismatch | **Resolved** (`src/game/types.ts`, `src/core/Engine.ts`, `tests/battleRoyale.test.ts` — `tsc --noEmit` exits 0) |
| **REN-01** | Rendering/Sky | Critical | Low-res `CachedSky` cubemap blur & `CylinderGeometry(1,1,340)` storm top rim slicing sky | **Resolved** (`SkySystem` camera-anchored shader dome in `src/rendering/Sky.ts` + 1,400m vertical-fading `buildStormWallMesh` in `src/world/MapGenerator.ts`) |
| **REN-02** | Rendering/Horizon | High | `9200x9200` quad ocean cutoff within camera far plane | **Resolved** (`6,200m` circular `OceanShader` disc with exponential fog + far horizon fade in `src/world/Water.ts`) |
| **REN-03** | Rendering/Water | High | Planar ocean glare + river buried under Hydro Dam pad | **Resolved** (Schlick Fresnel ocean shader with shoreline `aBedDepth` foam + canyon reservoir basin `39.2m` & continuous river channel in `src/world/Terrain.ts`, `Water.ts`) |
| **REN-04** | Rendering/Terrain | High | Single `220x220` terrain mesh with repeating UV grid & vertex-painted jagged roads | **Resolved** (`IslandTerrainStreamer` 64 streamed LOD chunks with 5m skirts & dual-scale rotated UV sampling + 3D curved roads/bridges in `src/world/WorldStreaming.ts`, `Roads.ts`) |
| **REN-05** | Models/Aircraft | Medium | Blocky black C-130 aircraft without prop discs or tactical markings | **Resolved** (`buildTransportAirplane` matte gray C-130J with tapered swept wings, 4 spinning props, cockpit canopy & cargo ramp light in `src/entities/Aircraft.ts`) |
| **REN-06** | Lighting | Medium | Harsh near-black shadows & mismatched viewmodel light levels | **Resolved** (`LightingRig` calibrated hemisphere bounce, texel-snapped directional shadows, synchronized viewmodel lights, and Low/Medium/High/Ultra/Time-of-Day presets) |
| **MAP-01** | World/POIs | High | Copy-pasted boxes across 12 POIs without bridges, markings, or loot | **Resolved** (16 differentiated POIs + 24 connected roads/bridges/utility poles/loot anchors in `src/world/Buildings.ts`, `Roads.ts`, `Vegetation.ts`) |
| **HUD-01** | UI/HUD | Critical | Wide banner clipping behind corner clusters at `1280×720` | **Resolved** (Non-clipping `top-[72px]` constrained banner + `#10161D` wireframe HUD in `src/components/TacticalHudPanels.tsx`) |
| **HUD-02** | UI/Minimap | High | Static bezel labels + center POI label overlap + clipped nested `<button>` | **Resolved** (`RadarMinimap.tsx` shared `MapTransform`, rotatable/North-Up toggle, true coastline/river/roads, standalone `[M] MAP` button) |
| **HUD-03** | UI/TacticalMap | High | Fake circular landmass, label collisions, unspotted bot spoilers, no zoom/pan/pins | **Resolved** (`TacticalMapModal.tsx` with wheel/button zoom, drag pan, recenter, click waypoints, true coastline/roads/river, zero unspotted island bots) |
| **HUD-04** | UI/Deployment | Medium | Crosshair & weapon ammo UI cluttering C-130 airdrop & freefall states | **Resolved** (Strict stage gating in `GameHud.tsx` & `TacticalHudPanels.tsx` hiding crosshair, weapon strip & ammo counter in flight) |
| **HUD-05** | UI/Modals | High | `OPERATION NOMAD` / `Wave 1` leakage on Island modals + unstyled scrollbars | **Resolved** (`ModalOverlay.tsx` BR placement/damage/survival metrics, quit confirmation, Spectate button, slim dark scrollbars in `src/index.css`) |
| **SYS-01** | Architecture | Critical | Monolithic 5,558-line engine, 80ms software loop throttle, missing loot/inventory/lifecycle | **Resolved** (Modular subsystems in `src/core/`, `rendering/`, `world/`, `entities/`, `gameplay/`, `input/`, `assets/`, `utilities/`, `settings/`) |
| **WIN-01** | Desktop App | High | Legacy Electron wrapper instead of native C++ & WinUI 3 host | **Resolved** (`windows/OutpostZero.Native/` C++20 DXGI/Win32 DLL + `windows/OutpostZero.WinUI/` C# `.NET 10` WinUI 3 app) |

## Non-Blocking Notes & Residual Items

1. **Bundle Chunk Size Warning**: Vite builds `dist/assets/index-*.js` (`1,498.74 kB` minified / `409.18 kB` gzipped) in a single client chunk (Three.js + React), triggering Vite's default 500 kB chunk warning; runtime startup and WebGL compilation remain unaffected.
2. **NuGet Transitive BuildTools Warning (`NU1603`)**: Offline cached restore resolves `Microsoft.Windows.SDK.BuildTools` `10.0.26100.7705` instead of `10.0.26100.4654` for `Microsoft.WindowsAppSDK.Base 2.0.4` with zero build errors.
3. **Legacy Electron Folder Retention**: Legacy `electron/` scripts and devDependencies remain untouched in `package.json` for fallback compatibility alongside primary `windows:build` / `windows:run` C++/WinUI 3 targets.

---

## Native C++20 / DirectX 12 Migration Tracking (ZERO Engine Phase 0 Baseline)

| ID | Area | Current Gap / Risk | Planned Resolution Phase |
|---|---|---|---|
| **MIG-01** | Runtime Independence | Current desktop binary (`windows/OutpostZero.WinUI`) embeds WebView2 + Chromium/V8 JS engine | Phase 1–7 (`OutpostZero.exe` pure native C++20/DX12) |
| **MIG-02** | Physics & Collision | Legacy custom JS spatial hash lacks full dynamic rigid-body contacts and Jolt continuous sweep shapes | Phase 3 (Jolt Physics integration) |
| **MIG-03** | Asset Pipeline | Geometries & textures live as inline TypeScript builders rather than compiled `.glb` / BC7 `.dds` packages | Phase 2–4 (`Tools/AssetCompiler`, `fastgltf`, `DirectXTex`) |
| **MIG-04** | UI Composition | Game HUD currently relies on React 19 DOM + Tailwind rather than GPU-batched native 2D quads + DirectWrite/MSDF | Phase 7 (`Engine/UI`) |
| **MIG-05** | Toolchain Discovery | `cmake.exe`, `ninja.exe`, `vcpkg.exe`, and `dxc.exe` are installed under `D:\Visual Studio` and `D:\Windows Kits` rather than system `PATH` | Phase 1 (`scripts/setup.ps1` & `configure.ps1` auto-detect via `vswhere` & SDK registry/standard paths) |
