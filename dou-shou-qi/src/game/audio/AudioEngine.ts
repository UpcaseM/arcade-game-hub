import { UiSettings } from '../ui/settings';

type SfxType = 'flip' | 'move' | 'capture' | 'win';

export class AudioEngine {
  private context: AudioContext | null = null;
  private settings: UiSettings;
  private musicGain: GainNode | null = null;
  private musicNodes: OscillatorNode[] = [];

  constructor(settings: UiSettings) {
    this.settings = settings;
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.context.destination);
      this.startMusicLoop();
      this.applySettings(this.settings);
      return;
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  applySettings(settings: UiSettings): void {
    this.settings = settings;
    if (!this.context || !this.musicGain) {
      return;
    }
    this.musicGain.gain.value = settings.musicMuted ? 0 : settings.musicVolume * 0.18;
  }

  play(type: SfxType): void {
    if (!this.context || this.settings.sfxMuted) {
      return;
    }

    const now = this.context.currentTime;
    const gain = this.context.createGain();
    gain.gain.value = this.settings.sfxVolume * 0.2;
    gain.connect(this.context.destination);

    const osc = this.context.createOscillator();
    osc.connect(gain);

    if (type === 'flip') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
      return;
    }

    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    if (type === 'capture') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

    osc.type = 'square';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  private startMusicLoop(): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    const chord = [196, 246.94, 293.66];
    chord.forEach((hz, idx) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.value = hz;
      gain.gain.value = 0.07 - idx * 0.015;
      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start();
      this.musicNodes.push(osc);
    });
  }
}

