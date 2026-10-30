import { Link } from "react-router-dom";
import { ListChecks, Files, ShoppingCart, UserRound, Building2, Truck, ChartNoAxesCombined, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const sections = [
  { title: "Задачи", url: "/planner", icon: ListChecks }, { title: "Документы", url: "/documents", icon: Files },
  { title: "Закупки", url: "/requests", icon: ShoppingCart }, { title: "Кабинет", url: "/profile", icon: UserRound },
  { title: "Объекты", url: "/objects", icon: Building2 }, { title: "Техника", url: "/equipment", icon: Truck },
  { title: "Отчёты", url: "/analytics/requests", icon: ChartNoAxesCombined }, { title: "Персонал", url: "/team", icon: Users },
];
export function ExecSectionsGrid() {
  const { hasRouteAccess, loading } = useUserPermissions();
  return <section className="min-w-0"><h2 className="mb-3 text-base font-semibold">Разделы</h2><div className="grid grid-cols-4 gap-2 lg:grid-cols-8">
    {loading ? sections.map(s => <Skeleton key={s.url} className="h-24" />) : sections.filter(s => hasRouteAccess(s.url)).map(({ title, url, icon: Icon }) =>
      <Button key={url} variant="outline" asChild className="h-24 min-w-0 flex-col gap-3 px-1 text-xs font-normal"><Link to={url}><Icon className="text-muted-foreground" /><span className="w-full text-center whitespace-normal break-words">{title}</span></Link></Button>)}
  </div></section>;
}