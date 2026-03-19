/**
 * Classifies a material statement item as "work" or "material"
 * based on keywords in the item name.
 */

const WORK_KEYWORDS = [
  "монтаж", "устройство", "установка", "сборка", "укладка", "демонтаж",
  "прокладка", "подключение", "наладка", "испытание", "пуск",
  "разборка", "ремонт", "замена", "окраска", "грунтовка",
  "штукатурка", "бетонирование", "армирование", "сварка",
  "изоляция", "утепление", "облицовка", "отделка",
];

export type ItemType = "work" | "material";

export function classifyItemType(name: string): ItemType {
  if (!name) return "material";
  const lower = name.toLowerCase();
  for (const keyword of WORK_KEYWORDS) {
    if (lower.includes(keyword)) return "work";
  }
  return "material";
}
