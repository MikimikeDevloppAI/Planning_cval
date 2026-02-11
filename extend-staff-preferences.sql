-- ============================================================
-- Migration: Étendre staff_preferences pour supporter target_type = 'ROLE'
-- + day_of_week conditionnel (NULL = tous les jours)
-- ============================================================

-- 1. Étendre le CHECK sur target_type
ALTER TABLE staff_preferences
  DROP CONSTRAINT IF EXISTS staff_preferences_target_type_check;
ALTER TABLE staff_preferences
  ADD CONSTRAINT staff_preferences_target_type_check
  CHECK (target_type IN ('SITE','DEPARTMENT','STAFF','ROLE'));

-- 2. Ajouter colonnes id_role et day_of_week
ALTER TABLE staff_preferences ADD COLUMN IF NOT EXISTS
  id_role integer REFERENCES secretary_roles(id_role);

ALTER TABLE staff_preferences ADD COLUMN IF NOT EXISTS
  day_of_week varchar(10);

-- 3. Contrainte CHECK sur day_of_week
ALTER TABLE staff_preferences DROP CONSTRAINT IF EXISTS staff_preferences_day_of_week_check;
ALTER TABLE staff_preferences ADD CONSTRAINT staff_preferences_day_of_week_check
  CHECK (day_of_week IS NULL OR day_of_week IN
    ('monday','tuesday','wednesday','thursday','friday','saturday'));

-- 4. Contrainte de cohérence pour target_type = 'ROLE'
ALTER TABLE staff_preferences DROP CONSTRAINT IF EXISTS chk_target_role;
ALTER TABLE staff_preferences ADD CONSTRAINT chk_target_role CHECK (
  target_type != 'ROLE'
  OR (id_role IS NOT NULL AND id_site IS NULL AND id_department IS NULL AND id_target_staff IS NULL)
);

-- 5. Mettre à jour la contrainte d'unicité (ajouter id_role + day_of_week)
ALTER TABLE staff_preferences DROP CONSTRAINT IF EXISTS uq_staff_preference;
ALTER TABLE staff_preferences ADD CONSTRAINT uq_staff_preference
  UNIQUE (id_staff, target_type, id_site, id_department, id_target_staff, id_role, day_of_week);
