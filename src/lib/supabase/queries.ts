import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlanningSite,
  PlanningDepartment,
  PlanningDay,
  PlanningBlock,
  PlanningAssignment,
  StaffingNeed,
} from "@/lib/types/database";
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
// Helpers
// ============================================================

function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ============================================================
// CONFIG — Sites
// ============================================================

export async function fetchSites(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("sites")
      .select("*, departments ( id_department, name, is_active )")
      .order("name")
  );
}

export async function updateSite(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("sites").update(data).eq("id_site", id).select().single()
  );
}

export async function deleteSite(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("sites").delete().eq("id_site", id));
}

// ============================================================
// CONFIG — Departments
// ============================================================

export async function createDepartment(
  supabase: SupabaseClient,
  data: { name: string; id_site: number; is_active?: boolean }
) {
  return throwIfError(
    await supabase
      .from("departments")
      .insert({ name: data.name, id_site: data.id_site, is_active: data.is_active ?? true })
      .select()
      .single()
  );
}

export async function updateDepartment(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("departments").update(data).eq("id_department", id).select().single()
  );
}

export async function deleteDepartment(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("departments").delete().eq("id_department", id));
}

// ============================================================
// CONFIG — Skills
// ============================================================

export async function fetchSkills(supabase: SupabaseClient) {
  return throwIfError(await supabase.from("skills").select("*").order("name"));
}

export async function createSkill(supabase: SupabaseClient, name: string) {
  return throwIfError(
    await supabase.from("skills").insert({ name }).select().single()
  );
}

export async function updateSkill(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("skills").update(data).eq("id_skill", id).select().single()
  );
}

export async function deleteSkill(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("skills").delete().eq("id_skill", id));
}

// ============================================================
// CONFIG — Roles
// ============================================================

export async function fetchRoles(supabase: SupabaseClient) {
  return throwIfError(await supabase.from("secretary_roles").select("*").order("id_role"));
}

export async function updateRole(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("secretary_roles").update(data).eq("id_role", id).select().single()
  );
}

// ============================================================
// CONFIG — Calendar
// ============================================================

export async function fetchHolidays(supabase: SupabaseClient, year: number) {
  return throwIfError(
    await supabase
      .from("calendar")
      .select("*")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .eq("is_holiday", true)
      .order("date")
  );
}

export async function updateCalendarDay(
  supabase: SupabaseClient,
  date: string,
  data: { is_holiday: boolean; holiday_name?: string | null }
) {
  return throwIfError(
    await supabase
      .from("calendar")
      .update({ is_holiday: data.is_holiday, holiday_name: data.holiday_name || null })
      .eq("date", date)
      .select()
      .single()
  );
}

// ============================================================
// CONFIG — Activity Staffing Tiers
// ============================================================

export async function fetchTiers(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("activity_staffing_tiers")
      .select("*, departments ( name, sites ( name ) ), skills ( name ), secretary_roles ( name )")
      .order("id_department")
      .order("min_doctors")
  );
}

export async function createTier(supabase: SupabaseClient, data: Record<string, unknown>) {
  return throwIfError(
    await supabase
      .from("activity_staffing_tiers")
      .insert({
        id_department: data.id_department,
        id_skill: data.id_skill,
        id_role: data.id_role,
        min_doctors: data.min_doctors,
        max_doctors: data.max_doctors,
        quantity: data.quantity,
      })
      .select("*, departments ( name ), skills ( name ), secretary_roles ( name )")
      .single()
  );
}

export async function updateTier(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("activity_staffing_tiers").update(data).eq("id_tier", id).select().single()
  );
}

export async function deleteTier(supabase: SupabaseClient, id: number) {
  return throwIfError(
    await supabase.from("activity_staffing_tiers").delete().eq("id_tier", id)
  );
}

// ============================================================
// STAFF — List & Detail
// ============================================================

export async function fetchStaffList(
  supabase: SupabaseClient,
  filters?: { position?: number; active?: string }
) {
  let query = supabase
    .from("staff")
    .select(`*, positions ( name )`)
    .order("lastname");

  if (filters?.position) {
    query = query.eq("id_primary_position", filters.position);
  }
  if (filters?.active && filters.active !== "all") {
    query = query.eq("is_active", filters.active === "true");
  }

  const staffRows = throwIfError(await query);

  // Fetch secretary settings separately (avoids PostgREST relationship issue)
  const settingsRes = await supabase
    .from("staff_secretary_settings")
    .select("id_staff, is_flexible, flexibility_pct, full_day_only, admin_target");

  interface SecSettings {
    id_staff: number;
    is_flexible: boolean;
    flexibility_pct: number;
    full_day_only: boolean;
    admin_target: number;
  }
  const settings = (settingsRes.data ?? []) as SecSettings[];
  const settingsMap = new Map(settings.map((s) => [s.id_staff, s]));

  // Merge settings into staff rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (staffRows as any[]).map((staff) => ({
    ...staff,
    staff_secretary_settings: settingsMap.get(staff.id_staff) ?? null,
  }));
}

export async function fetchStaffDetail(supabase: SupabaseClient, id: number) {
  const [staffRes, skillsRes, prefsRes, settingsRes, leavesRes, schedulesRes, assignmentsRes] =
    await Promise.all([
      supabase.from("staff").select("*, positions ( name )").eq("id_staff", id).single(),
      supabase.from("staff_skills").select("*, skills ( name )").eq("id_staff", id),
      supabase
        .from("staff_preferences")
        .select("*, sites ( name ), departments ( name ), secretary_roles ( name )")
        .eq("id_staff", id),
      supabase.from("staff_secretary_settings").select("*").eq("id_staff", id).maybeSingle(),
      supabase
        .from("staff_leaves")
        .select("*")
        .eq("id_staff", id)
        .order("start_date", { ascending: false }),
      supabase
        .from("staff_schedules")
        .select("*, departments ( name ), recurrence_types ( name, cycle_weeks )")
        .eq("id_staff", id)
        .eq("is_active", true)
        .order("day_of_week"),
      supabase
        .from("assignments")
        .select(
          `id_assignment, id_block, assignment_type, id_role, id_skill, source, status,
           work_blocks ( date, period, block_type, departments ( name ) ),
           secretary_roles ( name ),
           skills ( name )`
        )
        .eq("id_staff", id)
        .not("status", "in", "(CANCELLED,INVALIDATED)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const staff = throwIfError(staffRes);

  return {
    ...staff,
    skills: skillsRes.data ?? [],
    preferences: prefsRes.data ?? [],
    settings: settingsRes.data ?? null,
    leaves: leavesRes.data ?? [],
    schedules: schedulesRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
  };
}

// ============================================================
// STAFF — Update
// ============================================================

export async function updateStaff(supabase: SupabaseClient, id: number, data: Record<string, unknown>) {
  return throwIfError(
    await supabase.from("staff").update(data).eq("id_staff", id).select().single()
  );
}

// ============================================================
// STAFF — Secretary Settings
// ============================================================

export async function upsertSecretarySettings(
  supabase: SupabaseClient,
  staffId: number,
  data: {
    is_flexible?: boolean;
    flexibility_pct?: number;
    full_day_only?: boolean;
    admin_target?: number;
  }
) {
  return throwIfError(
    await supabase
      .from("staff_secretary_settings")
      .upsert(
        {
          id_staff: staffId,
          is_flexible: data.is_flexible ?? true,
          flexibility_pct: data.flexibility_pct ?? 50,
          full_day_only: data.full_day_only ?? false,
          admin_target: data.admin_target ?? 0,
        },
        { onConflict: "id_staff" }
      )
      .select()
      .single()
  );
}

// ============================================================
// STAFF — Skills
// ============================================================

export async function addStaffSkill(
  supabase: SupabaseClient,
  staffId: number,
  skillId: number,
  preference: number = 3
) {
  return throwIfError(
    await supabase
      .from("staff_skills")
      .upsert(
        { id_staff: staffId, id_skill: skillId, preference },
        { onConflict: "id_staff,id_skill" }
      )
      .select("*, skills ( name )")
      .single()
  );
}

export async function removeStaffSkill(supabase: SupabaseClient, staffId: number, skillId: number) {
  return throwIfError(
    await supabase.from("staff_skills").delete().eq("id_staff", staffId).eq("id_skill", skillId)
  );
}

// ============================================================
// STAFF — Preferences
// ============================================================

export async function addStaffPreference(
  supabase: SupabaseClient,
  staffId: number,
  data: Record<string, unknown>
) {
  return throwIfError(
    await supabase
      .from("staff_preferences")
      .insert({
        id_staff: staffId,
        target_type: data.target_type,
        id_site: data.id_site || null,
        id_department: data.id_department || null,
        id_target_staff: data.id_target_staff || null,
        id_role: data.id_role || null,
        preference: data.preference,
        day_of_week: data.day_of_week || null,
        reason: data.reason || null,
      })
      .select("*, sites ( name ), departments ( name ), secretary_roles ( name )")
      .single()
  );
}

export async function removeStaffPreference(supabase: SupabaseClient, prefId: number) {
  return throwIfError(
    await supabase.from("staff_preferences").delete().eq("id_preference", prefId)
  );
}

// ============================================================
// STAFF — Leaves
// ============================================================

export async function addStaffLeave(
  supabase: SupabaseClient,
  staffId: number,
  data: { start_date: string; end_date: string; period?: string | null }
) {
  // 1. Insert the leave
  const leave = throwIfError(
    await supabase
      .from("staff_leaves")
      .insert({
        id_staff: staffId,
        start_date: data.start_date,
        end_date: data.end_date,
        period: data.period ?? null,
      })
      .select()
      .single()
  );

  // 2. Cancel affected DOCTOR assignments via RPC
  await supabase.rpc("fn_cancel_assignments_for_leave", {
    p_staff_id: staffId,
    p_start_date: data.start_date,
    p_end_date: data.end_date,
    p_period: data.period ?? null,
  });

  return leave;
}

export async function deleteStaffLeave(supabase: SupabaseClient, leaveId: number) {
  // 1. Read the leave to know staff + dates before deleting
  const leave = throwIfError(
    await supabase
      .from("staff_leaves")
      .select("id_leave, id_staff, start_date, end_date")
      .eq("id_leave", leaveId)
      .single()
  );

  if (!leave) throw new Error(`Leave not found: ${leaveId}`);

  // 2. Delete the leave
  throwIfError(await supabase.from("staff_leaves").delete().eq("id_leave", leaveId));

  // 3. Restore assignments from recurring schedules via RPC
  await supabase.rpc("fn_restore_assignments_for_leave", {
    p_staff_id: leave.id_staff,
    p_start_date: leave.start_date,
    p_end_date: leave.end_date,
  });

  return leave;
}

// ============================================================
// STAFF — Leaves for planning display
// ============================================================

export async function fetchMonthLeaves(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
) {
  return throwIfError(
    await supabase
      .from("staff_leaves")
      .select("*, staff ( firstname, lastname, id_primary_position )")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .order("start_date")
  );
}

// ============================================================
// ASSIGNMENTS
// ============================================================

export async function moveAssignment(
  supabase: SupabaseClient,
  params: {
    oldAssignmentId: number;
    targetBlockId: number;
    staffId: number;
    assignmentType?: string;
    roleId?: number | null;
    skillId?: number | null;
  }
) {
  // 1. Cancel old assignment
  throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", params.oldAssignmentId)
  );

  // 2. Upsert new assignment at target (handles CANCELLED row already existing for this block+staff)
  return throwIfError(
    await supabase
      .from("assignments")
      .upsert(
        {
          id_block: params.targetBlockId,
          id_staff: params.staffId,
          assignment_type: params.assignmentType ?? "SECRETARY",
          id_role: params.roleId ?? null,
          id_skill: params.skillId ?? null,
          source: "MANUAL",
          status: "PROPOSED",
        },
        { onConflict: "id_block,id_staff" }
      )
      .select()
      .single()
  );
}

export async function cancelAssignment(supabase: SupabaseClient, assignmentId: number) {
  return throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", assignmentId)
  );
}

export async function updateAssignmentStatus(
  supabase: SupabaseClient,
  assignmentId: number,
  status: string
) {
  return throwIfError(
    await supabase
      .from("assignments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id_assignment", assignmentId)
      .select()
      .single()
  );
}

/**
 * Move a doctor by writing directly into assignments.
 * CANCEL the old assignment + INSERT a new one with source='MANUAL'.
 * No more staff_schedules detour — assignments is the source of truth.
 */
export async function moveDoctorSchedule(
  supabase: SupabaseClient,
  params: {
    staffId: number;
    sourceAssignmentId: number;
    targetDeptId: number;
    targetDate: string;
    period: "AM" | "PM";
    activityId?: number | null;
  }
) {
  // 1. Cancel old assignment
  throwIfError(
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id_assignment", params.sourceAssignmentId)
  );

  // 2. Find the target block (pre-created by fn_ensure_all_blocks)
  const { data: targetBlock, error: blockErr } = await supabase
    .from("work_blocks")
    .select("id_block")
    .eq("id_department", params.targetDeptId)
    .eq("date", params.targetDate)
    .eq("period", params.period)
    .single();

  if (blockErr || !targetBlock) {
    throw new Error(`Target block not found for dept=${params.targetDeptId} date=${params.targetDate} period=${params.period}`);
  }

  // 3. Upsert new MANUAL assignment (handles case where a CANCELLED row already exists for this block+staff)
  return throwIfError(
    await supabase
      .from("assignments")
      .upsert(
        {
          id_block: targetBlock.id_block,
          id_staff: params.staffId,
          assignment_type: "DOCTOR",
          id_activity: params.activityId ?? null,
          source: "MANUAL",
          id_schedule: null,
          status: "PUBLISHED",
        },
        { onConflict: "id_block,id_staff" }
      )
      .select()
      .single()
  );
}

// ============================================================
// PLANNING — Monthly
// ============================================================

interface LeaveRecord {
  id_staff: number;
  start_date: string;
  end_date: string;
  period: string | null;
}

function buildAbsentKeys(leaves: LeaveRecord[], startStr: string, endStr: string): Set<string> {
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

export async function fetchMonthPlanning(
  supabase: SupabaseClient,
  month: string
): Promise<MonthPlanningData> {
  const monthDate = new Date(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Extend range to complete work-weeks (Mon–Fri).
  // Only extend if the month starts/ends mid-week on a weekday (Tue–Fri / Mon–Thu).
  // If the month starts on Sat/Sun, first displayed day is Monday (no extension).
  // If the month ends on Sat/Sun, last displayed day is Friday (no extension).
  const startDay = getDay(monthStart); // 0=Sun .. 6=Sat
  const rangeStart = (startDay >= 2 && startDay <= 5)
    ? startOfWeek(monthStart, { weekStartsOn: 1 }) // extend back to Monday
    : monthStart;

  const endDay = getDay(monthEnd);
  const rangeEnd = (endDay >= 1 && endDay <= 4)
    ? addDays(endOfWeek(monthEnd, { weekStartsOn: 1 }), -1) // extend forward to Saturday
    : monthEnd;

  const startStr = format(rangeStart, "yyyy-MM-dd");
  const endStr = format(rangeEnd, "yyyy-MM-dd");

  const [blocksRes, needsRes, leavesRes] = await Promise.all([
    supabase
      .from("work_blocks")
      .select(
        `id_block, date, period, block_type, id_department,
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
         )`
      )
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

// ============================================================
// PLANNING — Weekly
// ============================================================

export async function fetchWeekPlanning(supabase: SupabaseClient, weekStart: string) {
  const wsDate = new Date(weekStart);
  const weekEnd = format(addDays(wsDate, 5), "yyyy-MM-dd");

  const [blocksRes, needsRes, leavesRes] = await Promise.all([
    supabase
      .from("work_blocks")
      .select(
        `id_block, date, period, block_type, id_department,
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
         )`
      )
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

// ============================================================
// PLANNING — Transform helpers (shared)
// ============================================================

function transformBlock(raw: RawBlock, absentKeys: Set<string>): PlanningBlock {
  const activeAssignments = (raw.assignments ?? [])
    .filter((a) => a.status !== "CANCELLED" && a.status !== "INVALIDATED")
    .filter((a) => !absentKeys.has(`${a.id_staff}:${raw.date}:${raw.period}`));

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

function buildSiteMap(rawBlocks: RawBlock[]) {
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

function buildNeedsIndex(needs: StaffingNeed[]) {
  const needsByBlock = new Map<number, StaffingNeed[]>();
  for (const need of needs) {
    if (!needsByBlock.has(need.id_block)) {
      needsByBlock.set(need.id_block, []);
    }
    needsByBlock.get(need.id_block)!.push(need);
  }
  return needsByBlock;
}

function computeStats(rawBlocks: RawBlock[], needs: StaffingNeed[]) {
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
            (needsByBlock.get(b.id_block) ?? []).filter((n) => n.gap > 0)
          ),
        },
        pm: {
          blocks: pmBlocks.map((b) => transformBlock(b, absentKeys)),
          needs: pmBlocks.flatMap((b) =>
            (needsByBlock.get(b.id_block) ?? []).filter((n) => n.gap > 0)
          ),
        },
      };
    });

  // Extract Administration
  const ADMIN_NAME = "Administration";
  const adminBlocks: RawBlock[] = [];
  for (const [, siteData] of siteMap) {
    for (const [deptId, deptData] of siteData.depts) {
      if (deptData.name === ADMIN_NAME) {
        adminBlocks.push(...deptData.blocks);
        siteData.depts.delete(deptId);
      }
    }
  }

  // Extract Bloc opératoire
  const BLOC_OP_NAME = "Bloc opératoire";
  const surgeryBlocks: RawBlock[] = [];
  for (const [, siteData] of siteMap) {
    for (const [deptId, deptData] of siteData.depts) {
      if (deptData.name === BLOC_OP_NAME) {
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
      id_site: -2,
      name: "Administration",
      departments: [
        {
          id_department: -2000,
          name: "Administration",
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

  // Bloc Opératoire last — group by doctor assignment activity
  if (surgeryBlocks.length > 0) {
    const byActivity = new Map<string, RawBlock[]>();
    for (const block of surgeryBlocks) {
      // Find activities from doctor assignments in this block
      const doctorActivities = new Set<string>();
      for (const a of block.assignments ?? []) {
        if (
          a.assignment_type === "DOCTOR" &&
          a.status !== "CANCELLED" &&
          a.status !== "INVALIDATED" &&
          a.activity_templates?.name
        ) {
          doctorActivities.add(a.activity_templates.name);
        }
      }

      if (doctorActivities.size === 0) {
        // Block with no active doctor activities — show under generic name
        const key = "Bloc opératoire";
        if (!byActivity.has(key)) byActivity.set(key, []);
        byActivity.get(key)!.push(block);
      } else {
        // Show under each activity that has a doctor
        for (const actName of doctorActivities) {
          if (!byActivity.has(actName)) byActivity.set(actName, []);
          byActivity.get(actName)!.push(block);
        }
      }
    }

    const blocDepts: PlanningDepartment[] = [];
    let virtualId = -1000;
    for (const [actName, blocks] of Array.from(byActivity.entries()).sort(
      (a, b) => a[0].localeCompare(b[0])
    )) {
      blocDepts.push({
        id_department: virtualId--,
        name: actName,
        days: buildDays(blocks),
      });
    }

    sites.push({
      id_site: -1,
      name: "Bloc Opératoire",
      departments: blocDepts,
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
    // Saturday (i=5) only if there are blocks scheduled
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
