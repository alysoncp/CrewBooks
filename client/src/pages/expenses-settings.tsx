import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Settings, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES, type Expense, type User } from "@shared/schema";
import { getCategoryLabel } from "@/lib/format";

export default function ExpensesSettingsPage() {
  const { toast } = useToast();
  
  // Local state to track selected categories (before saving)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

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
    </div>
  );
}
