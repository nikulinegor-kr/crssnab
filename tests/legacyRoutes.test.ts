import { describe, expect, test } from "bun:test";
import { legacyRouteCandidates, resolveLegacyRoute } from "../src/lib/legacyRoutes";

const allowAll = () => true;

describe("legacy route redirects", () => {
  test("routes all six removed screens to working sections", () => {
    expect(resolveLegacyRoute("/dashboard", "", allowAll)).toBe("/requests");
    expect(resolveLegacyRoute("/agent-act-report", "", allowAll)).toBe("/agent-report?tab=act");
    expect(resolveLegacyRoute("/analytics/day-prep", "", allowAll)).toBe("/tasks");
    expect(resolveLegacyRoute("/analytics/ai", "", allowAll)).toBe("/analytics/requests");
    expect(resolveLegacyRoute("/ai-analytics", "", allowAll)).toBe("/analytics/requests");
    expect(resolveLegacyRoute("/board", "", allowAll)).toBe("/requests");
    expect(resolveLegacyRoute("/planner/calendar", "", allowAll)).toBe("/tasks");
  });

  test("keeps a task dialog link from the old planner", () => {
    expect(resolveLegacyRoute("/my-planner/tasks", "?task=abc-123", allowAll)).toBe("/tasks?task=abc-123");
  });

  test("uses the first destination allowed by current permissions", () => {
    const requestsOnly = (path: string) => path === "/requests";
    expect(resolveLegacyRoute("/agent-act-report", "", requestsOnly)).toBe("/requests");
    expect(resolveLegacyRoute("/analytics/ai", "", requestsOnly)).toBe("/requests");
  });

  test("falls back to the personal cabinet when no candidate is allowed", () => {
    expect(resolveLegacyRoute("/dashboard", "", () => false)).toBe("/me");
  });

  test("does not treat unrelated routes as legacy", () => {
    expect(legacyRouteCandidates("/requests")).toEqual([]);
    expect(legacyRouteCandidates("/plannerish")).toEqual([]);
  });
});
