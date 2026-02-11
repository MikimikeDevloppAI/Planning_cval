"""Debug: compare v_staffing_needs count vs model needs count."""
import sys, os
from datetime import date
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
from lib.db import get_connection, load_week_data

conn = get_connection()
data = load_week_data(conn, date(2026, 2, 9))

# What data["needs"] contains (gap>0 from v_staffing_needs)
print(f"=== data['needs'] ({len(data['needs'])} lignes) ===")
total_gap_needs = sum(n["gap"] for n in data["needs"])
print(f"Total gap dans needs: {total_gap_needs}")

# How many unique (id_block, id_role) in needs?
block_role_keys = set()
block_keys = set()
for n in data["needs"]:
    block_role_keys.add((n["id_block"], n["id_role"]))
    block_keys.add(n["id_block"])
print(f"Unique id_block: {len(block_keys)}")
print(f"Unique (id_block, id_role): {len(block_role_keys)}")

# Check: needs where gap > 1
print(f"\n=== Besoins avec gap > 1 ===")
for n in data["needs"]:
    if n["gap"] > 1:
        print(f"  block={n['id_block']} {n['date']} {n['period']} {n['department']:<22} {(n['skill_name'] or '-'):<25} {(n['role_name'] or '-'):<15} gap={n['gap']}")

# How many unique (id_block, id_role) in eligibility?
print(f"\n=== data['eligibility'] ({len(data['eligibility'])} lignes) ===")
elig_block_role_keys = set()
for e in data["eligibility"]:
    elig_block_role_keys.add((e["id_block"], e["id_role"]))
print(f"Unique (id_block, id_role) in eligibility: {len(elig_block_role_keys)}")

# Missing: in needs but not in eligibility
missing = block_role_keys - elig_block_role_keys
print(f"\nIn needs but NOT in eligibility: {len(missing)}")
for nkey in sorted(missing):
    n = next(n for n in data["needs"] if n["id_block"] == nkey[0] and n["id_role"] == nkey[1])
    print(f"  block={n['id_block']} {n['date']} {n['period']} {n['department']:<22} {(n['skill_name'] or '-'):<25} {(n['role_name'] or '-'):<15} gap={n['gap']}")

# Summary: total gap covered by eligibility
covered_gap = sum(n["gap"] for n in data["needs"] if (n["id_block"], n["id_role"]) in elig_block_role_keys)
uncovered_gap = sum(n["gap"] for n in data["needs"] if (n["id_block"], n["id_role"]) not in elig_block_role_keys)
print(f"\nGap couvert par éligibilité: {covered_gap}")
print(f"Gap NON couvert (aucun éligible): {uncovered_gap}")

conn.close()
