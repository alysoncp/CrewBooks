import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TaxYearProvider } from "@/components/tax-year-provider";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import IncomePage from "@/pages/income";
import ExpensesPage from "@/pages/expenses";
import ExpensesSettingsPage from "@/pages/expenses-settings";
import ReceiptsPage from "@/pages/receipts";
import TaxCalculatorPage from "@/pages/tax-calculator";
import OptimizationPage from "@/pages/optimization";
import ProfilePage from "@/pages/profile";
import Landing from "@/pages/landing";
import GstHstPage from "@/pages/gst-hst";
import PricingPage from "@/pages/pricing";
import TaxFilingT2Page from "@/pages/tax-filing-t2";
import TaxFilingT2125Page from "@/pages/tax-filing-t2125";
import PaystubsPage from "@/pages/paystubs";
import VehicleMileagePage from "@/pages/vehicle-mileage";
import VehiclesPage from "@/pages/vehicles";
import AssetsPage from "@/pages/assets";
import LeasesPage from "@/pages/leases";
import HelpPage from "@/pages/help";
import AboutPage from "@/pages/about";
import BenefitsPage from "@/pages/benefits";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/income" component={IncomePage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/expenses/settings" component={ExpensesSettingsPage} />
      <Route path="/vehicle-mileage" component={VehicleMileagePage} />
      <Route path="/vehicles" component={VehiclesPage} />
      <Route path="/receipts" component={ReceiptsPage} />
      <Route path="/assets" component={AssetsPage} />
      <Route path="/leases" component={LeasesPage} />
      <Route path="/benefits" component={BenefitsPage} />
      <Route path="/tax-calculator" component={TaxCalculatorPage} />
      <Route path="/optimization" component={OptimizationPage} />
      <Route path="/gst-hst" component={GstHstPage} />
      <Route path="/tax-filing-t2" component={TaxFilingT2Page} />
      <Route path="/tax-filing-t2125" component={TaxFilingT2125Page} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/paystubs" component={PaystubsPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/help" component={HelpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
              <AuthenticatedRouter />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function UnauthenticatedLayout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-end gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ThemeToggle />
      </header>
      <Landing />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <UnauthenticatedLayout />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="crewbooks-theme">
        <TaxYearProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </TaxYearProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
