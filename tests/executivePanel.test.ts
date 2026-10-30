import { describe, expect, test } from "bun:test";
import { CLOSED_REQUEST_STATUSES, isStale } from "../src/lib/requestStaleness";
import { formatExecAmount, overdueDays, sortAttention, sortEvents, sortObjects, type ExecAttentionItem } from "../src/lib/executivePanel";

describe("executive panel rules", () => {
  test("closed statuses match the required five values", () => {
    expect(CLOSED_REQUEST_STATUSES).toEqual(["Выполнено", "Доставлено", "Закрыто", "Отменено", "Отмена"]);
    expect(CLOSED_REQUEST_STATUSES.includes("В работе")).toBe(false);
  });
  test("only days before today are overdue", () => {
    const today = new Date(2026, 9, 30);
    expect(overdueDays(new Date(2026, 9, 29, 23).toISOString(), today)).toBe(1);
    expect(overdueDays(new Date(2026, 9, 30).toISOString(), today)).toBe(0);
    expect(overdueDays(new Date(2026, 9, 31).toISOString(), today)).toBe(0);
  });
  test("stale requests use the existing more-than-two-day rule", () => {
    const today = new Date(2026, 9, 30);
    expect(isStale({ status: "В работе", created_at: new Date(2026, 9, 27).toISOString() }, today)).toBe(true);
    expect(isStale({ status: "В работе", created_at: new Date(2026, 9, 28).toISOString() }, today)).toBe(false);
  });
  test("critical and urgent precede other attention rows and the list is limited to ten", () => {
    const row = (id: string, priority: string, days: number): ExecAttentionItem => ({ id, priority, days, kind: "task", title: id, objectName: null });
    const items = [row("urgent", "urgent", 2), row("critical", "critical", 4), ...Array.from({ length: 12 }, (_, i) => row(`normal-${i}`, "medium", i + 10))];
    const result = sortAttention(items);
    expect(result).toHaveLength(10);
    expect(result.slice(0, 3).map(i => i.id)).toEqual(["critical", "urgent", "normal-11"]);
  });
  test("object ranking excludes empty objects and uses overdue count then amount with top six", () => {
    const result = sortObjects([{ id: "empty", name: "", requests: 0, overdueTasks: 0, amount: 9999 }, ...Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: String(i), requests: 1, overdueTasks: i === 0 ? 2 : 1, amount: i * 100 }))]);
    expect(result).toHaveLength(6);
    expect(result.map(i => i.id)).toEqual(["0", "7", "6", "5", "4", "3"]);
  });
  test("merged events retain the ten newest from both sources", () => {
    const result = sortEvents(Array.from({ length: 20 }, (_, i) => ({ id: String(i), entityId: String(i), kind: i % 2 ? "task" as const : "request" as const, description: "", reference: "", actor: "", createdAt: new Date(2026, 9, 30, i).toISOString() })));
    expect(result.map(i => i.id)).toEqual(["19", "18", "17", "16", "15", "14", "13", "12", "11", "10"]);
  });
  test("amount is grouped with spaces and ruble suffix", () => {
    expect(formatExecAmount(1234567)).toBe("1 234 567 ₽");
  });
});