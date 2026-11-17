import {
  FileText,
  Users,
  Settings,
  FileBarChart,
  Percent,
  Building2,
  Warehouse,
  Wallet,
  Truck,
  Layers,
  FolderOpen,
  FileSpreadsheet,
  Files,
  Gauge,
  ListChecks,
  ShieldCheck,
} from "lucide-react";

export type MenuItem = {
  id: string;
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

export const SIDEBAR_STRUCTURE_VERSION = 2;

export const menuGroups: MenuGroup[] = [
  {
    key: "work",
    label: "Работа",
    icon: FileText,
    items: [
      { id: "requests", title: "Заявки", url: "/requests", icon: FileText },
      { id: "tasks", title: "Задачи", url: "/tasks", icon: ListChecks },
      { id: "shipments", title: "Поставки", url: "/shipments", icon: Truck },
      { id: "warehouse", title: "Склад", url: "/warehouse", icon: Warehouse },
    ],
  },
  {
    key: "management",
    label: "Руководителю",
    icon: Gauge,
    items: [
      { id: "executive", title: "Панель руководителя", url: "/executive", icon: Gauge },
    ],
  },
  {
    key: "catalogs",
    label: "Справочники",
    icon: Layers,
    items: [
      { id: "objects", title: "Объекты", url: "/objects", icon: Building2 },
      { id: "nomenclature", title: "Номенклатура", url: "/nomenclature", icon: Layers },
      { id: "equipment", title: "Техника", url: "/equipment", icon: Truck },
      { id: "suppliers", title: "Поставщики", url: "/suppliers", icon: Users },
    ],
  },
  {
    key: "docs",
    label: "Документы",
    icon: FolderOpen,
    items: [
      { id: "documents", title: "Документы", url: "/documents", icon: Files },
      { id: "material-statements", title: "Ведомости материалов", url: "/material-statements", icon: FileSpreadsheet },
    ],
  },
  {
    key: "reports",
    label: "Отчёты",
    icon: Wallet,
    items: [
      { id: "finance-registry", title: "Реестр по периодам", url: "/finance/registry", icon: FileBarChart },
      { id: "agent-report", title: "Отчёт агента", url: "/agent-report", icon: FileBarChart },
      { id: "percent-calculator", title: "Калькулятор %", url: "/percent-calculator", icon: Percent },
      { id: "analytics-executors", title: "Исполнители", url: "/analytics/executors", icon: Users },
      { id: "analytics-requests", title: "Заявки — аналитика", url: "/analytics/requests", icon: FileText },
      { id: "analytics-finance", title: "Финансы", url: "/analytics/finance", icon: Wallet },
      { id: "analytics-objects", title: "Объекты", url: "/analytics/objects", icon: Building2 },
      { id: "analytics-logistics", title: "Логистика", url: "/analytics/logistics", icon: Truck },
      { id: "team-performance", title: "Производительность", url: "/team-performance", icon: Users },
    ],
  },
  {
    key: "system",
    label: "Система",
    icon: ShieldCheck,
    items: [
      { id: "org-settings", title: "Настройки", url: "/organization/settings", icon: Settings },
      { id: "action-log", title: "Журнал действий", url: "/action-log", icon: FileBarChart },
    ],
  },
];

export const getAllMenuItems = (): MenuItem[] =>
  menuGroups.flatMap((group) => group.items);

export const findItemById = (id: string): MenuItem | undefined =>
  getAllMenuItems().find((item) => item.id === id);
