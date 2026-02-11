-- ============================================================
-- Migration: calendar_slots -> calendar (1 ligne par jour)
-- ============================================================

BEGIN;

-- 0. Supprimer les vues qui dépendent de work_blocks
DROP VIEW IF EXISTS public.v_staffing_needs;
DROP VIEW IF EXISTS public.v_active_work_blocks;

-- 1. Créer la nouvelle table calendar
CREATE TABLE public.calendar (
  id_calendar     serial PRIMARY KEY,
  date            date NOT NULL UNIQUE,
  year            smallint NOT NULL,
  month           smallint NOT NULL,
  day             smallint NOT NULL,
  day_of_week     day_of_week_enum NOT NULL,
  iso_week        smallint NOT NULL,
  week_parity     week_parity_enum NOT NULL,
  quarter         smallint NOT NULL,
  is_weekend      boolean NOT NULL DEFAULT false,
  is_holiday      boolean NOT NULL DEFAULT false,
  holiday_name    varchar(120),
  CONSTRAINT chk_holiday_name CHECK (is_holiday = false OR holiday_name IS NOT NULL)
);

-- 2. Migrer les données (dédoublonner : 1 ligne par date)
INSERT INTO public.calendar (date, year, month, day, day_of_week, iso_week, week_parity, quarter, is_weekend, is_holiday, holiday_name)
SELECT DISTINCT ON (date)
  date, year, month, day, day_of_week, iso_week, week_parity, quarter, is_weekend, is_holiday, holiday_name
FROM public.calendar_slots
ORDER BY date;

-- 3. Mettre à jour work_blocks : remplacer id_slot par id_calendar
ALTER TABLE public.work_blocks DROP CONSTRAINT IF EXISTS work_blocks_id_slot_fkey;

ALTER TABLE public.work_blocks ADD COLUMN id_calendar integer;

UPDATE public.work_blocks wb
SET id_calendar = c.id_calendar
FROM public.calendar_slots cs
JOIN public.calendar c ON c.date = cs.date
WHERE wb.id_slot = cs.id_slot;

ALTER TABLE public.work_blocks ALTER COLUMN id_calendar SET NOT NULL;
ALTER TABLE public.work_blocks ADD CONSTRAINT work_blocks_id_calendar_fkey
  FOREIGN KEY (id_calendar) REFERENCES public.calendar(id_calendar);

ALTER TABLE public.work_blocks DROP COLUMN id_slot;

-- 4. Supprimer l'ancienne table
DROP TABLE public.calendar_slots CASCADE;

-- 5. Index sur calendar
CREATE INDEX idx_calendar_date ON public.calendar(date);
CREATE INDEX idx_calendar_year_month ON public.calendar(year, month);

-- 6. Recréer les vues avec id_calendar
CREATE OR REPLACE VIEW v_active_work_blocks AS
SELECT wb.*
FROM work_blocks wb
WHERE EXISTS (
  SELECT 1 FROM assignments a
  WHERE a.id_block = wb.id_block
    AND a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
);

CREATE OR REPLACE VIEW v_staffing_needs AS
WITH doctor_counts AS (
  SELECT
    a.id_block,
    wb.id_department,
    COUNT(*) as nb_doctors
  FROM assignments a
  JOIN work_blocks wb USING (id_block)
  WHERE a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
    AND wb.block_type = 'CONSULTATION'
  GROUP BY a.id_block, wb.id_department
),
consultation_needs AS (
  SELECT
    dc.id_block,
    t.id_skill,
    t.id_role,
    t.quantity as needed
  FROM doctor_counts dc
  JOIN activity_staffing_tiers t
    ON t.id_department = dc.id_department
    AND dc.nb_doctors BETWEEN t.min_doctors AND t.max_doctors
),
surgery_needs AS (
  SELECT
    a.id_block,
    ar.id_skill,
    ar.quantity as needed
  FROM assignments a
  JOIN work_blocks wb USING (id_block)
  JOIN activity_requirements ar ON ar.id_activity = a.id_procedure
  WHERE a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
    AND wb.block_type = 'SURGERY'
),
filled AS (
  SELECT
    id_block,
    id_role,
    COUNT(*) as assigned
  FROM assignments
  WHERE assignment_type = 'SECRETARY'
    AND status NOT IN ('CANCELLED','INVALIDATED')
  GROUP BY id_block, id_role
)
SELECT
  r.id_block, r.id_skill, r.id_role, r.needed,
  COALESCE(f.assigned, 0) as assigned,
  r.needed - COALESCE(f.assigned, 0) as gap
FROM consultation_needs r
LEFT JOIN filled f USING (id_block, id_role)
UNION ALL
SELECT
  s.id_block, s.id_skill, NULL as id_role, s.needed,
  0 as assigned, s.needed as gap
FROM surgery_needs s;

COMMIT;
