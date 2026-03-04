import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReactNode } from "react";
import { SubscriptionBanner } from "./SubscriptionBanner";
import { NotificationBell } from "./NotificationBell";
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
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-background/95">
        <AppSidebar />
        
        <div className="flex-1 flex min-w-0 flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/40 glassmorphism px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-white/10 transition-colors rounded-md" />
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={orgName}
                  className="h-7 w-7 object-contain rounded shrink-0"
                />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-semibold text-foreground truncate hidden sm:block max-w-[200px]">
                {orgName || "CRSS CRM"}
              </span>
            </div>
            <NotificationBell />
          </header>

          <main className={cn(
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
                {children}
              </div>
            ) : (
              <div className="w-full p-2 sm:p-3 md:p-6 min-w-0">
                <SubscriptionBanner />
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
