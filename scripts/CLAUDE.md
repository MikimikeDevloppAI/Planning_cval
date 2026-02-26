# Scripts

## Shared Client
`supabase-client.mjs` — Shared Supabase client for all `.mjs` scripts. Loads credentials from environment variables (`.env` via `dotenv/config`). Never hardcode credentials.

## Database Utility
`db.mjs` — Direct PostgreSQL client for raw SQL queries (uses `DATABASE_URL` env var).

## Python Solver
`assign_secretaries.py` — CP-SAT constraint solver called by `app/api/solver/route.ts`. Optimizes secretary assignments based on skills, preferences, and staffing tiers.

### Solver Library (`lib/`)
- `db.py` — Database connection for the solver
- `model.py` — CP-SAT model definition
- `report.py` — Solution reporting
