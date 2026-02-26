# Staff Components

## Staff Detail Page (`app/staff/[id]/page.tsx`)
Main page showing a staff member's profile. Two layouts:
- **Doctors**: Planning content only (calendar, schedules, leaves)
- **Secretaries**: Tab switcher between "Planning" and "Configuration" (skills, preferences, settings)

Shared `StaffPlanningContent` component handles both cases with an `animate` prop.

## Sub-components
| Component | Purpose |
|-----------|---------|
| `staff-card.tsx` | Header card with name, position, edit/toggle active |
| `staff-calendar.tsx` | Monthly calendar showing assignments and leaves |
| `staff-schedule-viewer.tsx` | Recurring schedule management (add/edit/delete) |
| `staff-leave-manager.tsx` | Leave/absence management |
| `staff-skills-manager.tsx` | Skill assignment with preference levels (1-3) |
| `staff-prefs-manager.tsx` | Work preferences (site/dept/role constraints) |
| `staff-settings.tsx` | Secretary-specific settings (flexibility, admin target) |
| `staff-table.tsx` | Staff list table on `/staff` page |

## Schedule Viewer
Complex component with add/edit forms for recurring schedules. Handles:
- Schedule type (FIXED/RECURRING)
- Day of week, period (AM/PM/DAY)
- Department selection
- Recurrence patterns (weekly, biweekly, etc.)
- Date range constraints
