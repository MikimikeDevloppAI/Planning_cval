import type { SupabaseClient } from "../helpers";
import type {
  PlanningSite,
  PlanningDepartment,
  PlanningDay,
  PlanningBlock,
  PlanningAssignment,
  StaffingNeed,
} from "@/lib/types/database";
import {
  VIRTUAL_SITE_ADMIN,
  VIRTUAL_SITE_SURGERY,
  VIRTUAL_DEPT_ADMIN,
  VIRTUAL_DEPT_SURGERY,
  DEPT_ADMINISTRATION,
  DEPT_BLOC_OPERATOIRE,
} from "@/lib/constants";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  getDay,
  eachDayOfInterval,
} from "date-fns";

// ============================================================
// Types
// ============================================================

interface LeaveRecord {
  id_staff: number;
  start_date: string;
  end_date: string;
  period: string | null;
}

interface RawBlock {
  id_block: number;
  date: string;
  period: string;
  block_type: string;
  id_department: number;
  departments: {
    name: string;
    id_site: number;
    sites: { name: string };
  };
  assignments: Array<{
    id_assignment: number;
    id_staff: number;
    assignment_type: string;
    id_role: number | null;
    id_skill: number | null;
    id_activity: number | null;
    id_linked_doctor: number | null;
    source: string;
    status: string;
    id_schedule: number | null;
    staff: { firstname: string; lastname: string; id_primary_position: number };
    secretary_roles: { name: string } | null;
    skills: { name: string } | null;
    activity_templates: { name: string } | null;
  }>;
}

interface MonthPlanningData {
  days: string[];
  sites: PlanningSite[];
  stats: {
    totalNeeds: number;
    filled: number;
    gaps: number;
    proposed: number;
    confirmed: number;
    published: number;
  };
}

// ============================================================
// Transform helpers
// ============================================================

export function buildAbsentKeys(leaves: LeaveRecord[], startStr: string, endStr: string): Set<string> {
  const keys = new Set<string>();
  for (const leave of leaves) {
    const from = leave.start_date < startStr ? startStr : leave.start_date;
    const to = leave.end_date > endStr ? endStr : leave.end_date;
    let cursor = new Date(from);
    const end = new Date(to);
    while (cursor <= end) {
      const dateStr = format(cursor, "yyyy-MM-dd");
      if (leave.period === "AM" || leave.period === null) {
        keys.add(`${leave.id_staff}:${dateStr}:AM`);
      }
      if (leave.period === "PM" || leave.period === null) {
        keys.add(`${leave.id_staff}:${dateStr}:PM`);
      }
      cursor = addDays(cursor, 1);
    }
  }
  return keys;
}

function transformBlock(raw: RawBlock, absentKeys: Set<string>): PlanningBlock {
  const activeAssignments = (raw.assignments ?? [])
    .filter((a) => a.status !== "CANCELLED" && a.status !== "INVALIDATED")
    .filter((a) => !absentKeys.has(`${a.id_staff}:${raw.date}:${raw.period}`));

  return {
    id_block: raw.id_block,
    id_department: raw.id_department,
    block_type: raw.block_type as PlanningBlock["block_type"],
    assignments: activeAssignments.map((a) => ({
      id_assignment: a.id_assignment,
      id_staff: a.id_staff,
      firstname: a.staff.firstname,
      lastname: a.staff.lastname,
      assignment_type: a.assignment_type as PlanningAssignment["assignment_type"],
      id_role: a.id_role,
      role_name: a.secretary_roles?.name ?? null,
      id_skill: a.id_skill,
      skill_name: a.skills?.name ?? null,
      id_activity: a.id_activity ?? null,
      activity_name: a.activity_templates?.name ?? null,
      id_linked_doctor: a.id_linked_doctor ?? null,
      source: a.source as PlanningAssignment["source"],
      status: a.status as PlanningAssignment["status"],
      id_primary_position: a.staff.id_primary_position as PlanningAssignment["id_primary_position"],
      id_schedule: a.id_schedule ?? null,
    })),
  };
}

export function buildSiteMap(rawBlocks: RawBlock[]) {
  const siteMap = new Map<
    number,
    { name: string; depts: Map<number, { name: string; blocks: RawBlock[] }> }
  >();

  for (const block of rawBlocks) {
    const dept = block.departments;
    const siteId = dept.id_site;
    const siteName = dept.sites.name;
    const deptId = block.id_department;
    const deptName = dept.name;

    if (!siteMap.has(siteId)) {
      siteMap.set(siteId, { name: siteName, depts: new Map() });
    }
    const site = siteMap.get(siteId)!;
    if (!site.depts.has(deptId)) {
      site.depts.set(deptId, { name: deptName, blocks: [] });
    }
    site.depts.get(deptId)!.blocks.push(block);
  }

  return siteMap;
}

export function buildNeedsIndex(needs: StaffingNeed[]) {
  const needsByBlock = new Map<number, StaffingNeed[]>();
  for (const need of needs) {
    if (!needsByBlock.has(need.id_block)) {
      needsByBlock.set(need.id_block, []);
    }
    needsByBlock.get(need.id_block)!.push(need);
  }
  return needsByBlock;
}

export function computeStats(rawBlocks: RawBlock[], needs: StaffingNeed[]) {
  let totalNeeds = 0;
  let filled = 0;
  let gaps = 0;
  let proposed = 0;
  let confirmed = 0;
  let published = 0;

  for (const need of needs) {
    totalNeeds += need.needed;
    filled += need.assigned;
    if (need.gap > 0) gaps += need.gap;
  }

  for (const block of rawBlocks) {
    for (const a of block.assignments ?? []) {
      if (a.status === "CANCELLED" || a.status === "INVALIDATED") continue;
      if (a.assignment_type !== "SECRETARY") continue;
      if (a.status === "PROPOSED") proposed++;
      if (a.status === "CONFIRMED") confirmed++;
      if (a.status === "PUBLISHED") published++;
    }
  }

  return { totalNeeds, filled, gaps, proposed, confirmed, published };
}

function extractVirtualSites(
  siteMap: ReturnType<typeof buildSiteMap>,
  needsByBlock: Map<number, StaffingNeed[]>,
  days: string[],
  absentKeys: Set<string>
) {
  const buildDays = (blocks: RawBlock[]): PlanningDay[] =>
    days.map((dateStr) => {
      const dayBlocks = blocks.filter((b) => b.date === dateStr);
      const amBlocks = dayBlocks.filter((b) => b.period === "AM");
      const pmBlocks = dayBlocks.filter((b) => b.period === "PM");
      return {
        date: dateStr,
        am: {
          blocks: amBlocks.map((b) => transformBlock(b, absentKeys)),
          needs: amBlocks.flatMap((b) =>
            (needsByBlock.get(b.id_block) ?? [])
          ),
        },
        pm: {
          blocks: pmBlocks.map((b) => transformBlock(b, absentKeys)),
          needs: pmBlocks.flatMap((b) =>
            (needsByBlock.get(b.id_block) ?? [])
          ),
        },
      };
    });

  // Extract Administration
  const adminBlocks: RawBlock[] = [];
  for (const [, siteData] of siteMap) {
    for (const [deptId, deptData] of siteData.depts) {
      if (deptData.name === DEPT_ADMINISTRATION) {
        adminBlocks.push(...deptData.blocks);
        siteData.depts.delete(deptId);
      }
    }
  }

  // Extract Bloc opératoire
  const surgeryBlocks: RawBlock[] = [];
  for (const [, siteData] of siteMap) {
    for (const [deptId, deptData] of siteData.depts) {
      if (deptData.name === DEPT_BLOC_OPERATOIRE) {
        surgeryBlocks.push(...deptData.blocks);
        siteData.depts.delete(deptId);
      }
    }
  }

  // Remove empty sites
  for (const [siteId, siteData] of siteMap) {
    if (siteData.depts.size === 0) siteMap.delete(siteId);
  }

  // Build sites array
  const sites: PlanningSite[] = [];

  // Administration first
  if (adminBlocks.length > 0) {
    sites.push({
      id_site: VIRTUAL_SITE_ADMIN,
      name: DEPT_ADMINISTRATION,
      departments: [
        {
          id_department: VIRTUAL_DEPT_ADMIN,
          name: DEPT_ADMINISTRATION,
          days: buildDays(adminBlocks),
        },
      ],
    });
  }

  // Regular sites
  for (const [siteId, siteData] of Array.from(siteMap.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  )) {
    const departments: PlanningDepartment[] = [];
    for (const [deptId, deptData] of Array.from(siteData.depts.entries()).sort(
      (a, b) => a[1].name.localeCompare(b[1].name)
    )) {
      departments.push({
        id_department: deptId,
        name: deptData.name,
        days: buildDays(deptData.blocks),
      });
    }
    sites.push({ id_site: siteId, name: siteData.name, departments });
  }

  // Bloc Opératoire last
  if (surgeryBlocks.length > 0) {
    sites.push({
      id_site: VIRTUAL_SITE_SURGERY,
      name: "Bloc Opératoire",
      departments: [
        {
          id_department: VIRTUAL_DEPT_SURGERY,
          name: DEPT_BLOC_OPERATOIRE,
          days: buildDays(surgeryBlocks),
        },
      ],
    });
  }

  return sites;
}

function transformMonthData(
  rawBlocks: RawBlock[],
  needs: StaffingNeed[],
  days: string[],
  absentKeys: Set<string>
): MonthPlanningData {
  const siteMap = buildSiteMap(rawBlocks);
  const needsByBlock = buildNeedsIndex(needs);
  const stats = computeStats(rawBlocks, needs);
  const sites = extractVirtualSites(siteMap, needsByBlock, days, absentKeys);

  return { days, sites, stats };
}

function transformWeekData(
  rawBlocks: RawBlock[],
  needs: StaffingNeed[],
  weekStart: string,
  absentKeys: Set<string>
) {
  const wsDate = new Date(weekStart);
  const daysWithBlocks = new Set(rawBlocks.map((b) => b.date.slice(0, 10)));
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = format(addDays(wsDate, i), "yyyy-MM-dd");
    if (i < 5 || daysWithBlocks.has(d)) {
      days.push(d);
    }
  }

  const siteMap = buildSiteMap(rawBlocks);
  const needsByBlock = buildNeedsIndex(needs);
  const stats = computeStats(rawBlocks, needs);
  const sites = extractVirtualSites(siteMap, needsByBlock, days, absentKeys);

  return { sites, stats };
}

// ============================================================
// Fetchers
// ============================================================

const BLOCK_SELECT = `id_block, date, period, block_type, id_department,
  departments!inner (
    name, id_site,
    sites!inner ( name )
  ),
  assignments (
    id_assignment, id_staff, assignment_type, id_role, id_skill,
    id_activity, id_linked_doctor,
    source, status, id_schedule,
    staff!inner ( firstname, lastname, id_primary_position ),
    secretary_roles ( name ),
    skills ( name ),
    activity_templates ( name )
  )`;

export async function fetchMonthPlanning(
  supabase: SupabaseClient,
  month: string
): Promise<MonthPlanningData> {
  const monthDate = new Date(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const startDay = getDay(monthStart);
  const rangeStart = (startDay >= 2 && startDay <= 5)
    ? startOfWeek(monthStart, { weekStartsOn: 1 })
    : monthStart;

  const endDay = getDay(monthEnd);
  const rangeEnd = (endDay >= 1 && endDay <= 4)
    ? addDays(endOfWeek(monthEnd, { weekStartsOn: 1 }), -1)
    : monthEnd;

  const startStr = format(rangeStart, "yyyy-MM-dd");
  const endStr = format(rangeEnd, "yyyy-MM-dd");

  const [blocksRes, needsRes, leavesRes] = await Promise.all([
    supabase
      .from("work_blocks")
      .select(BLOCK_SELECT)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date")
      .order("period"),
    supabase
      .from("v_staffing_needs")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr),
    supabase
      .from("staff_leaves")
      .select("id_staff, start_date, end_date, period")
      .lte("start_date", endStr)
      .gte("end_date", startStr),
  ]);

  if (blocksRes.error) throw new Error(`Blocks query error: ${blocksRes.error.message}`);
  if (needsRes.error) throw new Error(`Needs query error: ${needsRes.error.message}`);
  if (leavesRes.error) throw new Error(`Leaves query error: ${leavesRes.error.message}`);

  const rawBlocks = (blocksRes.data ?? []) as unknown as RawBlock[];
  const needs = (needsRes.data ?? []) as StaffingNeed[];
  const leaves = (leavesRes.data ?? []) as LeaveRecord[];
  const absentKeys = buildAbsentKeys(leaves, startStr, endStr);

  const daysWithBlocks = new Set(rawBlocks.map((b) => b.date.slice(0, 10)));
  const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    .filter((d) => getDay(d) !== 0)
    .map((d) => format(d, "yyyy-MM-dd"))
    .filter((d) => getDay(new Date(d)) !== 6 || daysWithBlocks.has(d));

  return transformMonthData(rawBlocks, needs, allDays, absentKeys);
}

export async function fetchWeekPlanning(supabase: SupabaseClient, weekStart: string) {
  const wsDate = new Date(weekStart);
  const weekEnd = format(addDays(wsDate, 5), "yyyy-MM-dd");

  const [blocksRes, needsRes, leavesRes] = await Promise.all([
    supabase
      .from("work_blocks")
      .select(BLOCK_SELECT)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date")
      .order("period"),
    supabase
      .from("v_staffing_needs")
      .select("*")
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("staff_leaves")
      .select("id_staff, start_date, end_date, period")
      .lte("start_date", weekEnd)
      .gte("end_date", weekStart),
  ]);

  if (blocksRes.error) throw new Error(`Blocks query error: ${blocksRes.error.message}`);
  if (needsRes.error) throw new Error(`Needs query error: ${needsRes.error.message}`);
  if (leavesRes.error) throw new Error(`Leaves query error: ${leavesRes.error.message}`);

  const rawBlocks = (blocksRes.data ?? []) as unknown as RawBlock[];
  const needs = (needsRes.data ?? []) as StaffingNeed[];
  const leaves = (leavesRes.data ?? []) as LeaveRecord[];
  const absentKeys = buildAbsentKeys(leaves, weekStart, weekEnd);

  return transformWeekData(rawBlocks, needs, weekStart, absentKeys);
}
