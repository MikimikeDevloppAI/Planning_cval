# Planning Components

## Views
- **`departments-table-view.tsx`** — Table view grouped by department. Each row is a department, columns are days. Cells show assigned staff as draggable chips.
- **`collaborateurs-table-view.tsx`** — Table view grouped by person. Each row is a staff member, columns are days. Shows where each person is assigned.

Both views share constants and helpers from:
- `@/lib/constants` — ROLE_TAG, SITE_ABBREV, PERIOD_LABELS, PERIOD_ORDER
- `@/lib/types/planning-views` — LeaveEntry interface
- `@/lib/utils/planning-helpers` — weekSepStyle(), abbreviateSite(), abbreviateDept()

## Drag & Drop
Uses `@dnd-kit/core`. Chips are draggable (secretary assignments), cells are droppable. Drop triggers `useMoveAssignment` with optimistic cache update.

## Chips
Secretary chips show initials + optional role tag (1f/2f for fermeture roles). Color depends on role (green=Standard, pink=Fermeture, orange=Aide). Doctor chips are blue. Border style indicates status (dashed=PROPOSED, solid=CONFIRMED, thick=PUBLISHED).

## Context Menu
`staff-context-menu.tsx` — Right-click on a chip opens a context menu with actions: move, swap, cancel, change status.

## Dialogs
- `move-assignment-dialog.tsx` — Pick target department/date/period
- `swap-assignment-dialog.tsx` — Swap two assignments
- `quick-absence-dialog.tsx` — Quick absence entry from planning
