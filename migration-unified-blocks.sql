-- ============================================================
-- Migration : Architecture unifiée work_blocks
--
-- work_block = créneau physique (dept × date × période)
-- id_activity passe de work_blocks → assignments (DOCTOR)
-- id_linked_doctor ajouté sur assignments (SECRETARY chirurgie)
-- ============================================================

BEGIN;

-- ============================================================
-- Phase 1a : Ajouter les colonnes sur assignments
-- ============================================================

-- id_activity : pour les assignments DOCTOR chirurgie
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS id_activity integer REFERENCES activity_templates(id_activity);

-- id_linked_doctor : pour les assignments SECRETARY chirurgie → pointe vers le DOCTOR
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS id_linked_doctor integer REFERENCES assignments(id_assignment);

-- Index partiels pour les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_asg_linked_doctor ON assignments(id_linked_doctor)
  WHERE id_linked_doctor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asg_activity ON assignments(id_activity)
  WHERE id_activity IS NOT NULL;

-- Secrétaires ne doivent pas avoir id_activity directement
ALTER TABLE assignments
  ADD CONSTRAINT chk_secretary_no_activity CHECK (
    assignment_type != 'SECRETARY' OR id_activity IS NULL
  );

-- ============================================================
-- Phase 1b : Backfill id_activity sur les assignments DOCTOR
-- ============================================================

UPDATE assignments a
SET id_activity = wb.id_activity
FROM work_blocks wb
WHERE a.id_block = wb.id_block
  AND a.assignment_type = 'DOCTOR'
  AND wb.block_type = 'SURGERY'
  AND wb.id_activity IS NOT NULL
  AND a.id_activity IS NULL;

-- Vérification : aucun assignment DOCTOR chirurgie sans id_activity
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM assignments a
  JOIN work_blocks wb ON a.id_block = wb.id_block
  WHERE a.assignment_type = 'DOCTOR'
    AND wb.block_type = 'SURGERY'
    AND wb.id_activity IS NOT NULL
    AND a.id_activity IS NULL
    AND a.status NOT IN ('CANCELLED','INVALIDATED');
  IF v_count > 0 THEN
    RAISE WARNING 'Backfill incomplet : % assignments DOCTOR SURGERY sans id_activity', v_count;
  END IF;
END $$;

-- ============================================================
-- Phase 1c : Merger les SURGERY blocks dupliqués
-- ============================================================

-- Trouver les groupes de blocks SURGERY partageant (dept, date, period)
-- Garder le plus ancien id_block (rn=1), déplacer les assignments des autres
CREATE TEMP TABLE _surgery_merges AS
WITH ranked AS (
  SELECT id_block, id_department, date, period,
    ROW_NUMBER() OVER (PARTITION BY id_department, date, period ORDER BY id_block) AS rn
  FROM work_blocks
  WHERE block_type = 'SURGERY'
)
SELECT r.id_block AS old_block, k.id_block AS keeper_block
FROM ranked r
JOIN ranked k ON k.id_department = r.id_department
             AND k.date = r.date AND k.period = r.period AND k.rn = 1
WHERE r.rn > 1;

-- Désactiver le trigger audit pendant la migration des blocks
ALTER TABLE assignments DISABLE TRIGGER trg_audit_assignment;

-- Déplacer les assignments des blocks dupliqués vers le block conservé
-- (seulement si le staff n'est pas déjà présent sur le keeper)
UPDATE assignments a
SET id_block = m.keeper_block
FROM _surgery_merges m
WHERE a.id_block = m.old_block
  AND NOT EXISTS (
    SELECT 1 FROM assignments a2
    WHERE a2.id_block = m.keeper_block AND a2.id_staff = a.id_staff
  );

-- Déplacer les scheduling_issues si nécessaire
UPDATE scheduling_issues SET id_block = m.keeper_block
FROM _surgery_merges m
WHERE scheduling_issues.id_block = m.old_block;

-- Supprimer les audit log entries pour les assignments orphelins
DELETE FROM assignment_audit_log
WHERE id_assignment IN (
  SELECT a.id_assignment FROM assignments a
  JOIN _surgery_merges m ON a.id_block = m.old_block
);

-- Supprimer les assignments orphelins restants (staff en doublon)
DELETE FROM assignments a
USING _surgery_merges m
WHERE a.id_block = m.old_block;

-- Supprimer les blocks dupliqués (maintenant orphelins)
DELETE FROM work_blocks
WHERE id_block IN (SELECT old_block FROM _surgery_merges);

-- Réactiver le trigger audit
ALTER TABLE assignments ENABLE TRIGGER trg_audit_assignment;

DROP TABLE _surgery_merges;

-- ============================================================
-- Phase 1d : Remplacer les index uniques, supprimer id_activity
-- ============================================================

-- Supprimer les anciens index partiels par block_type
DROP INDEX IF EXISTS uq_wb_surgery;
DROP INDEX IF EXISTS uq_wb_consultation;
DROP INDEX IF EXISTS uq_wb_admin;
DROP INDEX IF EXISTS idx_wb_activity;

-- Un seul index unique universel
CREATE UNIQUE INDEX uq_wb_dept_date_period ON work_blocks (id_department, date, period);

-- Dropper les vues qui dépendent de work_blocks.id_activity
-- Elles seront recréées après avec la nouvelle logique
DROP VIEW IF EXISTS v_secretary_eligibility CASCADE;
DROP VIEW IF EXISTS v_staffing_needs CASCADE;

-- Supprimer la colonne id_activity de work_blocks
ALTER TABLE work_blocks DROP COLUMN IF EXISTS id_activity;

-- Ajouter ADMIN au check constraint de block_type si pas déjà fait
ALTER TABLE work_blocks DROP CONSTRAINT IF EXISTS work_blocks_block_type_check;
ALTER TABLE work_blocks ADD CONSTRAINT work_blocks_block_type_check
  CHECK (block_type IN ('CONSULTATION','SURGERY','ADMIN'));

COMMIT;
