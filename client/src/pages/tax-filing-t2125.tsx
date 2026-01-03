import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useTaxYear } from "@/components/tax-year-provider";
import type { T2125Summary } from "@shared/schema";
import { EXPENSE_CATEGORIES } from "@shared/schema";

// Map expense categories to T2125 line descriptions
const CATEGORY_LABELS: Record<string, string> = {
  home_office_expenses: "Home Office Expenses",
  motor_vehicle_expenses: "Motor Vehicle Expenses",
  advertising: "Advertising",
  business_taxes: "Business Taxes, Licenses, and Dues",
  commissions_agent_fees: "Commissions and Agent Fees",
  delivery_freight: "Delivery, Freight, and Express",
  fuel_costs: "Fuel Costs (other than vehicle)",
  insurance: "Insurance",
  licenses_memberships: "Licenses and Memberships",
  management_admin_fees: "Management and Administration Fees",
  meals_entertainment: "Meals and Entertainment (50% limit)",
  office_expenses: "Office Expenses",
  office_supplies: "Office Supplies",
  professional_fees: "Professional Fees",
  property_tax: "Property Taxes",
  rent: "Rent",
  repairs_maintenance: "Repairs and Maintenance",
  salaries_wages: "Salaries, Wages, and Benefits",
  training: "Training",
  travel_expenses: "Travel",
  utilities: "Utilities",
};

export default function TaxFilingT2125Page() {
  const { taxYear } = useTaxYear();

  const { data: summary, isLoading, isError } = useQuery<T2125Summary>({
    queryKey: ["/api/t2125-summary", taxYear],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">T2125 - Statement of Business or Professional Activities</h1>
          <p className="text-muted-foreground">
            Auto-populated form for {taxYear} tax year
          </p>
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">T2125 - Statement of Business or Professional Activities</h1>
          <p className="text-muted-foreground">
            Auto-populated form for {taxYear} tax year
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              Unable to load T2125 data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expenseEntries = Object.entries(summary.expensesByCategory)
    .filter(([_, amount]) => amount > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">T2125 - Statement of Business or Professional Activities</h1>
        <p className="text-muted-foreground">
          Auto-populated form for {taxYear} tax year
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Part 1 - Business Income
          </CardTitle>
          <CardDescription>
            Revenue and income from business or professional activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <span className="font-medium">Gross revenue or sales (before expenses)</span>
              <p className="text-sm text-muted-foreground">Line 8299</p>
            </div>
            <span className="font-mono text-lg font-semibold">
              {formatCurrency(summary.grossRevenue)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Part 2 - Business Expenses</CardTitle>
          <CardDescription>
            Deductible business expenses for {taxYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expenseEntries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No expenses recorded for this tax year
              </p>
            ) : (
              expenseEntries.map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">
                    {CATEGORY_LABELS[category] || category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <span className="font-mono font-medium">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))
            )}
            {summary.ccaDeduction > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-t-2 border-primary/20 mt-2 pt-2">
                <div>
                  <span className="font-medium">Capital Cost Allowance (CCA)</span>
                  <p className="text-sm text-muted-foreground">Line 9936</p>
                </div>
                <span className="font-mono font-semibold">
                  {formatCurrency(summary.ccaDeduction)}
                </span>
              </div>
            )}
            {summary.leaseExpenseDeduction > 0 && (
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <span className="font-medium">Lease Expenses</span>
                  <p className="text-sm text-muted-foreground">Line 8760</p>
                </div>
                <span className="font-mono font-semibold">
                  {formatCurrency(summary.leaseExpenseDeduction)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-3 border-t-2 border-primary/20 mt-2 pt-3">
              <span className="font-semibold">Total Expenses</span>
              <span className="font-mono text-lg font-semibold">
                {formatCurrency(summary.totalExpenses + summary.ccaDeduction + summary.leaseExpenseDeduction)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Net Income</CardTitle>
          <CardDescription>
            Business income after deducting all expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <span className="text-lg font-semibold">Net Business Income (Line 9369)</span>
            <span className="font-mono text-2xl font-bold text-primary">
              {formatCurrency(summary.netIncome)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • This form is auto-populated from your income, expense, asset, and lease records.
          </p>
          <p>
            • Meals and entertainment expenses are limited to 50% as per CRA regulations.
          </p>
          <p>
            • Home office expenses are calculated using your specified business use percentage.
          </p>
          <p>
            • Capital Cost Allowance (CCA) is calculated based on your asset purchases and CCA class rates.
          </p>
          <p>
            • Please review all amounts and consult with a tax professional before filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

