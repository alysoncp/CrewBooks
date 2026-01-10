import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calculator, Percent } from "lucide-react";
import { formatCurrency, formatPercent, getCategoryLabel, getYearFromDateString } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import type { Income, Expense, TaxCalculation, User, Vehicle } from "@shared/schema";
import { HOME_OFFICE_LIVING_CATEGORIES } from "@shared/schema";
import { useTaxYear } from "@/components/tax-year-provider";
import { useAuth } from "@/hooks/useAuth";

interface DashboardData {
  income: Income[];
  expenses: Expense[];
  businessExpenses: Expense[];
  personalExpenses: Expense[];
  taxCalculation: TaxCalculation;
  monthlyData: Array<{ month: string; income: number; expenses: number }>;
  expensesByCategory: Array<{ category: string; amount: number; color: string }>;
  businessExpensesByCategory: Array<{ category: string; amount: number; color: string }>;
  personalExpensesByCategory: Array<{ category: string; amount: number; color: string }>;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isLoading,
  testId,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold" data-testid={testId}>
                {value}
              </span>
              {trend && trend !== "neutral" && (
                <span className={trend === "up" ? "text-green-600" : "text-red-600"}>
                  {trend === "up" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { taxYear } = useTaxYear();
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  // Fetch user profile for home office percentage
  const { data: userProfile } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });

  // Fetch vehicles for business use percentage calculations
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Filter income and expenses by selected year
  const filteredIncome = useMemo(() => {
    return (data?.income || []).filter((item) => {
      // Extract year directly from date string to avoid timezone issues
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    });
  }, [data?.income, taxYear]);

  const filteredExpenses = useMemo(() => {
    return (data?.expenses || []).filter((item) => {
      // Extract year directly from date string to avoid timezone issues
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    });
  }, [data?.expenses, taxYear]);

  const filteredBusinessExpenses = useMemo(() => {
    return (data?.businessExpenses || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    });
  }, [data?.businessExpenses, taxYear]);

  const filteredPersonalExpenses = useMemo(() => {
    return (data?.personalExpenses || []).filter((item) => {
      const itemYear = getYearFromDateString(item.date);
      return itemYear === taxYear;
    });
  }, [data?.personalExpenses, taxYear]);

  // Recalculate monthly data from filtered data
  const monthlyData = useMemo(() => {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const data = months.map((month) => ({
      month,
      income: 0,
      expenses: 0,
    }));

    filteredIncome.forEach((item) => {
      const date = new Date(item.date);
      const monthIndex = date.getMonth();
      data[monthIndex].income += parseFloat(item.amount.toString());
    });

    filteredExpenses.forEach((item) => {
      const date = new Date(item.date);
      const monthIndex = date.getMonth();
      data[monthIndex].expenses += parseFloat(item.amount.toString());
    });

    return data;
  }, [filteredIncome, filteredExpenses]);

  // Recalculate expenses by category from filtered data (business expenses)
  const expensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    filteredBusinessExpenses.forEach((expense) => {
      const category = expense.category;
      categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(expense.amount.toString());
    });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category: getCategoryLabel(category),
        amount,
        color: "",
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [filteredBusinessExpenses]);

  // Get unique vehicle IDs from vehicle expenses
  const vehicleIdsInExpenses = useMemo(() => {
    const ids = new Set<string>();
    if (!filteredExpenses) return [];
    
    filteredExpenses.forEach((expense) => {
      const expenseType = (expense as any).expenseType || "self_employment";
      if (expenseType === "vehicle" && (expense as any).vehicleId) {
        const vehicleId = (expense as any).vehicleId;
        if (vehicleId) {
          ids.add(vehicleId);
        }
      }
    });
    
    return Array.from(ids);
  }, [filteredExpenses]);

  // Fetch business use percentages for vehicles used in expenses
  const [vehicleBusinessUseMap, setVehicleBusinessUseMap] = useState<Map<string, number>>(new Map());
  
  useEffect(() => {
    const fetchVehiclePercentages = async () => {
      const map = new Map<string, number>();
      const promises = vehicleIdsInExpenses.map(async (vehicleId: string) => {
        try {
          const response = await fetch(`/api/vehicles/${vehicleId}/business-use-percentage?taxYear=${taxYear}`);
          if (response.ok) {
            const data = await response.json();
            map.set(vehicleId, data.businessUsePercentage || 100);
          } else {
            map.set(vehicleId, 100); // Default to 100% if fetch fails
          }
        } catch (error) {
          map.set(vehicleId, 100); // Default to 100% on error
        }
      });
      
      await Promise.all(promises);
      setVehicleBusinessUseMap(map);
    };
    
    if (vehicleIdsInExpenses.length > 0) {
      fetchVehiclePercentages();
    } else {
      setVehicleBusinessUseMap(new Map());
    }
  }, [vehicleIdsInExpenses, taxYear]);

  // Helper function to calculate deductible amount and deductible GST for an expense
  const calculateDeductible = useMemo(() => {
    return (item: Expense, vehicleBusinessUseMap: Map<string, number>) => {
      if (!item.isTaxDeductible) {
        return { deductibleAmount: 0, deductibleGst: 0 };
      }

      const expenseType = (item as any).expenseType || "self_employment";
      const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
      const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
      const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;

      if (expenseType === "personal") {
        return { deductibleAmount: 0, deductibleGst: 0 };
      }

      if (expenseType === "home_office_living") {
        // Home Office/Living expenses: apply home office percentage if set
        let deductibleAmount = baseCost + pstAmount;
        let deductibleGst = gstAmount;
        if (userProfile?.homeOfficePercentage) {
          const percentage = parseFloat(userProfile.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * percentage;
          deductibleGst = deductibleGst * percentage;
        }
        return { deductibleAmount, deductibleGst };
      }

      if (expenseType === "vehicle") {
        // Vehicle expenses: use business use percentage from odometer entries
        const vehicleId = (item as any).vehicleId;
        let businessPercentage = 1.0; // Default to 100% if no vehicle or percentage found
        
        if (vehicleId && vehicleBusinessUseMap.has(vehicleId)) {
          businessPercentage = vehicleBusinessUseMap.get(vehicleId)! / 100;
        }
        
        const deductibleAmount = (baseCost + pstAmount) * businessPercentage;
        const deductibleGst = gstAmount * businessPercentage;
        return { deductibleAmount, deductibleGst };
      }

      if (expenseType === "self_employment") {
        // Self-Employment expenses: fully deductible
        return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
      }

      if (expenseType === "mixed") {
        const businessPercentage = (item as any).businessUsePercentage 
          ? parseFloat((item as any).businessUsePercentage.toString()) / 100 
          : 0;
        
        // Only business portion of base cost + proportional PST is deductible
        const businessBaseCost = baseCost * businessPercentage;
        const businessPstAmount = pstAmount * businessPercentage;
        let deductibleAmount = businessBaseCost + businessPstAmount;
        let deductibleGst = gstAmount * businessPercentage;
        
        // Apply home office percentage if applicable for home office/living categories
        if (HOME_OFFICE_LIVING_CATEGORIES.includes(item.category as any) && userProfile?.homeOfficePercentage) {
          const homeOfficePercentage = parseFloat(userProfile.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * homeOfficePercentage;
          deductibleGst = deductibleGst * homeOfficePercentage;
        }
        
        return { deductibleAmount, deductibleGst };
      }

      // Default: treat as business expense (fully deductible)
      return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
    };
  }, [userProfile]);

  // Calculate deductible expenses and deductible GST
  const { deductibleExpenses, deductibleGstCredits } = useMemo(() => {
    let deductibleSum = 0;
    let deductibleGstSum = 0;
    
    // Create a temporary map with default 100% for vehicles (for summary calculations)
    const tempVehicleMap = new Map<string, number>();
    vehicles.forEach(vehicle => {
      if (vehicle.id) {
        // For summary, use 100% as default - actual calculation happens with fetched percentages
        tempVehicleMap.set(vehicle.id, 100);
      }
    });
    
    filteredExpenses.forEach((item) => {
      const result = calculateDeductible(item, vehicleBusinessUseMap.size > 0 ? vehicleBusinessUseMap : tempVehicleMap);
      deductibleSum += result.deductibleAmount;
      deductibleGstSum += result.deductibleGst;
    });
    
    return { deductibleExpenses: deductibleSum, deductibleGstCredits: deductibleGstSum };
  }, [filteredExpenses, calculateDeductible, vehicles, vehicleBusinessUseMap]);

  // Recalculate totals from filtered data
  const totalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const totalBusinessExpenses = filteredBusinessExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const totalPersonalExpenses = filteredPersonalExpenses.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0);
  const netIncome = totalIncome - totalExpenses;
  
  // For tax calculations, we'll proportionally adjust based on the income ratio
  // This is an approximation since tax brackets are progressive
  const originalGrossIncome = data?.taxCalculation?.grossIncome ?? 0;
  const incomeRatio = originalGrossIncome > 0 ? totalIncome / originalGrossIncome : 0;
  
  const federalTax = (data?.taxCalculation?.federalTax ?? 0) * incomeRatio;
  const provincialTax = (data?.taxCalculation?.provincialTax ?? 0) * incomeRatio;
  const cppContribution = (data?.taxCalculation?.cppContribution ?? 0) * incomeRatio;
  const totalTaxOwed = federalTax + provincialTax + cppContribution;
  const effectiveRate = netIncome > 0 ? (totalTaxOwed / netIncome) * 100 : 0;
  
  // Determine if it's an amount owed (positive) or refund (negative)
  const isRefund = totalTaxOwed < 0;
  const taxLabel = isRefund ? "Estimated CRA Refund" : "Estimated CRA Owing";
  const taxValueColor = isRefund ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">Your financial overview for {taxYear}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
        <StatCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          subtitle="Year to date"
          icon={DollarSign}
          trend="up"
          isLoading={isLoading}
          testId="stat-total-income"
        />
        <StatCard
          title="Business Expenses"
          value={formatCurrency(totalBusinessExpenses)}
          subtitle="Year to date"
          icon={Receipt}
          trend="neutral"
          isLoading={isLoading}
          testId="stat-business-expenses"
        />
        <StatCard
          title="Deductible Expenses"
          value={formatCurrency(deductibleExpenses)}
          subtitle="Tax deductible amount"
          icon={Percent}
          trend="neutral"
          isLoading={isLoading}
          testId="stat-deductible-expenses"
        />
        <StatCard
          title="Personal Expenses"
          value={formatCurrency(totalPersonalExpenses)}
          subtitle="Year to date"
          icon={Receipt}
          trend="neutral"
          isLoading={isLoading}
          testId="stat-personal-expenses"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(netIncome)}
          subtitle="After deductions"
          icon={TrendingUp}
          trend={netIncome > 0 ? "up" : "down"}
          isLoading={isLoading}
          testId="stat-net-income"
        />
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{taxLabel}</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-2xl font-semibold ${taxValueColor}`} data-testid="stat-tax-owed">
                    {formatCurrency(Math.abs(totalTaxOwed))}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {`${formatPercent(effectiveRate)} effective rate`}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Income vs. Expenses</CardTitle>
            <CardDescription>Monthly breakdown for {taxYear}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data?.monthlyData || []}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(var(--chart-1))"
                    fillOpacity={1}
                    fill="url(#colorIncome)"
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="hsl(var(--chart-5))"
                    fillOpacity={1}
                    fill="url(#colorExpenses)"
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Expenses by Category</CardTitle>
            <CardDescription>Distribution of business spending</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 space-y-2">
              {expensesByCategory.slice(0, 5).map((item, index) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{item.category}</span>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Breakdown</CardTitle>
          <CardDescription>Estimated tax obligations for {taxYear}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Federal Tax</p>
                <p className="font-mono text-xl font-semibold" data-testid="stat-federal-tax">
                  {formatCurrency(federalTax)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Provincial Tax</p>
                <p className="font-mono text-xl font-semibold" data-testid="stat-provincial-tax">
                  {formatCurrency(provincialTax)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">CPP Contribution</p>
                <p className="font-mono text-xl font-semibold" data-testid="stat-cpp">
                  {formatCurrency(cppContribution)}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="font-mono text-xl font-semibold text-destructive" data-testid="stat-total-owed">
                  {formatCurrency(totalTaxOwed)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
