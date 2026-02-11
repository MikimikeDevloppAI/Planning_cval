"""Debug: for each medical need with gap>1, check if both slots are filled."""
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

model, x, y, meta = build_model(data, availability, admin_blocks, verbose=False)
result = solve_model(model, x, y, data, meta, time_limit=30)

all_needs = meta["all_needs"]
eligible_by_need = meta["eligible_by_need"]
solver = None  # can't access solver here, use result

# Count filled per need
filled_per_need = defaultdict(int)
for a in result["assignments"]:
    # Find the matching need
    for need in all_needs:
        if need["_type"] != "MEDICAL":
            continue
        if need["id_block"] == a["id_block"] and need["id_role"] == a["id_role"]:
            filled_per_need[need["_index"]] += 1
            break

print("=== Besoins gap>1 : combien remplis ? ===")
print(f"{'Date':<12} {'P':>2} {'Département':<22} {'Skill':<25} {'Rôle':<15} {'Gap':>3} {'Rempli':>6} {'Elig':>4}")
print("-" * 100)
for need in all_needs:
    if need["_type"] != "MEDICAL":
        continue
    if need["gap"] <= 1:
        continue
    ni = need["_index"]
    filled = filled_per_need.get(ni, 0)
    elig = len(eligible_by_need.get(ni, []))
    print(f"{need['date']!s:<12} {need['period']:>2} {need.get('department','?'):<22} {need.get('skill_name','?'):<25} {(need.get('role_name') or '-'):<15} {need['gap']:>3} {filled:>6} {elig:>4}")

# Summary
total_gap = sum(n["gap"] for n in all_needs if n["_type"] == "MEDICAL")
total_filled = sum(filled_per_need.values())
gap1_needs = [n for n in all_needs if n["_type"] == "MEDICAL" and n["gap"] == 1]
gap1_filled = sum(1 for n in gap1_needs if filled_per_need.get(n["_index"], 0) >= 1)
gap2_needs = [n for n in all_needs if n["_type"] == "MEDICAL" and n["gap"] >= 2]
gap2_filled = sum(filled_per_need.get(n["_index"], 0) for n in gap2_needs)
gap2_total = sum(n["gap"] for n in gap2_needs)

print(f"\n=== Résumé ===")
print(f"Gap=1 besoins: {len(gap1_needs)}, remplis: {gap1_filled}")
print(f"Gap>=2 besoins: {len(gap2_needs)}, remplis: {gap2_filled}/{gap2_total}")
print(f"Total: {total_filled}/{total_gap}")

conn.close()
