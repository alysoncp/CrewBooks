import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Receipt, Plus, Trash2, Edit } from "lucide-react";
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
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, getCategoryLabel } from "@/lib/format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES, type Expense, type User, type Vehicle } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import React from "react";
import { Link, useLocation } from "wouter";
import { Settings, ArrowLeft } from "lucide-react";

// Define vehicle subcategories (since schema config was rejected, define inline)
const VEHICLE_SUBCATEGORIES = [
  { id: 'fuel', label: 'Fuel' },
  { id: 'electric_vehicle_charging', label: 'Electric Vehicle Charging' },
  { id: 'maintenance', label: 'Maintenance & Repairs' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'registration', label: 'Registration & Licensing' },
  { id: 'parking', label: 'Parking & Tolls' },
  { id: 'lease_payment', label: 'Lease or Loan Payment' },
  { id: 'other_vehicle', label: 'Other' },
] as const;

// Define home office subcategories
const HOME_OFFICE_SUBCATEGORIES = [
  { id: 'heat', label: 'Heat' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'mortgage_interest', label: 'Mortgage Interest' },
  { id: 'property_taxes', label: 'Property Taxes' },
  { id: 'rent', label: 'Rent' },
] as const;

type ExpenseCategoryTuple = typeof EXPENSE_CATEGORIES;

const expenseFormSchema = z.object({
  baseCost: z.string().optional(),
  total: z.string().optional(),
  gstIncluded: z.boolean().default(false),
  pstIncluded: z.boolean().default(false),
  date: z.string().min(1, "Date is required"),
  title: z.string().optional(),
  category: z.string().min(1, "Category is required"), // Changed from z.enum to z.string
  subcategory: z.string().optional(),
  vehicleId: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  isTaxDeductible: z.boolean().default(true),
}).refine((data) => {
  if (data.category === 'motor_vehicle_expenses' && !data.vehicleId) {
    return false;
  }
  return true;
}, {
  message: "Please select a vehicle",
  path: ["vehicleId"],
}).refine((data) => {
  // At least one of baseCost or total must be provided
  const baseCost = data.baseCost ? parseFloat(data.baseCost) : null;
  const total = data.total ? parseFloat(data.total) : null;
  return (baseCost !== null && !isNaN(baseCost)) || (total !== null && !isNaN(total));
}, {
  message: "Please enter either base cost or total amount",
  path: ["baseCost"],
});

type ExpenseFormData = z.input<typeof expenseFormSchema>;

export default function ExpensesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [receiptIdForExpense, setReceiptIdForExpense] = useState<string | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;
  const [location] = useLocation();

  const { data: expenseList, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: userProfile } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });

  // Get enabled categories from user profile (default to all if not set)
  const enabledCategories = useMemo(() => {
    if (userProfile?.enabledExpenseCategories) {
      return new Set(userProfile.enabledExpenseCategories as string[]);
    }
    // Default: all categories enabled
    return new Set(EXPENSE_CATEGORIES);
  }, [userProfile]);

  // Filter categories to only show enabled ones
  const availableCategories = useMemo(() => {
    return EXPENSE_CATEGORIES.filter((category) => enabledCategories.has(category));
  }, [enabledCategories]);

  // Move form definition BEFORE the useEffect that uses it
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      baseCost: "",
      total: "",
      gstIncluded: false,
      pstIncluded: false,
      date: new Date().toISOString().split("T")[0],
      title: "",
      category: "",
      vendor: "",
      description: "",
      isTaxDeductible: true,
    },
  });

  // Track which field was last edited to prevent circular updates
  const [lastEditedField, setLastEditedField] = useState<"baseCost" | "total" | null>(null);

  // Watch form values for calculations
  const baseCostValue = form.watch("baseCost");
  const totalValue = form.watch("total");
  const gstIncluded = form.watch("gstIncluded");
  const pstIncluded = form.watch("pstIncluded");

  // Calculate GST and PST amounts
  const calculateTaxes = (base: number, includeGst: boolean, includePst: boolean) => {
    const gst = includeGst ? base * 0.05 : 0;
    const pst = includePst ? base * 0.07 : 0;
    const total = base + gst + pst;
    return { gst, pst, total };
  };

  // Calculate base cost from total
  const calculateBaseFromTotal = (total: number, includeGst: boolean, includePst: boolean) => {
    // total = base + (base * 0.05 * gstFlag) + (base * 0.07 * pstFlag)
    // total = base * (1 + 0.05 * gstFlag + 0.07 * pstFlag)
    const taxMultiplier = 1 + (includeGst ? 0.05 : 0) + (includePst ? 0.07 : 0);
    return total / taxMultiplier;
  };

  // Effect to calculate total when baseCost changes
  useEffect(() => {
    if (lastEditedField === "baseCost" && baseCostValue) {
      const base = parseFloat(baseCostValue);
      if (!isNaN(base) && base > 0) {
        const { total } = calculateTaxes(base, gstIncluded || false, pstIncluded || false);
        form.setValue("total", total.toFixed(2), { shouldValidate: false });
      }
    }
  }, [baseCostValue, gstIncluded, pstIncluded, lastEditedField, form]);

  // Effect to calculate baseCost when total changes
  useEffect(() => {
    if (lastEditedField === "total" && totalValue) {
      const total = parseFloat(totalValue);
      if (!isNaN(total) && total > 0) {
        const base = calculateBaseFromTotal(total, gstIncluded || false, pstIncluded || false);
        form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
      }
    }
  }, [totalValue, gstIncluded, pstIncluded, lastEditedField, form]);

  // Recalculate when tax checkboxes change
  useEffect(() => {
    if (lastEditedField === "baseCost" && baseCostValue) {
      const base = parseFloat(baseCostValue);
      if (!isNaN(base) && base > 0) {
        const { total } = calculateTaxes(base, gstIncluded || false, pstIncluded || false);
        form.setValue("total", total.toFixed(2), { shouldValidate: false });
      }
    } else if (lastEditedField === "total" && totalValue) {
      const total = parseFloat(totalValue);
      if (!isNaN(total) && total > 0) {
        const base = calculateBaseFromTotal(total, gstIncluded || false, pstIncluded || false);
        form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
      }
    }
  }, [gstIncluded, pstIncluded, lastEditedField, baseCostValue, totalValue, form]);

  // Check for receiptId in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receiptId = params.get("receiptId");
    if (receiptId) {
      setReceiptIdForExpense(receiptId);
      // Fetch receipt data to get image URL
      fetch(`/api/receipts/${receiptId}`)
        .then((res) => res.json())
        .then((receipt) => {
          if (receipt?.imageUrl) {
            setReceiptImageUrl(receipt.imageUrl);
          }
        })
        .catch(console.error);
      
      // Fetch OCR data and pre-fill form
      fetch(`/api/receipts/${receiptId}/ocr-to-expense`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch OCR data: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          
          if (data.expenseData) {
            // Warn if confidence is low
            if (data.confidence && data.confidence < 0.7) {
              toast({
                title: "Low confidence",
                description: "OCR results have low confidence. Please verify all fields before submitting.",
                variant: "default",
              });
            }
            
            // Open dialog and pre-fill form
            setIsDialogOpen(true);
            const ocrAmount = data.expenseData.amount ? parseFloat(data.expenseData.amount.toString()) : 0;
            form.reset({
              baseCost: "",
              total: ocrAmount > 0 ? ocrAmount.toFixed(2) : "",
              gstIncluded: false,
              pstIncluded: false,
              date: data.expenseData.date || new Date().toISOString().split("T")[0],
              title: data.expenseData.title || "",
              category: data.expenseData.category || "",
              vendor: data.expenseData.vendor || "",
              description: data.expenseData.description || "",
              isTaxDeductible: data.expenseData.isTaxDeductible !== false,
            });
            
            // Clear URL param
            window.history.replaceState({}, "", "/expenses");
          } else {
            throw new Error("No expense data available");
          }
        })
        .catch((error) => {
          console.error("Error fetching OCR data:", error);
          // Still open dialog so user can create expense manually
          setIsDialogOpen(true);
          toast({
            title: "Warning",
            description: "Failed to load receipt OCR data. You can still create the expense manually.",
            variant: "default",
          });
        });
    }
  }, [location, form, toast]);

  // Watch category separately to make it reactive
  const selectedCategory = form.watch("category");

  // Fetch vehicles for the expense form dropdown
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      // Calculate values
      let amount = 0;
      let baseCost = 0;
      let gstAmount = 0;
      let pstAmount = 0;

      if (data.total) {
        amount = parseFloat(data.total);
        // Calculate base cost from total
        baseCost = calculateBaseFromTotal(amount, data.gstIncluded || false, data.pstIncluded || false);
        const taxes = calculateTaxes(baseCost, data.gstIncluded || false, data.pstIncluded || false);
        gstAmount = taxes.gst;
        pstAmount = taxes.pst;
      } else if (data.baseCost) {
        baseCost = parseFloat(data.baseCost);
        const taxes = calculateTaxes(baseCost, data.gstIncluded || false, data.pstIncluded || false);
        gstAmount = taxes.gst;
        pstAmount = taxes.pst;
        amount = taxes.total;
      }

      const payload: any = {
        amount: amount.toString(),
        baseCost: baseCost.toString(),
        gstAmount: gstAmount.toString(),
        pstAmount: pstAmount.toString(),
        date: data.date,
        title: data.title,
        category: data.category,
        subcategory: data.subcategory,
        vehicleId: data.vehicleId,
        vendor: data.vendor,
        description: data.description,
        isTaxDeductible: data.isTaxDeductible,
      };
      
      // Link receipt if creating from receipt
      if (receiptIdForExpense) {
        payload.linkedReceiptId = receiptIdForExpense;
      }
      
      return apiRequest("POST", "/api/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
      setIsDialogOpen(false);
      setEditingExpense(null);
      setLastEditedField(null);
      form.reset();
      setReceiptIdForExpense(null);
      setReceiptImageUrl(null);
      toast({
        title: "Expense added",
        description: receiptIdForExpense ? "Your expense has been created from the receipt." : "Your expense has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseFormData }) => {
      // Calculate values
      let amount = 0;
      let baseCost = 0;
      let gstAmount = 0;
      let pstAmount = 0;

      if (data.total) {
        amount = parseFloat(data.total);
        // Calculate base cost from total
        baseCost = calculateBaseFromTotal(amount, data.gstIncluded || false, data.pstIncluded || false);
        const taxes = calculateTaxes(baseCost, data.gstIncluded || false, data.pstIncluded || false);
        gstAmount = taxes.gst;
        pstAmount = taxes.pst;
      } else if (data.baseCost) {
        baseCost = parseFloat(data.baseCost);
        const taxes = calculateTaxes(baseCost, data.gstIncluded || false, data.pstIncluded || false);
        gstAmount = taxes.gst;
        pstAmount = taxes.pst;
        amount = taxes.total;
      }

      const payload: any = {
        amount: amount.toString(),
        baseCost: baseCost.toString(),
        gstAmount: gstAmount.toString(),
        pstAmount: pstAmount.toString(),
        date: data.date,
        title: data.title,
        category: data.category,
        subcategory: data.subcategory,
        vehicleId: data.vehicleId,
        vendor: data.vendor,
        description: data.description,
        isTaxDeductible: data.isTaxDeductible,
      };
      return apiRequest("PATCH", `/api/expenses/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
      setIsDialogOpen(false);
      setEditingExpense(null);
      setLastEditedField(null);
      form.reset();
      toast({
        title: "Expense updated",
        description: "Your expense has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
      toast({
        title: "Expense deleted",
        description: "The expense entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
    
    // Check if expense has breakdown data
    const baseCost = expense.baseCost ? parseFloat(expense.baseCost.toString()) : null;
    const gstAmount = expense.gstAmount ? parseFloat(expense.gstAmount.toString()) : null;
    const pstAmount = expense.pstAmount ? parseFloat(expense.pstAmount.toString()) : null;
    const totalAmount = parseFloat(expense.amount.toString());
    
    // If we have base cost, use it; otherwise use total
    if (baseCost !== null && baseCost > 0) {
      form.reset({
        baseCost: baseCost.toFixed(2),
        total: totalAmount.toFixed(2),
        gstIncluded: (gstAmount !== null && gstAmount > 0),
        pstIncluded: (pstAmount !== null && pstAmount > 0),
        date: expense.date,
        title: expense.title || "",
        category: expense.category,
        subcategory: expense.subcategory || "",
        vehicleId: expense.vehicleId || "",
        vendor: expense.vendor || "",
        description: expense.description || "",
        isTaxDeductible: expense.isTaxDeductible ?? true,
      });
      setLastEditedField("baseCost");
    } else {
      // For old expenses without breakdown, use total
      form.reset({
        baseCost: "",
        total: totalAmount.toFixed(2),
        gstIncluded: false,
        pstIncluded: false,
        date: expense.date,
        title: expense.title || "",
        category: expense.category,
        subcategory: expense.subcategory || "",
        vehicleId: expense.vehicleId || "",
        vendor: expense.vendor || "",
        description: expense.description || "",
        isTaxDeductible: expense.isTaxDeductible ?? true,
      });
      setLastEditedField("total");
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingExpense(null);
      setReceiptIdForExpense(null);
      setReceiptImageUrl(null);
      setLastEditedField(null);
      form.reset();
    } else if (open) {
      // When opening the dialog, if not editing and not from receipt, reset to defaults
      if (!editingExpense && !receiptIdForExpense) {
        setEditingExpense(null); // Ensure it's cleared
        form.reset({
          baseCost: "",
          total: "",
          gstIncluded: false,
          pstIncluded: false,
          date: new Date().toISOString().split("T")[0],
          title: "",
          category: "",
          vendor: "",
          description: "",
          isTaxDeductible: true,
        });
        setLastEditedField(null);
      }
    }
  };

  const filteredExpenses = (expenseList || []).filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.vendor?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      getCategoryLabel(item.category).toLowerCase().includes(searchLower)
    );
  });

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const deductibleExpenses = filteredExpenses.reduce((sum, item) => {
    const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
    const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
    return sum + baseCost + pstAmount;
  }, 0);
  const totalGstCredits = filteredExpenses.reduce((sum, item) => {
    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
    return sum + gstAmount;
  }, 0);


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-expenses-title">Expenses</h1>
          <p className="text-muted-foreground">Track your business expenses and deductions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses/settings">
            <Button variant="outline" data-testid="button-expenses-settings">
              <Settings className="mr-2 h-4 w-4" />
              Expense Settings
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-expense">
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? "Edit Expense" : receiptIdForExpense ? "Create Expense from Receipt" : "Add Expense"}
                </DialogTitle>
              </DialogHeader>
              {receiptImageUrl && (
                <div className="mb-4 rounded-lg border p-2">
                  <img
                    src={receiptImageUrl}
                    alt="Receipt"
                    className="max-h-32 w-full object-contain rounded"
                  />
                </div>
              )}
              <div className="overflow-y-auto flex-1 pr-2">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="text-sm font-medium">Cost Breakdown</div>
                      
                      <FormField
                        control={form.control}
                        name="baseCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Cost</FormLabel>
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
                                  data-testid="input-expense-base-cost"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setLastEditedField("baseCost");
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>Cost before taxes</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="gstIncluded"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-gst-included"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>GST (5%)</FormLabel>
                                <FormDescription>
                                  {gstIncluded && baseCostValue ? (
                                    <span className="font-mono">
                                      ${(parseFloat(baseCostValue || "0") * 0.05).toFixed(2)}
                                    </span>
                                  ) : (
                                    "$0.00"
                                  )}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="pstIncluded"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-pst-included"
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>PST (7%)</FormLabel>
                                <FormDescription>
                                  {pstIncluded && baseCostValue ? (
                                    <span className="font-mono">
                                      ${(parseFloat(baseCostValue || "0") * 0.07).toFixed(2)}
                                    </span>
                                  ) : (
                                    "$0.00"
                                  )}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="total"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="pl-7 font-mono font-semibold"
                                  data-testid="input-expense-total"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setLastEditedField("total");
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>Total amount including taxes</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-expense-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., Office Supplies Purchase"
                              data-testid="input-expense-title"
                            />
                          </FormControl>
                          <FormDescription>
                            A brief description of this expense
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-expense-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {getCategoryLabel(category)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("category") === "motor_vehicle_expenses" && (
                      <>
                        <FormField
                          control={form.control}
                          name="vehicleId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select vehicle" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vehicles.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No vehicles found. <Link href="/expenses/settings" className="text-primary underline">Add a vehicle</Link> in expense settings.
                                    </div>
                                  ) : (
                                    vehicles.map((vehicle) => (
                                      <SelectItem key={vehicle.id} value={vehicle.id}>
                                        {vehicle.name}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="subcategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expense Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select expense type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {VEHICLE_SUBCATEGORIES.map((subcat) => (
                                    <SelectItem key={subcat.id} value={subcat.id}>
                                      {subcat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    {form.watch("category") === "home_office_expenses" && (
                      <FormField
                        control={form.control}
                        name="subcategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expense Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select expense type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {HOME_OFFICE_SUBCATEGORIES.map((subcat) => (
                                  <SelectItem key={subcat.id} value={subcat.id}>
                                    {subcat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="e.g., Best Buy, Air Canada"
                              data-testid="input-expense-vendor"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                              data-testid="input-expense-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isTaxDeductible"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Tax Deductible</FormLabel>
                            <FormDescription>
                              Mark this expense as a business deduction
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-tax-deductible"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-expense" onClick={form.handleSubmit(onSubmit)}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingExpense ? "Update Expense" : "Save Expense"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold" data-testid="stat-total-expenses">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tax Deductible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="stat-deductible-expenses">
              {formatCurrency(deductibleExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total GST Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="stat-gst-credits">
              {formatCurrency(totalGstCredits)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Expense History</CardTitle>
              <CardDescription>All recorded business expenses</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-expenses"
              />
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
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No expenses recorded</h3>
              <p className="mt-1 text-muted-foreground">
                {searchQuery ? "No results match your search" : "Add your first expense to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Deductible</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((item) => {
                    const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
                    const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
                    const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;
                    const deductibleAmount = baseCost + pstAmount;
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-expense-${item.id}`}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.title || "—"}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(item.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.vendor || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-red-600 dark:text-red-400">
                          -{formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(deductibleAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(gstAmount)}
                        </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-expense-${item.id}`}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-expense-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete expense entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this expense record. This action cannot be undone.
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
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
