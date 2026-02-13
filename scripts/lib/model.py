"""CP-SAT model for secretary assignment."""

from ortools.sat.python import cp_model
from collections import defaultdict
from datetime import date

# --- Weight constants (priority order) ---
FILL_BONUS = 200          # O1: prefer medical over admin
SKILL_MULT = 5            # O2: skill_score * SKILL_MULT (range 50-200, gap=50 between levels)
SITE_SAME_BONUS = 80      # O3: same-site AM/PM bonus
SITE_CROSS_PENALTY = -60  # O3: cross-site AM/PM penalty
PENIBILITE_DEV_PENALTY = -12  # O4: per-unit combined penibilite deviation (EVITER + hardship)
PREFERE_MULT = 1          # O6: prefere scores as-is from view
ADMIN_TARGET_PENALTY = -20  # O7: per-unit admin deficit
WORKLOAD_DEV_PENALTY = -3   # O8: per-unit workload deviation
ADMIN_FILL_BONUS = 5      # O7b: per admin assignment


def build_model(data, availability_map, admin_blocks, verbose=False):
    """
    Build the CP-SAT model for secretary assignment.

    Data comes from SQL views:
    - data["eligibility"]: pre-filtered eligible (staff, need) pairs with scores
    - data["availability"]: resolved availability per staff/date/period
    - data["secretaries"]: distinct secretaries with settings

    Returns: (model, x_vars, y_vars, meta)
    """
    model = cp_model.CpModel()

    secretaries = data["secretaries"]
    sec_by_id = {s["id_staff"]: s for s in secretaries}

    # Role hardship weights
    role_weight = {r["id_role"]: r.get("hardship_weight", 1) for r in data["roles"]}

    # Existing assignments: set of (staff_id, date, period)
    existing_slots = set()
    for ea in data["existing_assignments"]:
        existing_slots.add((ea["id_staff"], _to_date(ea["date"]), ea["period"]))

    # Department -> site mapping
    dept_site = {d["id_department"]: d["id_site"] for d in data["departments"]}

    # Week dates from availability
    week_dates = sorted({_to_date(a["date"]) for a in data["availability"]})

    # --- Build indexed need list ---
    # Key by (id_block, id_skill, id_role) — a block can need multiple skills
    medical_needs = {}
    for e in data["eligibility"]:
        nkey = (e["id_block"], e["id_skill"], e["id_role"])
        if nkey not in medical_needs:
            medical_needs[nkey] = {
                "id_block": e["id_block"],
                "date": _to_date(e["date"]),
                "period": e["period"],
                "block_type": e["block_type"],
                "id_department": e["id_department"],
                "id_site": e["id_site"],
                "id_skill": e["id_skill"],
                "id_role": e["id_role"],
                "gap": e["gap"],
                "department": e["department"],
                "site": e["site"],
                "skill_name": e["skill_name"],
                "role_name": e["role_name"],
                "_type": "MEDICAL",
            }

    # Also add needs from data["needs"] that have no eligible secretary
    for n in data["needs"]:
        nkey = (n["id_block"], n["id_skill"], n["id_role"])
        if nkey not in medical_needs:
            medical_needs[nkey] = {
                "id_block": n["id_block"],
                "date": _to_date(n["date"]),
                "period": n["period"],
                "block_type": n["block_type"],
                "id_department": n["id_department"],
                "id_site": n.get("id_site") or dept_site.get(n["id_department"]),
                "id_skill": n["id_skill"],
                "id_role": n["id_role"],
                "gap": n["gap"],
                "department": n["department"],
                "site": n["site"],
                "skill_name": n["skill_name"],
                "role_name": n["role_name"],
                "_type": "MEDICAL",
            }

    # All needs indexed: medical first, then admin
    all_needs = []
    need_to_index = {}  # (id_block, id_skill, id_role) -> index
    for nkey, need in medical_needs.items():
        need["_index"] = len(all_needs)
        need_to_index[nkey] = need["_index"]
        all_needs.append(need)

    admin_need_start = len(all_needs)
    for ab in admin_blocks:
        need = {
            "_index": len(all_needs),
            "_type": "ADMIN",
            "id_block": ab["id_block"],
            "date": _to_date(ab["date"]),
            "period": ab["period"],
            "block_type": "ADMIN",
            "id_department": ab["id_department"],
            "id_site": dept_site.get(ab["id_department"]),
            "id_skill": None,
            "id_role": 1,
            "gap": 30,
            "department": "Administration",
            "site": "N/A",
            "skill_name": "Admin",
            "role_name": "Standard",
        }
        need_to_index[(ab["id_block"], None, 1)] = need["_index"]
        all_needs.append(need)

    # --- Create x variables ---

    x = {}  # (staff_id, need_index) -> BoolVar
    y = {}  # (staff_id, date) -> BoolVar (flexible day selection)

    eligible_by_need = defaultdict(list)
    needs_by_staff_slot = defaultdict(list)

    # Decomposed scores per (staff_id, need_index)
    skill_score_map = {}
    prefere_score_map = {}
    # EVITER tracking: (sid, eviter_type, target_id) -> list of x-var keys
    eviter_groups = defaultdict(list)

    # Medical variables: one per eligibility row
    for e in data["eligibility"]:
        sid = e["id_staff"]
        nkey = (e["id_block"], e["id_skill"], e["id_role"])
        ni = need_to_index.get(nkey)
        if ni is None:
            continue
        need_date = _to_date(e["date"])
        need_period = e["period"]

        if (sid, need_date, need_period) in existing_slots:
            continue

        key = (sid, ni)
        if key not in x:
            var = model.new_bool_var(f"x_{sid}_{ni}")
            x[key] = var
            eligible_by_need[ni].append(sid)
            needs_by_staff_slot[(sid, need_date, need_period)].append(ni)

            # Store decomposed scores
            skill_score_map[key] = e["skill_score"]
            prefere_score_map[key] = (
                e["prefere_site_score"]
                + e["prefere_dept_score"]
                + e["prefere_staff_score"]
            )

            # Track EVITER violations for progressive penalty
            if e["eviter_site_score"] < 0:
                eviter_groups[(sid, "SITE", e["id_site"])].append(key)
            if e["eviter_dept_score"] < 0:
                eviter_groups[(sid, "DEPT", e["id_department"])].append(key)
            if e["eviter_staff_score"] < 0:
                eviter_groups[(sid, "STAFF", e["id_block"])].append(key)

    # Admin variables: any available secretary can do admin
    for need in all_needs:
        if need["_type"] != "ADMIN":
            continue
        ni = need["_index"]
        need_date = need["date"]
        need_period = need["period"]

        for sid in availability_map:
            if need_period not in availability_map[sid].get(need_date, set()):
                continue
            if (sid, need_date, need_period) in existing_slots:
                continue

            key = (sid, ni)
            if key not in x:
                var = model.new_bool_var(f"x_{sid}_{ni}")
                x[key] = var
                eligible_by_need[ni].append(sid)
                needs_by_staff_slot[(sid, need_date, need_period)].append(ni)

    # --- Flexible day variables ---
    flexible_secs = [s for s in secretaries if s["is_flexible"]]

    for sec in flexible_secs:
        sid = sec["id_staff"]
        for d in week_dates:
            avail = availability_map.get(sid, {}).get(d, set())
            if sec["full_day_only"]:
                if "AM" in avail and "PM" in avail:
                    y[(sid, d)] = model.new_bool_var(f"y_{sid}_{d}")
            else:
                if "AM" in avail or "PM" in avail:
                    y[(sid, d)] = model.new_bool_var(f"y_{sid}_{d}")

    # === CONSTRAINTS ===

    # C1: Each secretary max 1 assignment per date+period
    for (sid, d, period), need_indices in needs_by_staff_slot.items():
        if len(need_indices) > 1:
            model.add(sum(x[(sid, ni)] for ni in need_indices if (sid, ni) in x) <= 1)

    # C2: Each need filled at most gap times
    for need in all_needs:
        ni = need["_index"]
        eligible = eligible_by_need.get(ni, [])
        if eligible:
            model.add(sum(x[(sid, ni)] for sid in eligible if (sid, ni) in x) <= need["gap"])

    # C3: Flexible full_day_only — linked via y variables
    for sec in flexible_secs:
        sid = sec["id_staff"]
        for d in week_dates:
            if (sid, d) not in y:
                continue
            am_vars = [
                x[(sid, ni)]
                for ni in needs_by_staff_slot.get((sid, d, "AM"), [])
                if (sid, ni) in x
            ]
            pm_vars = [
                x[(sid, ni)]
                for ni in needs_by_staff_slot.get((sid, d, "PM"), [])
                if (sid, ni) in x
            ]
            if sec["full_day_only"]:
                model.add(sum(am_vars) == y[(sid, d)])
                model.add(sum(pm_vars) == y[(sid, d)])
            else:
                model.add(sum(am_vars) + sum(pm_vars) >= y[(sid, d)])
                model.add(sum(am_vars) + sum(pm_vars) <= 2 * y[(sid, d)])

    # C4: Flexible — exact number of working days (HARD constraint)
    for sec in flexible_secs:
        sid = sec["id_staff"]
        available_days = [d for d in week_dates if (sid, d) in y]
        if not available_days:
            continue
        target = round(len(available_days) * float(sec["flexibility_pct"]))
        model.add(sum(y[(sid, d)] for d in available_days) == target)

    # C5: Non-flexible full_day_only — if assigned AM, must also be assigned PM
    non_flex_full_day = [
        s for s in secretaries if not s["is_flexible"] and s["full_day_only"]
    ]
    for sec in non_flex_full_day:
        sid = sec["id_staff"]
        for d in week_dates:
            am_vars = [
                x[(sid, ni)]
                for ni in needs_by_staff_slot.get((sid, d, "AM"), [])
                if (sid, ni) in x
            ]
            pm_vars = [
                x[(sid, ni)]
                for ni in needs_by_staff_slot.get((sid, d, "PM"), [])
                if (sid, ni) in x
            ]
            if am_vars and pm_vars:
                model.add(sum(am_vars) == sum(pm_vars))
            elif am_vars and not pm_vars:
                model.add(sum(am_vars) == 0)
            elif pm_vars and not am_vars:
                model.add(sum(pm_vars) == 0)

    # C6: Mandatory assignment — every available slot must be filled (medical or admin)
    for sec in secretaries:
        sid = sec["id_staff"]
        for d in week_dates:
            for period in ["AM", "PM"]:
                avail = availability_map.get(sid, {}).get(d, set())
                if period not in avail:
                    continue
                if (sid, d, period) in existing_slots:
                    continue

                slot_vars = [
                    x[(sid, ni)]
                    for ni in needs_by_staff_slot.get((sid, d, period), [])
                    if (sid, ni) in x
                ]
                if not slot_vars:
                    continue

                if sec["is_flexible"]:
                    if (sid, d) in y:
                        model.add(sum(slot_vars) == y[(sid, d)])
                else:
                    model.add(sum(slot_vars) == 1)

    # C7: Same person AM/PM for same (department, role) when role in {2, 3}
    needs_by_dept_role_day = defaultdict(lambda: {"AM": [], "PM": []})
    for need in all_needs:
        if need["_type"] != "MEDICAL":
            continue
        if need["id_role"] not in (2, 3):
            continue
        key = (need["date"], need["id_department"], need["id_role"])
        needs_by_dept_role_day[key][need["period"]].append(need["_index"])

    for (d, dept_id, role_id), periods in needs_by_dept_role_day.items():
        am_needs = periods["AM"]
        pm_needs = periods["PM"]
        if not am_needs or not pm_needs:
            continue

        # Find eligible secretaries for AM and PM
        am_eligible = set()
        for ni in am_needs:
            for sid in eligible_by_need.get(ni, []):
                if (sid, ni) in x:
                    am_eligible.add(sid)
        pm_eligible = set()
        for ni in pm_needs:
            for sid in eligible_by_need.get(ni, []):
                if (sid, ni) in x:
                    pm_eligible.add(sid)

        both_eligible = am_eligible & pm_eligible

        # Force same person AM/PM
        for sid in both_eligible:
            am_vars = [x[(sid, ni)] for ni in am_needs if (sid, ni) in x]
            pm_vars = [x[(sid, ni)] for ni in pm_needs if (sid, ni) in x]
            if am_vars and pm_vars:
                model.add(sum(am_vars) == sum(pm_vars))

        # Block secretaries that can only do one period
        for sid in am_eligible - pm_eligible:
            am_vars = [x[(sid, ni)] for ni in am_needs if (sid, ni) in x]
            if am_vars:
                model.add(sum(am_vars) == 0)
        for sid in pm_eligible - am_eligible:
            pm_vars = [x[(sid, ni)] for ni in pm_needs if (sid, ni) in x]
            if pm_vars:
                model.add(sum(pm_vars) == 0)

    # === OBJECTIVE ===

    objective_terms = []

    # O1+O2+O6: Medical fill + skill preference + PREFERE bonus (decomposed)
    for need in all_needs:
        if need["_type"] != "MEDICAL":
            continue
        ni = need["_index"]
        for sid in eligible_by_need.get(ni, []):
            key = (sid, ni)
            if key not in x:
                continue
            skill = skill_score_map.get(key, 10)
            prefere = prefere_score_map.get(key, 0)
            score = FILL_BONUS + skill * SKILL_MULT + prefere * PREFERE_MULT
            objective_terms.append(score * x[key])

    # O3: Site continuity — bonus same site, penalty cross-site
    needs_by_date_site_period = defaultdict(list)
    for need in all_needs:
        if need["_type"] != "MEDICAL":
            continue
        ni = need["_index"]
        needs_by_date_site_period[(need["date"], need["id_site"], need["period"])].append(ni)

    site_ids = [s["id_site"] for s in data["sites"]]

    for sec in secretaries:
        sid = sec["id_staff"]
        for d in week_dates:
            am_by_site = {}
            pm_by_site = {}
            for site_id in site_ids:
                am_nis = needs_by_date_site_period.get((d, site_id, "AM"), [])
                pm_nis = needs_by_date_site_period.get((d, site_id, "PM"), [])
                am_vars = [x[(sid, ni)] for ni in am_nis if (sid, ni) in x]
                pm_vars = [x[(sid, ni)] for ni in pm_nis if (sid, ni) in x]
                if am_vars:
                    am_by_site[site_id] = am_vars
                if pm_vars:
                    pm_by_site[site_id] = pm_vars

            if not am_by_site or not pm_by_site:
                continue

            # Same-site bonus
            for site_id in set(am_by_site) & set(pm_by_site):
                both = model.new_bool_var(f"same_{sid}_{d}_{site_id}")
                model.add(sum(am_by_site[site_id]) >= both)
                model.add(sum(pm_by_site[site_id]) >= both)
                objective_terms.append(SITE_SAME_BONUS * both)

            # Cross-site penalty
            for site_a in am_by_site:
                for site_b in pm_by_site:
                    if site_a == site_b:
                        continue
                    cross = model.new_bool_var(f"cross_{sid}_{d}_{site_a}_{site_b}")
                    # Force cross=1 when both conditions true
                    model.add(
                        cross >= sum(am_by_site[site_a]) + sum(pm_by_site[site_b]) - 1
                    )
                    model.add(cross <= sum(am_by_site[site_a]))
                    model.add(cross <= sum(pm_by_site[site_b]))
                    objective_terms.append(SITE_CROSS_PENALTY * cross)

    # O4: Combined pénibilité — EVITER violations + hardship (role weights)
    # Single score per secretary: penibilite = sum(hardship_weight * medical) + sum(eviter_count * EVITER_WEIGHT)
    # Then minimize deviation from average to spread penibilite evenly.
    EVITER_WEIGHT = 3  # Each EVITER violation adds 3 to penibilite score

    # Collect EVITER vars per secretary
    eviter_vars_by_staff = defaultdict(list)
    for (sid, etype, target_id), keys in eviter_groups.items():
        for k in keys:
            if k in x:
                eviter_vars_by_staff[sid].append(x[k])

    # Build combined penibilite per secretary
    penibilite_loads = {}
    for sec in secretaries:
        sid = sec["id_staff"]
        terms = []

        # Hardship from role weights (Standard=0, Aide fermeture=2, Fermeture=3) — loaded from DB
        for need in all_needs:
            if need["_type"] != "MEDICAL":
                continue
            ni = need["_index"]
            if (sid, ni) not in x:
                continue
            w = role_weight.get(need["id_role"], 0)
            if w > 0:
                terms.append(w * x[(sid, ni)])

        # EVITER violations
        for ev_var in eviter_vars_by_staff.get(sid, []):
            terms.append(EVITER_WEIGHT * ev_var)

        if terms:
            penibilite_loads[sid] = sum(terms)

    if penibilite_loads:
        # Estimate average penibilite
        total_hardship = sum(
            n["gap"] * role_weight.get(n["id_role"], 0)
            for n in all_needs if n["_type"] == "MEDICAL"
        )
        num_active = len(penibilite_loads)
        avg_penibilite = total_hardship // max(num_active, 1)

        for sid, load_expr in penibilite_loads.items():
            deviation = model.new_int_var(0, 50, f"pen_dev_{sid}")
            model.add(deviation >= load_expr - avg_penibilite)
            model.add(deviation >= avg_penibilite - load_expr)
            objective_terms.append(PENIBILITE_DEV_PENALTY * deviation)

    # O7: Admin assignment (low weight — fill remaining slots)
    for need in all_needs:
        if need["_type"] != "ADMIN":
            continue
        ni = need["_index"]
        for sid in eligible_by_need.get(ni, []):
            if (sid, ni) in x:
                objective_terms.append(ADMIN_FILL_BONUS * x[(sid, ni)])

    # O8: Admin target — penalty if not met
    for sec in secretaries:
        sid = sec["id_staff"]
        if sec["admin_target"] <= 0:
            continue
        admin_vars = []
        for need in all_needs:
            if need["_type"] != "ADMIN":
                continue
            ni = need["_index"]
            if (sid, ni) in x:
                admin_vars.append(x[(sid, ni)])
        if admin_vars:
            admin_load = sum(admin_vars)
            admin_deficit = model.new_int_var(0, 10, f"admin_def_{sid}")
            model.add(admin_deficit >= sec["admin_target"] - admin_load)
            objective_terms.append(ADMIN_TARGET_PENALTY * admin_deficit)

    # O9: Workload balance (count-based)
    loads = {}
    for sec in secretaries:
        sid = sec["id_staff"]
        medical_vars = []
        for need in all_needs:
            if need["_type"] != "MEDICAL":
                continue
            ni = need["_index"]
            if (sid, ni) in x:
                medical_vars.append(x[(sid, ni)])
        if medical_vars:
            loads[sid] = sum(medical_vars)

    if loads:
        total_medical_needs = sum(n["gap"] for n in all_needs if n["_type"] == "MEDICAL")
        num_active = len(loads)
        avg_load = total_medical_needs // max(num_active, 1)

        for sid, load_expr in loads.items():
            deviation = model.new_int_var(0, 20, f"wl_dev_{sid}")
            model.add(deviation >= load_expr - avg_load)
            model.add(deviation >= avg_load - load_expr)
            objective_terms.append(WORKLOAD_DEV_PENALTY * deviation)

    # Maximize objective
    model.maximize(sum(objective_terms))

    # Build meta for solution extraction
    meta = {
        "all_needs": all_needs,
        "eligible_by_need": eligible_by_need,
        "admin_need_start": admin_need_start,
        "week_dates": week_dates,
        "role_weight": role_weight,
    }

    if verbose:
        print(f"  Variables: {len(x)} x-vars, {len(y)} y-vars")
        med_count = len([n for n in all_needs if n["_type"] == "MEDICAL"])
        adm_count = len([n for n in all_needs if n["_type"] == "ADMIN"])
        print(f"  Needs: {med_count} medical, {adm_count} admin")
        print(f"  EVITER groups: {len(eviter_groups)}")
        print(f"  Objective terms: {len(objective_terms)}")

    return model, x, y, meta


def solve_model(model, x, y, data, meta, time_limit=30, verbose=False):
    """Solve the CP-SAT model and extract assignments."""
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 4

    if verbose:
        solver.parameters.log_search_progress = True

    status = solver.solve(model)

    status_name = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status, "UNKNOWN")

    result = {
        "status": status_name,
        "objective": solver.objective_value if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
        "wall_time": solver.wall_time,
        "assignments": [],
        "admin_assignments": [],
        "unfilled": [],
        "flexible_days": {},
    }

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return result

    all_needs = meta["all_needs"]

    # Extract assignments
    for (sid, ni), var in x.items():
        if solver.value(var) == 1:
            need = all_needs[ni]
            assignment = {
                "id_block": need["id_block"],
                "id_staff": sid,
                "id_role": need["id_role"],
                "id_skill": need.get("id_skill"),
                "date": need["date"],
                "period": need["period"],
                "block_type": need["block_type"],
                "department": need.get("department", "Admin"),
                "site": need.get("site", "N/A"),
                "skill_name": need.get("skill_name", "Admin"),
                "role_name": need.get("role_name", "Standard"),
                "_type": need["_type"],
            }
            if need["_type"] == "ADMIN":
                result["admin_assignments"].append(assignment)
            else:
                result["assignments"].append(assignment)

    # Extract flexible day selections
    for (sid, d), var in y.items():
        if solver.value(var) == 1:
            if sid not in result["flexible_days"]:
                result["flexible_days"][sid] = []
            result["flexible_days"][sid].append(d)

    # Find unfilled medical needs
    for need in all_needs:
        if need["_type"] != "MEDICAL":
            continue
        ni = need["_index"]
        eligible = meta["eligible_by_need"].get(ni, [])
        filled = sum(
            1 for sid in eligible if (sid, ni) in x and solver.value(x[(sid, ni)]) == 1
        )
        if filled < need["gap"]:
            result["unfilled"].append(
                {
                    "id_block": need["id_block"],
                    "date": need["date"],
                    "period": need["period"],
                    "department": need.get("department"),
                    "site": need.get("site"),
                    "skill_name": need.get("skill_name"),
                    "role_name": need.get("role_name"),
                    "gap": need["gap"],
                    "filled": filled,
                    "remaining": need["gap"] - filled,
                    "eligible_count": len(eligible),
                }
            )

    # Post-processing: link surgery secretaries to doctors
    _link_surgery_secretaries(result, data)

    return result


def _link_surgery_secretaries(result, data):
    """For surgery secretary assignments, set id_linked_doctor to the doctor
    assignment in the same block whose id_activity requires the matching skill."""

    doctor_activities = data.get("doctor_activities", [])
    if not doctor_activities:
        return

    # Build mapping: (id_block, id_skill) -> id_assignment (doctor)
    # If multiple doctors have the same skill in the same block, pick the first
    block_skill_to_doctor = {}
    for da in doctor_activities:
        key = (da["id_block"], da["id_skill"])
        if key not in block_skill_to_doctor:
            block_skill_to_doctor[key] = da["id_assignment"]

    for a in result["assignments"]:
        if a.get("block_type") != "SURGERY":
            continue
        id_skill = a.get("id_skill")
        if id_skill is None:
            continue
        doctor_id = block_skill_to_doctor.get((a["id_block"], id_skill))
        if doctor_id:
            a["id_linked_doctor"] = doctor_id


def _to_date(val) -> date:
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        return date.fromisoformat(val)
    return val.date() if hasattr(val, "date") else val
