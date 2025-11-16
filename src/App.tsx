import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ImportData from "./pages/ImportData";
import Requests from "./pages/Requests";
import Auth from "./pages/Auth";
import SelectOrganization from "./pages/SelectOrganization";
import OrganizationSettings from "./pages/OrganizationSettings";

import Pricing from "./pages/Pricing";
import Demo from "./pages/Demo";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/demo" element={<Demo />} />
          <Route
            path="/select-organization"
            element={
              <ProtectedRoute>
                <SelectOrganization />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
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
                <AppLayout>
                  <Requests />
                </AppLayout>
              </ProtectedRoute>
            }
          />
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
            path="/pricing"
            element={
              <AppLayout>
                <Pricing />
              </AppLayout>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
