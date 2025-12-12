import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  FileText, 
  Building2, 
  DollarSign, 
  Users,
  Lock,
  Plus,
  Loader2,
  Receipt,
  Calculator,
  Percent
} from "lucide-react";
import { 
  T2_SECTIONS, 
  CANADIAN_PROVINCES,
  type User as UserType,
  type TaxQuestionnaire,
  type QuestionnaireResponse,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const STEP_ICONS: Record<string, typeof Building2> = {
  company_profile: Building2,
  shareholders: Users,
  income_streams: DollarSign,
  deductions_reserves: Receipt,
  schedule_adjustments: Calculator,
  gst_payroll: Percent,
  summary: FileText,
};

function LockedContent() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="mb-2 text-xl font-semibold">T2 Filing Requires Corporate Plan</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        Upgrade to the Corporate plan to access T2 corporate tax filing tools and 
        organize your corporate tax information.
      </p>
      <Link href="/pricing">
        <Button data-testid="button-upgrade-t2">View Plans</Button>
      </Link>
    </div>
  );
}

function QuestionnaireList({ 
  questionnaires, 
  onSelect, 
  onCreate,
  isCreating 
}: { 
  questionnaires: TaxQuestionnaire[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your T2 Corporate Tax Returns</h2>
          <p className="text-sm text-muted-foreground">Select an existing return or start a new one</p>
        </div>
        <Button onClick={onCreate} disabled={isCreating} data-testid="button-new-t2">
          {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          New Corporate Return
        </Button>
      </div>

      {questionnaires.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-medium">No corporate tax returns yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Start a new T2 corporate tax return to organize your business tax information
            </p>
            <Button onClick={onCreate} disabled={isCreating} data-testid="button-start-first-t2">
              Start Your First Corporate Return
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {questionnaires.map((q) => (
            <Card 
              key={q.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => onSelect(q.id)}
              data-testid={`card-questionnaire-${q.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Fiscal Year {q.taxYear}</CardTitle>
                  <Badge 
                    variant={q.status === "completed" ? "default" : "secondary"}
                    size="sm"
                  >
                    {q.status === "draft" ? "Draft" : 
                     q.status === "in_progress" ? "In Progress" : 
                     q.status === "completed" ? "Completed" : "Submitted"}
                  </Badge>
                </div>
                <CardDescription>
                  Last updated: {new Date(q.updatedAt || q.createdAt || "").toLocaleDateString()}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StepIndicator({ 
  sections, 
  currentStep, 
  completedSteps 
}: { 
  sections: typeof T2_SECTIONS;
  currentStep: string;
  completedSteps: Set<string>;
}) {
  const currentIndex = sections.findIndex(s => s.id === currentStep);
  const progress = ((currentIndex + 1) / sections.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Step {currentIndex + 1} of {sections.length}</span>
        <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="hidden gap-2 lg:flex">
        {sections.map((section, index) => {
          const Icon = STEP_ICONS[section.id] || FileText;
          const isActive = section.id === currentStep;
          const isCompleted = completedSteps.has(section.id);
          const isPast = index < currentIndex;

          return (
            <div 
              key={section.id}
              className={`flex flex-1 flex-col items-center gap-1 rounded-md p-2 text-center ${
                isActive ? "bg-primary/10" : ""
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isCompleted || isPast ? "bg-primary text-primary-foreground" : 
                isActive ? "border-2 border-primary text-primary" : 
                "border border-muted-foreground/30 text-muted-foreground"
              }`}>
                {isCompleted || isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                {section.name.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const companyProfileSchema = z.object({
  corporationName: z.string().min(1, "Corporation name is required"),
  businessNumber: z.string().optional(),
  incorporationDate: z.string().optional(),
  fiscalYearEnd: z.string().optional(),
  province: z.string().min(1, "Province is required"),
  businessType: z.string().optional(),
});

function CompanyProfileStep({ 
  user, 
  responses, 
  onSave 
}: { 
  user: UserType;
  responses: QuestionnaireResponse[];
  onSave: (sectionId: string, data: Record<string, any>) => void;
}) {
  const getResponse = (questionId: string) => {
    const response = responses.find(r => r.sectionId === "company_profile" && r.questionId === questionId);
    return response?.value;
  };

  const form = useForm({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      corporationName: (getResponse("corporationName") as string) || "",
      businessNumber: (getResponse("businessNumber") as string) || user.businessNumber || "",
      incorporationDate: (getResponse("incorporationDate") as string) || "",
      fiscalYearEnd: (getResponse("fiscalYearEnd") as string) || "",
      province: (getResponse("province") as string) || user.province || "ON",
      businessType: (getResponse("businessType") as string) || "personal_services",
    },
  });

  const onSubmit = (data: z.infer<typeof companyProfileSchema>) => {
    onSave("company_profile", data);
  };

  return (
    <Form {...form}>
      <form id="step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="corporationName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legal Corporation Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="ABC Productions Inc." data-testid="input-t2-corp-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="businessNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Number (BN)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="123456789RC0001" data-testid="input-t2-bn" />
              </FormControl>
              <FormDescription>Your 15-character CRA business number</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Province of Incorporation</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-t2-province">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CANADIAN_PROVINCES.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="businessType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-t2-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="personal_services">Personal Services Business (PSB)</SelectItem>
                    <SelectItem value="ccpc">Canadian-Controlled Private Corporation</SelectItem>
                    <SelectItem value="holding">Holding Company</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="incorporationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Incorporation</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-t2-inc-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fiscalYearEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fiscal Year End</FormLabel>
                <FormControl>
                  <Input {...field} type="date" data-testid="input-t2-fye" />
                </FormControl>
                <FormDescription>Usually December 31 or incorporation anniversary</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}

const incomeStreamsSchema = z.object({
  hasActiveBusinessIncome: z.boolean(),
  activeBusinessIncome: z.string().optional(),
  hasInvestmentIncome: z.boolean(),
  investmentIncome: z.string().optional(),
  hasDividendsReceived: z.boolean(),
  dividendsReceived: z.string().optional(),
});

function IncomeStreamsStep({ 
  responses, 
  onSave 
}: { 
  responses: QuestionnaireResponse[];
  onSave: (sectionId: string, data: Record<string, any>) => void;
}) {
  const getResponse = (questionId: string) => {
    const response = responses.find(r => r.sectionId === "income_streams" && r.questionId === questionId);
    return response?.value;
  };

  const form = useForm({
    resolver: zodResolver(incomeStreamsSchema),
    defaultValues: {
      hasActiveBusinessIncome: (getResponse("hasActiveBusinessIncome") as boolean) || true,
      activeBusinessIncome: (getResponse("activeBusinessIncome") as string) || "",
      hasInvestmentIncome: (getResponse("hasInvestmentIncome") as boolean) || false,
      investmentIncome: (getResponse("investmentIncome") as string) || "",
      hasDividendsReceived: (getResponse("hasDividendsReceived") as boolean) || false,
      dividendsReceived: (getResponse("dividendsReceived") as string) || "",
    },
  });

  const watchHasActive = form.watch("hasActiveBusinessIncome");
  const watchHasInvestment = form.watch("hasInvestmentIncome");
  const watchHasDividends = form.watch("hasDividendsReceived");

  const onSubmit = (data: z.infer<typeof incomeStreamsSchema>) => {
    onSave("income_streams", data);
  };

  return (
    <Form {...form}>
      <form id="step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Active Business Income</CardTitle>
              <FormField
                control={form.control}
                name="hasActiveBusinessIncome"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t2-has-active"
                  />
                )}
              />
            </div>
            <CardDescription>Revenue from providing services or selling goods</CardDescription>
          </CardHeader>
          {watchHasActive && (
            <CardContent>
              <FormField
                control={form.control}
                name="activeBusinessIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Active Business Income</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t2-active-income" />
                    </FormControl>
                    <FormDescription>Gross revenue before expenses</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Investment Income</CardTitle>
              <FormField
                control={form.control}
                name="hasInvestmentIncome"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t2-has-investment"
                  />
                )}
              />
            </div>
            <CardDescription>Interest, capital gains, and passive income</CardDescription>
          </CardHeader>
          {watchHasInvestment && (
            <CardContent>
              <FormField
                control={form.control}
                name="investmentIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Investment Income</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t2-investment" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Dividends Received</CardTitle>
              <FormField
                control={form.control}
                name="hasDividendsReceived"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t2-has-dividends"
                  />
                )}
              />
            </div>
            <CardDescription>Dividends received from other corporations</CardDescription>
          </CardHeader>
          {watchHasDividends && (
            <CardContent>
              <FormField
                control={form.control}
                name="dividendsReceived"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Dividends Received</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t2-dividends" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          )}
        </Card>
      </form>
    </Form>
  );
}

function PlaceholderStep({ 
  sectionName, 
  onSave 
}: { 
  sectionName: string;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 font-medium">{sectionName}</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        This section will be completed in a future update
      </p>
      <Button onClick={onSave} data-testid="button-t2-continue">
        Continue to Next Step
      </Button>
    </div>
  );
}

function SummaryStep({ 
  responses 
}: { 
  responses: QuestionnaireResponse[];
}) {
  const getResponse = (sectionId: string, questionId: string): string => {
    const response = responses.find(r => r.sectionId === sectionId && r.questionId === questionId);
    return response?.value ? String(response.value) : "";
  };

  const hasActiveIncome = responses.find(r => r.sectionId === "income_streams" && r.questionId === "hasActiveBusinessIncome")?.value === true;
  const hasInvestmentIncome = responses.find(r => r.sectionId === "income_streams" && r.questionId === "hasInvestmentIncome")?.value === true;
  const hasDividends = responses.find(r => r.sectionId === "income_streams" && r.questionId === "hasDividendsReceived")?.value === true;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corporation Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Corporation Name</span>
            <span>{getResponse("company_profile", "corporationName") || "Not set"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Business Number</span>
            <span>{getResponse("company_profile", "businessNumber") || "Not set"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Province</span>
            <span>{getResponse("company_profile", "province") || "Not set"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corporate Income Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {hasActiveIncome && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Business Income</span>
              <span>${getResponse("income_streams", "activeBusinessIncome") || "0.00"}</span>
            </div>
          )}
          {hasInvestmentIncome && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Investment Income</span>
              <span>${getResponse("income_streams", "investmentIncome") || "0.00"}</span>
            </div>
          )}
          {hasDividends && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dividends Received</span>
              <span>${getResponse("income_streams", "dividendsReceived") || "0.00"}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-6 text-center">
          <Check className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="font-medium">Your T2 corporate information is saved</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You can return anytime to complete additional sections
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TaxFilingT2Page() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const isCorporateTier = user?.subscriptionTier === "corporate";

  const { data: questionnaires, isLoading: loadingList } = useQuery<TaxQuestionnaire[]>({
    queryKey: ["/api/questionnaires"],
    enabled: isCorporateTier,
  });

  const t2Questionnaires = questionnaires?.filter(q => q.questionnaireType === "t2") || [];

  const { data: questionnaireData, isLoading: loadingQuestionnaire } = useQuery<{
    questionnaire: TaxQuestionnaire;
    responses: QuestionnaireResponse[];
  }>({
    queryKey: ["/api/questionnaires", selectedQuestionnaireId],
    enabled: !!selectedQuestionnaireId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/questionnaires", {
        questionnaireType: "t2",
        taxYear: new Date().getFullYear().toString(),
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      setSelectedQuestionnaireId(data.id);
      toast({
        title: "Corporate return created",
        description: "Your new T2 corporate tax return has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create corporate return. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveResponseMutation = useMutation({
    mutationFn: async ({ sectionId, questionId, value }: { sectionId: string; questionId: string; value: any }) => {
      return apiRequest("POST", `/api/questionnaires/${selectedQuestionnaireId}/responses`, {
        sectionId,
        questionId,
        value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires", selectedQuestionnaireId] });
    },
  });

  const updateQuestionnaireMutation = useMutation({
    mutationFn: async (data: Partial<TaxQuestionnaire>) => {
      return apiRequest("PATCH", `/api/questionnaires/${selectedQuestionnaireId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires", selectedQuestionnaireId] });
    },
  });

  const handleSaveSection = async (sectionId: string, data: Record<string, any>) => {
    for (const [questionId, value] of Object.entries(data)) {
      await saveResponseMutation.mutateAsync({ sectionId, questionId, value });
    }
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(sectionId)));
    
    if (currentStep < T2_SECTIONS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await updateQuestionnaireMutation.mutateAsync({ 
        currentStep: T2_SECTIONS[nextStep].id,
        status: "in_progress" 
      });
    } else {
      await updateQuestionnaireMutation.mutateAsync({ status: "completed" });
      toast({
        title: "Corporate return completed",
        description: "Your T2 information has been saved.",
      });
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNextStep = () => {
    const formElement = document.getElementById("step-form") as HTMLFormElement;
    if (formElement) {
      formElement.requestSubmit();
    } else {
      handleSaveSection(T2_SECTIONS[currentStep].id, {});
    }
  };

  useEffect(() => {
    if (questionnaireData?.questionnaire) {
      const stepIndex = T2_SECTIONS.findIndex(s => s.id === questionnaireData.questionnaire.currentStep);
      if (stepIndex >= 0) {
        setCurrentStep(stepIndex);
      }
      
      // Hydrate completed steps from stored responses
      if (questionnaireData.responses && questionnaireData.responses.length > 0) {
        const sectionsWithResponses = new Set(
          questionnaireData.responses.map(r => r.sectionId)
        );
        setCompletedSteps(sectionsWithResponses);
      }
    }
  }, [questionnaireData]);

  if (!isCorporateTier) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t2-title">T2 Corporate Tax Filing</h1>
          <p className="text-muted-foreground">Organize your corporate income tax information</p>
        </div>
        <LockedContent />
      </div>
    );
  }

  if (loadingList) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">T2 Corporate Tax Filing</h1>
          <p className="text-muted-foreground">Organize your corporate income tax information</p>
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedQuestionnaireId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t2-title">T2 Corporate Tax Filing</h1>
          <p className="text-muted-foreground">Organize your corporate income tax information</p>
        </div>
        <QuestionnaireList 
          questionnaires={t2Questionnaires}
          onSelect={setSelectedQuestionnaireId}
          onCreate={() => createMutation.mutate()}
          isCreating={createMutation.isPending}
        />
      </div>
    );
  }

  if (loadingQuestionnaire) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const currentSection = T2_SECTIONS[currentStep];
  const responses = questionnaireData?.responses || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedQuestionnaireId(null)}
          data-testid="button-back-t2-list"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t2-title">
            T2 Corporate Return - {questionnaireData?.questionnaire.taxYear}
          </h1>
          <p className="text-muted-foreground">{currentSection.description}</p>
        </div>
      </div>

      <StepIndicator 
        sections={T2_SECTIONS} 
        currentStep={currentSection.id}
        completedSteps={completedSteps}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const Icon = STEP_ICONS[currentSection.id] || FileText;
              return <Icon className="h-5 w-5" />;
            })()}
            {currentSection.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentSection.id === "company_profile" && user && (
            <CompanyProfileStep 
              user={user} 
              responses={responses}
              onSave={handleSaveSection}
            />
          )}
          {currentSection.id === "shareholders" && (
            <PlaceholderStep 
              sectionName="Shareholders & Officers"
              onSave={() => handleSaveSection("shareholders", {})}
            />
          )}
          {currentSection.id === "income_streams" && (
            <IncomeStreamsStep 
              responses={responses}
              onSave={handleSaveSection}
            />
          )}
          {currentSection.id === "deductions_reserves" && (
            <PlaceholderStep 
              sectionName="Deductions & Reserves"
              onSave={() => handleSaveSection("deductions_reserves", {})}
            />
          )}
          {currentSection.id === "schedule_adjustments" && (
            <PlaceholderStep 
              sectionName="Schedule 1 Adjustments"
              onSave={() => handleSaveSection("schedule_adjustments", {})}
            />
          )}
          {currentSection.id === "gst_payroll" && (
            <PlaceholderStep 
              sectionName="GST/HST & Payroll"
              onSave={() => handleSaveSection("gst_payroll", {})}
            />
          )}
          {currentSection.id === "summary" && (
            <SummaryStep responses={responses} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-4">
        <Button 
          variant="outline" 
          onClick={handlePreviousStep}
          disabled={currentStep === 0}
          data-testid="button-t2-previous"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {currentStep < T2_SECTIONS.length - 1 ? (
          <Button 
            onClick={handleNextStep}
            disabled={saveResponseMutation.isPending}
            data-testid="button-t2-next"
          >
            {saveResponseMutation.isPending ? "Saving..." : "Save & Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button 
            onClick={() => setSelectedQuestionnaireId(null)}
            data-testid="button-t2-finish"
          >
            <Check className="mr-2 h-4 w-4" />
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
