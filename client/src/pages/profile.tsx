import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { User, Building2, Crown, Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { 
  CANADIAN_PROVINCES, 
  PRICING_TIERS, 
  UNIONS,
  type User as UserType,
  type UnionAffiliation 
} from "@shared/schema";

const unionAffiliationSchema = z.object({
  unionId: z.string(),
  level: z.string(),
});

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  unionAffiliations: z.array(unionAffiliationSchema).nullable(),
  hasAgent: z.boolean(),
  agentName: z.string().optional().or(z.literal("")),
  agentCommission: z.string().optional().or(z.literal("")),
  hasGstNumber: z.boolean(),
  hasRegularEmployment: z.boolean(),
  hasHomeOffice: z.boolean(),
  homeOfficePercentage: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<UserType>({
    queryKey: ["/api/user/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Error handling
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading profile: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      unionAffiliations: [],
      hasAgent: false,
      agentName: "",
      agentCommission: "",
      hasGstNumber: false,
      hasRegularEmployment: false,
      hasHomeOffice: false,
      homeOfficePercentage: "",
    },
    values: user
      ? {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          unionAffiliations: (user.unionAffiliations as UnionAffiliation[]) || [],
          hasAgent: user.hasAgent || false,
          agentName: user.agentName || "",
          agentCommission: user.agentCommission || "",
          hasGstNumber: user.hasGstNumber || false,
          hasRegularEmployment: user.hasRegularEmployment || false,
          hasHomeOffice: user.hasHomeOffice || false,
          homeOfficePercentage: user.homeOfficePercentage ? user.homeOfficePercentage.toString() : "",
        }
      : undefined,
  });

  const watchedHasAgent = useWatch({ control: form.control, name: "hasAgent" });
  const watchedHasGstNumber = useWatch({ control: form.control, name: "hasGstNumber" });
  const watchedHasHomeOffice = useWatch({ control: form.control, name: "hasHomeOffice" });
  const watchedUnionAffiliations = useWatch({ control: form.control, name: "unionAffiliations" }) || [];
  const watchedAll = useWatch({ control: form.control });
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!user) return;
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    const handler = setTimeout(() => {
      (async () => {
        const isValid = await form.trigger();
        if (!isValid) return;
        const current = form.getValues();
        autosaveMutation.mutate({
          ...current,
          province: "BC",
        } as ProfileFormData & { province: string });
      })();
    }, 600);
    return () => clearTimeout(handler);
  }, [watchedAll, user]);
  
  

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/optimization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
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

  const autosaveMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/optimization"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate({
      ...data,
      province: "BC", // Hardcoded to British Columbia
    } as ProfileFormData & { province: string });
  };

  const toggleUnion = (unionId: string, checked: boolean) => {
    const current = watchedUnionAffiliations || [];
    if (checked) {
      const defaultLevel = UNIONS[unionId.toUpperCase() as keyof typeof UNIONS]?.levels[0] || "";
      form.setValue("unionAffiliations", [...current, { unionId, level: defaultLevel }]);
    } else {
      form.setValue("unionAffiliations", current.filter((u: UnionAffiliation) => u.unionId !== unionId));
    }
  };

  const updateUnionLevel = (unionId: string, level: string) => {
    const current = watchedUnionAffiliations || [];
    form.setValue(
      "unionAffiliations",
      current.map((u: UnionAffiliation) => (u.unionId === unionId ? { ...u, level } : u))
    );
  };

  const getUnionAffiliation = (unionId: string) => {
    return watchedUnionAffiliations?.find((u: UnionAffiliation) => u.unionId === unionId);
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

  const currentTier = user?.subscriptionTier || "basic";
  const tierInfo = PRICING_TIERS[currentTier as keyof typeof PRICING_TIERS];
  const isBasicTier = currentTier === "basic";
  const isPersonalTier = currentTier === "personal";
  const isCorporateTier = currentTier === "corporate";
  const hasPersonalFeatures = isPersonalTier || isCorporateTier;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-profile-title">Profile</h1>
        <p className="text-muted-foreground">Manage your account and industry settings</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="flex flex-row flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              {isCorporateTier ? (
                <Building2 className="h-5 w-5 text-primary" />
              ) : isPersonalTier ? (
                <User className="h-5 w-5 text-primary" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium" data-testid="text-current-tier">{tierInfo.name} Plan</span>
                {isCorporateTier && (
                  <Badge size="sm" variant="secondary">
                    <Crown className="mr-1 h-3 w-3" />
                    Premium
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tierInfo.price === 0 ? "Free forever" : `$${tierInfo.price}/month`}
              </p>
            </div>
          </div>
          <Link href="/pricing">
            <Button variant="outline" data-testid="button-manage-subscription">
              Manage Subscription
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="First name"
                          data-testid="input-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Last name"
                          data-testid="input-last-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Union Affiliations
              </CardTitle>
              <CardDescription>Select your union memberships and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="ubcp"
                      checked={!!getUnionAffiliation("ubcp")}
                      onCheckedChange={(checked) => toggleUnion("ubcp", !!checked)}
                      data-testid="checkbox-ubcp"
                    />
                    <label htmlFor="ubcp" className="font-medium cursor-pointer">UBCP</label>
                  </div>
                  {getUnionAffiliation("ubcp") && (
                    <Select
                      value={getUnionAffiliation("ubcp")?.level}
                      onValueChange={(value) => updateUnionLevel("ubcp", value)}
                    >
                      <SelectTrigger className="w-48" data-testid="select-ubcp-level">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apprentice">Apprentice</SelectItem>
                        <SelectItem value="full">Full Member</SelectItem>
                        <SelectItem value="background">Background</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="iatse"
                      checked={!!getUnionAffiliation("iatse")}
                      onCheckedChange={(checked) => toggleUnion("iatse", !!checked)}
                      data-testid="checkbox-iatse"
                    />
                    <label htmlFor="iatse" className="font-medium cursor-pointer">IATSE</label>
                  </div>
                  {getUnionAffiliation("iatse") && (
                    <Select
                      value={getUnionAffiliation("iatse")?.level}
                      onValueChange={(value) => updateUnionLevel("iatse", value)}
                    >
                      <SelectTrigger className="w-48" data-testid="select-iatse-level">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permittee">Permittee</SelectItem>
                        <SelectItem value="full">Full Member</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business & Tax Information
              </CardTitle>
              <CardDescription>Your business registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="hasGstNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">GST/HST Registration</FormLabel>
                      <FormDescription>
                        Are you registered to collect GST?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-has-gst-number"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Separator />
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="hasAgent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Representation</FormLabel>
                        <FormDescription>
                          Do you have an agent or manager?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-has-agent"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchedHasAgent && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="agentName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent/Manager Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Agent or agency name"
                              data-testid="input-agent-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agentCommission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission Rate (%)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type="number"
                                step="0.5"
                                min="0"
                                max="25"
                                placeholder="10"
                                className="pr-8"
                                data-testid="input-agent-commission"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                            </div>
                          </FormControl>
                          <FormDescription>Typically 10-15%</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
