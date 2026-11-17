import { expect, test } from "bun:test";
import { applyMobileHideDelivered, formatArrival, groupMobileRequests, mobileArrivalDate } from "../src/lib/mobileRequestList";

test("arrival prefers actual, then planned, then delivery date", () => {
  expect(mobileArrivalDate({ id: "1", actual_arrival_date: "2026-11-03", planned_delivery_date: "2026-11-02", delivery_date: "2026-11-01" })).toBe("2026-11-03");
  expect(mobileArrivalDate({ id: "1", planned_delivery_date: "2026-11-02", delivery_date: "2026-11-01" })).toBe("2026-11-02");
  expect(mobileArrivalDate({ id: "1", delivery_date: "2026-11-01" })).toBe("2026-11-01");
  expect(formatArrival(null)).toBe("—");
  expect(formatArrival("2026-11-03")).toBe("03.11");
});

test("hide delivered removes all delivered unless status chosen", () => {
  const rows = [{ status: "Доставлено" }, { status: "В пути" }];
  expect(applyMobileHideDelivered(rows, true, []).length).toBe(1);
  expect(applyMobileHideDelivered(rows, true, ["Доставлено"]).length).toBe(2);
});

test("groups by four stages, newest first", () => {
  const groups = groupMobileRequests([
    { id: "a", status: "Новая заявка", request_date: "2026-01-01" },
    { id: "b", status: "Новая заявка", request_date: "2026-02-01" },
    { id: "c", status: "В пути" },
  ]);
  expect(groups.map((g) => g.label)).toEqual(["Новая заявка", "В пути"]);
  expect(groups[0].items.map((r) => r.id)).toEqual(["b", "a"]);
});
