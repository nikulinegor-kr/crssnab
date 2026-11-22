import { describe, expect, it } from "bun:test";
import { buildRequestReminderText } from "../src/lib/appleReminders";

describe("request reminders", () => {
  it("uses request title and operational details without exposing its public number", () => {
    expect(buildRequestReminderText({
      id: "internal-id",
      request_number: "REQ-00476",
      description: "Закупка кабеля",
      status: "В работе",
      contractor: "Поставщик",
    })).toBe("Закупка кабеля\nСтатус: В работе\nПоставщик: Поставщик");
  });

  it("uses a neutral title when the request has no description", () => {
    const text = buildRequestReminderText({ id: "internal-id", request_number: "REQ-2026-1" });
    expect(text).toBe("Заявка");
    expect(text).not.toContain("REQ-");
  });
});
