import {
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Star,
  FileText,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { menuGroups, findItemById, type MenuItem, type MenuGroup } from "@/config/sidebarMenu";
import { useSidebarPrefs } from "@/hooks/useSidebarPrefs";

const OPEN_KEY = "sidebar:groups-open:v1";

function ThemeToggle({ showText }: { showText: boolean }) {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={toggleTheme} className="hover:bg-accent/50">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {showText && <span>{theme === "dark" ? "Светлая тема" : "Тёмная тема"}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isViewer } = useUserRole();
  const { hasRouteAccess } = useUserPermissions();
  const totalUnread = useUnreadMessages();
  const { prefs } = useSidebarPrefs();
  const isDemoMode = searchParams.get("demo") === "true";
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const showText = isMobile || !collapsed;

  // Apply prefs (hide + reorder) then role filter
  const visibleGroups: MenuGroup[] = useMemo(() => {
    if (isViewer) {
      return [
        {
          key: "crm",
          label: "CRM",
          icon: FileText,
          items: [{ id: "requests", title: "Заявки", url: "/requests", icon: FileText }],
        },
      ];
    }
    return menuGroups
      .map((g) => {
        const savedOrder = prefs.order[g.key];
        let items = g.items.filter(
          (i) => hasRouteAccess(i.url) && !prefs.hidden.includes(i.id),
        );
        if (savedOrder) {
          const map = new Map(items.map((i) => [i.id, i]));
          const seen = new Set<string>();
          const ordered: MenuItem[] = [];
          for (const id of savedOrder) {
            const it = map.get(id);
            if (it) { ordered.push(it); seen.add(id); }
          }
          for (const it of items) if (!seen.has(it.id)) ordered.push(it);
          items = ordered;
        }
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  }, [isViewer, hasRouteAccess, prefs]);

  const favoriteItems = useMemo(
    () =>
      prefs.favorites
        .map(findItemById)
        .filter((i): i is MenuItem => !!i && hasRouteAccess(i.url) && !prefs.hidden.includes(i.id)),
    [prefs, hasRouteAccess],
  );

  const activeGroupKey =
    visibleGroups.find((g) =>
      g.items.some((i) => currentPath === i.url || currentPath.startsWith(i.url + "/")),
    )?.key ?? null;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(OPEN_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore
    }
  }, [openGroups]);

  const handleLogout = async () => {
    if (isDemoMode) { navigate("/"); return; }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Ошибка", description: "Не удалось выйти из системы", variant: "destructive" });
    } else {
      navigate("/auth");
    }
  };

  const renderItem = (item: MenuItem) => {
    const isActive = currentPath === item.url;
    const url = isDemoMode ? `${item.url}?demo=true` : item.url;
    const showUnread = item.url === "/chat" && totalUnread > 0;

    const button = (
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink
          to={url}
          end
          className="hover:bg-accent/50 transition-colors rounded-md relative"
          activeClassName="bg-primary/20 text-primary font-medium"
          aria-label={!showText ? item.title : undefined}
        >
          <div className="relative">
            <item.icon className="h-4 w-4" />
            {showUnread && (
              <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold">
                {totalUnread > 9 ? "9+" : totalUnread}
              </div>
            )}
          </div>
          {showText && (
            <span className="flex items-center gap-2">
              {item.title}
              {item.badge && (
                <span className="text-[9px] bg-muted text-muted-foreground rounded px-1 py-0.5 leading-none font-medium uppercase tracking-wide">
                  {item.badge}
                </span>
              )}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    );

    return (
      <SidebarMenuItem key={`${item.id}-${item.url}`}>
        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/40 p-4">
        {showText && (
          <div className="space-y-2">
            <OrganizationSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Favorites first */}
        {favoriteItems.length > 0 && (
          <SidebarGroup className="py-0">
            {(!collapsed || isMobile) && (
              <SidebarGroupLabel className="flex h-8 items-center gap-2 px-3 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Star className="h-3.5 w-3.5 fill-current" />
                Избранное
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>{favoriteItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleGroups.map((group) => {
          const isGroupActive = group.key === activeGroupKey;
          const isOpen = collapsed && !isMobile ? true : !!openGroups[group.key];

          if (collapsed && !isMobile) {
            return (
              <SidebarGroup key={group.key}>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.key} className="py-0">
              <Collapsible
                open={isOpen}
                onOpenChange={(o) => setOpenGroups((prev) => ({ ...prev, [group.key]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    className={
                      "group/label flex h-8 cursor-pointer items-center justify-between px-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors " +
                      (isGroupActive ? "text-foreground" : "")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <group.icon className="h-3.5 w-3.5" />
                      {group.label}
                    </span>
                    <ChevronRight
                      className={
                        "h-3.5 w-3.5 transition-transform duration-200 " +
                        (isOpen ? "rotate-90" : "")
                      }
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden">
                  <SidebarGroupContent>
                    <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          <ThemeToggle showText={showText} />
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {showText && <span>{isDemoMode ? "Выйти из демо" : "Выход"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
