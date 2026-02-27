import type { WaveSpawn } from "../data/types";

export interface RuntimeWave extends WaveSpawn {
  spawned: number;
  nextAtMs: number;
}

export interface SpawnEvent {
  waveIndex: number;
  enemyId: string;
  spawnPattern: WaveSpawn["spawnPattern"];
}

export class WaveScheduler {
  private readonly waves: RuntimeWave[];

  constructor(waves: WaveSpawn[]) {
    this.waves = waves.map(wave => ({
      ...wave,
      spawned: 0,
      nextAtMs: wave.startAtMs
    }));
  }

  advance(elapsedMs: number): SpawnEvent[] {
    const events: SpawnEvent[] = [];

    for (let waveIndex = 0; waveIndex < this.waves.length; waveIndex += 1) {
      const wave = this.waves[waveIndex];

      while (wave.spawned < wave.count && elapsedMs >= wave.nextAtMs) {
        events.push({
          waveIndex,
          enemyId: wave.enemyId,
          spawnPattern: wave.spawnPattern
        });

        wave.spawned += 1;
        wave.nextAtMs += wave.intervalMs;
      }
    }

    return events;
  }
}
