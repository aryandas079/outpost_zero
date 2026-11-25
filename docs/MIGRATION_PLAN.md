# OUTPOST ZERO — Phased Migration Plan (Web -> Native C++20 / DirectX 12)

**Strategy**: Incremental, compile-verified strangler migration. Keep the existing Web/WinUI3 application intact under `src/` and `windows/` until **OutpostZero.exe** reaches parity, while building the cleanly decoupled **ZERO Engine** (`ZeroEngine.lib`), **OUTPOST ZERO** (`OutpostZero.exe`), and later **ZERO Editor** (`ZeroEditor.exe`) under `Engine/`, `Game/`, `Shaders/`, `Tools/`, and `Tests/`.

---

## Phase Breakdown & Acceptance Gates

| Phase | Deliverables | Exit Criterion | Status |
|---|---|---|---|
| **0. Repository Audit** | Recursive inspection, tool verification (`MSVC`, `CMake 4.3.1`, `Ninja 1.13.2`, `dxc 1.9`, `SDK 10.0.26100.0`), subsystem classification, baseline docs | All Phase 0 docs committed accurately | **IN_PROGRESS** -> finalizing |
| **1. Native Bootstrap** | Root CMake + Ninja + MSVC x64 build (`CMakeLists.txt`, `CMakePresets.json`, `scripts/*`), `ZeroEngine.lib` core (`Logger`, `Clock`, `Config`, `EventBus`, `Win32Window`, `RawInput`, `D3D12Context` w/ 3-frame ring, DXGI 1.6 swap chain, WARP fallback, HLSL/DXC shader compiler & embedded/CSO shaders), `OutpostZero.exe`, C++ unit tests | Native EXE compiles w/ zero warnings/errors, passes C++ tests, renders live DX12 frame (`SwapChain` + depth + sky + grid), survives resize, Alt+Tab/focus loss, minimization, clean shutdown | **NEXT** |
| **2. Basic Engine** | 3D camera controller, indexed mesh buffers, procedural/WIC textures, EnTT ECS integration (`Transform`, `Mesh`, `Material`, `Camera`, `Light`), D3D12MA allocator, scene graph, JSON serialization | Navigable 3D test scene rendered smoothly by `ZeroEngine.lib` | NOT_STARTED |
| **3. Playable FPS Vertical Slice** | Jolt Physics character controller, continuous capsule collision, first-person weapon viewmodel + recoil + projectile raycast, XAudio2 spatial gunfire, basic native GPU 2D HUD | Playable small-scale native FPS prototype at >= 60 FPS on RTX 3050 | NOT_STARTED |
| **4. Rendering Improvements** | PBR metallic-roughness HLSL pipeline, CSM directional shadows, analytical sky dome + volumetric clouds, depth-blended ocean & river water shaders, ACES tone mapping | Visually coherent sunlit coastline & military outpost matching design references | NOT_STARTED |
| **5. Large-World Architecture** | Port deterministic `10.24 km²` island generator (`12–16 POIs`, roads, bridges, dam, river), spatial chunk streaming + LOD skirt stitching, GPU-instanced vegetation, Jolt heightfield streaming | Smooth aircraft-to-ground traversal across 10.24 km² without seams or falling through terrain | NOT_STARTED |
| **6. Battle Royale Gameplay** | Match FSM (`Waiting -> Boarding -> Flight -> Jump -> Freefall -> Parachute -> Ground -> Results`), 24-participant simulation, Recast/Detour AI bots, inventory/loot, contracting safe-zone storm, spectator mode | Complete 24-participant match starts, finishes, and restarts with zero memory growth | NOT_STARTED |
| **7. Production UI/UX** | Custom GPU-batched 2D UI + DirectWrite text, tactical `#10161D` HUD (top-left/center/right + bottom-left/right), minimap & interactive tactical map synced via shared `MapTransform`, inventory, settings, accessibility | Overlap-free UI verified at `720p`, `1080p`, `1440p`, high DPI | NOT_STARTED |
| **8. ZERO Editor** | Dear ImGui docked workspace (`ZeroEditor.exe`), hierarchy, gizmos, undo/redo, terrain & road editing, POI placement, play-in-editor, versioned map save/load | Map authored in `ZeroEditor.exe` loads directly into `OutpostZero.exe` | NOT_STARTED |
| **9. Optimization** | Worker job pool, PIX/Tracy markers, descriptor table batching, VRAM budget telemetry, preset tuning (`Low`/`Medium`/`High`/`Ultra`) targeting `60 FPS` Medium & `100–120 FPS` Low on i5-12450HX + RTX 3050 | Profiled captures verify target frame budgets (`<= 16.67 ms`) & leak-free consecutive matches | NOT_STARTED |
| **10. Production Release** | Versioned MSIX / WiX / Inno native installer, app manifest + icon, bundled `Assets/`, `Shaders/`, `Config/`, `Licenses/`, crash dumps (`MiniDumpWriteDump`) | Clean install & launch on Windows 11 x64 without dev tools | NOT_STARTED |
