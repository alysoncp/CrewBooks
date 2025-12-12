import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User, Check, Building2, Crown, Sparkles } from "lucide-react";
import { CANADIAN_PROVINCES, PRICING_TIERS, TAX_FILING_STATUS, type User as UserType } from "@shared/schema";

const profileFormSchema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  province: z.string().min(1, "Province is required"),
  taxFilingStatus: z.enum([TAX_FILING_STATUS.PERSONAL_ONLY, TAX_FILING_STATUS.PERSONAL_AND_CORPORATE]),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

function PricingCard({
  tier,
  isCurrentPlan,
  onSelect,
  isLoading,
}: {
  tier: typeof PRICING_TIERS.personal | typeof PRICING_TIERS.corporate;
  isCurrentPlan: boolean;
  onSelect: () => void;
  isLoading: boolean;
}) {
  const isCorporate = tier.id === "corporate";

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
          ) : (
            <User className="h-6 w-6" />
          )}
        </div>
        <CardTitle>{tier.name}</CardTitle>
        <CardDescription>{tier.description}</CardDescription>
        <div className="mt-4">
          <span className="font-mono text-4xl font-bold">${tier.price}</span>
          <span className="text-muted-foreground">/month</span>
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

export default function ProfilePage() {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/user/profile"],
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      province: "ON",
      taxFilingStatus: TAX_FILING_STATUS.PERSONAL_ONLY,
    },
    values: user
      ? {
          displayName: user.displayName || "",
          email: user.email || "",
          province: user.province || "ON",
          taxFilingStatus: (user.taxFilingStatus as typeof TAX_FILING_STATUS.PERSONAL_ONLY | typeof TAX_FILING_STATUS.PERSONAL_AND_CORPORATE) || TAX_FILING_STATUS.PERSONAL_ONLY,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/optimization"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (tier: string) => {
      return apiRequest("PATCH", "/api/user/subscription", { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
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

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-profile-title">Profile</h1>
        <p className="text-muted-foreground">Manage your account and tax settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Update your personal details and tax preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Your name"
                          data-testid="input-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="your@email.com"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province/Territory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-province">
                          <SelectValue placeholder="Select your province" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CANADIAN_PROVINCES.map((province) => (
                          <SelectItem key={province.code} value={province.code}>
                            {province.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used for provincial tax calculations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="taxFilingStatus"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-base">Tax Filing Status</FormLabel>
                    <FormDescription>
                      Select how you file your taxes. This affects which features are available.
                    </FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid gap-4 md:grid-cols-2"
                      >
                        <label
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            field.value === TAX_FILING_STATUS.PERSONAL_ONLY
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          }`}
                          data-testid="radio-personal-only"
                        >
                          <RadioGroupItem value={TAX_FILING_STATUS.PERSONAL_ONLY} className="mt-1" />
                          <div className="space-y-1">
                            <p className="font-medium">Personal Taxes Only</p>
                            <p className="text-sm text-muted-foreground">
                              I file as a sole proprietor or employee. I don't have a corporation.
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            field.value === TAX_FILING_STATUS.PERSONAL_AND_CORPORATE
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          }`}
                          data-testid="radio-personal-corporate"
                        >
                          <RadioGroupItem value={TAX_FILING_STATUS.PERSONAL_AND_CORPORATE} className="mt-1" />
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 font-medium">
                              Personal + Corporate Taxes
                              <Badge variant="secondary" size="sm">
                                <Building2 className="mr-1 h-3 w-3" />
                                Inc.
                              </Badge>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              I have an incorporated business and file both personal and corporate taxes.
                            </p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Subscription Plans</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PricingCard
            tier={PRICING_TIERS.personal}
            isCurrentPlan={user?.subscriptionTier === "personal"}
            onSelect={() => selectPlanMutation.mutate("personal")}
            isLoading={selectPlanMutation.isPending}
          />
          <PricingCard
            tier={PRICING_TIERS.corporate}
            isCurrentPlan={user?.subscriptionTier === "corporate"}
            onSelect={() => selectPlanMutation.mutate("corporate")}
            isLoading={selectPlanMutation.isPending}
          />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Sparkles className="mr-1 inline-block h-4 w-4" />
          All plans include a 14-day free trial. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
