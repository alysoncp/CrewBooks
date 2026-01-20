import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Package, Plus, Edit, Trash2, Info, Calculator, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { type Asset, CCA_CLASSES, type CCAClass } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTaxYear } from "@/components/tax-year-provider";

const assetFormSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  description: z.string().optional(),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasePrice: z.string().min(1, "Purchase price is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Purchase price must be a valid number",
  }),
  purchaseGst: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "GST amount must be a valid number",
  }),
  purchasePst: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "PST amount must be a valid number",
  }),
  ccaClass: z.enum(["Class 10", "Class 10.1", "Class 8", "Class 12", "Class 50", "Class 45"]),
  businessUsePercentage: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
  }, {
    message: "Business use percentage must be between 0 and 100",
  }),
  applyHalfYearRule: z.boolean().default(true),
  vehicleId: z.string().optional(),
});

type AssetFormData = z.input<typeof assetFormSchema>;

export default function AssetsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const { taxYear } = useTaxYear();
  const { toast } = useToast();

  const { data: assetList, isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: ccaSummary } = useQuery<{ totalCCA: number; ccaByClass: Record<string, number> }>({
    queryKey: ["/api/cca-summary", taxYear],
    queryFn: async ({ queryKey }) => {
      return fetchWithAuth(`/api/cca-summary?taxYear=${queryKey[1]}`);
    },
  });

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      purchasePrice: "",
      purchaseGst: "",
      purchasePst: "",
      ccaClass: "Class 8",
      businessUsePercentage: "100",
      applyHalfYearRule: true,
      vehicleId: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AssetFormData) => {
      const response = await apiRequest("POST", "/api/assets", {
        name: data.name,
        description: data.description || undefined,
        purchaseDate: data.purchaseDate,
        purchasePrice: data.purchasePrice,
        purchaseGst: data.purchaseGst || undefined,
        purchasePst: data.purchasePst || undefined,
        ccaClass: data.ccaClass,
        businessUsePercentage: data.businessUsePercentage,
        applyHalfYearRule: data.applyHalfYearRule,
        vehicleId: data.vehicleId || undefined,
        isActive: true,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cca-summary"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Asset created",
        description: "Your asset has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create asset. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssetFormData }) => {
      const response = await apiRequest("PATCH", `/api/assets/${id}`, {
        name: data.name,
        description: data.description || undefined,
        purchaseDate: data.purchaseDate,
        purchasePrice: data.purchasePrice,
        purchaseGst: data.purchaseGst || undefined,
        purchasePst: data.purchasePst || undefined,
        ccaClass: data.ccaClass,
        businessUsePercentage: data.businessUsePercentage,
        applyHalfYearRule: data.applyHalfYearRule,
        vehicleId: data.vehicleId || undefined,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update asset");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cca-summary"] });
      setIsDialogOpen(false);
      setEditingAsset(null);
      form.reset();
      toast({
        title: "Asset updated",
        description: "Your asset has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update asset. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/assets/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete asset");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cca-summary"] });
      toast({
        title: "Asset deleted",
        description: "Your asset has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete asset. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    form.reset({
      name: asset.name,
      description: asset.description || "",
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice?.toString() || "",
      purchaseGst: asset.purchaseGst?.toString() || "",
      purchasePst: asset.purchasePst?.toString() || "",
      ccaClass: asset.ccaClass as CCAClass,
      businessUsePercentage: asset.businessUsePercentage?.toString() || "100",
      applyHalfYearRule: asset.applyHalfYearRule ?? true,
      vehicleId: asset.vehicleId || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: AssetFormData) => {
    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingAsset(null);
      form.reset();
    }
  };


  const activeAssets = assetList?.filter(a => a.isActive) || [];
  const disposedAssets = assetList?.filter(a => !a.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Capital Assets</h1>
          <p className="text-muted-foreground">
            Track your capital assets and calculate Capital Cost Allowance (CCA)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Laptop, Camera, Vehicle" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ccaClass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CCA Class *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select CCA class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(CCA_CLASSES).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                {key} - {value.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {form.watch("ccaClass") && CCA_CLASSES[form.watch("ccaClass") as CCAClass]?.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseGst"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GST Paid</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchasePst"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PST Paid</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessUsePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Use Percentage *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="100"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Percentage of asset used for business purposes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="applyHalfYearRule"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end space-y-3">
                        <div className="space-y-0.5">
                          <FormLabel>Apply Half-Year Rule</FormLabel>
                          <FormDescription className="text-xs">
                            First year CCA is limited to 50% (default: Yes)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={field.value ? "true" : "false"}
                            onChange={(e) => field.onChange(e.target.value === "true")}
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingAsset ? "Update" : "Create"} Asset
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {ccaSummary && ccaSummary.totalCCA > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              CCA Summary for {taxYear}
            </CardTitle>
            <CardDescription>
              Total Capital Cost Allowance for the current tax year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total CCA Deduction</span>
                <span className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(ccaSummary.totalCCA)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">By CCA Class:</div>
                {Object.entries(ccaSummary.ccaByClass).map(([ccaClass, amount]) => (
                  <div key={ccaClass} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{ccaClass}</span>
                    <span className="font-mono">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Assets</CardTitle>
          <CardDescription>
            Capital assets currently being depreciated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading assets...</div>
          ) : activeAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No assets yet. Add your first capital asset to start tracking CCA.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>CCA Class</TableHead>
                  <TableHead>Business Use %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssets.map((asset) => {
                  const purchasePrice = parseFloat(asset.purchasePrice?.toString() || "0");
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.name}
                        {asset.description && (
                          <div className="text-sm text-muted-foreground">{asset.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(asset.purchaseDate)}</TableCell>
                      <TableCell>{formatCurrency(purchasePrice)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.ccaClass}</Badge>
                      </TableCell>
                      <TableCell>{parseFloat(asset.businessUsePercentage?.toString() || "100").toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(asset)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Asset?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{asset.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(asset.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          )}
        </CardContent>
      </Card>

      {disposedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Disposed Assets</CardTitle>
            <CardDescription>
              Assets that have been sold or disposed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Disposal Date</TableHead>
                  <TableHead>Disposal Proceeds</TableHead>
                  <TableHead>CCA Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disposedAssets.map((asset) => {
                  const disposalProceeds = parseFloat(asset.disposalProceeds?.toString() || "0");
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>{formatDate(asset.purchaseDate)}</TableCell>
                      <TableCell>{asset.disposalDate ? formatDate(asset.disposalDate) : "-"}</TableCell>
                      <TableCell>{formatCurrency(disposalProceeds)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.ccaClass}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About Capital Cost Allowance (CCA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Capital Cost Allowance (CCA) is the tax deduction that Canadian businesses can claim for the depreciation of capital assets.
          </p>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Key Points:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>CCA is calculated based on the asset's CCA class and depreciation rate</li>
              <li>The half-year rule applies to most assets in their first year (50% of normal CCA)</li>
              <li>Business use percentage determines the deductible portion</li>
              <li>CCA reduces your taxable income, lowering your tax bill</li>
              <li>Assets must be used to earn income to be eligible for CCA</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Common CCA Classes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {Object.entries(CCA_CLASSES).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span className="font-medium">{key}:</span>
                  <span>{value.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

