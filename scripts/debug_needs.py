"""Debug: show all staffing needs for a week."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
from lib.db import get_connection

conn = get_connection()
cur = conn.cursor()

# All needs (including gap=0)
cur.execute("""
    SELECT date, period, department, skill_name, role_name,
           needed::int, assigned::int, gap::int, site, block_type, id_block
    FROM v_staffing_needs
    WHERE date BETWEEN '2026-02-09' AND '2026-02-15'
    ORDER BY date, period, department, role_name
""")
rows = cur.fetchall()

print(f"=== TOUS les besoins semaine 2026-02-09 ({len(rows)} lignes) ===\n")
print(f"{'Date':<12} {'P':>2} {'Département':<22} {'Skill':<25} {'Rôle':<15} {'Need':>4} {'Asgn':>4} {'Gap':>4} {'Type':<8} {'Site'}")
print("-" * 120)

last_date = ""
for r in rows:
    d = str(r["date"])
    if d != last_date:
        if last_date:
            print()
        last_date = d
    print(f"{d:<12} {r['period']:>2} {r['department']:<22} {(r['skill_name'] or '-'):<25} {(r['role_name'] or '-'):<15} {r['needed']:>4} {r['assigned']:>4} {r['gap']:>4} {r['block_type']:<8} {r['site']}")

# Summary
print(f"\n=== Résumé ===")
total_needed = sum(r["needed"] for r in rows)
total_assigned = sum(r["assigned"] for r in rows)
total_gap = sum(r["gap"] for r in rows)
gap_rows = [r for r in rows if r["gap"] > 0]
print(f"Total besoins: {total_needed}")
print(f"Total déjà assignés: {total_assigned}")
print(f"Total gap: {total_gap} ({len(gap_rows)} lignes avec gap>0)")

# Doctor assignments for context
cur.execute("""
    SELECT wb.date, wb.period, d.name as dept, count(*) as nb_docs
    FROM assignments a
    JOIN work_blocks wb ON a.id_block = wb.id_block
    JOIN departments d ON wb.id_department = d.id_department
    WHERE a.assignment_type = 'DOCTOR'
      AND a.status NOT IN ('CANCELLED', 'INVALIDATED')
      AND wb.date BETWEEN '2026-02-09' AND '2026-02-15'
    GROUP BY wb.date, wb.period, d.name
    ORDER BY wb.date, wb.period, d.name
""")
doc_rows = cur.fetchall()
print(f"\n=== Médecins par créneau ===")
for r in doc_rows:
    print(f"  {r['date']} {r['period']} {r['dept']:<22} {r['nb_docs']} médecin(s)")

conn.close()
