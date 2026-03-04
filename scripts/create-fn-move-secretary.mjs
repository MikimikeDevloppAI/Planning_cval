import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE OR REPLACE FUNCTION fn_move_secretary(
  p_old_assignment_id  bigint,
  p_target_dept_id     int,
  p_target_date        date,
  p_target_period      text,
  p_staff_id           int,
  p_role_id            int DEFAULT 1,
  p_skill_id           int DEFAULT NULL,
  p_linked_doctor_id   int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_target_block_id int;
  v_new record;
BEGIN
  -- 1. Cancel old assignment
  UPDATE assignments
  SET status = 'CANCELLED', updated_at = now()
  WHERE id_assignment = p_old_assignment_id
    AND status NOT IN ('CANCELLED', 'INVALIDATED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment % not found or already cancelled', p_old_assignment_id;
  END IF;

  -- 2. Find target block
  SELECT id_block INTO v_target_block_id
  FROM work_blocks
  WHERE id_department = p_target_dept_id
    AND date = p_target_date
    AND period = p_target_period;

  IF v_target_block_id IS NULL THEN
    RAISE EXCEPTION 'No block for dept=%, date=%, period=%',
      p_target_dept_id, p_target_date, p_target_period;
  END IF;

  -- 3. Enforce role NOT NULL (chk_secretary defense)
  IF p_role_id IS NULL THEN
    p_role_id := 1;
  END IF;

  -- 4. Upsert new assignment
  INSERT INTO assignments (
    id_block, id_staff, assignment_type,
    id_role, id_skill, id_linked_doctor,
    source, status
  ) VALUES (
    v_target_block_id, p_staff_id, 'SECRETARY',
    p_role_id, p_skill_id, p_linked_doctor_id,
    'MANUAL', 'PROPOSED'
  )
  ON CONFLICT (id_block, id_staff) DO UPDATE SET
    assignment_type = 'SECRETARY',
    id_role = EXCLUDED.id_role,
    id_skill = EXCLUDED.id_skill,
    id_linked_doctor = EXCLUDED.id_linked_doctor,
    source = 'MANUAL',
    status = 'PROPOSED',
    updated_at = now()
  RETURNING * INTO v_new;

  RETURN jsonb_build_object(
    'id_assignment', v_new.id_assignment,
    'id_block', v_new.id_block,
    'id_staff', v_new.id_staff,
    'id_role', v_new.id_role,
    'id_skill', v_new.id_skill,
    'id_linked_doctor', v_new.id_linked_doctor,
    'status', v_new.status
  );
END;
$fn$;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log("✓ fn_move_secretary created successfully");
} catch (err) {
  console.error("✗ Error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
