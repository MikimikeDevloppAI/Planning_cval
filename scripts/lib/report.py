"""Console report for secretary assignment results."""

from collections import defaultdict


def print_report(data, result, availability):
    """Print a summary report of the assignment results."""
    secretaries = {s["id_staff"]: s for s in data["secretaries"]}
    role_weight = {r["id_role"]: r.get("hardship_weight", 1) for r in data["roles"]}

    print(f"\n{'='*60}")
    print(f"  Assignation Secrétaires")
    print(f"{'='*60}")
    print(f"Solver: {result['status']} en {result['wall_time']:.1f}s")
    if result["objective"] is not None:
        print(f"Objectif: {result['objective']:.0f}")

    # Summary counts
    total_medical_needs = sum(n["gap"] for n in data["needs"])
    filled = len(result["assignments"])
    unfilled_count = sum(u["remaining"] for u in result["unfilled"])
    admin_count = len(result["admin_assignments"])

    print(f"\nBesoins médicaux: {total_medical_needs} total | {filled} remplis | {unfilled_count} non remplis")
    print(f"Assignations admin: {admin_count}")
    print(f"Total assignations: {filled + admin_count}")

    # Per-secretary breakdown
    print(f"\n--- Par secrétaire ---")
    print(f"{'Nom':<25} {'Méd':>4} {'Admin':>5} {'Cible':>5} {'Total':>5} {'Pénib':>5}  Status")
    print("-" * 80)

    EVITER_WEIGHT = 3  # Must match model.py

    # Count assignments per secretary
    medical_by_staff = defaultdict(int)
    admin_by_staff = defaultdict(int)
    hardship_by_staff = defaultdict(int)  # role hardship only
    eviter_violations = []

    for a in result["assignments"]:
        medical_by_staff[a["id_staff"]] += 1
        hardship_by_staff[a["id_staff"]] += int(role_weight.get(a["id_role"], 0))

    for a in result["admin_assignments"]:
        admin_by_staff[a["id_staff"]] += 1

    # Site continuity stats
    site_same = 0
    site_cross = 0
    site_admin_half = 0
    staff_day_sites = defaultdict(lambda: defaultdict(set))  # sid -> date -> set(site)
    staff_day_admin = defaultdict(lambda: defaultdict(bool))  # sid -> date -> has_admin

    for a in result["assignments"]:
        sid = a["id_staff"]
        d = a["date"]
        site = a.get("site", "?")
        staff_day_sites[sid][d].add(site)

    for a in result["admin_assignments"]:
        staff_day_admin[a["id_staff"]][a["date"]] = True

    for sid, days in staff_day_sites.items():
        for d, sites in days.items():
            if len(sites) == 1:
                site_same += 1
            else:
                site_cross += 1
        # Days with medical + admin (one period medical, other admin)
        for d in staff_day_admin.get(sid, {}):
            if d in days:
                site_admin_half += 1

    # Check EVITER violations
    site_names = {s["id_site"]: s["name"] for s in data["sites"]}

    pref_map = defaultdict(list)
    for p in data["preferences"]:
        if p["preference"] == "EVITER":
            pref_map[p["id_staff"]].append(p)

    need_lookup = {}
    for n in data["needs"]:
        need_lookup[n["id_block"]] = n

    eviter_by_staff = defaultdict(int)

    for a in result["assignments"]:
        sid = a["id_staff"]
        block_need = need_lookup.get(a["id_block"], {})
        assignment_site_id = block_need.get("id_site")
        assignment_dept_id = block_need.get("id_department")

        for p in pref_map.get(sid, []):
            violated = False
            target_name = ""
            if p["target_type"] == "SITE" and p["id_site"] and p["id_site"] == assignment_site_id:
                violated = True
                target_name = site_names.get(p["id_site"], "?")
            elif p["target_type"] == "DEPARTMENT" and p["id_department"] and p["id_department"] == assignment_dept_id:
                violated = True
                dept_row = next((d for d in data["departments"] if d["id_department"] == p["id_department"]), None)
                target_name = dept_row["name"] if dept_row else "?"

            if violated:
                sec = secretaries[sid]
                eviter_by_staff[sid] += 1
                eviter_violations.append({
                    "name": f"{sec['lastname']} {sec['firstname']}",
                    "target": target_name,
                    "date": a["date"],
                    "period": a["period"],
                })

    for sec in sorted(data["secretaries"], key=lambda s: s["lastname"]):
        sid = sec["id_staff"]
        med = medical_by_staff.get(sid, 0)
        adm = admin_by_staff.get(sid, 0)
        target = sec["admin_target"]
        total = med + adm
        hardship = hardship_by_staff.get(sid, 0)
        eviter_count = eviter_by_staff.get(sid, 0)
        penibilite = hardship + eviter_count * EVITER_WEIGHT

        status_parts = []
        if sec["is_flexible"]:
            flex_days = result["flexible_days"].get(sid, [])
            unique_avail = set()
            for d, periods in availability.get(sid, {}).items():
                if periods:
                    unique_avail.add(d)
            status_parts.append(f"Flex: {len(flex_days)}/{len(unique_avail)}j")

        if target > 0:
            if adm >= target:
                status_parts.append(f"Admin OK")
            else:
                status_parts.append(f"Admin {adm}/{target} !")

        if eviter_by_staff.get(sid, 0) > 0:
            status_parts.append(f"EVITER x{eviter_by_staff[sid]}")

        target_str = str(target) if target > 0 else "-"
        status_str = ", ".join(status_parts) if status_parts else ""

        print(f"{sec['lastname'] + ' ' + sec['firstname']:<25} {med:>4} {adm:>5} {target_str:>5} {total:>5} {penibilite:>5d}  {status_str}")

    # Site continuity summary
    print(f"\n--- Continuité site ---")
    print(f"  Même site AM/PM: {site_same} jours")
    print(f"  Changement site: {site_cross} jours")
    print(f"  Médical + admin: {site_admin_half} jours")

    # Unfilled needs
    if result["unfilled"]:
        print(f"\n--- Besoins non remplis ({len(result['unfilled'])}) ---")
        for u in sorted(result["unfilled"], key=lambda u: (str(u["date"]), u["period"])):
            print(
                f"  Block {u['id_block']:>5}  {u['date']} {u['period']}  "
                f"{u['department']:<20} {u['skill_name']:<15} {u['role_name'] or '-':<10} "
                f"reste={u['remaining']}  ({u['eligible_count']} éligibles)"
            )

    # EVITER violations
    if eviter_violations:
        print(f"\n--- Violations EVITER ({len(eviter_violations)}) ---")
        for v in sorted(eviter_violations, key=lambda v: (str(v["date"]), v["period"])):
            print(f"  {v['name']} -> {v['target']} ({v['date']} {v['period']})")

    # Secretaries with no skills (inactive)
    no_skills = [
        s for s in data["secretaries"]
        if not any(sk["id_staff"] == s["id_staff"] for sk in data["skills"])
    ]
    if no_skills:
        print(f"\n--- Secrétaires sans skills ({len(no_skills)}) ---")
        for s in no_skills:
            print(f"  {s['lastname']} {s['firstname']} (id={s['id_staff']})")

    print()
