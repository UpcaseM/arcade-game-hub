import { describe, expect, test } from "vitest";
import { WaveScheduler } from "../core/waveScheduler";

describe("WaveScheduler", () => {
  test("emits spawn events on schedule", () => {
    const scheduler = new WaveScheduler([
      {
        enemyId: "crawler",
        count: 3,
        intervalMs: 1000,
        startAtMs: 500,
        spawnPattern: "edgeRandom"
      }
    ]);

    expect(scheduler.advance(400)).toHaveLength(0);
    expect(scheduler.advance(500)).toHaveLength(1);
    expect(scheduler.advance(1200)).toHaveLength(0);
    expect(scheduler.advance(1500)).toHaveLength(1);
    expect(scheduler.advance(3000)).toHaveLength(1);
    expect(scheduler.advance(5000)).toHaveLength(0);
  });
});
