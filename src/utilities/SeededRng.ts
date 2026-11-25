/**
 * Deterministic seeded pseudo-random generator & procedural noise toolkit
 * for reproducible terrain, biomes, POIs, vegetation, loot, and storm circles.
 */

export class SeededRng {
  private state: number;

  constructor(seed = 2026079) {
    this.state = seed >>> 0 || 1;
  }

  /** Returns a uniform float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Returns integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Picks one item deterministically from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  if (Math.abs(span) < 1e-8) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / span, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic 2D hash returning [0, 1]. */
export function hash2D(ix: number, iz: number, seed = 1337): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Smooth 2D value noise in [-1, 1]. */
export function valueNoise2D(x: number, z: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);

  const v = lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
  return v * 2 - 1;
}

/** Multi-octave fractional Brownian motion in [-1, 1]. */
export function fbm2D(
  x: number,
  z: number,
  octaves = 4,
  lacunarity = 2.05,
  gain = 0.48,
  seed = 1337,
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + i * 97);
    norm += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Ridged multifractal noise in [0, 1] for mountain crests and cliff ridges. */
export function ridgedNoise2D(x: number, z: number, octaves = 4, seed = 4099): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2D(x * freq, z * freq, seed + i * 131));
    sum += amp * n * n;
    norm += amp;
    freq *= 2.12;
    amp *= 0.48;
  }
  return norm > 0 ? sum / norm : 0;
}
