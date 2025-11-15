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
import ManageUsers from "./pages/ManageUsers";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { DemoProvider } from "./contexts/DemoContext";
import { DemoOrProtectedRoute } from "./components/DemoOrProtectedRoute";

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
              <DemoOrProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </DemoOrProtectedRoute>
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
              <DemoOrProtectedRoute>
                <AppLayout>
                  <Requests />
                </AppLayout>
              </DemoOrProtectedRoute>
            }
          />
          <Route
            path="/manage-users"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ManageUsers />
                </AppLayout>
              </ProtectedRoute>
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
