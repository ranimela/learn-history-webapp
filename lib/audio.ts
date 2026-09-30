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

  public playTrumpets() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Majestic trumpet fanfare: C5 -> E5 -> G5 -> C6 (sustained triumphant brass)
      const brassMotif = [
        { freq: 523.25, start: 0.0, dur: 0.14 },   // C5
        { freq: 523.25, start: 0.16, dur: 0.14 },  // C5
        { freq: 523.25, start: 0.32, dur: 0.14 },  // C5
        { freq: 659.25, start: 0.48, dur: 0.35 },  // E5
        { freq: 523.25, start: 0.85, dur: 0.14 },  // C5
        { freq: 783.99, start: 1.02, dur: 0.7 },   // G5
        { freq: 1046.5, start: 1.02, dur: 0.7 },   // C6 harmony
      ];

      brassMotif.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        // Brass timbre: mix sawtooth + square through resonant lowpass
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + start);

        osc2.type = "square";
        osc2.frequency.setValueAtTime(freq * 1.002, now + start); // slight chorus detune

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now + start);
        filter.frequency.exponentialRampToValueAtTime(3600, now + start + 0.05);
        filter.frequency.exponentialRampToValueAtTime(1400, now + start + dur);
        filter.Q.setValueAtTime(3, now + start);

        gain.gain.setValueAtTime(0.01, now + start);
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc2.start(now + start);
        osc.stop(now + start + dur + 0.05);
        osc2.stop(now + start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }

  public playSadTune() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Classic sad trombone "wah-wah-wah-waaaah"
      // Note 1: Eb4 (311.1 Hz)
      // Note 2: D4  (293.7 Hz)
      // Note 3: Db4 (277.2 Hz)
      // Note 4: C4  (261.6 Hz -> slides down to B3 246.9 Hz)
      const sadNotes = [
        { freq: 311.13, start: 0.0, dur: 0.32, slideTo: null },
        { freq: 293.66, start: 0.38, dur: 0.32, slideTo: null },
        { freq: 277.18, start: 0.76, dur: 0.32, slideTo: null },
        { freq: 261.63, start: 1.15, dur: 1.1, slideTo: 235.0 }, // lingering slide down
      ];

      sadNotes.forEach(({ freq, start, dur, slideTo }) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + start);
        if (slideTo) {
          osc.frequency.setValueAtTime(freq, now + start + 0.3);
          osc.frequency.exponentialRampToValueAtTime(slideTo, now + start + dur);
        }

        // Muted wah filter effect
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(600, now + start);
        filter.frequency.exponentialRampToValueAtTime(350, now + start + dur);
        filter.Q.setValueAtTime(2.5, now + start);

        gain.gain.setValueAtTime(0.01, now + start);
        gain.gain.linearRampToValueAtTime(0.16, now + start + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }

  public playMildTune() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Mild, neutral, soft 3-note chime (G3 -> Bb3 -> C4) for score 3-5
      const notes = [
        { freq: 196.0, start: 0.0, dur: 0.25 },
        { freq: 233.08, start: 0.2, dur: 0.25 },
        { freq: 261.63, start: 0.4, dur: 0.5 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.12, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }

  public playUpbeatTune() {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Upbeat, motivating 4-note ascending chime (G4 -> C5 -> E5 -> G5) for score 6-8
      const notes = [
        { freq: 392.0, start: 0.0, dur: 0.16 },
        { freq: 523.25, start: 0.14, dur: 0.16 },
        { freq: 659.25, start: 0.28, dur: 0.2 },
        { freq: 783.99, start: 0.45, dur: 0.5 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.16, now + start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundFX = new SoundEffects();
