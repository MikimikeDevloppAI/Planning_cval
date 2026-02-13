-- ============================================================
-- Vues pour l'algorithme d'assignation des secrétaires
-- ============================================================

DROP VIEW IF EXISTS v_secretary_eligibility;
DROP VIEW IF EXISTS v_secretary_availability;

-- ============================================================
-- 1. v_secretary_availability
-- Disponibilités résolues : 1 ligne par secrétaire × date × period
-- Logique : RECURRING schedules - leaves
-- ============================================================

CREATE OR REPLACE VIEW v_secretary_availability AS

WITH dow_map(dow_int, dow_enum) AS (
  VALUES
    (1, 'MON'::day_of_week_enum),
    (2, 'TUE'::day_of_week_enum),
    (3, 'WED'::day_of_week_enum),
    (4, 'THU'::day_of_week_enum),
    (5, 'FRI'::day_of_week_enum),
    (6, 'SAT'::day_of_week_enum),
    (7, 'SUN'::day_of_week_enum)
),

-- Expand RECURRING schedules (AVAILABLE) across the calendar
recurring_expanded AS (
  SELECT
    ss.id_schedule,
    ss.id_staff,
    c.date,
    CASE WHEN ss.period = 'FULL_DAY' THEN 'AM' ELSE ss.period END AS period
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum
                 AND c.is_weekend = false
                 AND c.is_holiday = false
  WHERE ss.is_active = true
    AND ss.schedule_type = 'AVAILABLE'
    AND s.id_primary_position = 2  -- Secrétaires
    AND s.is_active = true
    AND (
      rt.cycle_weeks = 1
      OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
    )
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)

  UNION ALL

  -- FULL_DAY → also PM
  SELECT
    ss.id_schedule,
    ss.id_staff,
    c.date,
    'PM' AS period
  FROM staff_schedules ss
  JOIN staff s ON ss.id_staff = s.id_staff
  JOIN recurrence_types rt ON ss.id_recurrence = rt.id_recurrence
  JOIN dow_map dm ON dm.dow_int = ss.day_of_week
  JOIN calendar c ON c.day_of_week = dm.dow_enum
                 AND c.is_weekend = false
                 AND c.is_holiday = false
  WHERE ss.is_active = true
    AND ss.schedule_type = 'AVAILABLE'
    AND ss.period = 'FULL_DAY'
    AND s.id_primary_position = 2
    AND s.is_active = true
    AND (
      rt.cycle_weeks = 1
      OR (rt.cycle_weeks > 1 AND ((c.iso_week - 1) % rt.cycle_weeks) = COALESCE(ss.week_offset, 0))
    )
    AND (ss.start_date IS NULL OR c.date >= ss.start_date)
    AND (ss.end_date IS NULL OR c.date <= ss.end_date)
),

-- Deduplicate
deduped AS (
  SELECT DISTINCT id_staff, date, period
  FROM recurring_expanded
),

-- Remove leaves
without_leaves AS (
  SELECT d.*
  FROM deduped d
  WHERE NOT EXISTS (
    SELECT 1 FROM staff_leaves sl
    WHERE sl.id_staff = d.id_staff
      AND d.date BETWEEN sl.start_date AND sl.end_date
      AND (sl.period IS NULL OR sl.period = d.period)
  )
)

SELECT
  wl.id_staff,
  s.lastname,
  s.firstname,
  wl.date,
  wl.period,
  COALESCE(ss.is_flexible, false) AS is_flexible,
  CASE WHEN COALESCE(ss.flexibility_pct, 100) > 1
       THEN COALESCE(ss.flexibility_pct, 100) / 100.0
       ELSE COALESCE(ss.flexibility_pct, 1.0)
  END AS flexibility_pct,
  COALESCE(ss.full_day_only, false) AS full_day_only,
  COALESCE(ss.admin_target, 0) AS admin_target
FROM without_leaves wl
JOIN staff s ON wl.id_staff = s.id_staff
LEFT JOIN staff_secretary_settings ss ON wl.id_staff = ss.id_staff;


-- ============================================================
-- 2. v_secretary_eligibility
-- 1 ligne par (secrétaire, besoin) éligible
-- Inclut : skill match, pas INTERDIT, scores pré-calculés
-- ============================================================

CREATE OR REPLACE VIEW v_secretary_eligibility AS

WITH
-- Tous les besoins médicaux (from v_staffing_needs with gap > 0)
medical_needs AS (
  SELECT
    sn.id_block, sn.date, sn.period, sn.block_type,
    sn.department, sn.site, sn.skill_name, sn.role_name,
    sn.id_skill, sn.id_role,
    sn.needed::int, sn.assigned::int, sn.gap::int,
    wb.id_department,
    d.id_site
  FROM v_staffing_needs sn
  JOIN work_blocks wb ON sn.id_block = wb.id_block
  JOIN departments d ON wb.id_department = d.id_department
  WHERE sn.gap > 0
),

-- Secrétaires disponibles (from v_secretary_availability)
avail AS (
  SELECT * FROM v_secretary_availability
),

-- INTERDIT par site
interdit_site AS (
  SELECT id_staff, id_site
  FROM staff_preferences
  WHERE preference = 'INTERDIT' AND target_type = 'SITE'
),

-- INTERDIT par département
interdit_dept AS (
  SELECT id_staff, id_department
  FROM staff_preferences
  WHERE preference = 'INTERDIT' AND target_type = 'DEPARTMENT'
),

-- INTERDIT par staff (médecin)
interdit_staff AS (
  SELECT id_staff, id_target_staff
  FROM staff_preferences
  WHERE preference = 'INTERDIT' AND target_type = 'STAFF'
),

-- INTERDIT par rôle (optionnellement conditionné au jour)
interdit_role AS (
  SELECT id_staff, id_role, day_of_week
  FROM staff_preferences
  WHERE preference = 'INTERDIT' AND target_type = 'ROLE'
),

-- Médecins par block
doctors_per_block AS (
  SELECT a.id_block, a.id_staff AS id_doctor
  FROM assignments a
  WHERE a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
),

-- EVITER scores pré-calculés
eviter_site AS (
  SELECT id_staff, id_site, -25 AS penalty
  FROM staff_preferences
  WHERE preference = 'EVITER' AND target_type = 'SITE'
),
eviter_dept AS (
  SELECT id_staff, id_department, -15 AS penalty
  FROM staff_preferences
  WHERE preference = 'EVITER' AND target_type = 'DEPARTMENT'
),
eviter_staff AS (
  SELECT id_staff, id_target_staff, -10 AS penalty
  FROM staff_preferences
  WHERE preference = 'EVITER' AND target_type = 'STAFF'
),

-- PREFERE scores pré-calculés
prefere_site AS (
  SELECT id_staff, id_site, 20 AS bonus
  FROM staff_preferences
  WHERE preference = 'PREFERE' AND target_type = 'SITE'
),
prefere_dept AS (
  SELECT id_staff, id_department, 15 AS bonus
  FROM staff_preferences
  WHERE preference = 'PREFERE' AND target_type = 'DEPARTMENT'
),
prefere_staff AS (
  SELECT id_staff, id_target_staff, 10 AS bonus
  FROM staff_preferences
  WHERE preference = 'PREFERE' AND target_type = 'STAFF'
),

-- Cross join available secretaries × medical needs (with skill match)
eligible_raw AS (
  SELECT
    a.id_staff,
    a.lastname,
    a.firstname,
    a.is_flexible,
    a.flexibility_pct,
    a.full_day_only,
    a.admin_target,
    n.id_block,
    n.date,
    n.period,
    n.block_type,
    n.department,
    n.site,
    n.skill_name,
    n.role_name,
    n.id_skill,
    n.id_role,
    n.gap,
    n.id_department,
    n.id_site,
    ss.preference AS skill_preference,
    (5 - ss.preference) * 10 AS skill_score,
    'MEDICAL' AS need_type
  FROM avail a
  JOIN medical_needs n ON a.date = n.date AND a.period = n.period
  JOIN staff_skills ss ON a.id_staff = ss.id_staff AND n.id_skill = ss.id_skill
  -- Pas INTERDIT site
  WHERE NOT EXISTS (
    SELECT 1 FROM interdit_site isite
    WHERE isite.id_staff = a.id_staff AND isite.id_site = n.id_site
  )
  -- Pas INTERDIT département
  AND NOT EXISTS (
    SELECT 1 FROM interdit_dept idept
    WHERE idept.id_staff = a.id_staff AND idept.id_department = n.id_department
  )
  -- Pas INTERDIT staff (aucun médecin du block interdit)
  AND NOT EXISTS (
    SELECT 1 FROM interdit_staff istaff
    JOIN doctors_per_block dpb ON dpb.id_block = n.id_block
    WHERE istaff.id_staff = a.id_staff AND istaff.id_target_staff = dpb.id_doctor
  )
  -- Pas INTERDIT rôle (global ou conditionné au jour)
  AND NOT EXISTS (
    SELECT 1 FROM interdit_role irole
    WHERE irole.id_staff = a.id_staff
      AND irole.id_role = n.id_role
      AND (irole.day_of_week IS NULL
           OR irole.day_of_week = LOWER(to_char(n.date, 'FMDay')))
  )
)

SELECT
  e.*,
  -- Score EVITER site
  COALESCE(es.penalty, 0) AS eviter_site_score,
  -- Score EVITER département
  COALESCE(ed.penalty, 0) AS eviter_dept_score,
  -- Score EVITER staff (sum of penalties for all doctors in the block)
  COALESCE(est.staff_penalty, 0) AS eviter_staff_score,
  -- Score PREFERE site
  COALESCE(ps.bonus, 0) AS prefere_site_score,
  -- Score PREFERE département
  COALESCE(pd.bonus, 0) AS prefere_dept_score,
  -- Score PREFERE staff (sum of bonuses for all doctors in the block)
  COALESCE(pst.staff_bonus, 0) AS prefere_staff_score,
  -- Score total pré-calculé
  (5 - e.skill_preference) * 10
    + COALESCE(es.penalty, 0)
    + COALESCE(ed.penalty, 0)
    + COALESCE(est.staff_penalty, 0)
    + COALESCE(ps.bonus, 0)
    + COALESCE(pd.bonus, 0)
    + COALESCE(pst.staff_bonus, 0)
  AS base_score
FROM eligible_raw e
LEFT JOIN eviter_site es ON es.id_staff = e.id_staff AND es.id_site = e.id_site
LEFT JOIN eviter_dept ed ON ed.id_staff = e.id_staff AND ed.id_department = e.id_department
LEFT JOIN LATERAL (
  SELECT SUM(evs.penalty) AS staff_penalty
  FROM eviter_staff evs
  JOIN doctors_per_block dpb ON dpb.id_block = e.id_block
  WHERE evs.id_staff = e.id_staff AND evs.id_target_staff = dpb.id_doctor
) est ON true
LEFT JOIN prefere_site ps ON ps.id_staff = e.id_staff AND ps.id_site = e.id_site
LEFT JOIN prefere_dept pd ON pd.id_staff = e.id_staff AND pd.id_department = e.id_department
LEFT JOIN LATERAL (
  SELECT SUM(pfs.bonus) AS staff_bonus
  FROM prefere_staff pfs
  JOIN doctors_per_block dpb ON dpb.id_block = e.id_block
  WHERE pfs.id_staff = e.id_staff AND pfs.id_target_staff = dpb.id_doctor
) pst ON true;
