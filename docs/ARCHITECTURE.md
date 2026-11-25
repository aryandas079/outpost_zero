# OUTPOST ZERO — Architecture Overview

OUTPOST ZERO is structured around cleanly separated TypeScript simulation, WebGL2/Three.js rendering, React UI presentation, and a standalone native Windows desktop host built in C++20 and C# / WinUI 3.

## System Topology

```text
outpost_zero/
├── src/
│   ├── core/          # Engine coordinator, Config, EventBus, GameLoop, GameState (FSM)
│   ├── rendering/     # SkySystem (analytical shader dome), LightingRig, Renderer, Shadows, PostProcessing, StaticBatches, FrameMetrics
│   ├── world/         # Biomes, Terrain (heightfield + 16 POIs + coastline/river), Roads, Water, WorldStreaming (64 LOD chunks), Buildings, MapGenerator, WestTown, Occlusion
│   ├── entities/      # Aircraft (C-130J), Parachute, AI (terrain & storm steering)
│   ├── gameplay/      # StormController, InventorySystem, LootManager, DeploymentSystem, Damage, HealthRegen
│   ├── physics/       # PhysicsWorld capsule/segment spatial hash collision wrapper
│   ├── animation/     # FirstPersonWeaponRig, DynamicCrosshair solver wrappers
│   ├── audio/         # TacticalAudio & AudioCompression bus
│   ├── input/         # InputManager (keyboard, mouse, wheel, pointer capture, visibility/blur cleanup)
│   ├── networking/    # PeerJS multiplayer facade & remote operative rigs
│   ├── assets/        # AssetManager + procedural texture/weapon/operator barrels
│   ├── settings/      # SettingsStore + preset normalization & validation
│   ├── ui/            # Modular HUD, Minimap, TacticalMap, Menus, DevPerfOverlay barrels (backed by src/components/)
│   ├── utilities/     # SeededRng, MapTransform, NativeBridge, Geometry, Assets
│   ├── tests/         # Re-exported architectural test suite
│   └── game/          # Compatibility re-exports preserving prototype contracts (engine.ts, battleRoyaleIsland.ts, types.ts)
├── tests/             # Executable Node test suites (62 automated unit & integration tests)
└── windows/
    ├── OutpostZero.Native/ # C++20 Win32/DXGI DLL (GPU VRAM query, monitor Hz, ClipCursor confinement, QPC/MMCSS timer) + Native C++ test binary
    └── OutpostZero.WinUI/  # C# .NET 10 WinUI 3 host embedding WebView2, virtual host mapping, F9 telemetry bar, F11 borderless fullscreen & recovery UI
```

## Key Architectural Guarantees

1. **Single Active GameLoop**: `src/core/GameLoop.ts` drives a single fixed-timestep simulation accumulator (`1/60s`, capped `dt <= 0.05s`, max 4 substeps/frame) and dispatches rendering once per display frame.
2. **Match Lifecycle State Machine**: `src/core/GameState.ts` (`MatchStateMachine`) tracks explicit transitions across `main_menu`, `match_loading`, `aircraft_deployment`, `freefall`, `parachuting`, `active_match`, `paused`, `eliminated`, `spectating`, `match_completed`, and `results`.
3. **Analytical Sky & Horizon Cohesion**: `src/rendering/Sky.ts` (`SkySystem`) renders an analytical sky dome shader centered on the active camera inside the far plane alongside a 6,200m circular ocean disc (`src/world/Water.ts`) and 1,400m vertical-fading storm cylinder shader (`src/world/MapGenerator.ts`), eliminating cubemap seam blur and cylinder sky cuts.
4. **Chunked LOD World Streaming**: `src/world/WorldStreaming.ts` partitions the 3,200m × 3,200m (10.24 km²) island into 64 `400m × 400m` chunks with 3 LOD levels, downward skirts, dual-scale rotated stochastic texture sampling, predictive velocity lookahead, and LRU high-LOD reclamation.
5. **Unified Map Coordinate Transform**: `src/utilities/MapTransform.ts` serves both `RadarMinimap.tsx` and `TacticalMapModal.tsx` identically (`worldToMapPoint` / `mapPointToWorld`) using true coastline polygons and river polylines.
6. **Native Windows Desktop Runtime (WinUI 3 + C++20)**: Replaces Electron with `OutpostZero.exe` + `OutpostZero.Native.dll` via bidirectional WebView2 WebMessages (`src/utilities/NativeBridge.ts`).
