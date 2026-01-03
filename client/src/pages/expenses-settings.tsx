import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Settings, ArrowLeft, Plus, Edit, Trash2 } from "lucide-react";
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
import { EXPENSE_CATEGORIES, type Expense, type User } from "@shared/schema";
import { getCategoryLabel } from "@/lib/format";
import { useTaxYear } from "@/components/tax-year-provider";

// Define home office subcategories
const HOME_OFFICE_SUBCATEGORIES = [
  { id: 'heat', label: 'Heat' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'mortgage_interest', label: 'Mortgage Interest' },
  { id: 'property_taxes', label: 'Property Taxes' },
  { id: 'rent', label: 'Rent' },
] as const;

export default function ExpensesSettingsPage() {
  const { toast } = useToast();
  
  // Local state to track selected categories (before saving)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<Set<string>>(new Set());
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // Home office percentage state
  const [homeOfficePercentage, setHomeOfficePercentage] = useState<string>("");

  const { data: expenseList } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user/profile"],
  });


  // Get enabled categories from user profile (default to all if not set)
  const savedEnabledCategories = useMemo(() => {
    if (user?.enabledExpenseCategories) {
      return new Set(user.enabledExpenseCategories as string[]);
    }
    // Default: all categories enabled
    return new Set(EXPENSE_CATEGORIES);
  }, [user]);

  // Extract custom categories (those not in EXPENSE_CATEGORIES)
  const savedCustomCategories = useMemo(() => {
    if (user?.enabledExpenseCategories) {
      const allCategories = user.enabledExpenseCategories as string[];
      return new Set(allCategories.filter(cat => !EXPENSE_CATEGORIES.includes(cat as any)));
    }
    return new Set<string>();
  }, [user]);

  // Initialize local state from saved preferences
  useEffect(() => {
    // Combine saved enabled categories with all custom categories (custom categories are always enabled)
    const allSelected = new Set(savedEnabledCategories);
    savedCustomCategories.forEach(cat => allSelected.add(cat));
    setSelectedCategories(allSelected);
    setCustomCategories(savedCustomCategories);
    
    // Initialize home office percentage from user profile
    if (user?.homeOfficePercentage) {
      setHomeOfficePercentage(parseFloat(user.homeOfficePercentage.toString()).toString());
    } else {
      setHomeOfficePercentage("");
    }
  }, [savedEnabledCategories, savedCustomCategories, user]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    // Check predefined categories
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
    // Check custom categories
    if (customCategories.size !== savedCustomCategories.size) {
      return true;
    }
    const customArray = Array.from(customCategories);
    const savedCustomArray = Array.from(savedCustomCategories);
    for (const category of customArray) {
      if (!savedCustomCategories.has(category)) {
        return true;
      }
    }
    for (const category of savedCustomArray) {
      if (!customCategories.has(category)) {
        return true;
      }
    }
    return false;
  }, [selectedCategories, savedEnabledCategories, customCategories, savedCustomCategories]);

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

  const updateHomeOfficePercentageMutation = useMutation({
    mutationFn: async (percentage: number | null) => {
      const response = await apiRequest("PATCH", "/api/user/profile", {
        homeOfficePercentage: percentage,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update home office percentage");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({
        title: "Home office percentage updated",
        description: "Your home office percentage has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update home office percentage. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleHomeOfficePercentageChange = (value: string) => {
    setHomeOfficePercentage(value);
  };

  const handleHomeOfficePercentageBlur = () => {
    const percentage = homeOfficePercentage.trim() === "" 
      ? null 
      : parseFloat(homeOfficePercentage);
    if (percentage !== null && (isNaN(percentage) || percentage < 0 || percentage > 100)) {
      toast({
        title: "Invalid percentage",
        description: "Please enter a value between 0 and 100",
        variant: "destructive",
      });
      // Reset to saved value
      if (user?.homeOfficePercentage) {
        setHomeOfficePercentage(parseFloat(user.homeOfficePercentage.toString()).toString());
      } else {
        setHomeOfficePercentage("");
      }
      return;
    }
    // Only save if value changed
    const currentPercentage = user?.homeOfficePercentage 
      ? parseFloat(user.homeOfficePercentage.toString()) 
      : null;
    if (percentage !== currentPercentage) {
      updateHomeOfficePercentageMutation.mutate(percentage);
    }
  };

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
    // Combine predefined and custom categories
    const allCategories = [...Array.from(selectedCategories), ...Array.from(customCategories)];
    updateEnabledCategoriesMutation.mutate(allCategories);
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCustomCategory.trim();
    if (!trimmed) {
      toast({
        title: "Error",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }
    if (customCategories.has(trimmed) || selectedCategories.has(trimmed) || EXPENSE_CATEGORIES.includes(trimmed as any)) {
      toast({
        title: "Error",
        description: "This category already exists",
        variant: "destructive",
      });
      return;
    }
    setCustomCategories((prev) => {
      const updated = new Set(prev);
      updated.add(trimmed);
      return updated;
    });
    // Automatically select the new custom category
    setSelectedCategories((prev) => {
      const updated = new Set(prev);
      updated.add(trimmed);
      return updated;
    });
    setNewCustomCategory("");
  };

  const handleEditCustomCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const handleSaveEditCustomCategory = () => {
    if (!editingCategory) return;
    
    const trimmed = editingCategoryName.trim();
    if (!trimmed) {
      toast({
        title: "Error",
        description: "Please enter a category name",
        variant: "destructive",
      });
      return;
    }
    
    // Check if the new name already exists (and it's not the same as the old name)
    if (trimmed !== editingCategory && (customCategories.has(trimmed) || selectedCategories.has(trimmed) || EXPENSE_CATEGORIES.includes(trimmed as any))) {
      toast({
        title: "Error",
        description: "This category name already exists",
        variant: "destructive",
      });
      return;
    }
    
    // Update custom categories
    setCustomCategories((prev) => {
      const updated = new Set(prev);
      updated.delete(editingCategory);
      updated.add(trimmed);
      return updated;
    });
    
    // Update selected categories
    setSelectedCategories((prev) => {
      const updated = new Set(prev);
      if (updated.has(editingCategory)) {
        updated.delete(editingCategory);
        updated.add(trimmed);
      }
      return updated;
    });
    
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const handleRemoveCustomCategory = (category: string) => {
    setCustomCategories((prev) => {
      const updated = new Set(prev);
      updated.delete(category);
      return updated;
    });
    // Also remove from selected if it was selected
    setSelectedCategories((prev) => {
      const updated = new Set(prev);
      updated.delete(category);
      return updated;
    });
  };

  // Helper to format custom category labels (convert snake_case to Title Case)
  const formatCustomCategoryLabel = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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
            Expense Settings
          </h1>
          <p className="text-muted-foreground">Manage your expense settings</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
          <CardDescription>
            Select which type of business expenses you have
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* Large categories - each in their own row */}
            <div className="lg:col-span-3 space-y-2">
              {/* Home Office Expenses */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={`category-home_office_expenses`}
                      checked={selectedCategories.has("home_office_expenses")}
                      onCheckedChange={(checked) => toggleCategory("home_office_expenses", checked as boolean)}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`category-home_office_expenses`}
                      className="font-medium cursor-pointer flex-1"
                    >
                      {getCategoryLabel("home_office_expenses")}
                    </label>
                    {categoryCounts.get("home_office_expenses") ? (
                      <Badge variant="secondary" className="text-xs">
                        {categoryCounts.get("home_office_expenses")} expense{categoryCounts.get("home_office_expenses") !== 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {selectedCategories.has("home_office_expenses") && (
                  <div className="mt-2 pl-7">
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">
                        Enter the percentage of your home used for Business purposes:
                      </label>
                      <div className="relative w-24">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0.00"
                          value={homeOfficePercentage}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string or valid number between 0-100
                            if (value === "" || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                              handleHomeOfficePercentageChange(value);
                            }
                          }}
                          onBlur={handleHomeOfficePercentageBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="pr-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          disabled={updateHomeOfficePercentageMutation.isPending}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                      </div>
                      {updateHomeOfficePercentageMutation.isPending && (
                        <span className="text-xs text-muted-foreground">Saving...</span>
                      )}
                    </div>
                  </div>
                )}
                {HOME_OFFICE_SUBCATEGORIES.length > 0 && (
                  <div className="mt-2 pl-7">
                    <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {HOME_OFFICE_SUBCATEGORIES.map((subcat) => (
                        <li key={subcat.id} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                          {subcat.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Motor Vehicle Expenses */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-1">
                    <Checkbox
                      id={`category-motor_vehicle_expenses`}
                      checked={selectedCategories.has("motor_vehicle_expenses")}
                      onCheckedChange={(checked) => toggleCategory("motor_vehicle_expenses", checked as boolean)}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`category-motor_vehicle_expenses`}
                      className="font-medium cursor-pointer flex-1"
                    >
                      {getCategoryLabel("motor_vehicle_expenses")}
                    </label>
                    {categoryCounts.get("motor_vehicle_expenses") ? (
                      <Badge variant="secondary" className="text-xs">
                        {categoryCounts.get("motor_vehicle_expenses")} expense{categoryCounts.get("motor_vehicle_expenses") !== 1 ? "s" : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {/* Regular categories */}
            {EXPENSE_CATEGORIES.filter(
              (category) => category !== "home_office_expenses" && category !== "motor_vehicle_expenses"
            ).map((category) => {
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
            {/* Custom categories */}
            {Array.from(customCategories).map((category) => {
              const count = categoryCounts.get(category) || 0;
              return (
                <div
                  key={category}
                  className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium flex-1">
                      {formatCustomCategoryLabel(category)}
                    </span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {count} expense{count !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCustomCategory(category)}
                      disabled={updateEnabledCategoriesMutation.isPending}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCustomCategory(category)}
                      disabled={updateEnabledCategoriesMutation.isPending}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Custom Categories Widget */}
          <div className="mt-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium">Custom Categories</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Enter custom category name"
                value={newCustomCategory}
                onChange={(e) => setNewCustomCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomCategory();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleAddCustomCategory}
                size="sm"
                disabled={updateEnabledCategoriesMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {customCategories.size > 0 && (
              <div className="flex flex-wrap gap-2">
                {Array.from(customCategories).map((category) => (
                  <Badge
                    key={category}
                    variant="outline"
                    className="flex items-center gap-1.5 pr-1"
                  >
                    {formatCustomCategoryLabel(category)}
                    <button
                      onClick={() => handleRemoveCustomCategory(category)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      disabled={updateEnabledCategoriesMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {/* Edit Custom Category Dialog */}
          <Dialog open={editingCategory !== null} onOpenChange={(open) => {
            if (!open) {
              setEditingCategory(null);
              setEditingCategoryName("");
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Custom Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Category Name</label>
                  <Input
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveEditCustomCategory();
                      }
                    }}
                    placeholder="Enter category name"
                    className="mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCategory(null);
                    setEditingCategoryName("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveEditCustomCategory}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

    </div>
  );
}
