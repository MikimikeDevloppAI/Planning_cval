-- Renommer les rôles secrétaires
UPDATE secretary_roles SET name = 'Aide fermeture' WHERE id_role = 2;
-- id_role=1 reste 'Standard', id_role=3 reste 'Fermeture'

-- Ajouter la colonne hardship_weight
ALTER TABLE secretary_roles ADD COLUMN IF NOT EXISTS hardship_weight integer NOT NULL DEFAULT 1;
UPDATE secretary_roles SET hardship_weight = 0 WHERE id_role = 1;  -- Standard (pas pénible)
UPDATE secretary_roles SET hardship_weight = 2 WHERE id_role = 2;  -- Aide fermeture
UPDATE secretary_roles SET hardship_weight = 3 WHERE id_role = 3;  -- Fermeture
