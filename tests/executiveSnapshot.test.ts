import { describe, it, expect } from "vitest";
import { buildSnapshot, deliveryOutcome, invoiceTotal, matchesQueue, paymentLeft, requestQueue, type ExecRequestRow } from "../src/lib/executiveSnapshot";
const today = new Date("2026-11-19T12:00:00");
const base: ExecRequestRow = { id: "1", request_number: "REQ-1", description: "x", comments: null, status: "В работе", priority: null, executor: "A", object_id: null, amount: null, amount_2: null, amount_3: null, payment_percent: null, payment_percentage: null, planned_delivery_date: null, actual_arrival_date: null, delivery_date: null, transport_company: null, created_at: null, updated_at: null };
describe("executive snapshot", () => {
  it("sums all three invoices", () => expect(invoiceTotal({ amount: 100, amount_2: 50, amount_3: 25 })).toBe(175));
  it("unknown fact is not zero debt", () => expect(paymentLeft({ ...base, amount: 100 })).toBeNull());
  it("plan prepayment does not replace fact", () => expect(paymentLeft({ ...base, amount: 100, payment_percentage: 100, payment_percent: 0 })).toBe(100));
  it("missing dates are not on time", () => expect(deliveryOutcome({ planned_delivery_date: null, actual_arrival_date: "2026-11-01" })).toBe("noDates"));
  it("overdue unpaid shows in payment and delivery", () => {
    const [item] = requestQueue([{ ...base, amount: 100, payment_percent: 50, planned_delivery_date: "2026-11-10" }], today);
    expect(matchesQueue(item, "payment") && matchesQueue(item, "delivery") && matchesQueue(item, "overdue")).toBe(true);
  });
  it("counts awaiting payment from fact only", () => expect(buildSnapshot([{ ...base, amount: 100 }, { ...base, amount: 200, payment_percent: 50 }], today).awaitingPayment).toBe(1));
});
