import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Car, Plus, Edit, Trash2, Info, Upload, X, Image as ImageIcon, Calendar, ChevronLeft, ChevronRight, Grid3x3, Gauge, List, AlertCircle } from "lucide-react";
import exifr from "exifr";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Label } from "@/components/ui/label";
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
import { type Vehicle, type Asset, type LeaseContract, type OdometerPhoto } from "@shared/schema";
import { formatDate } from "@/lib/format";

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

// Component to show reminder banner for vehicles missing photos
function VehiclePhotoReminder({ 
  vehicle, 
  shouldShow, 
  onDismiss, 
  onUpload 
}: { 
  vehicle: Vehicle; 
  shouldShow: boolean; 
  onDismiss: () => void;
  onUpload: () => void;
}) {
  const { data: photos = [] } = useQuery<OdometerPhoto[]>({
    queryKey: ["/api/vehicles", vehicle.id, "odometer-photos"],
    queryFn: async () => {
      const response = await fetch(`/api/vehicles/${vehicle.id}/odometer-photos`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  if (photos.length > 0 || !shouldShow) {
    return null;
  }

  return (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Upload Odometer Photo for {vehicle.name}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          Upload a photo of your odometer to help calculate business use percentage accurately.
        </span>
        <div className="flex gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
          >
            Upload Photo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

// Component to fetch and display photos for a vehicle in the list
function VehiclePhotosPreview({ vehicle, onOpenGallery }: { vehicle: Vehicle; onOpenGallery: (vehicle: Vehicle, index?: number) => void }) {
  const currentYear = new Date().getFullYear().toString();
  const currentYearStart = `${currentYear}-01-01`;
  
  const { data: photos = [] } = useQuery<OdometerPhoto[]>({
    queryKey: ["/api/vehicles", vehicle.id, "odometer-photos"],
    queryFn: async () => {
      const response = await fetch(`/api/vehicles/${vehicle.id}/odometer-photos`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Check photo status for current year
  const currentYearPhotos = photos.filter(photo => photo.photoDate >= currentYearStart);
  const hasCurrentYearPhotos = currentYearPhotos.length > 0;
  const hasAnyPhotos = photos.length > 0;

  return (
    <div 
      className="mt-3 pt-3 border-t cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
      onClick={() => onOpenGallery(vehicle)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Odometer Photos:</span>
          {hasCurrentYearPhotos ? (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
              {currentYearPhotos.length} photo{currentYearPhotos.length !== 1 ? 's' : ''} this year
            </Badge>
          ) : hasAnyPhotos ? (
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
              Needs {currentYear} photo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
              No photos
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGallery(vehicle);
          }}
        >
          <Grid3x3 className="h-3 w-3 mr-1" />
          {photos.length > 0 ? `View Gallery (${photos.length})` : "View Gallery"}
        </Button>
      </div>
      {photos.length > 0 ? (
        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {photos.slice(0, 3).map((photo, index) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.photoUrl}
                alt={`Odometer photo from ${formatDate(photo.photoDate)}`}
                className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGallery(vehicle, index);
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center rounded-b">
                <div>{formatDate(photo.photoDate)}</div>
                {photo.mileage && (
                  <div className="opacity-90">{parseFloat(photo.mileage).toLocaleString('en-CA', { maximumFractionDigits: 2 })} km</div>
                )}
              </div>
            </div>
          ))}
          {photos.length > 3 && (
            <div 
              className="relative w-20 h-20 rounded border bg-muted flex items-center justify-center cursor-pointer hover:opacity-80" 
              onClick={(e) => {
                e.stopPropagation();
                onOpenGallery(vehicle);
              }}
            >
              <span className="text-xs font-medium">+{photos.length - 3}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Click to upload photos</p>
      )}
    </div>
  );
}

function MileageLoggingStyleSetting() {
  const { toast } = useToast();
  const { data: mileageStyle, isLoading } = useQuery<{ mileageLoggingStyle: string }>({
    queryKey: ["/api/user/mileage-logging-style"],
  });

  const updateMileageStyleMutation = useMutation({
    mutationFn: async (style: string) => {
      return apiRequest("PATCH", "/api/user/mileage-logging-style", { mileageLoggingStyle: style });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/mileage-logging-style"] });
      toast({
        title: "Setting updated",
        description: "Mileage logging style has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update mileage logging style. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentStyle = mileageStyle?.mileageLoggingStyle || "trip_distance";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle Mileage Logging</CardTitle>
        <CardDescription>
          Choose how you want to log vehicle mileage. This setting applies to all your vehicles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <RadioGroup
            value={currentStyle}
            onValueChange={(value) => updateMileageStyleMutation.mutate(value)}
            disabled={updateMileageStyleMutation.isPending}
          >
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="trip_distance" id="trip_distance" className="mt-1" />
              <div className="space-y-1 flex-1">
                <label htmlFor="trip_distance" className="text-sm font-medium leading-none cursor-pointer">
                  Trip Distance (Simple)
                </label>
                <p className="text-sm text-muted-foreground">
                  Enter the distance for each trip. The system calculates cumulative odometer readings automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="odometer" id="odometer" className="mt-1" />
              <div className="space-y-1 flex-1">
                <label htmlFor="odometer" className="text-sm font-medium leading-none cursor-pointer">
                  Odometer Reading (Full)
                </label>
                <p className="text-sm text-muted-foreground">
                  Enter the actual odometer reading for each entry. Readings must be greater than or equal to the previous reading.
                </p>
              </div>
            </div>
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}

export default function VehiclesPage() {
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [uploadingPhotoType, setUploadingPhotoType] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryVehicle, setGalleryVehicle] = useState<Vehicle | null>(null);
  const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "carousel" | "list">("list");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [initialCarouselIndex, setInitialCarouselIndex] = useState(0);
  const [dateSelectDialogOpen, setDateSelectDialogOpen] = useState(false);
  const [pendingPhotoUpload, setPendingPhotoUpload] = useState<{ vehicleId: string; file: File; extractedDate?: Date } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMileage, setSelectedMileage] = useState<string>("");
  const [showInitialPhotoPrompt, setShowInitialPhotoPrompt] = useState(false);
  const [newlyCreatedVehicleId, setNewlyCreatedVehicleId] = useState<string | null>(null);
  const [dismissedReminders, setDismissedReminders] = useState<Record<string, number>>({});
  const [showYearStartPrompt, setShowYearStartPrompt] = useState(false);
  const [vehiclesNeedingYearStartPhoto, setVehiclesNeedingYearStartPhoto] = useState<Vehicle[]>([]);
  const initialPhotoInputRef = useRef<HTMLInputElement>(null);
  const startOfYearPhotoInputRef = useRef<HTMLInputElement>(null);
  const endOfYearPhotoInputRef = useRef<HTMLInputElement>(null);
  const initialPhotoPromptInputRef = useRef<HTMLInputElement>(null);
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
      
      return vehicle as Vehicle;
    },
    onSuccess: async (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setIsVehicleDialogOpen(false);
      vehicleForm.reset();
      setEditingVehicle(null);
      
      // Show photo upload prompt for newly created vehicle
      setNewlyCreatedVehicleId(vehicle.id);
      setShowInitialPhotoPrompt(true);
      
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

  // Fetch odometer photos for gallery vehicle
  const { data: odometerPhotos = [], refetch: refetchPhotos } = useQuery<OdometerPhoto[]>({
    queryKey: ["/api/vehicles", galleryVehicle?.id, "odometer-photos"],
    queryFn: async () => {
      if (!galleryVehicle) return [];
      const response = await fetch(`/api/vehicles/${galleryVehicle.id}/odometer-photos`);
      if (!response.ok) throw new Error("Failed to fetch photos");
      return response.json();
    },
    enabled: !!galleryVehicle && galleryOpen,
  });

  // Fetch odometer photos for editing vehicle
  const { data: editingVehiclePhotos = [] } = useQuery<OdometerPhoto[]>({
    queryKey: ["/api/vehicles", editingVehicle?.id, "odometer-photos"],
    queryFn: async () => {
      if (!editingVehicle) return [];
      const response = await fetch(`/api/vehicles/${editingVehicle.id}/odometer-photos`);
      if (!response.ok) throw new Error("Failed to fetch photos");
      return response.json();
    },
    enabled: !!editingVehicle && isVehicleDialogOpen,
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ vehicleId, file, photoDate, mileage, notes }: { vehicleId: string; file: File; photoDate: string; mileage?: string; notes?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photoDate", photoDate);
      if (mileage && mileage.trim() !== "") {
        formData.append("mileage", mileage);
      }
      if (notes) {
        formData.append("notes", notes);
      }
      
      const response = await fetch(`/api/vehicles/${vehicleId}/odometer-photos`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload photo");
      }
      
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      if (galleryVehicle) {
        await refetchPhotos();
      }
      setUploadingPhotoType(null);
      setDateSelectDialogOpen(false);
      setPendingPhotoUpload(null);
      setSelectedMileage("");
      
      toast({
        title: "Photo uploaded",
        description: "Odometer photo has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadingPhotoType(null);
      setDateSelectDialogOpen(false);
      setPendingPhotoUpload(null);
      setSelectedMileage("");
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async ({ vehicleId, photoId }: { vehicleId: string; photoId: string }) => {
      const response = await fetch(`/api/vehicles/${vehicleId}/odometer-photos/${photoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete photo");
      }
    },
    onSuccess: async () => {
      if (galleryVehicle) {
        await refetchPhotos();
      }
      toast({
        title: "Photo deleted",
        description: "Odometer photo has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async (vehicleId: string, file: File) => {
    // Try to extract date from EXIF data
    let extractedDate: Date | undefined;
    try {
      const exifData = await exifr.parse(file, {
        pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
      });
      
      if (exifData?.DateTimeOriginal) {
        extractedDate = new Date(exifData.DateTimeOriginal);
      } else if (exifData?.CreateDate) {
        extractedDate = new Date(exifData.CreateDate);
      } else if (exifData?.ModifyDate) {
        extractedDate = new Date(exifData.ModifyDate);
      }
    } catch (error) {
      console.log("EXIF extraction failed:", error);
    }

    // If date was extracted, use it; otherwise show dialog
    if (extractedDate && !isNaN(extractedDate.getTime())) {
      const dateString = extractedDate.toISOString().split('T')[0];
      setSelectedDate(dateString);
      setUploadingPhotoType("uploading");
      uploadPhotoMutation.mutate({ vehicleId, file, photoDate: dateString });
    } else {
      // Show dialog to select date
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedMileage("");
      setPendingPhotoUpload({ vehicleId, file, extractedDate });
      setDateSelectDialogOpen(true);
    }
  };

  const handlePhotoInputChange = async (vehicleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handlePhotoUpload(vehicleId, file);
    }
    event.target.value = "";
  };

  const handleDateSelectConfirm = () => {
    if (pendingPhotoUpload) {
      setUploadingPhotoType("uploading");
      uploadPhotoMutation.mutate({
        vehicleId: pendingPhotoUpload.vehicleId,
        file: pendingPhotoUpload.file,
        photoDate: selectedDate,
        mileage: selectedMileage.trim() !== "" ? selectedMileage : undefined,
      });
    }
  };

  // Get current tax year
  const currentYear = new Date().getFullYear().toString();
  const currentYearStart = `${currentYear}-01-01`;

  // Load dismissed reminders from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("odometerPhotoReminders");
    if (stored) {
      try {
        setDismissedReminders(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse dismissed reminders", e);
      }
    }
  }, []);

  // Helper to check if reminder should be shown for a vehicle
  const shouldShowReminder = (vehicleId: string): boolean => {
    const dismissedTime = dismissedReminders[vehicleId];
    if (!dismissedTime) return true; // Never dismissed, show it
    const hoursSinceDismissal = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    return hoursSinceDismissal >= 24; // Show again after 24 hours
  };

  // Dismiss reminder for a vehicle
  const dismissReminder = (vehicleId: string) => {
    const updated = { ...dismissedReminders, [vehicleId]: Date.now() };
    setDismissedReminders(updated);
    localStorage.setItem("odometerPhotoReminders", JSON.stringify(updated));
  };

  // Check for vehicles needing year-start photos
  useEffect(() => {
    const checkYearStartPhotos = async () => {
      const vehiclesNeedingPhotos: Vehicle[] = [];
      
      for (const vehicle of vehicles) {
        try {
          const response = await fetch(`/api/vehicles/${vehicle.id}/odometer-photos`);
          if (!response.ok) continue;
          const photos: OdometerPhoto[] = await response.json();
          
          // Check if vehicle has no photos for current year
          const currentYearPhotos = photos.filter(photo => photo.photoDate >= currentYearStart);
          
          if (currentYearPhotos.length === 0) {
            // Check if there are any photos at all (from previous years)
            if (photos.length === 0 || photos[0].photoDate < currentYearStart) {
              vehiclesNeedingPhotos.push(vehicle);
            }
          }
        } catch (e) {
          console.error(`Failed to check photos for vehicle ${vehicle.id}`, e);
        }
      }
      
      if (vehiclesNeedingPhotos.length > 0) {
        setVehiclesNeedingYearStartPhoto(vehiclesNeedingPhotos);
        // Check if we should show the prompt (not dismissed today)
        const dismissedKey = `yearStartPrompt_${currentYear}`;
        const dismissedTime = dismissedReminders[dismissedKey];
        const shouldShow = !dismissedTime || (Date.now() - dismissedTime) >= 24 * 60 * 60 * 1000;
        if (shouldShow) {
          setShowYearStartPrompt(true);
        }
      }
    };

    if (vehicles.length > 0) {
      checkYearStartPhotos();
    }
  }, [vehicles, currentYear, dismissedReminders, currentYearStart]);

  // Scroll carousel to initial index when API is ready
  useEffect(() => {
    if (!carouselApi || galleryViewMode !== "carousel") {
      return;
    }

    carouselApi.scrollTo(initialCarouselIndex);
  }, [carouselApi, initialCarouselIndex, galleryViewMode]);

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
                        Upload and manage photos of your odometer for record keeping. These are optional but recommended for tax purposes.
                      </FormDescription>
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setGalleryVehicle(editingVehicle);
                          setGalleryOpen(true);
                          setGalleryViewMode("grid");
                        }}
                      >
                        <Grid3x3 className="mr-2 h-4 w-4" />
                        {editingVehiclePhotos.length > 0
                          ? `View Odometer Gallery (${editingVehiclePhotos.length} photos)`
                          : "No photos yet - Click to upload"}
                      </Button>
                      
                      {editingVehiclePhotos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">
                            {editingVehiclePhotos.length} photo{editingVehiclePhotos.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      )}
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

        {/* Initial Photo Upload Prompt Dialog */}
        <Dialog open={showInitialPhotoPrompt} onOpenChange={(open) => {
          setShowInitialPhotoPrompt(open);
          if (!open) {
            setNewlyCreatedVehicleId(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Initial Odometer Photo</DialogTitle>
              <DialogDescription>
                We recommend uploading a photo of your odometer to help calculate your business use percentage. 
                This photo will document your starting mileage for the tax year.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                You can skip this for now, but we'll remind you to upload a photo later. 
                Photos help ensure accurate tax calculations.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowInitialPhotoPrompt(false);
                  setNewlyCreatedVehicleId(null);
                }}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (newlyCreatedVehicleId && initialPhotoPromptInputRef.current) {
                    initialPhotoPromptInputRef.current.click();
                  }
                }}
              >
                Upload Photo
              </Button>
              <input
                ref={initialPhotoPromptInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (newlyCreatedVehicleId && e.target.files?.[0]) {
                    handlePhotoInputChange(newlyCreatedVehicleId, e);
                    setShowInitialPhotoPrompt(false);
                  }
                  e.target.value = "";
                }}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Date Selection Dialog for Odometer Photos */}
        <Dialog open={dateSelectDialogOpen} onOpenChange={setDateSelectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Date for Odometer Photo</DialogTitle>
              <DialogDescription>
                Choose the date when this odometer photo was taken. If a date was detected from the photo metadata, it will be pre-filled.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="photo-date-input">Photo Date</Label>
                {pendingPhotoUpload?.extractedDate && (
                  <p className="text-sm text-muted-foreground">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Detected date {formatDate(pendingPhotoUpload.extractedDate.toISOString().split('T')[0])} from photo metadata
                  </p>
                )}
                <Input
                  id="photo-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Select the date this odometer photo was taken
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="photo-mileage-input" className="text-base font-medium">
                  Odometer Reading <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="photo-mileage-input"
                  type="number"
                  value={selectedMileage}
                  onChange={(e) => setSelectedMileage(e.target.value)}
                  className="w-full"
                  placeholder="Enter mileage shown in photo"
                  min="0"
                  step="0.01"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  <strong>Required for tax calculations.</strong> Enter the odometer reading displayed in this photo. 
                  This is used to calculate your total annual mileage and business use percentage.
                </p>
                {selectedMileage && parseFloat(selectedMileage) <= 0 && (
                  <p className="text-xs text-destructive">
                    Please enter a valid mileage reading greater than 0.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDateSelectDialogOpen(false);
                  setPendingPhotoUpload(null);
                  setSelectedMileage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDateSelectConfirm}
                disabled={uploadingPhotoType !== null || !selectedMileage || parseFloat(selectedMileage) <= 0}
              >
                {uploadingPhotoType ? "Uploading..." : "Upload Photo"}
              </Button>
              {(!selectedMileage || parseFloat(selectedMileage) <= 0) && (
                <p className="text-xs text-destructive text-center">
                  Mileage is required to upload photo
                </p>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Odometer Photo Gallery Dialog */}
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>
                  {galleryVehicle?.name} - Odometer Photos
                </DialogTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={galleryViewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGalleryViewMode("list")}
                  >
                    <List className="h-4 w-4 mr-1" />
                    List
                  </Button>
                  <Button
                    type="button"
                    variant={galleryViewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGalleryViewMode("grid")}
                  >
                    <Grid3x3 className="h-4 w-4 mr-1" />
                    Grid
                  </Button>
                  <Button
                    type="button"
                    variant={galleryViewMode === "carousel" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGalleryViewMode("carousel")}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Carousel
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            {/* Upload Section */}
            {galleryVehicle && (
              <div className="flex gap-2 p-4 border-b">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => initialPhotoInputRef.current?.click()}
                  disabled={uploadingPhotoType !== null}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingPhotoType ? "Uploading..." : "Upload Photo"}
                </Button>
                <input
                  ref={initialPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (galleryVehicle && e.target.files?.[0]) {
                      handlePhotoInputChange(galleryVehicle.id, e);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            
            <div className="flex-1 overflow-auto">
              {galleryVehicle && (
                <>
                  {galleryViewMode === "list" ? (
                    <div className="p-4">
                      {odometerPhotos.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium mb-2">No photos yet</p>
                          <p className="text-sm">Upload your first odometer photo to get started</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {odometerPhotos
                            .sort((a, b) => new Date(b.photoDate).getTime() - new Date(a.photoDate).getTime())
                            .map((photo) => (
                              <div 
                                key={photo.id} 
                                className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group"
                                onClick={() => window.open(photo.photoUrl, "_blank")}
                              >
                                <img
                                  src={photo.photoUrl}
                                  alt={`Odometer photo from ${formatDate(photo.photoDate)}`}
                                  className="w-20 h-20 object-cover rounded border flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <div className="font-medium text-sm">
                                      {formatDate(photo.photoDate)}
                                    </div>
                                    {photo.mileage && (
                                      <div className="text-sm text-muted-foreground">
                                        {parseFloat(photo.mileage).toLocaleString('en-CA', { maximumFractionDigits: 2 })} km
                                      </div>
                                    )}
                                  </div>
                                  {photo.notes && (
                                    <div className="text-xs text-muted-foreground mt-1 truncate">
                                      {photo.notes}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (galleryVehicle) {
                                      deletePhotoMutation.mutate({ vehicleId: galleryVehicle.id, photoId: photo.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : galleryViewMode === "grid" ? (
                    <div className="p-4">
                      {odometerPhotos.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium mb-2">No photos yet</p>
                          <p className="text-sm">Upload your first odometer photo to get started</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {odometerPhotos.map((photo) => (
                            <div key={photo.id} className="relative group border rounded-lg overflow-hidden">
                              <img
                                src={photo.photoUrl}
                                alt={`Odometer photo from ${formatDate(photo.photoDate)}`}
                                className="w-full h-64 object-contain bg-muted cursor-pointer hover:opacity-90"
                                onClick={() => window.open(photo.photoUrl, "_blank")}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs">
                                    <div className="font-medium">{formatDate(photo.photoDate)}</div>
                                    {photo.mileage && (
                                      <div className="opacity-90 mt-0.5">
                                        {parseFloat(photo.mileage).toLocaleString('en-CA', { maximumFractionDigits: 2 })} km
                                      </div>
                                    )}
                                    {photo.notes && (
                                      <div className="text-xs opacity-80 mt-1">{photo.notes}</div>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-white hover:bg-white/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (galleryVehicle) {
                                        deletePhotoMutation.mutate({ vehicleId: galleryVehicle.id, photoId: photo.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4">
                      {odometerPhotos.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="font-medium mb-2">No photos yet</p>
                          <p className="text-sm">Upload your first odometer photo to get started</p>
                        </div>
                      ) : (
                        <Carousel 
                          setApi={setCarouselApi} 
                          className="w-full"
                          opts={{ startIndex: initialCarouselIndex }}
                        >
                          <CarouselContent>
                            {odometerPhotos.map((photo, index) => (
                              <CarouselItem key={photo.id}>
                                <div className="relative flex items-center justify-center h-[60vh] bg-muted rounded-lg overflow-hidden">
                                  <img
                                    src={photo.photoUrl}
                                    alt={`Odometer photo from ${formatDate(photo.photoDate)}`}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-medium">{formatDate(photo.photoDate)}</p>
                                        {photo.mileage && (
                                          <p className="text-sm opacity-90 mt-0.5">
                                            {parseFloat(photo.mileage).toLocaleString('en-CA', { maximumFractionDigits: 2 })} km
                                          </p>
                                        )}
                                        {photo.notes && (
                                          <p className="text-xs opacity-80 mt-1">{photo.notes}</p>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => window.open(photo.photoUrl, "_blank")}
                                        >
                                          Open Full Size
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => {
                                            if (galleryVehicle) {
                                              deletePhotoMutation.mutate({ vehicleId: galleryVehicle.id, photoId: photo.id });
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          {odometerPhotos.length > 1 && (
                            <>
                              <CarouselPrevious />
                              <CarouselNext />
                            </>
                          )}
                        </Carousel>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <MileageLoggingStyleSetting />

      {/* Year-Start Photo Prompt */}
      {showYearStartPrompt && vehiclesNeedingYearStartPhoto.length > 0 && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            New Tax Year - Upload Odometer Photos
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <div className="space-y-2">
              <p>
                It's a new tax year! Please upload odometer photos for the following vehicles to ensure accurate calculations:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {vehiclesNeedingYearStartPhoto.map(vehicle => (
                  <li key={vehicle.id}>{vehicle.name}</li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (vehiclesNeedingYearStartPhoto.length > 0) {
                      const firstVehicle = vehiclesNeedingYearStartPhoto[0];
                      setGalleryVehicle(firstVehicle);
                      setGalleryOpen(true);
                      setGalleryViewMode("grid");
                    }
                  }}
                >
                  Upload Photos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const dismissedKey = `yearStartPrompt_${currentYear}`;
                    const updated = { ...dismissedReminders, [dismissedKey]: Date.now() };
                    setDismissedReminders(updated);
                    localStorage.setItem("odometerPhotoReminders", JSON.stringify(updated));
                    setShowYearStartPrompt(false);
                  }}
                >
                  Remind me later
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Reminder Banner for Vehicles Missing Photos */}
      {vehicles.map((vehicle) => (
        <VehiclePhotoReminder
          key={vehicle.id}
          vehicle={vehicle}
          shouldShow={shouldShowReminder(vehicle.id)}
          onDismiss={() => dismissReminder(vehicle.id)}
          onUpload={() => {
            setGalleryVehicle(vehicle);
            setGalleryOpen(true);
            setGalleryViewMode("grid");
          }}
        />
      ))}

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
                      <VehiclePhotosPreview
                        vehicle={vehicle}
                        onOpenGallery={(vehicle, index) => {
                          setGalleryVehicle(vehicle);
                          if (index !== undefined) {
                            setInitialCarouselIndex(index);
                            setGalleryViewMode("carousel");
                          } else {
                            setGalleryViewMode("grid");
                          }
                          setGalleryOpen(true);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link href={`/vehicle-mileage?vehicleId=${vehicle.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-view-mileage-${vehicle.id}`}
                              >
                                <Gauge className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View Odometer Records</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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

