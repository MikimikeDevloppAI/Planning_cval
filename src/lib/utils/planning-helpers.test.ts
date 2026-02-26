import { describe, it, expect } from "vitest";
import { weekSepStyle, abbreviateSite, abbreviateDept } from "./planning-helpers";

describe("weekSepStyle", () => {
  it("returns border style when week start and not first col", () => {
    const style = weekSepStyle(true, false);
    expect(style).toEqual({ borderLeft: "2px solid rgb(203 213 225)" });
  });

  it("returns undefined when not week start", () => {
    expect(weekSepStyle(false, false)).toBeUndefined();
  });

  it("returns undefined when first col even if week start", () => {
    expect(weekSepStyle(true, true)).toBeUndefined();
  });

  it("returns undefined when neither week start nor first col issue", () => {
    expect(weekSepStyle(false, true)).toBeUndefined();
  });
});

describe("abbreviateSite", () => {
  it("returns CVAL for 'clinique la vallée'", () => {
    expect(abbreviateSite("clinique la vallée")).toBe("CVAL");
  });

  it("returns PTY for 'porrentruy'", () => {
    expect(abbreviateSite("porrentruy")).toBe("PTY");
  });

  it("is case-insensitive", () => {
    expect(abbreviateSite("Clinique La Vallée")).toBe("CVAL");
  });

  it("trims whitespace", () => {
    expect(abbreviateSite("  porrentruy  ")).toBe("PTY");
  });

  it("returns first 4 chars uppercase for unknown site", () => {
    expect(abbreviateSite("Lausanne")).toBe("LAUS");
  });

  it("handles short unknown names", () => {
    expect(abbreviateSite("AB")).toBe("AB");
  });
});

describe("abbreviateDept", () => {
  it("returns name as-is if <= 10 characters", () => {
    expect(abbreviateDept("Urgences")).toBe("Urgences");
    expect(abbreviateDept("1234567890")).toBe("1234567890");
  });

  it("truncates and adds dot if > 10 characters", () => {
    expect(abbreviateDept("Bloc opératoire")).toBe("Bloc opér.");
  });

  it("truncates to exactly 9 chars + dot", () => {
    expect(abbreviateDept("12345678901")).toBe("123456789.");
  });
});
