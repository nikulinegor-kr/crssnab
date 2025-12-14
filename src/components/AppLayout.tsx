import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ReactNode } from "react";
import { SubscriptionBanner } from "./SubscriptionBanner";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  hideSubscriptionBanner?: boolean;
}

export function AppLayout({ children, fullBleed, hideSubscriptionBanner }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-background/95">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/40 glassmorphism px-4 sticky top-0 z-10">
            <SidebarTrigger className="hover:bg-white/10 transition-colors rounded-md" />
            <NotificationBell />
          </header>

          <main className={cn("flex-1", fullBleed ? "overflow-hidden" : "overflow-auto")}>
            {fullBleed ? (
              <div className="flex flex-col h-full w-full">
                {!hideSubscriptionBanner && (
                  <div className="w-full p-2 sm:p-3 md:p-6">
                    <SubscriptionBanner />
                  </div>
                )}
                {children}
              </div>
            ) : (
              <div className="w-full p-2 sm:p-3 md:p-6">
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
