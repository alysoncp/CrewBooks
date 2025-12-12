import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Calculator, DollarSign, Percent, TrendingDown, Building } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
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

export default function TaxCalculatorPage() {
  const { data, isLoading } = useQuery<TaxData>({
    queryKey: ["/api/tax-calculation"],
  });

  const calculation = data?.calculation;
  const user = data?.user;

  const effectiveRate = calculation?.effectiveTaxRate ?? 0;
  const progressValue = Math.min(effectiveRate, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-tax-title">Tax Calculator</h1>
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Federal Tax
                </CardTitle>
                <CardDescription>Canada Revenue Agency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.breakdown?.federalBrackets?.map((bracket, index, arr) => (
                  <TaxBracketRow
                    key={bracket.bracket}
                    bracket={bracket.bracket}
                    rate={bracket.rate}
                    tax={bracket.tax}
                    isLast={index === arr.length - 1}
                  />
                )) || (
                  <div className="space-y-3">
                    <TaxBracketRow bracket="$0 - $55,867" rate={15} tax={calculation?.federalTax ? calculation.federalTax * 0.3 : 0} />
                    <TaxBracketRow bracket="$55,867 - $111,733" rate={20.5} tax={calculation?.federalTax ? calculation.federalTax * 0.4 : 0} />
                    <TaxBracketRow bracket="$111,733 - $173,205" rate={26} tax={calculation?.federalTax ? calculation.federalTax * 0.2 : 0} isLast />
                  </div>
                )}
                <Separator />
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
                  {user?.province === "ON" ? "Ontario" : user?.province || "Ontario"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.breakdown?.provincialBrackets?.map((bracket, index, arr) => (
                  <TaxBracketRow
                    key={bracket.bracket}
                    bracket={bracket.bracket}
                    rate={bracket.rate}
                    tax={bracket.tax}
                    isLast={index === arr.length - 1}
                  />
                )) || (
                  <div className="space-y-3">
                    <TaxBracketRow bracket="$0 - $51,446" rate={5.05} tax={calculation?.provincialTax ? calculation.provincialTax * 0.35 : 0} />
                    <TaxBracketRow bracket="$51,446 - $102,894" rate={9.15} tax={calculation?.provincialTax ? calculation.provincialTax * 0.45 : 0} />
                    <TaxBracketRow bracket="$102,894 - $150,000" rate={11.16} tax={calculation?.provincialTax ? calculation.provincialTax * 0.2 : 0} isLast />
                  </div>
                )}
                <Separator />
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
                    {formatCurrency(calculation?.cppContribution ?? 0)}
                  </span>
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
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Federal Tax</span>
                    <span className="font-mono font-medium">{formatCurrency(calculation?.federalTax ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provincial Tax</span>
                    <span className="font-mono font-medium">{formatCurrency(calculation?.provincialTax ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CPP Contribution</span>
                    <span className="font-mono font-medium">{formatCurrency(calculation?.cppContribution ?? 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-mono text-xl font-bold text-destructive" data-testid="stat-total-tax">
                      {formatCurrency(calculation?.totalOwed ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-sm text-muted-foreground">Effective Tax Rate</span>
                    <p className="font-mono text-4xl font-bold" data-testid="stat-effective-rate">
                      {formatPercent(effectiveRate)}
                    </p>
                  </div>
                  <Progress value={progressValue} className="h-3" />
                  <p className="text-center text-xs text-muted-foreground">
                    Based on net taxable income of {formatCurrency(calculation?.netIncome ?? 0)}
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
