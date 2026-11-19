import { describe, test, expect } from "bun:test";
import { actualPaymentPercent, buildExecutiveSnapshot, buildExecutiveTeam, dateKey, invoiceTotal, type ExecutiveRequest } from "../src/lib/executiveInsights";
import { isOverdueDelivery } from "../src/lib/requestStaleness";
const now = new Date(2026, 10, 19, 15);
const row = (patch: Partial<ExecutiveRequest> = {}): ExecutiveRequest => ({ id: "r", description: "Запчасти", status: "В работе", priority: "Планово", created_at: "2026-11-01", updated_at: "2026-11-18", ...patch });
describe("executive snapshot: business calculations", () => {
 test("all three invoices and partial ACTUAL payment are counted", () => {
  const s = buildExecutiveSnapshot([row({ amount: 100, amount_2: 200, amount_3: 300, payment_percent: 50 })], [], now);
  expect(s.finance).toMatchObject({ total: 600, paid: 300, outstanding: 300, payableRequests: 1 });
 });
 test("payment plan never replaces unknown actual payment", () => {
  const r = { ...row({ amount: 600 }), payment_percentage: 100 };
  expect(actualPaymentPercent(r)).toBeNull();
  expect(buildExecutiveSnapshot([r], [], now).finance).toMatchObject({ outstanding: 0, unknownPayment: 1 });
 });
 test("an explicit actual zero wins over a conflicting paid label", () => {
  expect(actualPaymentPercent(row({ payment_percent: 0, payment_status: "Оплачено" }))).toBe(0);
  expect(actualPaymentPercent(row({ payment_percent: 120 }))).toBeNull();
  expect(actualPaymentPercent(row({ payment_status: "Оплачено" }))).toBe(100);
 });
 test("completed and cancelled requests do not become current risks or money", () => {
  for (const status of ["Выполнено", "Доставлено", "Закрыто", "Отменено", "Отмена"]) {
   const s = buildExecutiveSnapshot([row({ status, amount: 100, payment_percent: 0, planned_delivery_date: "2026-11-01" })], [], now);
   expect(s.open).toHaveLength(0); expect(s.decisions).toHaveLength(0); expect(s.finance.total).toBe(0);
  }
 });
 test("today is not overdue; older fallback delivery_date is", () => {
  expect(isOverdueDelivery(row({ planned_delivery_date: "2026-11-19" }), now)).toBe(false);
  expect(isOverdueDelivery(row({ delivery_date: "2026-11-18" }), now)).toBe(true);
  expect(isOverdueDelivery(row({ delivery_date: "2026-11-18", actual_arrival_date: "2026-11-18" }), now)).toBe(false);
  expect(isOverdueDelivery(row({ planned_delivery_date: "2026-11-20", delivery_date: "2026-11-18" }), now)).toBe(false);
 });
 test("next seven days are inclusive and exclude actual receipts", () => {
  const s = buildExecutiveSnapshot([row({ id: "today", delivery_date: "2026-11-19" }), row({ id: "last", delivery_date: "2026-11-25" }), row({ id: "outside", delivery_date: "2026-11-26" }), row({ id: "received", delivery_date: "2026-11-20", actual_arrival_date: "2026-11-20" })], [], now);
  expect(s.upcoming.map(r => r.id)).toEqual(["today", "last"]);
 });
 test("late request takes one queue row, without duplicate payment/stale entries", () => {
  const s = buildExecutiveSnapshot([row({ amount: 100, payment_percent: 0, updated_at: "2026-11-01", planned_delivery_date: "2026-11-17" })], [], now);
  expect(s.decisions).toHaveLength(1); expect(s.decisions[0]).toMatchObject({ kind: "delivery", days: 2 });
  expect(s.decisions[0].kinds).toContain("payment"); expect(s.decisions[0].balance).toBe(100);
 });
 test("unknown date, employee, cost and payment are visible as data quality", () => {
  const s = buildExecutiveSnapshot([row(), row({ id: "r2", amount: 100 })], [], now);
  expect(s.quality.map(q => q.rows.length)).toEqual([2, 2, 1, 1]);
 });
 test("invalid amounts and dates never leak NaN to the dashboard", () => {
  expect(invoiceTotal(row({ amount: NaN, amount_2: -50, amount_3: 20 }))).toBe(20);
  expect(dateKey("bad-date")).toBeNull();
 });
});
describe("executive team: dates and denominators", () => {
 test("Выполнено counts as completed; missing dates do not improve on-time rate", () => {
  const completed = [row({ status: "Выполнено", executor: "Никитина И.О.", planned_delivery_date: "2026-11-18", actual_arrival_date: "2026-11-18" }), row({ id: "missing", status: "Доставлено", executor: "Никитина И. О.", actual_arrival_date: "2026-11-19" })];
  const team = buildExecutiveTeam([row({ executor: "Никитина И. О." })], completed, []);
  expect(team).toHaveLength(1); expect(team[0]).toMatchObject({ open: 1, completed: 2, assessed: 1, onTime: 1 });
 });
 test("reverse chronology is excluded from assessment", () => {
  const team = buildExecutiveTeam([], [row({ status: "Доставлено", created_at: "2026-11-20", planned_delivery_date: "2026-11-21", actual_arrival_date: "2026-11-19" })], []);
  expect(team[0]).toMatchObject({ completed: 1, assessed: 0, onTime: 0 });
 });
 test("unassigned work remains visible", () => {
  const team = buildExecutiveTeam([row()], [], [{ id: "t", kind: "task", title: "Проверить", objectName: null, priority: null, days: 1 }]);
  expect(team[0]).toMatchObject({ name: "Без исполнителя", open: 1, overdueTasks: 1 });
 });
});
