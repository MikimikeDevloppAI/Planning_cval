"""
Weekly visual report: doctors + secretaries grouped by site & department.
Generates an HTML file and opens it in the browser.

Usage:
    python scripts/weekly_view.py --week 2026-02-09
    python scripts/weekly_view.py --week 2026-02-09 --solve
"""

import sys
import os
import argparse
import webbrowser
from datetime import date, timedelta
from collections import defaultdict
from html import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from lib.db import get_connection

DOW_NAMES = {0: "Lundi", 1: "Mardi", 2: "Mercredi", 3: "Jeudi", 4: "Vendredi", 5: "Samedi", 6: "Dimanche"}
DOW_SHORT = {0: "Lun", 1: "Mar", 2: "Mer", 3: "Jeu", 4: "Ven", 5: "Sam", 6: "Dim"}


def load_data(args, week_start, week_end):
    """Load doctor and secretary assignments."""
    conn = get_connection()
    cur = conn.cursor()

    secretary_assignments = []
    solver_status = None
    solver_stats = None

    if args.solve:
        from lib.db import load_week_data, create_admin_blocks, load_admin_blocks
        from lib.model import build_model, solve_model
        from lib.report import print_report

        data = load_week_data(conn, week_start)
        create_admin_blocks(conn, week_start, data["admin_dept_id"])
        admin_blocks = load_admin_blocks(conn, week_start)

        availability = defaultdict(lambda: defaultdict(set))
        for row in data["availability"]:
            d = row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"]))
            availability[row["id_staff"]][d].add(row["period"])
        availability = dict(availability)

        model, x, y, meta = build_model(data, availability, admin_blocks)
        result = solve_model(model, x, y, data, meta, time_limit=30)
        solver_status = f"{result['status']} ({result['wall_time']:.1f}s)"
        solver_stats = {
            "medical_filled": len(result["assignments"]),
            "medical_total": sum(n["gap"] for n in data["needs"]),
            "admin": len(result["admin_assignments"]),
            "unfilled": len(result["unfilled"]),
        }

        # Print console report too
        print_report(data, result, availability)

        # Load staff names
        cur.execute("SELECT id_staff, lastname, firstname FROM staff WHERE is_active = true")
        staff_names = {r["id_staff"]: r for r in cur.fetchall()}

        for a in result["assignments"] + result["admin_assignments"]:
            s = staff_names.get(a["id_staff"], {})
            secretary_assignments.append({
                "id_staff": a["id_staff"],
                "date": a["date"],
                "period": a["period"],
                "block_type": a.get("block_type", ""),
                "department": a.get("department", "Admin"),
                "site": a.get("site", "N/A"),
                "role_name": a.get("role_name") or None,
                "skill_name": a.get("skill_name") or None,
                "name": f"{s.get('lastname', '?')} {s.get('firstname', '?')[:1]}.",
            })
    else:
        cur.execute("""
            SELECT a.id_staff, s.lastname, s.firstname,
                   wb.date, wb.period, wb.block_type,
                   d.name as department, si.name as site,
                   sr.name as role_name, sk.name as skill_name
            FROM assignments a
            JOIN staff s ON a.id_staff = s.id_staff
            JOIN work_blocks wb ON a.id_block = wb.id_block
            JOIN departments d ON wb.id_department = d.id_department
            JOIN sites si ON d.id_site = si.id_site
            LEFT JOIN secretary_roles sr ON a.id_role = sr.id_role
            LEFT JOIN skills sk ON a.id_skill = sk.id_skill
            WHERE a.assignment_type = 'SECRETARY'
              AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
              AND wb.date BETWEEN %s AND %s
            ORDER BY wb.date, wb.period, d.name
        """, (week_start, week_end))
        for row in cur.fetchall():
            secretary_assignments.append({
                "id_staff": row["id_staff"],
                "date": row["date"],
                "period": row["period"],
                "block_type": row["block_type"],
                "department": row["department"],
                "site": row["site"],
                "role_name": row["role_name"],
                "skill_name": row["skill_name"],
                "name": f"{row['lastname']} {row['firstname'][:1]}.",
            })

    # Load doctor assignments with speciality
    cur.execute("""
        SELECT a.id_staff, s.lastname, s.firstname,
               wb.date, wb.period, wb.block_type,
               d.name as department, si.name as site,
               p.name as position_name
        FROM assignments a
        JOIN staff s ON a.id_staff = s.id_staff
        JOIN work_blocks wb ON a.id_block = wb.id_block
        JOIN departments d ON wb.id_department = d.id_department
        JOIN sites si ON d.id_site = si.id_site
        LEFT JOIN positions p ON s.id_primary_position = p.id_position
        WHERE a.assignment_type = 'DOCTOR'
          AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
          AND wb.date BETWEEN %s AND %s
        ORDER BY wb.date, wb.period, d.name, s.lastname
    """, (week_start, week_end))
    doctor_rows = cur.fetchall()

    conn.close()
    return doctor_rows, secretary_assignments, solver_status, solver_stats


def build_html(week_start, week_end, doctor_rows, secretary_assignments, solver_status, solver_stats):
    """Build HTML report grouped by site > department."""

    # Group doctors by (date, period, site, department)
    docs_by_slot = defaultdict(list)
    for row in doctor_rows:
        d = row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"]))
        key = (d, row["period"], row["site"], row["department"])
        docs_by_slot[key].append({
            "name": f"{row['lastname']} {row['firstname'][:1]}.",
            "position": row.get("position_name", "Médecin"),
        })

    # Group secretaries by (date, period, site, department)
    secs_by_slot = defaultdict(list)
    for a in secretary_assignments:
        d = a["date"] if isinstance(a["date"], date) else date.fromisoformat(str(a["date"]))
        site = a.get("site") or "N/A"
        key = (d, a["period"], site, a["department"])
        secs_by_slot[key].append(a)

    # Collect all sites and departments per site
    site_depts = defaultdict(set)
    for key in list(docs_by_slot.keys()) + list(secs_by_slot.keys()):
        _, _, site, dept = key
        if dept != "Administration":
            site_depts[site].add(dept)

    sorted_sites = sorted(site_depts.keys())
    for site in sorted_sites:
        site_depts[site] = sorted(site_depts[site])

    # Build days
    days = []
    d = week_start
    while d <= week_end:
        days.append(d)
        d += timedelta(days=1)

    # Site colors
    site_colors = {}
    palette = ["#1565c0", "#2e7d32", "#6a1b9a", "#c62828", "#ef6c00"]
    for i, site in enumerate(sorted_sites):
        site_colors[site] = palette[i % len(palette)]

    # Role CSS class
    def role_cls(role):
        if role == "Standard": return "sec-std"
        if role == "Aide fermeture": return "sec-aidf"
        if role == "Fermeture": return "sec-ferm"
        if role and "ception" in role: return "sec-rec"
        return "sec-other"

    def role_short(role):
        m = {"Standard": "Std", "Aide fermeture": "AidF", "Fermeture": "Ferm"}
        if role and "ception" in role: return "Réc"
        return m.get(role, role or "-")

    # Start HTML
    lines = []
    stats_html = ""
    if solver_stats:
        stats_html = (
            f" &mdash; {solver_stats['medical_filled']}/{solver_stats['medical_total']} med, "
            f"{solver_stats['admin']} admin, "
            f"{solver_stats['unfilled']} non rempli(s)"
        )

    lines.append(f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Planning {week_start} - {week_end}</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f0f2f5; padding: 16px; color: #1a1a1a; font-size: 14px; }}
h1 {{ text-align: center; margin-bottom: 4px; font-size: 1.4em; color: #1a1a1a; }}
.subtitle {{ text-align: center; color: #666; margin-bottom: 16px; font-size: 0.85em; }}

/* Legend */
.legend {{ display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 20px; padding: 10px; background: #fff; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }}
.legend-item {{ display: flex; align-items: center; gap: 4px; font-size: 0.8em; }}
.legend-dot {{ width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.15); }}

/* Day card */
.day-card {{ background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; overflow: hidden; }}
.day-header {{ background: #1e3a5f; color: #fff; padding: 8px 16px; font-size: 1em; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }}
.day-header.weekend {{ background: #78909c; }}
.day-header .day-stats {{ font-size: 0.78em; font-weight: 400; opacity: 0.85; }}

/* Period */
.period-row {{ display: flex; border-bottom: 1px solid #e8e8e8; }}
.period-row:last-child {{ border-bottom: none; }}
.period-label {{ width: 40px; min-width: 40px; background: #f5f7fa; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8em; color: #5a6977; border-right: 2px solid #e0e4e8; }}
.period-content {{ flex: 1; padding: 6px 0; }}

/* Site */
.site-block {{ border-bottom: 1px solid #f0f0f0; padding: 4px 12px 6px; }}
.site-block:last-child {{ border-bottom: none; }}
.site-name {{ font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; padding: 2px 0; }}

/* Department */
.dept-block {{ display: flex; align-items: flex-start; padding: 3px 0; gap: 8px; }}
.dept-name {{ min-width: 150px; font-weight: 600; font-size: 0.85em; color: #37474f; padding-top: 3px; }}
.dept-staff {{ flex: 1; display: flex; flex-wrap: wrap; gap: 3px; align-items: flex-start; }}

/* Person badges */
.badge {{ display: inline-flex; align-items: center; gap: 3px; border-radius: 4px; padding: 3px 7px; font-size: 0.78em; line-height: 1.3; border: 1px solid; }}
.badge .name {{ font-weight: 600; }}
.badge .detail {{ font-weight: 400; opacity: 0.8; font-size: 0.9em; }}

/* Doctor */
.doc {{ background: #e8f0fe; border-color: #aecbfa; color: #1a56db; }}

/* Secretary roles */
.sec-std {{ background: #e6f4ea; border-color: #a8dab5; color: #1e7e34; }}
.sec-aidf {{ background: #fef3e0; border-color: #f9cb80; color: #c75300; }}
.sec-ferm {{ background: #fde7e9; border-color: #f5a3ab; color: #b71c1c; }}
.sec-rec {{ background: #e0f0ff; border-color: #90c2f9; color: #0850a0; }}
.sec-other {{ background: #f5f5f5; border-color: #ccc; color: #444; }}
.sec-admin {{ background: #f3e8fd; border-color: #ce93d8; color: #6a1b9a; }}

/* Admin group */
.admin-block {{ padding: 4px 12px 6px; border-top: 1px dashed #e0e0e0; }}
.admin-label {{ font-size: 0.75em; font-weight: 700; color: #6a1b9a; margin-bottom: 3px; }}
.admin-list {{ display: flex; flex-wrap: wrap; gap: 3px; }}

.empty-day {{ color: #999; padding: 20px; text-align: center; font-style: italic; font-size: 0.9em; }}
</style>
</head>
<body>
<h1>Planning Semaine</h1>
<div class="subtitle">{escape(str(week_start))} &rarr; {escape(str(week_end))}{(' &mdash; Solver: ' + escape(solver_status)) if solver_status else ''}{stats_html}</div>

<div class="legend">
  <div class="legend-item"><div class="legend-dot" style="background:#e8f0fe;border-color:#aecbfa"></div>Médecin</div>
  <div class="legend-item"><div class="legend-dot" style="background:#e6f4ea;border-color:#a8dab5"></div>Standard</div>
  <div class="legend-item"><div class="legend-dot" style="background:#fef3e0;border-color:#f9cb80"></div>Aide fermeture</div>
  <div class="legend-item"><div class="legend-dot" style="background:#fde7e9;border-color:#f5a3ab"></div>Fermeture</div>
  <div class="legend-item"><div class="legend-dot" style="background:#e0f0ff;border-color:#90c2f9"></div>Réception</div>
  <div class="legend-item"><div class="legend-dot" style="background:#f5f5f5;border-color:#ccc"></div>Autre (chirurgie)</div>
  <div class="legend-item"><div class="legend-dot" style="background:#f3e8fd;border-color:#ce93d8"></div>Admin</div>
</div>
""")

    for d in days:
        dow = DOW_NAMES.get(d.weekday(), "?")
        is_weekend = d.weekday() >= 5
        header_class = "day-header weekend" if is_weekend else "day-header"

        # Count staff for this day
        day_docs = sum(1 for k, v in docs_by_slot.items() if k[0] == d for _ in v)
        day_secs_med = sum(1 for k, v in secs_by_slot.items() if k[0] == d for s in v if s["block_type"] != "ADMIN")
        day_secs_adm = sum(1 for k, v in secs_by_slot.items() if k[0] == d for s in v if s["block_type"] == "ADMIN")

        lines.append(f'<div class="day-card">')
        lines.append(f'<div class="{header_class}">')
        lines.append(f'  <span>{dow} {d.strftime("%d/%m/%Y")}</span>')
        if day_docs or day_secs_med:
            lines.append(f'  <span class="day-stats">{day_docs} méd. / {day_secs_med} sec. / {day_secs_adm} admin</span>')
        lines.append(f'</div>')

        day_has_content = False

        for period in ["AM", "PM"]:
            # Check if any data for this period
            period_sites = []
            admin_secs_period = []

            for site in sorted_sites:
                site_dept_data = []
                for dept in site_depts[site]:
                    key = (d, period, site, dept)
                    docs = docs_by_slot.get(key, [])
                    secs = secs_by_slot.get(key, [])
                    med_secs = [s for s in secs if s["block_type"] != "ADMIN"]
                    adm_secs = [s for s in secs if s["block_type"] == "ADMIN"]
                    admin_secs_period.extend(adm_secs)
                    if docs or med_secs:
                        site_dept_data.append((dept, docs, med_secs))
                if site_dept_data:
                    period_sites.append((site, site_dept_data))

            # Admin from Administration department
            admin_key = (d, period, "N/A", "Administration")
            admin_secs_period.extend(secs_by_slot.get(admin_key, []))
            # Try other site keys for admin
            for site in sorted_sites:
                ak = (d, period, site, "Administration")
                admin_secs_period.extend(secs_by_slot.get(ak, []))

            if not period_sites and not admin_secs_period:
                continue

            day_has_content = True
            lines.append(f'<div class="period-row">')
            lines.append(f'  <div class="period-label">{period}</div>')
            lines.append(f'  <div class="period-content">')

            for site, dept_data in period_sites:
                sc = site_colors.get(site, "#333")
                lines.append(f'    <div class="site-block">')
                lines.append(f'      <div class="site-name" style="color:{sc}">{escape(site)}</div>')

                for dept, docs, med_secs in dept_data:
                    lines.append(f'      <div class="dept-block">')
                    lines.append(f'        <div class="dept-name">{escape(dept)}</div>')
                    lines.append(f'        <div class="dept-staff">')

                    # Doctors
                    for doc in docs:
                        pos = doc.get("position", "")
                        lines.append(
                            f'          <span class="badge doc">'
                            f'<span class="name">{escape(doc["name"])}</span>'
                            f'</span>'
                        )

                    # Secretaries
                    for s in med_secs:
                        role = s.get("role_name")
                        skill = s.get("skill_name")
                        rc = role_cls(role)
                        rs = role_short(role)

                        detail_parts = []
                        if rs and rs != "-":
                            detail_parts.append(rs)
                        if skill:
                            detail_parts.append(skill)
                        detail = " | ".join(detail_parts) if detail_parts else ""

                        lines.append(
                            f'          <span class="badge {rc}">'
                            f'<span class="name">{escape(s["name"])}</span>'
                            + (f' <span class="detail">{escape(detail)}</span>' if detail else '')
                            + f'</span>'
                        )

                    lines.append(f'        </div>')
                    lines.append(f'      </div>')

                lines.append(f'    </div>')

            # Admin section
            if admin_secs_period:
                # Deduplicate by name
                seen = set()
                unique_admin = []
                for s in admin_secs_period:
                    if s["name"] not in seen:
                        seen.add(s["name"])
                        unique_admin.append(s)

                lines.append(f'    <div class="admin-block">')
                lines.append(f'      <div class="admin-label">Administration ({len(unique_admin)})</div>')
                lines.append(f'      <div class="admin-list">')
                for s in unique_admin:
                    lines.append(f'        <span class="badge sec-admin"><span class="name">{escape(s["name"])}</span></span>')
                lines.append(f'      </div>')
                lines.append(f'    </div>')

            lines.append(f'  </div>')  # period-content
            lines.append(f'</div>')  # period-row

        if not day_has_content:
            lines.append(f'<div class="empty-day">Aucune activité</div>')

        lines.append(f'</div>')  # day-card

    lines.append("</body></html>")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Weekly assignment view (HTML)")
    parser.add_argument("--week", required=True, help="Monday (YYYY-MM-DD)")
    parser.add_argument("--solve", action="store_true",
                        help="Run solver first (dry-run) then show results")
    args = parser.parse_args()

    week_start = date.fromisoformat(args.week)
    week_end = week_start + timedelta(days=6)

    print(f"Semaine: {week_start} -> {week_end}")

    doctor_rows, secretary_assignments, solver_status, solver_stats = load_data(args, week_start, week_end)

    print(f"  {len(doctor_rows)} assignations medecins")
    print(f"  {len(secretary_assignments)} assignations secretaires")

    html = build_html(week_start, week_end, doctor_rows, secretary_assignments, solver_status, solver_stats)

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"planning-{week_start}.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nFichier genere: {os.path.abspath(out_path)}")
    webbrowser.open(f"file:///{os.path.abspath(out_path).replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
