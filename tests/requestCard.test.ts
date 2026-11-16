import { describe, expect, it } from "bun:test";
import { getRequestObjectLabel, getRequestRouteStage, isRequestDeliveryConfirmed, isRequestRouteStepDone, REQUEST_ROUTE_LABELS } from "../src/lib/requestCard";

describe("request card route", () => {
  it("has four labeled stages and advances after invoice and shipment", () => {
    expect(REQUEST_ROUTE_LABELS).toEqual(["Новая заявка", "Счёт", "В пути", "Доставлено"]);
    expect(getRequestRouteStage({})).toBe(0);
    expect(getRequestRouteStage({ invoice_number: "123" })).toBe(1);
    expect(getRequestRouteStage({ status: "Счёт" })).toBe(1);
    expect(getRequestRouteStage({ status: "В пути" })).toBe(2);
    expect(getRequestRouteStage({ invoice_number: "123", shipment_date: "2026-11-16" })).toBe(2);
  });

  it("marks completed prior steps without marking a future delivery", () => {
    const inTransit = { invoice_number: "123", shipment_date: "2026-11-16" };
    expect(isRequestRouteStepDone(inTransit, 0)).toBe(true);
    expect(isRequestRouteStepDone(inTransit, 1)).toBe(true);
    expect(isRequestRouteStepDone(inTransit, 2)).toBe(false);
    expect(isRequestRouteStepDone(inTransit, 3)).toBe(false);
  });

  it("shows Delivered only for the active confirmed status", () => {
    const base = { invoice_number: "123", shipment_date: "2026-11-16" };
    expect(isRequestDeliveryConfirmed({ ...base, actual_arrival_date: "2026-11-17" })).toBe(false);
    expect(isRequestDeliveryConfirmed({ ...base, status: "Доставлено" })).toBe(false);
    expect(isRequestDeliveryConfirmed({ ...base, status: "В пути", actual_arrival_date: "2026-11-17" })).toBe(false);
    expect(isRequestDeliveryConfirmed({ ...base, status: "Доставлено", actual_arrival_date: "2026-11-17" })).toBe(true);
    expect(getRequestRouteStage({ ...base, status: "Доставлено", actual_arrival_date: "2026-11-17" })).toBe(3);
    expect(isRequestRouteStepDone({ ...base, status: "Доставлено", actual_arrival_date: "2026-11-17" }, 3)).toBe(true);
  });

  it("never exposes an object UUID as its display name", () => {
    expect(getRequestObjectLabel("object-id", "Склад с очень длинным названием")).toBe("Склад с очень длинным названием");
    expect(getRequestObjectLabel("object-id", null)).toBe("Объект недоступен");
    expect(getRequestObjectLabel(null, null)).toBe("Объект не указан");
  });
});
