import { createAdminClient } from "@/lib/supabase/server";
import type {
  PlanningData,
  PlanningSite,
  PlanningDepartment,
  PlanningDay,
  PlanningBlock,
  PlanningAssignment,
  StaffingNeed,
  Period,
} from "@/lib/types/database";
import { addDays, format } from "date-fns";

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
    source: string;
    status: string;
    staff: { firstname: string; lastname: string; id_primary_position: number };
    secretary_roles: { name: string } | null;
    skills: { name: string } | null;
  }>;
}

export async function fetchPlanningData(weekStart: string): Promise<PlanningData> {
  const supabase = createAdminClient();
  const wsDate = new Date(weekStart);
  const weekEnd = format(addDays(wsDate, 5), "yyyy-MM-dd"); // Saturday

  // Fetch blocks with nested assignments
  const { data: blocks, error: blocksError } = await supabase
    .from("work_blocks")
    .select(
      `
      id_block, date, period, block_type, id_department,
      departments!inner (
        name, id_site,
        sites!inner ( name )
      ),
      assignments (
        id_assignment, id_staff, assignment_type, id_role, id_skill,
        source, status,
        staff!inner ( firstname, lastname, id_primary_position ),
        secretary_roles ( name ),
        skills ( name )
      )
    `
    )
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .order("date")
    .order("period");

  if (blocksError) throw new Error(`Blocks query error: ${blocksError.message}`);

  // Fetch staffing needs
  const { data: needsRaw, error: needsError } = await supabase
    .from("v_staffing_needs")
    .select("*")
    .gte("date", weekStart)
    .lte("date", weekEnd);

  if (needsError) throw new Error(`Needs query error: ${needsError.message}`);

  const needs = (needsRaw ?? []) as StaffingNeed[];

  // Transform into hierarchical structure
  return transformPlanningData(
    (blocks ?? []) as unknown as RawBlock[],
    needs,
    weekStart
  );
}

function transformPlanningData(
  rawBlocks: RawBlock[],
  needs: StaffingNeed[],
  weekStart: string
): PlanningData {
  const wsDate = new Date(weekStart);
  const days: string[] = [];
  for (let i = 0; i < 6; i++) {
    days.push(format(addDays(wsDate, i), "yyyy-MM-dd"));
  }

  // Group blocks by site > dept > date > period
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

    // Skip Administration department for main grid
    if (deptName === "Administration") continue;

    if (!siteMap.has(siteId)) {
      siteMap.set(siteId, { name: siteName, depts: new Map() });
    }
    const site = siteMap.get(siteId)!;
    if (!site.depts.has(deptId)) {
      site.depts.set(deptId, { name: deptName, blocks: [] });
    }
    site.depts.get(deptId)!.blocks.push(block);
  }

  // Build needs index: key = `${date}-${period}-${id_department}`
  // But v_staffing_needs doesn't have id_department directly, we need id_block
  // Actually the view has department name + site name, and we need to match by block
  const needsByBlock = new Map<number, StaffingNeed[]>();
  for (const need of needs) {
    if (!needsByBlock.has(need.id_block)) {
      needsByBlock.set(need.id_block, []);
    }
    needsByBlock.get(need.id_block)!.push(need);
  }

  // Stats
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

  // Count assignment statuses
  for (const block of rawBlocks) {
    for (const a of block.assignments ?? []) {
      if (a.status === "CANCELLED" || a.status === "INVALIDATED") continue;
      if (a.assignment_type !== "SECRETARY") continue;
      if (a.status === "PROPOSED") proposed++;
      if (a.status === "CONFIRMED") confirmed++;
      if (a.status === "PUBLISHED") published++;
    }
  }

  // Build the final structure
  const sites: PlanningSite[] = [];

  for (const [siteId, siteData] of Array.from(siteMap.entries()).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  )) {
    const departments: PlanningDepartment[] = [];

    for (const [deptId, deptData] of Array.from(siteData.depts.entries()).sort(
      (a, b) => a[1].name.localeCompare(b[1].name)
    )) {
      const planDays: PlanningDay[] = days.map((dateStr) => {
        const dayBlocks = deptData.blocks.filter((b) => b.date === dateStr);
        const amBlocks = dayBlocks.filter((b) => b.period === "AM");
        const pmBlocks = dayBlocks.filter((b) => b.period === "PM");

        return {
          date: dateStr,
          am: {
            blocks: amBlocks.map(transformBlock),
            needs: amBlocks.flatMap((b) =>
              (needsByBlock.get(b.id_block) ?? []).filter((n) => n.gap > 0)
            ),
          },
          pm: {
            blocks: pmBlocks.map(transformBlock),
            needs: pmBlocks.flatMap((b) =>
              (needsByBlock.get(b.id_block) ?? []).filter((n) => n.gap > 0)
            ),
          },
        };
      });

      departments.push({
        id_department: deptId,
        name: deptData.name,
        days: planDays,
      });
    }

    sites.push({ id_site: siteId, name: siteData.name, departments });
  }

  return {
    sites,
    stats: { totalNeeds, filled, gaps, proposed, confirmed, published },
  };
}

function transformBlock(raw: RawBlock): PlanningBlock {
  const activeAssignments = (raw.assignments ?? []).filter(
    (a) => a.status !== "CANCELLED" && a.status !== "INVALIDATED"
  );

  return {
    id_block: raw.id_block,
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
      source: a.source as PlanningAssignment["source"],
      status: a.status as PlanningAssignment["status"],
      id_primary_position: a.staff.id_primary_position as PlanningAssignment["id_primary_position"],
    })),
  };
}
