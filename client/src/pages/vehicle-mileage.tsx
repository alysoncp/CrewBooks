import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Plus, Trash2, Edit2, Car, RotateCcw } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { formatDate, getTodayLocalDateString } from "@/lib/format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Vehicle, type VehicleMileageLog } from "@shared/schema";

// Dynamic schema based on logging style
const createMileageLogFormSchema = (isOdometerStyle: boolean) => z.object({
  date: z.string().min(1, "Date is required"),
  tripTitle: z.string().optional(),
  odometerReading: z.string().min(1, isOdometerStyle ? "Odometer reading is required" : "Trip distance is required").transform((v) => parseFloat(v)),
  description: z.string().optional(),
  isBusinessUse: z.boolean().default(true),
  isRepeatTrip: z.boolean().default(false),
});

type MileageLogFormData = z.input<ReturnType<typeof createMileageLogFormSchema>>;

export default function VehicleMileagePage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  // Get user's mileage logging style preference
  const { data: mileageStyle } = useQuery<{ mileageLoggingStyle: string }>({
    queryKey: ["/api/user/mileage-logging-style"],
  });

  const mileageLoggingStyle = mileageStyle?.mileageLoggingStyle || "trip_distance";

  const { data: mileageLogs = [], isLoading: logsLoading } = useQuery<VehicleMileageLog[]>({
    queryKey: ["/api/vehicles", selectedVehicleId, "mileage-logs"],
    queryFn: async () => {
      if (!selectedVehicleId) return [];
      const response = await fetch(`/api/vehicles/${selectedVehicleId}/mileage-logs`);
      if (!response.ok) throw new Error("Failed to fetch mileage logs");
      return response.json();
    },
    enabled: !!selectedVehicleId,
  });

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  const isOdometerStyle = mileageLoggingStyle === "odometer";
  const mileageLogFormSchema = createMileageLogFormSchema(isOdometerStyle);

  const form = useForm<MileageLogFormData>({
    resolver: zodResolver(mileageLogFormSchema),
    defaultValues: {
      date: getTodayLocalDateString(),
      tripTitle: "",
      odometerReading: "",
      description: "",
      isBusinessUse: true,
      isRepeatTrip: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MileageLogFormData) => {
      if (isOdometerStyle) {
        // Odometer style: use the reading directly
        return apiRequest("POST", `/api/vehicles/${selectedVehicleId}/mileage-logs`, {
          date: data.date,
          odometerReading: data.odometerReading.toString(),
          description: data.tripTitle || "",
          isBusinessUse: data.isBusinessUse,
        });
      } else {
        // Trip distance style: calculate cumulative odometer reading from trip distance
        const tripDistance = parseFloat(data.odometerReading.toString());
        // Get the latest odometer reading from existing logs or vehicle starting mileage
        const sortedLogs = [...mileageLogs].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const lastLog = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1] : null;
        const lastOdometer = lastLog 
          ? Number(lastLog.odometerReading) 
          : (selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0);
        const newOdometerReading = lastOdometer + tripDistance;
        
        return apiRequest("POST", `/api/vehicles/${selectedVehicleId}/mileage-logs`, {
          date: data.date,
          odometerReading: newOdometerReading.toString(),
          description: data.tripTitle || "",
          isBusinessUse: data.isBusinessUse,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicleId, "mileage-logs"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Mileage log added",
        description: "Your mileage entry has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add mileage log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: MileageLogFormData }) => {
      if (isOdometerStyle) {
        // Odometer style: use the reading directly
        return apiRequest("PATCH", `/api/mileage-logs/${id}`, {
          date: data.date,
          odometerReading: data.odometerReading.toString(),
          description: data.tripTitle || "",
          isBusinessUse: data.isBusinessUse,
        });
      } else {
        // Trip distance style: calculate new odometer reading based on trip distance
        const logToUpdate = mileageLogs.find(log => log.id === id);
        if (!logToUpdate) throw new Error("Log not found");
        
        const tripDistance = parseFloat(data.odometerReading.toString());
        
        // Get all logs except the one being updated, sorted by date
        const otherLogs = [...mileageLogs.filter(log => log.id !== id)].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Find the previous log based on the original date (to maintain chronological order)
        const originalDate = new Date(logToUpdate.date).getTime();
        const previousLog = otherLogs
          .filter(log => new Date(log.date).getTime() < originalDate)
          .pop(); // Get the last log before this one's original date
        
        let newOdometerReading: number;
        if (!previousLog) {
          // This was the first log chronologically
          const startingMileage = selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0;
          newOdometerReading = startingMileage + tripDistance;
        } else {
          // Use the previous log's odometer reading
          newOdometerReading = Number(previousLog.odometerReading) + tripDistance;
        }
        
        return apiRequest("PATCH", `/api/mileage-logs/${id}`, {
          date: data.date,
          odometerReading: newOdometerReading.toString(),
          description: data.tripTitle || "",
          isBusinessUse: data.isBusinessUse,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicleId, "mileage-logs"] });
      setIsDialogOpen(false);
      setEditingLogId(null);
      form.reset();
      toast({
        title: "Mileage log updated",
        description: "Your mileage entry has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update mileage log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/mileage-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", selectedVehicleId, "mileage-logs"] });
      toast({
        title: "Mileage log deleted",
        description: "The mileage entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete mileage log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (log: VehicleMileageLog) => {
    setEditingLogId(log.id);
    
    let readingValue: string;
    if (isOdometerStyle) {
      // Odometer style: use the reading directly
      readingValue = log.odometerReading.toString();
    } else {
      // Trip distance style: calculate trip distance from this log and the previous one
      const sortedLogs = [...mileageLogs].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const logIndex = sortedLogs.findIndex(l => l.id === log.id);
      let tripDistance = 0;
      if (logIndex > 0) {
        const prevLog = sortedLogs[logIndex - 1];
        tripDistance = Number(log.odometerReading) - Number(prevLog.odometerReading);
      } else {
        // First log, use vehicle starting mileage
        const startingMileage = selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0;
        tripDistance = Number(log.odometerReading) - startingMileage;
      }
      readingValue = tripDistance.toString();
    }
    
    form.reset({
      date: log.date,
      tripTitle: log.description || "",
      odometerReading: readingValue,
      isBusinessUse: log.isBusinessUse ?? true,
      isRepeatTrip: false,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingLogId(null);
    form.reset({
      date: getTodayLocalDateString(),
      tripTitle: "",
      odometerReading: "",
      isBusinessUse: true,
      isRepeatTrip: false,
    });
    setIsDialogOpen(true);
  };

  const handleRepeatTrip = (log: VehicleMileageLog) => {
    setEditingLogId(null);
    
    let readingValue: string;
    if (isOdometerStyle) {
      // Odometer style: can't repeat odometer readings, use current reading
      readingValue = log.odometerReading.toString();
    } else {
      // Trip distance style: calculate trip distance from this log
      const sortedLogs = [...mileageLogs].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const logIndex = sortedLogs.findIndex(l => l.id === log.id);
      
      let tripDistance = 0;
      if (logIndex > 0) {
        const prevLog = sortedLogs[logIndex - 1];
        tripDistance = Number(log.odometerReading) - Number(prevLog.odometerReading);
      } else {
        const startingMileage = selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0;
        tripDistance = Number(log.odometerReading) - startingMileage;
      }
      readingValue = tripDistance.toString();
    }
    
    form.reset({
      date: getTodayLocalDateString(), // Use today's date for the repeat
      tripTitle: log.description || "",
      odometerReading: readingValue,
      isBusinessUse: log.isBusinessUse ?? true,
      isRepeatTrip: true,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: MileageLogFormData) => {
    if (editingLogId) {
      updateMutation.mutate({ id: editingLogId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Calculate distances between consecutive logs (sorted by date)
  const sortedLogs = [...mileageLogs].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const logsWithDistance = sortedLogs.map((log, index) => {
    let distance = 0;
    if (index === 0) {
      // First log: calculate from vehicle starting mileage
      const startingMileage = selectedVehicle?.currentMileage ? Number(selectedVehicle.currentMileage) : 0;
      distance = Number(log.odometerReading) - startingMileage;
    } else {
      const prevLog = sortedLogs[index - 1];
      distance = Number(log.odometerReading) - Number(prevLog.odometerReading);
    }
    return { ...log, distance: Math.max(0, distance) };
  });

  const filteredLogs = logsWithDistance.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.description?.toLowerCase().includes(searchLower) ||
      formatDate(log.date).toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate totals
  const totalMileage = logsWithDistance.reduce((sum, log) => sum + log.distance, 0);
  const businessMileage = logsWithDistance
    .filter((log) => log.isBusinessUse)
    .reduce((sum, log) => sum + log.distance, 0);

  // Auto-select first vehicle if available and none selected
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId && !vehiclesLoading) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId, vehiclesLoading]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vehicle Mileage</h1>
          <p className="text-muted-foreground">Track mileage for your vehicles</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedVehicleId || ""}
            onValueChange={(value) => setSelectedVehicleId(value)}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-vehicle">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleAdd}
                disabled={!selectedVehicleId}
                data-testid="button-add-mileage"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Mileage
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingLogId ? "Edit Mileage Log" : "Add Mileage Log"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="tripTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trip Title</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., Trip to location, Client meeting..."
                            data-testid="input-trip-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-mileage-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="odometerReading"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isOdometerStyle ? "Odometer Reading (km)" : "Trip Distance (km)"}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="font-mono"
                            data-testid={isOdometerStyle ? "input-odometer-reading" : "input-trip-distance"}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormDescription>
                          {isOdometerStyle 
                            ? "Enter the current odometer reading. It must be greater than or equal to the previous reading."
                            : "Enter the distance traveled for this trip"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isBusinessUse"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Business Use</FormLabel>
                          <FormDescription>
                            Mark this mileage as business-related
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-business-use"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-mileage"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? "Saving..."
                        : editingLogId
                        ? "Update"
                        : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedVehicleId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No vehicle selected</h3>
            <p className="mt-1 text-muted-foreground">
              Select a vehicle from the dropdown above to start tracking mileage
            </p>
            {vehicles.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                You need to add a vehicle first. Go to{" "}
                <a href="/expenses/settings" className="text-primary underline">
                  Expense Settings
                </a>{" "}
                to add vehicles.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedVehicle && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Mileage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-2xl font-semibold" data-testid="stat-total-mileage">
                    {totalMileage.toLocaleString()} km
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Business Mileage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="font-mono text-2xl font-semibold text-green-600 dark:text-green-400"
                    data-testid="stat-business-mileage"
                  >
                    {businessMileage.toLocaleString()} km
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>
                    {selectedVehicle ? `Mileage Logs - ${selectedVehicle.name}` : "Mileage Logs"}
                  </CardTitle>
                  <CardDescription>All recorded mileage entries for this vehicle</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-mileage"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Car className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">No mileage logs recorded</h3>
                  <p className="mt-1 text-muted-foreground">
                    {searchQuery
                      ? "No results match your search"
                      : "Add your first mileage entry to get started"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Distance (km)</TableHead>
                        <TableHead className="text-center">Business</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-mileage-${log.id}`}>
                          <TableCell className="text-muted-foreground">
                            {formatDate(log.date)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md truncate">{log.description || "—"}</div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {log.distance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            {log.isBusinessUse ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                Business
                              </Badge>
                            ) : (
                              <Badge variant="outline">Personal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRepeatTrip(log)}
                                data-testid={`button-repeat-mileage-${log.id}`}
                                title="Repeat this trip"
                              >
                                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(log)}
                                data-testid={`button-edit-mileage-${log.id}`}
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-delete-mileage-${log.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete mileage log?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove this mileage entry. This action
                                      cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(log.id)}
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

