import { describe, expect, test } from "bun:test";
import { normalizeStatus, PLANNER_STATUS_LABELS, type PlannerTaskStatus } from "../src/lib/plannerStatuses";
import { ACTIVE_STATUSES } from "../src/lib/plannerEquipmentBusy";

describe("planner status compatibility", () => {
  const expected: Record<PlannerTaskStatus, PlannerTaskStatus> = {
    backlog: "backlog", todo: "backlog", accepted: "backlog", in_progress: "in_progress",
    waiting: "in_progress", review: "review", rework: "in_progress", done: "done",
  };
  for (const [status, column] of Object.entries(expected)) {
    test(`${status} remains in the ${column} board column`, () => {
      expect(normalizeStatus(status as PlannerTaskStatus)).toBe(column);
    });
  }
  test("every supported status has a label", () => {
    expect(Object.keys(PLANNER_STATUS_LABELS).sort()).toEqual(Object.keys(expected).sort());
    for (const status of Object.keys(expected) as PlannerTaskStatus[]) {
      expect(PLANNER_STATUS_LABELS[status].trim().length).toBeGreaterThan(0);
    }
  });
  test("accepted, waiting and rework keep equipment busy; done releases it", () => {
    expect(ACTIVE_STATUSES).toContain("accepted");
    expect(ACTIVE_STATUSES).toContain("waiting");
    expect(ACTIVE_STATUSES).toContain("rework");
    expect(ACTIVE_STATUSES).not.toContain("done");
  });
});