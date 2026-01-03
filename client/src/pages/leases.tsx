import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { FileText, Plus, Edit, Trash2, Info, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type LeaseContract, type LeasePayment } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTaxYear } from "@/components/tax-year-provider";

const leaseContractFormSchema = z.object({
  leaseType: z.enum(["vehicle", "equipment"]),
  name: z.string().min(1, "Lease name is required"),
  description: z.string().optional(),
  lessorName: z.string().optional(),
  leaseStartDate: z.string().min(1, "Lease start date is required"),
  leaseEndDate: z.string().optional(),
  monthlyPayment: z.string().min(1, "Monthly payment is required").refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }, {
    message: "Monthly payment must be a valid number",
  }),
  paymentFrequency: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  businessUsePercentage: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num) && num >= 0 && num <= 100;
  }, {
    message: "Business use percentage must be between 0 and 100",
  }),
  vehicleId: z.string().optional(),
  assetCategory: z.string().optional(),
});

type LeaseContractFormData = z.input<typeof leaseContractFormSchema>;

export default function LeasesPage() {
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<LeaseContract | null>(null);
  const { taxYear } = useTaxYear();
  const { toast } = useToast();

  const { data: contracts = [] } = useQuery<LeaseContract[]>({
    queryKey: ["/api/lease-contracts"],
  });

  const contractForm = useForm<LeaseContractFormData>({
    resolver: zodResolver(leaseContractFormSchema),
    defaultValues: {
      leaseType: "equipment",
      name: "",
      description: "",
      lessorName: "",
      leaseStartDate: "",
      leaseEndDate: "",
      monthlyPayment: "",
      paymentFrequency: "monthly",
      businessUsePercentage: "100",
      vehicleId: "",
      assetCategory: "",
    },
  });

  const leaseType = contractForm.watch("leaseType");

  const createContractMutation = useMutation({
    mutationFn: async (data: LeaseContractFormData) => {
      const response = await apiRequest("POST", "/api/lease-contracts", {
        ...data,
        monthlyPayment: data.monthlyPayment,
        businessUsePercentage: data.businessUsePercentage,
        vehicleId: data.vehicleId || undefined,
        assetCategory: data.assetCategory || undefined,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create lease contract");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      setIsContractDialogOpen(false);
      contractForm.reset();
      setEditingContract(null);
      toast({
        title: "Lease contract created",
        description: "Your lease contract has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lease contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeaseContractFormData> }) => {
      const response = await apiRequest("PATCH", `/api/lease-contracts/${id}`, {
        ...data,
        monthlyPayment: data.monthlyPayment,
        businessUsePercentage: data.businessUsePercentage,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update lease contract");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      setIsContractDialogOpen(false);
      contractForm.reset();
      setEditingContract(null);
      toast({
        title: "Lease contract updated",
        description: "Your lease contract has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lease contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/lease-contracts/${id}`);
      if (!response.ok) {
        throw new Error("Failed to delete lease contract");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lease-contracts"] });
      toast({
        title: "Lease contract deleted",
        description: "The lease contract has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lease contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditContract = (contract: LeaseContract) => {
    setEditingContract(contract);
    contractForm.reset({
      leaseType: contract.leaseType as "vehicle" | "equipment",
      name: contract.name || "",
      description: contract.description || "",
      lessorName: contract.lessorName || "",
      leaseStartDate: contract.leaseStartDate || "",
      leaseEndDate: contract.leaseEndDate || "",
      monthlyPayment: contract.monthlyPayment ? parseFloat(contract.monthlyPayment.toString()).toString() : "",
      paymentFrequency: (contract.paymentFrequency as "monthly" | "quarterly" | "annual") || "monthly",
      businessUsePercentage: contract.businessUsePercentage ? parseFloat(contract.businessUsePercentage.toString()).toString() : "100",
      vehicleId: contract.vehicleId || "",
      assetCategory: contract.assetCategory || "",
    });
    setIsContractDialogOpen(true);
  };

  const handleContractSubmit = (data: LeaseContractFormData) => {
    if (editingContract) {
      updateContractMutation.mutate({ id: editingContract.id, data });
    } else {
      createContractMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Lease Contracts
          </h1>
          <p className="text-muted-foreground">Manage your vehicle and equipment leases</p>
        </div>
        <Dialog open={isContractDialogOpen} onOpenChange={(open) => {
          setIsContractDialogOpen(open);
          if (!open) {
            setEditingContract(null);
            contractForm.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Lease Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingContract ? "Edit Lease Contract" : "Add Lease Contract"}</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 pr-2">
              <Form {...contractForm}>
                <form onSubmit={contractForm.handleSubmit(handleContractSubmit)} className="space-y-4">
                  <FormField
                    control={contractForm.control}
                    name="leaseType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select lease type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="vehicle">Vehicle</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contractForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Office Equipment Lease, Company Vehicle" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contractForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contractForm.control}
                    name="lessorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lessor Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., ABC Leasing Inc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={contractForm.control}
                      name="leaseStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractForm.control}
                      name="leaseEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={contractForm.control}
                      name="monthlyPayment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Payment *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input {...field} type="number" step="0.01" placeholder="0.00" className="pl-7" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractForm.control}
                      name="paymentFrequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Frequency *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={contractForm.control}
                    name="businessUsePercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Use Percentage *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input {...field} type="number" step="0.01" min="0" max="100" placeholder="100" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          The percentage of this lease used for business purposes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {leaseType === "equipment" && (
                    <FormField
                      control={contractForm.control}
                      name="assetCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Category</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Office Equipment, Machinery" />
                          </FormControl>
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
                  setIsContractDialogOpen(false);
                  setEditingContract(null);
                  contractForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createContractMutation.isPending || updateContractMutation.isPending}
                onClick={contractForm.handleSubmit(handleContractSubmit)}
              >
                {createContractMutation.isPending || updateContractMutation.isPending
                  ? "Saving..."
                  : editingContract
                  ? "Update Contract"
                  : "Create Contract"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No lease contracts yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first lease contract to start tracking lease expenses
            </p>
            <Button onClick={() => setIsContractDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lease Contract
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lease Contracts</CardTitle>
            <CardDescription>
              Manage your vehicle and equipment leases for the {taxYear} tax year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lessor</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Business Use</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.name}</TableCell>
                    <TableCell>
                      <Badge variant={contract.leaseType === "vehicle" ? "default" : "secondary"}>
                        {contract.leaseType === "vehicle" ? "Vehicle" : "Equipment"}
                      </Badge>
                    </TableCell>
                    <TableCell>{contract.lessorName || "-"}</TableCell>
                    <TableCell>
                      {formatCurrency(parseFloat(contract.monthlyPayment.toString()))}
                      <span className="text-xs text-muted-foreground ml-1">
                        /{contract.paymentFrequency === "monthly" ? "mo" : contract.paymentFrequency === "quarterly" ? "qr" : "yr"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {parseFloat(contract.businessUsePercentage?.toString() || "100").toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {contract.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditContract(contract)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete lease contract?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this lease contract and all associated payments.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteContractMutation.mutate(contract.id)}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

