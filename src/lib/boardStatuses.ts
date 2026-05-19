// Канбан-колонки поверх существующих статусов requests.
// Один request — одна карточка. При перетаскивании в колонку выставляется targetStatus.

export type BoardColumn = {
  id: string;
  title: string;
  /** Канонический статус, который выставляется при дропе в эту колонку. */
  targetStatus: string;
  /** Все статусы из БД, которые попадают в эту колонку (с учётом регистра/пробелов). */
  statuses: string[];
  /** tailwind класс для акцентной полоски/бейджа колонки */
  accent: string;
};

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "new",
    title: "Новая",
    targetStatus: "Новая заявка",
    statuses: ["Новая заявка", "Новая"],
    accent: "bg-sky-500",
  },
  {
    id: "in_progress",
    title: "В работе",
    targetStatus: "В работе",
    statuses: ["В работе"],
    accent: "bg-blue-500",
  },
  {
    id: "quotation",
    title: "Запрос КП",
    targetStatus: "Запрос КП",
    statuses: ["Запрос КП"],
    accent: "bg-cyan-500",
  },
  {
    id: "waiting",
    title: "Ожидание ответа",
    targetStatus: "Ожидание ответа",
    statuses: ["Ожидание ответа", "Ожидание КП"],
    accent: "bg-amber-500",
  },
  {
    id: "approval",
    title: "Согласование",
    targetStatus: "На согласовании",
    statuses: ["На согласовании", "Согласование"],
    accent: "bg-yellow-500",
  },
  {
    id: "paid",
    title: "Оплачено",
    targetStatus: "Оплачено",
    statuses: ["Оплачено", "Счёт", "Счёт в Бухгалтерии", "Обновить счёт", "Обновить счёт ", "Счёт "],
    accent: "bg-orange-500",
  },
  {
    id: "shipping",
    title: "Доставка",
    targetStatus: "В пути",
    statuses: ["Доставка", "Готов к отгрузке", "Готов к отгрузке ", "В пути", "Доставлено в ТК"],
    accent: "bg-indigo-500",
  },
  {
    id: "completed",
    title: "Завершено",
    targetStatus: "Доставлено",
    statuses: ["Завершено", "Доставлено", "Выполнено"],
    accent: "bg-emerald-500",
  },
];

const norm = (s: string) => s.trim().toLowerCase();

export function getColumnIdForStatus(status: string | null | undefined): string {
  if (!status) return "new";
  const s = norm(status);
  for (const col of BOARD_COLUMNS) {
    if (col.statuses.some((cs) => norm(cs) === s)) return col.id;
  }
  return "new";
}

export function getColumnById(id: string): BoardColumn | undefined {
  return BOARD_COLUMNS.find((c) => c.id === id);
}
