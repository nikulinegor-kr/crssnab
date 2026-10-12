import type { PlannerTask } from "@/hooks/usePlannerTasks";

/** Name of the Apple Shortcut users install once; it adds a reminder to the shared list. */
export const APPLE_SHORTCUT_NAME = "CRM Напоминание";

/**
 * Builds the text passed to the Shortcut. Line 1 — title, line 2 — due (YYYY-MM-DD HH:MM or empty),
 * remaining lines — notes with a link back to the CRM.
 */
export function buildReminderText(task: PlannerTask): string {
  const due = task.due_date ? `${task.due_date.slice(0, 10)}${task.due_time ? " " + task.due_time.slice(0, 5) : " 09:00"}` : "";
  const link = task.request_id
    ? `${window.location.origin}/requests/${task.request_id}`
    : `${window.location.origin}/planner`;
  const notes = [task.description?.trim(), link].filter(Boolean).join("\n");
  return [task.title, due, notes].join("\n");
}

export function sendToAppleReminders(task: PlannerTask) {
  const text = buildReminderText(task);
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(APPLE_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(text)}`;
  window.location.href = url;
}
