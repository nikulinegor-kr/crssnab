import { describe, expect, test } from "bun:test";
import { applyTabFilter, getAvailableTransitions, type TaskTab, type TransitionTask } from "../src/lib/taskHub";
import { PLANNER_STATUS_LABELS, type PlannerTaskStatus } from "../src/lib/plannerStatuses";

const me = "00000000-0000-0000-0000-000000000001";
describe("task hub role/status/acceptance matrix", () => {
  const statuses = Object.keys(PLANNER_STATUS_LABELS) as PlannerTaskStatus[];
  for (const role of ["assignee", "co-assignee", "reviewer", "creator", "admin", "stranger"] as const) {
    for (const status of statuses) for (const acceptance of [false, true]) {
      test(`${role} / ${status} / acceptance=${acceptance}`, () => {
        const task: TransitionTask = { status, requires_acceptance: acceptance, assignee_id: role === "assignee" ? me : "other", co_assignee_ids: role === "co-assignee" ? [me] : [], reviewer_id: role === "reviewer" ? me : "reviewer", created_by: role === "creator" ? me : "creator" };
        const executor = ["assignee", "co-assignee", "creator", "admin"].includes(role);
        const controller = ["reviewer", "creator", "admin"].includes(role);
        let expected: string[] = [];
        if (executor) {
          const map: Record<PlannerTaskStatus, string[]> = {
            backlog: ["accepted", "waiting"], todo: ["accepted", "waiting"],
            accepted: ["in_progress", "waiting"], in_progress: [acceptance ? "review" : "done", "waiting"],
            waiting: ["in_progress"], review: [], rework: [acceptance ? "review" : "done", "waiting"], done: [],
          };
          expected = map[status];
        }
        if (status === "review" && controller) expected = ["done", "rework"];
        const actions = getAvailableTransitions(task, me, role === "admin");
        expect(actions.map(action => action.status)).toEqual(expected);
        for (const action of actions) {
          expect(action.label.trim().length).toBeGreaterThan(0);
          expect(action.dialog).toBe(action.status === "waiting" ? "waiting" : action.status === "rework" ? "rework" : undefined);
        }
      });
    }
  }
});

describe("task hub server tab filters", () => {
  const today = "2026-10-30T00:00:00.000Z";
  const expected: Record<TaskTab, unknown[][]> = {
    all: [["neq", "status", "done"]],
    mine: [["neq", "status", "done"], ["or", `assignee_id.eq.${me},co_assignee_ids.cs.{${me}}`]],
    created: [["neq", "status", "done"], ["eq", "created_by", me], ["or", `assignee_id.is.null,assignee_id.neq.${me}`]],
    control: [["neq", "status", "done"], ["eq", "reviewer_id", me], ["eq", "status", "review"]],
    overdue: [["neq", "status", "done"], ["lt", "due_date", today]],
    done: [["eq", "status", "done"], ["order", "completed_at", { ascending: false, nullsFirst: false }]],
    recurring: [["neq", "status", "done"], ["not", "recurrence", "is", null]],
  };
  for (const tab of Object.keys(expected) as TaskTab[]) {
    test(tab, () => {
      const calls: unknown[][] = [];
      const query: Record<string, (...args: unknown[]) => unknown> = {};
      for (const name of ["is", "eq", "neq", "or", "lt", "not", "order"]) query[name] = (...args) => { calls.push([name, ...args]); return query; };
      expect(applyTabFilter(query, tab, me, today)).toBe(query);
      expect(calls).toEqual([["is", "archived_at", null], ["eq", "hidden_auto", false], ...expected[tab]]);
    });
  }
});