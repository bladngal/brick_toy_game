// Procedural Web Audio API synthesizer for toy brick sounds, footsteps, water, and stud chimes

export class BrickAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.waterGain = null;
    this.lastClatterTime = 0;
    this.studStreak = 0;
    this.lastStudTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this._startAmbientWater();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.ctx && this.waterGain) {
      this.waterGain.gain.setTargetAtTime(this.enabled ? 0.025 : 0, this.ctx.currentTime, 0.1);
    }
    return this.enabled;
  }

  _startAmbientWater() {
    if (!this.ctx) return;
    try {
      // Soft filtered white noise to simulate bubbling garden fountains
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 650;
      filter.Q.value = 2.2;

      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.value = 0;

      noise.connect(filter);
      filter.connect(this.waterGain);
      this.waterGain.connect(this.ctx.destination);
      noise.start();
    } catch {
      // Ignore ambient audio errors if autoplay restricted
    }
  }

  updateWaterProximity(minDistanceToFountain, anyFountainIntact) {
    if (!this.ctx || !this.waterGain || !this.enabled || !anyFountainIntact) {
      if (this.waterGain && this.ctx) {
        this.waterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
      return;
    }
    const maxDist = 20;
    const proximity = Math.max(0, 1 - minDistanceToFountain / maxDist);
    const targetGain = proximity * proximity * 0.045;
    this.waterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
  }

  // Crisp hollow ABS plastic brick click/clatter
  playBrickClick(pitchMultiplier = 1, volume = 0.18, delay = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;

    // Resonant plastic body ping
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const baseFreq = (1150 + Math.random() * 950) * pitchMultiplier;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.58, now + 0.045);

    // Second harmonic for hollow ABS plastic character
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 2.35, now);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.03);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.05);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.055);
    osc2.stop(now + 0.055);
  }

  // Full brick smash: punchy impact + cascade of tumbling plastic clicks
  playSmash(brickCount = 12, isWater = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Low punchy thud
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.16);
    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.19);

    // 2. Cascade of plastic clatter clicks
    const clatterCount = Math.min(20, Math.max(6, Math.floor(brickCount * 0.85)));
    for (let i = 0; i < clatterCount; i++) {
      const delay = i * 0.014 + Math.random() * 0.16;
      const pitch = 0.75 + Math.random() * 0.7 + (isWater ? 0.25 : 0);
      const vol = Math.max(0.04, 0.2 * (1 - i / (clatterCount * 1.2)));
      this.playBrickClick(pitch, vol, delay);
    }
  }

  // Throttled ground bounce click for individual tumbling bricks
  playBounceClatter(intensity = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastClatterTime < 22) return;
    this.lastClatterTime = now;
    const vol = Math.min(0.14, Math.max(0.02, intensity * 0.12));
    this.playBrickClick(0.85 + Math.random() * 0.5, vol, 0);
  }

  // Classic shiny stud pickup chime
  playStudPickup(tier = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastStudTime < 1.2) {
      this.studStreak = Math.min(12, this.studStreak + 1);
    } else {
      this.studStreak = 0;
    }
    this.lastStudTime = now;

    const streakSemitones = Math.pow(1.035, this.studStreak);
    const baseFreq = (tier >= 3 ? 880 : tier === 2 ? 740 : 620) * streakSemitones;

    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.038;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  playFootstep(stepIndex = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = stepIndex % 2 === 0 ? 310 : 355;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.032);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.038);
  }

  playJump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.13);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playKick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playRebuild() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    // Ascending magical brick-snap arpeggio
    const scale = [330, 392, 440, 523.25, 659.25, 783.99, 1046.5];
    scale.forEach((freq, i) => {
      this.playBrickClick(freq / 600, 0.12, i * 0.045);
    });
  }
}
