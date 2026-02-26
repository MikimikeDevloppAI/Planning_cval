# Hooks

## TanStack Query Conventions

### Query Keys
| Key Pattern | Used By |
|-------------|---------|
| `["staff"]` | Staff list |
| `["staff", id]` | Staff detail |
| `["planning", "month", month]` | Month planning data |
| `["planning", "week", weekStart]` | Week planning data |
| `["leaves", startDate, endDate]` | Leaves for a date range |
| `["config", "sites"]` | Sites config |
| `["config", "roles"]` | Roles config |
| `["config", "skills"]` | Skills config |
| `["config", "tiers"]` | Staffing tiers config |

### Cache Invalidation
- Staff mutations invalidate `["staff"]` and `["staff", id]`
- Leave mutations also invalidate `["planning"]` and `["leaves"]`
- Assignment mutations invalidate `["planning"]`

### Optimistic Updates
`use-assignments.ts` implements optimistic updates for move/cancel/swap:
1. `onMutate`: snapshot all planning queries, apply optimistic change
2. `onError`: rollback from snapshot
3. `onSettled`: invalidate to refetch from server

### Adding a New Hook
1. Create the query function in `src/lib/supabase/queries/`
2. Import it in the hook file
3. Use `useQuery` for reads, `useMutation` for writes
4. Always invalidate related query keys in `onSuccess`
