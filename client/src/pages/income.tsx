import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Camera, FileText, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, getIncomeTypeLabel, getTodayLocalDateString } from "@/lib/format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { INCOME_TYPES, type Income, type User, type Paystub } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

const incomeFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Amount must be a valid number",
  }).transform((v) => parseFloat(v)),
  date: z.string().min(1, "Date is required"),
  incomeType: z.string().min(1, "Income type is required"),
  productionName: z.string().optional(),
  accountingOffice: z.string().optional(),
  description: z.string().optional(),
  gstHstCollected: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "GST/HST collected must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  dues: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Dues must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  retirement: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Retirement must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  labour: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Labour must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  buyout: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Buyout must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  pension: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Pension must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
  insurance: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Insurance must be a valid number",
  }).transform((v) => v ? parseFloat(v) : undefined),
});

type IncomeFormData = z.input<typeof incomeFormSchema>;

const ACCOUNTING_OFFICES = [
  { value: "entertainment_partners_canada", label: "Entertainment Partners Canada" },
  { value: "cast_and_crew_services", label: "Cast and Crew Services" },
  { value: "other", label: "Other" },
] as const;

export default function IncomePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customAccountingOffice, setCustomAccountingOffice] = useState("");
  const [paystubIdForIncome, setPaystubIdForIncome] = useState<string | null>(null);
  const [paystubImageUrl, setPaystubImageUrl] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;

  const { data: incomeList, isLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(incomeFormSchema),
    mode: "onBlur", // Validate on blur for immediate feedback
    defaultValues: {
      amount: "",
      date: getTodayLocalDateString(),
      incomeType: "",
      productionName: "",
      accountingOffice: "",
      description: "",
      gstHstCollected: "",
      dues: "",
      retirement: "",
      labour: "",
      buyout: "",
      pension: "",
      insurance: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: IncomeFormData) => {
      const payload: any = {
        ...data,
        amount: data.amount.toString(),
        accountingOffice: data.accountingOffice || null,
        gstHstCollected: data.gstHstCollected?.toString() || null,
        dues: data.dues?.toString() || null,
        retirement: data.retirement?.toString() || null,
        labour: data.labour?.toString() || null,
        buyout: data.buyout?.toString() || null,
        pension: data.pension?.toString() || null,
        insurance: data.insurance?.toString() || null,
      };
      
      // Link paystub if creating from paystub
      if (paystubIdForIncome && paystubImageUrl) {
        payload.paystubImageUrl = paystubImageUrl;
      }
      
      const response = await apiRequest("POST", "/api/income", payload);
      const incomeData = await response.json();
      
      // Link paystub to income after creation
      if (paystubIdForIncome && incomeData.id) {
        await apiRequest("PATCH", `/api/paystubs/${paystubIdForIncome}`, {
          linkedIncomeId: incomeData.id,
        });
      }
      
      return incomeData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsDialogOpen(false);
      form.reset();
      setCustomAccountingOffice(""); // Reset custom value
      const hadPaystub = !!paystubIdForIncome;
      setPaystubIdForIncome(null);
      setPaystubImageUrl(null);
      toast({
        title: "Income added",
        description: hadPaystub ? "Your income has been created from the paystub." : "Your income has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add income. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/income/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Income deleted",
        description: "The income entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete income. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IncomeFormData) => {
    // Capture the current value of customAccountingOffice at submission time
    const customValue = customAccountingOffice;
    const accountingOfficeValue = data.accountingOffice === "other" && customValue.trim()
      ? customValue.trim()
      : data.accountingOffice;
    
    createMutation.mutate({
      ...data,
      accountingOffice: accountingOfficeValue || data.accountingOffice,
    });
  };

  // Check for paystubId in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paystubId = params.get("paystubId");
    if (paystubId) {
      setPaystubIdForIncome(paystubId);
      // Fetch paystub data to get image URL
      fetch(`/api/paystubs/${paystubId}`)
        .then((res) => res.json())
        .then((paystub) => {
          if (paystub?.imageUrl) {
            setPaystubImageUrl(paystub.imageUrl);
          }
        })
        .catch(() => {});
      
      // Try to fetch OCR data and pre-fill form (if available)
      fetch(`/api/paystubs/${paystubId}/ocr-to-income`)
        .then((res) => {
          if (!res.ok) {
            // If OCR data doesn't exist (404 or 400), that's fine - just open blank form
            if (res.status === 404 || res.status === 400) {
              return null;
            }
            throw new Error(`Failed to fetch OCR data: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          // Clear URL param
          window.history.replaceState({}, "", "/income");
          
          if (data && !data.error && data.incomeData) {
            // Warn if confidence is low
            if (data.confidence && data.confidence < 0.7) {
              toast({
                title: "Low confidence",
                description: "OCR results have low confidence. Please verify all fields before submitting.",
                variant: "default",
              });
            }
            
            // Pre-fill form with OCR data
            const ocrAmount = data.incomeData.amount ? parseFloat(data.incomeData.amount.toString()) : 0;
            form.reset({
              amount: ocrAmount > 0 ? ocrAmount.toString() : "",
              date: data.incomeData.date || getTodayLocalDateString(),
              incomeType: data.incomeData.incomeType || "",
              productionName: data.incomeData.productionName || "",
              accountingOffice: data.incomeData.accountingOffice || "",
              description: data.incomeData.description || "",
              gstHstCollected: "",
              dues: "",
              retirement: "",
              labour: "",
              buyout: "",
              pension: "",
              insurance: "",
            });
            
            // Set custom accounting office if needed
            if (data.incomeData.accountingOffice) {
              setCustomAccountingOffice(data.incomeData.accountingOffice);
            }
          }
          
          // Open dialog
          setIsDialogOpen(true);
        })
        .catch(() => {
          // If fetching OCR data fails, just open the dialog anyway
          setIsDialogOpen(true);
        });
    }
  }, [form, toast]);

  // Extract available years from income
  const availableYears = useMemo(() => {
    if (!incomeList || incomeList.length === 0) return [currentYear];
    const years = new Set<number>();
    incomeList.forEach((income) => {
      const year = new Date(income.date).getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  }, [incomeList, currentYear]);

  // Filter income by year and search query
  const filteredIncome = useMemo(() => {
    return (incomeList || []).filter((item) => {
      // Filter by year
      const itemYear = new Date(item.date).getFullYear();
      if (itemYear !== selectedYear) return false;

      // Filter by search query
      const searchLower = searchQuery.toLowerCase();
      return (
        item.productionName?.toLowerCase().includes(searchLower) ||
        item.accountingOffice?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        getIncomeTypeLabel(item.incomeType).toLowerCase().includes(searchLower)
      );
    });
  }, [incomeList, selectedYear, searchQuery]);

  const totalIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-income-title">Income</h1>
          <p className="text-muted-foreground">Track your earnings from productions and gigs</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-income">
              <Plus className="mr-2 h-4 w-4" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {paystubIdForIncome ? "Create Income from Paystub" : "Add Income"}
              </DialogTitle>
              {paystubIdForIncome && (
                <p className="text-sm text-muted-foreground mt-2">
                  Review and confirm the extracted income data from your paystub.
                </p>
              )}
            </DialogHeader>
            {paystubImageUrl && (
              <div className="mb-4 rounded-lg border p-2">
                <img
                  src={paystubImageUrl}
                  alt="Paystub"
                  className="max-h-32 w-full object-contain rounded"
                />
              </div>
            )}
            <div className="overflow-y-auto flex-1 pr-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-amount"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-income-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="incomeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Income Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-income-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INCOME_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {getIncomeTypeLabel(type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Production Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., The Crown Season 6"
                            data-testid="input-income-production"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountingOffice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accounting Office</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "other") {
                              setCustomAccountingOffice("");
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-accounting-office">
                              <SelectValue placeholder="Select accounting office" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ACCOUNTING_OFFICES.map((office) => (
                              <SelectItem key={office.value} value={office.value}>
                                {office.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("accountingOffice") === "other" && (
                    <FormItem>
                      <FormLabel>Custom Accounting Office</FormLabel>
                      <FormControl>
                        <Input
                          value={customAccountingOffice}
                          onChange={(e) => setCustomAccountingOffice(e.target.value)}
                          placeholder="Enter accounting office name"
                          data-testid="input-custom-accounting-office"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Additional details..."
                            data-testid="input-income-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {hasGstNumber && (
                    <FormField
                      control={form.control}
                      name="gstHstCollected"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST/HST Collected</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="pl-7 font-mono"
                                data-testid="input-income-gst-hst"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="dues"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dues</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-dues"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="retirement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retirement</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-retirement"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="labour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Labour</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-labour"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="buyout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyout</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-buyout"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pension"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pension</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-pension"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insurance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 font-mono"
                              data-testid="input-income-insurance"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-income" onClick={form.handleSubmit(onSubmit)}>
                {createMutation.isPending ? "Saving..." : "Save Income"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Income History</CardTitle>
              <CardDescription>
                Total for {selectedYear}: <span className="font-mono font-semibold">{formatCurrency(totalIncome)}</span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
              >
                <SelectTrigger className="w-32" data-testid="select-income-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search income..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-income"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredIncome.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No income recorded</h3>
              <p className="mt-1 text-muted-foreground">
                {searchQuery ? "No results match your search" : "Add your first income entry to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Production</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncome.map((item) => (
                    <TableRow key={item.id} data-testid={`row-income-${item.id}`}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getIncomeTypeLabel(item.incomeType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productionName || "—"}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-income-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete income entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this income record. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
