import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Receipt, Search, CheckCircle } from "lucide-react";
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
import { formatCurrency, formatDate, getCategoryLabel } from "@/lib/format";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES, type Expense } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

// Define vehicle subcategories (since schema config was rejected, define inline)
const VEHICLE_SUBCATEGORIES = [
  { id: 'fuel', label: 'Fuel' },
  { id: 'maintenance', label: 'Maintenance & Repairs' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'registration', label: 'Registration & Licensing' },
  { id: 'parking', label: 'Parking & Tolls' },
  { id: 'lease_payment', label: 'Lease or Loan Payment' },
  { id: 'other_vehicle', label: 'Other' },
] as const;

// Define Vehicle type based on what the API returns
type Vehicle = {
  id: string;
  userId: string;
  name: string;
  make?: string | null;
  model?: string | null;
  year?: string | null;
  licensePlate?: string | null;
  isPrimary?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const expenseFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").transform((v) => parseFloat(v)),
  date: z.string().min(1, "Date is required"),
  category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]]),
  subcategory: z.string().optional(),
  vehicleId: z.string().optional(),
  vendor: z.string().optional(),
  description: z.string().optional(),
  isTaxDeductible: z.boolean().default(true),
  gstHstPaid: z.string().optional().transform((v) => v ? parseFloat(v) : undefined),
}).refine((data) => {
  if (data.category === 'vehicle' && !data.vehicleId) {
    return false;
  }
  return true;
}, {
  message: "Please select a vehicle",
  path: ["vehicleId"],
});

type ExpenseFormData = z.input<typeof expenseFormSchema>;

export default function ExpensesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const hasGstNumber = user?.hasGstNumber === true;

  const { data: expenseList, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // ADD THIS: Fetch vehicles from API
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
    enabled: form.watch("category") === "vehicle", // Only fetch when vehicle category is selected
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: "",
      date: new Date().toISOString().split("T")[0],
      category: "",
      vendor: "",
      description: "",
      isTaxDeductible: true,
      gstHstPaid: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      return apiRequest("POST", "/api/expenses", {
        ...data,
        amount: data.amount.toString(),
        gstHstPaid: data.gstHstPaid?.toString() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Expense added",
        description: "Your expense has been recorded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Expense deleted",
        description: "The expense entry has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete expense. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createMutation.mutate(data);
  };

  const filteredExpenses = (expenseList || []).filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.vendor?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      getCategoryLabel(item.category).toLowerCase().includes(searchLower)
    );
  });

  const totalExpenses = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const deductibleExpenses = filteredExpenses
    .filter((item) => item.isTaxDeductible)
    .reduce((sum, item) => sum + parseFloat(item.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-expenses-title">Expenses</h1>
          <p className="text-muted-foreground">Track your business expenses and deductions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
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
                            data-testid="input-expense-amount"
                          />
                        </div>
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
                        <Input {...field} type="date" data-testid="input-expense-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {getCategoryLabel(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("category") === "vehicle" && (
                  <>
                    <FormField
                      control={form.control}
                      name="vehicleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vehicle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicles.length === 0 ? (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                  No vehicles found. Add a vehicle in your profile settings.
                                </div>
                              ) : (
                                vehicles.map((vehicle) => (
                                  <SelectItem key={vehicle.id} value={vehicle.id}>
                                    {vehicle.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subcategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expense Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select expense type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {VEHICLE_SUBCATEGORIES.map((subcat) => (
                                <SelectItem key={subcat.id} value={subcat.id}>
                                  {subcat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Best Buy, Air Canada"
                          data-testid="input-expense-vendor"
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Additional details..."
                          data-testid="input-expense-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isTaxDeductible"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Tax Deductible</FormLabel>
                        <FormDescription>
                          Mark this expense as a business deduction
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-tax-deductible"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {hasGstNumber && (
                  <FormField
                    control={form.control}
                    name="gstHstPaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GST/HST Paid (ITC)</FormLabel>
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
                              data-testid="input-expense-gst-hst"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>Input Tax Credit for GST/HST on this expense</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-expense">
                    {createMutation.isPending ? "Saving..." : "Save Expense"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold" data-testid="stat-total-expenses">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tax Deductible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="stat-deductible-expenses">
              {formatCurrency(deductibleExpenses)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Expense History</CardTitle>
              <CardDescription>All recorded business expenses</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-expenses"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No expenses recorded</h3>
              <p className="mt-1 text-muted-foreground">
                {searchQuery ? "No results match your search" : "Add your first expense to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-center">Deductible</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((item) => (
                    <TableRow key={item.id} data-testid={`row-expense-${item.id}`}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(item.category)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.vendor || "—"}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.isTaxDeductible && (
                          <CheckCircle className="mx-auto h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-red-600 dark:text-red-400">
                        -{formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-delete-expense-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete expense entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this expense record. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
