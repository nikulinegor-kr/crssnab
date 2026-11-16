import { describe, expect, it } from "bun:test";
import { getRequestObjectLabel, getRequestRouteStage, isRequestRouteStepDone } from "../src/lib/requestCard";

describe("request card route", () => {
  it("starts at a new request and advances after invoice and shipment", () => {
    expect(getRequestRouteStage({})).toBe(0);
    expect(getRequestRouteStage({ invoice_number: "123" })).toBe(1);
    expect(getRequestRouteStage({ status: "Счёт" })).toBe(1);
    expect(getRequestRouteStage({ status: "В пути" })).toBe(2);
    expect(getRequestRouteStage({ invoice_number: "123", shipment_date: "2026-11-16" })).toBe(2);
  });

  it("marks all steps green only after actual completion", () => {
    const inTransit = { invoice_number: "123", shipment_date: "2026-11-16" };
    expect(isRequestRouteStepDone(inTransit, 0)).toBe(true);
    expect(isRequestRouteStepDone(inTransit, 1)).toBe(true);
    expect(isRequestRouteStepDone(inTransit, 2)).toBe(false);
    expect(isRequestRouteStepDone({ ...inTransit, actual_arrival_date: "2026-11-17" }, 2)).toBe(true);
    expect(isRequestRouteStepDone({ ...inTransit, status: "Доставлено" }, 2)).toBe(true);
  });

  it("never exposes an object UUID as its display name", () => {
    expect(getRequestObjectLabel("object-id", "Склад с очень длинным названием")).toBe("Склад с очень длинным названием");
    expect(getRequestObjectLabel("object-id", null)).toBe("Объект недоступен");
    expect(getRequestObjectLabel(null, null)).toBe("Объект не указан");
  });
});
