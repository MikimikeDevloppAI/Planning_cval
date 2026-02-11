"""
Secretary Assignment Algorithm using Google OR-Tools CP-SAT.

Usage:
    python scripts/assign_secretaries.py --week 2026-01-06
    python scripts/assign_secretaries.py --week 2026-01-06 --dry-run
    python scripts/assign_secretaries.py --week 2026-01-06 --clear-proposed
    python scripts/assign_secretaries.py --week 2026-01-06 --verbose
"""

import sys
import os
import argparse
from datetime import date, timedelta
from collections import defaultdict

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from lib.db import (
    get_connection,
    load_week_data,
    create_admin_blocks,
    load_admin_blocks,
    clear_proposed,
    write_assignments,
)
from lib.model import build_model, solve_model
from lib.report import print_report


def build_availability_map(data):
    """Build availability map from v_secretary_availability rows.

    Returns: {staff_id: {date: set('AM','PM')}}
    """
    availability = defaultdict(lambda: defaultdict(set))
    for row in data["availability"]:
        sid = row["id_staff"]
        d = row["date"]
        if isinstance(d, str):
            d = date.fromisoformat(d)
        availability[sid][d].add(row["period"])
    return dict(availability)


def parse_args():
    parser = argparse.ArgumentParser(description="Secretary assignment algorithm")
    parser.add_argument(
        "--week",
        required=True,
        help="Monday of the week to process (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and report without inserting into database",
    )
    parser.add_argument(
        "--clear-proposed",
        action="store_true",
        help="Delete existing PROPOSED ALGORITHM assignments before running",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed model and solver info",
    )
    parser.add_argument(
        "--time-limit",
        type=int,
        default=30,
        help="Solver time limit in seconds (default: 30)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Parse week start (must be a Monday)
    week_start = date.fromisoformat(args.week)
    if week_start.weekday() != 0:
        print(f"Error: {args.week} is not a Monday (weekday={week_start.weekday()})")
        print("Please provide a Monday date (e.g., 2026-01-06)")
        sys.exit(1)

    week_end = week_start + timedelta(days=6)
    print(f"Semaine: {week_start} -> {week_end}")

    # Connect
    conn = get_connection()
    try:
        # Optional: clear existing proposed assignments
        if args.clear_proposed:
            deleted = clear_proposed(conn, week_start)
            print(f"Nettoyage: {deleted} assignations PROPOSED supprimées")

        # Load all data
        print("Chargement des données...")
        data = load_week_data(conn, week_start)
        print(
            f"  {len(data['secretaries'])} secrétaires, "
            f"{len(data['needs'])} besoins (gap>0), "
            f"{len(data['eligibility'])} éligibilités, "
            f"{len(data['availability'])} disponibilités"
        )

        # Check admin department exists
        if data["admin_dept_id"] is None:
            print("ERREUR: Département 'Administration' non trouvé!")
            print("Exécutez: node run-sql.js prepare-admin-blocks.sql")
            sys.exit(1)

        # Create admin blocks for the week
        created = create_admin_blocks(conn, week_start, data["admin_dept_id"])
        if created:
            print(f"  {len(created)} blocs ADMIN créés")

        # Load admin blocks
        admin_blocks = load_admin_blocks(conn, week_start)
        print(f"  {len(admin_blocks)} blocs ADMIN pour la semaine")

        # Build availability map from view data
        print("Construction de la carte de disponibilité...")
        availability = build_availability_map(data)

        # Count available slots
        total_slots = 0
        for sid, days in availability.items():
            for d, periods in days.items():
                total_slots += len(periods)
        print(f"  {total_slots} demi-journées disponibles au total")

        # Build CP-SAT model
        print("Construction du modèle CP-SAT...")
        model, x, y, meta = build_model(
            data, availability, admin_blocks, verbose=args.verbose
        )

        # Solve
        print(f"Résolution (time limit: {args.time_limit}s)...")
        result = solve_model(
            model, x, y, data, meta,
            time_limit=args.time_limit,
            verbose=args.verbose,
        )

        # Print report
        print_report(data, result, availability)

        # Write to database (unless dry-run)
        if result["status"] in ("OPTIMAL", "FEASIBLE"):
            all_assignments = result["assignments"] + result["admin_assignments"]

            if args.dry_run:
                print(f"[DRY RUN] {len(all_assignments)} assignations NON insérées")
            else:
                inserted = write_assignments(conn, all_assignments)
                print(f"{inserted} assignations insérées en base (source=ALGORITHM, status=PROPOSED)")
        else:
            print(f"Pas de solution trouvée (status={result['status']})")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
