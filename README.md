# Outpost Zero

A browser-based 3D tactical first-person shooter and combat simulator built with Three.js, React, and Tailwind CSS. The game features real-time procedural weapon systems, wave-based tactical combat, serverless peer-to-peer multiplayer, synthesized audio with dynamic range compression, responsive desktop and mobile controls, and high-framerate rendering optimizations.

Live Demo: https://aryandas079.github.io/outpost_zero/

---

## Overview

Outpost Zero delivers an arcade-tactical FPS experience directly in the browser with no downloads or plugins required. It also supports standalone desktop execution via Electron.

Key highlights include:
- Single-player wave survival against adaptive AI combat droids.
- Serverless peer-to-peer multiplayer (Co-op and Deathmatch PvP) using WebRTC and STUN signaling.
- Procedural weapons and gear customization including the M4A1 Carbine, M249 LMG, Glock 17, and RPG-7.
- Fully procedural audio synthesis via Web Audio API with customizable dynamic range compression presets (Wide, Balanced, Footstep Boost).
- Dynamic reticle crosshair system with weapon-specific spreading, crouching stabilization, and kick animation.
- Advanced collision physics with anti-tunneling wall resolution and camera occlusion avoidance.
- Dynamic rendering engine with multi-draw batching, static geometry merging, and target framerate presets (60, 120, 144, 200+ FPS).

---

## Controls

### Keyboard and Mouse

- W, A, S, D: Movement (Forward, Strafe Left, Backward, Strafe Right)
- Mouse: Look and aim (Click the canvas to lock pointer)
- Left Mouse Button: Primary fire
- Right Mouse Button: Aim down sights (ADS)
- Spacebar: Jump
- Left Shift: Sprint
- C: Slide / Crouch
- R: Reload
- G: Throw grenade
- 1, 2: Primary weapons (M4A1 Carbine, M249 LMG)
- 3, 4: Sidearm (Glock 17) and heavy ordnance (RPG-7)
- Mouse Wheel: Cycle weapons
- Tab: Multiplayer scoreboard and match stats
- Escape: Pause menu, settings, or release pointer lock

### Touch Devices

- Left Virtual Joystick: Movement
- Right Virtual Touchpad: Look and aim
- On-Screen Action Buttons: Fire, ADS, Jump, Reload, Grenade, Weapon Swap

---

## Multiplayer

Outpost Zero uses PeerJS and WebRTC data channels for low-latency peer-to-peer networking. Up to 4 players can connect from anywhere without dedicated game servers or port forwarding.

### Game Modes

- Co-op Wave Survival (1-4 Players): Defend the town against increasingly aggressive robot waves. Coordinate loadouts and revive downed teammates.
- Deathmatch PvP (2-4 Players): Free-for-all combat with customizable score limits (10, 15, or 25 eliminations), instant respawns, and real-time kill feed.

### How to Join a Match

1. Select "Multiplayer" from the main menu.
2. Enter your call-sign and choose your visor color theme.
3. Hosting: Choose game mode and settings, then click "Create Match Lobby". Share the generated 6-character room code or invite URL.
4. Joining: Select "Join Existing Room", paste the host's room code, and connect.
5. Once all players are ready, the host starts the mission.

---

## Technology Stack

- Engine and Graphics: Three.js, WebGL
- Frontend UI: React 19, Tailwind CSS, Lucide Icons, Motion
- Networking: PeerJS, WebRTC (DataChannels)
- Audio: Web Audio API (Synthesized procedural sound, dynamic range compressor)
- Build System: Vite
- Desktop Runtime: Electron, Electron Builder
- CI/CD: GitHub Actions (Automated testing and GitHub Pages deployment)

---

## Getting Started

### Prerequisites

- Node.js (version 18 or later)
- npm

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/aryandas079/outpost_zero.git
cd outpost_zero
npm ci
```

### Running Tests

Execute the automated test suite (38 unit tests covering rendering, multiplayer, loadout, audio compression, dynamic crosshairs, and physics):

```bash
npm test
```

### Development Server

Start the local development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser to play.

### Production Build

Create an optimized static build:

```bash
npm run build
npm run preview
```

The production assets will be output to the `dist` directory.

### Desktop App (Electron)

Run or package the application as a standalone desktop binary:

```bash
# Run in Electron development mode
npm run electron:dev

# Package executable for your platform
npm run electron:pack
```

---

## Deployment

Deployments to GitHub Pages are managed via GitHub Actions (.github/workflows/deploy.yml). Any push to the `main` branch automatically runs the test suite, builds the production bundle, and publishes the site to the `gh-pages` branch.

---

## License

This project is licensed under the Apache 2.0 License. See the LICENSE file for details.
