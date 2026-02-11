-- Ajouter la colonne id_activity à work_blocks (optionnelle)
ALTER TABLE public.work_blocks
  ADD COLUMN id_activity integer REFERENCES activity_templates(id_activity);

CREATE INDEX idx_wb_activity ON work_blocks(id_activity);
