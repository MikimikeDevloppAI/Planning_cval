-- ============================================================
-- Refonte de v_staffing_needs
-- 4 chemins : consultation tier, obstétricienne seule, samedi, surgery
-- ============================================================

DROP VIEW IF EXISTS v_staffing_needs CASCADE;

CREATE OR REPLACE VIEW v_staffing_needs AS

-- Compter uniquement les médecins (position=1) par block — exclure obstétriciennes
WITH doctor_counts AS (
  SELECT a.id_block, COUNT(*) as nb_doctors
  FROM assignments a
  JOIN staff s ON a.id_staff = s.id_staff
  WHERE a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
    AND s.id_primary_position = 1
  GROUP BY a.id_block
),

-- Blocks avec obstétricienne uniquement (0 médecin)
obstetricienne_only AS (
  SELECT a.id_block
  FROM assignments a
  JOIN staff s ON a.id_staff = s.id_staff
  WHERE a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
    AND s.id_primary_position = 3
  GROUP BY a.id_block
  HAVING a.id_block NOT IN (SELECT id_block FROM doctor_counts)
),

-- Skill de consultation par défaut du département
dept_default_skill AS (
  SELECT DISTINCT ON (id_department) id_department, id_skill
  FROM activity_staffing_tiers
  ORDER BY id_department, id_tier
),

-- Secrétaires déjà assignées par block+role+skill
filled AS (
  SELECT id_block, id_role, id_skill, COUNT(*) as assigned
  FROM assignments
  WHERE assignment_type = 'SECRETARY'
    AND status NOT IN ('CANCELLED','INVALIDATED')
  GROUP BY id_block, id_role, id_skill
),

-- Path A: CONSULTATION TIER normal (lun-ven, avec médecins)
consultation_needs AS (
  SELECT
    wb.id_block, wb.date, wb.period, wb.block_type,
    d.name as department, si.name as site,
    sk.name as skill_name, sr.name as role_name,
    t.id_skill, t.id_role,
    t.quantity as needed,
    COALESCE(f.assigned, 0)::int as assigned,
    (t.quantity - COALESCE(f.assigned, 0))::int as gap
  FROM work_blocks wb
  JOIN departments d ON wb.id_department = d.id_department
  JOIN sites si ON d.id_site = si.id_site
  JOIN calendar c ON wb.id_calendar = c.id_calendar
  JOIN doctor_counts dc ON dc.id_block = wb.id_block
  JOIN activity_staffing_tiers t
    ON t.id_department = wb.id_department
    AND dc.nb_doctors BETWEEN t.min_doctors AND t.max_doctors
  JOIN skills sk ON t.id_skill = sk.id_skill
  JOIN secretary_roles sr ON t.id_role = sr.id_role
  LEFT JOIN filled f ON f.id_block = wb.id_block AND f.id_role = t.id_role AND f.id_skill = t.id_skill
  WHERE wb.block_type = 'CONSULTATION'
    AND c.day_of_week NOT IN ('SAT','SUN')
),

-- Path B: Obstétricienne seule → 1 STD skill département
obstetricienne_needs AS (
  SELECT
    wb.id_block, wb.date, wb.period, wb.block_type,
    d.name as department, si.name as site,
    sk.name as skill_name, 'Standard'::text as role_name,
    ds.id_skill, 1 as id_role,
    1 as needed,
    COALESCE(f.assigned, 0)::int as assigned,
    (1 - COALESCE(f.assigned, 0))::int as gap
  FROM obstetricienne_only oo
  JOIN work_blocks wb ON wb.id_block = oo.id_block
  JOIN departments d ON wb.id_department = d.id_department
  JOIN sites si ON d.id_site = si.id_site
  JOIN calendar c ON wb.id_calendar = c.id_calendar
  JOIN dept_default_skill ds ON ds.id_department = wb.id_department
  JOIN skills sk ON ds.id_skill = sk.id_skill
  LEFT JOIN filled f ON f.id_block = wb.id_block AND f.id_role = 1 AND f.id_skill = ds.id_skill
  WHERE c.day_of_week NOT IN ('SAT','SUN')
),

-- Path C: Samedi → 1 STD skill département par block
saturday_needs AS (
  SELECT
    wb.id_block, wb.date, wb.period, wb.block_type,
    d.name as department, si.name as site,
    sk.name as skill_name, 'Standard'::text as role_name,
    ds.id_skill, 1 as id_role,
    1 as needed,
    COALESCE(f.assigned, 0)::int as assigned,
    (1 - COALESCE(f.assigned, 0))::int as gap
  FROM work_blocks wb
  JOIN departments d ON wb.id_department = d.id_department
  JOIN sites si ON d.id_site = si.id_site
  JOIN calendar c ON wb.id_calendar = c.id_calendar
  JOIN dept_default_skill ds ON ds.id_department = wb.id_department
  JOIN skills sk ON ds.id_skill = sk.id_skill
  LEFT JOIN filled f ON f.id_block = wb.id_block AND f.id_role = 1 AND f.id_skill = ds.id_skill
  WHERE c.day_of_week = 'SAT'
),

-- Path D: SURGERY → activity_requirements via assignments.id_activity
-- L'activité chirurgicale est sur l'assignment DOCTOR, pas sur le work_block
surgery_needs AS (
  SELECT
    wb.id_block, wb.date, wb.period, wb.block_type,
    d.name as department, si.name as site,
    sk.name as skill_name, NULL::text as role_name,
    ar.id_skill, NULL::int as id_role,
    ar.quantity as needed,
    COALESCE(f.assigned, 0)::int as assigned,
    (ar.quantity - COALESCE(f.assigned, 0))::int as gap
  FROM (
    -- Distinct (block, activity) pour éviter le double-comptage
    -- si 2 médecins ont la même activité dans le même block
    SELECT DISTINCT a.id_block, a.id_activity
    FROM assignments a
    WHERE a.assignment_type = 'DOCTOR'
      AND a.status NOT IN ('CANCELLED','INVALIDATED')
      AND a.id_activity IS NOT NULL
  ) ba
  JOIN work_blocks wb ON ba.id_block = wb.id_block
  JOIN departments d ON wb.id_department = d.id_department
  JOIN sites si ON d.id_site = si.id_site
  JOIN activity_requirements ar ON ar.id_activity = ba.id_activity
  JOIN skills sk ON ar.id_skill = sk.id_skill
  LEFT JOIN (
    SELECT id_block, id_skill, COUNT(*) as assigned
    FROM assignments
    WHERE assignment_type = 'SECRETARY'
      AND status NOT IN ('CANCELLED','INVALIDATED')
    GROUP BY id_block, id_skill
  ) f ON f.id_block = wb.id_block AND f.id_skill = ar.id_skill
)

SELECT * FROM consultation_needs
UNION ALL
SELECT * FROM obstetricienne_needs
UNION ALL
SELECT * FROM saturday_needs
UNION ALL
SELECT * FROM surgery_needs;
