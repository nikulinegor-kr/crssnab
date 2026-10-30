/** Only app-local destinations; old notifications remain usable. */
export function normalizeNotificationLink(link: string | null | undefined): string {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return "/me";
  const request = link.match(/^\/requests\/([0-9a-f-]{36})(?:[?#].*)?$/i);
  if (request) return `/requests?request=${request[1]}`;
  const task = link.match(/^\/tasks\/([0-9a-f-]{36})$/i);
  if (task) return `/tasks?task=${task[1]}`;
  return link.replace(/^\/planner\?task=/, "/tasks?task=");
}
