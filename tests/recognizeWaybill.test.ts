import { describe, expect, test } from "bun:test";
import { normalizeRecognizedWaybill } from "../src/lib/recognizeWaybill";

describe("normalizeRecognizedWaybill", () => {
  test("maps load/arrival dates to shipment/delivery", () => {
    expect(normalizeRecognizedWaybill({ transport_company: " ПЭК ", waybill_number: "123", load_date: "2026-11-20", planned_arrival_date: "2026-11-25" }))
      .toEqual({ transport_company: "ПЭК", waybill_number: "123", shipment_date: "2026-11-20", delivery_date: "2026-11-25" });
  });
  test("drops dates outside 2000-2100", () => {
    expect(normalizeRecognizedWaybill({ load_date: "1999-01-01", planned_arrival_date: "20.11.2026" }).shipment_date).toBe("");
    expect(normalizeRecognizedWaybill({ planned_arrival_date: "20.11.2026" }).delivery_date).toBe("");
  });
});
