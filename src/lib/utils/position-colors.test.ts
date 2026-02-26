import { describe, it, expect } from "vitest";
import { getPositionColors } from "./position-colors";

describe("getPositionColors", () => {
  it("returns navy colors for Médecin (position 1)", () => {
    const colors = getPositionColors(1);
    expect(colors.hex).toBe("#4A6FA5");
  });

  it("returns sage/teal colors for Secrétaire (position 2)", () => {
    const colors = getPositionColors(2);
    expect(colors.hex).toBe("#6B8A7A");
  });

  it("returns mauve colors for Obstétricienne (position 3)", () => {
    const colors = getPositionColors(3);
    expect(colors.hex).toBe("#9B7BA8");
  });

  it("falls back to position 2 colors for unknown position", () => {
    const colors = getPositionColors(99);
    expect(colors.hex).toBe("#6B8A7A");
  });

  it("returns all expected color keys", () => {
    const colors = getPositionColors(1);
    expect(colors).toHaveProperty("bg");
    expect(colors).toHaveProperty("text");
    expect(colors).toHaveProperty("border");
    expect(colors).toHaveProperty("avatar");
    expect(colors).toHaveProperty("badge");
    expect(colors).toHaveProperty("ring");
    expect(colors).toHaveProperty("gradient");
    expect(colors).toHaveProperty("hex");
    expect(colors).toHaveProperty("hexLight");
  });
});
