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
        .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
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

  // Cancel affected DOCTOR assignments via RPC
  await supabase.rpc("fn_cancel_assignments_for_leave", {
    p_staff_id: staffId,
    p_start_date: data.start_date,
    p_end_date: data.end_date,
    p_period: data.period ?? null,
  });

  return leave;
}

export async function deleteStaffLeave(supabase: SupabaseClient, leaveId: number) {
  const leave = throwIfError(
    await supabase
      .from("staff_leaves")
      .select("id_leave, id_staff, start_date, end_date")
      .eq("id_leave", leaveId)
      .single()
  );

  if (!leave) throw new Error(`Leave not found: ${leaveId}`);

  throwIfError(await supabase.from("staff_leaves").delete().eq("id_leave", leaveId));

  // Restore assignments from recurring schedules via RPC
  await supabase.rpc("fn_restore_assignments_for_leave", {
    p_staff_id: leave.id_staff,
    p_start_date: leave.start_date,
    p_end_date: leave.end_date,
  });

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
      .eq("id_leave", leaveId)
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
  return throwIfError(
    await supabase
      .from("staff_schedules")
      .insert({ id_staff: staffId, is_active: true, ...data })
      .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
      .single()
  );
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
  return throwIfError(
    await supabase
      .from("staff_schedules")
      .update(data)
      .eq("id_schedule", scheduleId)
      .select("*, departments ( name, sites ( name ) ), recurrence_types ( name, cycle_weeks ), activity_templates ( name )")
      .single()
  );
}

export async function removeStaffSchedule(
  supabase: SupabaseClient,
  scheduleId: number
) {
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
