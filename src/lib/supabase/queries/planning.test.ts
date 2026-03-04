import { describe, it, expect } from "vitest";
import { buildAbsentKeys, buildSiteMap, buildNeedsIndex, computeStats } from "./planning";
import type { StaffingNeed } from "@/lib/types/database";

// ── buildAbsentKeys ──────────────────────────────────────

describe("buildAbsentKeys", () => {
  it("generates AM and PM keys for full-day leave (period=null)", () => {
    const leaves = [
      { id_staff: 1, start_date: "2026-02-23", end_date: "2026-02-23", period: null },
    ];
    const keys = buildAbsentKeys(leaves, "2026-02-23", "2026-02-23");
    expect(keys.has("1:2026-02-23:AM")).toBe(true);
    expect(keys.has("1:2026-02-23:PM")).toBe(true);
  });

  it("generates only AM key for AM leave", () => {
    const leaves = [
      { id_staff: 2, start_date: "2026-02-24", end_date: "2026-02-24", period: "AM" },
    ];
    const keys = buildAbsentKeys(leaves, "2026-02-24", "2026-02-24");
    expect(keys.has("2:2026-02-24:AM")).toBe(true);
    expect(keys.has("2:2026-02-24:PM")).toBe(false);
  });

  it("generates only PM key for PM leave", () => {
    const leaves = [
      { id_staff: 3, start_date: "2026-02-24", end_date: "2026-02-24", period: "PM" },
    ];
    const keys = buildAbsentKeys(leaves, "2026-02-24", "2026-02-24");
    expect(keys.has("3:2026-02-24:AM")).toBe(false);
    expect(keys.has("3:2026-02-24:PM")).toBe(true);
  });

  it("handles multi-day leaves", () => {
    const leaves = [
      { id_staff: 1, start_date: "2026-02-23", end_date: "2026-02-25", period: null },
    ];
    const keys = buildAbsentKeys(leaves, "2026-02-23", "2026-02-25");
    expect(keys.size).toBe(6); // 3 days × 2 periods
  });

  it("clips leave dates to range", () => {
    const leaves = [
      { id_staff: 1, start_date: "2026-02-20", end_date: "2026-02-28", period: null },
    ];
    const keys = buildAbsentKeys(leaves, "2026-02-23", "2026-02-25");
    expect(keys.has("1:2026-02-23:AM")).toBe(true);
    expect(keys.has("1:2026-02-25:PM")).toBe(true);
    expect(keys.has("1:2026-02-22:AM")).toBe(false);
    expect(keys.has("1:2026-02-26:AM")).toBe(false);
  });

  it("returns empty set for no leaves", () => {
    const keys = buildAbsentKeys([], "2026-02-23", "2026-02-25");
    expect(keys.size).toBe(0);
  });
});

// ── buildSiteMap ─────────────────────────────────────────

describe("buildSiteMap", () => {
  const makeBlock = (overrides: Partial<{
    id_block: number;
    id_department: number;
    deptName: string;
    siteId: number;
    siteName: string;
  }> = {}) => ({
    id_block: overrides.id_block ?? 1,
    date: "2026-02-23",
    period: "AM",
    block_type: "CONSULTATION",
    id_department: overrides.id_department ?? 10,
    id_room: null as number | null,
    id_activity: null as number | null,
    departments: {
      name: overrides.deptName ?? "Ophtalmologie",
      id_site: overrides.siteId ?? 100,
      sites: { name: overrides.siteName ?? "Clinique la Vallée" },
    },
    rooms: null as { name: string } | null,
    activity_templates: null as { name: string } | null,
    assignments: [],
  });

  it("groups blocks by site and department", () => {
    const blocks = [
      makeBlock({ id_block: 1, id_department: 10, siteId: 100 }),
      makeBlock({ id_block: 2, id_department: 10, siteId: 100 }),
      makeBlock({ id_block: 3, id_department: 20, siteId: 100, deptName: "Urgences" }),
    ];
    const map = buildSiteMap(blocks);
    expect(map.size).toBe(1); // one site
    const site = map.get(100)!;
    expect(site.depts.size).toBe(2); // two departments
    expect(site.depts.get(10)!.blocks).toHaveLength(2);
    expect(site.depts.get(20)!.blocks).toHaveLength(1);
  });

  it("handles multiple sites", () => {
    const blocks = [
      makeBlock({ siteId: 100, siteName: "CVAL" }),
      makeBlock({ id_block: 2, siteId: 200, siteName: "PTY", id_department: 20 }),
    ];
    const map = buildSiteMap(blocks);
    expect(map.size).toBe(2);
    expect(map.get(100)!.name).toBe("CVAL");
    expect(map.get(200)!.name).toBe("PTY");
  });

  it("returns empty map for no blocks", () => {
    const map = buildSiteMap([]);
    expect(map.size).toBe(0);
  });
});

// ── buildNeedsIndex ──────────────────────────────────────

describe("buildNeedsIndex", () => {
  it("indexes needs by block ID", () => {
    const needs = [
      { id_block: 1, needed: 2, assigned: 1, gap: 1 },
      { id_block: 1, needed: 1, assigned: 0, gap: 1 },
      { id_block: 2, needed: 3, assigned: 3, gap: 0 },
    ] as unknown as StaffingNeed[];
    const index = buildNeedsIndex(needs);
    expect(index.get(1)).toHaveLength(2);
    expect(index.get(2)).toHaveLength(1);
  });

  it("returns empty map for no needs", () => {
    const index = buildNeedsIndex([]);
    expect(index.size).toBe(0);
  });
});

// ── computeStats ─────────────────────────────────────────

describe("computeStats", () => {
  it("computes correct totals from needs", () => {
    const needs = [
      { id_block: 1, needed: 3, assigned: 2, gap: 1 },
      { id_block: 2, needed: 2, assigned: 2, gap: 0 },
    ] as unknown as StaffingNeed[];
    const stats = computeStats([], needs);
    expect(stats.totalNeeds).toBe(5);
    expect(stats.filled).toBe(4);
    expect(stats.gaps).toBe(1);
  });

  it("counts secretary assignment statuses", () => {
    const blocks = [
      {
        id_block: 1,
        date: "2026-02-23",
        period: "AM",
        block_type: "CONSULTATION",
        id_department: 10,
        id_room: null as number | null,
        id_activity: null as number | null,
        departments: { name: "Oph", id_site: 1, sites: { name: "S" } },
        rooms: null as { name: string } | null,
        activity_templates: null as { name: string } | null,
        assignments: [
          { id_assignment: 1, assignment_type: "SECRETARY", status: "PROPOSED", id_staff: 1, id_role: 1, id_skill: null, id_activity: null, id_linked_doctor: null, source: "SOLVER", id_schedule: null, staff: { firstname: "A", lastname: "B", id_primary_position: 2 }, secretary_roles: null, skills: null, activity_templates: null },
          { id_assignment: 2, assignment_type: "SECRETARY", status: "CONFIRMED", id_staff: 2, id_role: 1, id_skill: null, id_activity: null, id_linked_doctor: null, source: "SOLVER", id_schedule: null, staff: { firstname: "C", lastname: "D", id_primary_position: 2 }, secretary_roles: null, skills: null, activity_templates: null },
          { id_assignment: 3, assignment_type: "SECRETARY", status: "PUBLISHED", id_staff: 3, id_role: 1, id_skill: null, id_activity: null, id_linked_doctor: null, source: "SOLVER", id_schedule: null, staff: { firstname: "E", lastname: "F", id_primary_position: 2 }, secretary_roles: null, skills: null, activity_templates: null },
          { id_assignment: 4, assignment_type: "DOCTOR", status: "PUBLISHED", id_staff: 4, id_role: null, id_skill: null, id_activity: null, id_linked_doctor: null, source: "SCHEDULE", id_schedule: null, staff: { firstname: "G", lastname: "H", id_primary_position: 1 }, secretary_roles: null, skills: null, activity_templates: null },
          { id_assignment: 5, assignment_type: "SECRETARY", status: "CANCELLED", id_staff: 5, id_role: 1, id_skill: null, id_activity: null, id_linked_doctor: null, source: "SOLVER", id_schedule: null, staff: { firstname: "I", lastname: "J", id_primary_position: 2 }, secretary_roles: null, skills: null, activity_templates: null },
        ],
      },
    ];
    const stats = computeStats(blocks, []);
    expect(stats.proposed).toBe(1);
    expect(stats.confirmed).toBe(1);
    expect(stats.published).toBe(1); // only SECRETARY, not DOCTOR
  });

  it("ignores negative gaps", () => {
    const needs = [
      { id_block: 1, needed: 1, assigned: 2, gap: -1 },
    ] as unknown as StaffingNeed[];
    const stats = computeStats([], needs);
    expect(stats.gaps).toBe(0);
  });
});
