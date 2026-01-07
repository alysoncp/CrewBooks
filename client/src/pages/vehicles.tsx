import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Car, Plus, Edit, Trash2, Info, Upload, X, Image as ImageIcon } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Vehicle, type Asset, type LeaseContract } from "@shared/schema";

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
  totalAnnualMileage: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  purchasedThisYear: z.boolean().default(false),
  purchasePrice: z.string().optional().transform((val) => val ? parseFloat(val) : undefined),
  isLeased: z.boolean().default(false).optional(),
  leaseContractId: z.string().optional(),
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

export default function VehiclesPage() {
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [uploadingPhotoType, setUploadingPhotoType] = useState<string | null>(null);
  const initialPhotoInputRef = useRef<HTMLInputElement>(null);
  const startOfYearPhotoInputRef = useRef<HTMLInputElement>(null);
  const endOfYearPhotoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: leaseContracts = [] } = useQuery<LeaseContract[]>({
    queryKey: ["/api/lease-contracts"],
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
      purchasedThisYear: false,
      purchasePrice: "",
    },
  });

  // Watch purchasedThisYear to conditionally show purchase price field
  const purchasedThisYear = vehicleForm.watch("purchasedThisYear");
  // Watch claimsCca to conditionally show CCA class dropdown
  const claimsCca = vehicleForm.watch("claimsCca");
  // Watch isLeased to conditionally show lease options
  const isLeased = vehicleForm.watch("isLeased" as any);

  // Vehicle mutations
  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      const { isLeased, leaseContractId, ...vehicleData } = data as any;
      const response = await apiRequest("POST", "/api/vehicles", vehicleData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to create vehicle");
      }
      const vehicle = await response.json();
      
      // If vehicle is leased and a new contract should be created
      if (isLeased && leaseContractId === "new") {
        // Create a basic lease contract for this vehicle
        const leaseResponse = await apiRequest("POST", "/api/lease-contracts", {
          leaseType: "vehicle",
          name: `${vehicle.name} Lease`,
          leaseStartDate: new Date().toISOString().split("T")[0],
          monthlyPayment: "0",
          paymentFrequency: "monthly",
          businessUsePercentage: vehicle.usedExclusivelyForBusiness ? "100" : "50",
          vehicleId: vehicle.id,
        });
        
        if (!leaseResponse.ok) {
          // Don't fail vehicle creation if lease creation fails
          console.error("Failed to create lease contract:", await leaseResponse.json());
        }
      } else if (isLeased && leaseContractId && leaseContractId !== "new") {
        // Link existing lease contract to vehicle
        await apiRequest("PATCH", `/api/lease-contracts/${leaseContractId}`, {
          vehicleId: vehicle.id,
        });
      }
      
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
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
      const { isLeased, leaseContractId, ...vehicleData } = data as any;
      const response = await apiRequest("PATCH", `/api/vehicles/${id}`, vehicleData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update vehicle");
      }
      const vehicle = await response.json();
      
      // Handle lease contract linking/creation
      if (isLeased && leaseContractId === "new") {
        // Check if lease already exists
        const existingLease = leaseContracts.find(l => l.vehicleId === id && l.leaseType === "vehicle");
        if (!existingLease) {
          // Create a basic lease contract for this vehicle
          const leaseResponse = await apiRequest("POST", "/api/lease-contracts", {
            leaseType: "vehicle",
            name: `${vehicle.name} Lease`,
            leaseStartDate: new Date().toISOString().split("T")[0],
            monthlyPayment: "0",
            paymentFrequency: "monthly",
            businessUsePercentage: vehicle.usedExclusivelyForBusiness ? "100" : "50",
            vehicleId: vehicle.id,
          });
          
          if (!leaseResponse.ok) {
            console.error("Failed to create lease contract:", await leaseResponse.json());
          }
        }
      } else if (isLeased && leaseContractId && leaseContractId !== "new") {
        // Link existing lease contract to vehicle
        await apiRequest("PATCH", `/api/lease-contracts/${leaseContractId}`, {
          vehicleId: vehicle.id,
        });
      } else if (!isLeased) {
        // Unlink lease contract from vehicle
        const existingLease = leaseContracts.find(l => l.vehicleId === id && l.leaseType === "vehicle");
        if (existingLease) {
          await apiRequest("PATCH", `/api/lease-contracts/${existingLease.id}`, {
            vehicleId: null,
          });
        }
      }
      
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
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

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ vehicleId, photoType, file }: { vehicleId: string; photoType: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photoType", photoType);
      
      const response = await fetch(`/api/vehicles/${vehicleId}/odometer-photo`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload photo");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setUploadingPhotoType(null);
      toast({
        title: "Photo uploaded",
        description: "Odometer photo has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadingPhotoType(null);
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = (vehicleId: string, photoType: string, file: File) => {
    setUploadingPhotoType(photoType);
    uploadPhotoMutation.mutate({ vehicleId, photoType, file });
  };

  const handlePhotoInputChange = (vehicleId: string, photoType: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handlePhotoUpload(vehicleId, photoType, file);
    }
    // Reset input so same file can be selected again
    event.target.value = "";
  };

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
      totalAnnualMileage: (vehicle as any).totalAnnualMileage?.toString() || "",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vehicles</h1>
          <p className="text-muted-foreground">
            Manage your vehicles for expense tracking and CCA claims
          </p>
        </div>
        <Dialog open={isVehicleDialogOpen} onOpenChange={(open) => {
          setIsVehicleDialogOpen(open);
          if (!open) {
            setEditingVehicle(null);
            vehicleForm.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
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
                        <FormLabel>Starting Mileage</FormLabel>
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
                        <FormDescription>Enter the starting odometer reading in kilometers</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={vehicleForm.control}
                    name="totalAnnualMileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Annual Mileage (km)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="e.g., 25000"
                              value={field.value || ""}
                              className="pr-12"
                              data-testid="input-vehicle-total-annual-mileage"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">km</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Enter the total kilometers driven in the tax year. Business use percentage will be calculated from your logged business trips.
                        </FormDescription>
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
                  <FormField
                    control={vehicleForm.control}
                    name="claimsCca"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-6">
                        <div className="space-y-0.5 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <FormLabel className="text-base">Claim CCA (Capital Cost Allowance)</FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">
                                    Capital Cost Allowance (CCA) is a tax deduction for the depreciation of your vehicle over time. 
                                    You can claim a percentage of the vehicle's cost each year based on its CCA class. Class 10 is 
                                    for general vehicles (30% rate), while Class 10.1 is for  passenger vehicles over $34,000.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
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

                  {/* Odometer Photos Section */}
                  {editingVehicle && (
                    <div className="space-y-4 pt-4 border-t">
                      <FormLabel className="text-base">Odometer Photos</FormLabel>
                      <FormDescription>
                        Upload photos of your odometer for record keeping. These are optional but recommended for tax purposes.
                      </FormDescription>
                      
                      <div className="space-y-3">
                        {/* Initial Odometer Photo */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm">Initial Odometer Photo</FormLabel>
                            {editingVehicle.initialOdometerPhotoUrl && (
                              <Badge variant="outline" className="text-xs">Uploaded</Badge>
                            )}
                          </div>
                          {editingVehicle.initialOdometerPhotoUrl ? (
                            <div className="relative">
                              <img
                                src={editingVehicle.initialOdometerPhotoUrl}
                                alt="Initial odometer"
                                className="w-full h-32 object-cover rounded-md border"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  initialPhotoInputRef.current?.click();
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => initialPhotoInputRef.current?.click()}
                              disabled={uploadingPhotoType === "initial"}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingPhotoType === "initial" ? "Uploading..." : "Upload Initial Photo"}
                            </Button>
                          )}
                          <input
                            ref={initialPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoInputChange(editingVehicle.id, "initial", e)}
                          />
                        </div>

                        {/* Start of Year Odometer Photo */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm">Start of Year Photo</FormLabel>
                            {editingVehicle.startOfYearOdometerPhotoUrl && (
                              <Badge variant="outline" className="text-xs">Uploaded</Badge>
                            )}
                          </div>
                          {editingVehicle.startOfYearOdometerPhotoUrl ? (
                            <div className="relative">
                              <img
                                src={editingVehicle.startOfYearOdometerPhotoUrl}
                                alt="Start of year odometer"
                                className="w-full h-32 object-cover rounded-md border"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  startOfYearPhotoInputRef.current?.click();
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => startOfYearPhotoInputRef.current?.click()}
                              disabled={uploadingPhotoType === "startOfYear"}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingPhotoType === "startOfYear" ? "Uploading..." : "Upload Start of Year Photo"}
                            </Button>
                          )}
                          <input
                            ref={startOfYearPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoInputChange(editingVehicle.id, "startOfYear", e)}
                          />
                        </div>

                        {/* End of Year Odometer Photo */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm">End of Year Photo</FormLabel>
                            {editingVehicle.endOfYearOdometerPhotoUrl && (
                              <Badge variant="outline" className="text-xs">Uploaded</Badge>
                            )}
                          </div>
                          {editingVehicle.endOfYearOdometerPhotoUrl ? (
                            <div className="relative">
                              <img
                                src={editingVehicle.endOfYearOdometerPhotoUrl}
                                alt="End of year odometer"
                                className="w-full h-32 object-cover rounded-md border"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  endOfYearPhotoInputRef.current?.click();
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => endOfYearPhotoInputRef.current?.click()}
                              disabled={uploadingPhotoType === "endOfYear"}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingPhotoType === "endOfYear" ? "Uploading..." : "Upload End of Year Photo"}
                            </Button>
                          )}
                          <input
                            ref={endOfYearPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoInputChange(editingVehicle.id, "endOfYear", e)}
                          />
                        </div>
                      </div>
                    </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Your Vehicles</CardTitle>
          <CardDescription>
            Manage your vehicles for expense tracking and CCA claims
          </CardDescription>
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
                            <span className="text-muted-foreground">Starting Mileage: </span>
                            <span className="font-medium">{Number(vehicle.currentMileage).toLocaleString()} km</span>
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
                      {vehicle.claimsCca && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Linked Asset:</span>
                            {(() => {
                              const linkedAsset = assets.find(a => a.vehicleId === vehicle.id);
                              if (linkedAsset) {
                                return (
                                  <Link href="/assets" className="text-primary hover:underline text-sm">
                                    View Asset
                                  </Link>
                                );
                              } else {
                                return (
                                  <span className="text-xs text-muted-foreground">Asset will be created automatically</span>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const vehicleLease = leaseContracts.find(l => l.vehicleId === vehicle.id && l.leaseType === "vehicle");
                        if (vehicleLease) {
                          return (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Lease Contract:</span>
                                <Link href="/leases" className="text-primary hover:underline text-sm">
                                  {vehicleLease.name}
                                </Link>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Odometer Photos Display */}
                      {(vehicle.initialOdometerPhotoUrl || vehicle.startOfYearOdometerPhotoUrl || vehicle.endOfYearOdometerPhotoUrl) && (
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-sm text-muted-foreground mb-2 block">Odometer Photos:</span>
                          <div className="flex gap-2 flex-wrap">
                            {vehicle.initialOdometerPhotoUrl && (
                              <div className="relative group">
                                <img
                                  src={vehicle.initialOdometerPhotoUrl}
                                  alt="Initial odometer"
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(vehicle.initialOdometerPhotoUrl!, "_blank")}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center rounded-b">
                                  Initial
                                </div>
                              </div>
                            )}
                            {vehicle.startOfYearOdometerPhotoUrl && (
                              <div className="relative group">
                                <img
                                  src={vehicle.startOfYearOdometerPhotoUrl}
                                  alt="Start of year odometer"
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(vehicle.startOfYearOdometerPhotoUrl!, "_blank")}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center rounded-b">
                                  Start
                                </div>
                              </div>
                            )}
                            {vehicle.endOfYearOdometerPhotoUrl && (
                              <div className="relative group">
                                <img
                                  src={vehicle.endOfYearOdometerPhotoUrl}
                                  alt="End of year odometer"
                                  className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(vehicle.endOfYearOdometerPhotoUrl!, "_blank")}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center rounded-b">
                                  End
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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

