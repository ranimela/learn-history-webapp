// Web Audio API Synthesizer for tactile game feedback

class SoundEffects {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("quiz_sound_enabled");
      this.soundEnabled = stored === null ? true : stored === "true";
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return !this.soundEnabled;
  }

  public toggleMute(): boolean {
    this.soundEnabled = !this.soundEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("quiz_sound_enabled", String(this.soundEnabled));
    }
    return this.soundEnabled;
  }

  public playClick() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // AudioContext could be prevented before gesture
    }
  }

  public playCorrect() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // High triumphant two-tone bell
      [
        { freq: 587.33, start: 0, duration: 0.12 }, // D5
        { freq: 880.0, start: 0.1, duration: 0.3 }, // A5
      ].forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.18, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch {
      // Ignore
    }
  }

  public playIncorrect() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore
    }
  }

  public playStreak() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // 4-note ascending power chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const start = idx * 0.08;
        const duration = 0.2;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.15, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    } catch {
      // Ignore
    }
  }

  public playVictory() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Fanfare triad burst
      const notes = [
        { freq: 440.0, start: 0, dur: 0.15 },    // A4
        { freq: 554.37, start: 0.12, dur: 0.15 }, // C#5
        { freq: 659.25, start: 0.24, dur: 0.18 }, // E5
        { freq: 880.0, start: 0.4, dur: 0.5 },    // A5
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.2, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundFX = new SoundEffects();
