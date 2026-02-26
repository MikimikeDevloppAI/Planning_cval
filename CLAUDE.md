# CVAL V2 — Medical Staff Planning System

## Overview
CVAL V2 is a hospital staff planning system managing assignments of doctors (médecins), secretaries (secrétaires), and midwives (obstétriciennes) across multiple sites and departments. The UI is entirely in **French**.

## Tech Stack
- **Next.js 16** (Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** via `@tailwindcss/postcss`
- **Supabase** (PostgreSQL) — `@supabase/ssr` for browser client, `@supabase/supabase-js` for admin/server
- **TanStack Query v5** for server state, **Zustand v5** for client state
- **dnd-kit** for drag & drop, **date-fns** with `fr` locale
- **Vitest** + **Testing Library** for tests

## Commands
```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build (TypeScript check)
npm run lint         # ESLint
npm run format       # Prettier format
npm run test         # Vitest (64 tests)
npm run test:cov     # Vitest with coverage
```

## Project Structure
```
app/                    # Next.js pages and API routes
  planning/             # Planning views (week/month, departments/collaborateurs)
  staff/                # Staff list + [id] detail page
  config/               # Admin config pages (sites, roles, skills, tiers, calendar)
  api/solver/           # Python CP-SAT solver endpoint
src/
  components/
    layout/             # Sidebar, header
    planning/           # Planning table views, chips, context menus
    staff/              # Staff detail components (card, calendar, schedule viewer...)
    dialogs/            # Move, swap, quick-absence dialogs
    ui/                 # Shared UI (CustomSelect, ConfirmDialog, popover...)
  hooks/                # TanStack Query hooks (use-staff, use-assignments, use-planning-data)
  store/                # Zustand store (filters, sidebar state)
  lib/
    constants.ts        # All domain constants and label maps
    types/              # TypeScript interfaces (database.ts, planning-views.ts)
    utils/              # Pure utility functions (dates, colors, initials, planning-helpers)
    supabase/
      client.ts         # Browser Supabase client
      server.ts         # Admin/server Supabase client
      helpers.ts        # throwIfError helper
      queries/          # DB queries split by domain (config, staff, assignments, planning)
scripts/                # Python solver + DB utility scripts
supabase/               # Edge functions (excluded from tsconfig)
```

## Domain Model

### Positions (staff.id_primary_position)
| ID | Name |
|----|------|
| 1 | Médecin |
| 2 | Secrétaire |
| 3 | Obstétricienne |

### Secretary Roles (assignments.id_role)
| ID | Name | Tag |
|----|------|-----|
| 1 | Standard | (none) |
| 2 | Fermeture | 1f |
| 3 | Aide fermeture | 2f |

### Assignment Status Flow
`PROPOSED` → `CONFIRMED` → `PUBLISHED` (can be `CANCELLED` or `INVALIDATED` at any point)

### Planning Data Hierarchy
Site → Department → Day → Period (AM/PM) → Block → Assignment

Virtual sites/departments exist for **Administration** (id_site=-2, id_dept=-2000) and **Bloc Opératoire** (id_site=-1, id_dept=-1000).

### Key Tables
- `staff` — All staff members
- `work_blocks` — Time slots per department/day/period
- `assignments` — Staff assigned to blocks
- `staff_schedules` — Recurring schedule templates
- `staff_leaves` — Absences/leaves
- `activity_staffing_tiers` — How many secretaries per doctor count
- `v_staffing_needs` — View: staffing gaps per block

## Conventions

### Queries
- All queries use `throwIfError()` to unwrap Supabase results
- Queries are split into 4 modules (`config`, `staff`, `assignments`, `planning`) with barrel re-export via `queries/index.ts`
- Import path: `@/lib/supabase/queries` (never import individual files)

### Hooks
- TanStack Query hooks in `src/hooks/`
- Cache keys: `["staff"]`, `["staff", id]`, `["planning", ...]`, `["config", "sites"]`, etc.
- Mutations invalidate related query keys on success
- Assignment mutations use optimistic updates with snapshot rollback

### Components
- French labels everywhere
- Planning views: `departments-table-view` (by department) and `collaborateurs-table-view` (by person)
- Shared constants in `src/lib/constants.ts` (ROLE_TAG, SITE_ABBREV, PERIOD_LABELS, etc.)
- Shared types in `src/lib/types/planning-views.ts`

## Gotchas
- `next.config.ts` must use `turbopack: {}` (not webpack) for Next.js 16
- `supabase/` directory is excluded from tsconfig (Deno edge functions)
- API routes use Next.js 16 pattern: `{ params }: { params: Promise<{ id: string }> }`
- Supabase joins return arrays, so strongly typing joined data requires `as unknown as T` casts
- Scripts in `scripts/` use ESM (`.mjs`) and import from `./supabase-client.mjs` for credentials
- Never commit `.env` — use `.env.example` as template
