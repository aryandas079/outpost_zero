# Outpost Zero — 3D Tactical First-Person Shooter

A high-performance sunlit brutalist 3D first-person shooter built with Three.js, React, and Tailwind CSS. Features procedural low-poly sci-fi weapons, tactical wave-based droid combat, Web Audio API sound synthesis, procedural canvas textures, responsive desktop and mobile controls, and advanced rendering optimizations (multi-draw batching, static geometry merging, and adaptive quality targetting high-refresh rates up to 200 FPS).

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
- **1 / 2** or **Mouse Wheel**: Switch Weapons (M13 Carbine / K-9 Sniper)
- **Escape**: Pause Menu / Graphics Settings / Release Mouse Lock

### Mobile / Touch
- **Left Virtual Joystick**: Movement
- **Right Virtual Touchpad**: Look / Aim
- **On-Screen Buttons**: Fire, ADS, Jump, Reload, Weapon Switch

---

## 🚀 Features & Optimizations

- **High-Refresh Rendering Engine**: Multi-draw batching, static geometry grouping (reducing scene draw calls by ~80%), dynamic shadow caching, and GPU timer telemetry.
- **Adaptive Quality Control**: Automatically monitors frame times and scales resolution and visual effects to sustain smooth performance (supporting 60Hz, 120Hz, 144Hz, and 200+ FPS targets).
- **Procedural Textures & Materials**: Concrete, metal trim, solar panels, and dust effects generated entirely in code with zero external texture bloat.
- **Web Audio API Sound Engine**: Real-time synthesized gunshot audio, ricochets, shell drops, footsteps, reload clicks, and ambient atmospheric tones.
- **Dynamic Wave Combat**: Encounter adaptive AI combat droids with laser targeting, flanking behaviors, and escalating wave difficulty.
- **Tactical Combat HUD**: Sci-fi minimalist HUD with dynamic crosshair, radar minimap, health & shield gauges, and ammo displays.
- **Automated GitHub Pages CI/CD**: Pushes to `main` build and deploy to GitHub Pages automatically via GitHub Actions.

---

## 🛠️ Local Development & Testing

### Prerequisites
- Node.js (v18+)
- npm

### Setup
```bash
# Clone the repository
git clone https://github.com/aryandas079/outpost_zero.git
cd outpost_zero

# Install dependencies
npm ci

# Run test suite
npm test

# Start local development server
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

---

## 🚢 Deployment

Automated deployment is configured with GitHub Actions (`.github/workflows/deploy.yml`). Pushes to the `main` branch automatically trigger a production build, run tests, and deploy to GitHub Pages.
