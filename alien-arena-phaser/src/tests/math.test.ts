import { describe, expect, test } from "vitest";
import { smoothAngle } from "../core/math";

describe("smoothAngle", () => {
  test("moves toward target by maxDelta", () => {
    const result = smoothAngle(0, Math.PI, 0.2);
    expect(result).toBeCloseTo(0.2, 3);
  });

  test("handles wrap-around shortest path", () => {
    const current = Math.PI - 0.1;
    const target = -Math.PI + 0.1;
    const result = smoothAngle(current, target, 0.08);
    expect(result).toBeGreaterThan(current);
  });
});
