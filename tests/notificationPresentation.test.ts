import { describe, expect, test } from "bun:test";
import { formatNotificationContent } from "../src/lib/notificationPresentation";

describe("deadline notification content", () => {
  test("puts the task title first for an existing overdue reminder", () => {
    expect(formatNotificationContent({
      type: "planner_task",
      title: "⚠️ Задача просрочена",
      message: "«Аварийная заявка: Козырёк КДМ №827» · срок 14.09.2026",
    })).toEqual({
      title: "Аварийная заявка: Козырёк КДМ №827",
      message: "Срок истёк 14.09.2026",
      overdue: true,
    });
  });

  test("keeps the due date distinct from the delivery time for a current reminder", () => {
    expect(formatNotificationContent({
      type: "task_deadline",
      title: "⏰ Срок задачи скоро",
      message: "«Заменить «крышку» на складе» · срок 23.11.2026",
    })).toEqual({
      title: "Заменить «крышку» на складе",
      message: "Срок 23.11.2026",
      overdue: false,
    });
  });

  test("preserves other planner notices with similarly structured text", () => {
    const note = {
      type: "planner_task",
      title: "Новый комментарий к задаче",
      message: "«Заменить крышку» · срок 23.11.2026",
    };
    expect(formatNotificationContent(note)).toEqual({
      title: note.title,
      message: note.message,
      overdue: false,
    });
  });
});
