import { describe, it, expect } from "vitest";
import {
  getWeekStart,
  getWeekDays,
  formatDayLabel,
  formatDayShort,
  formatWeekRange,
  toISODate,
  isSaturday,
} from "./dates";

describe("getWeekStart", () => {
  it("returns Monday for a Wednesday", () => {
    const wed = new Date("2026-02-25"); // Wednesday
    const monday = getWeekStart(wed);
    expect(toISODate(monday)).toBe("2026-02-23");
  });

  it("returns same day for a Monday", () => {
    const mon = new Date("2026-02-23");
    expect(toISODate(getWeekStart(mon))).toBe("2026-02-23");
  });

  it("returns previous Monday for a Sunday", () => {
    const sun = new Date("2026-03-01"); // Sunday
    const monday = getWeekStart(sun);
    expect(toISODate(monday)).toBe("2026-02-23");
  });
});

describe("getWeekDays", () => {
  it("returns 6 days Mon-Sat", () => {
    const monday = new Date("2026-02-23");
    const days = getWeekDays(monday);
    expect(days).toHaveLength(6);
    expect(toISODate(days[0])).toBe("2026-02-23"); // Mon
    expect(toISODate(days[5])).toBe("2026-02-28"); // Sat
  });
});

describe("formatDayLabel", () => {
  it("formats date with full day name in French", () => {
    const date = new Date("2026-02-23");
    const label = formatDayLabel(date);
    expect(label).toBe("lundi 23/02");
  });
});

describe("formatDayShort", () => {
  it("formats as dd/MM", () => {
    const date = new Date("2026-02-09");
    expect(formatDayShort(date)).toBe("09/02");
  });
});

describe("formatWeekRange", () => {
  it("formats as 'Sem. du DD MMM au DD MMM YYYY'", () => {
    const monday = new Date("2026-02-23");
    const range = formatWeekRange(monday);
    expect(range).toContain("Sem. du");
    expect(range).toContain("2026");
    expect(range).toContain("23");
    expect(range).toContain("28");
  });
});

describe("toISODate", () => {
  it("formats as yyyy-MM-dd", () => {
    const date = new Date("2026-02-09");
    expect(toISODate(date)).toBe("2026-02-09");
  });
});

describe("isSaturday", () => {
  it("returns true for Saturday", () => {
    expect(isSaturday(new Date("2026-02-28"))).toBe(true);
  });

  it("returns false for Friday", () => {
    expect(isSaturday(new Date("2026-02-27"))).toBe(false);
  });
});
