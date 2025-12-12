import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
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
  User, 
  DollarSign, 
  Receipt, 
  Briefcase,
  Lock,
  Plus,
  Loader2
} from "lucide-react";
import { 
  T1_SECTIONS, 
  CANADIAN_PROVINCES,
  TAX_FILING_STATUS,
  type User as UserType,
  type TaxQuestionnaire,
  type QuestionnaireResponse,
} from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const STEP_ICONS: Record<string, typeof User> = {
  personal_info: User,
  income_sources: DollarSign,
  deductions: Receipt,
  expenses: Briefcase,
  summary: FileText,
};

function LockedContent() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
      <h2 className="mb-2 text-xl font-semibold">Tax Filing Requires Personal Plan</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        Upgrade to Personal or Corporate plan to access the T1 tax filing questionnaire and 
        organize your tax information for filing.
      </p>
      <Link href="/pricing">
        <Button data-testid="button-upgrade-t1">View Plans</Button>
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
          <h2 className="text-lg font-semibold">Your T1 Personal Tax Returns</h2>
          <p className="text-sm text-muted-foreground">Select an existing return or start a new one</p>
        </div>
        <Button onClick={onCreate} disabled={isCreating} data-testid="button-new-t1">
          {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          New Tax Return
        </Button>
      </div>

      {questionnaires.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-medium">No tax returns yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Start a new T1 personal tax return to organize your tax information
            </p>
            <Button onClick={onCreate} disabled={isCreating} data-testid="button-start-first-t1">
              Start Your First Return
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
                  <CardTitle className="text-base">Tax Year {q.taxYear}</CardTitle>
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
  sections: typeof T1_SECTIONS;
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
      <div className="hidden gap-2 sm:flex">
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

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  sinNumber: z.string().optional(),
  province: z.string().min(1, "Province is required"),
  dateOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(),
});

function PersonalInfoStep({ 
  user, 
  responses, 
  onSave 
}: { 
  user: UserType;
  responses: QuestionnaireResponse[];
  onSave: (sectionId: string, data: Record<string, any>) => void;
}) {
  const getResponse = (questionId: string) => {
    const response = responses.find(r => r.sectionId === "personal_info" && r.questionId === questionId);
    return response?.value;
  };

  const form = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: (getResponse("firstName") as string) || user.firstName || "",
      lastName: (getResponse("lastName") as string) || user.lastName || "",
      sinNumber: (getResponse("sinNumber") as string) || "",
      province: (getResponse("province") as string) || user.province || "ON",
      dateOfBirth: (getResponse("dateOfBirth") as string) || "",
      maritalStatus: (getResponse("maritalStatus") as string) || "",
    },
  });

  const onSubmit = (data: z.infer<typeof personalInfoSchema>) => {
    onSave("personal_info", data);
  };

  return (
    <Form {...form}>
      <form id="step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Legal First Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="First name" data-testid="input-t1-first-name" />
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
                <FormLabel>Legal Last Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Last name" data-testid="input-t1-last-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="sinNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Social Insurance Number (SIN)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="XXX-XXX-XXX" maxLength={11} data-testid="input-t1-sin" />
              </FormControl>
              <FormDescription>Your 9-digit SIN (optional for draft)</FormDescription>
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
                <FormLabel>Province/Territory</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-t1-province">
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
            name="maritalStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marital Status (Dec 31)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-t1-marital">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="common_law">Common-law</SelectItem>
                    <SelectItem value="separated">Separated</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date of Birth</FormLabel>
              <FormControl>
                <Input {...field} type="date" data-testid="input-t1-dob" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

const incomeSourcesSchema = z.object({
  hasT4Income: z.boolean(),
  t4Amount: z.string().optional(),
  hasSelfEmployment: z.boolean(),
  selfEmploymentIncome: z.string().optional(),
  hasOtherIncome: z.boolean(),
  otherIncomeAmount: z.string().optional(),
  otherIncomeType: z.string().optional(),
});

function IncomeSourcesStep({ 
  responses, 
  onSave 
}: { 
  responses: QuestionnaireResponse[];
  onSave: (sectionId: string, data: Record<string, any>) => void;
}) {
  const getResponse = (questionId: string) => {
    const response = responses.find(r => r.sectionId === "income_sources" && r.questionId === questionId);
    return response?.value;
  };

  const form = useForm({
    resolver: zodResolver(incomeSourcesSchema),
    defaultValues: {
      hasT4Income: (getResponse("hasT4Income") as boolean) || false,
      t4Amount: (getResponse("t4Amount") as string) || "",
      hasSelfEmployment: (getResponse("hasSelfEmployment") as boolean) || true,
      selfEmploymentIncome: (getResponse("selfEmploymentIncome") as string) || "",
      hasOtherIncome: (getResponse("hasOtherIncome") as boolean) || false,
      otherIncomeAmount: (getResponse("otherIncomeAmount") as string) || "",
      otherIncomeType: (getResponse("otherIncomeType") as string) || "",
    },
  });

  const watchHasT4 = form.watch("hasT4Income");
  const watchHasSelfEmployment = form.watch("hasSelfEmployment");
  const watchHasOther = form.watch("hasOtherIncome");

  const onSubmit = (data: z.infer<typeof incomeSourcesSchema>) => {
    onSave("income_sources", data);
  };

  return (
    <Form {...form}>
      <form id="step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">T4 Employment Income</CardTitle>
              <FormField
                control={form.control}
                name="hasT4Income"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t1-has-t4"
                  />
                )}
              />
            </div>
            <CardDescription>Regular employment income with taxes deducted</CardDescription>
          </CardHeader>
          {watchHasT4 && (
            <CardContent>
              <FormField
                control={form.control}
                name="t4Amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total T4 Income</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t1-t4-amount" />
                    </FormControl>
                    <FormDescription>Sum of Box 14 from all T4 slips</FormDescription>
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
              <CardTitle className="text-base">Self-Employment Income</CardTitle>
              <FormField
                control={form.control}
                name="hasSelfEmployment"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t1-has-self-emp"
                  />
                )}
              />
            </div>
            <CardDescription>Income from freelance, contract, or business activities</CardDescription>
          </CardHeader>
          {watchHasSelfEmployment && (
            <CardContent>
              <FormField
                control={form.control}
                name="selfEmploymentIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gross Self-Employment Income</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t1-self-emp" />
                    </FormControl>
                    <FormDescription>Your tracked income from CrewBooks will be auto-populated</FormDescription>
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
              <CardTitle className="text-base">Other Income</CardTitle>
              <FormField
                control={form.control}
                name="hasOtherIncome"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-t1-has-other"
                  />
                )}
              />
            </div>
            <CardDescription>Interest, dividends, rental, or other income</CardDescription>
          </CardHeader>
          {watchHasOther && (
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="otherIncomeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of Income</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-t1-other-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="interest">Interest Income</SelectItem>
                        <SelectItem value="dividends">Dividends</SelectItem>
                        <SelectItem value="rental">Rental Income</SelectItem>
                        <SelectItem value="capital_gains">Capital Gains</SelectItem>
                        <SelectItem value="pension">Pension Income</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="otherIncomeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="0.00" data-testid="input-t1-other-amount" />
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
      <Button onClick={onSave} data-testid="button-t1-continue">
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

  const hasT4Income = responses.find(r => r.sectionId === "income_sources" && r.questionId === "hasT4Income")?.value === true;
  const hasSelfEmployment = responses.find(r => r.sectionId === "income_sources" && r.questionId === "hasSelfEmployment")?.value === true;
  const hasOtherIncome = responses.find(r => r.sectionId === "income_sources" && r.questionId === "hasOtherIncome")?.value === true;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{getResponse("personal_info", "firstName")} {getResponse("personal_info", "lastName")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Province</span>
            <span>{getResponse("personal_info", "province") || "Not set"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {hasT4Income && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">T4 Income</span>
              <span>${getResponse("income_sources", "t4Amount") || "0.00"}</span>
            </div>
          )}
          {hasSelfEmployment && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Self-Employment</span>
              <span>${getResponse("income_sources", "selfEmploymentIncome") || "0.00"}</span>
            </div>
          )}
          {hasOtherIncome && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Other Income</span>
              <span>${getResponse("income_sources", "otherIncomeAmount") || "0.00"}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-6 text-center">
          <Check className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="font-medium">Your T1 information is saved</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You can return anytime to complete additional sections
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TaxFilingT1Page() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const isBasicTier = !user?.subscriptionTier || user.subscriptionTier === "basic";

  const { data: questionnaires, isLoading: loadingList } = useQuery<TaxQuestionnaire[]>({
    queryKey: ["/api/questionnaires"],
    enabled: !isBasicTier,
  });

  const t1Questionnaires = questionnaires?.filter(q => q.questionnaireType === "t1") || [];

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
        questionnaireType: "t1",
        taxYear: new Date().getFullYear().toString(),
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaires"] });
      setSelectedQuestionnaireId(data.id);
      toast({
        title: "Tax return created",
        description: "Your new T1 tax return has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create tax return. Please try again.",
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
    
    if (currentStep < T1_SECTIONS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      await updateQuestionnaireMutation.mutateAsync({ 
        currentStep: T1_SECTIONS[nextStep].id,
        status: "in_progress" 
      });
    } else {
      await updateQuestionnaireMutation.mutateAsync({ status: "completed" });
      toast({
        title: "Tax return completed",
        description: "Your T1 information has been saved.",
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
      handleSaveSection(T1_SECTIONS[currentStep].id, {});
    }
  };

  useEffect(() => {
    if (questionnaireData?.questionnaire) {
      const stepIndex = T1_SECTIONS.findIndex(s => s.id === questionnaireData.questionnaire.currentStep);
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

  if (isBasicTier) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t1-title">T1 Personal Tax Filing</h1>
          <p className="text-muted-foreground">Organize your personal income tax information</p>
        </div>
        <LockedContent />
      </div>
    );
  }

  if (loadingList) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">T1 Personal Tax Filing</h1>
          <p className="text-muted-foreground">Organize your personal income tax information</p>
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedQuestionnaireId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t1-title">T1 Personal Tax Filing</h1>
          <p className="text-muted-foreground">Organize your personal income tax information</p>
        </div>
        <QuestionnaireList 
          questionnaires={t1Questionnaires}
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

  const currentSection = T1_SECTIONS[currentStep];
  const responses = questionnaireData?.responses || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedQuestionnaireId(null)}
          data-testid="button-back-t1-list"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-t1-title">
            T1 Personal Tax Return - {questionnaireData?.questionnaire.taxYear}
          </h1>
          <p className="text-muted-foreground">{currentSection.description}</p>
        </div>
      </div>

      <StepIndicator 
        sections={T1_SECTIONS} 
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
          {currentSection.id === "personal_info" && user && (
            <PersonalInfoStep 
              user={user} 
              responses={responses}
              onSave={handleSaveSection}
            />
          )}
          {currentSection.id === "income_sources" && (
            <IncomeSourcesStep 
              responses={responses}
              onSave={handleSaveSection}
            />
          )}
          {currentSection.id === "deductions" && (
            <PlaceholderStep 
              sectionName="Deductions & Credits"
              onSave={() => handleSaveSection("deductions", {})}
            />
          )}
          {currentSection.id === "expenses" && (
            <PlaceholderStep 
              sectionName="Self-Employment Expenses"
              onSave={() => handleSaveSection("expenses", {})}
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
          data-testid="button-t1-previous"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        {currentStep < T1_SECTIONS.length - 1 ? (
          <Button 
            onClick={handleNextStep}
            disabled={saveResponseMutation.isPending}
            data-testid="button-t1-next"
          >
            {saveResponseMutation.isPending ? "Saving..." : "Save & Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button 
            onClick={() => setSelectedQuestionnaireId(null)}
            data-testid="button-t1-finish"
          >
            <Check className="mr-2 h-4 w-4" />
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
