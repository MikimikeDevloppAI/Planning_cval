-- ============================================================
-- Migration: Audit trail pour assignments
-- ============================================================

-- 1. Ajouter changed_by sur assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS changed_by uuid;

-- 2. Table audit log
CREATE TABLE IF NOT EXISTS assignment_audit_log (
  id_log          serial PRIMARY KEY,
  id_assignment   integer NOT NULL REFERENCES assignments(id_assignment),
  action          varchar NOT NULL,
  old_values      jsonb,
  new_values      jsonb,
  changed_by      uuid,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  reason          text
);

CREATE INDEX IF NOT EXISTS idx_audit_assignment ON assignment_audit_log(id_assignment);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON assignment_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON assignment_audit_log(changed_at);

-- 3. Trigger automatique sur UPDATE/DELETE
CREATE OR REPLACE FUNCTION fn_audit_assignment() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO assignment_audit_log (id_assignment, action, old_values, new_values, changed_by)
    VALUES (OLD.id_assignment, 'STATUS_CHANGED', to_jsonb(OLD), to_jsonb(NEW), NEW.changed_by);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO assignment_audit_log (id_assignment, action, old_values, changed_by)
    VALUES (OLD.id_assignment, 'DELETED', to_jsonb(OLD), OLD.changed_by);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_assignment ON assignments;
CREATE TRIGGER trg_audit_assignment
  AFTER UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_assignment();
