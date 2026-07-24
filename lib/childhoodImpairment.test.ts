import { describe, expect, it } from "vitest";
import { suggestsBroaderPattern } from "./childhoodImpairment";

describe("suggestsBroaderPattern", () => {
  it("is true only when childhood onset is yes AND impairment spans 2+ areas", () => {
    expect(
      suggestsBroaderPattern({ childhoodOnset: "yes", impairmentAreas: "twoOrMore" })
    ).toBe(true);
    expect(
      suggestsBroaderPattern({ childhoodOnset: "yes", impairmentAreas: "almostAll" })
    ).toBe(true);
  });

  it("is false when childhood onset is not yes, regardless of impairment areas", () => {
    expect(
      suggestsBroaderPattern({ childhoodOnset: "unsure", impairmentAreas: "almostAll" })
    ).toBe(false);
    expect(
      suggestsBroaderPattern({ childhoodOnset: "no", impairmentAreas: "twoOrMore" })
    ).toBe(false);
  });

  it("is false when impairment is limited to one area even with childhood onset", () => {
    expect(
      suggestsBroaderPattern({ childhoodOnset: "yes", impairmentAreas: "one" })
    ).toBe(false);
  });
});
