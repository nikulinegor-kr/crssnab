import { expect, test } from "bun:test";
import { agentReportPeriod, matchesAgentReportPeriod } from "../src/lib/agentReportRequests";

test("agent report uses shipment date before delivery date", () => {
  expect(matchesAgentReportPeriod({ shipment_date: "2026-11-30", delivery_date: "2026-12-01" }, 2026, 11)).toBe(true);
  expect(matchesAgentReportPeriod({ shipment_date: "2026-11-30", delivery_date: "2026-12-01" }, 2026, 12)).toBe(false);
});

test("agent report falls back to delivery date and excludes the next month boundary", () => {
  expect(matchesAgentReportPeriod({ shipment_date: null, delivery_date: "2026-11-30" }, 2026, 11)).toBe(true);
  expect(matchesAgentReportPeriod({ shipment_date: null, delivery_date: "2026-12-01" }, 2026, 11)).toBe(false);
});

test("agent report server period covers December without including the next year", () => {
  expect(agentReportPeriod(2026, 12)).toEqual({
    start: "2026-12-01",
    end: "2027-01-01",
    filter: "and(shipment_date.gte.2026-12-01,shipment_date.lt.2027-01-01),and(shipment_date.is.null,delivery_date.gte.2026-12-01,delivery_date.lt.2027-01-01)",
  });
});
