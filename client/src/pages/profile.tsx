import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { User, Check, Building2, Crown, Sparkles, Briefcase, Camera, Users } from "lucide-react";
import { 
  CANADIAN_PROVINCES, 
  PRICING_TIERS, 
  TAX_FILING_STATUS, 
  USER_TYPES,
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
  province: z.string().min(1, "Province is required"),
  taxFilingStatus: z.enum([TAX_FILING_STATUS.PERSONAL_ONLY, TAX_FILING_STATUS.PERSONAL_AND_CORPORATE]),
  userType: z.enum([USER_TYPES.PERFORMER, USER_TYPES.CREW, USER_TYPES.BOTH]).nullable(),
  unionAffiliations: z.array(unionAffiliationSchema).nullable(),
  hasAgent: z.boolean(),
  agentName: z.string().optional().or(z.literal("")),
  agentCommission: z.string().optional().or(z.literal("")),
  hasBusinessNumber: z.boolean(),
  businessNumber: z.string().optional().or(z.literal("")),
  hasGstNumber: z.boolean(),
  gstNumber: z.string().optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

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

export default function ProfilePage() {
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/user/profile"],
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      province: "ON",
      taxFilingStatus: TAX_FILING_STATUS.PERSONAL_ONLY,
      userType: null,
      unionAffiliations: [],
      hasAgent: false,
      agentName: "",
      agentCommission: "",
      hasBusinessNumber: false,
      businessNumber: "",
      hasGstNumber: false,
      gstNumber: "",
    },
    values: user
      ? {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          province: user.province || "ON",
          taxFilingStatus: (user.taxFilingStatus as typeof TAX_FILING_STATUS.PERSONAL_ONLY | typeof TAX_FILING_STATUS.PERSONAL_AND_CORPORATE) || TAX_FILING_STATUS.PERSONAL_ONLY,
          userType: (user.userType as typeof USER_TYPES.PERFORMER | typeof USER_TYPES.CREW | typeof USER_TYPES.BOTH) || null,
          unionAffiliations: (user.unionAffiliations as UnionAffiliation[]) || [],
          hasAgent: user.hasAgent || false,
          agentName: user.agentName || "",
          agentCommission: user.agentCommission || "",
          hasBusinessNumber: user.hasBusinessNumber || false,
          businessNumber: user.businessNumber || "",
          hasGstNumber: user.hasGstNumber || false,
          gstNumber: user.gstNumber || "",
        }
      : undefined,
  });

  const watchedUserType = useWatch({ control: form.control, name: "userType" });
  const watchedHasAgent = useWatch({ control: form.control, name: "hasAgent" });
  const watchedHasBusinessNumber = useWatch({ control: form.control, name: "hasBusinessNumber" });
  const watchedHasGstNumber = useWatch({ control: form.control, name: "hasGstNumber" });
  const watchedUnionAffiliations = useWatch({ control: form.control, name: "unionAffiliations" }) || [];

  const isPerformer = watchedUserType === USER_TYPES.PERFORMER || watchedUserType === USER_TYPES.BOTH;
  const isCrew = watchedUserType === USER_TYPES.CREW || watchedUserType === USER_TYPES.BOTH;

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

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-profile-title">Profile</h1>
        <p className="text-muted-foreground">Manage your account and industry settings</p>
      </div>

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
                    <FormDescription>Used for provincial tax calculations</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Industry Role
              </CardTitle>
              <CardDescription>Tell us about your role in the film and television industry</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="userType"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-base">What type of work do you do?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        className="grid gap-4 md:grid-cols-3"
                      >
                        <label
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            field.value === USER_TYPES.PERFORMER
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          }`}
                          data-testid="radio-performer"
                        >
                          <RadioGroupItem value={USER_TYPES.PERFORMER} className="mt-1" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Camera className="h-4 w-4" />
                              <p className="font-medium">Performer</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Actor, background, stunt, etc.
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            field.value === USER_TYPES.CREW
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          }`}
                          data-testid="radio-crew"
                        >
                          <RadioGroupItem value={USER_TYPES.CREW} className="mt-1" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <p className="font-medium">Crew</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Camera, grips, electric, etc.
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                            field.value === USER_TYPES.BOTH
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/50"
                          }`}
                          data-testid="radio-both"
                        >
                          <RadioGroupItem value={USER_TYPES.BOTH} className="mt-1" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Camera className="h-4 w-4" />
                              <Users className="h-4 w-4" />
                              <p className="font-medium">Both</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              I do both performer and crew work
                            </p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedUserType && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <FormLabel className="text-base">Union Affiliations</FormLabel>
                    <FormDescription>Select your union memberships and status</FormDescription>
                    
                    <div className="space-y-4">
                      {isPerformer && (
                        <>
                          <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id="actra"
                                checked={!!getUnionAffiliation("actra")}
                                onCheckedChange={(checked) => toggleUnion("actra", !!checked)}
                                data-testid="checkbox-actra"
                              />
                              <label htmlFor="actra" className="font-medium cursor-pointer">ACTRA</label>
                            </div>
                            {getUnionAffiliation("actra") && (
                              <Select
                                value={getUnionAffiliation("actra")?.level}
                                onValueChange={(value) => updateUnionLevel("actra", value)}
                              >
                                <SelectTrigger className="w-48" data-testid="select-actra-level">
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
                        </>
                      )}

                      {isCrew && (
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
                      )}
                    </div>
                  </div>

                  {isPerformer && (
                    <>
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
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business & Tax Information
              </CardTitle>
              <CardDescription>Your tax filing status and business registration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                              I file as a sole proprietor or employee
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
                            <span className="flex items-center gap-2 font-medium">
                              Personal + Corporate
                              <Badge variant="secondary">Inc.</Badge>
                            </span>
                            <p className="text-sm text-muted-foreground">
                              I have an incorporated business
                            </p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="hasBusinessNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Business Number (BN)</FormLabel>
                      <FormDescription>
                        Do you have a CRA Business Number?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-has-business-number"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {watchedHasBusinessNumber && (
                <FormField
                  control={form.control}
                  name="businessNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="123456789RC0001"
                          data-testid="input-business-number"
                        />
                      </FormControl>
                      <FormDescription>Your 15-character CRA Business Number</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="hasGstNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">GST/HST Registration</FormLabel>
                      <FormDescription>
                        Are you registered for GST/HST?
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

              {watchedHasGstNumber && (
                <FormField
                  control={form.control}
                  name="gstNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST/HST Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="123456789RT0001"
                          data-testid="input-gst-number"
                        />
                      </FormControl>
                      <FormDescription>Your GST/HST registration number (enables GST/HST tracking)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Form>

      <Separator />

      <div>
        <h2 className="mb-4 text-lg font-semibold">Subscription Plans</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <PricingCard
            tier={PRICING_TIERS.basic}
            isCurrentPlan={user?.subscriptionTier === "basic" || !user?.subscriptionTier}
            onSelect={() => selectPlanMutation.mutate("basic")}
            isLoading={selectPlanMutation.isPending}
          />
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
          Paid plans include a 14-day free trial. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
