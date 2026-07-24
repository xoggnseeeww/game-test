import { describe, expect, it } from "vitest";
import { ASRS_PART_A_ITEMS, bandForTotal, scoreAsrs } from "./asrs";

describe("scoreAsrs", () => {
  it("throws if the answer count does not match the item count", () => {
    expect(() => scoreAsrs([0, 1, 2])).toThrow();
  });

  it("scores all-zero answers as total 0, band low", () => {
    const result = scoreAsrs(new Array(ASRS_PART_A_ITEMS.length).fill(0) as never);
    expect(result.total).toBe(0);
    expect(result.band).toBe("low");
  });

  it("scores all-max answers as total 24, band high", () => {
    const result = scoreAsrs(new Array(ASRS_PART_A_ITEMS.length).fill(4) as never);
    expect(result.total).toBe(24);
    expect(result.band).toBe("high");
  });

  it("sums raw answers without any shaded-box thresholding", () => {
    const result = scoreAsrs([1, 1, 1, 1, 1, 1]);
    expect(result.total).toBe(6);
  });
});

describe("bandForTotal boundaries", () => {
  it("keeps 9 in low, flips to midLow at 10", () => {
    expect(bandForTotal(9)).toBe("low");
    expect(bandForTotal(10)).toBe("midLow");
  });

  it("keeps 13 in midLow, flips to midHigh at 14", () => {
    expect(bandForTotal(13)).toBe("midLow");
    expect(bandForTotal(14)).toBe("midHigh");
  });

  it("keeps 17 in midHigh, flips to high at 18", () => {
    expect(bandForTotal(17)).toBe("midHigh");
    expect(bandForTotal(18)).toBe("high");
  });
});
