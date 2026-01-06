import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, DollarSign, Percent, TrendingDown, Building, Lock, Sparkles, Briefcase } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Link } from "wouter";
import { useTaxYear } from "@/components/tax-year-provider";
import type { TaxCalculation, User } from "@shared/schema";

interface TaxData {
  calculation: TaxCalculation;
  user: User;
  breakdown: {
    federalBrackets: Array<{ bracket: string; rate: number; tax: number }>;
    provincialBrackets: Array<{ bracket: string; rate: number; tax: number }>;
  };
}

function TaxBracketRow({
  bracket,
  rate,
  tax,
  isLast,
}: {
  bracket: string;
  rate: number;
  tax: number;
  isLast?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-2 ${!isLast ? "border-b border-border/50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{bracket}</span>
        <Badge variant="secondary" size="sm" className="font-mono text-xs">
          {formatPercent(rate)}
        </Badge>
      </div>
      <span className="font-mono text-sm font-medium">{formatCurrency(tax)}</span>
    </div>
  );
}

function LockedContent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Lock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold">Tax Estimator</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Upgrade to a paid plan to access tax calculations, projections, and detailed bracket breakdowns.
      </p>
      <Link href="/profile">
        <Button className="mt-6" data-testid="button-upgrade-tax">
          <Sparkles className="mr-2 h-4 w-4" />
          View Pricing Plans
        </Button>
      </Link>
    </div>
  );
}

export default function TaxCalculatorPage() {
  const { taxYear } = useTaxYear();
  const queryClient = useQueryClient();
  const [regularEmploymentIncome, setRegularEmploymentIncome] = useState<string>("");
  const [taxesPaidOnEmployment, setTaxesPaidOnEmployment] = useState<string>("");
  const [cppPaidOnEmployment, setCppPaidOnEmployment] = useState<string>("");

  const { data, isLoading, isError } = useQuery<TaxData>({
    queryKey: ["/api/tax-calculation", taxYear.toString()],
    queryFn: async ({ queryKey }) => {
      const response = await fetch(`/api/tax-calculation?taxYear=${queryKey[1]}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tax calculation");
      }
      return response.json();
    },
    retry: false,
    staleTime: 0, // Always refetch when tax year changes
  });

  // Ensure refetch when tax year changes
  useEffect(() => {
    queryClient.invalidateQueries({ 
      queryKey: ["/api/tax-calculation"],
      refetchType: "active",
    });
  }, [taxYear, queryClient]);

  const calculation = data?.calculation;
  const user = data?.user;
  const isBasicTier = user?.subscriptionTier === "basic";
  const hasTaxTools = !isBasicTier;

  const regularIncomeValue = parseFloat(regularEmploymentIncome) || 0;
  const taxesPaidValue = parseFloat(taxesPaidOnEmployment) || 0;
  const cppPaidValue = parseFloat(cppPaidOnEmployment) || 0;

  // Calculate adjusted tax totals including regular employment
  const selfEmploymentNetIncome = calculation?.netIncome ?? 0;
  const combinedNetIncome = selfEmploymentNetIncome + regularIncomeValue;
  
  // Get base tax calculation values
  const selfEmploymentFederalTax = calculation?.federalTax ?? 0;
  const selfEmploymentProvincialTax = calculation?.provincialTax ?? 0;
  const selfEmploymentCPP = calculation?.cppContribution ?? 0;
  const effectiveRate = calculation?.effectiveTaxRate ?? 0;
  
  // Estimate tax on regular employment income using effective rate
  // This is an approximation - in reality, we'd recalculate using tax brackets
  const estimatedTaxOnEmployment = regularIncomeValue > 0 
    ? (effectiveRate / 100) * regularIncomeValue
    : 0;
  
  // Split estimated tax proportionally between federal and provincial (rough estimate)
  const federalTaxRate = selfEmploymentNetIncome > 0 
    ? (selfEmploymentFederalTax / (selfEmploymentFederalTax + selfEmploymentProvincialTax || 1)) 
    : 0.5;
  const provincialTaxRate = 1 - federalTaxRate;
  
  const estimatedFederalTaxOnEmployment = estimatedTaxOnEmployment * federalTaxRate;
  const estimatedProvincialTaxOnEmployment = estimatedTaxOnEmployment * provincialTaxRate;
  
  // Adjusted totals
  const adjustedFederalTax = selfEmploymentFederalTax + estimatedFederalTaxOnEmployment;
  const adjustedProvincialTax = selfEmploymentProvincialTax + estimatedProvincialTaxOnEmployment;
  const adjustedTotalIncomeTax = adjustedFederalTax + adjustedProvincialTax;
  
  // Calculate adjusted CPP considering annual cap and CPP already paid
  // Get CPP max contribution based on tax year
  const getMaxCPPContribution = (year: number): number => {
    const cppParamsByYear: Record<number, { maxPensionableEarnings: number; basicExemption: number; selfEmployedRate: number }> = {
      2020: { maxPensionableEarnings: 58700, basicExemption: 3500, selfEmployedRate: 0.1095 },
      2021: { maxPensionableEarnings: 61600, basicExemption: 3500, selfEmployedRate: 0.1095 },
      2022: { maxPensionableEarnings: 64900, basicExemption: 3500, selfEmployedRate: 0.1115 },
      2023: { maxPensionableEarnings: 66600, basicExemption: 3500, selfEmployedRate: 0.1140 },
      2024: { maxPensionableEarnings: 68500, basicExemption: 3500, selfEmployedRate: 0.1190 },
      2025: { maxPensionableEarnings: 71300, basicExemption: 3500, selfEmployedRate: 0.1190 },
      2026: { maxPensionableEarnings: 74600, basicExemption: 3500, selfEmployedRate: 0.1190 },
    };
    const params = cppParamsByYear[year] || cppParamsByYear[2026];
    const maxContributoryEarnings = params.maxPensionableEarnings - params.basicExemption;
    return maxContributoryEarnings * params.selfEmployedRate;
  };
  
  const maxCPPContribution = getMaxCPPContribution(taxYear);
  const totalCPPNeeded = selfEmploymentCPP; // CPP on self-employment income
  const totalCPPWithEmployment = cppPaidValue + totalCPPNeeded;
  const adjustedCPP = Math.min(totalCPPWithEmployment, maxCPPContribution) - cppPaidValue;
  const adjustedCPPAfterCap = Math.max(0, adjustedCPP); // Can't be negative
  
  const adjustedTotalOwed = adjustedTotalIncomeTax + adjustedCPPAfterCap - taxesPaidValue;
  
  const adjustedEffectiveRate = combinedNetIncome > 0 ? (Math.max(0, adjustedTotalOwed) / combinedNetIncome) * 100 : 0;
  const progressValue = Math.min(adjustedEffectiveRate, 50);

  // Show locked content if API returns 403 or user lacks access
  if (!isLoading && (isError || !hasTaxTools)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-tax-title">Tax Estimator</h1>
          <p className="text-muted-foreground">
            Projected tax obligations based on your income and expenses
          </p>
        </div>
        <LockedContent />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-tax-title">Tax Estimator</h1>
        <p className="text-muted-foreground">
          Projected tax obligations based on your income and expenses
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Gross Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold" data-testid="stat-gross-income">
                  {formatCurrency(calculation?.grossIncome ?? 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  Total Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="stat-deductions">
                  -{formatCurrency(calculation?.totalExpenses ?? 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calculator className="h-4 w-4" />
                  Net Taxable Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-2xl font-semibold" data-testid="stat-net-taxable">
                  {formatCurrency(calculation?.netIncome ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Regular Employment Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="regular-employment-income" className="text-xs text-muted-foreground">
                    Estimated annual income from regular employment
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="regular-employment-income"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={regularEmploymentIncome}
                      onChange={(e) => setRegularEmploymentIncome(e.target.value)}
                      className="pl-7 font-mono text-lg"
                      data-testid="input-regular-employment-income"
                    />
                  </div>
                  {regularIncomeValue > 0 && (
                    <p className="font-mono text-sm text-muted-foreground">
                      {formatCurrency(regularIncomeValue)} per year
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Percent className="h-4 w-4" />
                  Taxes Paid on Employment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="taxes-paid-employment" className="text-xs text-muted-foreground">
                    Total taxes already paid on employment income
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="taxes-paid-employment"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={taxesPaidOnEmployment}
                      onChange={(e) => setTaxesPaidOnEmployment(e.target.value)}
                      className="pl-7 font-mono text-lg"
                      data-testid="input-taxes-paid-employment"
                    />
                  </div>
                  {taxesPaidValue > 0 && (
                    <p className="font-mono text-sm text-muted-foreground">
                      {formatCurrency(taxesPaidValue)} paid
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calculator className="h-4 w-4" />
                  CPP Paid on Employment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="cpp-paid-employment" className="text-xs text-muted-foreground">
                    CPP contributions already paid on employment income
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="cpp-paid-employment"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cppPaidOnEmployment}
                      onChange={(e) => setCppPaidOnEmployment(e.target.value)}
                      className="pl-7 font-mono text-lg"
                      data-testid="input-cpp-paid-employment"
                    />
                  </div>
                  {cppPaidValue > 0 && (
                    <p className="font-mono text-sm text-muted-foreground">
                      {formatCurrency(cppPaidValue)} paid
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Federal Tax
                </CardTitle>
                <CardDescription>Canada Revenue Agency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Federal Tax</span>
                  <span className="font-mono text-lg font-semibold" data-testid="stat-federal-total">
                    {formatCurrency(calculation?.federalTax ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Provincial Tax
                </CardTitle>
                <CardDescription>
                  British Columbia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Provincial Tax</span>
                  <span className="font-mono text-lg font-semibold" data-testid="stat-provincial-total">
                    {formatCurrency(calculation?.provincialTax ?? 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Tax Rates
              </CardTitle>
              <CardDescription>
                Your tax rate information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Marginal Tax Rate</span>
                  <p className="font-mono text-xl font-semibold" data-testid="stat-marginal-rate">
                    {formatPercent(calculation?.marginalTaxRate ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Tax rate on next dollar earned</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Effective Tax Rate</span>
                  <p className="font-mono text-xl font-semibold" data-testid="stat-effective-rate">
                    {formatPercent(calculation?.effectiveTaxRate ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Average tax rate on total income</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CPP Contributions</CardTitle>
              <CardDescription>
                Canada Pension Plan self-employment contribution (2024)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contribution Rate</span>
                    <span className="font-mono font-medium">11.90%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Maximum Pensionable Earnings</span>
                    <span className="font-mono font-medium">$68,500</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Basic Exemption</span>
                    <span className="font-mono font-medium">$3,500</span>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-muted p-6">
                  <span className="text-sm text-muted-foreground">Your CPP Contribution</span>
                  <span className="font-mono text-3xl font-bold" data-testid="stat-cpp-contribution">
                    {formatCurrency(regularIncomeValue > 0 || cppPaidValue > 0 
                      ? adjustedCPPAfterCap 
                      : (calculation?.cppContribution ?? 0))}
                  </span>
                  {cppPaidValue > 0 && totalCPPWithEmployment > maxCPPContribution && (
                    <span className="mt-2 text-xs text-muted-foreground italic">
                      Annual cap reached
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Percent className="h-5 w-5" />
                Total Tax Owed
              </CardTitle>
              <CardDescription>
                Combined federal, provincial, and CPP for 2024
                {regularIncomeValue > 0 && (
                  <span className="block mt-1 text-xs">
                    Including regular employment income: {formatCurrency(regularIncomeValue)}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Federal Tax</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(regularIncomeValue > 0 ? adjustedFederalTax : (calculation?.federalTax ?? 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provincial Tax</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(regularIncomeValue > 0 ? adjustedProvincialTax : (calculation?.provincialTax ?? 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CPP Contribution</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(regularIncomeValue > 0 || cppPaidValue > 0 
                        ? adjustedCPPAfterCap 
                        : (calculation?.cppContribution ?? 0))}
                    </span>
                  </div>
                  {taxesPaidValue > 0 && (
                    <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                      <span className="text-muted-foreground">Less: Taxes Already Paid</span>
                      <span className="font-mono font-medium">-{formatCurrency(taxesPaidValue)}</span>
                    </div>
                  )}
                  {cppPaidValue > 0 && (
                    <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                      <span className="text-muted-foreground">Less: CPP Already Paid</span>
                      <span className="font-mono font-medium">-{formatCurrency(cppPaidValue)}</span>
                    </div>
                  )}
                  {cppPaidValue > 0 && totalCPPWithEmployment > maxCPPContribution && (
                    <div className="flex items-center justify-between text-muted-foreground text-xs pt-1">
                      <span className="italic">Note: Annual CPP cap applied ({formatCurrency(maxCPPContribution)})</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Owed</span>
                    <span className="font-mono text-xl font-bold text-destructive" data-testid="stat-total-tax">
                      {formatCurrency(regularIncomeValue > 0 || taxesPaidValue > 0 || cppPaidValue > 0 
                        ? Math.max(0, adjustedTotalOwed) 
                        : (calculation?.totalOwed ?? 0))}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Effective Tax Rate</span>
                    <p className="font-mono text-4xl font-bold" data-testid="stat-effective-rate">
                      {formatPercent(regularIncomeValue > 0 ? adjustedEffectiveRate : effectiveRate)}
                    </p>
                  </div>
                  <Progress value={progressValue} className="h-3" />
                  <p className="text-center text-xs text-muted-foreground">
                    Based on net taxable income of {formatCurrency(regularIncomeValue > 0 ? combinedNetIncome : (calculation?.netIncome ?? 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
