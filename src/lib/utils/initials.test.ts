import { describe, it, expect } from "vitest";
import { getInitials, buildInitialsMap, formatNameShort } from "./initials";

describe("getInitials", () => {
  it("returns first letters of first and last name uppercased", () => {
    expect(getInitials("Lucie", "Bron")).toBe("LB");
  });

  it("handles single character names", () => {
    expect(getInitials("A", "B")).toBe("AB");
  });

  it("handles empty strings", () => {
    expect(getInitials("", "")).toBe("");
  });

  it("trims whitespace", () => {
    expect(getInitials("  Jean ", "  Dupont  ")).toBe("JD");
  });

  it("handles lowercase input", () => {
    expect(getInitials("lucie", "bron")).toBe("LB");
  });
});

describe("buildInitialsMap", () => {
  it("returns unique initials for non-colliding names", () => {
    const people = [
      { id_staff: 1, firstname: "Lucie", lastname: "Bron" },
      { id_staff: 2, firstname: "Marc", lastname: "Dupont" },
    ];
    const map = buildInitialsMap(people);
    expect(map.get(1)).toBe("LB");
    expect(map.get(2)).toBe("MD");
  });

  it("disambiguates colliding initials with 2nd letter of lastname", () => {
    const people = [
      { id_staff: 1, firstname: "Sonia", lastname: "Kerkour" },
      { id_staff: 2, firstname: "Soydan", lastname: "Kurun" },
    ];
    const map = buildInitialsMap(people);
    expect(map.get(1)).toBe("SKe");
    expect(map.get(2)).toBe("SKu");
  });

  it("handles empty array", () => {
    const map = buildInitialsMap([]);
    expect(map.size).toBe(0);
  });

  it("handles three-way collision", () => {
    const people = [
      { id_staff: 1, firstname: "Alain", lastname: "Blanc" },
      { id_staff: 2, firstname: "Anne", lastname: "Bertrand" },
      { id_staff: 3, firstname: "André", lastname: "Bonnet" },
    ];
    const map = buildInitialsMap(people);
    expect(map.get(1)).toBe("ABl");
    expect(map.get(2)).toBe("ABe");
    expect(map.get(3)).toBe("ABo");
  });
});

describe("formatNameShort", () => {
  it("formats as 'Lastname F.'", () => {
    expect(formatNameShort("Lucie", "Bron")).toBe("Bron L.");
  });

  it("handles empty firstname", () => {
    expect(formatNameShort("", "Dupont")).toBe("Dupont .");
  });
});
