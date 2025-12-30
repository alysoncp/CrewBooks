import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Trash2, Image, X, ZoomIn, FileImage, Scan, Receipt as ReceiptIcon, Loader2, Lock, Sparkles, Link2 } from "lucide-react";
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
import { formatDate, formatCurrency, getCategoryLabel } from "@/lib/format";
import type { Receipt, Expense } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function ReceiptsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const [linkingReceiptId, setLinkingReceiptId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const isBasicTier = user?.subscriptionTier === "basic";
  const hasReceiptAccess = !isBasicTier; // Personal and Corporate have access

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      
      // Always redirect to expenses page to create expense from receipt
      if (data && Array.isArray(data) && data.length > 0) {
        const firstReceipt = data[0];
        
        if (firstReceipt.id) {
          // Close dialog and clear state
          setIsDialogOpen(false);
          setPreviewFiles([]);
          setNotes("");
          setScanWithOCR(false);
          
          // Redirect to expenses page with receiptId to open expense dialog
          setLocation(`/expenses?receiptId=${firstReceipt.id}`);
          
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
      
      // Fallback: just close dialog if something went wrong
      setIsDialogOpen(false);
      setPreviewFiles([]);
      setNotes("");
      setScanWithOCR(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-receipts-title">Receipts</h1>
          <p className="text-muted-foreground">Upload and manage your receipt photos</p>
        </div>
        {hasReceiptAccess && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-receipt">
                <Upload className="mr-2 h-4 w-4" />
                Upload Receipts
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Upload Receipts</DialogTitle>
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
        {!hasReceiptAccess && (
          <Link href="/pricing">
            <Button data-testid="button-upgrade-receipts-header">
              <Sparkles className="mr-2 h-4 w-4" />
              Upgrade to Upload Receipts
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Gallery</CardTitle>
          <CardDescription>
            {receipts?.length || 0} receipt{(receipts?.length || 0) !== 1 ? "s" : ""} uploaded
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
          ) : !receipts || receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileImage className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No receipts uploaded</h3>
              <p className="mt-1 text-muted-foreground">
                Upload photos of your receipts and paystubs to keep them organized
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {receipts.map((receipt) => (
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
                {expenses?.map((expense) => (
                  <SelectItem key={expense.id} value={expense.id}>
                    {formatDate(expense.date)} - {expense.title || getCategoryLabel(expense.category)} - {formatCurrency(expense.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(!expenses || expenses.length === 0) && (
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
