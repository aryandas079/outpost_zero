# OUTPOST ZERO — Feature Inventory (Phase 0 Baseline)

Inventory of all gameplay, engine, rendering, and UI features present in the existing Web/Three.js codebase that must be preserved or reconstructed natively in **OUTPOST ZERO (C++20 / DirectX 12)**.

## 1. Game Modes & Match Flows
- **Battle Royale (`island`)**:
  - 24 combatants (1 player + 23 bots), configurable difficulty (`easy`, `normal`, `hard`), deterministic seed (`2026079`).
  - Pre-match countdown -> C-130J diagonal SW-to-NE airdrop flight (`planeAltitudeMeters: 305 m`, `planeSpeedMps: 110 m/s`) -> Jump prompt (`F` / `SPACE`) -> 3rd-person Belly Freefall -> 3rd-person Ram-Air Parachute (`autoParachuteAglMeters: 88 m`) -> Touchdown FPS transition.
  - Multi-phase shrinking circular Safe Zone storm with inland center bounds and periodic damage outside safe radius.
  - 16 POIs across biomes (`Central City`, `North Quarry Depot`, `Solar Research Array`, `Military Airbase`, `Coastal Port`, `Hydroelectric Dam`, `Communications Station`, `Residential Town`, `Abandoned Factory`, `Forest Bunker`, `Mountain Outpost`, `Railway Yard`, `Agricultural District`, `Coastal Village`, `Power Substation`, `Remote Research Facility`).
  - Post-elimination Spectator cam (`[SPACE]` cycle alive bots) & Results summary (`Placement`, `Eliminations`, `Damage`, `Survival Time`, `Rematch`).
- **Frontier Town Wave Survival (`west`)**:
  - Multi-wave PvE defense (5 waves + endless mode), score tracking, destructible cover props.
- **Multiplayer (`src/game/multiplayer/`)**:
  - Currently WebRTC PeerJS (`Co-op` / `Deathmatch`, 2–4 players, 6-char room code). Deferred behind native `INetworkTransport` in initial offline native milestones.

## 2. Player Controller & Combat Mechanics
- **Locomotion (`SIMULATION_CONFIG`)**: Walking, Sprinting, Crouching (`1.12 m` eye height), Prone (`0.56 m`), Standing (`1.68 m`), Sliding, Dash (`2.2 s` cooldown), Jump (`gravityMps2: 22.5`), Obstacle Mantling, Reservoir/River/Ocean Swimming.
- **Health & Armor**: `100` Max Health (delayed auto-regen after `5 s` out of combat, capped at 50%), `50`/`100` Armor Shield (`[5]` armor plate restore), `[6]` Medkit restore.
- **Weapons (`11` total in `WEAPON_SPECS`)**:
  - Primaries / Marksman / Shotgun / LMG: `carbine` (M4A1), `railpistol` (K-9 Sniper), `shotgun` (M4), `smg` (MP5), `machinegun` (M249), `marksman`.
  - Sidearms: `usp`, `deagle`, `glock` (Glock 17).
  - Launchers: `rpg` (RPG-7), `grenadelauncher`.
  - Reloading (tactical vs empty timer), ADS / scoped FOV & sway + breath steadying, inspect weapon, recoil spread/kick.
- **Ordnance (`4` types)**: `frag`, `smoke`, `molotov`, `flashbang` (`[G]` throw).
- **Loot & Inventory (`[E]` pickup, `[Tab]` modal)**: Primary 1/2, Sidearm, Launcher, Ammo, Plates, Medkits, Grenades, Loadout customization.

## 3. HUD, Navigation & Settings
- **Top Bar**: Alive / Kills / Zone timer + POI pin + Kill feed | Compass (`headingDeg` ticks + waypoint diamond) + Airborne/Storm banner | Circular Minimap + `[M] MAP` button.
- **Airborne HUD**: Left `ALT` / `SPD` / `ONBOARD` ladder + bottom `[F/SPACE] JUMP` prompt (hides crosshair & weapon slot bar during flight/freefall/parachute).
- **Bottom Combat HUD**: Armor & Health bars + quick slots (`ORD [G]`, `MED [6]`, `ARM [5]`, `STANCE [TAB]`) | 4-slot weapon bar | Weapon name & Mag/Reserve counter + silhouette.
- **Interactive Tactical Map (`[M]`)**: Shared `MapTransform`, grid (`A-H`, `1-8`), true coastline + river + dam + roads + POI markers, safe zone + next zone + plane path, zoom/pan/recenter/waypoint ping.
- **Settings**: Graphics presets (`Low`, `Medium`, `High`, `Ultra`), FOV, render scale, VSync/target FPS (`60–240`), shadow quality, DRC audio preset (`wide`, `balanced`, `boost`), mouse sensitivity / ADS multiplier / invert Y, keybindings, accessibility (HUD scale, colorblind presets, reduced motion, crosshair color).
