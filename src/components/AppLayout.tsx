import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ReactNode } from "react";
import { DemoBanner } from "./DemoBanner";
import { SubscriptionBanner } from "./SubscriptionBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/40 bg-background px-4 sticky top-0 z-10">
            <SidebarTrigger className="hover:bg-muted" />
            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              <DemoBanner />
              <SubscriptionBanner />
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
