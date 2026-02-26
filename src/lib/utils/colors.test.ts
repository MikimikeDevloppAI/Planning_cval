import { describe, it, expect } from "vitest";
import {
  getRoleColors,
  getStatusBorder,
  ROLE_COLORS,
  DOCTOR_COLORS,
  ADMIN_COLORS,
  SURGERY_COLORS,
} from "./colors";

describe("getRoleColors", () => {
  it("returns DOCTOR_COLORS for DOCTOR assignment", () => {
    expect(getRoleColors("DOCTOR", null)).toBe(DOCTOR_COLORS);
  });

  it("returns DOCTOR_COLORS for DOCTOR even with roleId", () => {
    expect(getRoleColors("DOCTOR", 1)).toBe(DOCTOR_COLORS);
  });

  it("returns ADMIN_COLORS for ADMIN block type", () => {
    expect(getRoleColors("SECRETARY", null, "ADMIN")).toBe(ADMIN_COLORS);
  });

  it("returns SURGERY_COLORS for SURGERY block type", () => {
    expect(getRoleColors("SECRETARY", null, "SURGERY")).toBe(SURGERY_COLORS);
  });

  it("returns role-specific colors for SECRETARY with valid roleId", () => {
    expect(getRoleColors("SECRETARY", 1)).toBe(ROLE_COLORS[1]);
    expect(getRoleColors("SECRETARY", 2)).toBe(ROLE_COLORS[2]);
    expect(getRoleColors("SECRETARY", 3)).toBe(ROLE_COLORS[3]);
  });

  it("returns default colors for SECRETARY with unknown roleId", () => {
    const colors = getRoleColors("SECRETARY", 99);
    expect(colors.bg).toBe("bg-gray-50");
  });

  it("returns default colors for SECRETARY with null roleId and no block type", () => {
    const colors = getRoleColors("SECRETARY", null);
    expect(colors.bg).toBe("bg-gray-50");
  });
});

describe("getStatusBorder", () => {
  it("returns dashed for PROPOSED", () => {
    expect(getStatusBorder("PROPOSED")).toBe("border-dashed");
  });

  it("returns solid for CONFIRMED", () => {
    expect(getStatusBorder("CONFIRMED")).toBe("border-solid");
  });

  it("returns solid border-2 for PUBLISHED", () => {
    expect(getStatusBorder("PUBLISHED")).toBe("border-solid border-2");
  });

  it("returns solid for unknown status", () => {
    expect(getStatusBorder("OTHER")).toBe("border-solid");
  });
});
