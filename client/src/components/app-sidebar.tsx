import { Link, useLocation } from "wouter";
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

const mainMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Income", url: "/income", icon: DollarSign },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Receipts", url: "/receipts", icon: FileImage },
];

const settingsMenuItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Subscription", url: "/pricing", icon: CreditCard },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  // Feature gating based on subscription tier
  const isBasicTier = user?.subscriptionTier === "basic";
  const isCorporateTier = user?.subscriptionTier === "corporate";
  const hasGstNumber = user?.hasGstNumber || false;
  const hasTaxTools = !isBasicTier; // Personal and Corporate have tax tools
  const hasOptimization = isCorporateTier; // Only Corporate has optimization

  // Build tax menu items dynamically based on access
  const taxMenuItems = [
    ...(hasTaxTools ? [{ title: "Tax Calculator", url: "/tax-calculator", icon: Calculator }] : []),
    ...(hasTaxTools ? [{ title: "T1 Filing", url: "/tax-filing-t1", icon: FileText }] : []),
    ...(isCorporateTier ? [{ title: "T2 Filing", url: "/tax-filing-t2", icon: Building2 }] : []),
    ...(hasOptimization ? [{ title: "Optimization", url: "/optimization", icon: TrendingUp }] : []),
    ...(hasGstNumber ? [{ title: "GST/HST", url: "/gst-hst", icon: Percent }] : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Film className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold" data-testid="text-app-name">CrewBooks</span>
            <span className="text-xs text-muted-foreground">Film & TV Finance</span>
          </div>
        </Link>
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
            <p className="text-xs text-muted-foreground">Tax Year 2024</p>
          </div>
        </div>
        <a href="/api/logout">
          <Button variant="outline" size="sm" className="w-full" data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
