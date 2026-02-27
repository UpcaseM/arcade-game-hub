import { clamp } from "./math";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;
  private volume = 0.6;

  setVolume(value: number): void {
    this.volume = clamp(value, 0, 1);

    if (this.bgmGain) {
      this.bgmGain.gain.value = this.volume * 0.06;
    }
  }

  async ensureContext(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  beep(frequency: number, durationMs: number, type: OscillatorType, gain = 0.06): void {
    if (!this.ctx) {
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * this.volume), now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  startBgm(): void {
    if (!this.ctx || this.bgmOsc) {
      return;
    }

    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();

    this.bgmOsc.type = "triangle";
    this.bgmOsc.frequency.value = 71;
    this.bgmGain.gain.value = this.volume * 0.06;

    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.ctx.destination);
    this.bgmOsc.start();
  }

  stopBgm(): void {
    if (!this.bgmOsc) {
      return;
    }

    this.bgmOsc.stop();
    this.bgmOsc.disconnect();
    this.bgmGain?.disconnect();
    this.bgmOsc = null;
    this.bgmGain = null;
  }

  shoot(): void {
    this.beep(340 + Math.random() * 60, 55, "square", 0.02);
  }

  hit(): void {
    this.beep(180 + Math.random() * 30, 90, "triangle", 0.03);
  }

  pickup(): void {
    this.beep(590, 80, "sine", 0.03);
  }

  levelUp(): void {
    this.beep(430, 140, "triangle", 0.04);
    this.beep(650, 180, "triangle", 0.03);
  }
}
