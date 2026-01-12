import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Trash2, Image, X, ZoomIn, FileText, Scan, Camera, Pencil, Plus } from "lucide-react";
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
import { formatDate, getIncomeCategoryLabel, getIncomeTypeLabel, getTodayLocalDateString } from "@/lib/format";
import { INCOME_CATEGORIES, INCOME_TYPES, type Paystub, type Income } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const INCOME_CATEGORY_OPTIONS = [
  { value: INCOME_CATEGORIES.FILM_TV, label: "Film/TV Income" },
  { value: INCOME_CATEGORIES.REGULAR_EMPLOYMENT, label: "Regular Employment Income" },
  { value: INCOME_CATEGORIES.OTHER_SELF_EMPLOYMENT, label: "Other Self-Employment" },
  { value: INCOME_CATEGORIES.OTHER, label: "Other" },
];

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

export default function PaystubsPage() {
  const [isInitialDialogOpen, setIsInitialDialogOpen] = useState(false);
  const [isPaystubUploadDialogOpen, setIsPaystubUploadDialogOpen] = useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [customAccountingOffice, setCustomAccountingOffice] = useState("");
  const [paystubIdForIncome, setPaystubIdForIncome] = useState<string | null>(null);
  const [paystubImageUrl, setPaystubImageUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;

  const { data: paystubs, isLoading } = useQuery<Paystub[]>({
    queryKey: ["/api/paystubs"],
  });

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(incomeFormSchema),
    mode: "onBlur",
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
      await queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      await queryClient.refetchQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsIncomeDialogOpen(false);
      setSelectedCategory(null);
      form.reset();
      setEditingIncome(null);
      setCustomAccountingOffice("");
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

  const onSubmit = (data: IncomeFormData) => {
    const customValue = customAccountingOffice;
    const accountingOfficeValue = data.accountingOffice === "other" && customValue.trim()
      ? customValue.trim()
      : data.accountingOffice;
    
    const formData = {
      ...data,
      accountingOffice: accountingOfficeValue || data.accountingOffice,
    };
    
    createMutation.mutate(formData);
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("notes", notes);
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
      setNotes("");
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
            
            toast({
              title: "Paystub uploaded",
              description: "Create an income entry for this paystub.",
            });
          }
          
          // Always open the income dialog
          setIsIncomeDialogOpen(true);
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

  const [deletingPaystubId, setDeletingPaystubId] = useState<string | null>(null);
  const [linkedIncome, setLinkedIncome] = useState<any | null>(null);
  const [deleteLinkedIncome, setDeleteLinkedIncome] = useState(false);

  const { data: linkedIncomeData } = useQuery({
    queryKey: ["/api/paystubs", deletingPaystubId, "linked-income"],
    queryFn: async () => {
      if (!deletingPaystubId) return null;
      const response = await fetch(`/api/paystubs/${deletingPaystubId}/linked-income`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!deletingPaystubId,
  });

  useEffect(() => {
    if (linkedIncomeData !== undefined) {
      setLinkedIncome(linkedIncomeData);
    }
  }, [linkedIncomeData]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, deleteLinked }: { id: string; deleteLinked: boolean }) => {
      const url = `/api/paystubs/${id}${deleteLinked ? "?deleteLinkedIncome=true" : ""}`;
      return apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setDeletingPaystubId(null);
      setLinkedIncome(null);
      setDeleteLinkedIncome(false);
      toast({
        title: "Paystub deleted",
        description: "The paystub has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete paystub. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const handleInitialDialogSelect = (mode: 'upload' | 'manual' | 'cancel') => {
    setIsInitialDialogOpen(false);
    if (mode === 'upload') {
      setIsPaystubUploadDialogOpen(true);
    } else if (mode === 'manual') {
      setIsIncomeDialogOpen(true);
    }
  };

  const handleUploadClick = () => {
    setSelectedCategory(null);
    setPreviewFiles([]);
    setNotes("");
    setScanWithOCR(false);
    setIsInitialDialogOpen(true);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/") || f.type === "application/pdf"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-paystubs-title">Paystubs</h1>
          <p className="text-muted-foreground">Upload and manage your paystub photos</p>
        </div>
        
        {/* Initial Selection Dialog */}
        <Dialog 
          open={isInitialDialogOpen} 
          onOpenChange={(open) => {
            setIsInitialDialogOpen(open);
            if (!open) {
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

        {/* Add Income Button */}
        <Button 
          data-testid="button-add-income"
          onClick={handleUploadClick}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>

        {/* Paystub Upload Dialog */}
        <Dialog 
          open={isPaystubUploadDialogOpen} 
          onOpenChange={(open) => {
            setIsPaystubUploadDialogOpen(open);
            if (!open) {
              setPreviewFiles([]);
              setNotes("");
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
                onClick={() => document.getElementById("paystub-file-input")?.click()}
                data-testid="dropzone-paystub"
              >
                <Image className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop images or PDFs here, or click to select
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports: JPG, PNG, HEIC, PDF
                </p>
                <Input
                  id="paystub-file-input"
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-file-paystub"
                />
              </div>

              {previewFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {previewFiles.map((item, index) => (
                    <div key={index} className="group relative aspect-square">
                      {item.file.type === "application/pdf" ? (
                        <div className="flex h-full w-full items-center justify-center rounded-lg border bg-muted/30">
                          <div className="flex flex-col items-center gap-2 p-2 text-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                            <span className="line-clamp-2 text-xs text-muted-foreground">{item.file.name}</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.preview}
                          alt={`Preview ${index + 1}`}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      )}
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
                  placeholder="Add notes about these paystubs..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-paystub-notes"
                />
              </div>

              <div className="flex items-center space-x-2 rounded-lg border p-4">
                <Switch
                  id="scan-ocr-paystub"
                  checked={scanWithOCR}
                  onCheckedChange={setScanWithOCR}
                  data-testid="switch-scan-ocr-paystub"
                />
                <Label htmlFor="scan-ocr-paystub" className="cursor-pointer">
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
                onClick={handleUpload}
                disabled={previewFiles.length === 0 || uploadMutation.isPending}
                data-testid="button-submit-paystub"
              >
                {uploadMutation.isPending ? "Uploading..." : `Upload ${previewFiles.length} Paystub${previewFiles.length !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Income Dialog */}
        <Dialog 
          open={isIncomeDialogOpen} 
          onOpenChange={(open) => {
            setIsIncomeDialogOpen(open);
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
                {paystubImageUrl.toLowerCase().endsWith(".pdf") ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <a href={paystubImageUrl} target="_blank" rel="noreferrer" className="underline">
                      View uploaded PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={paystubImageUrl}
                    alt="Paystub"
                    className="max-h-32 w-full object-contain rounded"
                  />
                )}
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
                disabled={createMutation.isPending} 
                data-testid="button-submit-income" 
                onClick={form.handleSubmit(onSubmit)}
              >
                {createMutation.isPending ? "Saving..." : "Save Income"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paystub Gallery</CardTitle>
          <CardDescription>
            {paystubs?.length || 0} paystub{(paystubs?.length || 0) !== 1 ? "s" : ""} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : !paystubs || paystubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No paystubs uploaded</h3>
              <p className="mt-1 text-muted-foreground">
                Upload photos of your paystubs to keep them organized
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {paystubs.map((paystub) => (
                <div key={paystub.id} className="group relative" data-testid={`card-paystub-${paystub.id}`}>
                  <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                    <img
                      src={paystub.imageUrl}
                      alt="Paystub"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setSelectedImage(paystub.imageUrl)}
                      data-testid={`button-zoom-paystub-${paystub.id}`}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          data-testid={`button-delete-paystub-${paystub.id}`}
                          onClick={() => setDeletingPaystubId(paystub.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete paystub?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this paystub image. This action cannot be undone.
                            {linkedIncome && (
                              <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium">
                                  This paystub is linked to an income entry.
                                </p>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`delete-linked-income-${paystub.id}`}
                                    checked={deleteLinkedIncome}
                                    onChange={(e) => setDeleteLinkedIncome(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300"
                                  />
                                  <label htmlFor={`delete-linked-income-${paystub.id}`} className="text-sm">
                                    Also delete linked income entry
                                  </label>
                                </div>
                              </div>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => {
                            setDeletingPaystubId(null);
                            setDeleteLinkedIncome(false);
                          }}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ 
                              id: paystub.id, 
                              deleteLinked: deleteLinkedIncome 
                            })}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {paystub.notes && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">{paystub.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paystub.uploadedAt ? formatDate(paystub.uploadedAt) : ""}
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
              alt="Paystub full view"
              className="max-h-[80vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
