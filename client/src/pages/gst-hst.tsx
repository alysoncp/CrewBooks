import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, TrendingUp, TrendingDown, Receipt, AlertCircle, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { GstHstSummary } from "@shared/schema";

export default function GstHstPage() {
  const { user, isLoading: authLoading } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;

  const { data: gstHstData, isLoading, error } = useQuery<GstHstSummary>({
    queryKey: ["/api/gst-hst"],
    enabled: hasGstNumber,
  });

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!hasGstNumber) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-gst-hst-title">GST/HST Tracking</h1>
          <p className="text-muted-foreground">Track sales tax collected and input tax credits</p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">GST/HST Registration Required</h3>
            <p className="mt-2 max-w-sm text-muted-foreground">
              To access GST/HST tracking, add your GST/HST registration number in your profile settings.
            </p>
            <Link href="/profile">
              <Button className="mt-6" data-testid="button-add-gst-number">
                Add GST Number
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-gst-hst-title">GST/HST Tracking</h1>
        <p className="text-muted-foreground">Track sales tax collected and input tax credits</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load GST/HST data. Please try again.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">GST/HST Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="stat-gst-collected">
                  {formatCurrency(gstHstData?.gstHstCollected || 0)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tax collected on invoiced services
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Input Tax Credits (ITCs)</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="stat-itc">
                  {formatCurrency(gstHstData?.inputTaxCredits || 0)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  GST/HST paid on business expenses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Net GST/HST Owing</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div 
                  className={`font-mono text-2xl font-semibold ${
                    (gstHstData?.netGstHstOwing || 0) >= 0 
                      ? "text-red-600 dark:text-red-400" 
                      : "text-green-600 dark:text-green-400"
                  }`}
                  data-testid="stat-net-gst"
                >
                  {(gstHstData?.netGstHstOwing || 0) >= 0 ? "" : "-"}
                  {formatCurrency(Math.abs(gstHstData?.netGstHstOwing || 0))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(gstHstData?.netGstHstOwing || 0) >= 0 
                    ? "Amount owing to CRA" 
                    : "Refund expected from CRA"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>GST/HST Summary</CardTitle>
              <CardDescription>Overview of your sales tax obligations for the current year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Transactions with GST/HST</p>
                    <p className="text-sm text-muted-foreground">Income and expense entries with sales tax recorded</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-lg font-mono" data-testid="stat-transactions-count">
                  {gstHstData?.transactionsWithGstHst || 0}
                </Badge>
              </div>

              {(gstHstData?.transactionsWithGstHst || 0) === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No GST/HST recorded yet</AlertTitle>
                  <AlertDescription>
                    Start tracking GST/HST by entering the tax amounts when you add income or expenses.
                    Look for the GST/HST field in the income and expense forms.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="font-medium mb-2">How it works</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>1. When you invoice clients, enter the GST/HST amount you collected on each income entry.</li>
                  <li>2. When you pay for business expenses, enter the GST/HST you paid to claim as Input Tax Credits (ITCs).</li>
                  <li>3. Your Net GST/HST Owing is calculated as: Collected - ITCs</li>
                  <li>4. File your GST/HST return quarterly or annually depending on your registration.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
