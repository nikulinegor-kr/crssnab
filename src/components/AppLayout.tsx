import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReactNode } from "react";
import { SubscriptionBanner } from "./SubscriptionBanner";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import { PermissionRoute } from "./PermissionRoute";
import { FloatingAiChat } from "./FloatingAiChat";
import { MobileBottomNav } from "./MobileBottomNav";
import { QuickRequestFab } from "./quick-request/QuickRequestFab";
import { cn } from "@/lib/utils";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { Building2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  hideSubscriptionBanner?: boolean;
}

export function AppLayout({ children, fullBleed, hideSubscriptionBanner }: AppLayoutProps) {
  const { logoUrl, orgName } = useOrgBranding();

  return (
    <SidebarProvider defaultOpen={false}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
        Перейти к основному содержимому
      </a>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-background/95">
        <AppSidebar />
        
        <div className="flex-1 flex min-w-0 flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/40 glassmorphism px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-white/10 transition-colors rounded-md" />
              {logoUrl ? (
                <div className="p-1.5 rounded-md bg-muted/60 shrink-0">
                  <img
                    src={logoUrl}
                    alt={orgName}
                    className="h-10 w-10 object-contain rounded"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              ) : (
                <div className="p-1.5 rounded-md bg-muted/60 shrink-0">
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm font-semibold text-foreground truncate hidden sm:block max-w-[220px]">
                {orgName || "CRSS CRM"}
              </span>
            </div>
            <div className="flex-1 flex justify-center px-2">
              <GlobalSearch />
            </div>
            <NotificationBell />
          </header>

          <main id="main-content" className={cn(
            "flex-1 min-w-0 overflow-x-hidden",
            fullBleed ? "overflow-y-hidden" : "overflow-y-auto"
          )}>
            {fullBleed ? (
              <div className="flex flex-col h-full w-full min-w-0">
                {!hideSubscriptionBanner && (
                  <div className="w-full p-2 sm:p-3 md:p-6 min-w-0">
                    <SubscriptionBanner />
                  </div>
                )}
                <PermissionRoute>{children}</PermissionRoute>
              </div>
            ) : (
              <div className="w-full p-2 sm:p-3 md:p-6 min-w-0">
                <SubscriptionBanner />
                <PermissionRoute>{children}</PermissionRoute>
              </div>
            )}
          </main>
          {/* Bottom spacer so content isn't hidden behind mobile nav */}
          <div className="h-16 md:hidden" aria-hidden />
        </div>
        <FloatingAiChat />
        <QuickRequestFab />
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
