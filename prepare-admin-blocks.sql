-- ============================================================
-- Préparation pour les blocs ADMIN
-- ============================================================

-- 1. Ajouter ADMIN au CHECK constraint de work_blocks.block_type
ALTER TABLE work_blocks DROP CONSTRAINT work_blocks_block_type_check;
ALTER TABLE work_blocks ADD CONSTRAINT work_blocks_block_type_check
  CHECK (block_type IN ('CONSULTATION', 'SURGERY', 'ADMIN'));

-- 2. Créer le département Administration (lié au site CLV par défaut)
INSERT INTO departments (name, id_site, staffing_type, is_active)
VALUES ('Administration', 1, 'TIER', true)
ON CONFLICT DO NOTHING;
