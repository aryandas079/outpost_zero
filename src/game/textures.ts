import * as THREE from 'three';

export interface ProceduralTextures {
  // Core / weapon / enemy textures
  floorColor: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  concreteColor: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  hazardColor: THREE.CanvasTexture;
  crateColor: THREE.CanvasTexture;
  crateNormal: THREE.CanvasTexture;
  brushedMetal: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  gunMetalColor: THREE.CanvasTexture;
  gunMetalRoughness: THREE.CanvasTexture;
  gunMetalBump: THREE.CanvasTexture;
  gunMetalNormal: THREE.CanvasTexture;
  gunFdeColor: THREE.CanvasTexture;
  gunFdeRoughness: THREE.CanvasTexture;
  gunFdeNormal: THREE.CanvasTexture;
  opticDialColor: THREE.CanvasTexture;
  opticCapColor: THREE.CanvasTexture;
  holoHousingBack: THREE.CanvasTexture;
  holoReticle: THREE.CanvasTexture;
  scopeLensReticle: THREE.CanvasTexture;
  tacticalSleeveColor: THREE.CanvasTexture;
  tacticalSleeveBump: THREE.CanvasTexture;
  tacticalGloveColor: THREE.CanvasTexture;
  tacticalGloveNormal: THREE.CanvasTexture;
  weaponMarkings: THREE.CanvasTexture;
  humanSkinColor: THREE.CanvasTexture;
  humanSkinNormal: THREE.CanvasTexture;
  muzzleFlame: THREE.CanvasTexture;

  // WEST Frontier Town — High-Craft PBR Architectural & Terrain Textures
  desertSandColor: THREE.CanvasTexture;
  desertSandRoughness: THREE.CanvasTexture;
  desertSandNormal: THREE.CanvasTexture;
  desertSandBump: THREE.CanvasTexture;
  dirtRoadColor: THREE.CanvasTexture;
  dirtRoadNormal: THREE.CanvasTexture;
  canyonRockColor: THREE.CanvasTexture;
  canyonRockNormal: THREE.CanvasTexture;
  woodPlankLightColor: THREE.CanvasTexture;
  woodPlankDarkColor: THREE.CanvasTexture;
  woodPlankRedColor: THREE.CanvasTexture;
  woodPlankNormal: THREE.CanvasTexture;
  woodPlankRoughness: THREE.CanvasTexture;
  woodPlankBump: THREE.CanvasTexture;
  woodFloorColor: THREE.CanvasTexture;
  woodFloorNormal: THREE.CanvasTexture;
  roofShingleColor: THREE.CanvasTexture;
  roofShingleNormal: THREE.CanvasTexture;
  roofShingleBump: THREE.CanvasTexture;
  brickAdobeColor: THREE.CanvasTexture;
  brickAdobeNormal: THREE.CanvasTexture;
  brickAdobeRoughness: THREE.CanvasTexture;
  canvasClothColor: THREE.CanvasTexture;
  hayBaleColor: THREE.CanvasTexture;

  // Atmospheric Dust, Sun Corona & Realistic Surface Bullet Impact Decals
  dustPuff: THREE.CanvasTexture;
  dustMote: THREE.CanvasTexture;
  sunCorona: THREE.CanvasTexture;
  bulletHoleWood: THREE.CanvasTexture;
  bulletHoleStone: THREE.CanvasTexture;
  bulletHoleMetal: THREE.CanvasTexture;

  // 10 km² Battle Royale Island — Fine Multi-Frequency Terrain & Ocean PBR Textures
  islandTerrainColor: THREE.CanvasTexture;
  islandTerrainNormal: THREE.CanvasTexture;
  islandTerrainRoughness: THREE.CanvasTexture;
  oceanWaterColor: THREE.CanvasTexture;
  oceanWaterNormal: THREE.CanvasTexture;

  // Realistic Foliage & Forest Canopy PBR Textures
  pineNeedlesColor: THREE.CanvasTexture;
  pineNeedlesNormal: THREE.CanvasTexture;
  leafCanopyColor: THREE.CanvasTexture;
  leafCanopyNormal: THREE.CanvasTexture;
  grassTuftColor: THREE.CanvasTexture;

  createSignTexture: (title: string, subtitle?: string, variant?: 'dark' | 'cream' | 'red') => THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

// Fast deterministic PRNG so architectural textures look richly crafted and consistent
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function addSubtleGrain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, step = 2, rng = Math.random) {
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = Math.floor(rng() * 255);
      ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      ctx.fillRect(x, y, step, step);
    }
  }
}

/**
 * Converts a grayscale heightmap canvas into a seamless tangent-space RGB normal map texture
 * using a 3x3 Sobel filter for genuine per-pixel 3D surface relief under sunlight.
 */
function heightCanvasToNormalTexture(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  aniso: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [nCanvas, nCtx] = makeCanvas(w, h);
  const outImg = nCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = (x + w) % w;
    const wy = (y + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  nCtx.putImageData(outImg, 0, 0);
  const tex = new THREE.CanvasTexture(nCanvas);
  // Linear space for normal maps (default NoColorSpace)
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = aniso;
  return tex;
}

/**
 * Paints rich, weathered frontier timber planks with authentic fiber streaks, knots,
 * bevel lap-siding shadow gradients, butt joints, rusted nails, and sun-baked dust wear.
 */
function paintWoodPlanks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  baseRgb: [number, number, number],
  plankCount: number,
  vertical = false,
  seed = 101,
  peelingPaint = false,
) {
  const rng = createRng(seed);
  const [br, bg, bb] = baseRgb;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, w, h);

  const plankSize = (vertical ? w : h) / plankCount;

  for (let i = 0; i < plankCount; i++) {
    const shade = (rng() - 0.5) * 34;
    const warmShift = (rng() - 0.5) * 14;
    const r = Math.max(0, Math.min(255, Math.round(br + shade + warmShift)));
    const g = Math.max(0, Math.min(255, Math.round(bg + shade * 0.9 + warmShift * 0.4)));
    const b = Math.max(0, Math.min(255, Math.round(bb + shade * 0.78)));

    const start = i * plankSize;
    // Slight lap-siding top-to-bottom sunlit bevel gradient across each board
    const boardGrad = vertical
      ? ctx.createLinearGradient(start, 0, start + plankSize, 0)
      : ctx.createLinearGradient(0, start, 0, start + plankSize);
    boardGrad.addColorStop(0, `rgb(${Math.min(255, r + 14)},${Math.min(255, g + 12)},${Math.min(255, b + 9)})`);
    boardGrad.addColorStop(0.18, `rgb(${r},${g},${b})`);
    boardGrad.addColorStop(0.84, `rgb(${Math.max(0, r - 12)},${Math.max(0, g - 11)},${Math.max(0, b - 9)})`);
    boardGrad.addColorStop(1, `rgb(${Math.max(0, r - 28)},${Math.max(0, g - 24)},${Math.max(0, b - 20)})`);

    ctx.fillStyle = boardGrad;
    if (vertical) {
      ctx.fillRect(start, 0, plankSize, h);
    } else {
      ctx.fillRect(0, start, w, plankSize);
    }

    // Layered organic timber grain fibers & splits
    for (let s = 0; s < 24; s++) {
      const offset = start + rng() * plankSize;
      const dark = rng() > 0.34;
      ctx.strokeStyle = dark
        ? `rgba(${Math.max(0, r - 48)}, ${Math.max(0, g - 42)}, ${Math.max(0, b - 34)}, ${0.16 + rng() * 0.24})`
        : `rgba(${Math.min(255, r + 34)}, ${Math.min(255, g + 28)}, ${Math.min(255, b + 20)}, ${0.12 + rng() * 0.14})`;
      ctx.lineWidth = 0.8 + rng() * 2.1;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(offset, 0);
        ctx.bezierCurveTo(
          offset + (rng() - 0.5) * 5,
          h * 0.33,
          offset + (rng() - 0.5) * 5,
          h * 0.66,
          offset + (rng() - 0.5) * 2,
          h,
        );
      } else {
        ctx.moveTo(0, offset);
        ctx.bezierCurveTo(
          w * 0.33,
          offset + (rng() - 0.5) * 5,
          w * 0.66,
          offset + (rng() - 0.5) * 5,
          w,
          offset + (rng() - 0.5) * 2,
        );
      }
      ctx.stroke();
    }

    // Aged sun-check drying cracks along plank
    if (rng() > 0.35) {
      const cOff = start + plankSize * (0.25 + rng() * 0.5);
      const cStart = rng() * (vertical ? h : w) * 0.6;
      const cLen = 40 + rng() * 140;
      ctx.strokeStyle = 'rgba(18, 12, 7, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(cOff, cStart);
        ctx.lineTo(cOff + (rng() - 0.5) * 3, cStart + cLen);
      } else {
        ctx.moveTo(cStart, cOff);
        ctx.lineTo(cStart + cLen, cOff + (rng() - 0.5) * 3);
      }
      ctx.stroke();
    }

    // Realistic concentric wood knot
    if (rng() > 0.42) {
      const kx = vertical ? start + plankSize * (0.28 + rng() * 0.44) : 40 + rng() * (w - 80);
      const ky = vertical ? 40 + rng() * (h - 80) : start + plankSize * (0.28 + rng() * 0.44);
      const rx = vertical ? 3.5 + rng() * 2.5 : 8 + rng() * 5;
      const ry = vertical ? 8 + rng() * 5 : 3.5 + rng() * 2.5;
      ctx.fillStyle = `rgba(${Math.max(0, r - 64)}, ${Math.max(0, g - 54)}, ${Math.max(0, b - 44)}, 0.58)`;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${Math.max(0, r - 38)}, ${Math.max(0, g - 32)}, ${Math.max(0, b - 24)}, 0.42)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rx * 1.55, ry * 1.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sun-baked peeling paint flakes exposing raw greyed pine underneath (for painted red buildings)
    if (peelingPaint) {
      const flakes = 4 + Math.floor(rng() * 6);
      for (let f = 0; f < flakes; f++) {
        const fx = vertical ? start + rng() * (plankSize - 6) : rng() * (w - 36);
        const fy = vertical ? rng() * (h - 36) : start + rng() * (plankSize - 6);
        const fw = vertical ? 4 + rng() * 7 : 18 + rng() * 44;
        const fh = vertical ? 18 + rng() * 44 : 3 + rng() * 6;
        ctx.fillStyle = `rgba(154, 128, 98, ${0.26 + rng() * 0.28})`;
        ctx.fillRect(fx, fy, fw, fh);
      }
    }

    // Deep recessed plank seam shadow + crisp sunlit upper chamfer highlight
    ctx.strokeStyle = 'rgba(14, 9, 5, 0.82)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(start, 0);
      ctx.lineTo(start, h);
    } else {
      ctx.moveTo(0, start);
      ctx.lineTo(w, start);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 236, 204, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(start + 2.8, 0);
      ctx.lineTo(start + 2.8, h);
    } else {
      ctx.moveTo(0, start + 2.8);
      ctx.lineTo(w, start + 2.8);
    }
    ctx.stroke();

    // Cross board butt-joint + iron nail heads with subtle rust drip
    const joint = ((i * 197 + 91) % (w - 110)) + 55;
    ctx.strokeStyle = 'rgba(14, 9, 5, 0.68)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(start, joint);
      ctx.lineTo(start + plankSize, joint);
    } else {
      ctx.moveTo(joint, start);
      ctx.lineTo(joint, start + plankSize);
    }
    ctx.stroke();

    for (const off of [-7, 7]) {
      for (const frac of [0.26, 0.74]) {
        const nx = vertical ? start + plankSize * frac : joint + off;
        const ny = vertical ? joint + off : start + plankSize * frac;
        // Faint rust stain streak below nail
        ctx.fillStyle = 'rgba(72, 34, 16, 0.25)';
        ctx.fillRect(nx - 1, ny, 3.5, 8);
        // Dark forged nail head
        ctx.fillStyle = 'rgba(20, 16, 14, 0.85)';
        ctx.beginPath();
        ctx.arc(nx + 0.5, ny + 0.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Sun-bleached top fade & wind-blown desert dust splash along lower edge
  const dust = ctx.createLinearGradient(0, h * 0.64, 0, h);
  dust.addColorStop(0, 'rgba(186, 150, 102, 0)');
  dust.addColorStop(0.7, 'rgba(176, 138, 92, 0.16)');
  dust.addColorStop(1, 'rgba(162, 124, 80, 0.34)');
  ctx.fillStyle = dust;
  ctx.fillRect(0, h * 0.64, w, h * 0.36);

  // Subtle vertical rain/weather streaks
  for (let i = 0; i < 18; i++) {
    const sx = rng() * w;
    const sw = 6 + rng() * 18;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(24, 16, 10, 0.12)');
    g.addColorStop(0.5, 'rgba(24, 16, 10, 0.03)');
    g.addColorStop(1, 'rgba(24, 16, 10, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx, 0, sw, h);
  }

  addSubtleGrain(ctx, w, h, 0.038, 2, rng);
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(Math.max(maxAnisotropy, 1), 8);
  const dynamicTextures: THREE.CanvasTexture[] = [];

  // =========================================================================
  // 1. CORE PBR SET (Weapons, Enemies, Tactical Crates & Contact Shadows)
  // =========================================================================
  const [fCanvas, fCtx] = makeCanvas(512, 512);
  fCtx.fillStyle = '#6c727a';
  fCtx.fillRect(0, 0, 512, 512);
  addSubtleGrain(fCtx, 512, 512, 0.06, 2);
  const floorColor = new THREE.CanvasTexture(fCanvas);
  floorColor.colorSpace = THREE.SRGBColorSpace;
  floorColor.wrapS = THREE.RepeatWrapping;
  floorColor.wrapT = THREE.RepeatWrapping;
  floorColor.anisotropy = aniso;

  const [frCanvas, frCtx] = makeCanvas(256, 256);
  frCtx.fillStyle = '#c8c8c8';
  frCtx.fillRect(0, 0, 256, 256);
  addSubtleGrain(frCtx, 256, 256, 0.14, 2);
  const floorRoughness = new THREE.CanvasTexture(frCanvas);
  floorRoughness.wrapS = THREE.RepeatWrapping;
  floorRoughness.wrapT = THREE.RepeatWrapping;
  floorRoughness.anisotropy = aniso;

  const [cCanvas, cCtx] = makeCanvas(512, 512);
  cCtx.fillStyle = '#b4ab9c';
  cCtx.fillRect(0, 0, 512, 512);
  const cRng = createRng(11);
  for (let i = 0; i < 48; i++) {
    const px = cRng() * 512;
    const py = cRng() * 512;
    const r = 18 + cRng() * 56;
    const g = cCtx.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(92, 84, 72, 0.22)' : 'rgba(222, 214, 198, 0.2)');
    g.addColorStop(1, 'rgba(180, 171, 156, 0)');
    cCtx.fillStyle = g;
    cCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  addSubtleGrain(cCtx, 512, 512, 0.075, 2, cRng);
  const concreteColor = new THREE.CanvasTexture(cCanvas);
  concreteColor.colorSpace = THREE.SRGBColorSpace;
  concreteColor.wrapS = THREE.RepeatWrapping;
  concreteColor.wrapT = THREE.RepeatWrapping;
  concreteColor.anisotropy = aniso;

  const [cbCanvas, cbCtx] = makeCanvas(256, 256);
  cbCtx.fillStyle = '#808080';
  cbCtx.fillRect(0, 0, 256, 256);
  addSubtleGrain(cbCtx, 256, 256, 0.26, 2, createRng(19));
  const concreteBump = new THREE.CanvasTexture(cbCanvas);
  concreteBump.wrapS = THREE.RepeatWrapping;
  concreteBump.wrapT = THREE.RepeatWrapping;
  concreteBump.anisotropy = aniso;

  const [hCanvas, hCtx] = makeCanvas(256, 256);
  hCtx.fillStyle = '#d98f22';
  hCtx.fillRect(0, 0, 256, 256);
  hCtx.fillStyle = '#20252c';
  for (let i = -256; i < 512; i += 64) {
    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + 32, 0);
    hCtx.lineTo(i - 224, 256);
    hCtx.lineTo(i - 256, 256);
    hCtx.closePath();
    hCtx.fill();
  }
  const hazardColor = new THREE.CanvasTexture(hCanvas);
  hazardColor.colorSpace = THREE.SRGBColorSpace;
  hazardColor.wrapS = THREE.RepeatWrapping;
  hazardColor.wrapT = THREE.RepeatWrapping;
  hazardColor.anisotropy = aniso;

  // High-Craft Stenciled Frontier Timber Cargo Crate (Color + Normal)
  const [crCanvas, crCtx] = makeCanvas(512, 512);
  paintWoodPlanks(crCtx, 512, 512, [138, 96, 58], 7, false, 303);
  // Heavy outer timber framing & diagonal brace
  crCtx.strokeStyle = '#5c3c20';
  crCtx.lineWidth = 36;
  crCtx.strokeRect(18, 18, 476, 476);
  crCtx.strokeStyle = '#744e2b';
  crCtx.lineWidth = 24;
  crCtx.beginPath();
  crCtx.moveTo(42, 42);
  crCtx.lineTo(470, 470);
  crCtx.moveTo(470, 42);
  crCtx.lineTo(42, 470);
  crCtx.stroke();
  // Dark recessed frame shadow + iron corner bolts
  crCtx.strokeStyle = 'rgba(20, 12, 6, 0.78)';
  crCtx.lineWidth = 4;
  crCtx.strokeRect(36, 36, 440, 440);
  crCtx.fillStyle = '#24272c';
  for (const [bx, by] of [
    [22, 22],
    [490, 22],
    [22, 490],
    [490, 490],
  ]) {
    crCtx.beginPath();
    crCtx.arc(bx, by, 7, 0, Math.PI * 2);
    crCtx.fill();
  }
  // Subtle weathered cargo stencil
  crCtx.fillStyle = 'rgba(28, 22, 16, 0.42)';
  crCtx.font = 'bold 28px Georgia, serif';
  crCtx.textAlign = 'center';
  crCtx.fillText('WEST CO.', 256, 130);
  const crateColor = new THREE.CanvasTexture(crCanvas);
  crateColor.colorSpace = THREE.SRGBColorSpace;
  crateColor.anisotropy = aniso;

  const [crHCanvas, crHCtx] = makeCanvas(256, 256);
  crHCtx.fillStyle = '#707070';
  crHCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7; i++) {
    crHCtx.fillStyle = '#282828';
    crHCtx.fillRect(0, (i * 256) / 7, 256, 3);
  }
  crHCtx.strokeStyle = '#dcdcdc';
  crHCtx.lineWidth = 18;
  crHCtx.strokeRect(9, 9, 238, 238);
  crHCtx.lineWidth = 12;
  crHCtx.beginPath();
  crHCtx.moveTo(22, 22);
  crHCtx.lineTo(234, 234);
  crHCtx.moveTo(234, 22);
  crHCtx.lineTo(22, 234);
  crHCtx.stroke();
  const crateNormal = heightCanvasToNormalTexture(crHCanvas, 2.2, aniso);

  // Brushed Gunmetal Texture (General props & enemies)
  const [bmCanvas, bmCtx] = makeCanvas(256, 256);
  bmCtx.fillStyle = '#323942';
  bmCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const shade = 44 + Math.floor(Math.random() * 18);
    bmCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
    bmCtx.fillRect(0, y, 256, 1);
  }
  const brushedMetal = new THREE.CanvasTexture(bmCanvas);
  brushedMetal.colorSpace = THREE.SRGBColorSpace;
  brushedMetal.wrapS = THREE.RepeatWrapping;
  brushedMetal.wrapT = THREE.RepeatWrapping;
  brushedMetal.anisotropy = aniso;

  // Soft Radial Contact Shadow Texture
  const [csCanvas, csCtx] = makeCanvas(128, 128);
  const csGrad = csCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  csGrad.addColorStop(0, 'rgba(18, 12, 6, 0.72)');
  csGrad.addColorStop(0.55, 'rgba(18, 12, 6, 0.30)');
  csGrad.addColorStop(1, 'rgba(18, 12, 6, 0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(csCanvas);

  // =========================================================================
  // 2. AAA BATTLE-WORN PARKERIZED GUNMETAL PBR SET (Call of Duty Rifle)
  // =========================================================================
  const [gmCanvas, gmCtx] = makeCanvas(512, 512);
  gmCtx.fillStyle = '#25292e';
  gmCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) {
    const v = 32 + Math.floor(Math.random() * 14);
    gmCtx.fillStyle = `rgba(${v}, ${v + 3}, ${v + 7}, 0.55)`;
    gmCtx.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 65; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const r = 10 + Math.random() * 44;
    const grad = gmCtx.createRadialGradient(px, py, 1, px, py, r);
    const bright = Math.random() > 0.45;
    grad.addColorStop(0, bright ? 'rgba(92, 100, 112, 0.28)' : 'rgba(14, 16, 20, 0.34)');
    grad.addColorStop(1, 'rgba(36, 40, 46, 0)');
    gmCtx.fillStyle = grad;
    gmCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  gmCtx.lineWidth = 1.2;
  for (let i = 0; i < 120; i++) {
    const x1 = Math.random() * 512;
    const y1 = Math.random() * 512;
    const len = 8 + Math.random() * 42;
    const ang = (Math.random() - 0.5) * 0.55;
    gmCtx.strokeStyle = Math.random() > 0.35 ? 'rgba(148, 158, 172, 0.24)' : 'rgba(185, 194, 206, 0.16)';
    gmCtx.beginPath();
    gmCtx.moveTo(x1, y1);
    gmCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    gmCtx.stroke();
  }
  gmCtx.strokeStyle = 'rgba(165, 174, 188, 0.32)';
  gmCtx.lineWidth = 1.5;
  gmCtx.strokeRect(24, 24, 464, 464);
  gmCtx.fillStyle = 'rgba(168, 178, 192, 0.36)';
  gmCtx.font = 'bold 16px monospace';
  gmCtx.fillText('M4A7-09  CAL 5.56', 44, 468);
  gmCtx.beginPath();
  gmCtx.moveTo(438, 444);
  gmCtx.lineTo(458, 474);
  gmCtx.lineTo(418, 474);
  gmCtx.closePath();
  gmCtx.stroke();

  const gunMetalColor = new THREE.CanvasTexture(gmCanvas);
  gunMetalColor.colorSpace = THREE.SRGBColorSpace;
  gunMetalColor.wrapS = THREE.RepeatWrapping;
  gunMetalColor.wrapT = THREE.RepeatWrapping;
  gunMetalColor.anisotropy = aniso;

  const [gmrCanvas, gmrCtx] = makeCanvas(512, 512);
  gmrCtx.fillStyle = '#8e8e8e';
  gmrCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const r = 12 + Math.random() * 48;
    const g = gmrCtx.createRadialGradient(px, py, 2, px, py, r);
    const smoothSpot = Math.random() > 0.4;
    g.addColorStop(0, smoothSpot ? 'rgba(58, 58, 58, 0.65)' : 'rgba(195, 195, 195, 0.45)');
    g.addColorStop(1, 'rgba(142, 142, 142, 0)');
    gmrCtx.fillStyle = g;
    gmrCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const gunMetalRoughness = new THREE.CanvasTexture(gmrCanvas);
  gunMetalRoughness.wrapS = THREE.RepeatWrapping;
  gunMetalRoughness.wrapT = THREE.RepeatWrapping;
  gunMetalRoughness.anisotropy = aniso;

  const [gmbCanvas, gmbCtx] = makeCanvas(512, 512);
  const gmRng = createRng(519);
  gmbCtx.fillStyle = '#808080';
  gmbCtx.fillRect(0, 0, 512, 512);
  // Subtle machined directional milling lines & recessed panel grooves for true normal relief
  for (let y = 0; y < 512; y += 2) {
    const shade = 122 + Math.floor(gmRng() * 14);
    gmbCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
    gmbCtx.fillRect(0, y, 512, 2);
  }
  gmbCtx.strokeStyle = '#3c3c3c';
  gmbCtx.lineWidth = 3;
  gmbCtx.strokeRect(24, 24, 464, 464);
  for (let i = 0; i < 90; i++) {
    const x1 = gmRng() * 512;
    const y1 = gmRng() * 512;
    const len = 10 + gmRng() * 38;
    const ang = (gmRng() - 0.5) * 0.5;
    gmbCtx.strokeStyle = gmRng() > 0.5 ? '#585858' : '#a2a2a2';
    gmbCtx.lineWidth = 1.2;
    gmbCtx.beginPath();
    gmbCtx.moveTo(x1, y1);
    gmbCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    gmbCtx.stroke();
  }
  addSubtleGrain(gmbCtx, 512, 512, 0.16, 2, gmRng);
  const gunMetalBump = new THREE.CanvasTexture(gmbCanvas);
  gunMetalBump.wrapS = THREE.RepeatWrapping;
  gunMetalBump.wrapT = THREE.RepeatWrapping;
  gunMetalBump.anisotropy = aniso;
  const gunMetalNormal = heightCanvasToNormalTexture(gmbCanvas, 1.85, aniso, 1, 1);

  // 2B. Battle-Worn FDE / Coyote-Tan Distressed Military Cerakote Receiver (Color + Roughness + Normal)
  const fdeRng = createRng(623);
  const [fdeCanvas, fdeCtx] = makeCanvas(512, 512);
  const [fdeRCanvas, fdeRCtx] = makeCanvas(512, 512);
  const [fdeHCanvas, fdeHCtx] = makeCanvas(512, 512);

  fdeCtx.fillStyle = '#7c735e';
  fdeCtx.fillRect(0, 0, 512, 512);
  fdeRCtx.fillStyle = '#a8a8a8';
  fdeRCtx.fillRect(0, 0, 512, 512);
  fdeHCtx.fillStyle = '#848484';
  fdeHCtx.fillRect(0, 0, 512, 512);

  // Organic mottled olive-tan / charcoal field-worn camo patches
  for (let i = 0; i < 85; i++) {
    const px = fdeRng() * 512;
    const py = fdeRng() * 512;
    const r = 18 + fdeRng() * 68;
    const g = fdeCtx.createRadialGradient(px, py, 2, px, py, r);
    const kind = i % 4;
    if (kind === 0) {
      g.addColorStop(0, 'rgba(64, 61, 52, 0.48)');
    } else if (kind === 1) {
      g.addColorStop(0, 'rgba(154, 142, 114, 0.42)');
    } else if (kind === 2) {
      g.addColorStop(0, 'rgba(42, 44, 41, 0.42)');
    } else {
      g.addColorStop(0, 'rgba(108, 102, 82, 0.35)');
    }
    g.addColorStop(1, 'rgba(124, 115, 94, 0)');
    fdeCtx.fillStyle = g;
    fdeCtx.fillRect(px - r, py - r, r * 2, r * 2);

    // Matching oil/dust roughness variation
    const rg = fdeRCtx.createRadialGradient(px, py, 2, px, py, r);
    rg.addColorStop(0, kind === 2 ? 'rgba(68, 68, 68, 0.55)' : 'rgba(205, 205, 205, 0.45)');
    rg.addColorStop(1, 'rgba(168, 168, 168, 0)');
    fdeRCtx.fillStyle = rg;
    fdeRCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // Recessed precision receiver panel seams, bevel grooves & flush hex hardware pins
  fdeCtx.strokeStyle = 'rgba(26, 26, 24, 0.72)';
  fdeCtx.lineWidth = 3;
  fdeCtx.strokeRect(20, 20, 472, 472);
  fdeCtx.beginPath();
  fdeCtx.moveTo(20, 172);
  fdeCtx.lineTo(492, 172);
  fdeCtx.moveTo(20, 344);
  fdeCtx.lineTo(492, 344);
  fdeCtx.stroke();

  fdeHCtx.strokeStyle = '#323232';
  fdeHCtx.lineWidth = 4;
  fdeHCtx.strokeRect(20, 20, 472, 472);
  fdeHCtx.beginPath();
  fdeHCtx.moveTo(20, 172);
  fdeHCtx.lineTo(492, 172);
  fdeHCtx.moveTo(20, 344);
  fdeHCtx.lineTo(492, 344);
  fdeHCtx.stroke();

  // Exposed bare steel edge wear & tactical scuff scratches
  for (let i = 0; i < 160; i++) {
    const x1 = fdeRng() * 512;
    const y1 = fdeRng() * 512;
    const len = 6 + fdeRng() * 34;
    const ang = (fdeRng() - 0.5) * 0.8;
    const bareMetal = fdeRng() > 0.48;
    fdeCtx.strokeStyle = bareMetal ? 'rgba(182, 186, 192, 0.34)' : 'rgba(28, 28, 26, 0.38)';
    fdeCtx.lineWidth = 1 + fdeRng() * 1.4;
    fdeCtx.beginPath();
    fdeCtx.moveTo(x1, y1);
    fdeCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    fdeCtx.stroke();

    if (bareMetal) {
      fdeRCtx.strokeStyle = 'rgba(42, 42, 42, 0.75)';
      fdeRCtx.lineWidth = 1.6;
      fdeRCtx.beginPath();
      fdeRCtx.moveTo(x1, y1);
      fdeRCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
      fdeRCtx.stroke();
    }

    fdeHCtx.strokeStyle = bareMetal ? '#525252' : '#9c9c9c';
    fdeHCtx.lineWidth = 1.2;
    fdeHCtx.beginPath();
    fdeHCtx.moveTo(x1, y1);
    fdeHCtx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    fdeHCtx.stroke();
  }

  // Machined hex receiver pins & crisp military laser-etched stencil markings
  for (const [hx, hy] of [
    [68, 86],
    [444, 86],
    [138, 258],
    [374, 258],
    [68, 430],
    [444, 430],
  ]) {
    fdeCtx.fillStyle = '#2b2e31';
    fdeCtx.beginPath();
    fdeCtx.arc(hx, hy, 9, 0, Math.PI * 2);
    fdeCtx.fill();
    fdeCtx.strokeStyle = 'rgba(176, 178, 172, 0.55)';
    fdeCtx.lineWidth = 1.5;
    fdeCtx.stroke();

    fdeHCtx.fillStyle = '#404040';
    fdeHCtx.beginPath();
    fdeHCtx.arc(hx, hy, 10, 0, Math.PI * 2);
    fdeHCtx.fill();
    fdeHCtx.fillStyle = '#b4b4b4';
    fdeHCtx.beginPath();
    fdeHCtx.arc(hx, hy, 5, 0, Math.PI * 2);
    fdeHCtx.fill();
  }

  fdeCtx.fillStyle = 'rgba(214, 208, 186, 0.42)';
  fdeCtx.font = 'bold 15px monospace';
  fdeCtx.fillText('M13-MOD2  5.56 NATO', 48, 326);
  fdeCtx.fillText('SAFE  SEMI  AUTO', 320, 326);
  addSubtleGrain(fdeCtx, 512, 512, 0.06, 2, fdeRng);
  addSubtleGrain(fdeHCtx, 512, 512, 0.14, 2, fdeRng);

  const gunFdeColor = new THREE.CanvasTexture(fdeCanvas);
  gunFdeColor.colorSpace = THREE.SRGBColorSpace;
  gunFdeColor.wrapS = THREE.RepeatWrapping;
  gunFdeColor.wrapT = THREE.RepeatWrapping;
  gunFdeColor.anisotropy = aniso;

  const gunFdeRoughness = new THREE.CanvasTexture(fdeRCanvas);
  gunFdeRoughness.wrapS = THREE.RepeatWrapping;
  gunFdeRoughness.wrapT = THREE.RepeatWrapping;
  gunFdeRoughness.anisotropy = aniso;

  const gunFdeNormal = heightCanvasToNormalTexture(fdeHCanvas, 2.0, aniso, 1, 1);

  // Reflex Optic Dial & PULL Cap
  const [odCanvas, odCtx] = makeCanvas(512, 128);
  odCtx.fillStyle = '#181b20';
  odCtx.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 8) {
    odCtx.fillStyle = x % 16 === 0 ? '#272c34' : '#101216';
    odCtx.fillRect(x, 66, 5, 62);
  }
  odCtx.fillStyle = '#e5ebf2';
  odCtx.font = 'bold 34px monospace';
  odCtx.textAlign = 'center';
  odCtx.textBaseline = 'middle';
  for (let n = 1; n <= 8; n++) {
    const x = ((n - 0.5) / 8) * 512;
    odCtx.fillText(String(n), x, 34);
    odCtx.fillStyle = '#9aa6b4';
    odCtx.fillRect(x - 1, 52, 2, 10);
    odCtx.fillStyle = '#e5ebf2';
  }
  const opticDialColor = new THREE.CanvasTexture(odCanvas);
  opticDialColor.colorSpace = THREE.SRGBColorSpace;
  opticDialColor.wrapS = THREE.RepeatWrapping;
  opticDialColor.anisotropy = aniso;

  const [ocCanvas, ocCtx] = makeCanvas(256, 256);
  ocCtx.fillStyle = '#1a1e24';
  ocCtx.fillRect(0, 0, 256, 256);
  addSubtleGrain(ocCtx, 256, 256, 0.05, 2);
  ocCtx.strokeStyle = 'rgba(180, 190, 205, 0.25)';
  ocCtx.lineWidth = 4;
  ocCtx.strokeRect(10, 10, 236, 236);
  ocCtx.fillStyle = '#d4dce6';
  ocCtx.font = 'bold 30px sans-serif';
  ocCtx.textAlign = 'center';
  ocCtx.fillText('PULL', 128, 92);
  ocCtx.fillStyle = '#f2f5f8';
  ocCtx.fillRect(124, 122, 8, 48);
  ocCtx.beginPath();
  ocCtx.moveTo(110, 168);
  ocCtx.lineTo(146, 168);
  ocCtx.lineTo(128, 198);
  ocCtx.closePath();
  ocCtx.fill();
  const opticCapColor = new THREE.CanvasTexture(ocCanvas);
  opticCapColor.colorSpace = THREE.SRGBColorSpace;
  opticCapColor.anisotropy = aniso;

  // 2C. EOTech-Style Holographic Optic Rear Housing Panel ("S2 MOD NV / SOLOZERO OPTICS")
  const [hhCanvas, hhCtx] = makeCanvas(256, 160);
  hhCtx.fillStyle = '#1d2023';
  hhCtx.fillRect(0, 0, 256, 160);
  addSubtleGrain(hhCtx, 256, 160, 0.055, 2, createRng(671));
  // Recessed dark elastomer control pad with 3 tactile buttons (Up, Down, NV)
  hhCtx.fillStyle = '#141619';
  hhCtx.fillRect(28, 12, 200, 44);
  hhCtx.strokeStyle = 'rgba(140, 146, 152, 0.28)';
  hhCtx.lineWidth = 2;
  hhCtx.strokeRect(28, 12, 200, 44);
  for (const bx of [54, 106, 158]) {
    hhCtx.fillStyle = '#25292e';
    hhCtx.fillRect(bx, 20, 42, 28);
    hhCtx.strokeStyle = 'rgba(170, 176, 184, 0.35)';
    hhCtx.lineWidth = 1.5;
    hhCtx.strokeRect(bx, 20, 42, 28);
  }
  hhCtx.fillStyle = '#bfc6ce';
  hhCtx.font = 'bold 16px monospace';
  hhCtx.textAlign = 'center';
  hhCtx.textBaseline = 'middle';
  hhCtx.fillText('▲', 75, 34);
  hhCtx.fillText('▼', 127, 34);
  hhCtx.fillText('NV', 179, 35);

  // Crisp laser-etched branding matching reference optic
  hhCtx.fillStyle = 'rgba(212, 214, 206, 0.78)';
  hhCtx.font = 'bold 18px sans-serif';
  hhCtx.fillText('S2 MOD  NV', 128, 86);
  hhCtx.fillStyle = 'rgba(196, 198, 190, 0.65)';
  hhCtx.font = 'bold 17px monospace';
  hhCtx.fillText('SOLOZERO', 128, 114);
  hhCtx.font = 'bold 14px monospace';
  hhCtx.fillText('OPTICS', 128, 134);
  const holoHousingBack = new THREE.CanvasTexture(hhCanvas);
  holoHousingBack.colorSpace = THREE.SRGBColorSpace;
  holoHousingBack.anisotropy = aniso;

  // 2D. Holographic EOTech Red-Dot Ring Reticle (65-MOA segmented ring + 1-MOA center dot)
  const [hrCanvas, hrCtx] = makeCanvas(256, 256);
  hrCtx.clearRect(0, 0, 256, 256);
  hrCtx.save();
  hrCtx.translate(128, 128);
  // Subtle red holographic bloom halo
  const hrGlow = hrCtx.createRadialGradient(0, 0, 2, 0, 0, 80);
  hrGlow.addColorStop(0, 'rgba(255, 58, 28, 0.42)');
  hrGlow.addColorStop(0.55, 'rgba(255, 42, 18, 0.16)');
  hrGlow.addColorStop(1, 'rgba(255, 30, 10, 0)');
  hrCtx.fillStyle = hrGlow;
  hrCtx.beginPath();
  hrCtx.arc(0, 0, 80, 0, Math.PI * 2);
  hrCtx.fill();

  // Outer 65-MOA holographic circle with crisp cardinal stadia ticks
  hrCtx.strokeStyle = 'rgba(255, 72, 36, 0.94)';
  hrCtx.lineWidth = 3.2;
  hrCtx.shadowColor = '#ff3814';
  hrCtx.shadowBlur = 8;
  hrCtx.beginPath();
  hrCtx.arc(0, 0, 58, 0, Math.PI * 2);
  hrCtx.stroke();

  hrCtx.lineWidth = 3.8;
  for (const ang of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
    hrCtx.beginPath();
    hrCtx.moveTo(Math.cos(ang) * 46, Math.sin(ang) * 46);
    hrCtx.lineTo(Math.cos(ang) * 70, Math.sin(ang) * 70);
    hrCtx.stroke();
  }

  // Razor-sharp central 1-MOA glowing red dot
  hrCtx.fillStyle = '#ffdfd6';
  hrCtx.beginPath();
  hrCtx.arc(0, 0, 5.2, 0, Math.PI * 2);
  hrCtx.fill();
  hrCtx.fillStyle = '#ff2a14';
  hrCtx.beginPath();
  hrCtx.arc(0, 0, 3.2, 0, Math.PI * 2);
  hrCtx.fill();
  hrCtx.restore();
  const holoReticle = new THREE.CanvasTexture(hrCanvas);
  holoReticle.colorSpace = THREE.SRGBColorSpace;
  holoReticle.anisotropy = aniso;

  // 2E. Precision Sniper/Marksman Optical Scope Lens & Etched Mil-Dot Reticle (matches Image 1!)
  const [slCanvas, slCtx] = makeCanvas(512, 512);
  slCtx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;
  const rLens = 248;

  slCtx.save();
  slCtx.beginPath();
  slCtx.arc(cx, cy, rLens, 0, Math.PI * 2);
  slCtx.clip();

  // Cool teal-blue anti-reflective optical lens tint + realistic deep eye-relief tube shadow vignette
  const lensTint = slCtx.createRadialGradient(cx, cy, rLens * 0.25, cx, cy, rLens);
  lensTint.addColorStop(0, 'rgba(130, 195, 224, 0.04)');
  lensTint.addColorStop(0.58, 'rgba(72, 136, 168, 0.14)');
  lensTint.addColorStop(0.8, 'rgba(22, 52, 68, 0.42)');
  lensTint.addColorStop(0.92, 'rgba(6, 12, 16, 0.88)');
  lensTint.addColorStop(1, 'rgba(2, 4, 6, 0.99)');
  slCtx.fillStyle = lensTint;
  slCtx.fillRect(0, 0, 512, 512);

  // Subtle curved optical glass sheen along upper-left & lower-right rim
  const sheen = slCtx.createLinearGradient(60, 40, 440, 470);
  sheen.addColorStop(0, 'rgba(195, 232, 255, 0.16)');
  sheen.addColorStop(0.32, 'rgba(195, 232, 255, 0.02)');
  sheen.addColorStop(0.75, 'rgba(120, 190, 220, 0.0)');
  sheen.addColorStop(1, 'rgba(165, 222, 245, 0.12)');
  slCtx.fillStyle = sheen;
  slCtx.fillRect(0, 0, 512, 512);

  // Razor-thin etched black ballistic mil-dot crosshairs
  slCtx.strokeStyle = 'rgba(10, 12, 15, 0.92)';
  slCtx.lineWidth = 1.8;
  // Horizontal stadia line
  slCtx.beginPath();
  slCtx.moveTo(0, cy);
  slCtx.lineTo(512, cy);
  // Vertical stadia line
  slCtx.moveTo(cx, 0);
  slCtx.lineTo(cx, 512);
  slCtx.stroke();

  // Horizontal windage ticks
  slCtx.lineWidth = 1.6;
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const tx = cx + i * 36;
    const halfH = i % 2 === 0 ? 7 : 4.5;
    slCtx.beginPath();
    slCtx.moveTo(tx, cy - halfH);
    slCtx.lineTo(tx, cy + halfH);
    slCtx.stroke();
  }

  // Vertical ballistic drop ticks + numbered "3", "6", "9" elevation markings (like Image 1!)
  slCtx.fillStyle = 'rgba(10, 12, 15, 0.92)';
  slCtx.font = 'bold 17px monospace';
  slCtx.textAlign = 'left';
  slCtx.textBaseline = 'middle';
  for (let step = 1; step <= 9; step++) {
    const ty = cy + step * 21;
    const major = step % 3 === 0;
    const halfW = major ? 10 : 5;
    slCtx.lineWidth = major ? 2.0 : 1.5;
    slCtx.beginPath();
    slCtx.moveTo(cx - halfW, ty);
    slCtx.lineTo(cx + halfW, ty);
    slCtx.stroke();
    if (major) {
      slCtx.fillText(String(step), cx + 15, ty + 1);
    }
  }

  // Thick tapered black lower stadia post
  slCtx.fillStyle = 'rgba(8, 10, 12, 0.96)';
  slCtx.fillRect(cx - 3.5, cy + 195, 7, 65);

  // Glowing crimson central aim dot
  const dotGlow = slCtx.createRadialGradient(cx, cy, 1, cx, cy, 14);
  dotGlow.addColorStop(0, 'rgba(255, 235, 220, 1)');
  dotGlow.addColorStop(0.28, 'rgba(255, 42, 24, 0.98)');
  dotGlow.addColorStop(0.65, 'rgba(255, 28, 14, 0.42)');
  dotGlow.addColorStop(1, 'rgba(255, 20, 10, 0)');
  slCtx.fillStyle = dotGlow;
  slCtx.beginPath();
  slCtx.arc(cx, cy, 14, 0, Math.PI * 2);
  slCtx.fill();
  slCtx.restore();

  const scopeLensReticle = new THREE.CanvasTexture(slCanvas);
  scopeLensReticle.colorSpace = THREE.SRGBColorSpace;
  scopeLensReticle.anisotropy = aniso;

  // Tactical Combat Sleeve Ripstop Fabric
  const [tsCanvas, tsCtx] = makeCanvas(256, 256);
  tsCtx.fillStyle = '#43464a';
  tsCtx.fillRect(0, 0, 256, 256);
  tsCtx.strokeStyle = 'rgba(72, 78, 70, 0.36)';
  tsCtx.lineWidth = 1;
  for (let i = 0; i < 256; i += 8) {
    tsCtx.beginPath();
    tsCtx.moveTo(i, 0);
    tsCtx.lineTo(i, 256);
    tsCtx.moveTo(0, i);
    tsCtx.lineTo(256, i);
    tsCtx.stroke();
  }
  const foldGrad = tsCtx.createLinearGradient(0, 0, 256, 180);
  foldGrad.addColorStop(0, 'rgba(14, 16, 14, 0.34)');
  foldGrad.addColorStop(0.4, 'rgba(84, 90, 80, 0.16)');
  foldGrad.addColorStop(0.75, 'rgba(14, 16, 14, 0.30)');
  foldGrad.addColorStop(1, 'rgba(72, 78, 68, 0.14)');
  tsCtx.fillStyle = foldGrad;
  tsCtx.fillRect(0, 0, 256, 256);
  addSubtleGrain(tsCtx, 256, 256, 0.055, 2, createRng(682));
  const tacticalSleeveColor = new THREE.CanvasTexture(tsCanvas);
  tacticalSleeveColor.colorSpace = THREE.SRGBColorSpace;
  tacticalSleeveColor.wrapS = THREE.RepeatWrapping;
  tacticalSleeveColor.wrapT = THREE.RepeatWrapping;
  tacticalSleeveColor.repeat.set(2, 2);
  tacticalSleeveColor.anisotropy = aniso;

  const [tsbCanvas, tsbCtx] = makeCanvas(256, 256);
  tsbCtx.fillStyle = '#808080';
  tsbCtx.fillRect(0, 0, 256, 256);
  tsbCtx.strokeStyle = '#a8a8a8';
  tsbCtx.lineWidth = 1;
  for (let i = 0; i < 256; i += 8) {
    tsbCtx.beginPath();
    tsbCtx.moveTo(i, 0);
    tsbCtx.lineTo(i, 256);
    tsbCtx.moveTo(0, i);
    tsbCtx.lineTo(256, i);
    tsbCtx.stroke();
  }
  const tacticalSleeveBump = new THREE.CanvasTexture(tsbCanvas);
  tacticalSleeveBump.wrapS = THREE.RepeatWrapping;
  tacticalSleeveBump.wrapT = THREE.RepeatWrapping;
  tacticalSleeveBump.repeat.set(2, 2);
  tacticalSleeveBump.anisotropy = aniso;

  // Seamless charcoal leather. Stitching is placed on the actual glove geometry.
  const glvRng = createRng(694);
  const [glvCanvas, glvCtx] = makeCanvas(256, 256);
  const [glvHCanvas, glvHCtx] = makeCanvas(256, 256);
  glvCtx.fillStyle = '#34373a';
  glvCtx.fillRect(0, 0, 256, 256);
  glvHCtx.fillStyle = '#808080';
  glvHCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22000; i++) {
    const x = glvRng()*256, y = glvRng()*256, r = 0.25+glvRng()*0.8;
    glvCtx.fillStyle = glvRng()>0.5 ? 'rgba(12,15,18,0.16)' : 'rgba(126,129,130,0.13)';
    glvCtx.beginPath(); glvCtx.ellipse(x,y,r,r*0.65,glvRng()*Math.PI,0,Math.PI*2); glvCtx.fill();
    glvHCtx.fillStyle = glvRng()>0.5 ? '#909090' : '#747474';
    glvHCtx.fillRect(x,y,r,r);
  }
  addSubtleGrain(glvCtx, 256, 256, 0.06, 2, glvRng);
  addSubtleGrain(glvHCtx, 256, 256, 0.14, 2, glvRng);

  const tacticalGloveColor = new THREE.CanvasTexture(glvCanvas);
  tacticalGloveColor.colorSpace = THREE.SRGBColorSpace;
  tacticalGloveColor.wrapS = THREE.RepeatWrapping;
  tacticalGloveColor.wrapT = THREE.RepeatWrapping;
  tacticalGloveColor.anisotropy = aniso;
  const tacticalGloveNormal = heightCanvasToNormalTexture(glvHCanvas, 1.5, aniso, 1, 1);

  // A shared transparent decal atlas stamps sharp military stencils per weapon/ordnance.
  const [markCanvas, markCtx] = makeCanvas(1024, 768);
  const markingsSpec: Array<{ text: string; color: string; font?: string }> = [
    { text: 'M4A1   CAL. 5.56', color: '#cfd4d0' },
    { text: 'GLOCK 17   AUSTRIA   9x19', color: '#d8dcd8' },
    { text: 'M249   5.56 MM   OZ-0148', color: '#cdd2ce' },
    { text: 'РПГ-7   40 MM', color: '#d8ddd8' },
    { text: 'M67 FRAG', color: '#e6be4a', font: 'bold 42px monospace' },
    { text: 'M84 FLASHBANG', color: '#e2e6df', font: 'bold 38px monospace' },
    { text: 'M18 SMOKE', color: '#eceee6', font: 'bold 44px monospace' },
    { text: 'SCAR 20S   7.62', color: '#2b2419', font: 'bold 34px monospace' },
    { text: 'USP 9   9x19 MM', color: '#dce0dc', font: 'bold 34px monospace' },
    { text: 'HK MP5   CAL. 9MM', color: '#d6dbd6', font: 'bold 34px monospace' },
    { text: 'DESERT EAGLE   .50 AE', color: '#232629', font: 'bold 34px monospace' },
    { text: 'GL-1   40MM', color: '#e5e8e2', font: 'bold 36px monospace' },
  ];
  markingsSpec.forEach(({ text, color, font }, row) => {
    markCtx.font = font ?? 'bold 32px monospace';
    markCtx.fillStyle = color;
    markCtx.fillText(text, 16, row * 64 + 44);
  });
  const weaponMarkings=new THREE.CanvasTexture(markCanvas);
  weaponMarkings.colorSpace=THREE.SRGBColorSpace;
  weaponMarkings.anisotropy=aniso;

  // 2G. Realistic Human Skin PBR Set (Warm Sun-Tanned Complexion, Subsurface Mottling, Fine Pores & Knuckle Creases)
  const skinRng = createRng(709);
  const [skCanvas, skCtx] = makeCanvas(256, 256);
  const [skHCanvas, skHCtx] = makeCanvas(256, 256);
  skCtx.fillStyle = '#c49072';
  skCtx.fillRect(0, 0, 256, 256);
  skHCtx.fillStyle = '#808080';
  skHCtx.fillRect(0, 0, 256, 256);

  // Organic warm-ruddy & sun-tanned dermal tone variations
  for (let i = 0; i < 64; i++) {
    const px = skinRng() * 256;
    const py = skinRng() * 256;
    const r = 16 + skinRng() * 44;
    const g = skCtx.createRadialGradient(px, py, 2, px, py, r);
    const kind = i % 3;
    if (kind === 0) {
      g.addColorStop(0, 'rgba(176, 108, 84, 0.20)'); // Subtle warm bloodflow undertone
    } else if (kind === 1) {
      g.addColorStop(0, 'rgba(218, 174, 144, 0.18)'); // Highlighted sunlit ridge
    } else {
      g.addColorStop(0, 'rgba(148, 104, 78, 0.16)'); // Sun-weathered desert tan
    }
    g.addColorStop(1, 'rgba(196, 144, 114, 0)');
    skCtx.fillStyle = g;
    skCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  // Subtle anatomical skin flexion creases & fine knuckle lines
  for (let i = 0; i < 34; i++) {
    const y = skinRng() * 256;
    const x0 = skinRng() * 140;
    const len = 36 + skinRng() * 96;
    skCtx.strokeStyle = 'rgba(120, 74, 54, 0.16)';
    skCtx.lineWidth = 0.8 + skinRng() * 0.9;
    skCtx.beginPath();
    skCtx.moveTo(x0, y);
    skCtx.quadraticCurveTo(x0 + len * 0.5, y + (skinRng() - 0.5) * 6, x0 + len, y + (skinRng() - 0.5) * 3);
    skCtx.stroke();

    skHCtx.strokeStyle = 'rgba(92, 92, 92, 0.45)';
    skHCtx.lineWidth = 1.0;
    skHCtx.beginPath();
    skHCtx.moveTo(x0, y);
    skHCtx.quadraticCurveTo(x0 + len * 0.5, y + (skinRng() - 0.5) * 6, x0 + len, y + (skinRng() - 0.5) * 3);
    skHCtx.stroke();
  }

  // Fine dermal micro-pores & natural complexion grain
  for (let i = 0; i < 620; i++) {
    const px = skinRng() * 256;
    const py = skinRng() * 256;
    const s = 1 + skinRng() * 1.4;
    skCtx.fillStyle = skinRng() > 0.45 ? 'rgba(138, 92, 68, 0.15)' : 'rgba(228, 190, 162, 0.12)';
    skCtx.fillRect(px, py, s, s);
    skHCtx.fillStyle = skinRng() > 0.5 ? '#707070' : '#909090';
    skHCtx.fillRect(px, py, s, s);
  }

  const humanSkinColor = new THREE.CanvasTexture(skCanvas);
  humanSkinColor.colorSpace = THREE.SRGBColorSpace;
  humanSkinColor.wrapS = THREE.RepeatWrapping;
  humanSkinColor.wrapT = THREE.RepeatWrapping;
  humanSkinColor.repeat.set(2, 2);
  humanSkinColor.anisotropy = aniso;
  const humanSkinNormal = heightCanvasToNormalTexture(skHCanvas, 0.72, aniso, 2, 2);

  // Fiery Volumetric Muzzle Blast Sprite
  const [mfCanvas, mfCtx] = makeCanvas(256, 256);
  mfCtx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const reach = 64 + Math.random() * 52;
    const width = 20 + Math.random() * 24;
    mfCtx.save();
    mfCtx.translate(128, 128);
    mfCtx.rotate(angle);
    const g = mfCtx.createRadialGradient(reach * 0.35, 0, 4, reach * 0.45, 0, reach * 0.72);
    g.addColorStop(0, 'rgba(255, 245, 200, 0.92)');
    g.addColorStop(0.35, 'rgba(255, 178, 56, 0.75)');
    g.addColorStop(0.7, 'rgba(235, 86, 18, 0.38)');
    g.addColorStop(1, 'rgba(180, 32, 0, 0)');
    mfCtx.fillStyle = g;
    mfCtx.beginPath();
    mfCtx.ellipse(reach * 0.42, 0, reach * 0.62, width * 0.52, 0, 0, Math.PI * 2);
    mfCtx.fill();
    mfCtx.restore();
  }
  const coreGrad = mfCtx.createRadialGradient(128, 128, 4, 128, 128, 62);
  coreGrad.addColorStop(0, 'rgba(255, 255, 245, 1)');
  coreGrad.addColorStop(0.32, 'rgba(255, 232, 152, 0.95)');
  coreGrad.addColorStop(0.68, 'rgba(255, 140, 32, 0.55)');
  coreGrad.addColorStop(1, 'rgba(255, 70, 0, 0)');
  mfCtx.fillStyle = coreGrad;
  mfCtx.beginPath();
  mfCtx.arc(128, 128, 62, 0, Math.PI * 2);
  mfCtx.fill();
  const muzzleFlame = new THREE.CanvasTexture(mfCanvas);
  muzzleFlame.colorSpace = THREE.SRGBColorSpace;
  muzzleFlame.anisotropy = aniso;

  // =========================================================================
  // 3. WEST FRONTIER TOWN — REALISTIC HIGH-CRAFT PBR TERRAIN & ARCHITECTURE
  // =========================================================================

  // 3A. Sun-Baked Desert Sand, Wind Ripples & Gravel (Color + Roughness + Normal + Bump)
  const sandRng = createRng(701);
  const [dsCanvas, dsCtx] = makeCanvas(512, 512);
  const [dsbCanvas, dsbCtx] = makeCanvas(512, 512);
  dsCtx.fillStyle = '#c4a26c';
  dsCtx.fillRect(0, 0, 512, 512);
  dsbCtx.fillStyle = '#808080';
  dsbCtx.fillRect(0, 0, 512, 512);

  // Layered desert clay / ochre soil patches
  for (let i = 0; i < 62; i++) {
    const px = sandRng() * 512;
    const py = sandRng() * 512;
    const rad = 26 + sandRng() * 88;
    const g = dsCtx.createRadialGradient(px, py, 2, px, py, rad);
    const tone = i % 3;
    if (tone === 0) {
      g.addColorStop(0, 'rgba(154, 114, 68, 0.36)');
    } else if (tone === 1) {
      g.addColorStop(0, 'rgba(222, 192, 142, 0.32)');
    } else {
      g.addColorStop(0, 'rgba(138, 96, 58, 0.28)');
    }
    g.addColorStop(1, 'rgba(196, 162, 108, 0)');
    dsCtx.fillStyle = g;
    dsCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }

  // Wind-swept sand dune ripples (painted into both color & heightmap for realistic raking normals)
  for (let y = 0; y < 512; y += 12) {
    dsCtx.strokeStyle = 'rgba(128, 94, 54, 0.20)';
    dsCtx.lineWidth = 4.2;
    dsCtx.beginPath();
    dsCtx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 24) {
      dsCtx.lineTo(x, y + Math.sin(x * 0.036 + y * 0.09) * 4.5);
    }
    dsCtx.stroke();

    dsCtx.strokeStyle = 'rgba(242, 218, 174, 0.18)';
    dsCtx.lineWidth = 2.2;
    dsCtx.beginPath();
    dsCtx.moveTo(0, y + 3.2);
    for (let x = 0; x <= 512; x += 24) {
      dsCtx.lineTo(x, y + 3.2 + Math.sin(x * 0.036 + y * 0.09) * 4.5);
    }
    dsCtx.stroke();

    // Matching heightmap ridge & trough
    dsbCtx.strokeStyle = '#484848';
    dsbCtx.lineWidth = 4.5;
    dsbCtx.beginPath();
    dsbCtx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 24) {
      dsbCtx.lineTo(x, y + Math.sin(x * 0.036 + y * 0.09) * 4.5);
    }
    dsbCtx.stroke();

    dsbCtx.strokeStyle = '#bcbcbc';
    dsbCtx.lineWidth = 3.2;
    dsbCtx.beginPath();
    dsbCtx.moveTo(0, y + 3.5);
    for (let x = 0; x <= 512; x += 24) {
      dsbCtx.lineTo(x, y + 3.5 + Math.sin(x * 0.036 + y * 0.09) * 4.5);
    }
    dsbCtx.stroke();
  }

  // Scattered desert pebbles, quartz grit & dry twigs
  for (let i = 0; i < 950; i++) {
    const px = sandRng() * 512;
    const py = sandRng() * 512;
    const s = 1 + sandRng() * 3.1;
    const dark = sandRng() > 0.42;
    dsCtx.fillStyle = dark ? 'rgba(86, 62, 38, 0.48)' : 'rgba(246, 228, 190, 0.38)';
    dsCtx.fillRect(px, py, s, s);
    dsbCtx.fillStyle = dark ? '#b8b8b8' : '#d6d6d6';
    dsbCtx.fillRect(px, py, s, s);
  }
  addSubtleGrain(dsCtx, 512, 512, 0.058, 2, sandRng);
  addSubtleGrain(dsbCtx, 512, 512, 0.16, 2, sandRng);

  const desertSandColor = new THREE.CanvasTexture(dsCanvas);
  desertSandColor.colorSpace = THREE.SRGBColorSpace;
  desertSandColor.wrapS = THREE.RepeatWrapping;
  desertSandColor.wrapT = THREE.RepeatWrapping;
  desertSandColor.repeat.set(38, 38);
  desertSandColor.anisotropy = aniso;

  const desertSandNormal = heightCanvasToNormalTexture(dsbCanvas, 2.0, aniso, 38, 38);

  const desertSandBump = new THREE.CanvasTexture(dsbCanvas);
  desertSandBump.wrapS = THREE.RepeatWrapping;
  desertSandBump.wrapT = THREE.RepeatWrapping;
  desertSandBump.repeat.set(38, 38);
  desertSandBump.anisotropy = aniso;

  const [dsrCanvas, dsrCtx] = makeCanvas(256, 256);
  dsrCtx.fillStyle = '#e2e2e2';
  dsrCtx.fillRect(0, 0, 256, 256);
  addSubtleGrain(dsrCtx, 256, 256, 0.2, 2, createRng(709));
  const desertSandRoughness = new THREE.CanvasTexture(dsrCanvas);
  desertSandRoughness.wrapS = THREE.RepeatWrapping;
  desertSandRoughness.wrapT = THREE.RepeatWrapping;
  desertSandRoughness.repeat.set(38, 38);
  desertSandRoughness.anisotropy = aniso;

  // 3B. Packed Dirt Main Street with Carved Wagon Wheel Ruts & Hoof Scuffs (Color + Normal)
  const roadRng = createRng(802);
  const [drCanvas, drCtx] = makeCanvas(512, 512);
  const [drHCanvas, drHCtx] = makeCanvas(512, 512);
  drCtx.fillStyle = '#af8c58';
  drCtx.fillRect(0, 0, 512, 512);
  drHCtx.fillStyle = '#929292';
  drHCtx.fillRect(0, 0, 512, 512);

  for (const ry of [125, 195, 315, 385]) {
    const rut = drCtx.createLinearGradient(0, ry - 24, 0, ry + 24);
    rut.addColorStop(0, 'rgba(102, 74, 40, 0)');
    rut.addColorStop(0.32, 'rgba(210, 178, 128, 0.22)');
    rut.addColorStop(0.5, 'rgba(90, 64, 34, 0.44)');
    rut.addColorStop(0.68, 'rgba(210, 178, 128, 0.2)');
    rut.addColorStop(1, 'rgba(102, 74, 40, 0)');
    drCtx.fillStyle = rut;
    drCtx.fillRect(0, ry - 24, 512, 48);

    const hRut = drHCtx.createLinearGradient(0, ry - 22, 0, ry + 22);
    hRut.addColorStop(0, '#929292');
    hRut.addColorStop(0.26, '#c8c8c8');
    hRut.addColorStop(0.5, '#383838');
    hRut.addColorStop(0.74, '#c8c8c8');
    hRut.addColorStop(1, '#929292');
    drHCtx.fillStyle = hRut;
    drHCtx.fillRect(0, ry - 22, 512, 44);
  }
  for (let i = 0; i < 65; i++) {
    const px = roadRng() * 512;
    const py = roadRng() * 512;
    const rad = 12 + roadRng() * 38;
    const g = drCtx.createRadialGradient(px, py, 2, px, py, rad);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(84, 60, 32, 0.28)' : 'rgba(218, 186, 134, 0.24)');
    g.addColorStop(1, 'rgba(175, 140, 88, 0)');
    drCtx.fillStyle = g;
    drCtx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 420; i++) {
    const px = roadRng() * 512;
    const py = roadRng() * 512;
    const s = 1.5 + roadRng() * 3.5;
    drCtx.fillStyle = roadRng() > 0.5 ? 'rgba(72, 52, 28, 0.45)' : 'rgba(232, 206, 160, 0.35)';
    drCtx.fillRect(px, py, s, s);
    drHCtx.fillStyle = roadRng() > 0.5 ? '#c8c8c8' : '#5e5e5e';
    drHCtx.fillRect(px, py, s, s);
  }
  addSubtleGrain(drCtx, 512, 512, 0.065, 2, roadRng);
  addSubtleGrain(drHCtx, 512, 512, 0.14, 2, roadRng);

  const dirtRoadColor = new THREE.CanvasTexture(drCanvas);
  dirtRoadColor.colorSpace = THREE.SRGBColorSpace;
  dirtRoadColor.wrapS = THREE.RepeatWrapping;
  dirtRoadColor.wrapT = THREE.RepeatWrapping;
  dirtRoadColor.repeat.set(8, 2);
  dirtRoadColor.anisotropy = aniso;

  const dirtRoadNormal = heightCanvasToNormalTexture(drHCanvas, 2.3, aniso, 8, 2);

  // 3C. Stratified Red-Rock Canyon & Desert Sandstone (Mesas, Buttes & Boulders)
  const rockRng = createRng(912);
  const [rkCanvas, rkCtx] = makeCanvas(512, 512);
  const [rkHCanvas, rkHCtx] = makeCanvas(512, 512);
  rkCtx.fillStyle = '#a8754b';
  rkCtx.fillRect(0, 0, 512, 512);
  rkHCtx.fillStyle = '#808080';
  rkHCtx.fillRect(0, 0, 512, 512);

  // Horizontal geological sandstone strata bands
  const strataPalette = ['#9a613c', '#b77f52', '#c89b6a', '#835032', '#b36f45', '#d0a776'];
  let sy = 0;
  while (sy < 512) {
    const bandH = 12 + rockRng() * 34;
    const col = strataPalette[Math.floor(rockRng() * strataPalette.length)];
    rkCtx.fillStyle = col;
    rkCtx.fillRect(0, sy, 512, bandH);
    const hv = Math.round(70 + rockRng() * 115);
    rkHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    rkHCtx.fillRect(0, sy, 512, bandH);

    // Undulating sedimentary crevice line
    rkCtx.strokeStyle = 'rgba(34, 18, 10, 0.55)';
    rkCtx.lineWidth = 2 + rockRng() * 2.5;
    rkCtx.beginPath();
    rkHCtx.strokeStyle = '#1e1e1e';
    rkHCtx.lineWidth = 3;
    rkHCtx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const yy = sy + Math.sin(x * 0.025 + sy * 0.08) * 5;
      if (x === 0) {
        rkCtx.moveTo(x, yy);
        rkHCtx.moveTo(x, yy);
      } else {
        rkCtx.lineTo(x, yy);
        rkHCtx.lineTo(x, yy);
      }
    }
    rkCtx.stroke();
    rkHCtx.stroke();
    sy += bandH;
  }

  // Vertical erosion fissures & dark weathering streaks
  for (let i = 0; i < 42; i++) {
    const fx = rockRng() * 512;
    const fy = rockRng() * 340;
    const len = 45 + rockRng() * 140;
    rkCtx.strokeStyle = 'rgba(30, 16, 10, 0.38)';
    rkCtx.lineWidth = 1.5 + rockRng() * 2.5;
    rkCtx.beginPath();
    rkCtx.moveTo(fx, fy);
    rkCtx.lineTo(fx + (rockRng() - 0.5) * 14, fy + len);
    rkCtx.stroke();

    rkHCtx.strokeStyle = '#242424';
    rkHCtx.lineWidth = 2.5;
    rkHCtx.beginPath();
    rkHCtx.moveTo(fx, fy);
    rkHCtx.lineTo(fx + (rockRng() - 0.5) * 14, fy + len);
    rkHCtx.stroke();
  }
  addSubtleGrain(rkCtx, 512, 512, 0.08, 2, rockRng);
  addSubtleGrain(rkHCtx, 512, 512, 0.18, 2, rockRng);

  const canyonRockColor = new THREE.CanvasTexture(rkCanvas);
  canyonRockColor.colorSpace = THREE.SRGBColorSpace;
  canyonRockColor.wrapS = THREE.RepeatWrapping;
  canyonRockColor.wrapT = THREE.RepeatWrapping;
  canyonRockColor.repeat.set(3, 2);
  canyonRockColor.anisotropy = aniso;

  const canyonRockNormal = heightCanvasToNormalTexture(rkHCanvas, 2.8, aniso, 3, 2);

  // 3D. High-Craft House Timber Siding (Light Pine, Dark Walnut, Barn-Red Peeling Paint)
  const [wplCanvas, wplCtx] = makeCanvas(512, 512);
  paintWoodPlanks(wplCtx, 512, 512, [148, 106, 66], 10, false, 101, false);
  const woodPlankLightColor = new THREE.CanvasTexture(wplCanvas);
  woodPlankLightColor.colorSpace = THREE.SRGBColorSpace;
  woodPlankLightColor.wrapS = THREE.RepeatWrapping;
  woodPlankLightColor.wrapT = THREE.RepeatWrapping;
  woodPlankLightColor.anisotropy = aniso;

  const [wpdCanvas, wpdCtx] = makeCanvas(512, 512);
  paintWoodPlanks(wpdCtx, 512, 512, [76, 54, 38], 10, false, 202, false);
  const woodPlankDarkColor = new THREE.CanvasTexture(wpdCanvas);
  woodPlankDarkColor.colorSpace = THREE.SRGBColorSpace;
  woodPlankDarkColor.wrapS = THREE.RepeatWrapping;
  woodPlankDarkColor.wrapT = THREE.RepeatWrapping;
  woodPlankDarkColor.anisotropy = aniso;

  const [wprCanvas, wprCtx] = makeCanvas(512, 512);
  paintWoodPlanks(wprCtx, 512, 512, [136, 46, 36], 10, false, 309, true);
  const woodPlankRedColor = new THREE.CanvasTexture(wprCanvas);
  woodPlankRedColor.colorSpace = THREE.SRGBColorSpace;
  woodPlankRedColor.wrapS = THREE.RepeatWrapping;
  woodPlankRedColor.wrapT = THREE.RepeatWrapping;
  woodPlankRedColor.anisotropy = aniso;

  // Deep Wood Plank Height -> True Tangent-Space Normal Map + Roughness Map + Bump Map
  const [wpbCanvas, wpbCtx] = makeCanvas(512, 512);
  const [wprghCanvas, wprghCtx] = makeCanvas(512, 512);
  const wpRng = createRng(411);
  wpbCtx.fillStyle = '#929292';
  wpbCtx.fillRect(0, 0, 512, 512);
  wprghCtx.fillStyle = '#cfcfcf';
  wprghCtx.fillRect(0, 0, 512, 512);

  const pStep = 512 / 10;
  for (let i = 0; i < 10; i++) {
    const y = i * pStep;
    // Slight beveled clapboard slope across each plank
    const bevel = wpbCtx.createLinearGradient(0, y, 0, y + pStep);
    bevel.addColorStop(0, '#c8c8c8');
    bevel.addColorStop(0.85, '#7e7e7e');
    bevel.addColorStop(1, '#202020');
    wpbCtx.fillStyle = bevel;
    wpbCtx.fillRect(0, y + 4, 512, pStep - 4);

    // Deep plank seam groove
    wpbCtx.fillStyle = '#141414';
    wpbCtx.fillRect(0, y, 512, 4);

    // Per-plank roughness variation (rougher in crevices, subtly sheen-worn on faces)
    const rShade = Math.round(188 + (wpRng() - 0.5) * 34);
    wprghCtx.fillStyle = `rgb(${rShade},${rShade},${rShade})`;
    wprghCtx.fillRect(0, y + 4, 512, pStep - 4);
    wprghCtx.fillStyle = '#f5f5f5';
    wprghCtx.fillRect(0, y, 512, 4);

    // Organic wood grain micro-grooves
    for (let s = 0; s < 16; s++) {
      const gy = y + 6 + wpRng() * (pStep - 10);
      wpbCtx.fillStyle = s % 2 === 0 ? 'rgba(42,42,42,0.28)' : 'rgba(218,218,218,0.22)';
      wpbCtx.fillRect(0, gy, 512, 1.6);
    }

    // Cross butt-joint groove
    const joint = ((i * 197 + 91) % (512 - 110)) + 55;
    wpbCtx.fillStyle = '#1c1c1c';
    wpbCtx.fillRect(joint - 1, y, 3, pStep);
  }
  addSubtleGrain(wpbCtx, 512, 512, 0.08, 2, wpRng);

  const woodPlankNormal = heightCanvasToNormalTexture(wpbCanvas, 2.4, aniso);
  const woodPlankBump = new THREE.CanvasTexture(wpbCanvas);
  woodPlankBump.wrapS = THREE.RepeatWrapping;
  woodPlankBump.wrapT = THREE.RepeatWrapping;
  woodPlankBump.anisotropy = aniso;

  const woodPlankRoughness = new THREE.CanvasTexture(wprghCanvas);
  woodPlankRoughness.wrapS = THREE.RepeatWrapping;
  woodPlankRoughness.wrapT = THREE.RepeatWrapping;
  woodPlankRoughness.anisotropy = aniso;

  // 3E. Interior Hardwood Floorboards & Porch Boardwalk Planks (Color + Normal)
  const [wfCanvas, wfCtx] = makeCanvas(512, 512);
  paintWoodPlanks(wfCtx, 512, 512, [126, 88, 54], 12, true, 512, false);
  const woodFloorColor = new THREE.CanvasTexture(wfCanvas);
  woodFloorColor.colorSpace = THREE.SRGBColorSpace;
  woodFloorColor.wrapS = THREE.RepeatWrapping;
  woodFloorColor.wrapT = THREE.RepeatWrapping;
  woodFloorColor.repeat.set(2, 2);
  woodFloorColor.anisotropy = aniso;

  const [wfbCanvas, wfbCtx] = makeCanvas(512, 512);
  wfbCtx.fillStyle = '#909090';
  wfbCtx.fillRect(0, 0, 512, 512);
  const fpStep = 512 / 12;
  for (let i = 0; i < 12; i++) {
    const x = i * fpStep;
    wfbCtx.fillStyle = '#181818';
    wfbCtx.fillRect(x, 0, 3.5, 512);
    wfbCtx.fillStyle = '#bdbdbd';
    wfbCtx.fillRect(x + 3.5, 0, 3, 512);
  }
  addSubtleGrain(wfbCtx, 512, 512, 0.1, 2, createRng(520));
  const woodFloorNormal = heightCanvasToNormalTexture(wfbCanvas, 2.2, aniso, 2, 2);

  // 3F. Weathered Cedar Shake Roof Shingles (Color + Normal + Bump)
  const shRng = createRng(601);
  const [rsCanvas, rsCtx] = makeCanvas(512, 512);
  const [rsbCanvas, rsbCtx] = makeCanvas(512, 512);
  rsCtx.fillStyle = '#5c4b3c';
  rsCtx.fillRect(0, 0, 512, 512);
  rsbCtx.fillStyle = '#808080';
  rsbCtx.fillRect(0, 0, 512, 512);
  const rows = 12;
  const cols = 10;
  const rh = 512 / rows;
  const cw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const sx = c * cw + offset;
      const sy = r * rh;
      const delta = (shRng() - 0.5) * 38;
      const cr = Math.max(24, Math.min(205, Math.round(98 + delta)));
      const cg = Math.max(24, Math.min(205, Math.round(78 + delta * 0.85)));
      const cb = Math.max(24, Math.min(205, Math.round(60 + delta * 0.72)));

      const sg = rsCtx.createLinearGradient(sx, sy, sx, sy + rh);
      sg.addColorStop(0, `rgb(${Math.max(0, cr - 18)},${Math.max(0, cg - 16)},${Math.max(0, cb - 14)})`);
      sg.addColorStop(0.75, `rgb(${cr},${cg},${cb})`);
      sg.addColorStop(1, `rgb(${Math.min(255, cr + 14)},${Math.min(255, cg + 12)},${Math.min(255, cb + 10)})`);
      rsCtx.fillStyle = sg;
      rsCtx.fillRect(sx + 1, sy + 1, cw - 2, rh - 2);

      // Vertical split cedar grain lines on each shake
      rsCtx.strokeStyle = 'rgba(24, 16, 10, 0.25)';
      rsCtx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const gx = sx + 5 + shRng() * (cw - 10);
        rsCtx.beginPath();
        rsCtx.moveTo(gx, sy + 2);
        rsCtx.lineTo(gx + (shRng() - 0.5) * 2, sy + rh - 3);
        rsCtx.stroke();
      }

      rsCtx.strokeStyle = 'rgba(18, 12, 8, 0.78)';
      rsCtx.lineWidth = 2;
      rsCtx.strokeRect(sx, sy, cw, rh);

      // Shingle bottom lap cast shadow
      rsCtx.fillStyle = 'rgba(16, 10, 6, 0.44)';
      rsCtx.fillRect(sx, sy + rh - 5, cw, 5);

      // Matching shingle wedge ramp in heightmap
      const hg = rsbCtx.createLinearGradient(sx, sy, sx, sy + rh);
      hg.addColorStop(0, '#5a5a5a');
      hg.addColorStop(0.86, '#d8d8d8');
      hg.addColorStop(1, '#1a1a1a');
      rsbCtx.fillStyle = hg;
      rsbCtx.fillRect(sx + 2, sy + 1, cw - 4, rh - 2);
      rsbCtx.fillStyle = '#181818';
      rsbCtx.fillRect(sx, sy, 2, rh);
    }
  }
  const roofShingleColor = new THREE.CanvasTexture(rsCanvas);
  roofShingleColor.colorSpace = THREE.SRGBColorSpace;
  roofShingleColor.wrapS = THREE.RepeatWrapping;
  roofShingleColor.wrapT = THREE.RepeatWrapping;
  roofShingleColor.repeat.set(2, 2);
  roofShingleColor.anisotropy = aniso;

  const roofShingleNormal = heightCanvasToNormalTexture(rsbCanvas, 2.5, aniso, 2, 2);
  const roofShingleBump = new THREE.CanvasTexture(rsbCanvas);
  roofShingleBump.wrapS = THREE.RepeatWrapping;
  roofShingleBump.wrapT = THREE.RepeatWrapping;
  roofShingleBump.repeat.set(2, 2);
  roofShingleBump.anisotropy = aniso;

  // 3G. Frontier Aged Brick & Sun-Baked Adobe (Color + Normal + Roughness)
  const brRng = createRng(655);
  const [baCanvas, baCtx] = makeCanvas(512, 512);
  const [baHCanvas, baHCtx] = makeCanvas(512, 512);
  const [baRCanvas, baRCtx] = makeCanvas(512, 512);
  baCtx.fillStyle = '#978774'; // sandy lime mortar
  baCtx.fillRect(0, 0, 512, 512);
  baHCtx.fillStyle = '#282828'; // recessed mortar height
  baHCtx.fillRect(0, 0, 512, 512);
  baRCtx.fillStyle = '#f2f2f2'; // matte mortar
  baRCtx.fillRect(0, 0, 512, 512);

  const bRows = 16;
  const bCols = 8;
  const bh = 512 / bRows;
  const bw = 512 / bCols;
  for (let r = 0; r < bRows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= bCols; c++) {
      const bx = c * bw + off;
      const by = r * bh;
      const d = (brRng() - 0.5) * 42;
      const rr = Math.max(40, Math.min(220, Math.round(148 + d)));
      const rg = Math.max(30, Math.min(180, Math.round(82 + d * 0.62)));
      const rb = Math.max(24, Math.min(150, Math.round(56 + d * 0.48)));

      baCtx.fillStyle = `rgb(${rr}, ${rg}, ${rb})`;
      baCtx.fillRect(bx + 2.5, by + 2.5, bw - 5, bh - 5);

      // Subtle brick firing char / highlight mottling
      baCtx.fillStyle = brRng() > 0.5 ? 'rgba(38, 18, 12, 0.16)' : 'rgba(230, 195, 160, 0.12)';
      baCtx.fillRect(bx + 4, by + 4, (bw - 8) * (0.4 + brRng() * 0.5), bh - 8);

      // Raised brick face in heightmap + rougher/smoother variation
      const hv = Math.round(170 + (brRng() - 0.5) * 45);
      baHCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
      baHCtx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);

      const rv = Math.round(196 + (brRng() - 0.5) * 32);
      baRCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      baRCtx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    }
  }
  addSubtleGrain(baCtx, 512, 512, 0.08, 2, brRng);
  addSubtleGrain(baHCtx, 512, 512, 0.14, 2, brRng);

  const brickAdobeColor = new THREE.CanvasTexture(baCanvas);
  brickAdobeColor.colorSpace = THREE.SRGBColorSpace;
  brickAdobeColor.wrapS = THREE.RepeatWrapping;
  brickAdobeColor.wrapT = THREE.RepeatWrapping;
  brickAdobeColor.anisotropy = aniso;

  const brickAdobeNormal = heightCanvasToNormalTexture(baHCanvas, 2.8, aniso);
  const brickAdobeRoughness = new THREE.CanvasTexture(baRCanvas);
  brickAdobeRoughness.wrapS = THREE.RepeatWrapping;
  brickAdobeRoughness.wrapT = THREE.RepeatWrapping;
  brickAdobeRoughness.anisotropy = aniso;

  // 3H. Prairie Wagon Canvas Cloth
  const [ccCanvas, ccCtx] = makeCanvas(256, 256);
  ccCtx.fillStyle = '#dfd2b8';
  ccCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 6) {
    ccCtx.strokeStyle = 'rgba(130, 114, 88, 0.14)';
    ccCtx.lineWidth = 1;
    ccCtx.beginPath();
    ccCtx.moveTo(i, 0);
    ccCtx.lineTo(i, 256);
    ccCtx.moveTo(0, i);
    ccCtx.lineTo(256, i);
    ccCtx.stroke();
  }
  for (const x of [42, 128, 214]) {
    const g = ccCtx.createLinearGradient(x - 12, 0, x + 12, 0);
    g.addColorStop(0, 'rgba(98, 82, 58, 0)');
    g.addColorStop(0.5, 'rgba(98, 82, 58, 0.25)');
    g.addColorStop(1, 'rgba(98, 82, 58, 0)');
    ccCtx.fillStyle = g;
    ccCtx.fillRect(x - 12, 0, 24, 256);
  }
  const canvasClothColor = new THREE.CanvasTexture(ccCanvas);
  canvasClothColor.colorSpace = THREE.SRGBColorSpace;
  canvasClothColor.anisotropy = aniso;

  // 3I. Golden Hay Bale Texture (Barn & Corral)
  const [hbCanvas, hbCtx] = makeCanvas(256, 256);
  hbCtx.fillStyle = '#c49b44';
  hbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 14 + Math.random() * 28;
    const ang = (Math.random() - 0.5) * 0.4;
    hbCtx.strokeStyle = Math.random() > 0.45 ? '#dfc066' : '#8f6c28';
    hbCtx.lineWidth = 1.6;
    hbCtx.beginPath();
    hbCtx.moveTo(x, y);
    hbCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    hbCtx.stroke();
  }
  hbCtx.fillStyle = '#5c4322';
  hbCtx.fillRect(68, 0, 6, 256);
  hbCtx.fillRect(182, 0, 6, 256);
  const hayBaleColor = new THREE.CanvasTexture(hbCanvas);
  hayBaleColor.colorSpace = THREE.SRGBColorSpace;
  hayBaleColor.anisotropy = aniso;

  // =========================================================================
  // 4. ATMOSPHERIC DUST, SUN CORONA & REALISTIC SURFACE BULLET IMPACT DECALS
  // =========================================================================

  // 4A. Soft Multi-Lobed Volumetric Dust Puff Sprite (for bullet kicks & desert gusts)
  const [dpCanvas, dpCtx] = makeCanvas(256, 256);
  dpCtx.clearRect(0, 0, 256, 256);
  const puffLobes: Array<[number, number, number, number]> = [
    [128, 128, 86, 0.52],
    [94, 114, 62, 0.42],
    [164, 118, 58, 0.40],
    [126, 92, 56, 0.36],
    [116, 154, 58, 0.38],
    [152, 150, 52, 0.34],
  ];
  for (const [lx, ly, lr, alpha] of puffLobes) {
    const g = dpCtx.createRadialGradient(lx, ly, lr * 0.1, lx, ly, lr);
    g.addColorStop(0, `rgba(255, 246, 232, ${alpha})`);
    g.addColorStop(0.55, `rgba(238, 218, 188, ${alpha * 0.52})`);
    g.addColorStop(1, 'rgba(218, 194, 158, 0)');
    dpCtx.fillStyle = g;
    dpCtx.beginPath();
    dpCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    dpCtx.fill();
  }
  const dustPuff = new THREE.CanvasTexture(dpCanvas);
  dustPuff.colorSpace = THREE.SRGBColorSpace;
  dustPuff.anisotropy = aniso;

  // 4B. Sunlit Floating Atmospheric Dust Mote (crisp soft golden bokeh speck)
  const [dmCanvas, dmCtx] = makeCanvas(64, 64);
  dmCtx.clearRect(0, 0, 64, 64);
  const dmGrad = dmCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  dmGrad.addColorStop(0, 'rgba(255, 248, 224, 0.95)');
  dmGrad.addColorStop(0.35, 'rgba(255, 232, 184, 0.55)');
  dmGrad.addColorStop(1, 'rgba(255, 214, 152, 0)');
  dmCtx.fillStyle = dmGrad;
  dmCtx.beginPath();
  dmCtx.arc(32, 32, 30, 0, Math.PI * 2);
  dmCtx.fill();
  const dustMote = new THREE.CanvasTexture(dmCanvas);
  dustMote.colorSpace = THREE.SRGBColorSpace;

  // 4C. Blazing Western Sun Corona & Atmospheric Glare Rays
  const [scCanvas, scCtx] = makeCanvas(256, 256);
  scCtx.clearRect(0, 0, 256, 256);
  const scHalo = scCtx.createRadialGradient(128, 128, 4, 128, 128, 124);
  scHalo.addColorStop(0, 'rgba(255, 255, 242, 1.0)');
  scHalo.addColorStop(0.14, 'rgba(255, 240, 192, 0.85)');
  scHalo.addColorStop(0.36, 'rgba(255, 206, 128, 0.34)');
  scHalo.addColorStop(0.7, 'rgba(255, 168, 86, 0.09)');
  scHalo.addColorStop(1, 'rgba(255, 140, 56, 0)');
  scCtx.fillStyle = scHalo;
  scCtx.fillRect(0, 0, 256, 256);
  // Subtle anamorphic warm sun streak & star rays
  scCtx.save();
  scCtx.translate(128, 128);
  for (let i = 0; i < 6; i++) {
    scCtx.rotate(Math.PI / 6);
    const rg = scCtx.createLinearGradient(-118, 0, 118, 0);
    rg.addColorStop(0, 'rgba(255, 228, 168, 0)');
    rg.addColorStop(0.5, 'rgba(255, 244, 210, 0.22)');
    rg.addColorStop(1, 'rgba(255, 228, 168, 0)');
    scCtx.fillStyle = rg;
    scCtx.fillRect(-118, -3, 236, 6);
  }
  scCtx.restore();
  const sunCorona = new THREE.CanvasTexture(scCanvas);
  sunCorona.colorSpace = THREE.SRGBColorSpace;

  // 4D. Realistic Splintered Wood Bullet Hole Decal
  const [bwCanvas, bwCtx] = makeCanvas(128, 128);
  bwCtx.clearRect(0, 0, 128, 128);
  const bhRng = createRng(991);
  // Outer raw exposed wood splinter streaks (aligned along grain)
  for (let i = 0; i < 16; i++) {
    const ang = (bhRng() - 0.5) * 0.75 + (i % 2 === 0 ? 0 : Math.PI);
    const len = 22 + bhRng() * 34;
    bwCtx.strokeStyle = i % 3 === 0 ? 'rgba(196, 152, 102, 0.78)' : 'rgba(62, 38, 20, 0.75)';
    bwCtx.lineWidth = 1.5 + bhRng() * 2.8;
    bwCtx.beginPath();
    bwCtx.moveTo(64, 64);
    bwCtx.lineTo(64 + Math.cos(ang) * len, 64 + Math.sin(ang) * len * 0.65);
    bwCtx.stroke();
  }
  // Scorch soot halo
  const bwSoot = bwCtx.createRadialGradient(64, 64, 5, 64, 64, 34);
  bwSoot.addColorStop(0, 'rgba(12, 8, 5, 0.96)');
  bwSoot.addColorStop(0.42, 'rgba(34, 22, 14, 0.78)');
  bwSoot.addColorStop(0.75, 'rgba(54, 36, 22, 0.28)');
  bwSoot.addColorStop(1, 'rgba(54, 36, 22, 0)');
  bwCtx.fillStyle = bwSoot;
  bwCtx.beginPath();
  bwCtx.arc(64, 64, 34, 0, Math.PI * 2);
  bwCtx.fill();
  // Jagged dark entry puncture core
  bwCtx.fillStyle = '#090705';
  bwCtx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rad = 10 + bhRng() * 6;
    const px = 64 + Math.cos(a) * rad;
    const py = 64 + Math.sin(a) * rad * 0.85;
    if (i === 0) bwCtx.moveTo(px, py);
    else bwCtx.lineTo(px, py);
  }
  bwCtx.closePath();
  bwCtx.fill();
  const bulletHoleWood = new THREE.CanvasTexture(bwCanvas);
  bulletHoleWood.colorSpace = THREE.SRGBColorSpace;
  bulletHoleWood.anisotropy = aniso;

  // 4E. Realistic Chipped Stone / Brick / Dirt Bullet Impact Crater Decal
  const [bsCanvas, bsCtx] = makeCanvas(128, 128);
  bsCtx.clearRect(0, 0, 128, 128);
  const bsRng = createRng(992);
  // Dusty powdered impact halo
  const bsHalo = bsCtx.createRadialGradient(64, 64, 10, 64, 64, 54);
  bsHalo.addColorStop(0, 'rgba(28, 22, 18, 0.92)');
  bsHalo.addColorStop(0.35, 'rgba(168, 146, 118, 0.65)');
  bsHalo.addColorStop(0.72, 'rgba(186, 162, 130, 0.26)');
  bsHalo.addColorStop(1, 'rgba(186, 162, 130, 0)');
  bsCtx.fillStyle = bsHalo;
  bsCtx.beginPath();
  bsCtx.arc(64, 64, 54, 0, Math.PI * 2);
  bsCtx.fill();
  // Radiating fracture cracks
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + (bsRng() - 0.5) * 0.45;
    const len = 24 + bsRng() * 28;
    bsCtx.strokeStyle = 'rgba(22, 18, 14, 0.78)';
    bsCtx.lineWidth = 1.6;
    bsCtx.beginPath();
    bsCtx.moveTo(64 + Math.cos(ang) * 8, 64 + Math.sin(ang) * 8);
    bsCtx.lineTo(
      64 + Math.cos(ang + 0.14) * (len * 0.55),
      64 + Math.sin(ang + 0.14) * (len * 0.55),
    );
    bsCtx.lineTo(64 + Math.cos(ang) * len, 64 + Math.sin(ang) * len);
    bsCtx.stroke();
  }
  // Deep shadowed bullet cavity
  bsCtx.fillStyle = '#120f0c';
  bsCtx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 11 + bsRng() * 5;
    if (i === 0) bsCtx.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    else bsCtx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  bsCtx.closePath();
  bsCtx.fill();
  const bulletHoleStone = new THREE.CanvasTexture(bsCanvas);
  bulletHoleStone.colorSpace = THREE.SRGBColorSpace;
  bulletHoleStone.anisotropy = aniso;

  // 4F. Realistic Metallic Bullet Dent & Bright Scraped Rim Decal
  const [bmhCanvas, bmhCtx] = makeCanvas(128, 128);
  bmhCtx.clearRect(0, 0, 128, 128);
  const bmRim = bmhCtx.createRadialGradient(64, 64, 8, 64, 64, 34);
  bmRim.addColorStop(0, 'rgba(10, 12, 16, 0.98)');
  bmRim.addColorStop(0.38, 'rgba(20, 24, 30, 0.92)');
  bmRim.addColorStop(0.54, 'rgba(224, 232, 242, 0.88)');
  bmRim.addColorStop(0.72, 'rgba(92, 98, 108, 0.42)');
  bmRim.addColorStop(1, 'rgba(40, 44, 52, 0)');
  bmhCtx.fillStyle = bmRim;
  bmhCtx.beginPath();
  bmhCtx.arc(64, 64, 34, 0, Math.PI * 2);
  bmhCtx.fill();
  // Short metallic gouge scratches
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    bmhCtx.strokeStyle = 'rgba(235, 242, 250, 0.65)';
    bmhCtx.lineWidth = 1.6;
    bmhCtx.beginPath();
    bmhCtx.moveTo(64 + Math.cos(a) * 14, 64 + Math.sin(a) * 14);
    bmhCtx.lineTo(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28);
    bmhCtx.stroke();
  }
  const bulletHoleMetal = new THREE.CanvasTexture(bmhCanvas);
  bulletHoleMetal.colorSpace = THREE.SRGBColorSpace;
  bulletHoleMetal.anisotropy = aniso;

  // 4G. Authentic Painted Western Storefront Fascia Sign Generator
  const createSignTexture = (
    title: string,
    subtitle?: string,
    variant: 'dark' | 'cream' | 'red' = 'dark',
  ): THREE.CanvasTexture => {
    const [sCanvas, sCtx] = makeCanvas(512, 160);
    if (variant === 'cream') {
      sCtx.fillStyle = '#e5d4b2';
    } else if (variant === 'red') {
      sCtx.fillStyle = '#4e1a16';
    } else {
      sCtx.fillStyle = '#231912';
    }
    sCtx.fillRect(0, 0, 512, 160);

    // Subtle wood plank seams behind lettering
    sCtx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    sCtx.lineWidth = 2;
    for (const y of [40, 80, 120]) {
      sCtx.beginPath();
      sCtx.moveTo(0, y);
      sCtx.lineTo(512, y);
      sCtx.stroke();
    }

    // Double ornamental frontier border
    const borderCol = variant === 'cream' ? '#2c1e14' : '#d6b274';
    sCtx.strokeStyle = borderCol;
    sCtx.lineWidth = 6;
    sCtx.strokeRect(8, 8, 496, 144);
    sCtx.lineWidth = 2;
    sCtx.strokeRect(18, 18, 476, 124);

    // Corner decorative studs
    sCtx.fillStyle = borderCol;
    for (const cx of [28, 484]) {
      for (const cy of [28, 132]) {
        sCtx.beginPath();
        sCtx.arc(cx, cy, 4, 0, Math.PI * 2);
        sCtx.fill();
      }
    }

    // Bold Western Serif Typography
    sCtx.fillStyle = variant === 'cream' ? '#24170e' : '#f4e4c1';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    const fontSize = title.length > 14 ? 42 : title.length > 10 ? 50 : 58;
    sCtx.font = `900 ${fontSize}px Georgia, "Times New Roman", serif`;
    sCtx.fillText(title, 256, subtitle ? 68 : 82, 444);

    if (subtitle) {
      sCtx.fillStyle = variant === 'cream' ? '#5c3c22' : '#d8b472';
      sCtx.font = 'bold 20px Georgia, serif';
      sCtx.fillText(subtitle, 256, 118, 420);
    }

    addSubtleGrain(sCtx, 512, 160, 0.045, 2);

    const tex = new THREE.CanvasTexture(sCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    dynamicTextures.push(tex);
    return tex;
  };

  // =========================================================================
  // 5. 10 KM² BATTLE ROYALE ISLAND — HIGH-FIDELITY FIELD TURF & PBR VEGETATION
  // =========================================================================
  const fieldRng = createRng(88412);
  const [itCanvas, itCtx] = makeCanvas(1024, 1024);
  const [itHCanvas, itHCtx] = makeCanvas(1024, 1024);
  const [itRCanvas, itRCtx] = makeCanvas(1024, 1024);

  // Layer 0: Bright neutral meadow foundation (avoids darkening snow caps or beach sand when multiplied by vertex biome colors)
  itCtx.fillStyle = '#bcc6af';
  itCtx.fillRect(0, 0, 1024, 1024);
  itHCtx.fillStyle = '#787878';
  itHCtx.fillRect(0, 0, 1024, 1024);
  itRCtx.fillStyle = '#e8e8e8';
  itRCtx.fillRect(0, 0, 1024, 1024);

  // Layer 1: Soil mottling, soft meadow undertones & organic moisture swales
  for (let i = 0; i < 680; i++) {
    const cx = fieldRng() * 1024;
    const cy = fieldRng() * 1024;
    const rad = 14 + fieldRng() * 42;
    const kind = fieldRng();
    const g = itCtx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    if (kind < 0.38) {
      g.addColorStop(0, 'rgba(138, 174, 122, 0.38)');
      g.addColorStop(1, 'rgba(138, 174, 122, 0)');
    } else if (kind < 0.72) {
      g.addColorStop(0, 'rgba(218, 210, 168, 0.36)');
      g.addColorStop(1, 'rgba(218, 210, 168, 0)');
    } else {
      g.addColorStop(0, 'rgba(148, 140, 124, 0.30)');
      g.addColorStop(1, 'rgba(148, 140, 124, 0)');
    }
    itCtx.fillStyle = g;
    itCtx.beginPath();
    itCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    itCtx.fill();

    const hVal = kind < 0.72 ? 168 : 88;
    itHCtx.fillStyle = `rgba(${hVal}, ${hVal}, ${hVal}, 0.3)`;
    itHCtx.beginPath();
    itHCtx.arc(cx, cy, rad * 0.75, 0, Math.PI * 2);
    itHCtx.fill();
  }

  // Layer 2: 9,000+ Individual interwoven natural grass blades & thatch stalks
  for (let i = 0; i < 9200; i++) {
    const gx = fieldRng() * 1024;
    const gy = fieldRng() * 1024;
    const bladeLen = 6 + fieldRng() * 14;
    const bladeAngle = -Math.PI * 0.5 + (fieldRng() - 0.5) * 1.35;
    const tx = gx + Math.cos(bladeAngle) * bladeLen;
    const ty = gy + Math.sin(bladeAngle) * bladeLen;

    const shade = fieldRng();
    if (shade < 0.32) {
      itCtx.strokeStyle = 'rgba(136, 168, 114, 0.65)';
    } else if (shade < 0.72) {
      itCtx.strokeStyle = 'rgba(178, 208, 146, 0.72)';
    } else if (shade < 0.88) {
      itCtx.strokeStyle = 'rgba(216, 212, 164, 0.66)';
    } else {
      itCtx.strokeStyle = 'rgba(240, 236, 198, 0.60)';
    }
    itCtx.lineWidth = 1.0 + fieldRng() * 1.3;
    itCtx.beginPath();
    itCtx.moveTo(gx, gy);
    itCtx.lineTo(tx, ty);
    itCtx.stroke();

    // Height relief for normal mapping (prominent blade ridge)
    const bh = shade > 0.35 ? 225 : 120;
    itHCtx.strokeStyle = `rgba(${bh}, ${bh}, ${bh}, 0.55)`;
    itHCtx.lineWidth = 1.2;
    itHCtx.beginPath();
    itHCtx.moveTo(gx, gy);
    itHCtx.lineTo(tx, ty);
    itHCtx.stroke();

    // Waxy specular sheen on sunlit grass blades
    const br = shade > 0.5 ? 140 : 210;
    itRCtx.strokeStyle = `rgba(${br}, ${br}, ${br}, 0.48)`;
    itRCtx.lineWidth = 1.1;
    itRCtx.beginPath();
    itRCtx.moveTo(gx, gy);
    itRCtx.lineTo(tx, ty);
    itRCtx.stroke();
  }

  // Layer 3: Wild clover stars, gravel pebbles & earth crumbs
  for (let i = 0; i < 750; i++) {
    const px = fieldRng() * 1024;
    const py = fieldRng() * 1024;
    const pr = 1.2 + fieldRng() * 2.8;
    itCtx.fillStyle = fieldRng() > 0.4 ? 'rgba(128, 118, 102, 0.75)' : 'rgba(215, 205, 165, 0.7)';
    itCtx.beginPath();
    itCtx.arc(px, py, pr, 0, Math.PI * 2);
    itCtx.fill();

    itHCtx.fillStyle = 'rgba(245, 245, 245, 0.75)';
    itHCtx.beginPath();
    itHCtx.arc(px, py, pr, 0, Math.PI * 2);
    itHCtx.fill();
  }

  addSubtleGrain(itCtx, 1024, 1024, 0.05, 2, fieldRng);
  addSubtleGrain(itHCtx, 1024, 1024, 0.07, 2, fieldRng);

  const islandRepeat = 1;
  const islandTerrainColor = new THREE.CanvasTexture(itCanvas);
  islandTerrainColor.colorSpace = THREE.SRGBColorSpace;
  islandTerrainColor.wrapS = THREE.RepeatWrapping;
  islandTerrainColor.wrapT = THREE.RepeatWrapping;
  islandTerrainColor.repeat.set(islandRepeat, islandRepeat);
  islandTerrainColor.anisotropy = aniso;

  const islandTerrainNormal = heightCanvasToNormalTexture(itHCanvas, 3.4, aniso, islandRepeat, islandRepeat);
  const islandTerrainRoughness = new THREE.CanvasTexture(itRCanvas);
  islandTerrainRoughness.wrapS = THREE.RepeatWrapping;
  islandTerrainRoughness.wrapT = THREE.RepeatWrapping;
  islandTerrainRoughness.repeat.set(islandRepeat, islandRepeat);
  islandTerrainRoughness.anisotropy = aniso;

  // 5B. Sunlit Stylized Conifer Needle Texture & Normal Map
  const [pnCanvas, pnCtx] = makeCanvas(512, 512);
  const [pnHCanvas, pnHCtx] = makeCanvas(512, 512);
  pnCtx.fillStyle = '#4c7e3a';
  pnCtx.fillRect(0, 0, 512, 512);
  pnHCtx.fillStyle = '#808080';
  pnHCtx.fillRect(0, 0, 512, 512);

  const pineRng = createRng(44192);
  for (let i = 0; i < 4800; i++) {
    const px = pineRng() * 512;
    const py = pineRng() * 512;
    const nLen = 8 + pineRng() * 16;
    const nAng = (pineRng() - 0.5) * 2.8;
    const tx = px + Math.cos(nAng) * nLen;
    const ty = py + Math.sin(nAng) * nLen;

    const nColor = pineRng();
    if (nColor < 0.4) pnCtx.strokeStyle = '#3c6e2c';
    else if (nColor < 0.75) pnCtx.strokeStyle = '#538e3d';
    else if (nColor < 0.9) pnCtx.strokeStyle = '#6da64f';
    else pnCtx.strokeStyle = '#86bf65';

    pnCtx.lineWidth = 1.2 + pineRng() * 0.8;
    pnCtx.beginPath();
    pnCtx.moveTo(px, py);
    pnCtx.lineTo(tx, ty);
    pnCtx.stroke();

    const nh = nColor > 0.5 ? 210 : 130;
    pnHCtx.strokeStyle = `rgba(${nh}, ${nh}, ${nh}, 0.6)`;
    pnHCtx.lineWidth = 1.2;
    pnHCtx.beginPath();
    pnHCtx.moveTo(px, py);
    pnHCtx.lineTo(tx, ty);
    pnHCtx.stroke();
  }
  const pineNeedlesColor = new THREE.CanvasTexture(pnCanvas);
  pineNeedlesColor.colorSpace = THREE.SRGBColorSpace;
  pineNeedlesColor.wrapS = THREE.RepeatWrapping;
  pineNeedlesColor.wrapT = THREE.RepeatWrapping;
  pineNeedlesColor.repeat.set(4, 4);
  pineNeedlesColor.anisotropy = aniso;

  const pineNeedlesNormal = heightCanvasToNormalTexture(pnHCanvas, 3.2, aniso, 4, 4);

  // 5C. Stylized Sunny Deciduous Leaf Canopy Texture & Normal Map
  const [lcCanvas, lcCtx] = makeCanvas(512, 512);
  const [lcHCanvas, lcHCtx] = makeCanvas(512, 512);
  lcCtx.fillStyle = '#548f38';
  lcCtx.fillRect(0, 0, 512, 512);
  lcHCtx.fillStyle = '#808080';
  lcHCtx.fillRect(0, 0, 512, 512);

  const leafRng = createRng(77218);
  for (let i = 0; i < 1400; i++) {
    const lx = leafRng() * 512;
    const ly = leafRng() * 512;
    const lr = 7 + leafRng() * 14;
    const lShade = leafRng();
    const lg = lcCtx.createRadialGradient(lx, ly, 2, lx, ly, lr);
    if (lShade < 0.35) {
      lg.addColorStop(0, '#6aa944');
      lg.addColorStop(1, '#477a2e');
    } else if (lShade < 0.75) {
      lg.addColorStop(0, '#7fc252');
      lg.addColorStop(1, '#558e36');
    } else {
      lg.addColorStop(0, '#9bd96a');
      lg.addColorStop(1, '#68a441');
    }
    lcCtx.fillStyle = lg;
    lcCtx.beginPath();
    lcCtx.arc(lx, ly, lr, 0, Math.PI * 2);
    lcCtx.fill();

    lcHCtx.fillStyle = `rgba(${170 + Math.floor(lShade * 70)}, ${170 + Math.floor(lShade * 70)}, ${170 + Math.floor(lShade * 70)}, 0.4)`;
    lcHCtx.beginPath();
    lcHCtx.arc(lx, ly, lr * 0.8, 0, Math.PI * 2);
    lcHCtx.fill();
  }
  const leafCanopyColor = new THREE.CanvasTexture(lcCanvas);
  leafCanopyColor.colorSpace = THREE.SRGBColorSpace;
  leafCanopyColor.wrapS = THREE.RepeatWrapping;
  leafCanopyColor.wrapT = THREE.RepeatWrapping;
  leafCanopyColor.repeat.set(3, 3);
  leafCanopyColor.anisotropy = aniso;

  const leafCanopyNormal = heightCanvasToNormalTexture(lcHCanvas, 2.8, aniso, 3, 3);

  // 5D. 3D Field Grass Tuft Texture with Alpha Masking
  const [gtCanvas, gtCtx] = makeCanvas(256, 256);
  gtCtx.clearRect(0, 0, 256, 256);
  const tuftRng = createRng(66319);
  for (let i = 0; i < 48; i++) {
    const bx = 128 + (tuftRng() - 0.5) * 54;
    const by = 250;
    const tLen = 140 + tuftRng() * 95;
    const spread = (tuftRng() - 0.5) * 110;
    const curve = (tuftRng() - 0.5) * 45;

    const bladeGrad = gtCtx.createLinearGradient(bx, by, bx + spread, by - tLen);
    bladeGrad.addColorStop(0, '#2d4d24');
    bladeGrad.addColorStop(0.5, '#4f8a37');
    bladeGrad.addColorStop(1, '#98b866');

    gtCtx.strokeStyle = bladeGrad;
    gtCtx.lineWidth = 3.2 - (i / 48) * 1.2;
    gtCtx.beginPath();
    gtCtx.moveTo(bx, by);
    gtCtx.quadraticCurveTo(bx + curve, by - tLen * 0.55, bx + spread, by - tLen);
    gtCtx.stroke();
  }
  const grassTuftColor = new THREE.CanvasTexture(gtCanvas);
  grassTuftColor.colorSpace = THREE.SRGBColorSpace;
  islandTerrainRoughness.anisotropy = aniso;

  // 5B. Surrounding 3D Ocean Water Ripple Texture & Normal Map
  const waterRng = createRng(99214);
  const [owCanvas, owCtx] = makeCanvas(256, 256);
  const [owHCanvas, owHCtx] = makeCanvas(256, 256);
  owCtx.fillStyle = '#1b729c';
  owCtx.fillRect(0, 0, 256, 256);
  owHCtx.fillStyle = '#808080';
  owHCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const wx = waterRng() * 256;
    const wy = waterRng() * 256;
    const wLen = 14 + waterRng() * 26;
    owCtx.strokeStyle = waterRng() > 0.45 ? 'rgba(92, 188, 228, 0.25)' : 'rgba(14, 68, 96, 0.28)';
    owCtx.lineWidth = 1.5 + waterRng() * 1.8;
    owCtx.beginPath();
    owCtx.moveTo(wx, wy);
    owCtx.quadraticCurveTo(wx + wLen * 0.5, wy - 3 + waterRng() * 6, wx + wLen, wy);
    owCtx.stroke();

    const wh = waterRng() > 0.45 ? 210 : 55;
    owHCtx.strokeStyle = `rgba(${wh}, ${wh}, ${wh}, 0.36)`;
    owHCtx.lineWidth = 2.2;
    owHCtx.beginPath();
    owHCtx.moveTo(wx, wy);
    owHCtx.quadraticCurveTo(wx + wLen * 0.5, wy - 3 + waterRng() * 6, wx + wLen, wy);
    owHCtx.stroke();
  }

  const oceanRepeat = 110;
  const oceanWaterColor = new THREE.CanvasTexture(owCanvas);
  oceanWaterColor.colorSpace = THREE.SRGBColorSpace;
  oceanWaterColor.wrapS = THREE.RepeatWrapping;
  oceanWaterColor.wrapT = THREE.RepeatWrapping;
  oceanWaterColor.repeat.set(oceanRepeat, oceanRepeat);
  oceanWaterColor.anisotropy = aniso;

  const oceanWaterNormal = heightCanvasToNormalTexture(owHCanvas, 2.4, aniso, oceanRepeat, oceanRepeat);

  return {
    floorColor,
    floorRoughness,
    concreteColor,
    concreteBump,
    hazardColor,
    crateColor,
    crateNormal,
    brushedMetal,
    contactShadow,
    gunMetalColor,
    gunMetalRoughness,
    gunMetalBump,
    gunMetalNormal,
    gunFdeColor,
    gunFdeRoughness,
    gunFdeNormal,
    opticDialColor,
    opticCapColor,
    holoHousingBack,
    holoReticle,
    scopeLensReticle,
    tacticalSleeveColor,
    tacticalSleeveBump,
    tacticalGloveColor,
    tacticalGloveNormal,
    weaponMarkings,
    humanSkinColor,
    humanSkinNormal,
    muzzleFlame,
    desertSandColor,
    desertSandRoughness,
    desertSandNormal,
    desertSandBump,
    dirtRoadColor,
    dirtRoadNormal,
    canyonRockColor,
    canyonRockNormal,
    woodPlankLightColor,
    woodPlankDarkColor,
    woodPlankRedColor,
    woodPlankNormal,
    woodPlankRoughness,
    woodPlankBump,
    woodFloorColor,
    woodFloorNormal,
    roofShingleColor,
    roofShingleNormal,
    roofShingleBump,
    brickAdobeColor,
    brickAdobeNormal,
    brickAdobeRoughness,
    canvasClothColor,
    hayBaleColor,
    dustPuff,
    dustMote,
    sunCorona,
    bulletHoleWood,
    bulletHoleStone,
    bulletHoleMetal,
    islandTerrainColor,
    islandTerrainNormal,
    islandTerrainRoughness,
    oceanWaterColor,
    oceanWaterNormal,
    pineNeedlesColor,
    pineNeedlesNormal,
    leafCanopyColor,
    leafCanopyNormal,
    grassTuftColor,
    createSignTexture,
    dispose: () => {
      floorColor.dispose();
      floorRoughness.dispose();
      concreteColor.dispose();
      concreteBump.dispose();
      hazardColor.dispose();
      crateColor.dispose();
      crateNormal.dispose();
      brushedMetal.dispose();
      contactShadow.dispose();
      gunMetalColor.dispose();
      gunMetalRoughness.dispose();
      gunMetalBump.dispose();
      gunMetalNormal.dispose();
      gunFdeColor.dispose();
      gunFdeRoughness.dispose();
      gunFdeNormal.dispose();
      opticDialColor.dispose();
      opticCapColor.dispose();
      holoHousingBack.dispose();
      holoReticle.dispose();
      scopeLensReticle.dispose();
      tacticalSleeveColor.dispose();
      tacticalSleeveBump.dispose();
      tacticalGloveColor.dispose();
      tacticalGloveNormal.dispose();
      weaponMarkings.dispose();
      humanSkinColor.dispose();
      humanSkinNormal.dispose();
      muzzleFlame.dispose();
      desertSandColor.dispose();
      desertSandRoughness.dispose();
      desertSandNormal.dispose();
      desertSandBump.dispose();
      dirtRoadColor.dispose();
      dirtRoadNormal.dispose();
      canyonRockColor.dispose();
      canyonRockNormal.dispose();
      woodPlankLightColor.dispose();
      woodPlankDarkColor.dispose();
      woodPlankRedColor.dispose();
      woodPlankNormal.dispose();
      woodPlankRoughness.dispose();
      woodPlankBump.dispose();
      woodFloorColor.dispose();
      woodFloorNormal.dispose();
      roofShingleColor.dispose();
      roofShingleNormal.dispose();
      roofShingleBump.dispose();
      brickAdobeColor.dispose();
      brickAdobeNormal.dispose();
      brickAdobeRoughness.dispose();
      canvasClothColor.dispose();
      hayBaleColor.dispose();
      dustPuff.dispose();
      dustMote.dispose();
      sunCorona.dispose();
      bulletHoleWood.dispose();
      bulletHoleStone.dispose();
      bulletHoleMetal.dispose();
      islandTerrainColor.dispose();
      islandTerrainNormal.dispose();
      islandTerrainRoughness.dispose();
      oceanWaterColor.dispose();
      oceanWaterNormal.dispose();
      pineNeedlesColor.dispose();
      pineNeedlesNormal.dispose();
      leafCanopyColor.dispose();
      leafCanopyNormal.dispose();
      grassTuftColor.dispose();
      dynamicTextures.forEach((t) => t.dispose());
    },
  };
}
