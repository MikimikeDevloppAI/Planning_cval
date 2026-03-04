import type { SupabaseClient } from "../helpers";
import { throwIfError } from "../helpers";

// ============================================================
// Staff — List & Detail
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
      supabase.from("staff_skills").select("*, skills ( name, category )").eq("id_staff", id),
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
        .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
        .eq("id_staff", id)
        .eq("is_active", true)
        .order("day_of_week"),
      supabase
        .from("assignments")
        .select(
          `id_assignment, id_block, assignment_type, id_role, id_skill, id_activity, source, status,
           work_blocks ( date, period, block_type, departments ( name, sites ( name ) ) ),
           secretary_roles ( name ),
           skills ( name ),
           activity_templates ( name ),
           staff_schedules ( activity_templates ( name ) )`
        )
        .eq("id_staff", id)
        .not("status", "in", "(CANCELLED,INVALIDATED)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const staff = throwIfError(staffRes);

  return {
    staff,
    skills: skillsRes.data ?? [],
    preferences: prefsRes.data ?? [],
    settings: settingsRes.data ?? null,
    leaves: leavesRes.data ?? [],
    schedules: schedulesRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
  };
}

// ============================================================
// Staff — Update
// ============================================================

export async function updateStaff(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{
    firstname: string;
    lastname: string;
    is_active: boolean;
    id_primary_position: number;
    email: string | null;
    phone: string | null;
    target_pct: number;
  }>
) {
  return throwIfError(
    await supabase.from("staff").update(data).eq("id_staff", id).select().single()
  );
}

// ============================================================
// Staff — Secretary Settings
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
// Staff — Skills
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
      .select("*, skills ( name, category )")
      .single()
  );
}

export async function removeStaffSkill(supabase: SupabaseClient, staffId: number, skillId: number) {
  return throwIfError(
    await supabase.from("staff_skills").delete().eq("id_staff", staffId).eq("id_skill", skillId)
  );
}

export async function fetchAllStaffSkills(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("staff_skills")
      .select("id_staff, id_skill, preference, staff ( firstname, lastname, id_primary_position ), skills ( name, category )")
      .order("id_skill")
  );
}

// ============================================================
// Staff — Preferences
// ============================================================

export async function addStaffPreference(
  supabase: SupabaseClient,
  staffId: number,
  data: {
    target_type: "SITE" | "DEPARTMENT" | "ROLE" | "STAFF";
    preference: "INTERDIT" | "EVITER" | "PREFERE";
    id_site?: number | null;
    id_department?: number | null;
    id_target_staff?: number | null;
    id_role?: number | null;
    day_of_week?: string | null;
    reason?: string | null;
  }
) {
  return throwIfError(
    await supabase
      .from("staff_preferences")
      .insert({
        id_staff: staffId,
        target_type: data.target_type,
        id_site: data.id_site ?? null,
        id_department: data.id_department ?? null,
        id_target_staff: data.id_target_staff ?? null,
        id_role: data.id_role ?? null,
        preference: data.preference,
        day_of_week: data.day_of_week ?? null,
        reason: data.reason ?? null,
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
// Staff — Leaves
// ============================================================

export async function addStaffLeave(
  supabase: SupabaseClient,
  staffId: number,
  data: { start_date: string; end_date: string; period?: string | null }
) {
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

  // Cancel affected DOCTOR assignments via RPC (handles schedule-based restoration logic)
  await supabase.rpc("fn_cancel_assignments_for_leave", {
    p_staff_id: staffId,
    p_start_date: data.start_date,
    p_end_date: data.end_date,
    p_period: data.period ?? null,
  });

  // Cancel ALL remaining active assignments (secretaries, midwives, manual) that overlap the leave
  let query = supabase
    .from("assignments")
    .select("id_assignment, work_blocks!inner(date, period)")
    .eq("id_staff", staffId)
    .not("status", "in", "(CANCELLED,INVALIDATED)")
    .gte("work_blocks.date", data.start_date)
    .lte("work_blocks.date", data.end_date);

  if (data.period === "AM") {
    query = query.in("work_blocks.period", ["AM", "FULL_DAY"]);
  } else if (data.period === "PM") {
    query = query.in("work_blocks.period", ["PM", "FULL_DAY"]);
  }
  // period null = full day leave → cancel AM, PM, and FULL_DAY (no filter needed)

  const { data: conflicts } = await query;
  if (conflicts && conflicts.length > 0) {
    const ids = conflicts.map((c) => c.id_assignment);
    await supabase
      .from("assignments")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .in("id_assignment", ids);
  }

  return leave;
}

export async function deleteStaffLeave(supabase: SupabaseClient, leaveId: number) {
  const leave = throwIfError(
    await supabase
      .from("staff_leaves")
      .select("id_absence, id_staff, start_date, end_date, period")
      .eq("id_absence", leaveId)
      .single()
  );

  if (!leave) throw new Error(`Leave not found: ${leaveId}`);

  throwIfError(await supabase.from("staff_leaves").delete().eq("id_absence", leaveId));

  // Restore DOCTOR assignments via RPC
  await supabase.rpc("fn_restore_assignments_for_leave", {
    p_staff_id: leave.id_staff,
    p_start_date: leave.start_date,
    p_end_date: leave.end_date,
  });

  // Restore CANCELLED assignments linked to an active schedule that overlap the leave
  let restoreQuery = supabase
    .from("assignments")
    .select("id_assignment, work_blocks!inner(date, period)")
    .eq("id_staff", leave.id_staff)
    .eq("status", "CANCELLED")
    .not("id_schedule", "is", null)
    .gte("work_blocks.date", leave.start_date)
    .lte("work_blocks.date", leave.end_date);

  if (leave.period === "AM") {
    restoreQuery = restoreQuery.in("work_blocks.period", ["AM", "FULL_DAY"]);
  } else if (leave.period === "PM") {
    restoreQuery = restoreQuery.in("work_blocks.period", ["PM", "FULL_DAY"]);
  }

  const { data: cancelled } = await restoreQuery;
  if (cancelled && cancelled.length > 0) {
    const ids = cancelled.map((c) => c.id_assignment);
    await supabase
      .from("assignments")
      .update({ status: "CONFIRMED", updated_at: new Date().toISOString() })
      .in("id_assignment", ids);
  }

  return leave;
}

export async function updateStaffLeave(
  supabase: SupabaseClient,
  leaveId: number,
  data: { start_date: string; end_date: string; period: string | null }
) {
  return throwIfError(
    await supabase
      .from("staff_leaves")
      .update(data)
      .eq("id_absence", leaveId)
      .select("*")
      .single()
  );
}

// ============================================================
// Staff — Schedules CRUD
// ============================================================

export async function fetchRecurrenceTypes(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("recurrence_types")
      .select("id_recurrence, name, cycle_weeks")
      .order("cycle_weeks")
  );
}

/**
 * Check for conflicting schedules on the same day/period for a staff member.
 * Period overlap: AM↔AM, AM↔FULL_DAY, PM↔PM, PM↔FULL_DAY, FULL_DAY↔everything.
 */
export async function checkScheduleConflicts(
  supabase: SupabaseClient,
  staffId: number,
  dayOfWeek: number,
  period: string,
  excludeScheduleId?: number
) {
  const conflictingPeriods =
    period === "FULL_DAY" ? ["AM", "PM", "FULL_DAY"] :
    period === "AM" ? ["AM", "FULL_DAY"] :
    ["PM", "FULL_DAY"];

  let query = supabase
    .from("staff_schedules")
    .select("id_schedule, period, departments ( name )")
    .eq("id_staff", staffId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .in("period", conflictingPeriods);

  if (excludeScheduleId) {
    query = query.neq("id_schedule", excludeScheduleId);
  }

  const { data } = await query;
  return (data ?? []) as unknown as { id_schedule: number; period: string; departments: { name: string } | null }[];
}

export async function addStaffSchedule(
  supabase: SupabaseClient,
  staffId: number,
  data: {
    schedule_type: string;
    day_of_week: number;
    period: string;
    id_department: number;
    id_recurrence?: number | null;
    week_offset?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    id_activity?: number | null;
  }
) {
  // Check for schedule conflicts
  const conflicts = await checkScheduleConflicts(supabase, staffId, data.day_of_week, data.period);
  if (conflicts.length > 0) {
    const depts = conflicts.map((c) => c.departments?.name ?? "inconnu").join(", ");
    throw new Error(`Conflit : un planning existe déjà pour ce jour et cette période (${depts}). Supprimez-le d'abord ou modifiez-le.`);
  }

  const result = throwIfError(
    await supabase
      .from("staff_schedules")
      .insert({ id_staff: staffId, is_active: true, ...data })
      .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
      .single()
  );

  // Materialize assignments from the new schedule
  await supabase.rpc("fn_materialize_schedule", { p_schedule_id: result.id_schedule });

  return result;
}

export async function updateStaffSchedule(
  supabase: SupabaseClient,
  scheduleId: number,
  data: Partial<{
    schedule_type: string;
    day_of_week: number;
    period: string;
    id_department: number;
    id_recurrence: number | null;
    week_offset: number | null;
    start_date: string | null;
    end_date: string | null;
    id_activity: number | null;
  }>
) {
  // Check for conflicts if day_of_week or period is changing
  if (data.day_of_week !== undefined || data.period !== undefined) {
    const { data: current } = await supabase
      .from("staff_schedules")
      .select("id_staff, day_of_week, period")
      .eq("id_schedule", scheduleId)
      .single();

    if (current) {
      const dayOfWeek = data.day_of_week ?? current.day_of_week;
      const period = data.period ?? current.period;
      const conflicts = await checkScheduleConflicts(supabase, current.id_staff, dayOfWeek, period, scheduleId);
      if (conflicts.length > 0) {
        const depts = conflicts.map((c) => c.departments?.name ?? "inconnu").join(", ");
        throw new Error(`Conflit : un planning existe déjà pour ce jour et cette période (${depts}).`);
      }
    }
  }

  const result = throwIfError(
    await supabase
      .from("staff_schedules")
      .update(data)
      .eq("id_schedule", scheduleId)
      .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
      .single()
  );

  // Re-materialize: delete future assignments and recreate from updated schedule
  await supabase.rpc("fn_materialize_schedule", { p_schedule_id: scheduleId });

  return result;
}

export async function removeStaffSchedule(
  supabase: SupabaseClient,
  scheduleId: number
) {
  const today = new Date().toISOString().split("T")[0];

  // Delete future assignments linked to this schedule
  const { data: futureAssignments } = await supabase
    .from("assignments")
    .select("id_assignment, work_blocks!inner(date)")
    .eq("id_schedule", scheduleId)
    .gte("work_blocks.date", today);

  if (futureAssignments && futureAssignments.length > 0) {
    const ids = futureAssignments.map((a) => a.id_assignment);
    await supabase.from("assignments").delete().in("id_assignment", ids);
  }

  // Nullify id_schedule on past assignments to allow schedule deletion (FK)
  await supabase
    .from("assignments")
    .update({ id_schedule: null })
    .eq("id_schedule", scheduleId);

  return throwIfError(
    await supabase.from("staff_schedules").delete().eq("id_schedule", scheduleId)
  );
}

// ============================================================
// Leaves for planning display
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

export async function fetchAllLeaves(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("staff_leaves")
      .select("id_absence, id_staff, start_date, end_date, period, staff ( firstname, lastname, id_primary_position )")
      .order("start_date", { ascending: false })
  );
}
