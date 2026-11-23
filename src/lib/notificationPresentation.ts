type NotificationContent = {
  type: string;
  title: string;
  message: string;
};

export function formatNotificationContent({ type, title, message }: NotificationContent) {
  const unchanged = { title, message, overdue: false };
  if (type !== "task_deadline" && type !== "planner_task") return unchanged;

  const overdue = title === "⚠️ Задача просрочена" || title === "⚠️ Срок задачи истёк";
  const upcoming = title === "⏰ Приближается срок задачи" || title === "⏰ Срок задачи скоро";
  if (!overdue && !upcoming) return unchanged;

  const deadline = /^«([\s\S]+)»\s*·\s*срок (\d{2}\.\d{2}\.\d{4})$/.exec(message);
  if (!deadline) return unchanged;

  return { title: deadline[1], message: `${overdue ? "Срок истёк" : "Срок"} ${deadline[2]}`, overdue };
}
