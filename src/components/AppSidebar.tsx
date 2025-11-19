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
    <Sidebar collapsible="icon" className="border-r border-border/30 bg-sidebar backdrop-blur-xl">
      <SidebarHeader className="border-b border-border/30 p-4 bg-gradient-to-b from-card/50 to-transparent">
        {showText && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center shadow-accent-glow">
                <span className="text-accent-foreground font-bold text-sm">C</span>
              </div>
              <span className="font-bold text-lg text-gradient-accent">CRSS</span>
            </div>
            <OrganizationSwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="py-4">
        <SidebarGroup>
          {showText && <SidebarGroupLabel className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Навигация</SidebarGroupLabel>}
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item) => {
                const isActive = currentPath === item.url;
                const url = isDemoMode ? `${item.url}?demo=true` : item.url;
                if (isDemoMode && (item.url === "/import" || item.url === "/organization/settings" || item.url === "/pricing" || item.url === "/agent-report" || item.url === "/agent-report-uu")) {
                  return null;
                }
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink 
                        to={url} 
                        end 
                        className={`
                          group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-300 font-medium
                          hover:bg-accent/10 hover:text-accent
                          ${isActive ? 'bg-gradient-accent text-accent-foreground shadow-accent-glow' : 'text-sidebar-foreground'}
                        `}
                        activeClassName=""
                      >
                        <item.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                        {showText && <span className="text-sm">{item.title}</span>}
                        {isActive && <div className="absolute inset-0 rounded-lg bg-accent/5" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 p-4 bg-gradient-to-t from-card/30 to-transparent">
        <Button 
          onClick={handleLogout} 
          variant="ghost" 
          size={(collapsed && !isMobile) ? "icon" : "default"}
          className="w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-300 font-medium"
        >
          <LogOut className="h-5 w-5" />
          {showText && <span className="text-sm">{isDemoMode ? "Выйти из демо" : "Выход"}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
