import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Trash2, Image, X, ZoomIn, FileImage, Scan, Receipt as ReceiptIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate } from "@/lib/format";
import type { Receipt } from "@shared/schema";
import { useLocation } from "wouter";

// Component to create expense from receipt
function CreateExpenseFromReceiptButton({ receiptId }: { receiptId: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleCreateExpense = () => {
    // Navigate to expenses page with receipt ID
    setLocation(`/expenses?receiptId=${receiptId}`);
  };

  return (
    <Button
      variant="default"
      size="icon"
      onClick={handleCreateExpense}
      data-testid={`button-create-expense-${receiptId}`}
      title="Create expense from receipt"
    >
      <ReceiptIcon className="h-4 w-4" />
    </Button>
  );
}

export default function ReceiptsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [scanWithOCR, setScanWithOCR] = useState(false);
  const { toast } = useToast();

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  // Poll for OCR status on receipts that are processing
  useEffect(() => {
    if (!receipts) return;

    const processingReceipts = receipts.filter(
      (r) => r.ocrStatus === "processing" && r.ocrJobId
    );

    if (processingReceipts.length === 0) return;

    const pollInterval = setInterval(() => {
      processingReceipts.forEach(async (receipt) => {
        if (!receipt.ocrJobId) return;

        try {
          const response = await fetch(
            `/api/receipts/ocr/status/${receipt.ocrJobId}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.status === "completed" || data.status === "failed") {
              // Invalidate to refresh receipt data
              queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
            }
          }
        } catch (error) {
          console.error("Error polling OCR status:", error);
        }
      });
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [receipts, queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async ({ files, useOCR }: { files: File[]; useOCR: boolean }) => {
      if (useOCR && files.length === 1) {
        // Use OCR processing endpoint for single file
        const { compressImage } = await import("@/lib/image-compression");
        const compressedFile = await compressImage(files[0]);
        
        const formData = new FormData();
        formData.append("file", compressedFile);
        formData.append("notes", notes);
        
        const response = await fetch("/api/receipts/ocr/process", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error("OCR upload failed");
        }
        
        return response.json();
      } else {
        // Regular upload for multiple files or non-OCR
        const formData = new FormData();
        files.forEach((file) => {
          formData.append("files", file);
        });
        formData.append("notes", notes);
        
        const response = await fetch("/api/receipts/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        
        return response.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      setIsDialogOpen(false);
      setPreviewFiles([]);
      setNotes("");
      setScanWithOCR(false);
      
      if (data.ocrResult) {
        if (data.ocrResult.status === "failed") {
          toast({
            title: "Receipt uploaded",
            description: data.warning || "OCR scanning failed, but receipt was saved. You can create an expense manually.",
            variant: "default",
          });
        } else if (data.ocrResult.status === "completed") {
          const confidence = data.ocrResult.confidence || 0;
          const confidenceWarning = confidence < 0.7 ? " (Low confidence - please verify)" : "";
          toast({
            title: "Receipt scanned",
            description: `OCR completed${confidenceWarning}. ${data.ocrResult.amount ? `Amount: $${data.ocrResult.amount.toFixed(2)}` : ""}`,
            variant: confidence < 0.7 ? "default" : "default",
          });
        } else {
          toast({
            title: "Receipt scanned",
            description: `OCR processing in progress. Results will be available shortly.`,
          });
        }
      } else {
        toast({
          title: "Receipts uploaded",
          description: "Your receipts have been saved successfully.",
        });
      }
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
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/receipts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({
        title: "Receipt deleted",
        description: "The receipt has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete receipt. Please try again.",
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
    uploadMutation.mutate({
      files: previewFiles.map((p) => p.file),
      useOCR: scanWithOCR,
    });
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
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="scan-ocr"
                  checked={scanWithOCR}
                  onChange={(e) => setScanWithOCR(e.target.checked)}
                  disabled={previewFiles.length > 1}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="scan-ocr" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Scan with OCR (single file only)
                </label>
              </div>
              {previewFiles.length > 1 && scanWithOCR && (
                <p className="text-xs text-muted-foreground">
                  OCR scanning is only available for single file uploads. Please upload one file at a time to use OCR.
                </p>
              )}
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
            </div>
            <DialogFooter>
              <Button
                onClick={handleUpload}
                disabled={previewFiles.length === 0 || uploadMutation.isPending || (scanWithOCR && previewFiles.length > 1)}
                data-testid="button-submit-receipt"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {scanWithOCR ? "Scanning..." : "Uploading..."}
                  </>
                ) : (
                  <>
                    {scanWithOCR && previewFiles.length === 1 && <Scan className="mr-2 h-4 w-4" />}
                    {scanWithOCR && previewFiles.length === 1 ? "Scan Receipt" : `Upload ${previewFiles.length} Receipt${previewFiles.length !== 1 ? "s" : ""}`}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Gallery</CardTitle>
          <CardDescription>
            {receipts?.length || 0} receipt{(receipts?.length || 0) !== 1 ? "s" : ""} uploaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                    {receipt.ocrStatus === "completed" && (
                      <CreateExpenseFromReceiptButton receiptId={receipt.id} />
                    )}
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
                          <AlertDialogTitle>Delete receipt?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this receipt image. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(receipt.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {receipt.ocrStatus && (
                      <Badge
                        variant={
                          receipt.ocrStatus === "completed"
                            ? "default"
                            : receipt.ocrStatus === "processing"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {receipt.ocrStatus === "completed" ? "Scanned" : receipt.ocrStatus === "processing" ? "Scanning..." : "Scan Failed"}
                      </Badge>
                    )}
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
    </div>
  );
}
