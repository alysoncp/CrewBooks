import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Settings, ArrowLeft, Car, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES, type Expense, type User, type Vehicle } from "@shared/schema";
import { getCategoryLabel } from "@/lib/format";

// Vehicle form schema
const vehicleFormSchema = z.object({
  name: z.string().min(1, "Vehicle name is required"),
  make: z.string().transform((val) => val.trim() || undefined).optional(),
  model: z.string().transform((val) => val.trim() || undefined).optional(),
  isPrimary: z.boolean().default(false),
  usedExclusivelyForBusiness: z.boolean().default(false),
  claimsCca: z.boolean().default(false),
  ccaClass: z.enum(["Class 10", "Class 10.1"]).optional(),
  currentMileage: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  mileageAtBeginningOfYear: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  purchasedThisYear: z.boolean().default(false),
  purchasePrice: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
}).refine((data) => {
  // If purchased this year, purchase price should be provided
  if (data.purchasedThisYear && (!data.purchasePrice || isNaN(data.purchasePrice))) {
    return false;
  }
  return true;
}, {
  message: "Purchase price is required when vehicle was purchased this year",
  path: ["purchasePrice"],
}).refine((data) => {
  // If claims CCA is selected, CCA class should be provided
  if (data.claimsCca && !data.ccaClass) {
    return false;
  }
  return true;
}, {
  message: "CCA class is required when Claim CCA is selected",
  path: ["ccaClass"],
});

type VehicleFormData = z.input<typeof vehicleFormSchema>;

export default function ExpensesSettingsPage() {
  const { toast } = useToast();
  
  // Local state to track selected categories (before saving)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Vehicle management state
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const { data: expenseList } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Vehicle form
  const vehicleForm = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      name: "",
      make: "",
      model: "",
      isPrimary: false,
      usedExclusivelyForBusiness: false,
      claimsCca: false,
      ccaClass: undefined,
      currentMileage: "",
      mileageAtBeginningOfYear: "",
      purchasedThisYear: false,
      purchasePrice: "",
    },
  });

  // Watch purchasedThisYear to conditionally show purchase price field
  const purchasedThisYear = vehicleForm.watch("purchasedThisYear");
  // Watch claimsCca to conditionally show CCA class dropdown
  const claimsCca = vehicleForm.watch("claimsCca");

  // Get enabled categories from user profile (default to all if not set)
  const savedEnabledCategories = useMemo(() => {
    if (user?.enabledExpenseCategories) {
      return new Set(user.enabledExpenseCategories as string[]);
    }
    // Default: all categories enabled
    return new Set(EXPENSE_CATEGORIES);
  }, [user]);

  // Initialize local state from saved preferences
  useEffect(() => {
    setSelectedCategories(new Set(savedEnabledCategories));
  }, [savedEnabledCategories]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (selectedCategories.size !== savedEnabledCategories.size) {
      return true;
    }
    const selectedArray = Array.from(selectedCategories);
    const savedArray = Array.from(savedEnabledCategories);
    for (const category of selectedArray) {
      if (!savedEnabledCategories.has(category)) {
        return true;
      }
    }
    for (const category of savedArray) {
      if (!selectedCategories.has(category)) {
        return true;
      }
    }
    return false;
  }, [selectedCategories, savedEnabledCategories]);

  const updateEnabledCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      const response = await apiRequest("PATCH", "/api/user/profile", {
        enabledExpenseCategories: categories,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update categories");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({
        title: "Categories updated",
        description: "Your expense category preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update categories. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleCategory = (category: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const updated = new Set(prev);
      if (checked) {
        updated.add(category);
      } else {
        updated.delete(category);
      }
      return updated;
    });
  };

  const handleSave = () => {
    const categoriesArray = Array.from(selectedCategories);
    updateEnabledCategoriesMutation.mutate(categoriesArray);
  };

  // Extract category usage counts
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (expenseList) {
      expenseList.forEach((expense) => {
        if (expense.category) {
          counts.set(
            expense.category,
            (counts.get(expense.category) || 0) + 1
          );
        }
      });
    }
    return counts;
  }, [expenseList]);

  // Vehicle mutations
  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const response = await apiRequest("POST", "/api/vehicles", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to create vehicle");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsVehicleDialogOpen(false);
      vehicleForm.reset();
      setEditingVehicle(null);
      toast({
        title: "Vehicle added",
        description: "Your vehicle has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VehicleFormData> }) => {
      return apiRequest("PATCH", `/api/vehicles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setIsVehicleDialogOpen(false);
      vehicleForm.reset();
      setEditingVehicle(null);
      toast({
        title: "Vehicle updated",
        description: "Your vehicle has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({
        title: "Vehicle deleted",
        description: "The vehicle has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    vehicleForm.reset({
      name: vehicle.name || "",
      make: vehicle.make || "",
      model: vehicle.model || "",
      isPrimary: vehicle.isPrimary || false,
      usedExclusivelyForBusiness: (vehicle as any).usedExclusivelyForBusiness || false,
      claimsCca: vehicle.claimsCca || false,
      ccaClass: (vehicle as any).ccaClass || undefined,
      currentMileage: (vehicle as any).currentMileage?.toString() || "",
      mileageAtBeginningOfYear: (vehicle as any).mileageAtBeginningOfYear?.toString() || "",
      purchasedThisYear: (vehicle as any).purchasedThisYear || false,
      purchasePrice: (vehicle as any).purchasePrice?.toString() || "",
    });
    setIsVehicleDialogOpen(true);
  };

  const handleVehicleSubmit = (data: VehicleFormData) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/expenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Expense Categories
          </h1>
          <p className="text-muted-foreground">Manage your expense categories</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Business Expense Categories</CardTitle>
          <CardDescription>
            Select which type of business expenses you have
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {EXPENSE_CATEGORIES.map((category) => {
              const isEnabled = selectedCategories.has(category);
              const count = categoryCounts.get(category) || 0;
              return (
                <div
                  key={category}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={`category-${category}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggleCategory(category, checked as boolean)}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="font-medium cursor-pointer flex-1"
                    >
                      {getCategoryLabel(category)}
                    </label>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {count} expense{count !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || updateEnabledCategoriesMutation.isPending}
            >
              {updateEnabledCategoriesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Settings
              </CardTitle>
              <CardDescription>
                Manage your vehicles for expense tracking
              </CardDescription>
            </div>
            <Dialog open={isVehicleDialogOpen} onOpenChange={(open) => {
              setIsVehicleDialogOpen(open);
              if (!open) {
                setEditingVehicle(null);
                vehicleForm.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 pr-2">
                  <Form {...vehicleForm}>
                    <form onSubmit={vehicleForm.handleSubmit(handleVehicleSubmit)} className="space-y-4">
                      <FormField
                        control={vehicleForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle Name *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., 2019 Honda Civic, Work Truck"
                                data-testid="input-vehicle-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={vehicleForm.control}
                          name="make"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Make</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Honda" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vehicleForm.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Model</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Civic" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={vehicleForm.control}
                        name="isPrimary"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-6">
                            <div className="space-y-0.5 flex-1 pr-4">
                              <FormLabel className="text-base">Set as Primary Vehicle</FormLabel>
                              <FormDescription>
                                This vehicle will be selected by default when adding vehicle expenses
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="usedExclusivelyForBusiness"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-6">
                            <div className="space-y-0.5 flex-1 pr-4">
                              <FormLabel className="text-base">Business Use Only</FormLabel>
                              <FormDescription>
                                Select if this vehicle is used solely for business (No personal driving)
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="currentMileage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Current Mileage</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  value={field.value || ""}
                                  className="pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">km</span>
                              </div>
                            </FormControl>
                            <FormDescription>Enter the current odometer reading in kilometers</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={vehicleForm.control}
                        name="purchasedThisYear"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-6">
                            <div className="space-y-0.5 flex-1 pr-4">
                              <FormLabel className="text-base">Did you purchase this vehicle this year?</FormLabel>
                              <FormDescription>
                                Select if you purchased this vehicle in the current tax year
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {purchasedThisYear && (
                        <FormField
                          control={vehicleForm.control}
                          name="purchasePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purchase Price *</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  data-testid="input-purchase-price"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!purchasedThisYear && (
                        <FormField
                          control={vehicleForm.control}
                          name="mileageAtBeginningOfYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mileage at Beginning of Year</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={field.value || ""}
                                    className="pr-12"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">km</span>
                                </div>
                              </FormControl>
                              <FormDescription>Enter the odometer reading at the beginning of the tax year in kilometers</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={vehicleForm.control}
                        name="claimsCca"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-6">
                            <div className="space-y-0.5 flex-1 pr-4">
                              <FormLabel className="text-base">Claim CCA (Capital Cost Allowance)</FormLabel>
                              <FormDescription>
                                I intend to claim Capital Cost Allowance for this vehicle
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {claimsCca && (
                        <FormField
                          control={vehicleForm.control}
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
                                  <SelectItem value="Class 10">Class 10</SelectItem>
                                  <SelectItem value="Class 10.1">Class 10.1</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </form>
                  </Form>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsVehicleDialogOpen(false);
                      setEditingVehicle(null);
                      vehicleForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                    onClick={vehicleForm.handleSubmit(handleVehicleSubmit)}
                  >
                    {createVehicleMutation.isPending || updateVehicleMutation.isPending
                      ? "Saving..."
                      : editingVehicle
                      ? "Update Vehicle"
                      : "Add Vehicle"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No vehicles added yet</p>
              <p className="text-sm">
                Click "Add Vehicle" above to start tracking vehicle-related expenses
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{vehicle.name}</h3>
                        {vehicle.isPrimary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                        {vehicle.claimsCca && (
                          <Badge variant="outline" className="text-xs">
                            CCA
                          </Badge>
                        )}
                        {vehicle.usedExclusivelyForBusiness && (
                          <Badge variant="default" className="text-xs">
                            Business Only
                          </Badge>
                        )}
                      </div>
                      
                      {(vehicle.year || vehicle.make || vehicle.model) && (
                        <p className="text-sm text-muted-foreground">
                          {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm">
                        {vehicle.licensePlate && (
                          <div>
                            <span className="text-muted-foreground">License Plate: </span>
                            <span className="font-medium">{vehicle.licensePlate}</span>
                          </div>
                        )}
                        {vehicle.currentMileage !== null && vehicle.currentMileage !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Current Mileage: </span>
                            <span className="font-medium">{Number(vehicle.currentMileage).toLocaleString()} km</span>
                          </div>
                        )}
                        {vehicle.mileageAtBeginningOfYear !== null && vehicle.mileageAtBeginningOfYear !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Mileage at Year Start: </span>
                            <span className="font-medium">{Number(vehicle.mileageAtBeginningOfYear).toLocaleString()} km</span>
                          </div>
                        )}
                        {vehicle.ccaClass && (
                          <div>
                            <span className="text-muted-foreground">CCA Class: </span>
                            <span className="font-medium">{vehicle.ccaClass}</span>
                          </div>
                        )}
                        {vehicle.purchasePrice !== null && vehicle.purchasePrice !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Purchase Price: </span>
                            <span className="font-medium">${Number(vehicle.purchasePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {vehicle.purchasedThisYear && (
                          <div>
                            <span className="text-muted-foreground">Purchased: </span>
                            <span className="font-medium">This Year</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditVehicle(vehicle)}
                        data-testid={`button-edit-vehicle-${vehicle.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-vehicle-${vehicle.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this vehicle. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
