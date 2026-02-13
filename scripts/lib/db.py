"""Database loading for secretary assignment algorithm."""

import os
import psycopg2
import psycopg2.extras
from datetime import date, timedelta


def get_connection():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        sslmode="require",
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def load_week_data(conn, week_start: date):
    """Load all data needed for one week of assignment, using SQL views."""
    week_end = week_start + timedelta(days=6)

    cur = conn.cursor()
    data = {}

    # 1. Secretary availability (from v_secretary_availability)
    cur.execute(
        """SELECT id_staff, lastname, firstname, date, period,
                  is_flexible, flexibility_pct::float, full_day_only,
                  admin_target::int
           FROM v_secretary_availability
           WHERE date BETWEEN %s AND %s
           ORDER BY id_staff, date, period""",
        (week_start, week_end),
    )
    data["availability"] = cur.fetchall()

    # 2. Eligibility with pre-computed scores (from v_secretary_eligibility)
    cur.execute(
        """SELECT id_staff, lastname, firstname,
                  is_flexible, flexibility_pct::float, full_day_only, admin_target::int,
                  id_block, date, period, block_type,
                  department, site, skill_name, role_name,
                  id_skill, id_role, gap,
                  id_department, id_site,
                  skill_preference, skill_score::int, base_score::int,
                  eviter_site_score::int, eviter_dept_score::int, eviter_staff_score::int,
                  prefere_site_score::int, prefere_dept_score::int, prefere_staff_score::int,
                  need_type
           FROM v_secretary_eligibility
           WHERE date BETWEEN %s AND %s
           ORDER BY id_staff, date, period""",
        (week_start, week_end),
    )
    data["eligibility"] = cur.fetchall()

    # 3. Distinct secretaries (from availability)
    cur.execute(
        """SELECT DISTINCT id_staff, lastname, firstname,
                  is_flexible, flexibility_pct::float, full_day_only,
                  admin_target::int
           FROM v_secretary_availability
           WHERE date BETWEEN %s AND %s
           ORDER BY lastname""",
        (week_start, week_end),
    )
    data["secretaries"] = cur.fetchall()

    # 4. Staffing needs (for the report)
    cur.execute(
        """SELECT sn.id_block, sn.date, sn.period, sn.block_type,
                  sn.department, sn.site, sn.skill_name, sn.role_name,
                  sn.id_skill, sn.id_role,
                  sn.needed::int, sn.assigned::int, sn.gap::int,
                  wb.id_department, d.id_site
           FROM v_staffing_needs sn
           JOIN work_blocks wb ON sn.id_block = wb.id_block
           JOIN departments d ON wb.id_department = d.id_department
           WHERE sn.date BETWEEN %s AND %s AND sn.gap > 0""",
        (week_start, week_end),
    )
    data["needs"] = cur.fetchall()

    # 5. Existing MANUAL secretary assignments (preserved by solver)
    cur.execute(
        """SELECT a.id_block, a.id_staff, a.id_role, wb.date, wb.period
           FROM assignments a
           JOIN work_blocks wb ON a.id_block = wb.id_block
           WHERE a.assignment_type = 'SECRETARY'
             AND a.source = 'MANUAL'
             AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
             AND wb.date BETWEEN %s AND %s""",
        (week_start, week_end),
    )
    data["existing_assignments"] = cur.fetchall()

    # 6. Reference data (for report)
    cur.execute(
        """SELECT d.id_department, d.name, d.id_site, si.name AS site_name
           FROM departments d JOIN sites si ON d.id_site = si.id_site"""
    )
    data["departments"] = cur.fetchall()

    cur.execute("SELECT * FROM sites ORDER BY id_site")
    data["sites"] = cur.fetchall()

    cur.execute("SELECT * FROM secretary_roles ORDER BY id_role")
    data["roles"] = cur.fetchall()

    # 7. Staff preferences (for report EVITER display)
    cur.execute(
        """SELECT sp.id_staff, sp.target_type, sp.id_site, sp.id_department,
                  sp.id_target_staff, sp.preference
           FROM staff_preferences sp
           JOIN staff s ON sp.id_staff = s.id_staff
           WHERE s.id_primary_position = 2 AND s.is_active = true"""
    )
    data["preferences"] = cur.fetchall()

    # 8. Doctor-activity mapping per block (for surgery id_linked_doctor)
    cur.execute(
        """SELECT a.id_assignment, a.id_block, a.id_staff, a.id_activity,
                  ar.id_skill
           FROM assignments a
           JOIN activity_requirements ar ON ar.id_activity = a.id_activity
           JOIN work_blocks wb ON a.id_block = wb.id_block
           WHERE a.assignment_type = 'DOCTOR'
             AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
             AND a.id_activity IS NOT NULL
             AND wb.date BETWEEN %s AND %s""",
        (week_start, week_end),
    )
    data["doctor_activities"] = cur.fetchall()

    # 9. Admin department ID
    cur.execute(
        "SELECT id_department FROM departments WHERE name = 'Administration' LIMIT 1"
    )
    row = cur.fetchone()
    data["admin_dept_id"] = row["id_department"] if row else None

    # 10. All active secretaries (including those without availability this week)
    cur.execute(
        """SELECT s.id_staff, s.lastname, s.firstname
           FROM staff s
           WHERE s.id_primary_position = 2 AND s.is_active = true
           ORDER BY s.lastname"""
    )
    data["all_secretaries"] = cur.fetchall()

    # 11. Staff skills (for report - who has no skills)
    cur.execute(
        """SELECT ss.id_staff, ss.id_skill
           FROM staff_skills ss
           JOIN staff s ON ss.id_staff = s.id_staff
           WHERE s.id_primary_position = 2 AND s.is_active = true"""
    )
    data["skills"] = cur.fetchall()

    return data


def create_admin_blocks(conn, week_start: date, admin_dept_id: int):
    """Create 1 ADMIN work_block per date+period for the week."""
    week_end = week_start + timedelta(days=6)
    cur = conn.cursor()

    cur.execute(
        """INSERT INTO work_blocks (id_department, date, period, block_type, id_calendar)
           SELECT %s, c.date, p.period::varchar, 'ADMIN', c.id_calendar
           FROM calendar c
           CROSS JOIN (VALUES ('AM'), ('PM')) AS p(period)
           WHERE c.date BETWEEN %s AND %s
             AND c.day_of_week NOT IN ('SUN')
             AND NOT c.is_holiday
             AND NOT EXISTS (
               SELECT 1 FROM work_blocks wb
               WHERE wb.block_type = 'ADMIN'
                 AND wb.date = c.date
                 AND wb.period = p.period::varchar
             )
           RETURNING id_block, date, period""",
        (admin_dept_id, week_start, week_end),
    )
    created = cur.fetchall()
    conn.commit()
    return created


def load_admin_blocks(conn, week_start: date):
    """Load existing ADMIN blocks for the week."""
    week_end = week_start + timedelta(days=6)
    cur = conn.cursor()
    cur.execute(
        """SELECT wb.id_block, wb.date, wb.period, wb.id_department
           FROM work_blocks wb
           WHERE wb.block_type = 'ADMIN'
             AND wb.date BETWEEN %s AND %s""",
        (week_start, week_end),
    )
    return cur.fetchall()


def clear_secretary_assignments(conn, week_start: date):
    """Delete all non-MANUAL secretary assignments for the week.

    Removes SCHEDULE (pre-materialized ADMIN) and ALGORITHM (previous solver)
    so the solver can recreate everything from scratch. MANUAL are preserved.
    """
    week_end = week_start + timedelta(days=6)
    cur = conn.cursor()
    cur.execute(
        """DELETE FROM assignments
           WHERE assignment_type = 'SECRETARY'
             AND source IN ('SCHEDULE', 'ALGORITHM')
             AND id_block IN (
               SELECT id_block FROM work_blocks WHERE date BETWEEN %s AND %s
             )""",
        (week_start, week_end),
    )
    deleted = cur.rowcount
    conn.commit()
    return deleted


def write_assignments(conn, assignments):
    """Batch insert secretary assignments."""
    if not assignments:
        return 0

    cur = conn.cursor()
    values = []
    params = []
    for i, a in enumerate(assignments):
        values.append("(%s, %s, 'SECRETARY', %s, %s, %s, 'ALGORITHM', 'PROPOSED')")
        # chk_secretary requires id_role NOT NULL for SECRETARY type; default to 1 (Standard)
        role_id = a["id_role"] if a["id_role"] is not None else 1
        params.extend([a["id_block"], a["id_staff"], role_id, a.get("id_skill"), a.get("id_linked_doctor")])

    sql = (
        "INSERT INTO assignments (id_block, id_staff, assignment_type, id_role, id_skill, id_linked_doctor, source, status) "
        "VALUES " + ", ".join(values) + " "
        "ON CONFLICT (id_block, id_staff) DO UPDATE SET "
        "id_role = EXCLUDED.id_role, id_skill = EXCLUDED.id_skill, "
        "id_linked_doctor = EXCLUDED.id_linked_doctor, "
        "source = EXCLUDED.source, status = EXCLUDED.status"
    )
    cur.execute(sql, params)
    inserted = cur.rowcount
    conn.commit()
    return inserted
