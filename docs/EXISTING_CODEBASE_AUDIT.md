# OUTPOST ZERO — Existing Codebase Audit & Subsystem Classification (Phase 0)

**Date**: 2026-11-25  
**Target Migration**: WebGL2 / Three.js / React / WebView2 (`src/`, `windows/`) -> Native Windows x64 (`OutpostZero.exe`) powered by proprietary C++20 **ZERO Engine** (`ZeroEngine.lib`, DirectX 12, Win32, HLSL/DXC) and **ZERO Editor** (`ZeroEditor.exe`).

---

## 1. Repository & Toolchain Baseline Observed

### Existing Application Architecture
- **Frontend / Game Core (`src/`)**: TypeScript + Three.js (`^0.187.0`) + React (`^19.0.1`) + Tailwind CSS (`^4.3.3`) bundled via Vite (`^8.3.0`).
- **Desktop Packaging (`electron/` & `windows/`)**:
  - Legacy Electron wrapper (`electron/main.cjs`, `electron/preload.cjs`, `release/win-unpacked/`).
  - Hybrid C# WinUI 3 (`windows/OutpostZero.WinUI/`) hosting `CoreWebView2` over Vite `dist/`, paired with a C++20 Win32/DXGI helper DLL (`windows/OutpostZero.Native/`). Neither removes the Chromium/JS runtime.
- **Game Modes Currently Implemented**:
  1. **Battle Royale (`island`)**: 10.24 km² (`3,200 m × 3,200 m`) island, 24 participants, C-130 deployment flight corridor, 3rd-person freefall + parachute transition to 1st-person combat, 16 POIs, 24 curved highways/rural/dirt roads with bridges, Hydro Reservoir + river channel, dynamic safe-zone storm cylinder, armor plates/medkits/ground loot/containers, spectator mode.
  2. **Frontier Town Survival (`west`)**: Wave-based combat arena with 5 waves + endless option, enemy droids, destructible crates/cover, ordnance.
  3. **Multiplayer (`src/game/multiplayer/`)**: PeerJS WebRTC P2P Co-op & Deathmatch rooms (up to 4 players).
- **Automated Test Suite (`tests/*.test.ts`)**: 66 Node `tsx` tests covering architecture, physics, rendering batching, terrain streaming, loadouts, crosshair, audio compression, health regen, and Battle Royale systems (`0` failures on baseline verification).

### Verified Workstation Native Toolchain
- **OS & Hardware**: Windows 11 x64 (`10.0.26340` / `OSArchitecture 64-bit`), Intel Core i5-12450HX (8 cores / 12 threads), NVIDIA GeForce RTX 3050 6GB Laptop GPU + Intel UHD Graphics, 16 GB RAM.
- **Compiler & Build Tools**: Visual Studio `18.11.12328.437` (`D:\Visual Studio`), `cmake 4.3.1-msvc1`, `ninja 1.13.2`, `vcpkg 2026-07-27`.
- **Windows SDK (`10.0.26100.0`, `D:\Windows Kits\10`)**: `dxc.exe 1.9.2602.17`, `d3d12.h`, `dxgi1_6.h`, `xaudio2.h`, `dwrite_3.h`, `d2d1_3.h`, `d3d11on12.h`.

---

## 2. Subsystem Migration Classification

| Legacy Subsystem / Path | Responsibility | Classification | Migration Action |
|---|---|---|---|
| `windows/OutpostZero.Native/` (`OutpostNative.cpp`, `.h`) | Win32 QPC timing, MMCSS, `ClipCursor`, DXGI adapter/VRAM enumeration, refresh rate query | **Reusable after conversion** | Migrate Win32/DXGI helpers into `Engine/Platform/Windows` and `Engine/Renderer/D3D12` using RAII + `ComPtr` |
| `src/core/Config.ts`, `src/game/types.ts` (`WEAPON_SPECS`, `HUD_PALETTE`, `GRAPHICS_PRESET_TIERS`) | Centralized world dimensions, simulation constants (`60 Hz`), weapon stats, UI palette tokens | **Reusable after conversion** | Export / port constants cleanly into `Config/*.json` & `Engine/Core/Configuration` / `Game/Weapons` structs |
| `src/world/Terrain.ts`, `Biomes.ts`, `Roads.ts`, `Buildings.ts`, `Geology.ts`, `Water.ts`, `Vegetation.ts` | Deterministic seeded 10.24 km² island heightfield math, 16 POIs, road graph, river/reservoir curves | **Requires native reimplementation** | Port seeded noise, POI definitions, road splines, and terrain height evaluation cleanly to C++20 for CPU collision + GPU chunk meshing |
| `src/core/Engine.ts`, `GameLoop.ts`, `GameState.ts`, `EventBus.ts` | Monolithic scene coordinator (`5,700+` lines), RAF loop, match FSM, typed event bus | **Requires native reimplementation** | Replace RAF/TS engine with native C++20 `Zero::Application`, fixed `60 Hz` accumulator loop, `MatchStateMachine`, and typed `EventBus` |
| `src/rendering/*`, `src/world/MapGenerator.ts`, `WorldStreaming.ts` | Three.js WebGL2 forward pass, GLSL sky/ocean/storm shaders, 64 chunk streamer | **Requires native reimplementation** | Replace Three.js/GLSL with DirectX 12 RHI, RenderGraph passes, HLSL SM 6.0 shaders compiled via `dxc.exe`, DXGI 1.6 swap chain |
| `src/physics/PhysicsWorld.ts`, `src/game/physics.ts` | Custom 2D spatial hash + capsule vs AABB sweep & camera sphere pushout | **Requires complete redesign** | Replace custom JS spatial hash with native continuous 3D collision & **Jolt Physics** integration in `Engine/Physics` |
| `src/animation/WeaponRig.ts`, `Crosshair.ts`, `src/entities/*` | Procedural weapon rigs, skydiver/parachute rig, C-130 rig, finite-state AI steering | **Requires complete redesign** | Reimplement with native ECS components, hierarchical transforms / skeletal animation (`gltf`), and Recast/Detour AI navigation |
| `src/audio/TacticalAudio.ts`, `audioCompression.ts` | Web Audio API procedural SFX, compressor curves, positional panning | **Requires complete redesign** | Replace Web Audio with native **XAudio2** spatial mixing buses and procedural / streamed WAV/PCM synthesizer |
| `src/input/InputManager.ts` | DOM keyboard/mouse/pointer-lock/touch listener | **Requires native reimplementation** | Replace DOM input with Win32 **Raw Input** (`WM_INPUT`), keyboard state table, cursor confinement, and **XInput** |
| `src/components/*`, `src/ui/*`, `src/App.tsx` | React 19 + Tailwind CSS HUD, minimap, tactical map, inventory, settings modals | **Requires complete redesign** | Replace HTML/DOM UI with native GPU-rendered 2D UI framework + DirectWrite/atlas text (`Engine/UI`) matching `#10161D` wireframe tokens |
| `src/game/multiplayer/networkManager.ts` | PeerJS WebRTC browser signaling & DataChannels | **Requires complete redesign** | Remove PeerJS; prioritize local offline simulation behind clean `INetworkTransport` interfaces before authoritative UDP (`GameNetworkingSockets`) |
| `public/weapons/*.png`, `public/assets/aistudio/*.png`, `public/icon.png` | 15 weapon silhouettes, 37 operator portraits, app emblem | **Reusable after conversion** | Compile into RGBA8/BC7 textures and `outpost_zero.ico` / `OutpostZero.rc` Windows native resources |
| `src/utilities/NativeBridge.ts`, `windows/OutpostZero.WinUI/`, `electron/` | WebView2 WebMessages bridge, C# XAML WebView host, Electron shell | **Obsolete or unnecessary** | Retain in repo during migration parity period; exclude completely from native `ZeroEngine.lib` / `OutpostZero.exe` runtime |

---

## 3. Existing Browser Defects Audited Prior to Native Design
1. **Browser & WebView2 Overhead**: WebGL2 single-threaded CPU bottlenecks, GC stalls, software-renderer fallback stalls, large minified JS payload (`1.51 MB`), pointer-lock restrictions in embedded hosts.
2. **Legacy Coordinate / Triangle Sync Vulnerabilities**: Separate JS analytical terrain height vs GPU vertex buffer resolution required synchronous workaround stalls (`ensureHighLodAround`). Native C++ shared heightfield memory between Jolt heightfield shapes and DX12 chunk vertex upload buffers eliminates divergence structurally.
3. **Lack of Native Tooling / Hot Reload / Render Graph Control**: No explicit D3D12 resource barriers, GPU timestamps, or level editor serialization. **ZERO Engine** and **ZERO Editor** solve this cleanly with deterministic scene formats (`Assets/`, `Config/`).
