// Synthesized Web Audio API sound generator + Web Speech TTS controller
// 100% self-contained, no external audio files required!

export type TrackType =
  | "battle"
  | "mystic"
  | "cyber"
  | "campfire"
  | "romance"
  | "dark"
  | "calm"
  | "none";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicOsc1: OscillatorNode | null = null;
  private musicOsc2: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicInterval: any = null;
  private internetAudio: HTMLAudioElement | null = null;
  private rhythmPulseInterval: any = null;

  public sfxEnabled: boolean = true;
  public musicEnabled: boolean = false;
  public ambientEnabled: boolean = true;
  public currentTrack: TrackType | string = "none";
  public currentStreamTitle: string = "";
  public isStreamPlaying: boolean = false;
  public volume: number = 0.4;
  public currentBpm: number = 90;
  public isRhythmPulseActive: boolean = false;

  stopAmbient() {
    this.stopMusic();
  }

  setAmbient(type: string) {
    if (!this.ambientEnabled) return;
    let track: TrackType = "mystic";
    if (type === "cyber") track = "cyber";
    else if (type === "romantic" || type === "romance") track = "romance";
    else if (type === "fantasy" || type === "campfire") track = "campfire";
    else if (type === "battle" || type === "action") track = "battle";
    else if (type === "dark") track = "dark";
    this.playTrack(track);
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Play crisp UI click
  playClick() {
    if (!this.sfxEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.12 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  // Play choice selection chime
  playChoice() {
    if (!this.sfxEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);

        gain.gain.setValueAtTime(0.14 * this.volume, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.2);
      });
    } catch (e) {}
  }

  // Play achievement / success fanfare
  playFanfare() {
    if (!this.sfxEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.16 * this.volume, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.35);
      });
    } catch (e) {}
  }

  // Play action SFX
  playAction(type: "combat" | "magic" | "affinity" | "item" | "click" = "combat") {
    if (!this.sfxEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      if (type === "combat") {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);

        gain.gain.setValueAtTime(0.25 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "affinity") {
        [587.33, 739.99, 880].forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          gain.gain.setValueAtTime(0.12 * this.volume, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } else if (type === "magic") {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1280, now + 0.3);
        gain.gain.setValueAtTime(0.12 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {}
  }

  // Play atmospheric situation music
  playTrack(track: TrackType) {
    if (track === "none") {
      this.stopMusic();
      this.currentTrack = "none";
      return;
    }

    if (!this.musicEnabled) {
      this.currentTrack = track;
      return;
    }

    if (this.currentTrack === track && this.musicOsc1) {
      return; // already playing this track
    }

    this.stopMusic();
    this.currentTrack = track;

    try {
      this.initContext();
      if (!this.ctx) return;

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.06 * this.volume, this.ctx.currentTime + 1.2);
      masterGain.connect(this.ctx.destination);
      this.musicGain = masterGain;

      // Track chord progression frequencies (Hz)
      let chordPitches: number[][] = [];
      let oscType: OscillatorType = "sine";

      switch (track) {
        case "battle":
          // Intense minor stabs & low drone
          oscType = "sawtooth";
          chordPitches = [
            [55, 110, 165],
            [55, 123.47, 185],
            [48.99, 98, 147],
          ];
          break;
        case "mystic":
          // Ethereal fifths & shimmering octaves
          oscType = "sine";
          chordPitches = [
            [110, 220, 330, 440],
            [130.81, 261.63, 392, 523.25],
            [98, 196, 293.66, 392],
          ];
          break;
        case "cyber":
          // Cyberpunk bassline & neon square pulse
          oscType = "triangle";
          chordPitches = [
            [65.41, 130.81, 196],
            [73.42, 146.83, 220],
            [58.27, 116.54, 174.61],
          ];
          break;
        case "campfire":
          // Warm acoustic major triads
          oscType = "sine";
          chordPitches = [
            [130.81, 164.81, 196, 261.63],
            [146.83, 174.61, 220, 293.66],
            [110, 138.59, 164.81, 220],
          ];
          break;
        case "romance":
          // Emotional mellow minor 7th harmony
          oscType = "sine";
          chordPitches = [
            [174.61, 220, 261.63, 329.63],
            [146.83, 174.61, 220, 261.63],
            [130.81, 164.81, 196, 246.94],
          ];
          break;
        case "dark":
          // Deep sub drone
          oscType = "sawtooth";
          chordPitches = [
            [43.65, 87.31, 130.81],
            [41.2, 82.41, 123.47],
          ];
          break;
        case "calm":
        default:
          oscType = "sine";
          chordPitches = [
            [130.81, 196, 261.63],
            [146.83, 220, 293.66],
          ];
          break;
      }

      let chordIndex = 0;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();

      osc1.type = oscType;
      osc2.type = "sine";

      const currentNotes = chordPitches[0];
      osc1.frequency.setValueAtTime(currentNotes[0], this.ctx.currentTime);
      osc2.frequency.setValueAtTime(currentNotes[1] || currentNotes[0] * 1.5, this.ctx.currentTime);

      osc1.connect(masterGain);
      osc2.connect(masterGain);

      osc1.start();
      osc2.start();

      this.musicOsc1 = osc1;
      this.musicOsc2 = osc2;

      // Slowly shift harmony every 6 seconds
      this.musicInterval = setInterval(() => {
        if (!this.ctx || !this.musicOsc1 || !this.musicOsc2) return;
        chordIndex = (chordIndex + 1) % chordPitches.length;
        const notes = chordPitches[chordIndex];
        const t = this.ctx.currentTime;
        this.musicOsc1.frequency.exponentialRampToValueAtTime(notes[0], t + 2.5);
        this.musicOsc2.frequency.exponentialRampToValueAtTime(notes[1] || notes[0] * 1.5, t + 2.5);
      }, 6000);
    } catch (e) {}
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
        setTimeout(() => {
          this.musicOsc1?.stop();
          this.musicOsc2?.stop();
          this.musicOsc1?.disconnect();
          this.musicOsc2?.disconnect();
          this.musicOsc1 = null;
          this.musicOsc2 = null;
        }, 650);
      } catch (e) {
        this.musicOsc1 = null;
        this.musicOsc2 = null;
      }
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(0.06 * this.volume, this.ctx.currentTime);
    }
    if (this.internetAudio) {
      this.internetAudio.volume = Math.max(0, Math.min(1, this.volume));
    }
  }

  // Play Internet Audio Stream / Web Radio / Custom URL
  playInternetStream(url: string, title?: string, bpm: number = 90) {
    this.stopMusic();
    this.stopInternetStream();

    this.currentTrack = "custom-stream";
    this.currentStreamTitle = title || "Интернет-аудиопоток";
    this.currentBpm = bpm;
    this.musicEnabled = true;

    try {
      const audio = new Audio();
      audio.src = url;
      audio.volume = Math.max(0, Math.min(1, this.volume));
      audio.loop = true;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isStreamPlaying = true;
          })
          .catch((err) => {
            console.warn("Internet stream playback failed:", err);
            this.isStreamPlaying = false;
          });
      }

      this.internetAudio = audio;
    } catch (e) {
      console.warn("Audio element error:", e);
      this.isStreamPlaying = false;
    }
  }

  stopInternetStream() {
    if (this.internetAudio) {
      try {
        this.internetAudio.pause();
        this.internetAudio.src = "";
        this.internetAudio.load();
      } catch (e) {}
      this.internetAudio = null;
    }
    this.isStreamPlaying = false;
    this.currentStreamTitle = "";
  }

  // BPM and Rhythm Metronome / Beat pulse
  setBpm(bpm: number) {
    this.currentBpm = Math.max(40, Math.min(220, bpm));
  }

  playRhythmBeat(strong: boolean = false) {
    if (!this.sfxEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = "sine";
      osc.frequency.setValueAtTime(strong ? 440 : 280, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain.gain.setValueAtTime(0.04 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  startRhythmPulse(bpm?: number) {
    if (bpm) this.setBpm(bpm);
    this.stopRhythmPulse();
    this.isRhythmPulseActive = true;
    const intervalMs = (60 / this.currentBpm) * 1000;
    let beat = 0;
    this.rhythmPulseInterval = setInterval(() => {
      this.playRhythmBeat(beat === 0);
      beat = (beat + 1) % 4;
    }, intervalMs);
  }

  stopRhythmPulse() {
    if (this.rhythmPulseInterval) {
      clearInterval(this.rhythmPulseInterval);
      this.rhythmPulseInterval = null;
    }
    this.isRhythmPulseActive = false;
  }

  // TTS Speech
  speakScene(text: string, onEnd?: () => void) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (!text) return;

      const cleaned = text
        .replace(/[*_#`[\]()]/g, "")
        .replace(/\n+/g, ". ")
        .slice(0, 600);

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = "ru-RU";
      utterance.rate = 1.0;
      utterance.pitch = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const ruVoice = voices.find((v) => v.lang.includes("ru"));
      if (ruVoice) {
        utterance.voice = ruVoice;
      }

      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const sound = new SoundEngine();
