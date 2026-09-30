# Project Architecture Rules

- Keep request staleness logic in `src/lib/requestStaleness.ts` so counters, filters, and row indicators cannot diverge.
- Keep dashboard operational queues in dedicated widgets fed by the unfiltered request list so period controls do not alter actionable totals.