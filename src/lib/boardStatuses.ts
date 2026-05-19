// Канбан-колонки поверх существующих статусов requests.
// Один request — одна карточка. При перетаскивании в колонку выставляется targetStatus.

export type BoardColumn = {
  id: string;
  title: string;
  /** Канонический статус, который выставляется при дропе в эту колонку. */
  targetStatus: string;
  /** Все статусы из БД, которые попадают в эту колонку. */
  statuses: string[];
  /** tailwind класс для акцентной полоски/бейджа колонки */
  accent: string;
};

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "new",
    title: "Новая",
    targetStatus: "Новая заявка",
    statuses: ["Новая заявка"],
    accent: "bg-sky-500",
  },
  {
    id: "in_work",
    title: "В работе",
    targetStatus: "В работе",
    statuses: ["В работе"],
    accent: "bg-blue-500",
  },
  {
    id: "approval",
    title: "Согласование",
    targetStatus: "На согласовании",
    statuses: ["На согласовании"],
    accent: "bg-amber-500",
  },
  {
    id: "invoice",
    title: "Счёт / Оплата",
    targetStatus: "Счёт",
    statuses: ["Счёт", "Счёт в Бухгалтерии", "Обновить счёт", "Обновить счёт "],
    accent: "bg-orange-500",
  },
  {
    id: "ready",
    title: "К отгрузке",
    targetStatus: "Готов к отгрузке",
    statuses: ["Готов к отгрузке", "Готов к отгрузке "],
    accent: "bg-violet-500",
  },
  {
    id: "transit",
    title: "В пути",
    targetStatus: "В пути",
    statuses: ["В пути", "Доставлено в ТК"],
    accent: "bg-indigo-500",
  },
  {
    id: "done",
    title: "Доставлено",
    targetStatus: "Доставлено",
    statuses: ["Доставлено", "Выполнено"],
    accent: "bg-emerald-500",
  },
];

export function getColumnIdForStatus(status: string | null | undefined): string {
  if (!status) return "new";
  const s = status.trim();
  for (const col of BOARD_COLUMNS) {
    if (col.statuses.some((cs) => cs.trim() === s)) return col.id;
  }
  return "new";
}

export function getColumnById(id: string): BoardColumn | undefined {
  return BOARD_COLUMNS.find((c) => c.id === id);
}
