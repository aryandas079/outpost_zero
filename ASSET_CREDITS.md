# OUTPOST ZERO — Asset & Dependency Credits

All 3D geometry, terrain heightfields, textures, shader materials, UI components, and Web Audio sound effects inside OUTPOST ZERO are procedurally synthesized or authored in-project, with zero copyrighted proprietary assets included.

## Procedural Game Content (Original In-Project Implementation)
- **3D Island Terrain, Biomes, Roads, Bridges & 16 POIs**: Procedural heightfield & Three.js geometry builders (`src/world/*`).
- **Sky Atmosphere, Ocean Water & Storm Wall GLSL Shaders**: Custom vertex/fragment shaders (`src/rendering/Sky.ts`, `src/world/Water.ts`, `src/world/MapGenerator.ts`).
- **Vehicles, Weapons, Operators & Tactical Parachute**: Procedural multipart Three.js rigs (`src/entities/Aircraft.ts`, `src/entities/Parachute.ts`, `src/game/weaponModels.ts`, `src/game/operatorModels.ts`, `src/game/enemies.ts`).
- **PBR Surface Textures**: Procedural HTML5 Canvas noise/normal/roughness maps (`src/game/textures.ts`).
- **Procedural Spatial Audio & Foley**: Web Audio API synthesizers and dynamics compression presets (`src/game/audio.ts`, `src/game/audioCompression.ts`).

## Open-Source Libraries & Platform SDKs
- **Three.js** (`^0.187.0`) — MIT License — 3D WebGL2 scene graph and rendering (`src/core/Engine.ts`, `src/rendering/*`, `src/world/*`).
- **React** (`^19.0.1`) & **React DOM** — MIT License — HUD and menu UI (`src/components/*`).
- **Lucide React** (`^0.546.0`) — ISC License — Tactical UI iconography (`src/components/TitleOverlay.tsx`).
- **Tailwind CSS** (`^4.3.3`) — MIT License — UI styling utilities.
- **PeerJS** (`^1.5.5`) — MIT License — Peer-to-peer WebRTC multiplayer transport (`src/game/multiplayer/networkManager.ts`).
- **Vite** (`^8.3.0`) & **TypeScript** (`^7.0.2`) — MIT / Apache-2.0 Licenses — Bundling and type checking.
- **Microsoft Windows App SDK (`2.5.1`) & WebView2 (`1.0.3719.77`)** — MIT / Microsoft Software License Terms — Standalone WinUI 3 native Windows host (`windows/OutpostZero.WinUI/`).
