# Project Architecture Rules

- Keep request staleness logic in `src/lib/requestStaleness.ts` so counters, filters, and row indicators cannot diverge.
- Keep dashboard operational queues in dedicated widgets fed by the unfiltered request list so period controls do not alter actionable totals.
- Keep executive-panel queries organization-scoped and independent in `useExecutivePanel`, with exact head-only counts and paginated aggregate rows; reuse the planner task dialog for drill-down to avoid inconsistent editing behavior.
- Keep the shared closed-request status list in `requestStaleness.ts`; executive aggregates use it without changing existing staleness predicates.
- Keep planner status normalization and labels in a pure shared module, re-exported by usePlannerTasks, so compatibility mappings can be tested without browser dependencies.
- Enforce planner transitions and activity reasons in database triggers; preserve notification logic and use the existing user-first organization access function signatures.
- Keep /tasks server-filtered and paginated over planner_tasks with pure taskHub tab/action logic; reuse PlannerTaskDialog and enforce collaborator visibility through RLS rather than client-side filtering.
- Keep executive drill-down links in executivePanel.ts and delivery/open predicates in requestStaleness.ts; URL drill-down filters are temporary and restore saved user filters to keep counts and lists identical.

- Keep home-screen installability manifest-only; the existing notification worker remains messaging-only without app-shell caching so previews and fresh releases are not trapped in offline caches.
