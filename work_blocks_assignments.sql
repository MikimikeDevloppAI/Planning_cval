-- ============================================================
-- WORK BLOCKS & ASSIGNMENTS
-- ============================================================

-- ============================================================
-- 1. WORK BLOCKS
-- ============================================================

CREATE TABLE public.work_blocks (
  id_block        serial PRIMARY KEY,
  id_department   integer NOT NULL REFERENCES departments(id_department),
  id_slot         integer NOT NULL REFERENCES calendar_slots(id_slot),
  date            date NOT NULL,
  period          varchar(2) NOT NULL CHECK (period IN ('AM','PM')),
  block_type      varchar NOT NULL CHECK (block_type IN ('CONSULTATION','SURGERY')),
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wb_date_period ON work_blocks(date, period);
CREATE INDEX idx_wb_department ON work_blocks(id_department);
CREATE INDEX idx_wb_type ON work_blocks(block_type);

COMMENT ON TABLE public.work_blocks IS 
'Conteneurs générés automatiquement depuis staff_schedules.
 CONSULTATION : 1 block par département × date × période.
 SURGERY : 1 block par médecin × date × période.
 Jamais supprimés, filtrés via v_active_work_blocks.';


-- ============================================================
-- 2. ASSIGNMENTS
-- ============================================================

CREATE TABLE public.assignments (
  id_assignment   serial PRIMARY KEY,
  id_block        integer NOT NULL REFERENCES work_blocks(id_block),
  id_staff        integer NOT NULL REFERENCES staff(id_staff),
  assignment_type varchar NOT NULL CHECK (assignment_type IN ('DOCTOR','SECRETARY')),
  
  -- Contexte métier
  id_role         integer REFERENCES secretary_roles(id_role),
  id_procedure    integer REFERENCES procedures(id_procedure),
  
  -- Traçabilité
  source          varchar NOT NULL DEFAULT 'SCHEDULE'
                  CHECK (source IN ('SCHEDULE','ALGORITHM','MANUAL')),
  id_schedule     integer REFERENCES staff_schedules(id_schedule),
  
  -- Workflow
  status          varchar NOT NULL DEFAULT 'PROPOSED'
                  CHECK (status IN ('PROPOSED','CONFIRMED','PUBLISHED',
                                    'CANCELLED','INVALIDATED')),
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Un staff ne peut être assigné qu'une fois par block
  CONSTRAINT uq_block_staff UNIQUE (id_block, id_staff),
  
  -- Médecin : pas de rôle
  CONSTRAINT chk_doctor CHECK (
    assignment_type != 'DOCTOR' OR id_role IS NULL
  ),
  -- Assistante : un rôle obligatoire, pas de procédure
  CONSTRAINT chk_secretary CHECK (
    assignment_type != 'SECRETARY' OR (id_procedure IS NULL AND id_role IS NOT NULL)
  )
);

CREATE INDEX idx_asg_block ON assignments(id_block);
CREATE INDEX idx_asg_staff ON assignments(id_staff);
CREATE INDEX idx_asg_type_status ON assignments(assignment_type, status);

COMMENT ON TABLE public.assignments IS 
'Assignation unifiée médecins + assistantes.
 DOCTOR : source=SCHEDULE, status=PUBLISHED directement.
 SECRETARY : source=ALGORITHM|MANUAL, workflow PROPOSED→CONFIRMED→PUBLISHED.';


-- ============================================================
-- 3. SCHEDULING ISSUES
-- ============================================================

CREATE TABLE public.scheduling_issues (
  id_issue        serial PRIMARY KEY,
  id_block        integer NOT NULL REFERENCES work_blocks(id_block),
  issue_type      varchar NOT NULL 
                  CHECK (issue_type IN ('DEFICIT','SURPLUS','ABSENCE_CONFLICT')),
  id_assignment   integer REFERENCES assignments(id_assignment),
  id_staff        integer REFERENCES staff(id_staff),
  id_role         integer REFERENCES secretary_roles(id_role),
  description     text,
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. VUES
-- ============================================================

-- Blocks actifs (au moins 1 médecin non annulé)
CREATE OR REPLACE VIEW v_active_work_blocks AS
SELECT wb.*
FROM work_blocks wb
WHERE EXISTS (
  SELECT 1 FROM assignments a
  WHERE a.id_block = wb.id_block
    AND a.assignment_type = 'DOCTOR'
    AND a.status NOT IN ('CANCELLED','INVALIDATED')
);

-- Besoins en assistantes
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
