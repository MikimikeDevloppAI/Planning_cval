-- ============================================================
-- Cron job hebdomadaire : génère les work_blocks pour semaine +52
--
-- Crée :
--   1. TOUS les blocks (CONSULTATION + SURGERY + ADMIN) pour tous les depts
--   2. Sync les assignments DOCTOR pour tous les médecins actifs
--
-- Tourne chaque lundi à 02:00 UTC
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fonction : fn_ensure_all_blocks(date_from, date_to)
--    Pré-crée tous les blocks pour tous les départements actifs
-- ============================================================

CREATE OR REPLACE FUNCTION fn_ensure_all_blocks(
  p_date_from DATE, p_date_to DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
  SELECT d.id_department, c.date, p.period::varchar,
    CASE
      WHEN d.name = 'Administration' THEN 'ADMIN'
      WHEN d.name = 'Bloc opératoire' THEN 'SURGERY'
      ELSE 'CONSULTATION'
    END,
    c.id_calendar
  FROM departments d
  CROSS JOIN calendar c
  CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
  WHERE d.is_active = true
    AND c.date BETWEEN p_date_from AND p_date_to
    AND c.day_of_week NOT IN ('SAT','SUN')
    AND c.is_holiday = false
  ON CONFLICT (id_department, date, period) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Fonction : fn_ensure_weekly_blocks(target_week_start DATE)
--    Génère tous les blocks + sync médecins pour une semaine
-- ============================================================

CREATE OR REPLACE FUNCTION fn_ensure_weekly_blocks(
  p_week_start DATE
) RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- Pré-créer tous les blocks pour la semaine (lun → ven)
  PERFORM fn_ensure_all_blocks(p_week_start, (p_week_start + 4)::date);

  -- Sync les assignments DOCTOR
  FOR r IN
    SELECT id_staff FROM staff
    WHERE id_primary_position IN (1, 3) AND is_active = true
  LOOP
    PERFORM fn_sync_doctor_blocks(
      r.id_staff,
      p_week_start,
      (p_week_start + 4)::date
    );
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Fonction cron wrapper : génère pour la semaine +52
-- ============================================================

CREATE OR REPLACE FUNCTION fn_cron_weekly_blocks() RETURNS void AS $$
DECLARE
  v_target DATE;
BEGIN
  -- Lundi de la semaine +52 à partir d'aujourd'hui
  v_target := date_trunc('week', CURRENT_DATE + INTERVAL '52 weeks')::date;
  PERFORM fn_ensure_weekly_blocks(v_target);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Activer pg_cron et planifier le job
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Chaque lundi à 02:00 UTC
SELECT cron.schedule(
  'weekly-ensure-blocks',
  '0 2 * * 1',
  'SELECT fn_cron_weekly_blocks()'
);

-- ============================================================
-- 5. Rattrapage : générer les blocks manquants jusqu'à +52 semaines
-- ============================================================

DO $$
DECLARE
  v_monday DATE;
  v_target DATE;
BEGIN
  -- Commencer au lundi de la semaine courante
  v_monday := date_trunc('week', CURRENT_DATE)::date;
  v_target := date_trunc('week', CURRENT_DATE + INTERVAL '52 weeks')::date;

  WHILE v_monday <= v_target LOOP
    PERFORM fn_ensure_weekly_blocks(v_monday);
    v_monday := v_monday + 7;
  END LOOP;
END;
$$;

COMMIT;
