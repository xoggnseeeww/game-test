import { describe, expect, it } from "vitest";
import { scorePhq2, PHQ2_CUTOFF } from "./phq2";

describe("scorePhq2", () => {
  it("throws if the answer count does not match the item count", () => {
    expect(() => scorePhq2([0])).toThrow();
  });

  it("is not above cutoff just below the threshold", () => {
    const result = scorePhq2([1, 1]); // total 2, cutoff is 3
    expect(result.total).toBe(2);
    expect(result.aboveCutoff).toBe(false);
  });

  it("is above cutoff exactly at the threshold", () => {
    const result = scorePhq2([2, 1]); // total 3
    expect(result.total).toBe(PHQ2_CUTOFF);
    expect(result.aboveCutoff).toBe(true);
  });

  it("caps at total 6 for max answers", () => {
    const result = scorePhq2([3, 3]);
    expect(result.total).toBe(6);
    expect(result.aboveCutoff).toBe(true);
  });
});
