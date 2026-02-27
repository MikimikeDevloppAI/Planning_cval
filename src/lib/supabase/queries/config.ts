import type { SupabaseClient } from "../helpers";
import { throwIfError } from "../helpers";

// ============================================================
// Sites
// ============================================================

export async function fetchSites(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("sites")
      .select("*, departments ( id_department, name, is_active )")
      .order("name")
  );
}

export async function updateSite(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{ name: string; is_active: boolean }>
) {
  return throwIfError(
    await supabase.from("sites").update(data).eq("id_site", id).select().single()
  );
}

export async function deleteSite(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("sites").delete().eq("id_site", id));
}

// ============================================================
// Departments
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

export async function updateDepartment(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{ name: string; is_active: boolean; id_site: number }>
) {
  return throwIfError(
    await supabase.from("departments").update(data).eq("id_department", id).select().single()
  );
}

export async function deleteDepartment(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("departments").delete().eq("id_department", id));
}

// ============================================================
// Skills
// ============================================================

export async function fetchSkills(supabase: SupabaseClient) {
  return throwIfError(await supabase.from("skills").select("*").order("name"));
}

export async function createSkill(supabase: SupabaseClient, name: string) {
  return throwIfError(
    await supabase.from("skills").insert({ name }).select().single()
  );
}

export async function updateSkill(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{ name: string }>
) {
  return throwIfError(
    await supabase.from("skills").update(data).eq("id_skill", id).select().single()
  );
}

export async function deleteSkill(supabase: SupabaseClient, id: number) {
  return throwIfError(await supabase.from("skills").delete().eq("id_skill", id));
}

// ============================================================
// Activity Templates
// ============================================================

export async function fetchActivityTemplates(supabase: SupabaseClient) {
  return throwIfError(
    await supabase.from("activity_templates").select("id_activity, name").order("name")
  );
}

export async function createActivityTemplate(supabase: SupabaseClient, name: string) {
  return throwIfError(
    await supabase.from("activity_templates").insert({ name }).select().single()
  );
}

export async function deleteActivityTemplate(supabase: SupabaseClient, id: number) {
  return throwIfError(
    await supabase.from("activity_templates").delete().eq("id_activity", id)
  );
}

// ============================================================
// Activity Requirements
// ============================================================

export async function fetchActivityRequirements(supabase: SupabaseClient) {
  return throwIfError(
    await supabase
      .from("activity_requirements")
      .select("*, activity_templates ( name ), skills ( name )")
      .order("id_activity")
  );
}

export async function createActivityRequirement(
  supabase: SupabaseClient,
  data: { id_activity: number; id_skill: number; quantity: number }
) {
  return throwIfError(
    await supabase
      .from("activity_requirements")
      .insert(data)
      .select("*, activity_templates ( name ), skills ( name )")
      .single()
  );
}

export async function updateActivityRequirement(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{ id_skill: number; quantity: number }>
) {
  return throwIfError(
    await supabase.from("activity_requirements").update(data).eq("id_requirement", id).select().single()
  );
}

export async function deleteActivityRequirement(supabase: SupabaseClient, id: number) {
  return throwIfError(
    await supabase.from("activity_requirements").delete().eq("id_requirement", id)
  );
}

// ============================================================
// Roles
// ============================================================

export async function fetchRoles(supabase: SupabaseClient) {
  return throwIfError(await supabase.from("secretary_roles").select("*").order("id_role"));
}

export async function updateRole(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{ name: string; hardship_weight: number }>
) {
  return throwIfError(
    await supabase.from("secretary_roles").update(data).eq("id_role", id).select().single()
  );
}

// ============================================================
// Calendar
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
// Activity Staffing Tiers
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

export async function createTier(
  supabase: SupabaseClient,
  data: {
    id_department: number;
    id_skill: number | null;
    id_role: number | null;
    min_doctors: number;
    max_doctors: number;
    quantity: number;
  }
) {
  return throwIfError(
    await supabase
      .from("activity_staffing_tiers")
      .insert(data)
      .select("*, departments ( name ), skills ( name ), secretary_roles ( name )")
      .single()
  );
}

export async function updateTier(
  supabase: SupabaseClient,
  id: number,
  data: Partial<{
    id_department: number;
    id_skill: number | null;
    id_role: number | null;
    min_doctors: number;
    max_doctors: number;
    quantity: number;
  }>
) {
  return throwIfError(
    await supabase.from("activity_staffing_tiers").update(data).eq("id_tier", id).select().single()
  );
}

export async function deleteTier(supabase: SupabaseClient, id: number) {
  return throwIfError(
    await supabase.from("activity_staffing_tiers").delete().eq("id_tier", id)
  );
}
