import { Home, FileText, Upload, LogOut, CreditCard, Settings, FileBarChart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Все заявки", url: "/requests", icon: FileText },
  { title: "Отчет агента", url: "/agent-report", icon: FileBarChart },
  { title: "Отчет агента - УУ", url: "/agent-report-uu", icon: FileBarChart },
  { title: "Импорт данных", url: "/import", icon: Upload },
  { title: "Настройки", url: "/organization/settings", icon: Settings },
  { title: "Тарифы", url: "/pricing", icon: CreditCard },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const isDemoMode = searchParams.get("demo") === "true";
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  // On mobile, always show text in menu
  const showText = isMobile || !collapsed;

  const handleLogout = async () => {
    if (isDemoMode) {
      navigate("/");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выйти из системы",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
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
        <SidebarGroup>
          {showText && <SidebarGroupLabel>Навигация</SidebarGroupLabel>}
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = currentPath === item.url;
                const url = isDemoMode ? `${item.url}?demo=true` : item.url;
                // Скрываем "Импорт данных", "Настройки", "Тарифы" и отчеты в демо-режиме
                if (isDemoMode && (item.url === "/import" || item.url === "/organization/settings" || item.url === "/pricing" || item.url === "/agent-report" || item.url === "/agent-report-uu")) {
                  return null;
                }
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink 
                        to={url} 
                        end 
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {showText && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-4">
        <Button 
          onClick={handleLogout} 
          variant="ghost" 
          size={(collapsed && !isMobile) ? "icon" : "default"}
          className="w-full justify-start gap-2"
        >
          <LogOut className="h-4 w-4" />
          {showText && <span>{isDemoMode ? "Выйти из демо" : "Выход"}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
