# Outpost Zero — 3D Tactical First-Person Shooter & Combat Simulator

A high-performance sunlit brutalist 3D first-person shooter built with Three.js, React, and Tailwind CSS. Features procedural low-poly weapons, tactical wave-based droid combat, peer-to-peer multiplayer, Web Audio API sound synthesis, responsive desktop and mobile controls, and advanced rendering optimizations (multi-draw batching, static geometry merging, and adaptive quality targeting high-refresh rates up to 200 FPS).

🎮 **Live Demo:** [https://aryandas079.github.io/outpost_zero/](https://aryandas079.github.io/outpost_zero/)

---

## 🕹️ Controls

### Desktop (Keyboard & Mouse)
- **W / A / S / D**: Move (Forward, Strafe Left, Backward, Strafe Right)
- **Mouse**: Look around (Click game canvas to lock pointer)
- **Left Mouse Button**: Primary Fire
- **Right Mouse Button**: Aim Down Sights (ADS)
- **Spacebar**: Jump
- **Shift**: Sprint
- **C**: Slide / Crouch
- **R**: Reload
- **G**: Throw Grenade (0.38s hand release presentation)
- **1 / 2**: Primary Weapons (M4A1 Carbine / M249 LMG)
- **3 / 4**: Sidearm (Glock 17) & Heavy Ordnance (RPG-7)
- **Mouse Wheel**: Cycle Weapons
- **Tab**: Multiplayer Leaderboard & Match Stats
- **Escape**: Pause Menu / Graphics & Controls Settings / Release Mouse Lock

### Mobile / Touch
- **Left Virtual Joystick**: Movement
- **Right Virtual Touchpad**: Look / Aim
- **On-Screen Buttons**: Fire, ADS, Jump, Reload, Grenade, Weapon Switch

---

## 🌐 Peer-to-Peer Multiplayer (Up to 4 Players)

Outpost Zero features full peer-to-peer multiplayer using WebRTC with automatic STUN signaling, allowing up to 4 players from anywhere in the world to connect instantly without external server software or port forwarding.

### Game Modes:
- **Co-op Wave Defense (1-4 Players)**: Team up to survive frontier robot waves across the 15 enterable buildings of West Town. Players share the battlefield, revive teammates, coordinate loadouts, and synchronize enemy waves.
- **Deathmatch PvP Arena (2-4 Players)**: Free-for-all tactical shootout with customizable elimination goals (First to 10, 15, or 25 kills), dynamic respawns, headshot detection, and real-time leaderboard (toggled with `[TAB]`).

### How to Play with Friends:
1. Click **Multiplayer (1-4 Players)** on the main menu.
2. Choose your **Call-sign** and **Visor/Armor Color** (Neon Cyan, Solar Amber, Bio Emerald, Pulse Rose).
3. **Host a Match**: Select your mode, difficulty or score limit, and click **Create Match Lobby**.
4. Share the generated 6-character **Room Code** (e.g. `OPZ-7K2X`) or click **Share Link** to copy a direct invite link (`?room=OPZ-7K2X`).
5. **Join a Match**: Other players click **Join Existing Room**, paste the code (or open the shared link), and click **Connect**.
6. When players ready up, the host clicks **Launch Squad Mission** to begin!

---

## 🔫 Weapons & Custom Models

The default loadout includes the **M4A1 carbine**, **M249 LMG**, **Glock 17**, and **RPG-7**. The first-person models feature fitted full-finger tactical gloves, charcoal fabric, metal roughness and normal maps, and separate factory-marking decals.

### Tactical HUD & Settings
- Slim tactical compass, circular radar minimap, compact vitals and equipment panels, and angled ammunition readouts.
- Full graphics settings: resolution scaling, shadow resolution, post-processing toggles, and target framerate presets (60, 120, 144, 200+ FPS).
- Customizable keybindings and controls remapping.

---

## 🛠️ Local Development & Desktop App

### Prerequisites
- Node.js (v18+)
- npm

### Web Development
```bash
# Clone the repository
git clone https://github.com/aryandas079/outpost_zero.git
cd outpost_zero

# Install dependencies
npm ci

# Run test suite
npm test

# Start local dev server
npm run dev
```

### Desktop Application (Electron)
```bash
# Run in Electron dev mode
npm run electron:dev

# Package standalone desktop executable
npm run electron:pack
```

---

## 🚢 Deployment

Automated deployment is configured with GitHub Actions (`.github/workflows/deploy.yml`). Pushes to the `main` branch automatically run the test suite, build the production bundle, and deploy to GitHub Pages.
