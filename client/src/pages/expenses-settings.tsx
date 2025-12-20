import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Settings, ArrowLeft, Edit, Trash2, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { EXPENSE_CATEGORIES, type Expense } from "@shared/schema";
import { getCategoryLabel } from "@/lib/format";

export default function ExpensesSettingsPage() {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: expenseList } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Extract categories and their usage counts
  const categoriesData = useMemo(() => {
    const predefinedSet = new Set<string>(EXPENSE_CATEGORIES);
    const categoryCounts = new Map<string, number>();
    const customCategories = new Set<string>();

    if (expenseList) {
      expenseList.forEach((expense) => {
        if (expense.category) {
          categoryCounts.set(
            expense.category,
            (categoryCounts.get(expense.category) || 0) + 1
          );
          if (!predefinedSet.has(expense.category)) {
            customCategories.add(expense.category);
          }
        }
      });
    }

    return {
      predefined: Array.from(EXPENSE_CATEGORIES).map((cat) => ({
        key: cat,
        label: getCategoryLabel(cat),
        count: categoryCounts.get(cat) || 0,
        isCustom: false,
      })),
      custom: Array.from(customCategories)
        .sort()
        .map((cat) => ({
          key: cat,
          label: getCategoryLabel(cat),
          count: categoryCounts.get(cat) || 0,
          isCustom: true,
        })),
    };
  }, [expenseList]);

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldCategory, newCategory }: { oldCategory: string; newCategory: string }) => {
      const response = await apiRequest("PATCH", "/api/expenses/categories/rename", {
        oldCategory,
        newCategory,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rename category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setEditingCategory(null);
      setEditValue("");
      toast({
        title: "Category renamed",
        description: "All expenses using this category have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rename category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (category: string) => {
      const response = await apiRequest("DELETE", `/api/expenses/categories/${encodeURIComponent(category)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete category");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Category deleted",
        description: "The category has been removed from all expenses.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = (category: { key: string; label: string }) => {
    setEditingCategory(category.key);
    setEditValue(category.label);
  };

  const handleSaveEdit = (oldCategoryKey: string) => {
    if (!editValue.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const newCategoryKey = editValue.trim().toLowerCase().replace(/\s+/g, "_");
    
    if (newCategoryKey === oldCategoryKey) {
      setEditingCategory(null);
      setEditValue("");
      return;
    }

    renameCategoryMutation.mutate({
      oldCategory: oldCategoryKey,
      newCategory: newCategoryKey,
    });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditValue("");
  };

  const handleDelete = (category: string, count: number) => {
    if (count > 0) {
      toast({
        title: "Cannot delete",
        description: `This category is used by ${count} expense${count > 1 ? "s" : ""}. Please remove or reassign these expenses first.`,
        variant: "destructive",
      });
      return;
    }

    deleteCategoryMutation.mutate(category);
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
          <CardTitle>Predefined Categories</CardTitle>
          <CardDescription>
            These are standard categories that cannot be modified or deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categoriesData.predefined.map((category) => (
              <div
                key={category.key}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{category.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {category.count} expense{category.count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custom Categories</CardTitle>
          <CardDescription>
            Manage your custom expense categories. You can rename or delete categories that are not in use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoriesData.custom.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom categories yet.</p>
              <p className="text-sm mt-2">
                Add custom categories when creating expenses.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoriesData.custom.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  {editingCategory === category.key ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveEdit(category.key);
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSaveEdit(category.key)}
                        disabled={renameCategoryMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{category.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {category.count} expense{category.count !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStartEdit(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={category.count > 0}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete category?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {category.count > 0
                                  ? `This category is used by ${category.count} expense${category.count > 1 ? "s" : ""}. You cannot delete categories that are in use.`
                                  : "This will permanently delete this category. This action cannot be undone."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              {category.count === 0 && (
                                <AlertDialogAction
                                  onClick={() => handleDelete(category.key, category.count)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
