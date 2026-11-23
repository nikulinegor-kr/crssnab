import { describe, expect, it } from "bun:test";
import { buildRequestZrsLines } from "../src/lib/requestZrs";

describe("request ZRS text", () => {
  it("includes delivery days but omits order duration while preserving the request fields", () => {
    const values = {
      request_date: "2026-11-22",
      description: "Закупка кабеля",
      applicant: "Иван Петров",
      priority: "Планово",
      availability_delivery_time: "Под заказ",
      estimated_delivery_days: 14,
      order_days: 30,
      payment_percentage: 50,
      executor: "Анна Смирнова",
    };

    expect(buildRequestZrsLines(values, "Склад №1")).toEqual([
      "Дата заявки: 22.11.2026",
      "Объект: Склад №1",
      "Заявка: Закупка кабеля",
      "Заявитель: Иван Петров",
      "Приоритет: Планово",
      "Наличие: Под заказ",
      "Срок доставки: 14 дн.",
      "Оплата: 50%",
      "Исполнил: Анна Смирнова",
    ]);
  });
});
