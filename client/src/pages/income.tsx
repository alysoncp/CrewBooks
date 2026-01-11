import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, FileText, Search, DollarSign, Receipt, TrendingUp, Pencil, Upload, Image, X, Scan, Camera } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, getIncomeTypeLabel, getIncomeCategoryLabel, getTodayLocalDateString, getYearFromDateString } from "@/lib/format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { INCOME_TYPES, INCOME_CATEGORIES, type Income, type User, type Paystub } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useTaxYear } from "@/components/tax-year-provider";

const optionalNumberField = z.string().optional().refine((val) => {
  if (!val || val.trim() === "") return true;
  const num = parseFloat(val);
  return !isNaN(num) && isFinite(num) && num >= 0;
}, {
  message: "Must be a valid number",
}).transform((v) => v ? parseFloat(v) : undefined);

const incomeFormSchema = z.object({
  incomeCategory: z.string().min(1, "Income category is required"),
  grossPay: optionalNumberField,
  amount: z.string().min(1, "Amount is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Amount must be a valid number",
  }).transform((v) => parseFloat(v)),
  date: z.string().min(1, "Date is required"),
  incomeType: z.string().optional(),
  // Film/TV fields
  productionName: z.string().optional(),
  accountingOffice: z.string().optional(),
  // Regular Employment fields
  employerName: z.string().optional(),
  cppContribution: optionalNumberField,
  eiContribution: optionalNumberField,
  incomeTaxDeduction: optionalNumberField,
  // Other Self-Employment fields
  businessName: z.string().optional(),
  // Common fields
  description: z.string().optional(),
  gstHstCollected: optionalNumberField,
  dues: optionalNumberField,
  retirement: optionalNumberField,
  labour: optionalNumberField,
  buyout: optionalNumberField,
  pension: optionalNumberField,
  insurance: optionalNumberField,
});

type IncomeFormData = z.input<typeof incomeFormSchema>;

const ACCOUNTING_OFFICES = [
  { value: "entertainment_partners_canada", label: "Entertainment Partners Canada" },
  { value: "cast_and_crew_services", label: "Cast and Crew Services" },
  { value: "other", label: "Other" },
] as const;

const INCOME_CATEGORY_OPTIONS = [
  { value: INCOME_CATEGORIES.FILM_TV, label: "Film/TV Income" },
  { value: INCOME_CATEGORIES.REGULAR_EMPLOYMENT, label: "Regular Employment Income" },
  { value: INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT, label: "Other Self-Employment" },
  { value: INCOME_CATEGORIES.OTHER, label: "Other" },
];

export default function IncomePage() {
  const [isInitialDialogOpen, setIsInitialDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaystubUploadDialogOpen, setIsPaystubUploadDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [incomeCategoryFilter, setIncomeCategoryFilter] = useState<string>("all");
  const [showFilter, setShowFilter] = useState<string>("all");
  const [customAccountingOffice, setCustomAccountingOffice] = useState("");
  const [paystubIdForIncome, setPaystubIdForIncome] = useState<string | null>(null);
  const [paystubImageUrl, setPaystubImageUrl] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [paystubNotes, setPaystubNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const { taxYear } = useTaxYear();
  const { toast } = useToast();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;

  // Check if user's UBCP status allows Retirement/Insurance fields
  const showRetirementAndInsurance = useMemo(() => {
    if (!user?.unionAffiliations) return true; // Show if no union affiliations
    
    const ubcpAffiliation = user.unionAffiliations.find(
      (affiliation: { unionId: string; level: string }) => affiliation.unionId === "ubcp"
    );
    
    if (!ubcpAffiliation) return true; // Show if no UBCP affiliation
    
    // Only show for "full" members, hide for "apprentice" and "background"
    return ubcpAffiliation.level === "full";
  }, [user?.unionAffiliations]);

  const { data: incomeList, isLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(incomeFormSchema),
    mode: "onBlur", // Validate on blur for immediate feedback
    defaultValues: {
      incomeCategory: "",
      grossPay: "",
      amount: "",
      date: getTodayLocalDateString(),
      incomeType: "",
      productionName: "",
      accountingOffice: "",
      employerName: "",
      businessName: "",
      description: "",
      cppContribution: "",
      eiContribution: "",
      incomeTaxDeduction: "",
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
        grossPay: data.grossPay?.toString() || null,
        amount: data.amount.toString(),
        accountingOffice: data.accountingOffice || null,
        employerName: data.employerName || null,
        businessName: data.businessName || null,
        description: data.description || null,
        cppContribution: data.cppContribution?.toString() || null,
        eiContribution: data.eiContribution?.toString() || null,
        incomeTaxDeduction: data.incomeTaxDeduction?.toString() || null,
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
    onSuccess: async () => {
      // Invalidate and refetch queries to ensure the list updates
      await queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      await queryClient.refetchQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsDialogOpen(false);
      setSelectedCategory(null);
      form.reset();
      setEditingIncome(null);
      setCustomAccountingOffice(""); // Reset custom value
      const hadPaystub = !!paystubIdForIncome;
      setPaystubIdForIncome(null);
      setPaystubImageUrl(null);
      toast({
        title: "Income added",
        description: hadPaystub ? "Your income has been created from the paystub." : "Your income has been recorded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add income. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: IncomeFormData) => {
      if (!editingIncome) throw new Error("No income selected for editing");
      
      const payload: any = {
        ...data,
        grossPay: data.grossPay?.toString() || null,
        amount: data.amount.toString(),
        accountingOffice: data.accountingOffice || null,
        employerName: data.employerName || null,
        businessName: data.businessName || null,
        description: data.description || null,
        cppContribution: data.cppContribution?.toString() || null,
        eiContribution: data.eiContribution?.toString() || null,
        incomeTaxDeduction: data.incomeTaxDeduction?.toString() || null,
        gstHstCollected: data.gstHstCollected?.toString() || null,
        dues: data.dues?.toString() || null,
        retirement: data.retirement?.toString() || null,
        labour: data.labour?.toString() || null,
        buyout: data.buyout?.toString() || null,
        pension: data.pension?.toString() || null,
        insurance: data.insurance?.toString() || null,
      };
      
      const response = await apiRequest("PATCH", `/api/income/${editingIncome.id}`, payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsDialogOpen(false);
      setSelectedCategory(null);
      form.reset();
      setEditingIncome(null);
      setCustomAccountingOffice("");
      toast({
        title: "Income updated",
        description: "Your income has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update income. Please try again.",
        variant: "destructive",
      });
    },
  });

  const paystubUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("notes", paystubNotes);
      formData.append("scanWithOCR", scanWithOCR.toString());
      
      const response = await fetch("/api/paystubs/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      
      // Close upload dialog and reset state
      setIsPaystubUploadDialogOpen(false);
      setPreviewFiles([]);
      setPaystubNotes("");
      setScanWithOCR(false);
      
      // Always open income dialog after upload, regardless of OCR status
      if (data && Array.isArray(data) && data.length > 0) {
        const firstPaystub = data[0];
        
        if (firstPaystub.id) {
          // Reset form and state before setting new values
          form.reset();
          setSelectedCategory(null);
          setCustomAccountingOffice("");
          setEditingIncome(null);
          
          // Set up for income creation from paystub
          setPaystubIdForIncome(firstPaystub.id);
          if (firstPaystub.imageUrl) {
            setPaystubImageUrl(firstPaystub.imageUrl);
          }
          
          // If we have income data from OCR, populate the form
          if (firstPaystub.incomeData && firstPaystub.ocrStatus === "completed") {
            const incomeData = firstPaystub.incomeData;
            form.setValue("incomeCategory", incomeData.incomeCategory || INCOME_CATEGORIES.FILM_TV);
            form.setValue("date", incomeData.date || getTodayLocalDateString());
            form.setValue("amount", incomeData.amount?.toString() || "");
            form.setValue("grossPay", incomeData.grossPay?.toString() || "");
            form.setValue("incomeType", incomeData.incomeType || "");
            form.setValue("productionName", incomeData.productionName || "");
            form.setValue("accountingOffice", incomeData.accountingOffice || "");
            setSelectedCategory(incomeData.incomeCategory || INCOME_CATEGORIES.FILM_TV);
            
            toast({
              title: "Paystub scanned",
              description: "Review and confirm the extracted income data.",
            });
          } else {
            // No OCR data, leave category empty for user to select
            // Don't set a default - let user choose the income type
            
            toast({
              title: "Paystub uploaded",
              description: "Create an income entry for this paystub.",
            });
          }
          
          // Always open the income dialog
          setIsDialogOpen(true);
        } else {
          // Fallback: just show success message if no paystub ID
          toast({
            title: "Paystubs uploaded",
            description: "Your paystubs have been saved successfully.",
          });
        }
      } else {
        // Fallback: just show success message if no data
        toast({
          title: "Paystubs uploaded",
          description: "Your paystubs have been saved successfully.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload paystubs. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePaystubUpload = () => {
    if (previewFiles.length === 0) return;
    paystubUploadMutation.mutate(previewFiles.map((p) => p.file));
  };

  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);
  const [linkedPaystubs, setLinkedPaystubs] = useState<any[]>([]);
  const [deleteLinkedPaystubs, setDeleteLinkedPaystubs] = useState(false);

  const { data: linkedPaystubsData } = useQuery({
    queryKey: ["/api/income", deletingIncomeId, "linked-paystubs"],
    queryFn: async () => {
      if (!deletingIncomeId) return [];
      const response = await fetch(`/api/income/${deletingIncomeId}/linked-paystubs`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!deletingIncomeId,
  });

  useEffect(() => {
    if (linkedPaystubsData) {
      setLinkedPaystubs(linkedPaystubsData);
    }
  }, [linkedPaystubsData]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteLinked }: { id: string; deleteLinked: boolean }) => {
      const url = `/api/income/${id}${deleteLinked ? "?deleteLinkedPaystubs=true" : ""}`;
      return apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDeletingIncomeId(null);
      setLinkedPaystubs([]);
      setDeleteLinkedPaystubs(false);
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
    
    const formData = {
      ...data,
      accountingOffice: accountingOfficeValue || data.accountingOffice,
    };
    
    if (editingIncome) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setSelectedCategory(income.incomeCategory || INCOME_CATEGORIES.FILM_TV);
    setCustomAccountingOffice("");
    
    // Pre-fill form with income data
    form.reset({
      incomeCategory: income.incomeCategory || INCOME_CATEGORIES.FILM_TV,
      grossPay: income.grossPay ? income.grossPay.toString() : "",
      amount: income.amount.toString(),
      date: income.date,
      incomeType: income.incomeType,
      productionName: income.productionName || "",
      accountingOffice: income.accountingOffice || "",
      employerName: income.employerName || "",
      businessName: income.businessName || "",
      description: income.description || "",
      cppContribution: income.cppContribution ? income.cppContribution.toString() : "",
      eiContribution: income.eiContribution ? income.eiContribution.toString() : "",
      incomeTaxDeduction: income.incomeTaxDeduction ? income.incomeTaxDeduction.toString() : "",
      gstHstCollected: income.gstHstCollected ? income.gstHstCollected.toString() : "",
      dues: "",
      retirement: "",
      labour: "",
      buyout: "",
      pension: "",
      insurance: "",
    });
    
    // Handle custom accounting office
    if (income.accountingOffice && !ACCOUNTING_OFFICES.find(o => o.value === income.accountingOffice)) {
      setCustomAccountingOffice(income.accountingOffice);
      form.setValue("accountingOffice", "other");
    }
    
    setIsDialogOpen(true);
  };

  const handleAddIncomeClick = () => {
    setEditingIncome(null);
    form.reset();
    setCustomAccountingOffice("");
    setSelectedCategory(null);
    setIsInitialDialogOpen(true);
  };

  const handleInitialDialogSelect = (mode: 'upload' | 'manual' | 'cancel') => {
    setIsInitialDialogOpen(false);
    if (mode === 'upload') {
      setIsPaystubUploadDialogOpen(true);
    } else if (mode === 'manual') {
      setIsDialogOpen(true);
    }
  };

  const handlePaystubFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviewFiles((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePreview = (index: number) => {
    setPreviewFiles((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Check for paystubId and category in URL params
  useEffect(() => {
    console.log("=== INCOME PAGE useEffect RUNNING ===");
    const params = new URLSearchParams(window.location.search);
    const paystubId = params.get("paystubId");
    const category = params.get("category");
    console.log("=== PAYSTUB ID FROM URL ===", paystubId);
    console.log("=== CATEGORY FROM URL ===", category);
    console.log("Current URL:", window.location.href);
    if (paystubId) {
      setPaystubIdForIncome(paystubId);
      // If category is provided, set it
      if (category) {
        setSelectedCategory(category);
      }
      // Fetch paystub data to get image URL
      console.log("Fetching paystub data for:", paystubId);
      fetch(`/api/paystubs/${paystubId}`)
        .then((res) => {
          console.log("Paystub fetch response status:", res.status);
          return res.json();
        })
        .then((paystub) => {
          console.log("Paystub data:", paystub);
          if (paystub?.imageUrl) {
            setPaystubImageUrl(paystub.imageUrl);
          }
        })
        .catch((err) => {
          console.error("Error fetching paystub:", err);
        });
      
      // Try to fetch OCR data and pre-fill form (if available)
      console.log("Fetching OCR data for paystub:", paystubId);
      fetch(`/api/paystubs/${paystubId}/ocr-to-income`)
        .then(async (res) => {
          console.log("OCR fetch response status:", res.status, res.statusText);
          console.log("OCR fetch response headers:", Object.fromEntries(res.headers.entries()));
          if (!res.ok) {
            // If OCR data doesn't exist (404 or 400), that's fine - just open blank form
            if (res.status === 404 || res.status === 400) {
              console.log("OCR data not found (404/400), returning null");
              return null;
            }
            throw new Error(`Failed to fetch OCR data: ${res.statusText}`);
          }
          // Check content type
          const contentType = res.headers.get("content-type");
          console.log("Response content-type:", contentType);
          if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text();
            console.error("Response is not JSON. Content:", text.substring(0, 500));
            throw new Error(`Expected JSON but got ${contentType}`);
          }
          return res.json();
        })
        .then((data) => {
          // Debug: Log the OCR response
          console.log("=== OCR TO INCOME RESPONSE ===", data);
          console.log("Income Data:", data?.incomeData);
          console.log("Confidence:", data?.confidence);
          console.log("Issuer:", data?.issuer);
          console.log("Validation Errors:", data?.validationErrors);
          console.log("Raw OCR Data:", data?.rawOCRData);
          
          // Use category from URL if available
          const urlCategory = params.get("category");
          const categoryToUse = urlCategory || data?.incomeData?.incomeCategory || INCOME_CATEGORIES.FILM_TV;
          
          // Clear URL params
          window.history.replaceState({}, "", "/income");
          
          // Set category from URL if provided, otherwise use data or default
          if (!data?.incomeData?.incomeCategory) {
            data.incomeData = data.incomeData || {};
            const urlCategory = params.get("category");
            data.incomeData.incomeCategory = urlCategory || INCOME_CATEGORIES.FILM_TV;
          }
          
          if (data && !data.error && data.incomeData) {
            // Warn if confidence is low
            if (data.confidence && data.confidence < 0.7) {
              toast({
                title: "Low confidence",
                description: "OCR results have low confidence. Please verify all fields before submitting.",
                variant: "default",
              });
            }
            
            // Show validation errors if any
            if (data.validationErrors && data.validationErrors.length > 0) {
              toast({
                title: "Validation warnings",
                description: data.validationErrors.join(", "),
                variant: "default",
              });
            }
            
            // Pre-fill form with OCR data
            const ocrAmount = data.incomeData.amount ? parseFloat(data.incomeData.amount.toString()) : 0;
            const ocrGrossPay = data.incomeData.grossPay ? parseFloat(data.incomeData.grossPay.toString()) : 0;
            console.log("Setting form values:", {
              grossPay: ocrGrossPay,
              amount: ocrAmount,
              date: data.incomeData.date,
              incomeType: data.incomeData.incomeType,
              productionName: data.incomeData.productionName,
              accountingOffice: data.incomeData.accountingOffice,
            });
            const category = categoryToUse;
            setSelectedCategory(category);
            form.reset({
              incomeCategory: category,
              grossPay: ocrGrossPay > 0 ? ocrGrossPay.toString() : "",
              amount: ocrAmount > 0 ? ocrAmount.toString() : "",
              date: data.incomeData.date || getTodayLocalDateString(),
              incomeType: data.incomeData.incomeType || "",
              productionName: data.incomeData.productionName || "",
              accountingOffice: data.incomeData.accountingOffice || "",
              employerName: data.incomeData.employerName || "",
              businessName: data.incomeData.businessName || "",
              description: data.incomeData.description || "",
              cppContribution: data.incomeData.cppContribution || "",
              eiContribution: data.incomeData.eiContribution || "",
              incomeTaxDeduction: data.incomeData.incomeTaxDeduction || "",
              gstHstCollected: data.incomeData.gstHstCollected || "",
              dues: data.incomeData.dues || "",
              retirement: data.incomeData.retirement || "",
              labour: data.incomeData.labour || "",
              buyout: data.incomeData.buyout || "",
              pension: data.incomeData.pension || "",
              insurance: data.incomeData.insurance || "",
            });
            
            // Set custom accounting office if needed
            if (data.incomeData.accountingOffice) {
              setCustomAccountingOffice(data.incomeData.accountingOffice);
            }
          } else {
            console.warn("No incomeData in response:", data);
            // Show toast if no data
            if (data && !data.error) {
              toast({
                title: "No OCR data",
                description: "OCR completed but no extractable data found. Please enter manually.",
                variant: "default",
              });
            }
            // If no OCR data, default to Film/TV and open dialog
            if (!paystubIdForIncome) {
              setSelectedCategory(INCOME_CATEGORIES.FILM_TV);
              form.setValue("incomeCategory", INCOME_CATEGORIES.FILM_TV);
            } else {
              // If paystub exists but no OCR data, default to Film/TV
              setSelectedCategory(INCOME_CATEGORIES.FILM_TV);
              form.setValue("incomeCategory", INCOME_CATEGORIES.FILM_TV);
            }
          }
          
          // Open dialog
          setIsDialogOpen(true);
        })
        .catch((err) => {
          console.error("Error fetching OCR data:", err);
          // If fetching OCR data fails, default to Film/TV and open dialog
          if (!paystubIdForIncome) {
            setSelectedCategory(INCOME_CATEGORIES.FILM_TV);
            form.setValue("incomeCategory", INCOME_CATEGORIES.FILM_TV);
            setIsDialogOpen(true);
          } else {
            // If paystub exists but fetch failed, default to Film/TV
            setSelectedCategory(INCOME_CATEGORIES.FILM_TV);
            form.setValue("incomeCategory", INCOME_CATEGORIES.FILM_TV);
            setIsDialogOpen(true);
          }
        });
    }
  }, [form, toast]);

  // Get unique income categories and shows from income for filter dropdowns
  const availableIncomeCategoriesForFilter = useMemo(() => {
    if (!incomeList) return [];
    const categories = new Set<string>();
    incomeList.forEach((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear === taxYear) {
        categories.add(item.incomeCategory || INCOME_CATEGORIES.FILM_TV);
      }
    });
    return Array.from(categories).sort();
  }, [incomeList, taxYear]);

  const availableShowsForFilter = useMemo(() => {
    if (!incomeList) return [];
    const shows = new Set<string>();
    incomeList.forEach((item) => {
      const itemYear = getYearFromDateString(item.date);
      if (itemYear === taxYear && item.productionName) {
        shows.add(item.productionName);
      }
    });
    return Array.from(shows).sort();
  }, [incomeList, taxYear]);

  // Filter income by year, search query, income category, and show
  const filteredIncome = useMemo(() => {
    return (incomeList || []).filter((item) => {
      // Filter by year - extract year directly from date string to avoid timezone issues
      const itemYear = getYearFromDateString(item.date);
      if (itemYear !== taxYear) return false;

      // Filter by income category
      if (incomeCategoryFilter !== "all") {
        const category = item.incomeCategory || INCOME_CATEGORIES.FILM_TV;
        if (category !== incomeCategoryFilter) {
          return false;
        }
      }

      // Filter by show (production name)
      if (showFilter !== "all" && item.productionName !== showFilter) {
        return false;
      }

      // Filter by search query
      const searchLower = searchQuery.toLowerCase();
      return (
        item.productionName?.toLowerCase().includes(searchLower) ||
        item.employerName?.toLowerCase().includes(searchLower) ||
        item.businessName?.toLowerCase().includes(searchLower) ||
        item.accountingOffice?.toLowerCase().includes(searchLower) ||
        getIncomeTypeLabel(item.incomeType).toLowerCase().includes(searchLower) ||
        getIncomeCategoryLabel(item.incomeCategory || INCOME_CATEGORIES.FILM_TV).toLowerCase().includes(searchLower)
      );
    });
  }, [incomeList, taxYear, searchQuery, incomeCategoryFilter, showFilter]);

  // Calculate totals by category
  const incomeByCategory = useMemo(() => {
    const categories: Record<string, { net: number; gross: number; gst: number }> = {};
    
    filteredIncome.forEach((item) => {
      const category = item.incomeCategory || INCOME_CATEGORIES.FILM_TV;
      if (!categories[category]) {
        categories[category] = { net: 0, gross: 0, gst: 0 };
      }
      
      const net = parseFloat(item.amount);
      const gst = item.gstHstCollected ? parseFloat(item.gstHstCollected.toString()) : 0;
      const gross = item.grossPay ? parseFloat(item.grossPay.toString()) : net + gst;
      
      categories[category].net += net;
      categories[category].gross += gross;
      categories[category].gst += gst;
    });
    
    return categories;
  }, [filteredIncome]);

  const totalNetIncome = filteredIncome.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const totalGstCollected = filteredIncome.reduce((sum, item) => {
    const gst = item.gstHstCollected ? parseFloat(item.gstHstCollected.toString()) : 0;
    return sum + gst;
  }, 0);
  const totalGrossIncome = filteredIncome.reduce((sum, item) => {
    const net = parseFloat(item.amount);
    const gst = item.gstHstCollected ? parseFloat(item.gstHstCollected.toString()) : 0;
    const gross = item.grossPay ? parseFloat(item.grossPay.toString()) : net + gst;
    return sum + gross;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-income-title">Income</h1>
          <p className="text-muted-foreground">Track your earnings from productions and gigs</p>
        </div>
        {/* Initial Selection Dialog */}
        <Dialog 
          open={isInitialDialogOpen && !editingIncome} 
          onOpenChange={(open) => {
            setIsInitialDialogOpen(open);
            if (!open && !editingIncome) {
              setSelectedCategory(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Income</DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                How would you like to add income?
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
                    <span className="font-medium">Upload a paystub</span>
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

        {/* Paystub Upload Dialog */}
        <Dialog 
          open={isPaystubUploadDialogOpen} 
          onOpenChange={(open) => {
            setIsPaystubUploadDialogOpen(open);
            if (!open) {
              setPreviewFiles([]);
              setPaystubNotes("");
              setScanWithOCR(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Upload Paystub</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById("paystub-file-input-income")?.click()}
                data-testid="dropzone-paystub-income"
              >
                <Image className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop images here, or click to select
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports: JPG, PNG, HEIC
                </p>
                <Input
                  id="paystub-file-input-income"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePaystubFileChange}
                  data-testid="input-file-paystub-income"
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
                          handleRemovePreview(index);
                        }}
                        data-testid={`button-remove-preview-income-${index}`}
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
                  placeholder="Add notes about this paystub..."
                  value={paystubNotes}
                  onChange={(e) => setPaystubNotes(e.target.value)}
                  data-testid="input-paystub-notes-income"
                />
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-4">
                <Switch
                  id="scan-ocr-paystub-income"
                  checked={scanWithOCR}
                  onCheckedChange={setScanWithOCR}
                  data-testid="switch-scan-ocr-paystub-income"
                />
                <Label htmlFor="scan-ocr-paystub-income" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Scan className="h-4 w-4" />
                    <span>Scan with OCR</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically extract paystub details using Veryfi OCR
                  </p>
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handlePaystubUpload}
                disabled={previewFiles.length === 0 || paystubUploadMutation.isPending}
                data-testid="button-submit-paystub-income"
              >
                {paystubUploadMutation.isPending ? "Uploading..." : `Upload ${previewFiles.length} Paystub${previewFiles.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Income Button - separate from dialogs */}
        <Button 
          data-testid="button-add-income"
          onClick={handleAddIncomeClick}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>

        {/* Main Income Dialog */}
        <Dialog 
          open={isDialogOpen} 
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              if (!editingIncome) {
                setSelectedCategory(null);
              }
              setEditingIncome(null);
              form.reset();
              setCustomAccountingOffice("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {editingIncome ? "Edit Income" : paystubIdForIncome ? "Create Income from Paystub" : "Add Income"}
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
                  {/* Income Type (Category) - Always visible at top */}
                  <FormField
                    control={form.control}
                    name="incomeCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Income Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setSelectedCategory(value);
                          }} 
                          value={field.value || selectedCategory || ""}
                          disabled={!!editingIncome}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-income-category">
                              <SelectValue placeholder="Select income type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INCOME_CATEGORY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* All fields conditional on income type selection */}
                  {form.watch("incomeCategory") && (
                    <>
                      {/* Common Fields */}
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
                        name="grossPay"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gross Pay (Optional)</FormLabel>
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
                                  data-testid="input-income-gross-pay"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{form.watch("incomeCategory") === INCOME_CATEGORIES.REGULAR_EMPLOYMENT ? "Net Pay" : "Net Income"}</FormLabel>
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

                      {/* Film/TV Income Fields */}
                      {form.watch("incomeCategory") === INCOME_CATEGORIES.FILM_TV && (
                        <>
                          <FormField
                            control={form.control}
                            name="incomeType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Show Type</FormLabel>
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
                                <FormLabel>Show</FormLabel>
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
                                <FormLabel>Issuer</FormLabel>
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
                                      <SelectValue placeholder="Select issuer" />
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
                        </>
                      )}

                      {/* Regular Employment Income Fields */}
                      {form.watch("incomeCategory") === INCOME_CATEGORIES.REGULAR_EMPLOYMENT && (
                        <>
                          <FormField
                            control={form.control}
                            name="employerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Employer Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g., ABC Company Ltd."
                                    data-testid="input-employer-name"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="cppContribution"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CPP Contribution (Optional)</FormLabel>
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
                                      data-testid="input-cpp-contribution"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="eiContribution"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>EI Contribution (Optional)</FormLabel>
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
                                      data-testid="input-ei-contribution"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="incomeTaxDeduction"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Income Tax Deduction (Optional)</FormLabel>
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
                                      data-testid="input-income-tax-deduction"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {/* Other Self-Employment Income Fields */}
                      {form.watch("incomeCategory") === INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT && (
                        <>
                          <FormField
                            control={form.control}
                            name="businessName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Business Name</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="e.g., Consulting Services"
                                    data-testid="input-business-name"
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
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe the income source"
                                    data-testid="input-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {/* Other Income Fields */}
                      {form.watch("incomeCategory") === INCOME_CATEGORIES.OTHER && (
                        <>
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Describe the income source"
                                    data-testid="input-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {/* GST/HST Collected - Show for Film/TV and Other Self-Employment */}
                      {hasGstNumber && (form.watch("incomeCategory") === INCOME_CATEGORIES.FILM_TV || form.watch("incomeCategory") === INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT) && (
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

                      {/* Film/TV Specific Deductions */}
                      {form.watch("incomeCategory") === INCOME_CATEGORIES.FILM_TV && (
                        <>
                          <FormField
                            control={form.control}
                            name="dues"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Dues (Optional)</FormLabel>
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
                          {showRetirementAndInsurance && (
                            <FormField
                              control={form.control}
                              name="retirement"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Retirement (Optional)</FormLabel>
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
                          )}
                          <FormField
                            control={form.control}
                            name="labour"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Labour (Optional)</FormLabel>
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
                                <FormLabel>Buyout (Optional)</FormLabel>
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
                                <FormLabel>Pension (Optional)</FormLabel>
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
                          {showRetirementAndInsurance && (
                            <FormField
                              control={form.control}
                              name="insurance"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Insurance (Optional)</FormLabel>
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
                          )}
                        </>
                      )}
                    </>
                  )}
                </form>
              </Form>
            </div>
            <DialogFooter className="mt-4">
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending} 
                data-testid="button-submit-income" 
                onClick={form.handleSubmit(onSubmit)}
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingIncome ? "Update Income" : "Save Income"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Film/TV Income Widget */}
        {incomeByCategory[INCOME_CATEGORIES.FILM_TV] && incomeByCategory[INCOME_CATEGORIES.FILM_TV].net > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Film/TV Income</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold">
                    {formatCurrency(incomeByCategory[INCOME_CATEGORIES.FILM_TV].net)}
                  </span>
                </div>
                {incomeByCategory[INCOME_CATEGORIES.FILM_TV].gst > 0 && (
                  <p className="text-xs text-muted-foreground">
                    GST/HST: {formatCurrency(incomeByCategory[INCOME_CATEGORIES.FILM_TV].gst)}
                  </p>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">For {taxYear} tax year</p>
            </CardContent>
          </Card>
        )}
        
        {/* Regular Employment Income Widget */}
        {incomeByCategory[INCOME_CATEGORIES.REGULAR_EMPLOYMENT] && incomeByCategory[INCOME_CATEGORIES.REGULAR_EMPLOYMENT].net > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Employment Income</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold">
                  {formatCurrency(incomeByCategory[INCOME_CATEGORIES.REGULAR_EMPLOYMENT].net)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">For {taxYear} tax year</p>
            </CardContent>
          </Card>
        )}

        {/* Other Self-Employment Income Widget */}
        {incomeByCategory[INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT] && incomeByCategory[INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT].net > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Self-Employment</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold">
                    {formatCurrency(incomeByCategory[INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT].net)}
                  </span>
                </div>
                {incomeByCategory[INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT].gst > 0 && (
                  <p className="text-xs text-muted-foreground">
                    GST/HST: {formatCurrency(incomeByCategory[INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT].gst)}
                  </p>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">For {taxYear} tax year</p>
            </CardContent>
          </Card>
        )}

        {/* Total Income Widget */}
        {totalNetIncome > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold" data-testid="widget-net-income">
                    {formatCurrency(totalNetIncome)}
                  </span>
                </div>
                {totalGrossIncome > totalNetIncome && (
                  <p className="text-xs text-muted-foreground">
                    Gross: {formatCurrency(totalGrossIncome)}
                  </p>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">For {taxYear} tax year</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Income History</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
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
              <Select value={incomeCategoryFilter} onValueChange={setIncomeCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-income-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {availableIncomeCategoriesForFilter.map((category) => (
                    <SelectItem key={category} value={category}>
                      {getIncomeCategoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableShowsForFilter.length > 0 && (
                <Select value={showFilter} onValueChange={setShowFilter}>
                  <SelectTrigger className="w-full sm:w-48" data-testid="select-show-filter">
                    <SelectValue placeholder="All Shows" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shows</SelectItem>
                    {availableShowsForFilter.map((show) => (
                      <SelectItem key={show} value={show}>
                        {show}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                    <TableHead>Category</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncome.map((item) => {
                    const category = item.incomeCategory || INCOME_CATEGORIES.FILM_TV;
                    const detailName = category === INCOME_CATEGORIES.FILM_TV 
                      ? item.productionName 
                      : category === INCOME_CATEGORIES.REGULAR_EMPLOYMENT 
                      ? item.employerName 
                      : category === INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT 
                      ? item.businessName 
                      : null;
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-income-${item.id}`}>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {getIncomeCategoryLabel(category)}
                          </Badge>
                          {category === INCOME_CATEGORIES.FILM_TV && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {getIncomeTypeLabel(item.incomeType)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{detailName || item.description || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {item.grossPay ? formatCurrency(item.grossPay) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-income-${item.id}`}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-income-${item.id}`}
                                onClick={() => setDeletingIncomeId(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete income entry?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this income record. This action cannot be undone.
                                  {linkedPaystubs.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                      <p className="text-sm font-medium">
                                        This income entry is linked to {linkedPaystubs.length} paystub{linkedPaystubs.length > 1 ? "s" : ""}.
                                      </p>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id="delete-linked-paystubs"
                                          checked={deleteLinkedPaystubs}
                                          onChange={(e) => setDeleteLinkedPaystubs(e.target.checked)}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <label htmlFor="delete-linked-paystubs" className="text-sm">
                                          Also delete linked paystub{linkedPaystubs.length > 1 ? "s" : ""}
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => {
                                  setDeletingIncomeId(null);
                                  setDeleteLinkedPaystubs(false);
                                }}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate({ 
                                    id: item.id, 
                                    deleteLinked: deleteLinkedPaystubs 
                                  })}
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
