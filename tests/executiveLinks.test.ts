import { describe, test, expect } from "bun:test";
import { EXEC_LINKS, execRequestLink, execObjectRequestsLink, execObjectTasksLink, requestUrlFilterKey, REQUEST_URL_FILTER_KEYS, isExecEventVisible, isOldNewRequest } from "../src/lib/executivePanel";
import { isOverdueDelivery, isOpenRequest } from "../src/lib/requestStaleness";

describe("executive exact drill-downs", () => {
  const links = { newRequests: "/requests?status=Новая заявка", openRequests: "/requests?open=1", staleRequests: "/requests?filter=stale", overdueDeliveries: "/requests?filter=overdueDelivery", overdueTasks: "/tasks?tab=overdue", activeTasks: "/tasks?tab=all" };
  for (const [key, url] of Object.entries(links)) test(`${key} links to its exact list`, () => expect(EXEC_LINKS[key as keyof typeof EXEC_LINKS]).toBe(url));
  test("requests use working side panel, not legacy route", () => expect(execRequestLink("abc-123")).toBe("/requests?request=abc-123"));
  test("object requests are open only", () => expect(execObjectRequestsLink("obj-1")).toBe("/requests?object=obj-1&open=1"));
  test("object task count opens overdue subset", () => expect(execObjectTasksLink("obj-1")).toBe("/tasks?tab=overdue&object=obj-1"));
  test("panel-only params don't change filter identity", () => expect(requestUrlFilterKey(new URLSearchParams("open=1&request=a&view=full"))).toBe("open=1"));
  test("reset strips only filter params", () => { const p = new URLSearchParams("object=a&open=1&request=b"); REQUEST_URL_FILTER_KEYS.forEach(k => p.delete(k)); expect(p.toString()).toBe("request=b"); });
  test("open excludes all five closed statuses", () => { for (const status of ["Доставлено", "Выполнено", "Закрыто", "Отменено", "Отмена"]) expect(isOpenRequest({ status })).toBe(false); expect(isOpenRequest({ status: "В пути" })).toBe(true); });
  test("delivery uses planned date, empty actual arrival, open status and strictly before today", () => {
    const today = new Date(2026, 9, 30);
    const r = { status: "В пути", planned_delivery_date: "2026-10-29", actual_arrival_date: null };
    expect(isOverdueDelivery(r, today)).toBe(true);
    expect(isOverdueDelivery({ ...r, planned_delivery_date: "2026-10-30" }, today)).toBe(false);
    expect(isOverdueDelivery({ ...r, actual_arrival_date: "2026-10-29" }, today)).toBe(false);
    expect(isOverdueDelivery({ ...r, status: "Отмена" }, today)).toBe(false);
    expect(isOverdueDelivery({ ...r, planned_delivery_date: null }, today)).toBe(false);
  });
  test("old new requests use creation, strict two-day boundary", () => { const today = new Date(2026, 9, 30); expect(isOldNewRequest({ status: "Новая заявка", created_at: "2026-10-27" }, today)).toBe(true); expect(isOldNewRequest({ status: "Новая заявка", created_at: "2026-10-28" }, today)).toBe(false); expect(isOldNewRequest({ status: "В работе", created_at: "2026-10-20" }, today)).toBe(false); });
  test("service reminders and empty descriptions never enter events", () => { expect(isExecEventVisible({ action: "reminder_sent", description: "sent" })).toBe(false); expect(isExecEventVisible({ action: "delivery_reminder_sent", description: "sent" })).toBe(false); expect(isExecEventVisible({ action: "field_changed", description: " " })).toBe(false); expect(isExecEventVisible({ action: "created", description: "Создана" })).toBe(true); });
});
