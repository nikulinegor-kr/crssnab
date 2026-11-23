import { Suspense, useState } from "react";
import NativeShell from "@/components/native/NativeShell";
import "@/hooks/useUiScale";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { LegacyRouteRedirect } from "./components/LegacyRouteRedirect";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { lazyWithRetry } from "./lib/lazyWithRetry";
import { NetworkStatusIndicator } from "./components/NetworkStatusIndicator";
import { QuickRequestProvider } from "./components/quick-request/QuickRequestProvider";
import { useMobileKeyboardFocus } from "./hooks/useMobileKeyboardFocus";

// Lazy load all pages with retry mechanism for code splitting
const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const ExecutivePanelPage = lazyWithRetry(() => import("./pages/ExecutivePanelPage"));
const ImportData = lazyWithRetry(() => import("./pages/ImportData"));
const Requests = lazyWithRetry(() => import("./pages/Requests"));
const RequestDetail = lazyWithRetry(() => import("./pages/RequestDetail"));
const ProjectsPage = lazyWithRetry(() => import("./pages/ProjectsPage"));
const Suppliers = lazyWithRetry(() => import("./pages/Suppliers"));
const CalendarPage = lazyWithRetry(() => import("./pages/CalendarPage"));
const TasksHubPage = lazyWithRetry(() => import("./pages/TasksHubPage"));
const ChatPage = lazyWithRetry(() => import("./pages/ChatPage"));
const MePage = lazyWithRetry(() => import("./pages/MePage"));
const MeNotificationsPage = lazyWithRetry(() => import("./pages/MeNotificationsPage"));
const MeProfilePage = lazyWithRetry(() => import("./pages/MeProfilePage"));
const PersonalDataDocument = lazyWithRetry(() => import("./pages/PersonalDataDocument"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const SelectOrganization = lazyWithRetry(() => import("./pages/SelectOrganization"));
const OrganizationSettings = lazyWithRetry(() => import("./pages/OrganizationSettings"));
const SidebarSettings = lazyWithRetry(() => import("./pages/SidebarSettings"));
const AgentReport = lazyWithRetry(() => import("./pages/AgentReport"));
const PercentCalculator = lazyWithRetry(() => import("./pages/PercentCalculator"));

const SpareParts = lazyWithRetry(() => import("./pages/SpareParts"));
const FilterElements = lazyWithRetry(() => import("./pages/FilterElements"));
const DeadstockPage = lazyWithRetry(() => import("./pages/DeadstockPage"));
const ShipmentsPage = lazyWithRetry(() => import("./pages/ShipmentsPage"));
const ObjectsPage = lazyWithRetry(() => import("./pages/ObjectsPage"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/AnalyticsPage"));
const DocumentsPage = lazyWithRetry(() => import("./pages/DocumentsPage"));
const TeamPage = lazyWithRetry(() => import("./pages/TeamPage"));
const WarehousePage = lazyWithRetry(() => import("./pages/WarehousePage"));
const NomenclaturePage = lazyWithRetry(() => import("./pages/NomenclaturePage"));
const EquipmentPage = lazyWithRetry(() => import("./pages/EquipmentPage"));
const EquipmentDetailPage = lazyWithRetry(() => import("./pages/EquipmentDetailPage"));

const ErpAnalyticsPage = lazyWithRetry(() => import("./pages/ErpAnalyticsPage"));
const ProcurementPlanPage = lazyWithRetry(() => import("./pages/ProcurementPlanPage"));
const SupplyDashboardPage = lazyWithRetry(() => import("./pages/SupplyDashboardPage"));
const MovementJournalPage = lazyWithRetry(() => import("./pages/MovementJournalPage"));
const QrWarehousePage = lazyWithRetry(() => import("./pages/QrWarehousePage"));
const MaterialStatementsPage = lazyWithRetry(() => import("./pages/MaterialStatementsPage"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const Features = lazyWithRetry(() => import("./pages/Features"));
const Demo = lazyWithRetry(() => import("./pages/Demo"));
const About = lazyWithRetry(() => import("./pages/About"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const SystemDemo = lazyWithRetry(() => import("./pages/SystemDemo"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const OAuthConsent = lazyWithRetry(() => import("./pages/OAuthConsent"));

const ActionLogPage = lazyWithRetry(() => import("./pages/ActionLogPage"));
const TeamPerformancePage = lazyWithRetry(() => import("./pages/TeamPerformancePage"));
const ErrorLogsPage = lazyWithRetry(() => import("./pages/ErrorLogsPage"));
const AnalyticsExecutorsPage = lazyWithRetry(() => import("./pages/analytics/AnalyticsExecutorsPage"));
const AnalyticsExecutorDetailPage = lazyWithRetry(() => import("./pages/analytics/AnalyticsExecutorDetailPage"));
const AnalyticsRequestsPage = lazyWithRetry(() => import("./pages/analytics/AnalyticsRequestsPage"));
const AnalyticsFinancePage = lazyWithRetry(() => import("./pages/analytics/AnalyticsFinancePage"));
const RequestsRegistryPage = lazyWithRetry(() => import("./pages/finance/RequestsRegistryPage"));
const AnalyticsObjectsPage = lazyWithRetry(() => import("./pages/analytics/AnalyticsObjectsPage"));
const AnalyticsLogisticsPage = lazyWithRetry(() => import("./pages/analytics/AnalyticsLogisticsPage"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const App = () => {
  const [queryClient] = useState(createQueryClient);
  useMobileKeyboardFocus();
  
  
  return (
  <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <NetworkStatusIndicator />
          <BrowserRouter>
          <QuickRequestProvider>
          <NativeShell />

          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/landing" element={<HomePage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/privacy" element={<PersonalDataDocument />} />
            <Route path="/consent/2026-11-23" element={<PersonalDataDocument consent />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/employee-login" element={<Auth />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/features" element={<Features />} />
            <Route
              path="/select-organization"
              element={
                <ProtectedRoute>
                  <SelectOrganization />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route
              path="/executive"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ExecutivePanelPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ImportData />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <AppLayout fullBleed>
                    <Requests />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/board" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RequestDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Suppliers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <TasksHubPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ChatPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/me" element={<ProtectedRoute><AppLayout><MePage /></AppLayout></ProtectedRoute>} />
            <Route path="/me/notifications" element={<ProtectedRoute><AppLayout><MeNotificationsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/me/profile" element={<ProtectedRoute><AppLayout><MeProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<Navigate to="/me/profile" replace />} />
            <Route
              path="/organization/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <OrganizationSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/sidebar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SidebarSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-report"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AgentReport />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/agent-act-report" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route
              path="/percent-calculator"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PercentCalculator />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/ai-analytics" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route
              path="/spare-parts"
              element={
                <ProtectedRoute>
                  <SpareParts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/filter-elements"
              element={
                <ProtectedRoute>
                  <FilterElements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deadstock"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DeadstockPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipments"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ShipmentsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/objects"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ObjectsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/executors"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsExecutorsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/executors/:executor"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsExecutorDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/requests"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsRequestsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/finance"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsFinancePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/registry"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RequestsRegistryPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/objects"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsObjectsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/logistics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AnalyticsLogisticsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/analytics/ai" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route path="/analytics/day-prep" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DocumentsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <TeamPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <QrWarehousePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse/legacy"
              element={<ProtectedRoute><AppLayout><WarehousePage /></AppLayout></ProtectedRoute>}
            />
            <Route
              path="/warehouse/qr"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <QrWarehousePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse/journal"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MovementJournalPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/nomenclature"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NomenclaturePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EquipmentPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EquipmentDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/system-demo"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SystemDemo />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/erp-analytics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ErpAnalyticsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/procurement-plan"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProcurementPlanPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/supply-dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SupplyDashboardPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/material-statements"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MaterialStatementsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/action-log"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ActionLogPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-performance"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <TeamPerformancePage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/error-logs"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ErrorLogsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/planner/*" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
            <Route path="/my-planner/*" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
          </QuickRequestProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
