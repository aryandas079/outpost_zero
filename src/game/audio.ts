import * as THREE from 'three';
import {
  AudioDynamicRangePreset,
  computeEnemyFootstepMix,
  getAudioDynamicRangeSpec,
} from './audioCompression';

export type FootstepSurface = 'concrete' | 'metal' | 'glass' | 'wood' | 'dirt';

interface AmbientNodeEntry {
  kind: 'wind' | 'mech' | 'turbine';
  anchor: THREE.Object3D;
  audio: THREE.PositionalAudio;
  filter: BiquadFilterNode;
  baseVolume: number;
  baseFreq: number;
  phase: number;
}

export class TacticalAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private footstepBanks: Record<FootstepSurface, AudioBuffer[]> | null = null;
  private lastVariantIdx: Record<FootstepSurface, number> = {
    concrete: -1,
    metal: -1,
    glass: -1,
    wood: -1,
    dirt: -1,
  };
  private footParity = 1;
  private muted = false;
  private dynamicRange: AudioDynamicRangePreset = 'balanced';

  // Master Dynamic Range Compression Bus Graph
  private loudBus: GainNode | null = null;
  private subtleBus: GainNode | null = null;
  private subtlePresenceFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private makeupGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  // Three.js PositionalAudio Spatial Ambient Engine
  private listener: THREE.AudioListener | null = null;
  private listenerCamera: THREE.Camera | null = null;
  private ambientRoot: THREE.Group | null = null;
  private ambientNodes: AmbientNodeEntry[] = [];
  private ambientStarted = false;
  private ambientMasterGain = 0;
  private ambientTime = 0;
  private windBuffer: AudioBuffer | null = null;
  private mechHumBuffer: AudioBuffer | null = null;
  private turbineBuffer: AudioBuffer | null = null;

  public attachSpatialAmbient(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.listener) return;
    try {
      const listener = new THREE.AudioListener();
      camera.add(listener);
      this.listener = listener;
      this.listenerCamera = camera;
      this.ctx = listener.context as AudioContext;
      this.initMasterChain(this.ctx);
      this.listener.setMasterVolume(this.muted ? 0 : 1);

      this.initAudioBuffers(this.ctx);

      const root = new THREE.Group();
      root.name = 'SpatialAmbientAudioRoot';
      scene.add(root);
      this.ambientRoot = root;

      const emitterSpecs: Array<{
        kind: 'wind' | 'mech' | 'turbine';
        pos: [number, number, number];
        refDist: number;
        maxDist: number;
        rolloff: number;
        volume: number;
        freq: number;
      }> = [
        // Echoing wind channels across brutalist alleys & canyon cuts
        { kind: 'wind', pos: [-44.5, 5.2, 0.8], refDist: 10, maxDist: 72, rolloff: 1.15, volume: 0.24, freq: 680 },
        { kind: 'wind', pos: [-4.0, 4.8, -1.5], refDist: 11, maxDist: 65, rolloff: 1.1, volume: 0.2, freq: 760 },
        { kind: 'wind', pos: [27.0, 6.2, -16.0], refDist: 11, maxDist: 70, rolloff: 1.15, volume: 0.22, freq: 720 },
        // Mechanical hums & structural industrial drones anchored to landmarks
        { kind: 'turbine', pos: [21.5, 8.8, -27.5], refDist: 8, maxDist: 54, rolloff: 1.45, volume: 0.16, freq: 520 },
        { kind: 'mech', pos: [30.5, 6.0, -23.5], refDist: 7, maxDist: 48, rolloff: 1.5, volume: 0.17, freq: 340 },
        { kind: 'mech', pos: [36.5, 2.4, 18.8], refDist: 6, maxDist: 42, rolloff: 1.65, volume: 0.19, freq: 290 },
        { kind: 'turbine', pos: [-40.5, 3.2, 14.0], refDist: 7, maxDist: 46, rolloff: 1.55, volume: 0.15, freq: 440 },
      ];

      for (let i = 0; i < emitterSpecs.length; i++) {
        const spec = emitterSpecs[i];
        const anchor = new THREE.Object3D();
        anchor.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
        root.add(anchor);

        const posAudio = new THREE.PositionalAudio(listener);
        const buf =
          spec.kind === 'wind'
            ? this.windBuffer
            : spec.kind === 'mech'
              ? this.mechHumBuffer
              : this.turbineBuffer;
        if (buf) posAudio.setBuffer(buf);
        posAudio.setLoop(true);
        posAudio.setDistanceModel('exponential');
        posAudio.setRefDistance(spec.refDist);
        posAudio.setMaxDistance(spec.maxDist);
        posAudio.setRolloffFactor(spec.rolloff);
        posAudio.setVolume(0);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = spec.freq;
        filter.Q.value = spec.kind === 'wind' ? 1.45 : 1.1;
        posAudio.setFilter(filter);

        anchor.add(posAudio);
        this.ambientNodes.push({
          kind: spec.kind,
          anchor,
          audio: posAudio,
          filter,
          baseVolume: spec.volume,
          baseFreq: spec.freq,
          phase: i * 1.37,
        });
      }
    } catch {
      // Gracefully continue if Web Audio / PositionalAudio is unavailable
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.listener) {
      this.listener.setMasterVolume(muted ? 0 : 1);
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setDynamicRange(preset: AudioDynamicRangePreset) {
    this.dynamicRange = getAudioDynamicRangeSpec(preset).id;
    this.applyDynamicRangeParams();
  }

  public getDynamicRange(): AudioDynamicRangePreset {
    return this.dynamicRange;
  }

  private initMasterChain(ctx: AudioContext) {
    if (this.compressor && this.loudBus && this.subtleBus) return;
    try {
      const loudBus = ctx.createGain();
      const subtleBus = ctx.createGain();
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 2400;
      presence.Q.value = 1.1;
      presence.gain.value = 0;

      const compressor = ctx.createDynamicsCompressor();
      const makeup = ctx.createGain();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;

      loudBus.connect(compressor);
      subtleBus.connect(presence);
      presence.connect(compressor);
      compressor.connect(makeup);
      makeup.connect(master);
      master.connect(ctx.destination);

      this.loudBus = loudBus;
      this.subtleBus = subtleBus;
      this.subtlePresenceFilter = presence;
      this.compressor = compressor;
      this.makeupGain = makeup;
      this.masterGain = master;
      this.applyDynamicRangeParams(true);
    } catch {
      // Fall back cleanly to ctx.destination if DynamicsCompressorNode is unavailable
    }
  }

  private applyDynamicRangeParams(immediate = false) {
    if (!this.ctx || !this.compressor || !this.loudBus || !this.subtleBus || !this.makeupGain || !this.subtlePresenceFilter) {
      return;
    }
    const spec = getAudioDynamicRangeSpec(this.dynamicRange);
    const now = this.ctx.currentTime;
    const tc = 0.03;
    if (immediate) {
      this.compressor.threshold.value = spec.thresholdDb;
      this.compressor.knee.value = spec.kneeDb;
      this.compressor.ratio.value = spec.ratio;
      this.compressor.attack.value = spec.attackSec;
      this.compressor.release.value = spec.releaseSec;
      this.makeupGain.gain.value = spec.makeupGain;
      this.loudBus.gain.value = spec.combatPeakGain;
      this.subtleBus.gain.value = spec.subtleCueGain;
      this.subtlePresenceFilter.gain.value = spec.footstepPresenceDb;
    } else {
      this.compressor.threshold.setTargetAtTime(spec.thresholdDb, now, tc);
      this.compressor.knee.setTargetAtTime(spec.kneeDb, now, tc);
      this.compressor.ratio.setTargetAtTime(spec.ratio, now, tc);
      this.compressor.attack.setTargetAtTime(spec.attackSec, now, tc);
      this.compressor.release.setTargetAtTime(spec.releaseSec, now, tc);
      this.makeupGain.gain.setTargetAtTime(spec.makeupGain, now, tc);
      this.loudBus.gain.setTargetAtTime(spec.combatPeakGain, now, tc);
      this.subtleBus.gain.setTargetAtTime(spec.subtleCueGain, now, tc);
      this.subtlePresenceFilter.gain.setTargetAtTime(spec.footstepPresenceDb, now, tc);
    }
  }

  private getLoudDestination(ctx: AudioContext): AudioNode {
    return this.loudBus ?? ctx.destination;
  }

  private getSubtleDestination(ctx: AudioContext): AudioNode {
    return this.subtleBus ?? ctx.destination;
  }

  public unlock() {
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.startAmbientSourcesIfNeeded();
  }

  private startAmbientSourcesIfNeeded() {
    if (this.ambientStarted || this.ambientNodes.length === 0) return;
    if (!this.ctx) return;
    try {
      for (const node of this.ambientNodes) {
        if (node.audio.buffer && !node.audio.isPlaying) {
          node.audio.offset = Math.random() * Math.max(0.5, node.audio.buffer.duration - 0.5);
          node.audio.play();
        }
      }
      this.ambientStarted = true;
    } catch {
      // Will retry on next user gesture
    }
  }

  public updateAmbient(
    dt: number,
    playerPos: THREE.Vector3,
    isIndoors: boolean,
    weatherWindFactor: number,
    active: boolean,
  ) {
    if (this.ambientNodes.length === 0 || !this.ctx) return;

    if (active && !this.muted && this.ctx.state === 'running') {
      this.startAmbientSourcesIfNeeded();
    }

    const targetMaster = active && !this.muted ? 1.0 : 0.0;
    const fadeRate = active ? 2.4 : 5.5;
    this.ambientMasterGain = THREE.MathUtils.damp(this.ambientMasterGain, targetMaster, fadeRate, dt);
    this.ambientTime += dt;

    if (this.ambientMasterGain < 0.001 && targetMaster === 0) {
      for (const entry of this.ambientNodes) {
        if (entry.audio.getVolume() > 0.0005) {
          entry.audio.setVolume(0);
        }
      }
      return;
    }

    // Elevation amplifies open-air canyon draft (e.g. 2nd-story balconies)
    const elevationBoost = THREE.MathUtils.clamp(playerPos.y / 4.2, 0, 1) * 0.34;
    // Proximity to outer perimeter intensifies canyon wind echo
    const radialDist = Math.hypot(playerPos.x, playerPos.z);
    const perimeterWind = THREE.MathUtils.clamp((radialDist - 18) / 34, 0, 1) * 0.28;
    const t = this.ambientTime;

    const drcAmbientDuck = getAudioDynamicRangeSpec(this.dynamicRange).ambientDuckGain;
    for (const entry of this.ambientNodes) {
      const gust = 0.78 + 0.22 * Math.sin(t * 0.42 + entry.phase) * Math.cos(t * 0.19 - entry.phase * 0.7);
      if (entry.kind === 'wind') {
        const indoorAtten = isIndoors ? 0.52 : 1.0;
        const weatherScale = 0.75 + weatherWindFactor * 0.55;
        const vol = entry.baseVolume * gust * weatherScale * (1 + elevationBoost + perimeterWind) * indoorAtten;
        entry.audio.setVolume(vol * this.ambientMasterGain * drcAmbientDuck);

        // Indoors filters wind into a darker resonant hollow echo; outdoors opens the air band
        const targetCutoff = isIndoors
          ? entry.baseFreq * 0.42 + Math.sin(t * 0.6 + entry.phase) * 70
          : entry.baseFreq * (0.95 + weatherWindFactor * 0.38) + Math.sin(t * 0.55 + entry.phase) * 165;
        entry.filter.frequency.setTargetAtTime(Math.max(140, targetCutoff), this.ctx.currentTime, 0.12);
        entry.filter.Q.setTargetAtTime(isIndoors ? 2.6 : 1.35 + weatherWindFactor * 0.45, this.ctx.currentTime, 0.15);
      } else {
        // Mechanical & turbine hums shift subtly with slow machinery modulation & enclosure acoustics
        const mechBreath = 0.88 + 0.12 * Math.sin(t * 0.85 + entry.phase);
        const indoorBoost = isIndoors ? 1.12 : 1.0;
        const vol = entry.baseVolume * mechBreath * indoorBoost;
        entry.audio.setVolume(vol * this.ambientMasterGain * drcAmbientDuck);

        const targetCutoff = entry.baseFreq * (isIndoors ? 0.72 : 1.05) + Math.sin(t * 0.7 + entry.phase) * 55;
        entry.filter.frequency.setTargetAtTime(Math.max(120, targetCutoff), this.ctx.currentTime, 0.12);
      }
    }
  }

  private ensureContext(allowMuted = false): AudioContext | null {
    if (this.muted && !allowMuted) return null;
    if (!this.ctx) {
      if (this.listener) {
        this.ctx = this.listener.context as AudioContext;
      } else {
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
    }
    this.initMasterChain(this.ctx);
    this.initAudioBuffers(this.ctx);
    if (this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private initAudioBuffers(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.createNoiseBuffer(ctx);
    }
    if (!this.footstepBanks) {
      this.footstepBanks = {
        concrete: [0, 1, 2, 3].map((v) => this.createFootstepSample(ctx, 'concrete', v)),
        metal: [0, 1, 2, 3].map((v) => this.createFootstepSample(ctx, 'metal', v)),
        glass: [0, 1, 2, 3].map((v) => this.createFootstepSample(ctx, 'glass', v)),
        wood: [0, 1, 2, 3].map((v) => this.createFootstepSample(ctx, 'wood', v)),
        dirt: [0, 1, 2, 3].map((v) => this.createFootstepSample(ctx, 'dirt', v)),
      };
    }
    if (!this.windBuffer) {
      this.windBuffer = this.createEchoingWindBuffer(ctx);
    }
    if (!this.mechHumBuffer) {
      this.mechHumBuffer = this.createMechanicalHumBuffer(ctx);
    }
    if (!this.turbineBuffer) {
      this.turbineBuffer = this.createTurbineHumBuffer(ctx);
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // =========================================================================
  // PROCEDURAL SURFACE-SPECIFIC FOOTSTEP SAMPLE SYNTHESIS (4 VARIANTS EACH)
  // =========================================================================
  private createFootstepSample(ctx: AudioContext, surface: FootstepSurface, variant: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const duration = surface === 'metal' ? 0.28 : surface === 'glass' ? 0.24 : 0.22;
    const len = Math.floor(sr * duration);
    const buffer = ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);

    // Deterministic per-variant seed so every sample variation sounds genuinely distinct
    let seed = (variant + 1) * 9173 + surface.charCodeAt(0) * 313;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const sRand = () => rand() * 2 - 1;

    const pitchVar = 0.92 + variant * 0.055;
    let lp1 = 0;
    let lp2 = 0;
    let hpPrevIn = 0;
    let hpPrevOut = 0;

    if (surface === 'concrete') {
      // Heavy boot heel-strike + 28ms forefoot slap + dry mineral grit + concrete slab slapback
      const toeDelay = Math.floor(sr * (0.024 + variant * 0.004));
      const slapDelay = Math.floor(sr * 0.048);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = sRand();
        lp1 = lp1 * 0.72 + n * 0.28;
        lp2 = lp2 * 0.93 + n * 0.07;
        const grit = n - lp1;

        // Heel impact: tight sub-thump + sharp rubber-on-slab crack
        const heelEnv = Math.exp(-t * 48);
        const heelTone = Math.sin(2 * Math.PI * (128 * pitchVar * Math.exp(-t * 14)) * t) * heelEnv * 0.62;
        const heelSnap = (lp1 - lp2) * Math.exp(-t * 72) * 0.75;

        // Forefoot sole slap & sand-on-concrete scuff
        let toe = 0;
        if (i >= toeDelay) {
          const tt = (i - toeDelay) / sr;
          const toeEnv = Math.exp(-tt * 38);
          toe =
            Math.sin(2 * Math.PI * 165 * pitchVar * tt) * toeEnv * 0.34 +
            grit * Math.exp(-tt * 55) * 0.42 +
            lp1 * toeEnv * 0.28;
        }

        data[i] = heelTone + heelSnap + toe;
      }
      // Bake crisp brutalist slab early reflection
      for (let i = len - 1; i >= slapDelay; i--) {
        data[i] += data[i - slapDelay] * 0.2;
      }
    } else if (surface === 'metal') {
      // Damped steel grate impact + inharmonic modal plate resonances + brief metallic ring
      const f1 = (385 + variant * 28) * pitchVar;
      const f2 = (860 + variant * 45) * pitchVar;
      const f3 = (1520 + variant * 70) * pitchVar;
      const f4 = (2640 + variant * 110) * pitchVar;
      const toeDelay = Math.floor(sr * (0.022 + variant * 0.003));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = sRand();
        lp1 = lp1 * 0.55 + n * 0.45;
        const metallicClank =
          Math.sin(2 * Math.PI * f1 * t) * Math.exp(-t * 24) * 0.36 +
          Math.sin(2 * Math.PI * f2 * t) * Math.exp(-t * 31) * 0.26 +
          Math.sin(2 * Math.PI * f3 * t) * Math.exp(-t * 42) * 0.18 +
          Math.sin(2 * Math.PI * f4 * t) * Math.exp(-t * 58) * 0.11;
        const impact = Math.sin(2 * Math.PI * 140 * Math.exp(-t * 16) * t) * Math.exp(-t * 44) * 0.45;
        const transient = (n - lp1) * Math.exp(-t * 95) * 0.52;

        let secondary = 0;
        if (i >= toeDelay) {
          const tt = (i - toeDelay) / sr;
          secondary =
            (Math.sin(2 * Math.PI * f2 * 1.07 * tt) * 0.16 + Math.sin(2 * Math.PI * f3 * 0.94 * tt) * 0.12) *
            Math.exp(-tt * 38);
        }

        data[i] = impact + metallicClank + transient + secondary;
      }
    } else if (surface === 'glass') {
      // Crisp crystalline plate tap + delicate high-frequency micro-shard/grit crackle
      const g1 = (2950 + variant * 190) * pitchVar;
      const g2 = (4480 + variant * 240) * pitchVar;
      const g3 = (6150 + variant * 290) * pitchVar;
      // Micro-crackle grain timestamps for subtle gritty sole-on-glass crunch
      const cracks: number[] = [];
      for (let c = 0; c < 7; c++) {
        cracks.push(Math.floor(sr * (0.004 + rand() * 0.068)));
      }
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = sRand();
        // High-pass filter for brittle specular sparkle
        const hp = 0.86 * (hpPrevOut + n - hpPrevIn);
        hpPrevIn = n;
        hpPrevOut = hp;

        const ping =
          Math.sin(2 * Math.PI * g1 * t) * Math.exp(-t * 34) * 0.28 +
          Math.sin(2 * Math.PI * g2 * t) * Math.exp(-t * 46) * 0.22 +
          Math.sin(2 * Math.PI * g3 * t) * Math.exp(-t * 62) * 0.14;
        const panelThump = Math.sin(2 * Math.PI * 240 * Math.exp(-t * 22) * t) * Math.exp(-t * 54) * 0.34;
        let sparkle = hp * Math.exp(-t * 78) * 0.42;

        for (let c = 0; c < cracks.length; c++) {
          const di = i - cracks[c];
          if (di >= 0 && di < 140) {
            const ct = di / sr;
            sparkle += (hp * 0.55 + Math.sin(2 * Math.PI * (3800 + c * 410) * ct) * 0.22) * Math.exp(-ct * 260);
          }
        }

        data[i] = panelThump + ping + sparkle;
      }
    } else if (surface === 'wood') {
      // Hollow boardwalk timber plank knock + dry board flex
      const fBody = (155 + variant * 14) * pitchVar;
      const fCavity = (320 + variant * 22) * pitchVar;
      const toeDelay = Math.floor(sr * (0.028 + variant * 0.004));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = sRand();
        lp1 = lp1 * 0.78 + n * 0.22;
        const knock =
          Math.sin(2 * Math.PI * fBody * Math.exp(-t * 10) * t) * Math.exp(-t * 30) * 0.62 +
          Math.sin(2 * Math.PI * fCavity * t) * Math.exp(-t * 44) * 0.28 +
          lp1 * Math.exp(-t * 58) * 0.45;
        let toe = 0;
        if (i >= toeDelay) {
          const tt = (i - toeDelay) / sr;
          toe = Math.sin(2 * Math.PI * (fBody * 1.18) * tt) * Math.exp(-tt * 34) * 0.36 + lp1 * Math.exp(-tt * 50) * 0.24;
        }
        data[i] = knock + toe;
      }
    } else {
      // Packed desert dirt / sand gravel crunch
      const grains: number[] = [];
      for (let g = 0; g < 11; g++) {
        grains.push(Math.floor(sr * (0.003 + rand() * 0.085)));
      }
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = sRand();
        lp1 = lp1 * 0.66 + n * 0.34;
        lp2 = lp2 * 0.91 + n * 0.09;
        const band = lp1 - lp2;

        const earthThud = Math.sin(2 * Math.PI * 95 * Math.exp(-t * 14) * t) * Math.exp(-t * 40) * 0.44;
        let crunch = band * Math.exp(-t * 28) * 0.65;
        for (let g = 0; g < grains.length; g++) {
          const di = i - grains[g];
          if (di >= 0 && di < 180) {
            const gt = di / sr;
            crunch += (n - lp1) * Math.exp(-gt * 180) * 0.22;
          }
        }
        data[i] = earthThud + crunch;
      }
    }

    // Peak-normalize cleanly with smooth tail fade-out
    let peak = 0.001;
    for (let i = 0; i < len; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
    const fadeSamples = Math.min(400, Math.floor(len * 0.15));
    for (let i = 0; i < len; i++) {
      let s = (data[i] / peak) * 0.88;
      if (i > len - fadeSamples) {
        s *= (len - i) / fadeSamples;
      }
      data[i] = s;
    }
    return buffer;
  }

  // =========================================================================
  // PROCEDURAL SEAMLESS AMBIENT LOOP BUFFERS (ECHOING WIND + MECHANICAL HUMS)
  // =========================================================================
  private makeSeamlessLoop(raw: Float32Array, crossfadeSamples: number): Float32Array {
    const outLen = raw.length - crossfadeSamples;
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = raw[i];
    }
    for (let i = 0; i < crossfadeSamples; i++) {
      const t = i / crossfadeSamples;
      // Equal-power cosine crossfade so the loop seam is completely inaudible
      const fadeIn = Math.sin(t * Math.PI * 0.5);
      const fadeOut = Math.cos(t * Math.PI * 0.5);
      out[i] = out[i] * fadeIn + raw[outLen + i] * fadeOut;
    }
    return out;
  }

  private createEchoingWindBuffer(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const loopSec = 6.5;
    const fadeSamples = Math.floor(sr * 0.65);
    const totalLen = Math.floor(sr * loopSec) + fadeSamples;
    const raw = new Float32Array(totalLen);

    // Pink/brown filtered wind bed + slow howling whistle harmonics through brutalist architecture
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let prev = 0;
    for (let i = 0; i < totalLen; i++) {
      const t = i / sr;
      const white = Math.random() * 2 - 1;
      b0 = 0.9965 * b0 + white * 0.048;
      b1 = 0.985 * b1 + white * 0.075;
      b2 = 0.93 * b2 + white * 0.11;
      const pink = b0 + b1 * 0.65 + b2 * 0.25;

      // Organic slow-swelling wind gusts
      const gust = 0.55 + 0.3 * Math.sin(t * 0.95) + 0.18 * Math.sin(t * 2.15 + 1.1);
      // Architectural corner whistle resonance (gentle modulated sine harmonics)
      const whistleFreq1 = 290 + Math.sin(t * 0.72) * 34;
      const whistleFreq2 = 445 + Math.cos(t * 0.54 + 0.8) * 28;
      const whistle =
        (Math.sin(2 * Math.PI * whistleFreq1 * t) * 0.045 + Math.sin(2 * Math.PI * whistleFreq2 * t) * 0.025) *
        Math.max(0, Math.sin(t * 0.85 - 0.3));

      const sample = pink * gust * 0.65 + whistle;
      prev = prev * 0.65 + sample * 0.35;
      raw[i] = prev;
    }

    // Bake subtle canyon/concrete corridor echoing slapback taps (240ms + 490ms)
    const d1 = Math.floor(sr * 0.24);
    const d2 = Math.floor(sr * 0.49);
    for (let i = totalLen - 1; i >= d2; i--) {
      raw[i] += raw[i - d1] * 0.28 + raw[i - d2] * 0.16;
    }

    const seamless = this.makeSeamlessLoop(raw, fadeSamples);
    const buffer = ctx.createBuffer(1, seamless.length, sr);
    buffer.getChannelData(0).set(seamless);
    return buffer;
  }

  private createMechanicalHumBuffer(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const loopSec = 4.8;
    const fadeSamples = Math.floor(sr * 0.5);
    const totalLen = Math.floor(sr * loopSec) + fadeSamples;
    const raw = new Float32Array(totalLen);

    let lp = 0;
    for (let i = 0; i < totalLen; i++) {
      const t = i / sr;
      // Periodic integer-cycle frequencies for clean industrial transformer & pipe drone
      const hum =
        Math.sin(2 * Math.PI * 55 * t) * 0.34 +
        Math.sin(2 * Math.PI * 110.25 * t) * 0.2 +
        Math.sin(2 * Math.PI * 165 * t) * 0.1 +
        Math.sin(2 * Math.PI * 220.5 * t) * 0.055;
      const lfo = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.625 * t);
      const rumble = Math.random() * 2 - 1;
      lp = lp * 0.965 + rumble * 0.035;
      raw[i] = (hum * lfo + lp * 0.85) * 0.55;
    }

    const seamless = this.makeSeamlessLoop(raw, fadeSamples);
    const buffer = ctx.createBuffer(1, seamless.length, sr);
    buffer.getChannelData(0).set(seamless);
    return buffer;
  }

  private createTurbineHumBuffer(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const loopSec = 4.2;
    const fadeSamples = Math.floor(sr * 0.45);
    const totalLen = Math.floor(sr * loopSec) + fadeSamples;
    const raw = new Float32Array(totalLen);

    let lp = 0;
    for (let i = 0; i < totalLen; i++) {
      const t = i / sr;
      // Rhythmic windmill rotor & electrical relay hum
      const bladePulse = 0.65 + 0.35 * Math.sin(2 * Math.PI * 1.428 * t);
      const drone =
        Math.sin(2 * Math.PI * 82 * t) * 0.26 +
        Math.sin(2 * Math.PI * 164.5 * t) * 0.16 +
        Math.sin(2 * Math.PI * 328 * t) * 0.065;
      const air = Math.random() * 2 - 1;
      lp = lp * 0.92 + air * 0.08;
      raw[i] = (drone * bladePulse + lp * bladePulse * 0.55) * 0.58;
    }

    const seamless = this.makeSeamlessLoop(raw, fadeSamples);
    const buffer = ctx.createBuffer(1, seamless.length, sr);
    buffer.getChannelData(0).set(seamless);
    return buffer;
  }

  public playCarbineShot() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Punchy sub-body thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.085);
    oscGain.gain.setValueAtTime(0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(oscGain).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.1);

    // Filtered crack transient
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450 + Math.random() * 250, now);
    filter.Q.setValueAtTime(0.85, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    noise.connect(filter).connect(noiseGain).connect(this.getLoudDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.08);

    // Crisp mechanical bolt click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(2400, now + 0.015);
    click.frequency.exponentialRampToValueAtTime(800, now + 0.04);
    clickGain.gain.setValueAtTime(0.055, now + 0.015);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    click.connect(clickGain).connect(this.getSubtleDestination(ctx));
    click.start(now + 0.015);
    click.stop(now + 0.05);
  }

  public playRailShot() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Deep kinetic rail discharge
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.19);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.19);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    osc.connect(lp).connect(gain).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.22);

    // High-energy electric snap
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'sine';
    snap.frequency.setValueAtTime(2100, now);
    snap.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    snapGain.gain.setValueAtTime(0.16, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    snap.connect(snapGain).connect(this.getLoudDestination(ctx));
    snap.start(now);
    snap.stop(now + 0.125);

    // Sharp muzzle burst noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(900, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.24, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(hp).connect(ng).connect(this.getLoudDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.13);
  }

  public playDryFire() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(g).connect(this.getSubtleDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.032);
  }

  public playReloadStart() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    // Subtle weapon cant & tactical glove handling rustle
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.Q.setValueAtTime(1.4, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    src.connect(bp).connect(g).connect(this.getSubtleDestination(ctx));
    src.start(now);
    src.stop(now + 0.07);
  }

  public playReloadMagOut(isEmpty: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // 1. Crisp metallic mag-release button click
    this.mechClick(ctx, now, isEmpty ? 880 : 720, 0.11);

    // 2. Magazine sliding out of aluminum magwell (polymer-on-metal sweep)
    const slide = ctx.createBufferSource();
    slide.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isEmpty ? 1550 : 1150, now + 0.02);
    bp.frequency.exponentialRampToValueAtTime(isEmpty ? 620 : 480, now + (isEmpty ? 0.12 : 0.17));
    bp.Q.setValueAtTime(2.6, now + 0.02);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.14, now + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, now + (isEmpty ? 0.13 : 0.18));
    slide.connect(bp).connect(sg).connect(this.getSubtleDestination(ctx));
    slide.start(now + 0.02);
    slide.stop(now + 0.19);

    // 3. On empty reload, hollow spent magazine drops clear with crisp secondary clatter
    if (isEmpty) {
      this.mechClick(ctx, now + 0.095, 480, 0.085);
    }
  }

  public playReloadMagIn() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // 1. Magazine sliding upward into beveled magwell
    const slide = ctx.createBufferSource();
    slide.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(640, now);
    bp.frequency.exponentialRampToValueAtTime(1480, now + 0.075);
    bp.Q.setValueAtTime(2.2, now);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.13, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    slide.connect(bp).connect(sg).connect(this.getSubtleDestination(ctx));
    slide.start(now);
    slide.stop(now + 0.09);

    // 2. Authoritative seated polymer/receiver thud
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(210, now + 0.065);
    thud.frequency.exponentialRampToValueAtTime(62, now + 0.14);
    tg.gain.setValueAtTime(0.24, now + 0.065);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thud.connect(tg).connect(this.getSubtleDestination(ctx));
    thud.start(now + 0.065);
    thud.stop(now + 0.155);

    // 3. Crisp magazine catch locking click
    this.mechClick(ctx, now + 0.075, 1140, 0.14);
  }

  public playReloadBoltRack() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // 1. Palm slap / charging handle engagement transient
    this.mechClick(ctx, now, 1520, 0.13);

    // 2. Steel bolt carrier sliding forward under buffer spring tension
    const rail = ctx.createBufferSource();
    rail.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2100, now + 0.02);
    hp.frequency.exponentialRampToValueAtTime(3400, now + 0.09);
    hp.Q.setValueAtTime(3.2, now + 0.02);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.16, now + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
    rail.connect(hp).connect(rg).connect(this.getSubtleDestination(ctx));
    rail.start(now + 0.02);
    rail.stop(now + 0.11);

    // 3. Heavy steel-on-steel bolt slam into battery (chambering round)
    const slam = ctx.createOscillator();
    const slamGain = ctx.createGain();
    slam.type = 'sawtooth';
    slam.frequency.setValueAtTime(420, now + 0.085);
    slam.frequency.exponentialRampToValueAtTime(115, now + 0.155);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, now + 0.085);
    slamGain.gain.setValueAtTime(0.18, now + 0.085);
    slamGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    slam.connect(lp).connect(slamGain).connect(this.getSubtleDestination(ctx));
    slam.start(now + 0.085);
    slam.stop(now + 0.165);

    this.mechClick(ctx, now + 0.088, 1780, 0.15);
  }

  public playReloadComplete() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Light crisp shoulder-ready settle click
    this.mechClick(ctx, now, 920, 0.08);
  }

  public playInspectStart() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    // Soft gloved weapon cant & tactical nylon sling rustle
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.exponentialRampToValueAtTime(980, now + 0.09);
    bp.Q.setValueAtTime(1.6, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.055, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(bp).connect(g).connect(this.getSubtleDestination(ctx));
    src.start(now);
    src.stop(now + 0.12);
  }

  public playInspectBoltCheck() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    // Subtle precision metallic press-check slide back & crisp close click
    const slide = ctx.createBufferSource();
    slide.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(3200, now + 0.06);
    bp.Q.setValueAtTime(3.4, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    slide.connect(bp).connect(g).connect(this.getSubtleDestination(ctx));
    slide.start(now);
    slide.stop(now + 0.08);
    this.mechClick(ctx, now + 0.015, 1620, 0.075);
    this.mechClick(ctx, now + 0.34, 1340, 0.09);
  }

  public playSlide() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    // Tactile knee-pad / dirt & wood combat slide rush
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1150, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.32);
    bp.Q.setValueAtTime(1.1, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(bp).connect(g).connect(this.getSubtleDestination(ctx));
    src.start(now);
    src.stop(now + 0.36);
  }

  private mechClick(ctx: AudioContext, time: number, freq: number, volume: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, time + 0.045);
    g.gain.setValueAtTime(volume, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(g).connect(this.getSubtleDestination(ctx));
    osc.start(time);
    osc.stop(time + 0.055);
  }

  public playHitMarker(crit: boolean, kill: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.compressor ?? ctx.destination;

    if (crit) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1920, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.11);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + 0.055);
    }

    if (kill) {
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.14);
      g2.gain.setValueAtTime(0.16, now + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc2.connect(g2).connect(dest);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.18);
    }
  }

  public playEnemyExplode() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.28);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.31);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 0.26);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    noise.connect(lp).connect(ng).connect(this.getLoudDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.28);
  }

  public playEnemyFire(heavy = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 480 : 760, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 120 : 210, now + 0.14);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playPlayerDamage(intensity = 1, shieldBreak = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const scale = Math.max(0.42, Math.min(1.75, intensity));

    // 1. Sub-bass kinetic body thump scaled to hit severity
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 + 32 * scale, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, 52 - 12 * scale), now + 0.13 + 0.06 * scale);
    g.gain.setValueAtTime(Math.min(0.46, 0.22 * scale + 0.08), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + 0.07 * scale);
    osc.connect(g).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.24 + 0.07 * scale);

    // 2. Concussive armor/vest impact slap noise scaled by hit force
    const slap = ctx.createBufferSource();
    slap.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520 + 680 * scale, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 0.12 + 0.05 * scale);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(Math.min(0.28, 0.12 * scale), now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.13 + 0.05 * scale);
    slap.connect(lp).connect(sg).connect(this.getLoudDestination(ctx));
    slap.start(now);
    slap.stop(now + 0.2 + 0.05 * scale);

    // 3. Distinct high-tech shield shatter crack when armor breaks
    if (shieldBreak) {
      const crack = ctx.createOscillator();
      const cg = ctx.createGain();
      crack.type = 'sawtooth';
      crack.frequency.setValueAtTime(1480, now);
      crack.frequency.exponentialRampToValueAtTime(240, now + 0.19);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.Q.setValueAtTime(1.8, now);
      cg.gain.setValueAtTime(0.18, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      crack.connect(bp).connect(cg).connect(this.getLoudDestination(ctx));
      crack.start(now);
      crack.stop(now + 0.22);
    }
  }

  public playFootstep(
    surface: FootstepSurface = 'concrete',
    options?: { sprinting?: boolean; indoor?: boolean; heavy?: boolean },
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.footstepBanks) return;

    const bank = this.footstepBanks[surface] || this.footstepBanks.concrete;
    let idx = Math.floor(Math.random() * bank.length);
    if (idx === this.lastVariantIdx[surface]) {
      idx = (idx + 1 + Math.floor(Math.random() * (bank.length - 1))) % bank.length;
    }
    this.lastVariantIdx[surface] = idx;
    this.footParity *= -1;

    const now = ctx.currentTime;
    const sprinting = Boolean(options?.sprinting);
    const indoor = Boolean(options?.indoor);
    const heavy = Boolean(options?.heavy);

    const src = ctx.createBufferSource();
    src.buffer = bank[idx];
    const baseRate = heavy ? 0.86 : sprinting ? 1.04 : 0.98;
    src.playbackRate.setValueAtTime(baseRate + (Math.random() - 0.5) * 0.14, now);

    // Subtle material-calibrated tone shaping
    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'glass' ? 'highshelf' : 'lowpass';
    if (surface === 'glass') {
      filter.frequency.setValueAtTime(2800 + Math.random() * 500, now);
      filter.gain.setValueAtTime(3.2, now);
    } else if (surface === 'metal') {
      filter.frequency.setValueAtTime(4600 + Math.random() * 900, now);
    } else if (surface === 'concrete') {
      filter.frequency.setValueAtTime(2600 + Math.random() * 650, now);
    } else if (surface === 'wood') {
      filter.frequency.setValueAtTime(1850 + Math.random() * 450, now);
    } else {
      filter.frequency.setValueAtTime(2200 + Math.random() * 550, now);
    }

    const baseVol =
      surface === 'metal'
        ? 0.22
        : surface === 'glass'
          ? 0.2
          : surface === 'concrete'
            ? 0.24
            : surface === 'wood'
              ? 0.22
              : 0.18;
    const gain = ctx.createGain();
    const vol = baseVol * (heavy ? 1.48 : sprinting ? 1.24 : 0.92) * (0.9 + Math.random() * 0.2);
    gain.gain.setValueAtTime(vol, now);

    // Subtle alternating left/right boot stereo imaging
    const subtleDest = this.getSubtleDestination(ctx);
    const panNode = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panNode) {
      panNode.pan.setValueAtTime(this.footParity * (heavy ? 0.04 : 0.11), now);
      src.connect(filter).connect(gain).connect(panNode).connect(subtleDest);
    } else {
      src.connect(filter).connect(gain).connect(subtleDest);
    }

    // Subtle architectural slapback echo indoors or on hard reflective concrete/metal/glass surfaces
    if (indoor || surface === 'concrete' || surface === 'metal' || surface === 'glass') {
      const delay = ctx.createDelay(0.25);
      delay.delayTime.setValueAtTime(indoor ? 0.072 : 0.054, now);
      const echoLp = ctx.createBiquadFilter();
      echoLp.type = 'lowpass';
      echoLp.frequency.setValueAtTime(indoor ? 1350 : 1800, now);
      const echoGain = ctx.createGain();
      echoGain.gain.setValueAtTime(indoor ? 0.22 : 0.11, now);
      gain.connect(delay).connect(echoLp).connect(echoGain).connect(subtleDest);
    }

    src.start(now);
  }

  public playEnemyFootstep(
    surface: FootstepSurface,
    distance: number,
    relativeRightDot: number,
    heavy = false,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.footstepBanks) return;

    const mix = computeEnemyFootstepMix(distance, relativeRightDot, heavy, this.dynamicRange);
    if (!mix.audible) return;

    const bank = this.footstepBanks[surface] || this.footstepBanks.dirt;
    const idx = Math.floor(Math.random() * bank.length);
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = bank[idx];
    const baseRate = heavy ? 0.8 : 0.96;
    src.playbackRate.setValueAtTime(baseRate + (Math.random() - 0.5) * 0.12, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(mix.cutoffHz, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(mix.gain, now);

    const subtleDest = this.getSubtleDestination(ctx);
    const panNode = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panNode) {
      panNode.pan.setValueAtTime(mix.pan, now);
      src.connect(lp).connect(gain).connect(panNode).connect(subtleDest);
    } else {
      src.connect(lp).connect(gain).connect(subtleDest);
    }
    src.start(now);
  }

  public playLanding(surface: FootstepSurface, impactSpeed: number, indoor = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const strength = THREE.MathUtils.clamp((impactSpeed - 3.0) / 10.0, 0.25, 1.0);
    this.playFootstep(surface, { heavy: strength > 0.5, sprinting: true, indoor });
    // Slight secondary boot settle for authentic two-foot landing
    window.setTimeout(() => {
      if (!this.muted) {
        this.playFootstep(surface, { sprinting: false, indoor });
      }
    }, 52);
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(this.getSubtleDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playDash() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(2100, now + 0.09);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.24);
    bp.Q.setValueAtTime(1.1, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.01, now);
    ng.gain.linearRampToValueAtTime(0.24, now + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(bp).connect(ng).connect(this.getLoudDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.26);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.18);
    og.gain.setValueAtTime(0.2, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(og).connect(this.getLoudDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.getSubtleDestination(ctx);
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      g.gain.setValueAtTime(0.11, now + idx * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.14);
      osc.connect(g).connect(dest);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.15);
    });
  }

  public playWaveClear() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dest = this.compressor ?? ctx.destination;
    [392.0, 493.88, 587.33, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      g.gain.setValueAtTime(0.12, now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      osc.connect(g).connect(dest);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.36);
    });
  }

  public dispose() {
    for (const entry of this.ambientNodes) {
      try {
        if (entry.audio.isPlaying) {
          entry.audio.stop();
        }
        entry.audio.disconnect();
      } catch {
        // Ignore already-stopped audio nodes
      }
    }
    this.ambientNodes = [];
    if (this.ambientRoot && this.ambientRoot.parent) {
      this.ambientRoot.parent.remove(this.ambientRoot);
    }
    this.ambientRoot = null;
    if (this.listener && this.listenerCamera) {
      this.listenerCamera.remove(this.listener);
    }
    this.listener = null;
    this.listenerCamera = null;
    this.ambientStarted = false;

    for (const node of [
      this.loudBus,
      this.subtleBus,
      this.subtlePresenceFilter,
      this.compressor,
      this.makeupGain,
      this.masterGain,
    ]) {
      try {
        node?.disconnect();
      } catch {
        // Ignore already-disconnected nodes
      }
    }
    this.loudBus = null;
    this.subtleBus = null;
    this.subtlePresenceFilter = null;
    this.compressor = null;
    this.makeupGain = null;
    this.masterGain = null;

    // Do not close Three.js global singleton AudioContext if shared; just release references
    this.ctx = null;
    this.noiseBuffer = null;
    this.footstepBanks = null;
    this.windBuffer = null;
    this.mechHumBuffer = null;
    this.turbineBuffer = null;
  }
}
