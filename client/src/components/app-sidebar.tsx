import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import {
  LayoutDashboard,
  DollarSign,
  Receipt,
  FileImage,
  Calculator,
  TrendingUp,
  User,
  Film,
  LogOut,
  Percent,
  CreditCard,
  FileText,
  Building2,
  Settings,
  Gauge,
  Package,
  Car,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTaxYear } from "@/components/tax-year-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getYearFromDateString } from "@/lib/format";
import type { Income, Expense } from "@shared/schema";

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

const settingsMenuItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Expense Settings", url: "/expenses/settings", icon: Settings },
  { title: "Vehicle Settings", url: "/vehicles", icon: Car },
  { title: "Subscription", url: "/pricing", icon: CreditCard },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { taxYear, setTaxYear, availableYears, setAvailableYears } = useTaxYear();

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  // Fetch income and expenses to determine available years
  const { data: incomeData } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const { data: expenseData } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Update available years when income/expenses data changes
  const currentYear = new Date().getFullYear();
  useEffect(() => {
    if (incomeData || expenseData) {
      const years = new Set<number>();
      years.add(currentYear); // Always include current year
      (incomeData || []).forEach((item) => {
        // Extract year directly from date string to avoid timezone issues
        const year = getYearFromDateString(item.date);
        years.add(year);
      });
      (expenseData || []).forEach((item) => {
        // Extract year directly from date string to avoid timezone issues
        const year = getYearFromDateString(item.date);
        years.add(year);
      });
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      setAvailableYears(sortedYears);
    }
  }, [incomeData, expenseData, currentYear, setAvailableYears]);

  // Feature gating based on subscription tier
  const isBasicTier = user?.subscriptionTier === "basic";
  const isCorporateTier = user?.subscriptionTier === "corporate";
  const hasGstNumber = user?.hasGstNumber || false;
  const hasTaxTools = !isBasicTier; // Personal and Corporate have tax tools
  const hasOptimization = isCorporateTier; // Only Corporate has optimization

  // Build tax menu items dynamically based on access
  const taxMenuItems = [
    ...(hasTaxTools ? [{ title: "Tax Estimator", url: "/tax-calculator", icon: Calculator }] : []),
    ...(hasTaxTools ? [{ title: "Business Summary", url: "/tax-filing-t2125", icon: FileText }] : []),
    ...(isCorporateTier ? [{ title: "T2 Filing", url: "/tax-filing-t2", icon: Building2 }] : []),
    ...(hasOptimization ? [{ title: "Optimization", url: "/optimization", icon: TrendingUp }] : []),
    ...(hasGstNumber ? [{ title: "GST/HST", url: "/gst-hst", icon: Percent }] : []),
  ];

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Immediately set user to null to trigger UI update
      queryClient.setQueryData(["/api/auth/user"], null);
      
      // Also invalidate to ensure fresh state on next login
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Film className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold" data-testid="text-app-name">CrewBooks</span>
            <span className="text-xs text-muted-foreground">Film & TV Finance</span>
          </div>
        </Link>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Tax Year</label>
          <Select
            value={taxYear.toString()}
            onValueChange={(value) => setTaxYear(parseInt(value, 10))}
          >
            <SelectTrigger className="w-full" data-testid="select-tax-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Income with Paystubs submenu */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/income"}
                  data-testid="nav-income"
                >
                  <Link href="/income">
                    <DollarSign className="h-4 w-4" />
                    <span>Income</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/paystubs"}
                  data-testid="nav-paystubs"
                  className="pl-8"
                >
                  <Link href="/paystubs">
                    <FileText className="h-4 w-4" />
                    <span>Paystubs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Expenses with Receipts submenu */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/expenses"}
                  data-testid="nav-expenses"
                >
                  <Link href="/expenses">
                    <Receipt className="h-4 w-4" />
                    <span>Expenses</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/receipts"}
                  data-testid="nav-receipts"
                  className="pl-8"
                >
                  <Link href="/receipts">
                    <FileImage className="h-4 w-4" />
                    <span>Receipts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Vehicle Mileage as top-level item */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/vehicle-mileage"}
                  data-testid="nav-vehicle-mileage"
                >
                  <Link href="/vehicle-mileage">
                    <Gauge className="h-4 w-4" />
                    <span>Vehicle Mileage</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Assets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/assets"}
                  data-testid="nav-assets"
                >
                  <Link href="/assets">
                    <Package className="h-4 w-4" />
                    <span>Assets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/leases"}
                  data-testid="nav-leases"
                >
                  <Link href="/leases">
                    <FileText className="h-4 w-4" />
                    <span>Leases</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {taxMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tax Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {taxMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">{displayName}</p>
            <p className="text-xs text-muted-foreground">Tax Year {taxYear}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full" 
          data-testid="button-logout"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
