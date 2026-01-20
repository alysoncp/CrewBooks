import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Receipt as ReceiptIcon, Plus, Trash2, Edit, Image as ImageIcon, X, AlertCircle, Camera, Pencil, Scan, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, getCategoryLabel, getTodayLocalDateString, getYearFromDateString, getExpenseTypeLabel, getPersonalExpenseCategoryLabel } from "@/lib/format";
import { queryClient, apiRequest, getQueryFn, uploadWithAuth, getWithAuth } from "@/lib/queryClient";
import { SELF_EMPLOYMENT_EXPENSE_CATEGORIES, EXPENSE_TYPES, PERSONAL_EXPENSE_CATEGORIES, HOME_OFFICE_LIVING_CATEGORIES, VEHICLE_CATEGORIES, type Expense, type User, type Vehicle, type Receipt } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useTaxYear } from "@/components/tax-year-provider";
import { Link, useLocation } from "wouter";
import { Settings } from "lucide-react";

type ExpenseCategoryTuple = typeof SELF_EMPLOYMENT_EXPENSE_CATEGORIES;

const expenseFormSchema = z.object({
  total: z.string().min(1, "Total is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Total must be a valid number",
  }),
  gstAmount: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "GST amount must be a valid number",
  }),
  date: z.string().min(1, "Date is required"),
  title: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  vehicleId: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  isTaxDeductible: z.boolean().default(true),
  expenseType: z.enum(["home_office_living", "vehicle", "self_employment", "personal", "mixed"]).default("self_employment"),
  businessUsePercentage: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true; // Optional field
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
  }, {
    message: "Business use percentage must be between 0 and 100",
  }),
}).refine((data) => {
  // Vehicle expenses require a vehicle selection
  if (data.expenseType === "vehicle" && !data.vehicleId) {
    return false;
  }
  return true;
}, {
  message: "Please select a vehicle",
  path: ["vehicleId"],
}).refine((data) => {
  // If expense type is mixed, business use percentage is required
  if (data.expenseType === "mixed") {
    const percentage = data.businessUsePercentage ? parseFloat(data.businessUsePercentage) : null;
    return percentage !== null && !isNaN(percentage) && percentage >= 0 && percentage <= 100;
  }
  return true;
}, {
  message: "Business use percentage is required for mixed expenses (0-100%)",
  path: ["businessUsePercentage"],
});

type ExpenseFormData = z.input<typeof expenseFormSchema>;

export default function ExpensesPage() {
  const [isInitialDialogOpen, setIsInitialDialogOpen] = useState(false);
  const [isReceiptUploadDialogOpen, setIsReceiptUploadDialogOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>("all");
  const [receiptIdForExpense, setReceiptIdForExpense] = useState<string | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const { taxYear } = useTaxYear();
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

  // Fetch receipts to match with expenses
  const { data: receipts } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });


  // Create a map of expenseId -> receipt for quick lookup
  const receiptMap = useMemo(() => {
    if (!receipts) return new Map<string, Receipt>();
    const map = new Map<string, Receipt>();
    receipts.forEach((receipt) => {
      if (receipt.linkedExpenseId) {
        map.set(receipt.linkedExpenseId, receipt);
      }
    });
    return map;
  }, [receipts]);

  // State for viewing receipt
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  // Extract custom categories (those not in predefined lists)
  // All predefined categories are always available - no need to check enabled status
  const customCategories = useMemo(() => {
    if (userProfile?.enabledExpenseCategories) {
      const allCategories = userProfile.enabledExpenseCategories as string[];
      return allCategories.filter(cat => 
        !SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(cat as any) &&
        !HOME_OFFICE_LIVING_CATEGORIES.includes(cat as any) &&
        !VEHICLE_CATEGORIES.includes(cat as any)
      );
    }
    return [];
  }, [userProfile]);

  const customPersonalCategories = useMemo(() => {
    if (userProfile?.enabledPersonalExpenseCategories) {
      const allCategories = userProfile.enabledPersonalExpenseCategories as string[];
      return allCategories.filter(cat => !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any));
    }
    return [];
  }, [userProfile]);

  // Move form definition BEFORE the useEffect that uses it
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onBlur", // Validate on blur for immediate feedback
    defaultValues: {
      total: "",
      gstAmount: "",
      date: getTodayLocalDateString(),
      title: "",
      category: "",
      vendor: "",
      description: "",
      isTaxDeductible: true,
      expenseType: "self_employment",
      businessUsePercentage: "",
    },
  });

  // Watch expense type to determine which categories to show
  const expenseType = form.watch("expenseType");

  // Get enabled categories from user profile
  const enabledCategories = useMemo(() => {
    if (userProfile?.enabledExpenseCategories) {
      return new Set(userProfile.enabledExpenseCategories as string[]);
    }
    // Default: all categories enabled if not set
    return new Set(Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES));
  }, [userProfile]);

  const enabledPersonalCategories = useMemo(() => {
    if (userProfile?.enabledPersonalExpenseCategories) {
      return new Set(userProfile.enabledPersonalExpenseCategories as string[]);
    }
    // Default: all categories enabled if not set
    return new Set(Array.from(PERSONAL_EXPENSE_CATEGORIES));
  }, [userProfile]);

  // Categories are shown contextually based on expense type
  // Only show categories that are enabled in user settings
  const availableCategories = useMemo(() => {
    if (expenseType === "home_office_living") {
      // Home Office/Living expenses: show only home office/living categories
      // All home office categories are always available (no filtering needed)
      return Array.from(new Set([...HOME_OFFICE_LIVING_CATEGORIES]));
    } else if (expenseType === "vehicle") {
      // Vehicle expenses: show only vehicle categories
      // All vehicle categories are always available (no filtering needed)
      return Array.from(new Set([...VEHICLE_CATEGORIES]));
    } else if (expenseType === "self_employment") {
      // Self-Employment expenses: show only enabled self-employment categories
      const filteredCustomCategories = customCategories.filter(cat => 
        !HOME_OFFICE_LIVING_CATEGORIES.includes(cat as any) &&
        !VEHICLE_CATEGORIES.includes(cat as any) &&
        !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)
      );
      // Filter to only show enabled self-employment categories
      const enabledSelfEmployment = Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES).filter(cat => 
        enabledCategories.has(cat)
      );
      return Array.from(new Set([...enabledSelfEmployment, ...filteredCustomCategories]));
    } else if (expenseType === "personal") {
      // Personal expenses: show only enabled personal expense categories
      const enabledPersonal = Array.from(PERSONAL_EXPENSE_CATEGORIES).filter(cat => 
        enabledPersonalCategories.has(cat)
      );
      return Array.from(new Set([...enabledPersonal, ...customPersonalCategories]));
    } else if (expenseType === "mixed") {
      // Mixed expenses: show only enabled self-employment categories
      const filteredCustomCategories = customCategories.filter(cat => 
        !HOME_OFFICE_LIVING_CATEGORIES.includes(cat as any) &&
        !VEHICLE_CATEGORIES.includes(cat as any) &&
        !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)
      );
      // Filter to only show enabled self-employment categories
      const enabledSelfEmployment = Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES).filter(cat => 
        enabledCategories.has(cat)
      );
      return Array.from(new Set([...enabledSelfEmployment, ...filteredCustomCategories]));
    }
    return [];
  }, [customCategories, customPersonalCategories, expenseType, enabledCategories, enabledPersonalCategories]);

  // Track which field was last edited to prevent circular updates
  const [lastEditedField, setLastEditedField] = useState<"total" | "gstAmount" | null>(null);

  // Check for receiptId in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receiptId = params.get("receiptId");
    if (receiptId) {
      setReceiptIdForExpense(receiptId);
      // Fetch receipt data to get image URL
      getWithAuth(`/api/receipts/${receiptId}`, { on401: "returnNull" })
        .then((receipt) => {
          if (receipt?.imageUrl) {
            setReceiptImageUrl(receipt.imageUrl);
          }
        })
        .catch(() => {});
      
      // Try to fetch OCR data and pre-fill form (if available)
      getWithAuth(`/api/receipts/${receiptId}/ocr-to-expense`, { on401: "returnNull" })
        .then((data) => {
          // Clear URL param
          window.history.replaceState({}, "", "/expenses");
          
          if (data && !data.error && data.expenseData) {
            // Warn if confidence is low
            if (data.confidence && data.confidence < 0.7) {
              toast({
                title: "Low confidence",
                description: "OCR results have low confidence. Please verify all fields before submitting.",
                variant: "default",
              });
            }
            
            // Pre-fill form with OCR data
            const ocrAmount = data.expenseData.amount ? parseFloat(data.expenseData.amount.toString()) : 0;
            const ocrGstAmount = data.expenseData.gstAmount ? parseFloat(data.expenseData.gstAmount.toString()) : 0;
            form.reset({
              total: ocrAmount > 0 ? ocrAmount.toFixed(2) : "",
              gstAmount: ocrGstAmount > 0 ? ocrGstAmount.toFixed(2) : "",
              date: data.expenseData.date || getTodayLocalDateString(),
              title: data.expenseData.title || "",
              category: data.expenseData.category || "",
              vendor: data.expenseData.vendor || "",
              description: data.expenseData.description || "",
              isTaxDeductible: data.expenseData.isTaxDeductible !== false,
            });
          } else {
            // No OCR data available - reset to blank form
            form.reset({
              total: "",
              gstAmount: "",
              date: getTodayLocalDateString(),
              title: "",
              category: "",
              vendor: "",
              description: "",
              isTaxDeductible: true,
            });
          }
          
          // Open dialog after form is reset to ensure DialogTitle is ready
          setTimeout(() => setIsDialogOpen(true), 0);
        })
        .catch(() => {
          // Clear URL param
          window.history.replaceState({}, "", "/expenses");
          // Reset to blank form and open dialog
          form.reset({
            total: "",
            gstAmount: "",
            date: getTodayLocalDateString(),
            title: "",
            category: "",
            vendor: "",
            description: "",
            isTaxDeductible: true,
            expenseType: "self_employment",
            businessUsePercentage: "",
          });
          // Open dialog so user can create expense manually
          setTimeout(() => setIsDialogOpen(true), 0);
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
      const amount = data.total ? parseFloat(data.total) : 0;
      const gstAmount = data.gstAmount ? parseFloat(data.gstAmount) : 0;

      const payload: any = {
        amount: amount.toString(),
        gstAmount: gstAmount.toString(),
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
      
      // Add expense type and business use percentage
      payload.expenseType = data.expenseType || "self_employment";
      payload.businessUsePercentage = data.businessUsePercentage ? data.businessUsePercentage.toString() : null;
      
      return apiRequest("POST", "/api/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] }); // Invalidate receipts to update receipt map
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
      const amount = data.total ? parseFloat(data.total) : 0;
      const gstAmount = data.gstAmount ? parseFloat(data.gstAmount) : 0;

      const payload: any = {
        amount: amount.toString(),
        gstAmount: gstAmount.toString(),
        date: data.date,
        title: data.title,
        category: data.category,
        subcategory: data.subcategory,
        vehicleId: data.vehicleId,
        vendor: data.vendor,
        description: data.description,
        isTaxDeductible: data.isTaxDeductible,
        expenseType: data.expenseType || "self_employment",
        businessUsePercentage: data.businessUsePercentage ? data.businessUsePercentage.toString() : null,
      };
      return apiRequest("PATCH", `/api/expenses/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] }); // Invalidate receipts to update receipt map
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
    mutationFn: async ({ expenseId, alsoDeleteReceipt }: { expenseId: string; alsoDeleteReceipt?: string }) => {
      // Delete expense first
      await apiRequest("DELETE", `/api/expenses/${expenseId}`);
      // If also deleting receipt, delete it too
      if (alsoDeleteReceipt) {
        await apiRequest("DELETE", `/api/receipts/${alsoDeleteReceipt}`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] }); // Invalidate receipts to update receipt map
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
      if (variables.alsoDeleteReceipt) {
        toast({
          title: "Expense and receipt deleted",
          description: "The expense and its linked receipt have been removed.",
        });
      } else {
        toast({
          title: "Expense deleted",
          description: "The expense entry has been removed.",
        });
      }
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
    
    const gstAmount = expense.gstAmount ? parseFloat(expense.gstAmount.toString()) : null;
    const totalAmount = parseFloat(expense.amount.toString());
    form.reset({
      total: totalAmount.toFixed(2),
      gstAmount: gstAmount !== null && gstAmount > 0 ? gstAmount.toFixed(2) : "",
      date: expense.date,
      title: expense.title || "",
      category: expense.category,
      subcategory: expense.subcategory || "",
      vehicleId: expense.vehicleId || "",
      vendor: expense.vendor || "",
      description: expense.description || "",
      isTaxDeductible: expense.isTaxDeductible ?? true,
      expenseType: (expense as any).expenseType || "self_employment",
      businessUsePercentage: (expense as any).businessUsePercentage 
        ? parseFloat((expense as any).businessUsePercentage.toString()).toFixed(2) 
        : "",
    });
    setLastEditedField("total");
  };

  const handleAddExpenseClick = () => {
    setEditingExpense(null);
    form.reset();
    setReceiptIdForExpense(null);
    setReceiptImageUrl(null);
    setIsInitialDialogOpen(true);
  };

  const handleInitialDialogSelect = (mode: 'upload' | 'manual' | 'cancel') => {
    setIsInitialDialogOpen(false);
    if (mode === 'upload') {
      setIsReceiptUploadDialogOpen(true);
    } else if (mode === 'manual') {
      setIsDialogOpen(true);
    }
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  };

  const removeReceiptPreview = (index: number) => {
    setPreviewFiles((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const handleReceiptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  };

  const handleReceiptDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const receiptUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("notes", receiptNotes);
      formData.append("scanWithOCR", scanWithOCR.toString());
      
      return uploadWithAuth("/api/receipts/upload", formData);
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      
      // Close receipt upload dialog and clear state
      setIsReceiptUploadDialogOpen(false);
      setPreviewFiles([]);
      setReceiptNotes("");
      setScanWithOCR(false);
      
      // Always open expense dialog after upload, regardless of OCR status
      if (data && Array.isArray(data) && data.length > 0) {
        const firstReceipt = data[0];
        
        if (firstReceipt.id) {
          setReceiptIdForExpense(firstReceipt.id);
          
          // Fetch receipt data to get image URL
          try {
            const receipt = await getWithAuth(`/api/receipts/${firstReceipt.id}`, { on401: "returnNull" });
            if (receipt?.imageUrl) {
              setReceiptImageUrl(receipt.imageUrl);
            }
          } catch (error) {
            // Ignore error, continue without image
          }
          
          // Try to fetch OCR data and pre-fill form (if available)
          try {
            const ocrData = await getWithAuth(`/api/receipts/${firstReceipt.id}/ocr-to-expense`, { on401: "returnNull" });
            
            if (ocrData && !ocrData.error && ocrData.expenseData) {
              // Warn if confidence is low
              if (ocrData.confidence && ocrData.confidence < 0.7) {
                toast({
                  title: "Low confidence",
                  description: "OCR results have low confidence. Please verify all fields before submitting.",
                  variant: "default",
                });
              }
              
              // Pre-fill form with OCR data
              const ocrAmount = ocrData.expenseData.amount ? parseFloat(ocrData.expenseData.amount.toString()) : 0;
              const ocrGstAmount = ocrData.expenseData.gstAmount ? parseFloat(ocrData.expenseData.gstAmount.toString()) : 0;
              form.reset({
                total: ocrAmount > 0 ? ocrAmount.toFixed(2) : "",
                gstAmount: ocrGstAmount > 0 ? ocrGstAmount.toFixed(2) : "",
                date: ocrData.expenseData.date || getTodayLocalDateString(),
                title: ocrData.expenseData.title || "",
                category: ocrData.expenseData.category || "",
                vendor: ocrData.expenseData.vendor || "",
                description: ocrData.expenseData.description || "",
                isTaxDeductible: ocrData.expenseData.isTaxDeductible !== false,
                expenseType: "self_employment",
                businessUsePercentage: "",
              });
            } else {
              // No OCR data available - reset to blank form
              form.reset({
                total: "",
                gstAmount: "",
                date: getTodayLocalDateString(),
                title: "",
                category: "",
                vendor: "",
                description: "",
                isTaxDeductible: true,
                expenseType: "self_employment",
                businessUsePercentage: "",
              });
            }
          } catch (error) {
            // Error fetching OCR - reset to blank form
            form.reset({
              total: "",
              gstAmount: "",
              date: getTodayLocalDateString(),
              title: "",
              category: "",
              vendor: "",
              description: "",
              isTaxDeductible: true,
              expenseType: "self_employment",
              businessUsePercentage: "",
            });
          }
          
          // Open expense dialog after form is reset
          setTimeout(() => setIsDialogOpen(true), 0);
          
          // Show appropriate toast based on OCR status
          if (scanWithOCR && firstReceipt.expenseData && firstReceipt.ocrStatus === "completed") {
            toast({
              title: "Receipt scanned",
              description: "Review and confirm the extracted expense data.",
            });
          } else if (scanWithOCR && firstReceipt.ocrError) {
            toast({
              title: "OCR processing failed",
              description: "You can still create the expense manually.",
              variant: "default",
            });
          } else {
            toast({
              title: "Receipt uploaded",
              description: "Create an expense for this receipt.",
            });
          }
          return;
        }
      }
      
      // Fallback: just show success toast
      toast({
        title: "Receipts uploaded",
        description: "Your receipts have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload receipts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReceiptUpload = () => {
    if (previewFiles.length === 0) return;
    receiptUploadMutation.mutate(previewFiles.map((p) => p.file));
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
          total: "",
          gstAmount: "",
          date: getTodayLocalDateString(),
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

  // Get unique categories and expense types from expenses for filter dropdowns
  const availableCategoriesForFilter = useMemo(() => {
    if (!expenseList) return [];
    const categories = new Set<string>();
    expenseList.forEach((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear === taxYear) {
        categories.add(item.category);
      }
    });
    return Array.from(categories).sort();
  }, [expenseList, taxYear]);

  const availableExpenseTypesForFilter = useMemo(() => {
    if (!expenseList) return [];
    const types = new Set<string>();
    expenseList.forEach((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear === taxYear) {
        const expenseType = (item as any).expenseType || "self_employment";
        types.add(expenseType);
      }
    });
    return Array.from(types).sort();
  }, [expenseList, taxYear]);

  // Filter expenses by year, search query, category, and expense type
  const filteredExpenses = useMemo(() => {
    return (expenseList || []).filter((item) => {
      // Filter by year - extract year directly from date string to avoid timezone issues
      const itemYear = getYearFromDateString(item.date);
      if (itemYear !== taxYear) return false;

      // Filter by category
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      // Filter by expense type
      if (expenseTypeFilter !== "all") {
        const expenseType = (item as any).expenseType || "self_employment";
        if (expenseType !== expenseTypeFilter) {
          return false;
        }
      }

      // Filter by search query
      const searchLower = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.vendor?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        getCategoryLabel(item.category).toLowerCase().includes(searchLower)
      );
    });
  }, [expenseList, taxYear, searchQuery, categoryFilter, expenseTypeFilter]);

  // Helper function to calculate deductible amount and deductible GST for an expense
  const calculateDeductible = useMemo(() => {
    return (item: Expense, vehicleBusinessUseMap: Map<string, number>) => {
      if (!item.isTaxDeductible) {
        return { deductibleAmount: 0, deductibleGst: 0 };
      }

      const expenseType = (item as any).expenseType || "self_employment";
      const baseCost = item.baseCost ? parseFloat(item.baseCost.toString()) : 0;
      const pstAmount = item.pstAmount ? parseFloat(item.pstAmount.toString()) : 0;
      const gstAmount = item.gstAmount ? parseFloat(item.gstAmount.toString()) : 0;

      if (expenseType === "personal") {
        return { deductibleAmount: 0, deductibleGst: 0 };
      }

      if (expenseType === "home_office_living") {
        // Home Office/Living expenses: apply home office percentage if set
        let deductibleAmount = baseCost + pstAmount;
        let deductibleGst = gstAmount;
        if (userProfile?.homeOfficePercentage) {
          const percentage = parseFloat(userProfile.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * percentage;
          deductibleGst = deductibleGst * percentage;
        }
        return { deductibleAmount, deductibleGst };
      }

      if (expenseType === "vehicle") {
        // Vehicle expenses: use business use percentage from odometer entries
        const vehicleId = (item as any).vehicleId;
        let businessPercentage = 1.0; // Default to 100% if no vehicle or percentage found
        
        if (vehicleId && vehicleBusinessUseMap.has(vehicleId)) {
          businessPercentage = vehicleBusinessUseMap.get(vehicleId)! / 100;
        }
        
        const deductibleAmount = (baseCost + pstAmount) * businessPercentage;
        const deductibleGst = gstAmount * businessPercentage;
        return { deductibleAmount, deductibleGst };
      }

      if (expenseType === "self_employment") {
        // Self-Employment expenses: fully deductible
        return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
      }

      if (expenseType === "mixed") {
        const businessPercentage = (item as any).businessUsePercentage 
          ? parseFloat((item as any).businessUsePercentage.toString()) / 100 
          : 0;
        
        // Only business portion of base cost + proportional PST is deductible
        const businessBaseCost = baseCost * businessPercentage;
        const businessPstAmount = pstAmount * businessPercentage;
        let deductibleAmount = businessBaseCost + businessPstAmount;
        let deductibleGst = gstAmount * businessPercentage;
        
        // Apply home office percentage if applicable for home office/living categories
        if (HOME_OFFICE_LIVING_CATEGORIES.includes(item.category as any) && userProfile?.homeOfficePercentage) {
          const homeOfficePercentage = parseFloat(userProfile.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * homeOfficePercentage;
          deductibleGst = deductibleGst * homeOfficePercentage;
        }
        
        return { deductibleAmount, deductibleGst };
      }

      // Default: treat as business expense (fully deductible)
      return { deductibleAmount: baseCost + pstAmount, deductibleGst: gstAmount };
    };
  }, [userProfile]);

  // Get unique vehicle IDs from vehicle expenses
  const vehicleIdsInExpenses = useMemo(() => {
    const ids = new Set<string>();
    if (!filteredExpenses) return [];
    
    filteredExpenses.forEach((expense) => {
      const expenseType = (expense as any).expenseType || "self_employment";
      if (expenseType === "vehicle" && (expense as any).vehicleId) {
        const vehicleId = (expense as any).vehicleId;
        if (vehicleId) {
          ids.add(vehicleId);
        }
      }
    });
    
    return Array.from(ids);
  }, [filteredExpenses]);

  // Fetch business use percentages for vehicles used in expenses
  const [vehicleBusinessUseMap, setVehicleBusinessUseMap] = useState<Map<string, number>>(new Map());
  
  useEffect(() => {
    const fetchVehiclePercentages = async () => {
      const map = new Map<string, number>();
      const promises = vehicleIdsInExpenses.map(async (vehicleId: string) => {
        try {
          const response = await fetch(`/api/vehicles/${vehicleId}/business-use-percentage?taxYear=${taxYear}`);
          if (response.ok) {
            const data = await response.json();
            map.set(vehicleId, data.businessUsePercentage || 100);
          } else {
            map.set(vehicleId, 100); // Default to 100% if fetch fails
          }
        } catch (error) {
          map.set(vehicleId, 100); // Default to 100% on error
        }
      });
      
      await Promise.all(promises);
      setVehicleBusinessUseMap(map);
    };
    
    if (vehicleIdsInExpenses.length > 0) {
      fetchVehiclePercentages();
    } else {
      setVehicleBusinessUseMap(new Map());
    }
  }, [vehicleIdsInExpenses, taxYear]);

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  
  // Calculate deductible expenses and deductible GST using the helper function
  // Note: For vehicle expenses, we'll use a default 100% for summary calculations
  // The table will fetch actual percentages on-demand
  const { deductibleExpenses, deductibleGstCredits } = useMemo(() => {
    let deductibleSum = 0;
    let deductibleGstSum = 0;
    
    // Create a temporary map with default 100% for vehicles (for summary calculations)
    const tempVehicleMap = new Map<string, number>();
    vehicles.forEach(vehicle => {
      if (vehicle.id) {
        // For summary, use 100% as default - actual calculation happens in table rows
        tempVehicleMap.set(vehicle.id, 100);
      }
    });
    
    filteredExpenses.forEach((item) => {
      const result = calculateDeductible(item, tempVehicleMap);
      deductibleSum += result.deductibleAmount;
      deductibleGstSum += result.deductibleGst;
    });
    
    return { deductibleExpenses: deductibleSum, deductibleGstCredits: deductibleGstSum };
  }, [filteredExpenses, calculateDeductible, vehicles]);
  
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
          <Button 
            data-testid="button-add-expense"
            onClick={handleAddExpenseClick}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Initial Selection Dialog */}
      <Dialog 
        open={isInitialDialogOpen && !editingExpense} 
        onOpenChange={(open) => {
          setIsInitialDialogOpen(open);
          if (!open && !editingExpense) {
            setReceiptIdForExpense(null);
            setReceiptImageUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              How would you like to add an expense?
            </p>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleInitialDialogSelect('upload')}
            >
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Upload Photo</span>
                  <span className="text-xs text-muted-foreground">Choose from gallery</span>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleInitialDialogSelect('manual')}
            >
              <div className="flex items-center gap-3">
                <Pencil className="h-5 w-5" />
                <div className="flex flex-col items-start">
                  <span className="font-medium">Manual entry</span>
                  <span className="text-xs text-muted-foreground">Enter details manually</span>
                </div>
              </div>
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => handleInitialDialogSelect('cancel')}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Upload Dialog */}
      <Dialog 
        open={isReceiptUploadDialogOpen} 
        onOpenChange={(open) => {
          setIsReceiptUploadDialogOpen(open);
          if (!open) {
            setPreviewFiles([]);
            setReceiptNotes("");
            setScanWithOCR(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
            <DialogDescription>
              Upload a photo of your receipt to create an expense
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
              onDrop={handleReceiptDrop}
              onDragOver={handleReceiptDragOver}
              onClick={() => document.getElementById("receipt-file-input")?.click()}
              data-testid="dropzone-receipt"
            >
              <ImageIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop images here, or click to select
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports: JPG, PNG, HEIC
              </p>
              <Input
                id="receipt-file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleReceiptFileChange}
                data-testid="input-file-receipt"
              />
            </div>

            {previewFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {previewFiles.map((item, index) => (
                  <div key={index} className="group relative aspect-square">
                    <img
                      src={item.preview}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeReceiptPreview(index);
                      }}
                      data-testid={`button-remove-preview-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Add notes about this receipt..."
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                data-testid="input-receipt-notes"
              />
            </div>

            <div className="flex items-center space-x-2 rounded-lg border p-4">
              <Switch
                id="scan-ocr-expense"
                checked={scanWithOCR}
                onCheckedChange={setScanWithOCR}
                data-testid="switch-scan-ocr"
              />
              <Label htmlFor="scan-ocr-expense" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Scan className="h-4 w-4" />
                  <span>Scan with OCR</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically extract receipt details and open expense form
                </p>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleReceiptUpload}
              disabled={previewFiles.length === 0 || receiptUploadMutation.isPending}
              data-testid="button-submit-receipt"
            >
              {receiptUploadMutation.isPending ? "Uploading..." : `Upload ${previewFiles.length} Receipt${previewFiles.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense 
                    ? "Edit Expense" 
                    : receiptIdForExpense 
                      ? "Create Expense from Receipt" 
                      : "Add Expense"}
                </DialogTitle>
                <DialogDescription>
                  {receiptIdForExpense 
                    ? "Review and confirm the extracted expense data from your receipt." 
                    : editingExpense
                      ? "Update the expense details below."
                      : "Enter the details for your business expense."}
                </DialogDescription>
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
                      <div className="text-sm font-medium">Amounts</div>

                      <FormField
                        control={form.control}
                        name="total"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total (incl. taxes)</FormLabel>
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

                      <FormField
                        control={form.control}
                        name="gstAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GST Amount</FormLabel>
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
                                  data-testid="input-expense-gst-amount"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setLastEditedField("gstAmount");
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormDescription>GST extracted from receipt (if any)</FormDescription>
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
                      name="expenseType"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormLabel>Expense Type</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" aria-label="Expense type info" className="text-muted-foreground hover:text-foreground">
                                  <Info className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-xs text-xs" align="start">
                                <div className="space-y-2">
                                  <p className="font-medium">Expense Type</p>
                                  <p>
                                    Choose how this expense is treated: Self-Employment (business), Vehicle, Home (home office/living), Personal, or Mixed. Mixed expenses require a business use percentage.
                                  </p>
                                  <p>
                                    See details in the <a href="/help#expense-management" target="_blank" rel="noopener noreferrer" className="underline">Help</a> section.
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-expense-type">
                                <SelectValue placeholder="Select expense type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="home_office_living">Home</SelectItem>
                              <SelectItem value="vehicle">Vehicle</SelectItem>
                              <SelectItem value="self_employment">Self-Employment</SelectItem>
                              <SelectItem value="personal">Personal</SelectItem>
                              <SelectItem value="mixed">Mixed (Personal & Self-Employment)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select whether this expense is for business, personal use, or a mix of both
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
                          <div className="flex items-center gap-2">
                            <FormLabel>Category</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" aria-label="Category info" className="text-muted-foreground hover:text-foreground">
                                  <Info className="h-4 w-4" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-xs text-xs" align="start">
                                <div className="space-y-2">
                                  <p className="font-medium">Category</p>
                                  <p>
                                    Categories shown depend on the selected expense type. For business and mixed expenses, choose the business category. For personal expenses, choose the personal category.
                                  </p>
                                  <p>
                                    See examples in the <a href="/help#expense-management" target="_blank" rel="noopener noreferrer" className="underline">Help</a> section.
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
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
                              {availableCategories.map((category: string) => {
                                // Determine which label function to use
                                let label = getCategoryLabel(category);
                                if (expenseType === "personal") {
                                  // All personal expense categories (including former general categories) use personal label
                                  if (PERSONAL_EXPENSE_CATEGORIES.includes(category as any)) {
                                    label = getPersonalExpenseCategoryLabel(category);
                                  } else {
                                    // Custom category - use personal format
                                    label = getPersonalExpenseCategoryLabel(category);
                                  }
                                }
                                return (
                                  <SelectItem key={category} value={category}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {expenseType === "mixed" && (
                      <FormField
                        control={form.control}
                        name="businessUsePercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Use Percentage</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="0.00"
                                  className="pr-8 font-mono"
                                  data-testid="input-business-use-percentage"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                              </div>
                            </FormControl>
                            <FormDescription>
                              Enter the percentage of this expense that is for business use (0-100%)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {expenseType === "vehicle" && (
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
                                    <SelectItem key={vehicle.id} value={vehicle.id || ""}>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Deductible GST Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="stat-gst-credits">
              {formatCurrency(deductibleGstCredits)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Expense History</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableCategoriesForFilter.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-expense-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableExpenseTypesForFilter.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getExpenseTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Check if there are any vehicle expenses in the filtered list
            const hasVehicleExpenses = filteredExpenses.some((item) => {
              const expenseType = (item as any).expenseType || "self_employment";
              return expenseType === "vehicle";
            });
            
            return hasVehicleExpenses ? (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Vehicle Expense Estimates</AlertTitle>
                <AlertDescription>
                  Vehicle expense deductible amounts are calculated using estimated business use percentages based on your mileage logs and estimated yearly mileage. 
                  These percentages may be refined as you add more odometer photos and mileage logs throughout the year.
                </AlertDescription>
              </Alert>
            ) : null;
          })()}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ReceiptIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No expenses recorded</h3>
              <p className="mt-1 text-muted-foreground">
                {searchQuery ? "No results match your search" : "Add your first expense to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Vendor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Deductible</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Deductible GST</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((item) => {
                    // Calculate deductible amount and deductible GST using the helper function
                    const expenseType = ((item as any).expenseType ?? "self_employment") as string;
                    const { deductibleAmount, deductibleGst } = calculateDeductible(item, vehicleBusinessUseMap);
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-expense-${item.id}`}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium max-w-[12rem] truncate sm:max-w-none">{item.title || "—"}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground max-w-[16rem] truncate sm:max-w-none">{item.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={expenseType === "personal" ? "secondary" : expenseType === "mixed" ? "outline" : "default"} className="text-xs">
                            {getExpenseTypeLabel(expenseType)}
                            {expenseType === "mixed" && (item as any).businessUsePercentage && (
                              <span className="ml-1">({parseFloat((item as any).businessUsePercentage.toString()).toFixed(0)}%)</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell align-top max-w-[12rem] whitespace-normal break-words">
                          <Badge variant="outline" className="text-xs whitespace-normal break-words text-left">
                            {(() => {
                              if (expenseType === "personal") {
                                // All personal expense categories (including former general categories) use personal label
                                return getPersonalExpenseCategoryLabel(item.category);
                              }
                              // For all other expense types, use getCategoryLabel which handles all category types
                              return getCategoryLabel(item.category);
                            })()}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {item.vendor || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-red-600 dark:text-red-400">
                          -{formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground">
                          {formatCurrency(deductibleAmount)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground">
                          {formatCurrency(deductibleGst)}
                        </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingReceipt(receiptMap.get(item.id)!)}
                            data-testid={`button-view-receipt-${item.id}`}
                            title="View receipt"
                            className={receiptMap.has(item.id) ? "" : "invisible"}
                          >
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
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
                              <AlertDialogTitle>
                                {receiptMap.has(item.id) ? "Delete expense and receipt?" : "Delete expense entry?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {receiptMap.has(item.id) ? (
                                  <>
                                    This expense is linked to a receipt. Deleting will remove the expense.
                                    <br /><br />
                                    Would you like to also delete the linked receipt? This action cannot be undone.
                                  </>
                                ) : (
                                  <>This will permanently remove this expense record. This action cannot be undone.</>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                              {receiptMap.has(item.id) ? (
                                <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate({ expenseId: item.id })}
                                    className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                                  >
                                    Expense Only
                                  </AlertDialogAction>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate({ expenseId: item.id, alsoDeleteReceipt: receiptMap.get(item.id)!.id })}
                                    className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                                  >
                                    Both
                                  </AlertDialogAction>
                                </div>
                              ) : (
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ expenseId: item.id })}
                                  className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                                >
                                  Delete
                                </AlertDialogAction>
                              )}
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

      {/* Receipt View Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>
              {viewingReceipt?.notes || "View receipt image"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center bg-muted rounded-lg p-4">
            {viewingReceipt && (
              <img
                src={viewingReceipt.imageUrl}
                alt="Receipt"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReceipt(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
