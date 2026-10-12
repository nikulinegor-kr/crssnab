import type { PlannerTask } from "@/hooks/usePlannerTasks";

/** Name of the Apple Shortcut users install once; it adds a reminder to the shared list. */
export const APPLE_SHORTCUT_NAME = "CRM Напоминание";

/**
 * Builds the text passed to the Shortcut. Line 1 — title, line 2 — due (YYYY-MM-DD HH:MM or empty),
 * remaining lines — notes with a link back to the CRM.
 */
export function buildReminderText(task: PlannerTask): string {
  return [task.title, task.description?.trim()].filter(Boolean).join("\n");
}

function runShortcut(text: string) {
  window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(APPLE_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(text)}`;
}

export function sendToAppleReminders(task: PlannerTask) {
  runShortcut(buildReminderText(task));
}

interface ReminderRequest {
  id: string;
  request_number?: string | null;
  description?: string | null;
  delivery_date?: string | null;
  status?: string | null;
  contractor?: string | null;
}

/** Request reminder: title plus status/supplier, no date and no link. */
export function sendRequestToAppleReminders(r: ReminderRequest) {
  const title = r.description?.trim() || r.request_number || "Заявка";
  const notes = [
    r.request_number && `№ ${r.request_number}`,
    r.status && `Статус: ${r.status}`,
    r.contractor && `Поставщик: ${r.contractor}`,
  ].filter(Boolean).join("\n");
  runShortcut([title, notes].filter(Boolean).join("\n"));
}
