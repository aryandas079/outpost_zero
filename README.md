# Outpost Zero — 3D Tactical First-Person Shooter

A sunlit brutalist 3D first-person shooter built with Three.js, React, and Tailwind CSS. Features procedural low-poly sci-fi weapons, tactical wave-based droid combat, Web Audio API sound synthesis, procedural canvas textures, and responsive desktop and mobile controls.

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
- **1 / 2** or **Mouse Wheel**: Switch Weapons (Assault Rifle / Heavy Shotgun)
- **Escape**: Pause Menu / Release Mouse Lock

### Mobile / Touch
- **Left Virtual Joystick**: Movement
- **Right Virtual Touchpad**: Look / Aim
- **On-Screen Buttons**: Fire, ADS, Jump, Reload, Weapon Switch

---

## 🚀 Features

- **Procedural Canvas Textures & Materials**: Concrete, metal trim, solar panels, and dust effects generated entirely in code with zero external texture bloat.
- **Web Audio API Sound Engine**: Real-time synthesized gunshot audio, ricochets, shell drops, footsteps, reload clicks, and ambient atmospheric tones.
- **Dynamic Wave Combat**: Encounter adaptive AI combat droids with laser targeting, flanking behaviors, and escalating wave difficulty.
- **Tactical Combat HUD**: Sci-fi minimalist HUD with dynamic crosshair, radar minimap, health & shield gauges, and ammo displays.
- **Automatic GitHub Pages Deployment**: Fully automated CI/CD pipeline via GitHub Actions.

---

## 🛠️ Local Development

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

Automated deployment is configured with GitHub Actions (`.github/workflows/deploy.yml`). Pushes to the `main` branch automatically trigger a production build and deploy to GitHub Pages.
