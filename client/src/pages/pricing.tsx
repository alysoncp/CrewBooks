import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User, Check, Building2, Crown, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PRICING_TIERS, type User as UserType } from "@shared/schema";

function PricingCard({
  tier,
  isCurrentPlan,
  onSelect,
  isLoading,
}: {
  tier: typeof PRICING_TIERS.basic | typeof PRICING_TIERS.personal | typeof PRICING_TIERS.corporate;
  isCurrentPlan: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const isCorporate = tier.id === "corporate";
  const isBasic = tier.id === "basic";

  return (
    <Card className={`relative ${isCurrentPlan ? "border-primary ring-2 ring-primary/20" : ""}`}>
      {isCorporate && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary">
            <Crown className="mr-1 h-3 w-3" />
            Most Features
          </Badge>
        </div>
      )}
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {isCorporate ? (
            <Building2 className="h-6 w-6" />
          ) : isBasic ? (
            <Sparkles className="h-6 w-6" />
          ) : (
            <User className="h-6 w-6" />
          )}
        </div>
        <CardTitle>{tier.name}</CardTitle>
        <CardDescription>{tier.description}</CardDescription>
        <div className="mt-4">
          {tier.price === 0 ? (
            <span className="font-mono text-4xl font-bold">Free</span>
          ) : (
            <>
              <span className="font-mono text-4xl font-bold">${tier.price}</span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {tier.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrentPlan ? "outline" : "default"}
          disabled={isCurrentPlan || isLoading}
          onClick={onSelect}
          data-testid={`button-select-${tier.id}`}
        >
          {isCurrentPlan ? "Current Plan" : "Select Plan"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function PricingPage() {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/user/profile"],
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (tier: string) => {
      return apiRequest("PATCH", "/api/user/subscription", { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Plan updated",
        description: "Your subscription has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Subscription Plans</h1>
          <p className="text-muted-foreground">Choose the right plan for your needs</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const currentTier = user?.subscriptionTier || "basic";
  const tierInfo = PRICING_TIERS[currentTier as keyof typeof PRICING_TIERS];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon" data-testid="button-back-profile">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-pricing-title">Subscription Plans</h1>
          <p className="text-muted-foreground">Choose the right plan for your needs</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="flex flex-row flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              {currentTier === "corporate" ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : currentTier === "personal" ? (
                <User className="h-5 w-5 text-primary" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <span className="font-medium" data-testid="text-current-plan">
                Currently on {tierInfo.name} Plan
              </span>
              <p className="text-sm text-muted-foreground">
                {tierInfo.price === 0 ? "Free forever" : `$${tierInfo.price}/month`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <PricingCard
          tier={PRICING_TIERS.basic}
          isCurrentPlan={currentTier === "basic"}
          onSelect={() => selectPlanMutation.mutate("basic")}
          isLoading={selectPlanMutation.isPending}
        />
        <PricingCard
          tier={PRICING_TIERS.personal}
          isCurrentPlan={currentTier === "personal"}
          onSelect={() => selectPlanMutation.mutate("personal")}
          isLoading={selectPlanMutation.isPending}
        />
        <PricingCard
          tier={PRICING_TIERS.corporate}
          isCurrentPlan={currentTier === "corporate"}
          onSelect={() => selectPlanMutation.mutate("corporate")}
          isLoading={selectPlanMutation.isPending}
        />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Sparkles className="mr-1 inline-block h-4 w-4" />
        Paid plans include a 14-day free trial. Cancel anytime.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <CardDescription>See what's included in each plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium">Feature</th>
                  <th className="pb-3 text-center font-medium">Basic</th>
                  <th className="pb-3 text-center font-medium">Personal</th>
                  <th className="pb-3 text-center font-medium">Corporate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3">Income & Expense Tracking</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">Receipt Photo Uploads</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">GST/HST Tracking</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">Personal Tax Calculator</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">CPP Contribution Tracking</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">T1 Tax Filing Questionnaire</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">Corporate Tax Calculations</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">Dividend vs. Salary Optimizer</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
                <tr>
                  <td className="py-3">T2 Corporate Tax Questionnaire</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center text-muted-foreground">-</td>
                  <td className="py-3 text-center"><Check className="mx-auto h-4 w-4 text-green-600" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
