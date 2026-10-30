import { differenceInCalendarDays, startOfDay } from "date-fns";

export type ExecAttentionItem = {
  id: string;
  kind: "task" | "request";
  title: string;
  reference?: string;
  objectName: string | null;
  assigneeName?: string | null;
  priority: string | null;
  days: number;
};
export type ExecObjectLoad = { id: string; name: string; requests: number; amount: number; overdueTasks: number };
export type ExecEvent = { id: string; kind: "task" | "request"; entityId: string; description: string; reference: string; actor: string; createdAt: string };

export const overdueDays = (date: string, today: Date) => Math.max(0, differenceInCalendarDays(startOfDay(today), startOfDay(new Date(date))));
export const sortAttention = (items: ExecAttentionItem[]) => [...items].sort((a, b) =>
  Number(["critical", "urgent"].includes(b.priority ?? "")) - Number(["critical", "urgent"].includes(a.priority ?? "")) || b.days - a.days
).slice(0, 10);
export const sortObjects = (items: ExecObjectLoad[]) => items.filter(i => i.requests > 0 || i.overdueTasks > 0)
  .sort((a, b) => b.overdueTasks - a.overdueTasks || b.amount - a.amount).slice(0, 6);
export const sortEvents = (items: ExecEvent[]) => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 10);
export const formatExecAmount = (value: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ")} ₽`;