import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Trash2, Image, X, ZoomIn, FileText } from "lucide-react";
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
import type { Paystub } from "@shared/schema";

export default function PaystubsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ file: File; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: paystubs, isLoading } = useQuery<Paystub[]>({
    queryKey: ["/api/paystubs"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("notes", notes);
      
      const response = await fetch("/api/paystubs/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
      setIsDialogOpen(false);
      setPreviewFiles([]);
      setNotes("");
      toast({
        title: "Paystubs uploaded",
        description: "Your paystubs have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload paystubs. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/paystubs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paystubs"] });
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
          <h1 className="text-2xl font-semibold" data-testid="text-paystubs-title">Paystubs</h1>
          <p className="text-muted-foreground">Upload and manage your paystub photos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-paystub">
              <Upload className="mr-2 h-4 w-4" />
              Upload Paystubs
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Upload Paystubs</DialogTitle>
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
                  Drag and drop images here, or click to select
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports: JPG, PNG, HEIC
                </p>
                <Input
                  id="paystub-file-input"
                  type="file"
                  accept="image/*"
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
                  placeholder="Add notes about these paystubs..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-paystub-notes"
                />
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete paystub?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this paystub image. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(paystub.id)}
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
