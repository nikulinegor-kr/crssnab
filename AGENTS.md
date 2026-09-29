# Project Architecture Rules

- Keep request staleness logic in `src/lib/requestStaleness.ts` so counters, filters, and row indicators cannot diverge.