# OUTPOST ZERO — Implementation Status

## 1. Legacy Web / WinUI 3 Baseline Track (Feature-Frozen Reference)

The existing TypeScript / Three.js / React / WinUI 3 implementation remains intact as the functional behavioral reference until **ZERO Engine** achieves full parity (`66/66` TypeScript unit tests passing).

## 2. Native C++20 / DirectX 12 Migration Status (**ZERO Engine** / **OutpostZero.exe** / **ZeroEditor.exe**)

Status legend: `NOT_STARTED` | `IN_PROGRESS` | `IMPLEMENTED` | `BUILD_VERIFIED` | `RUNTIME_VERIFIED` | `BLOCKED`

| Task ID | Phase | Objective | Key Deliverables | Status | Next Action |
|---|---|---|---|---|---|
| **OZ-NAT-000** | Phase 0 | Recursive repository audit, toolchain probe, classification & baseline docs | `EXISTING_CODEBASE_AUDIT.md`, `MIGRATION_PLAN.md`, `FEATURE_INVENTORY.md`, `ASSET_INVENTORY.md`, `DECISIONS.md` | **RUNTIME_VERIFIED** | Complete |
| **OZ-NAT-001** | Phase 1 | Build system, PowerShell scripts & pinned manifest | `CMakeLists.txt`, `CMakePresets.json`, `vcpkg.json`, `scripts/*.ps1`, `Config/engine_defaults.json`, `docs/BUILD_GUIDE.md` | **BUILD_VERIFIED** | Verified cleanly on `x64-release` & `x64-debug` |
| **OZ-NAT-002** | Phase 1 | `ZeroEngine.lib` Core, Platform (Win32 + Raw Input + XInput), Logger, Clock & CrashHandler | `Engine/Core/*`, `Engine/Platform/Windows/*`, `Engine/Input/*`, `Engine/Mathematics/*` | **RUNTIME_VERIFIED** | Complete & unit-tested |
| **OZ-NAT-003** | Phase 1 | `ZeroEngine.lib` DirectX 12 RHI, DXGI 1.6 Swap Chain, 3-Frame Ring & HLSL/DXC | `Engine/Renderer/D3D12/*`, `Shaders/Common/*`, `Shaders/Sky/*`, `Shaders/Mesh/*` | **RUNTIME_VERIFIED** | Hardware RTX 3050 + Debug Layer + WARP + Backbuffer Capture verified |
| **OZ-NAT-004** | Phase 1 | `OutpostZero.exe` Bootstrap & Native C++ Test Suite | `Game/Application/*`, `Tests/*`, `out/build/*/Game/OutpostZero.exe`, `out/package/OutpostZero/` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 2 (`OZ-NAT-005`) |
| **OZ-NAT-005** | Phase 2 | Basic 3D Engine (Sparse-Set ECS, Scene Hierarchy & JSON Serialization, WIC Texture Loader, glTF 2.0 `.glb` Loader, ResourceManager, DX12 SRV Descriptor Heap & Static Sampler) | `Engine/ECS/*`, `Engine/AssetPipeline/*`, `Engine/ResourceManager/*`, `Engine/Scene/Scene.*`, `Assets/Models/tactical_crate.glb` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 3 (`OZ-NAT-006`: Playable FPS Vertical Slice + Jolt Physics + XAudio2) |
| **OZ-NAT-006** | Phase 3 | Playable FPS Vertical Slice (`PhysicsWorld` capsule/raycast, XAudio2 `AudioEngine`, `Hud2D` GPU HUD & bitmap font, `PlayerController`, depth-cleared `M4A1` viewmodel, enterable bunker & target drones) | `Engine/Physics/*`, `Engine/Audio/*`, `Engine/UI/*`, `Shaders/UI/Hud2D.hlsl`, `Game/Player/*`, `Game/Weapons/*` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 4 (`OZ-NAT-007`: PBR materials, Cascaded Shadows, Water, Terrain & Vegetation) |
| **OZ-NAT-007** | Phase 4 | PBR Lighting (`PBR.hlsli`), `2048x2048` 3x3 PCF Directional Shadows (`ShadowDepth.hlsl`), Animated Coastal Water (`OceanWater.hlsl`), Procedural Coastal Terrain & GPU-Instanced Conifers/Boulders | `Shaders/Common/PBR.hlsli`, `Shaders/Shadows/ShadowDepth.hlsl`, `Shaders/Water/OceanWater.hlsl`, `Game/World/ProceduralWorld.*`, `Engine/Renderer/D3D12/*` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 5 (10.24 km² Streamed Island & 12–16 POIs) |
| **OZ-NAT-007B** | Phase 5 | 10.24 km² Streamed Island (`8×8` LOD0–LOD2 chunks + 4.5 m skirts), 12 POIs, River, Hydro Dam, Bridges, Road Network & Instanced Props | `Engine/WorldStreaming/TerrainStreamer.*`, `Game/World/IslandMap.*` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 6 (`OZ-NAT-008`: Battle Royale Match FSM, AI, Storm & Inventory) |
| **OZ-NAT-008** | Phase 6–7 | Battle Royale Match FSM (24 players, 5-phase Storm), Articulated 3D M4A1 & Glock 17 w/ Gloved Hands & Forearms, Tactical HUD, Live Compass & Circular Minimap | `Game/Gameplay/BattleRoyaleMatch.*`, `Game/Weapons/ViewmodelMeshes.*`, `Engine/UI/Hud2DBatch.*` | **RUNTIME_VERIFIED** | **Next**: Unlock Phase 8 (`ZeroEditor.exe` Dear ImGui workspace) |
| **OZ-NAT-009** | Phase 8–10 | `ZeroEditor.exe` (ImGui), Profiling/Optimization & Windows Installer | `Editor/*`, `Tools/Packaging/*` | **NOT_STARTED** | Queued behind Phase 7 |
