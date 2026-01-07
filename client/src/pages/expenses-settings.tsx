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
import { SELF_EMPLOYMENT_EXPENSE_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES, TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES, NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES, type Expense, type User } from "@shared/schema";
import { getCategoryLabel, getPersonalExpenseCategoryLabel } from "@/lib/format";
import { useTaxYear } from "@/components/tax-year-provider";

// Home office subcategories are now regular categories, no longer needed as a constant

export default function ExpensesSettingsPage() {
  const { toast } = useToast();
  
  // Note: Category selection has been removed - all predefined categories are always available
  // Only custom categories need to be managed

  // Selected categories state (for checkboxes)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedPersonalCategories, setSelectedPersonalCategories] = useState<Set<string>>(new Set());
  
  // Custom categories state
  const [customCategories, setCustomCategories] = useState<Set<string>>(new Set());
  const [customPersonalCategories, setCustomPersonalCategories] = useState<Set<string>>(new Set());
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [newCustomPersonalCategory, setNewCustomPersonalCategory] = useState("");
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


  // Extract custom categories (those not in predefined lists)
  const savedCustomCategories = useMemo(() => {
    if (user?.enabledExpenseCategories) {
      const allCategories = user.enabledExpenseCategories as string[];
      return new Set(allCategories.filter(cat => !SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(cat as any)));
    }
    return new Set<string>();
  }, [user]);

  // Extract custom personal categories
  const savedCustomPersonalCategories = useMemo(() => {
    if (user?.enabledPersonalExpenseCategories) {
      const allCategories = user.enabledPersonalExpenseCategories as string[];
      return new Set(allCategories.filter(cat => !PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)));
    }
    return new Set<string>();
  }, [user]);

  // Extract selected categories (predefined categories that are enabled)
  const savedSelectedCategories = useMemo(() => {
    if (user?.enabledExpenseCategories) {
      const allCategories = user.enabledExpenseCategories as string[];
      return new Set(allCategories.filter(cat => SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(cat as any)));
    }
    // Default: all categories selected
    return new Set(Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES));
  }, [user]);

  const savedSelectedPersonalCategories = useMemo(() => {
    if (user?.enabledPersonalExpenseCategories) {
      const allCategories = user.enabledPersonalExpenseCategories as string[];
      return new Set(allCategories.filter(cat => PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)));
    }
    // Default: all categories selected
    return new Set(Array.from(PERSONAL_EXPENSE_CATEGORIES));
  }, [user]);

  // Initialize local state from saved preferences
  useEffect(() => {
    setCustomCategories(savedCustomCategories);
    // Merge general categories into personal categories (since GENERAL_EXPENSE_CATEGORIES is merged into PERSONAL_EXPENSE_CATEGORIES)
    const mergedPersonalCategories = new Set(savedCustomPersonalCategories);
    if (user?.enabledGeneralExpenseCategories) {
      const generalCategories = user.enabledGeneralExpenseCategories as string[];
      generalCategories.forEach(cat => {
        if (!PERSONAL_EXPENSE_CATEGORIES.includes(cat as any)) {
          mergedPersonalCategories.add(cat);
        }
      });
    }
    setCustomPersonalCategories(mergedPersonalCategories);
    
    // Initialize selected categories
    setSelectedCategories(savedSelectedCategories);
    setSelectedPersonalCategories(savedSelectedPersonalCategories);
    
    // Initialize home office percentage from user profile
    if (user?.homeOfficePercentage) {
      setHomeOfficePercentage(parseFloat(user.homeOfficePercentage.toString()).toString());
    } else {
      setHomeOfficePercentage("");
    }
  }, [savedCustomCategories, savedCustomPersonalCategories, savedSelectedCategories, savedSelectedPersonalCategories, user]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    // Check selected self-employment categories
    if (selectedCategories.size !== savedSelectedCategories.size) {
      return true;
    }
    for (const category of Array.from(selectedCategories)) {
      if (!savedSelectedCategories.has(category)) {
        return true;
      }
    }
    for (const category of Array.from(savedSelectedCategories)) {
      if (!selectedCategories.has(category)) {
        return true;
      }
    }
    // Check selected personal categories
    if (selectedPersonalCategories.size !== savedSelectedPersonalCategories.size) {
      return true;
    }
    for (const category of Array.from(selectedPersonalCategories)) {
      if (!savedSelectedPersonalCategories.has(category)) {
        return true;
      }
    }
    for (const category of Array.from(savedSelectedPersonalCategories)) {
      if (!selectedPersonalCategories.has(category)) {
        return true;
      }
    }
    // Check custom business categories
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
    // Check custom personal categories
    if (customPersonalCategories.size !== savedCustomPersonalCategories.size) {
      return true;
    }
    const customPersonalArray = Array.from(customPersonalCategories);
    const savedCustomPersonalArray = Array.from(savedCustomPersonalCategories);
    for (const category of customPersonalArray) {
      if (!savedCustomPersonalCategories.has(category)) {
        return true;
      }
    }
    for (const category of savedCustomPersonalArray) {
      if (!customPersonalCategories.has(category)) {
        return true;
      }
    }
    return false;
  }, [selectedCategories, savedSelectedCategories, selectedPersonalCategories, savedSelectedPersonalCategories, customCategories, savedCustomCategories, customPersonalCategories, savedCustomPersonalCategories]);

  const updateEnabledCategoriesMutation = useMutation({
    mutationFn: async ({ businessCategories, personalCategories }: { businessCategories: string[]; personalCategories: string[] }) => {
      // Save selected predefined categories + custom categories
      const allBusinessCategories = Array.from(selectedCategories).concat(businessCategories);
      const allPersonalCategories = Array.from(selectedPersonalCategories).concat(personalCategories);
      
      const response = await apiRequest("PATCH", "/api/user/profile", {
        enabledExpenseCategories: allBusinessCategories,
        enabledPersonalExpenseCategories: allPersonalCategories,
        // enabledGeneralExpenseCategories is no longer used (merged into enabledPersonalExpenseCategories)
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

  // Category selection functions removed - all predefined categories are always available

  const handleSave = () => {
    // Only save custom categories (predefined categories are always available)
    updateEnabledCategoriesMutation.mutate({ 
      businessCategories: Array.from(customCategories),
      personalCategories: Array.from(customPersonalCategories),
    });
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
    if (customCategories.has(trimmed) || SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(trimmed as any)) {
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
    if (trimmed !== editingCategory && (customCategories.has(trimmed) || SELF_EMPLOYMENT_EXPENSE_CATEGORIES.includes(trimmed as any))) {
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
    
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const handleRemoveCustomCategory = (category: string) => {
    setCustomCategories((prev) => {
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
          <CardTitle>Self-Employment Expense Configuration</CardTitle>
          <CardDescription>
            Configure your self-employment expense settings. All expense categories are available when creating expenses based on the expense type you select. 
            If you use any part of your home as a home office for your self-employment activities, set the percentage below. 
            When you create expenses with the "Home" expense type, the deductible portion will automatically be calculated based on this percentage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Home Office Percentage Configuration */}
          <div className="mb-6 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium">
                Home Office Percentage
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                Enter the percentage of your home used for business purposes:
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
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Home office expenses include:</p>
              <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-0.5">
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Rent
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Utilities
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Internet
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Heat
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Electricity
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Home Insurance
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Home Maintenance
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Mortgage Interest
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                  Property Taxes
                </li>
              </ul>
            </div>
          </div>
          
          {/* Self-Employment Expense Categories */}
          <div className="mt-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Self-Employment Expense Categories</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategories(new Set(Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES)));
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedCategories(new Set());
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const sorted = Array.from(SELF_EMPLOYMENT_EXPENSE_CATEGORIES)
                  .sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)));
                const numCols = 3;
                const numRows = Math.ceil(sorted.length / numCols);
                const reordered: string[] = [];
                // Reorder so that reading down columns is alphabetical
                for (let col = 0; col < numCols; col++) {
                  for (let row = 0; row < numRows; row++) {
                    const index = col * numRows + row;
                    if (index < sorted.length) {
                      reordered.push(sorted[index]);
                    }
                  }
                }
                return reordered;
              })().map((category) => {
                const count = categoryCounts.get(category) || 0;
                return (
                  <div key={category} className="flex items-center gap-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={selectedCategories.has(category)}
                      onCheckedChange={(checked) => {
                        setSelectedCategories((prev) => {
                          const updated = new Set(prev);
                          if (checked) {
                            updated.add(category);
                          } else {
                            updated.delete(category);
                          }
                          return updated;
                        });
                      }}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {getCategoryLabel(category)}
                    </label>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Personal Expense Configuration</CardTitle>
          <CardDescription>
            Configure your personal expense settings. All personal expense categories (both tax-deductible and non-deductible) are available when creating personal expenses. 
            Personal expenses include items like medical expenses, charitable donations, rent, groceries, utilities, and other everyday costs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tax-Deductible Personal Expense Categories */}
          <div className="mb-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Tax-Deductible Personal Expenses</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allTaxDeductible = Array.from(TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES);
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      allTaxDeductible.forEach(cat => updated.add(cat));
                      return updated;
                    });
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allTaxDeductible = Array.from(TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES);
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      allTaxDeductible.forEach(cat => updated.delete(cat));
                      return updated;
                    });
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const sorted = Array.from(TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES)
                  .sort((a, b) => getPersonalExpenseCategoryLabel(a).localeCompare(getPersonalExpenseCategoryLabel(b)));
                const numCols = 3;
                const numRows = Math.ceil(sorted.length / numCols);
                const reordered: string[] = [];
                // Reorder so that reading down columns is alphabetical
                for (let col = 0; col < numCols; col++) {
                  for (let row = 0; row < numRows; row++) {
                    const index = col * numRows + row;
                    if (index < sorted.length) {
                      reordered.push(sorted[index]);
                    }
                  }
                }
                return reordered;
              })().map((category) => {
                const count = categoryCounts.get(category) || 0;
                return (
                  <div key={category} className="flex items-center gap-2">
                    <Checkbox
                      id={`personal-category-${category}`}
                      checked={selectedPersonalCategories.has(category)}
                      onCheckedChange={(checked) => {
                        setSelectedPersonalCategories((prev) => {
                          const updated = new Set(prev);
                          if (checked) {
                            updated.add(category);
                          } else {
                            updated.delete(category);
                          }
                          return updated;
                        });
                      }}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`personal-category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {getPersonalExpenseCategoryLabel(category)}
                    </label>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-Deductible Personal Expense Categories */}
          <div className="mb-6 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Non-Deductible Personal Expenses</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allNonDeductible = Array.from(NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES);
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      allNonDeductible.forEach(cat => updated.add(cat));
                      return updated;
                    });
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allNonDeductible = Array.from(NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES);
                    setSelectedPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      allNonDeductible.forEach(cat => updated.delete(cat));
                      return updated;
                    });
                  }}
                  disabled={updateEnabledCategoriesMutation.isPending}
                >
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const sorted = Array.from(NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES)
                  .sort((a, b) => getPersonalExpenseCategoryLabel(a).localeCompare(getPersonalExpenseCategoryLabel(b)));
                const numCols = 3;
                const numRows = Math.ceil(sorted.length / numCols);
                const reordered: string[] = [];
                // Reorder so that reading down columns is alphabetical
                for (let col = 0; col < numCols; col++) {
                  for (let row = 0; row < numRows; row++) {
                    const index = col * numRows + row;
                    if (index < sorted.length) {
                      reordered.push(sorted[index]);
                    }
                  }
                }
                return reordered;
              })().map((category) => {
                const count = categoryCounts.get(category) || 0;
                return (
                  <div key={category} className="flex items-center gap-2">
                    <Checkbox
                      id={`personal-category-${category}`}
                      checked={selectedPersonalCategories.has(category)}
                      onCheckedChange={(checked) => {
                        setSelectedPersonalCategories((prev) => {
                          const updated = new Set(prev);
                          if (checked) {
                            updated.add(category);
                          } else {
                            updated.delete(category);
                          }
                          return updated;
                        });
                      }}
                      disabled={updateEnabledCategoriesMutation.isPending}
                    />
                    <label
                      htmlFor={`personal-category-${category}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {getPersonalExpenseCategoryLabel(category)}
                    </label>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Custom Personal Categories Widget */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium">Custom Personal Categories</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Enter custom personal category name"
                value={newCustomPersonalCategory}
                onChange={(e) => setNewCustomPersonalCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = newCustomPersonalCategory.trim();
                    if (!trimmed) {
                      toast({
                        title: "Error",
                        description: "Please enter a category name",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (customPersonalCategories.has(trimmed) || PERSONAL_EXPENSE_CATEGORIES.includes(trimmed as any)) {
                      toast({
                        title: "Error",
                        description: "This category already exists",
                        variant: "destructive",
                      });
                      return;
                    }
                    setCustomPersonalCategories((prev) => {
                      const updated = new Set(prev);
                      updated.add(trimmed);
                      return updated;
                    });
                    setNewCustomPersonalCategory("");
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  const trimmed = newCustomPersonalCategory.trim();
                  if (!trimmed) {
                    toast({
                      title: "Error",
                      description: "Please enter a category name",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (customPersonalCategories.has(trimmed) || PERSONAL_EXPENSE_CATEGORIES.includes(trimmed as any)) {
                    toast({
                      title: "Error",
                      description: "This category already exists",
                      variant: "destructive",
                    });
                    return;
                  }
                  setCustomPersonalCategories((prev) => {
                    const updated = new Set(prev);
                    updated.add(trimmed);
                    return updated;
                  });
                  setNewCustomPersonalCategory("");
                }}
                size="sm"
                disabled={updateEnabledCategoriesMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {customPersonalCategories.size > 0 && (
              <div className="flex flex-wrap gap-2">
                {Array.from(customPersonalCategories).map((category) => (
                  <Badge
                    key={category}
                    variant="outline"
                    className="flex items-center gap-1.5 pr-1"
                  >
                    {formatCustomCategoryLabel(category)}
                    <button
                      onClick={() => {
                        setCustomPersonalCategories((prev) => {
                          const updated = new Set(prev);
                          updated.delete(category);
                          return updated;
                        });
                      }}
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
