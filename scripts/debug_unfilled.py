"""Debug: compare needs vs solver assignments, find why 40 needs are unfilled."""
import sys, os
from datetime import date
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from lib.db import get_connection, load_week_data, create_admin_blocks, load_admin_blocks
from lib.model import build_model, solve_model

conn = get_connection()
week_start = date(2026, 2, 9)
data = load_week_data(conn, week_start)
create_admin_blocks(conn, week_start, data["admin_dept_id"])
admin_blocks = load_admin_blocks(conn, week_start)

availability = defaultdict(lambda: defaultdict(set))
for row in data["availability"]:
    d = row["date"] if isinstance(row["date"], date) else date.fromisoformat(str(row["date"]))
    availability[row["id_staff"]][d].add(row["period"])
availability = dict(availability)

model, x, y, meta = build_model(data, availability, admin_blocks, verbose=True)
result = solve_model(model, x, y, data, meta, time_limit=30)

print(f"\n=== Résultats ===")
print(f"Status: {result['status']}")
print(f"Medical remplis: {len(result['assignments'])}")
print(f"Admin: {len(result['admin_assignments'])}")
print(f"Non remplis: {len(result['unfilled'])}")

# Show ALL unfilled
print(f"\n=== Besoins NON remplis ({len(result['unfilled'])}) ===")
for u in sorted(result["unfilled"], key=lambda u: (str(u["date"]), u["period"], u["department"])):
    print(f"  {u['date']} {u['period']} {u['department']:<22} {u['skill_name']:<25} {(u['role_name'] or '-'):<15} gap={u['gap']} rempli={u['filled']} reste={u['remaining']} eligibles={u['eligible_count']}")

# Compare: how many eligible per need?
all_needs = meta["all_needs"]
eligible_by_need = meta["eligible_by_need"]

print(f"\n=== Besoins avec 0 éligibles ===")
zero_eligible = 0
for need in all_needs:
    if need["_type"] != "MEDICAL":
        continue
    ni = need["_index"]
    eligible = eligible_by_need.get(ni, [])
    if len(eligible) == 0:
        zero_eligible += 1
        print(f"  {need['date']} {need['period']} {need.get('department','?'):<22} {need.get('skill_name','?'):<25} {(need.get('role_name') or '-'):<15} gap={need['gap']}")

print(f"\nTotal besoins sans éligible: {zero_eligible}")

# Besoins avec peu d'éligibles
print(f"\n=== Besoins avec 1-2 éligibles ===")
for need in all_needs:
    if need["_type"] != "MEDICAL":
        continue
    ni = need["_index"]
    eligible = eligible_by_need.get(ni, [])
    if 1 <= len(eligible) <= 2:
        print(f"  {need['date']} {need['period']} {need.get('department','?'):<22} {need.get('skill_name','?'):<25} {(need.get('role_name') or '-'):<15} gap={need['gap']} eligibles={len(eligible)}")

# Count medical vs admin assignments per person
med_count = defaultdict(int)
adm_count = defaultdict(int)
for a in result["assignments"]:
    med_count[a["id_staff"]] += 1
for a in result["admin_assignments"]:
    adm_count[a["id_staff"]] += 1

print(f"\n=== Assignations par secrétaire ===")
staff_names = {s["id_staff"]: f"{s['lastname']} {s['firstname']}" for s in data["secretaries"]}
for sid in sorted(staff_names.keys(), key=lambda s: staff_names[s]):
    m = med_count.get(sid, 0)
    a = adm_count.get(sid, 0)
    total_avail = sum(len(periods) for periods in availability.get(sid, {}).values())
    print(f"  {staff_names[sid]:<25} med={m:>2} admin={a:>2} total={m+a:>2} dispo={total_avail:>2}")

conn.close()
