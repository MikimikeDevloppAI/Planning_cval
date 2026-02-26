# Supabase Layer

## Structure
```
client.ts          # Browser client (createBrowserClient from @supabase/ssr)
server.ts          # Admin client (createClient from @supabase/supabase-js, uses service role key)
helpers.ts         # throwIfError<T>() + SupabaseClient type re-export
queries/
  index.ts         # Barrel re-export — all consumers import from here
  config.ts        # Sites, Departments, Skills, Roles, Calendar, Tiers CRUD
  staff.ts         # Staff list/detail, settings, skills, preferences, leaves, schedules
  assignments.ts   # moveAssignment, cancelAssignment, swapAssignments, updateStatus
  planning.ts      # Pure transforms + fetchers for week/month planning data
```

## Pattern: throwIfError
Every query wraps the Supabase response with `throwIfError()` which extracts `.data` and throws if `.error` exists. This avoids repetitive null checks.

## Adding a New Query
1. Add the function in the appropriate domain file (`config.ts`, `staff.ts`, etc.)
2. Use typed parameters (avoid `Record<string, unknown>`)
3. Wrap with `throwIfError(await supabase.from(...).select(...))`
4. The barrel `index.ts` re-exports everything automatically via `export *`

## Planning Transforms (pure functions)
- `buildAbsentKeys()` — Set of `staffId:date:period` keys for leave filtering
- `buildSiteMap()` — Groups raw blocks by site → department
- `buildNeedsIndex()` — Indexes staffing needs by block ID
- `computeStats()` — Aggregates needs/assignments into dashboard stats
- `extractVirtualSites()` — Moves Administration and Bloc Opératoire into virtual sites

These are tested in `planning.test.ts`.
