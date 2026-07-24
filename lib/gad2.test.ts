import { describe, expect, it } from "vitest";
import { scoreGad2, GAD2_CUTOFF } from "./gad2";

describe("scoreGad2", () => {
  it("throws if the answer count does not match the item count", () => {
    expect(() => scoreGad2([0])).toThrow();
  });

  it("is not above cutoff just below the threshold", () => {
    const result = scoreGad2([1, 1]); // total 2, cutoff is 3
    expect(result.total).toBe(2);
    expect(result.aboveCutoff).toBe(false);
  });

  it("is above cutoff exactly at the threshold", () => {
    const result = scoreGad2([2, 1]); // total 3
    expect(result.total).toBe(GAD2_CUTOFF);
    expect(result.aboveCutoff).toBe(true);
  });

  it("caps at total 6 for max answers", () => {
    const result = scoreGad2([3, 3]);
    expect(result.total).toBe(6);
    expect(result.aboveCutoff).toBe(true);
  });
});
