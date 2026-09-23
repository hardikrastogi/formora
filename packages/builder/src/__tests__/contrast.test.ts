import { describe, expect, it } from "vitest";
import { contrastAgainstWhite, WCAG_AA_NORMAL_TEXT } from "../contrast";

describe("contrastAgainstWhite", () => {
  it("returns null for an unparsable colour", () => {
    expect(contrastAgainstWhite("not-a-color")).toBeNull();
  });

  it("gives black the maximum contrast against white", () => {
    expect(contrastAgainstWhite("#000000")).toBeCloseTo(21, 0);
  });

  it("gives white the minimum contrast against white", () => {
    expect(contrastAgainstWhite("#ffffff")).toBeCloseTo(1, 1);
  });

  it("flags a light colour as failing WCAG AA and a dark one as passing", () => {
    expect(contrastAgainstWhite("#eeeeee")!).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    expect(contrastAgainstWhite("#1d4ed8")!).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
