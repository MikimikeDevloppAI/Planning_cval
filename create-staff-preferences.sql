-- ============================================================
-- Table staff_preferences
-- Préférences des secrétaires envers un site, département ou médecin
-- ============================================================

CREATE TABLE public.staff_preferences (
  id_preference   serial PRIMARY KEY,
  id_staff        integer NOT NULL REFERENCES staff(id_staff),

  -- Type de cible : SITE, DEPARTMENT ou STAFF
  target_type     varchar(10) NOT NULL
                  CHECK (target_type IN ('SITE','DEPARTMENT','STAFF')),

  -- Clé étrangère vers la cible (une seule remplie selon target_type)
  id_site         integer REFERENCES sites(id_site),
  id_department   integer REFERENCES departments(id_department),
  id_target_staff integer REFERENCES staff(id_staff),

  -- Niveau de préférence
  preference      varchar(10) NOT NULL
                  CHECK (preference IN ('INTERDIT','EVITER','PREFERE')),

  -- Commentaire optionnel
  reason          text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Contraintes de cohérence : la bonne FK doit être remplie selon target_type
  CONSTRAINT chk_target_site CHECK (
    target_type != 'SITE' OR (id_site IS NOT NULL AND id_department IS NULL AND id_target_staff IS NULL)
  ),
  CONSTRAINT chk_target_department CHECK (
    target_type != 'DEPARTMENT' OR (id_department IS NOT NULL AND id_site IS NULL AND id_target_staff IS NULL)
  ),
  CONSTRAINT chk_target_staff CHECK (
    target_type != 'STAFF' OR (id_target_staff IS NOT NULL AND id_site IS NULL AND id_department IS NULL)
  ),

  -- Pas de doublon : une secrétaire ne peut avoir qu'une préférence par cible
  CONSTRAINT uq_staff_preference UNIQUE (id_staff, target_type, id_site, id_department, id_target_staff)
);

CREATE INDEX idx_sp_staff ON staff_preferences(id_staff);
CREATE INDEX idx_sp_target_type ON staff_preferences(target_type);

COMMENT ON TABLE public.staff_preferences IS
'Préférences des secrétaires.
 INTERDIT : ne jamais assigner à cette cible.
 EVITER : éviter si possible (pénalité dans l''algorithme).
 PREFERE : favoriser cette cible (bonus dans l''algorithme).
 L''absence de préférence = neutre.';
