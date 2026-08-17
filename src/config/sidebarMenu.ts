import {
  LayoutGrid,
  FileText,
  Users,
  Settings,
  FileBarChart,
  Percent,
  Building2,
  BarChart3,
  Warehouse,
  Wallet,
  Truck,
  Layers,
  FolderOpen,
  FileSpreadsheet,
  Files,
  KanbanSquare,
  Sparkles,
  ClipboardList,
  CalendarRange,
  Wrench,
  Filter,
  ShieldCheck,
} from "lucide-react";

export type MenuItem = {
  id: string; // stable id used in prefs
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export type MenuGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

export const menuGroups: MenuGroup[] = [
  {
    key: "crm",
    label: "CRM",
    icon: FileText,
    items: [
      { id: "dashboard", title: "Дашборд", url: "/dashboard", icon: LayoutGrid },
      { id: "requests", title: "Заявки", url: "/requests", icon: FileText },
      { id: "board", title: "Доска", url: "/board", icon: KanbanSquare },
    ],
  },
  {
    key: "project",
    label: "Проект",
    icon: FolderOpen,
    items: [
      { id: "material-statements", title: "Ведомости материалов", url: "/material-statements", icon: FileSpreadsheet },
      { id: "documents", title: "Документы", url: "/documents", icon: Files },
    ],
  },
  {
    key: "erp",
    label: "ERP",
    icon: Layers,
    items: [
      { id: "objects", title: "Объекты", url: "/objects", icon: Building2 },
      { id: "nomenclature", title: "Номенклатура", url: "/nomenclature", icon: Layers },
      { id: "warehouse", title: "Склад", url: "/warehouse", icon: Warehouse },
      { id: "equipment", title: "Техника", url: "/equipment", icon: Truck },
      { id: "spare-parts", title: "Запчасти", url: "/spare-parts", icon: Wrench },
      { id: "filter-elements", title: "Фильтрующие элементы", url: "/filter-elements", icon: Filter },
    ],
  },
  {
    key: "logistics",
    label: "Логистика",
    icon: Truck,
    items: [
      { id: "shipments", title: "Поставки", url: "/shipments", icon: Truck },
      { id: "suppliers", title: "Поставщики", url: "/suppliers", icon: Users },
    ],
  },
  {
    key: "finance",
    label: "Финансы",
    icon: Wallet,
    items: [
      { id: "finance-registry", title: "Реестр по периодам", url: "/finance/registry", icon: FileBarChart },
      { id: "agent-report", title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
      { id: "agent-act-report", title: "Акт агента", url: "/agent-act-report", icon: FileBarChart },
      { id: "percent-calculator", title: "Калькулятор %", url: "/percent-calculator", icon: Percent },
    ],
  },
  {
    key: "analytics",
    label: "Аналитика",
    icon: BarChart3,
    items: [
      { id: "analytics-day-prep", title: "Подготовка к дню", url: "/analytics/day-prep", icon: ClipboardList },
      { id: "analytics-executors", title: "Исполнители", url: "/analytics/executors", icon: Users },
      { id: "analytics-requests", title: "Заявки", url: "/analytics/requests", icon: FileText },
      { id: "analytics-finance", title: "Финансы", url: "/analytics/finance", icon: Wallet },
      { id: "analytics-objects", title: "Объекты", url: "/analytics/objects", icon: Building2 },
      { id: "analytics-logistics", title: "Логистика", url: "/analytics/logistics", icon: Truck },
      { id: "analytics-ai", title: "AI Аналитик", url: "/analytics/ai", icon: Sparkles },
    ],
  },
  {
    key: "planner",
    label: "Планировщик",
    icon: CalendarRange,
    items: [
      { id: "planner", title: "Планировщик CRM", url: "/planner", icon: ClipboardList },
      { id: "my-planner", title: "Мой планировщик", url: "/my-planner", icon: CalendarRange },
    ],
  },
  {
    key: "journals",
    label: "Журналы",
    icon: FileBarChart,
    items: [
      { id: "team-performance", title: "Производительность", url: "/team-performance", icon: Users },
      { id: "action-log", title: "Журнал действий", url: "/action-log", icon: FileBarChart },
    ],
  },
  {
    key: "system",
    label: "Система",
    icon: ShieldCheck,
    items: [
      { id: "org-settings", title: "Настройки", url: "/organization/settings", icon: Settings },
      { id: "sidebar-settings", title: "Настройка меню", url: "/settings/sidebar", icon: LayoutGrid },
    ],
  },
];

export const getAllMenuItems = (): MenuItem[] =>
  menuGroups.flatMap((g) => g.items);

export const findItemById = (id: string): MenuItem | undefined =>
  getAllMenuItems().find((i) => i.id === id);
