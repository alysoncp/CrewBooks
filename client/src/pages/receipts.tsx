import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Trash2, Image, X, ZoomIn, FileImage, Scan, Lock, Sparkles, Link2, Camera, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Receipt, Expense, User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useTaxYear } from "@/components/tax-year-provider";
import { getTodayLocalDateString, getCategoryLabel, getExpenseTypeLabel, getPersonalExpenseCategoryLabel, formatCurrency, formatDate, getYearFromDateString } from "@/lib/format";
import { SELF_EMPLOYMENT_EXPENSE_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES, HOME_OFFICE_LIVING_CATEGORIES, VEHICLE_CATEGORIES, type Vehicle } from "@shared/schema";

function LockedContent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Lock className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold">Receipt Uploads</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Upgrade to Personal or Corporate plan to upload and manage receipt photos.
      </p>
      <Link href="/pricing">
        <Button className="mt-6" data-testid="button-upgrade-receipts">
          <Sparkles className="mr-2 h-4 w-4" />
          View Pricing Plans
        </Button>
      </Link>
    </div>
  );
}

const expenseFormSchema = z.object({
  baseCost: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, { message: "Base cost must be a valid number" }),
  total: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, { message: "Total must be a valid number" }),
  gstAmount: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, { message: "GST amount must be a valid number" }),
  pstAmount: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, { message: "PST amount must be a valid number" }),
  gstIncluded: z.boolean().default(false),
  pstIncluded: z.boolean().default(false),
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
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
  }, { message: "Business use percentage must be between 0 and 100" }),
}).refine((data) => {
  if (data.expenseType === "vehicle" && !data.vehicleId) return false;
  return true;
}, { message: "Please select a vehicle", path: ["vehicleId"] })
.refine((data) => {
  const baseCost = data.baseCost ? parseFloat(data.baseCost) : null;
  const total = data.total ? parseFloat(data.total) : null;
  return (baseCost !== null && !isNaN(baseCost) && baseCost > 0) || (total !== null && !isNaN(total) && total > 0);
}, { message: "Please enter either base cost or total amount", path: ["baseCost"] })
.refine((data) => {
  if (data.expenseType === "mixed") {
    const percentage = data.businessUsePercentage ? parseFloat(data.businessUsePercentage) : null;
    return percentage !== null && !isNaN(percentage) && percentage >= 0 && percentage <= 100;
  }
  return true;
}, { message: "Business use percentage is required for mixed expenses (0-100%)", path: ["businessUsePercentage"] });

type ExpenseFormData = z.input<typeof expenseFormSchema>;

export default function ReceiptsPage() {
  const [isInitialDialogOpen, setIsInitialDialogOpen] = useState(false);
  const [isReceiptUploadDialogOpen, setIsReceiptUploadDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const [linkingReceiptId, setLinkingReceiptId] = useState<string | null>(null);
  const [receiptIdForExpense, setReceiptIdForExpense] = useState<string | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [lastEditedField, setLastEditedField] = useState<"baseCost" | "total" | "gstAmount" | "pstAmount" | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { taxYear } = useTaxYear();
  const hasGstNumber = user?.hasGstNumber === true;
  
  const isBasicTier = user?.subscriptionTier === "basic";
  const hasReceiptAccess = !isBasicTier;

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: userProfile } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onBlur",
    defaultValues: {
      baseCost: "",
      total: "",
      gstAmount: "",
      pstAmount: "",
      gstIncluded: true,
      pstIncluded: true,
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

  const expenseType = form.watch("expenseType");

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

  const enabledCategories = useMemo(() => {
    if (userProfile?.enabledExpenseCategories) {
      return new Set(userProfile.enabledExpenseCategories as string[]);
    }
    return new Set(Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES));
  }, [userProfile]);

  const enabledPersonalCategories = useMemo(() => {
    if (userProfile?.enabledPersonalExpenseCategories) {
      return new Set(userProfile.enabledPersonalExpenseCategories as string[]);
    }
    return new Set(Array.from(PERSONAL_EXPENSE_CATEGORIES));
  }, [userProfile]);

  const availableCategories = useMemo(() => {
    if (expenseType === "home_office_living") {
      return Array.from(new Set([...HOME_OFFICE_LIVING_CATEGORIES]));
    } else if (expenseType === "vehicle") {
      return Array.from(new Set([...VEHICLE_CATEGORIES]));
    } else if (expenseType === "self_employment") {
      const filteredCustomCategories = customCategories.filter(cat => 
        !HOME_OFFICE_LIVING_CATEGORIES.includes(cat as any) &&
        !VEHICLE_CATEGORIES.includes(cat as any) &&
        !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)
      );
      const enabledSelfEmployment = Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES).filter(cat => 
        enabledCategories.has(cat)
      );
      return Array.from(new Set([...enabledSelfEmployment, ...filteredCustomCategories]));
    } else if (expenseType === "personal") {
      const enabledPersonal = Array.from(PERSONAL_EXPENSE_CATEGORIES).filter(cat => 
        enabledPersonalCategories.has(cat)
      );
      return Array.from(new Set([...enabledPersonal, ...customPersonalCategories]));
    } else if (expenseType === "mixed") {
      const filteredCustomCategories = customCategories.filter(cat => 
        !HOME_OFFICE_LIVING_CATEGORIES.includes(cat as any) &&
        !VEHICLE_CATEGORIES.includes(cat as any) &&
        !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)
      );
      const enabledSelfEmployment = Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES).filter(cat => 
        enabledCategories.has(cat)
      );
      return Array.from(new Set([...enabledSelfEmployment, ...filteredCustomCategories]));
    }
    return [];
  }, [customCategories, customPersonalCategories, expenseType, enabledCategories, enabledPersonalCategories]);

  const baseCostValue = form.watch("baseCost");
  const totalValue = form.watch("total");
  const gstAmountValue = form.watch("gstAmount");
  const pstAmountValue = form.watch("pstAmount");
  const gstIncluded = form.watch("gstIncluded");
  const pstIncluded = form.watch("pstIncluded");

  useEffect(() => {
    if (lastEditedField === "baseCost" && baseCostValue) {
      const base = parseFloat(baseCostValue);
      const gst = gstAmountValue ? parseFloat(gstAmountValue) : 0;
      const pst = pstAmountValue ? parseFloat(pstAmountValue) : 0;
      if (!isNaN(base) && base >= 0) {
        const total = base + gst + pst;
        form.setValue("total", total.toFixed(2), { shouldValidate: false });
      }
    }
  }, [baseCostValue, gstAmountValue, pstAmountValue, lastEditedField, form]);

  useEffect(() => {
    if (lastEditedField === "total" && totalValue) {
      const total = parseFloat(totalValue);
      if (!isNaN(total) && total >= 0) {
        if (gstIncluded && pstIncluded) {
          const base = total / 1.12;
          const gst = base * 0.05;
          const pst = base * 0.07;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", gst.toFixed(2), { shouldValidate: false });
          form.setValue("pstAmount", pst.toFixed(2), { shouldValidate: false });
        } else if (gstIncluded) {
          const base = total / 1.05;
          const gst = base * 0.05;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", gst.toFixed(2), { shouldValidate: false });
          form.setValue("pstAmount", "", { shouldValidate: false });
        } else if (pstIncluded) {
          const base = total / 1.07;
          const pst = base * 0.07;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", "", { shouldValidate: false });
          form.setValue("pstAmount", pst.toFixed(2), { shouldValidate: false });
        } else {
          const base = total;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", "", { shouldValidate: false });
          form.setValue("pstAmount", "", { shouldValidate: false });
        }
      }
    }
  }, [totalValue, gstIncluded, pstIncluded, lastEditedField, form]);

  useEffect(() => {
    if (lastEditedField === "total" && totalValue && (gstIncluded || pstIncluded)) {
      const total = parseFloat(totalValue);
      if (!isNaN(total) && total >= 0) {
        if (gstIncluded && pstIncluded) {
          const base = total / 1.12;
          const gst = base * 0.05;
          const pst = base * 0.07;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", gst.toFixed(2), { shouldValidate: false });
          form.setValue("pstAmount", pst.toFixed(2), { shouldValidate: false });
        } else if (gstIncluded) {
          const base = total / 1.05;
          const gst = base * 0.05;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", gst.toFixed(2), { shouldValidate: false });
          form.setValue("pstAmount", "", { shouldValidate: false });
        } else if (pstIncluded) {
          const base = total / 1.07;
          const pst = base * 0.07;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", "", { shouldValidate: false });
          form.setValue("pstAmount", pst.toFixed(2), { shouldValidate: false });
        } else {
          const base = total;
          form.setValue("baseCost", base.toFixed(2), { shouldValidate: false });
          form.setValue("gstAmount", "", { shouldValidate: false });
          form.setValue("pstAmount", "", { shouldValidate: false });
        }
      }
    }
  }, [gstIncluded, pstIncluded, totalValue, lastEditedField, form]);

  useEffect(() => {
    if ((lastEditedField === "gstAmount" || lastEditedField === "pstAmount") && baseCostValue) {
      const base = parseFloat(baseCostValue);
      const gst = gstAmountValue ? parseFloat(gstAmountValue) : 0;
      const pst = pstAmountValue ? parseFloat(pstAmountValue) : 0;
      if (!isNaN(base) && base >= 0) {
        const total = base + gst + pst;
        form.setValue("total", total.toFixed(2), { shouldValidate: false });
      }
    }
  }, [gstAmountValue, pstAmountValue, baseCostValue, lastEditedField, form]);

  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      let baseCost = data.baseCost ? parseFloat(data.baseCost) : 0;
      let gstAmount = 0;
      let pstAmount = 0;
      let amount = 0;

      if (data.gstIncluded && data.gstAmount) {
        gstAmount = parseFloat(data.gstAmount);
      }
      if (data.pstIncluded && data.pstAmount) {
        pstAmount = parseFloat(data.pstAmount);
      }

      if (data.total) {
        amount = parseFloat(data.total);
        if (!baseCost || baseCost === 0) {
          baseCost = amount - gstAmount - pstAmount;
        }
      } else {
        amount = baseCost + gstAmount + pstAmount;
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
        expenseType: data.expenseType || "self_employment",
        businessUsePercentage: data.businessUsePercentage ? data.businessUsePercentage.toString() : null,
      };
      
      if (receiptIdForExpense) {
        payload.linkedReceiptId = receiptIdForExpense;
      }
      
      return apiRequest("POST", "/api/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
      setIsExpenseDialogOpen(false);
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

  const onSubmit = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("notes", notes);
      formData.append("scanWithOCR", scanWithOCR.toString());
      
      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      
      // Close receipt upload dialog and clear state
      setIsReceiptUploadDialogOpen(false);
      setPreviewFiles([]);
      setNotes("");
      setScanWithOCR(false);
      
      // Always open expense dialog after upload, regardless of OCR status
      if (data && Array.isArray(data) && data.length > 0) {
        const firstReceipt = data[0];
        
        if (firstReceipt.id) {
          setReceiptIdForExpense(firstReceipt.id);
          
          // Fetch receipt data to get image URL
          try {
            const receiptResponse = await fetch(`/api/receipts/${firstReceipt.id}`);
            const receipt = await receiptResponse.json();
            if (receipt?.imageUrl) {
              setReceiptImageUrl(receipt.imageUrl);
            }
          } catch (error) {
            // Ignore error, continue without image
          }
          
          // Try to fetch OCR data and pre-fill form (if available)
          try {
            const ocrResponse = await fetch(`/api/receipts/${firstReceipt.id}/ocr-to-expense`);
            if (ocrResponse.ok) {
              const ocrData = await ocrResponse.json();
              
              if (ocrData && !ocrData.error && ocrData.expenseData) {
                if (ocrData.confidence && ocrData.confidence < 0.7) {
                  toast({
                    title: "Low confidence",
                    description: "OCR results have low confidence. Please verify all fields before submitting.",
                    variant: "default",
                  });
                }
                
                const ocrAmount = ocrData.expenseData.amount ? parseFloat(ocrData.expenseData.amount.toString()) : 0;
                const ocrGstAmount = ocrData.expenseData.gstAmount ? parseFloat(ocrData.expenseData.gstAmount.toString()) : 0;
                const ocrPstAmount = ocrData.expenseData.pstAmount ? parseFloat(ocrData.expenseData.pstAmount.toString()) : 0;
                form.reset({
                  baseCost: ocrData.expenseData.baseCost ? parseFloat(ocrData.expenseData.baseCost.toString()).toFixed(2) : "",
                  total: ocrAmount > 0 ? ocrAmount.toFixed(2) : "",
                  gstAmount: ocrGstAmount > 0 ? ocrGstAmount.toFixed(2) : "",
                  pstAmount: ocrPstAmount > 0 ? ocrPstAmount.toFixed(2) : "",
                  gstIncluded: ocrGstAmount > 0,
                  pstIncluded: ocrPstAmount > 0,
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
                form.reset({
                  baseCost: "",
                  total: "",
                  gstAmount: "",
                  pstAmount: "",
                  gstIncluded: true,
                  pstIncluded: true,
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
            } else {
              form.reset({
                baseCost: "",
                total: "",
                gstAmount: "",
                pstAmount: "",
                gstIncluded: true,
                pstIncluded: true,
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
            form.reset({
              baseCost: "",
              total: "",
              gstAmount: "",
              pstAmount: "",
              gstIncluded: true,
              pstIncluded: true,
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
          setTimeout(() => setIsExpenseDialogOpen(true), 0);
          
          // Show appropriate toast
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

  const deleteMutation = useMutation({
    mutationFn: async ({ receiptId, alsoDeleteExpense }: { receiptId: string; alsoDeleteExpense?: string }) => {
      // Delete receipt first
      await apiRequest("DELETE", `/api/receipts/${receiptId}`);
      // If also deleting expense, delete it too
      if (alsoDeleteExpense) {
        await apiRequest("DELETE", `/api/expenses/${alsoDeleteExpense}`);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      if (variables.alsoDeleteExpense) {
        queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/gst-hst"] });
        toast({
          title: "Receipt and expense deleted",
          description: "The receipt and its linked expense have been removed.",
        });
      } else {
        toast({
          title: "Receipt deleted",
          description: "The receipt has been removed.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete receipt. Please try again.",
        variant: "destructive",
      });
    },
  });

  const linkReceiptMutation = useMutation({
    mutationFn: async ({ receiptId, expenseId }: { receiptId: string; expenseId: string | null }) => {
      return apiRequest("PATCH", `/api/receipts/${receiptId}`, {
        linkedExpenseId: expenseId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setLinkingReceiptId(null);
      toast({
        title: variables.expenseId ? "Receipt linked" : "Receipt unlinked",
        description: variables.expenseId 
          ? "The receipt has been linked to the expense." 
          : "The receipt has been unlinked from the expense.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to link receipt. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddExpenseClick = () => {
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
      setIsExpenseDialogOpen(true);
    }
  };

  const handleLinkReceipt = (receipt: Receipt) => {
    setLinkingReceiptId(receipt.id);
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  }, []);

  const removePreview = useCallback((index: number) => {
    setPreviewFiles((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  }, []);

  const handleUpload = () => {
    if (previewFiles.length === 0) return;
    uploadMutation.mutate(previewFiles.map((p) => p.file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Filter receipts to only show those linked to expenses in the current tax year
  const filteredReceipts = useMemo(() => {
    if (!receipts || !expenses) return [];
    
    return receipts.filter((receipt) => {
      // If receipt is not linked to an expense, exclude it (or include it if you want unlinked receipts)
      if (!receipt.linkedExpenseId) return false;
      
      // Find the linked expense
      const linkedExpense = expenses.find(exp => exp.id === receipt.linkedExpenseId);
      if (!linkedExpense) return false;
      
      // Check if the expense date is in the current tax year
      const expenseYear = getYearFromDateString(linkedExpense.date);
      return expenseYear === taxYear;
    });
  }, [receipts, expenses, taxYear]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-receipts-title">Receipts</h1>
          <p className="text-muted-foreground">Upload and manage your receipt photos</p>
        </div>
        {hasReceiptAccess && (
          <Button 
            data-testid="button-add-expense"
            onClick={handleAddExpenseClick}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        )}
        {!hasReceiptAccess && (
          <Link href="/pricing">
            <Button data-testid="button-upgrade-receipts-header">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to Upload Receipts
            </Button>
          </Link>
        )}
      </div>

      {/* Initial Selection Dialog */}
      {hasReceiptAccess && (
        <Dialog 
          open={isInitialDialogOpen} 
          onOpenChange={(open) => {
            setIsInitialDialogOpen(open);
            if (!open) {
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
      )}

      {/* Receipt Upload Dialog */}
      {hasReceiptAccess && (
        <Dialog 
          open={isReceiptUploadDialogOpen} 
          onOpenChange={(open) => {
            setIsReceiptUploadDialogOpen(open);
            if (!open) {
              setPreviewFiles([]);
              setNotes("");
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
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => document.getElementById("file-input")?.click()}
                  data-testid="dropzone-receipt"
                >
                  <Image className="mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop images here, or click to select
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports: JPG, PNG, HEIC
                  </p>
                  <Input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
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
                            removePreview(index);
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
                    placeholder="Add notes about these receipts..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    data-testid="input-receipt-notes"
                  />
                </div>

                <div className="flex items-center space-x-2 rounded-lg border p-4">
                  <Switch
                    id="scan-ocr"
                    checked={scanWithOCR}
                    onCheckedChange={setScanWithOCR}
                    data-testid="switch-scan-ocr"
                  />
                  <Label htmlFor="scan-ocr" className="cursor-pointer">
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
                  onClick={handleUpload}
                  disabled={previewFiles.length === 0 || uploadMutation.isPending}
                  data-testid="button-submit-receipt"
                >
                  {uploadMutation.isPending ? "Uploading..." : `Upload ${previewFiles.length} Receipt${previewFiles.length !== 1 ? "s" : ""}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      {/* Expense Dialog */}
      {hasReceiptAccess && (
        <Dialog 
          open={isExpenseDialogOpen} 
          onOpenChange={(open) => {
            setIsExpenseDialogOpen(open);
            if (!open) {
              setReceiptIdForExpense(null);
              setReceiptImageUrl(null);
              setLastEditedField(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {receiptIdForExpense 
                  ? "Create Expense from Receipt" 
                  : "Add Expense"}
              </DialogTitle>
              <DialogDescription>
                {receiptIdForExpense 
                  ? "Review and confirm the extracted expense data from your receipt." 
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

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <FormField
                            control={form.control}
                            name="gstIncluded"
                            render={({ field: checkboxField }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={checkboxField.value}
                                    onCheckedChange={(checked) => {
                                      checkboxField.onChange(checked);
                                      if (!checked) {
                                        form.setValue("gstAmount", "");
                                      }
                                    }}
                                    data-testid="switch-gst-included"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormLabel className="!mt-0">GST Amount</FormLabel>
                        </div>
                        <FormField
                          control={form.control}
                          name="gstAmount"
                          render={({ field }) => (
                            <FormItem>
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
                                    disabled={!gstIncluded}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setLastEditedField("gstAmount");
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <FormField
                            control={form.control}
                            name="pstIncluded"
                            render={({ field: checkboxField }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={checkboxField.value}
                                    onCheckedChange={(checked) => {
                                      checkboxField.onChange(checked);
                                      if (!checked) {
                                        form.setValue("pstAmount", "");
                                      }
                                    }}
                                    data-testid="switch-pst-included"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormLabel className="!mt-0">PST Amount</FormLabel>
                        </div>
                        <FormField
                          control={form.control}
                          name="pstAmount"
                          render={({ field }) => (
                            <FormItem>
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
                                    data-testid="input-expense-pst-amount"
                                    disabled={!pstIncluded}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setLastEditedField("pstAmount");
                                    }}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
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
                    name="expenseType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Type</FormLabel>
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
                            {availableCategories.map((category: string) => {
                              let label = getCategoryLabel(category);
                              if (expenseType === "personal") {
                                if (PERSONAL_EXPENSE_CATEGORIES.includes(category as any)) {
                                  label = getPersonalExpenseCategoryLabel(category);
                                } else {
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
              <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-submit-expense" onClick={form.handleSubmit(onSubmit)}>
                {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Receipt Gallery</CardTitle>
          <CardDescription>
            {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? "s" : ""} linked to expenses in {taxYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasReceiptAccess ? (
            <LockedContent />
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileImage className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No receipts for {taxYear}</h3>
              <p className="mt-1 text-muted-foreground">
                No receipts linked to expenses in {taxYear}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.id} className="group relative" data-testid={`card-receipt-${receipt.id}`}>
                  <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                    <img
                      src={receipt.imageUrl}
                      alt="Receipt"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setSelectedImage(receipt.imageUrl)}
                      data-testid={`button-zoom-receipt-${receipt.id}`}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => handleLinkReceipt(receipt)}
                      data-testid={`button-link-receipt-${receipt.id}`}
                      title={receipt.linkedExpenseId ? "Change linked expense" : "Link to expense"}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          data-testid={`button-delete-receipt-${receipt.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {receipt.linkedExpenseId ? "Delete receipt and expense?" : "Delete receipt?"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {receipt.linkedExpenseId ? (
                              <>
                                This receipt is linked to an expense. Deleting will remove the receipt.
                                <br /><br />
                                Would you like to also delete the linked expense? This action cannot be undone.
                              </>
                            ) : (
                              <>This will permanently remove this receipt image. This action cannot be undone.</>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                          {receipt.linkedExpenseId ? (
                            <div className="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate({ receiptId: receipt.id })}
                                className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                              >
                                Receipt Only
                              </AlertDialogAction>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate({ receiptId: receipt.id, alsoDeleteExpense: receipt.linkedExpenseId! })}
                                className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                              >
                                Both
                              </AlertDialogAction>
                            </div>
                          ) : (
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate({ receiptId: receipt.id })}
                              className="bg-destructive text-destructive-foreground w-full sm:w-auto"
                            >
                              Delete
                            </AlertDialogAction>
                          )}
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {receipt.notes && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">{receipt.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {receipt.uploadedAt ? formatDate(receipt.uploadedAt) : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Receipt full view"
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Link Receipt Dialog */}
      <Dialog open={!!linkingReceiptId} onOpenChange={(open) => !open && setLinkingReceiptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Receipt to Expense</DialogTitle>
            <DialogDescription>
              Select an expense to link this receipt to, or leave blank to unlink.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={receipts?.find(r => r.id === linkingReceiptId)?.linkedExpenseId || "none"}
              onValueChange={(value) => {
                if (linkingReceiptId) {
                  linkReceiptMutation.mutate({ 
                    receiptId: linkingReceiptId, 
                    expenseId: value === "none" ? null : value 
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an expense" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No expense (unlink)</SelectItem>
                {(expenses || []).map((expense) => (
                  <SelectItem key={expense.id} value={expense.id}>
                    {formatDate(expense.date)} - {expense.title || getCategoryLabel(expense.category)} - {formatCurrency(expense.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {expenses !== undefined && expenses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No expenses found. Create an expense first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkingReceiptId(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
