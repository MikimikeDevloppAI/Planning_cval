-- Ajouter id_skill à la table assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS id_skill integer REFERENCES skills(id_skill);
