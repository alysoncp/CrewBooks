import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, DollarSign, Award, ArrowRight, Lock, Sparkles } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { DividendSalaryScenario, User } from "@shared/schema";
import { TAX_FILING_STATUS } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface OptimizationData {
  user: User;
  corporateIncome: number;
  scenarios: DividendSalaryScenario[];
  optimalScenario: DividendSalaryScenario;
}

function ScenarioCard({
  scenario,
  isOptimal,
  isSelected,
  onClick,
}: {
  scenario: DividendSalaryScenario;
  isOptimal: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const salaryPercent = Math.round(
    (scenario.salaryAmount / (scenario.salaryAmount + scenario.dividendAmount)) * 100
  );
  const dividendPercent = 100 - salaryPercent;

  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "hover-elevate"
      } ${isOptimal ? "border-green-500/50" : ""}`}
      onClick={onClick}
      data-testid={`card-scenario-${salaryPercent}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">
            {salaryPercent}% Salary / {dividendPercent}% Dividend
          </CardTitle>
          {isOptimal && (
            <Badge className="bg-green-600 text-white">
              <Award className="mr-1 h-3 w-3" />
              Optimal
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Salary</p>
            <p className="font-mono font-medium">{formatCurrency(scenario.salaryAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dividend</p>
            <p className="font-mono font-medium">{formatCurrency(scenario.dividendAmount)}</p>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Personal Tax</p>
            <p className="font-mono">{formatCurrency(scenario.personalTax)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Corporate Tax</p>
            <p className="font-mono">{formatCurrency(scenario.corporateTax)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPP</p>
            <p className="font-mono">{formatCurrency(scenario.cppContribution)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Tax</p>
            <p className="font-mono font-medium text-destructive">
              {formatCurrency(scenario.totalTax)}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-medium">After-Tax Income</span>
          <span className={`font-mono text-lg font-bold ${isOptimal ? "text-green-600 dark:text-green-400" : ""}`}>
            {formatCurrency(scenario.afterTaxIncome)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LockedContent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Lock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold">Dividend vs. Salary Optimization</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        This feature is available for users with incorporated businesses. Upgrade to the Personal + Corporate plan to access tax optimization tools.
      </p>
      <Link href="/profile">
        <Button className="mt-6" data-testid="button-upgrade">
          <Sparkles className="mr-2 h-4 w-4" />
          View Pricing Plans
        </Button>
      </Link>
    </div>
  );
}

export default function OptimizationPage() {
  const [selectedSalaryPercent, setSelectedSalaryPercent] = useState<number>(50);

  const { data, isLoading } = useQuery<OptimizationData>({
    queryKey: ["/api/optimization", selectedSalaryPercent],
  });

  const user = data?.user;
  const isIncorporated = user?.taxFilingStatus === TAX_FILING_STATUS.PERSONAL_AND_CORPORATE;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dividend vs. Salary Optimization</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isIncorporated) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-optimization-title">
            Dividend vs. Salary Optimization
          </h1>
          <p className="text-muted-foreground">
            Optimize your payment strategy between dividends and salary
          </p>
        </div>
        <LockedContent />
      </div>
    );
  }

  const corporateIncome = data?.corporateIncome ?? 100000;
  const scenarios = data?.scenarios ?? [];
  const optimalScenario = data?.optimalScenario;

  const selectedScenario = scenarios.find(
    (s) =>
      Math.round((s.salaryAmount / (s.salaryAmount + s.dividendAmount)) * 100) === selectedSalaryPercent
  ) || scenarios[Math.floor(scenarios.length / 2)];

  const savings = optimalScenario
    ? scenarios[0]?.afterTaxIncome
      ? optimalScenario.afterTaxIncome - scenarios[0].afterTaxIncome
      : 0
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-optimization-title">
          Dividend vs. Salary Optimization
        </h1>
        <p className="text-muted-foreground">
          Find the optimal payment strategy to minimize your total tax burden
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Optimization Summary
          </CardTitle>
          <CardDescription>
            Based on corporate income of {formatCurrency(corporateIncome)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Optimal Strategy</p>
              <p className="text-lg font-semibold" data-testid="text-optimal-strategy">
                {optimalScenario
                  ? `${Math.round(
                      (optimalScenario.salaryAmount /
                        (optimalScenario.salaryAmount + optimalScenario.dividendAmount)) *
                        100
                    )}% Salary / ${
                      100 -
                      Math.round(
                        (optimalScenario.salaryAmount /
                          (optimalScenario.salaryAmount + optimalScenario.dividendAmount)) *
                          100
                      )
                    }% Dividend`
                  : "Calculating..."}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Maximum After-Tax Income</p>
              <p className="font-mono text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-max-income">
                {formatCurrency(optimalScenario?.afterTaxIncome ?? 0)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Potential Savings vs. 100% Salary</p>
              <p className="font-mono text-2xl font-bold" data-testid="text-savings">
                {formatCurrency(Math.max(0, savings))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjust Payment Split</CardTitle>
          <CardDescription>
            Use the slider to explore different salary vs. dividend combinations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>100% Dividend</span>
              <span className="font-mono font-medium">
                {selectedSalaryPercent}% Salary / {100 - selectedSalaryPercent}% Dividend
              </span>
              <span>100% Salary</span>
            </div>
            <Slider
              value={[selectedSalaryPercent]}
              onValueChange={(value) => setSelectedSalaryPercent(value[0])}
              min={0}
              max={100}
              step={10}
              className="w-full"
              data-testid="slider-salary-percent"
            />
          </div>

          {selectedScenario && (
            <div className="rounded-lg border bg-muted/30 p-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Salary</p>
                  <p className="font-mono text-xl font-semibold">
                    {formatCurrency(selectedScenario.salaryAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Dividend</p>
                  <p className="font-mono text-xl font-semibold">
                    {formatCurrency(selectedScenario.dividendAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Tax</p>
                  <p className="font-mono text-xl font-semibold text-destructive">
                    {formatCurrency(selectedScenario.totalTax)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">After-Tax Income</p>
                  <p className="font-mono text-xl font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedScenario.afterTaxIncome)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Compare Scenarios</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => {
            const salaryPercent = Math.round(
              (scenario.salaryAmount / (scenario.salaryAmount + scenario.dividendAmount)) * 100
            );
            return (
              <ScenarioCard
                key={salaryPercent}
                scenario={scenario}
                isOptimal={scenario.isOptimal}
                isSelected={salaryPercent === selectedSalaryPercent}
                onClick={() => setSelectedSalaryPercent(salaryPercent)}
              />
            );
          })}
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">How This Optimization Works</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The optimizer calculates the total tax burden for different salary vs. dividend
                combinations. Salary payments reduce corporate tax but increase personal income
                tax and CPP contributions. Dividends are taxed at preferential rates but don't
                reduce corporate tax or count toward CPP. The optimal split balances these factors
                to maximize your after-tax income.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
