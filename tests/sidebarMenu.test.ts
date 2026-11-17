import { describe, expect, test } from "bun:test";
import { menuGroups, SIDEBAR_STRUCTURE_VERSION } from "../src/config/sidebarMenu";
import { sanitizeSidebarPrefs } from "../src/hooks/useSidebarPrefs";
import { PERMISSION_TREE } from "../src/hooks/useUserPermissions";

const removedIds = ["dashboard", "agent-act-report", "analytics-day-prep", "analytics-ai", "board", "planner"];
const removedUrls = ["/dashboard", "/agent-act-report", "/analytics/day-prep", "/analytics/ai", "/board", "/planner"];

describe("sidebar structure", () => {
  test("uses the approved work order", () => {
    expect(menuGroups.find((group) => group.key === "work")?.items.map((item) => item.title)).toEqual([
      "Заявки", "Задачи", "Поставки", "Склад",
    ]);
  });

  test("contains none of the removed screens", () => {
    const items = menuGroups.flatMap((group) => group.items);
    expect(items.some((item) => removedIds.includes(item.id))).toBe(false);
    expect(items.some((item) => removedUrls.includes(item.url))).toBe(false);
  });

  test("places the action log in System and menu customization only in settings", () => {
    const system = menuGroups.find((group) => group.key === "system");
    expect(system?.items.map((item) => item.title)).toEqual(["Настройки", "Журнал действий"]);
    expect(menuGroups.flatMap((group) => group.items).some((item) => item.url === "/settings/sidebar")).toBe(false);
  });

  test("does not offer removed screens in permission settings", () => {
    const labels = PERMISSION_TREE.flatMap((group) => [group.label, ...group.children.map((item) => item.label)]);
    expect(labels).not.toContain("Дашборд");
    expect(labels).not.toContain("Планировщик");
    expect(labels).not.toContain("Доступ к Планировщику");
  });

  test("removes stale favorites and old custom ordering without hiding current items", () => {
    const prefs = sanitizeSidebarPrefs({
      hidden: ["dashboard", "requests"],
      favorites: ["planner", "agent-act-report", "agent-report"],
      order: { work: ["planner", "warehouse", "requests"] },
    });
    expect(prefs.hidden).toEqual(["requests"]);
    expect(prefs.favorites).toEqual(["agent-report"]);
    expect(prefs.order).toEqual({});
    expect(prefs.structureVersion).toBe(SIDEBAR_STRUCTURE_VERSION);
  });
});
