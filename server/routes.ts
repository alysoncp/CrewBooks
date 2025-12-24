import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertIncomeSchema, insertExpenseSchema, insertVehicleSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { setupAuth, isAuthenticated } from "./auth";
import { eq, desc, asc } from "drizzle-orm";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/heic", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);

  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Convert agentCommission from string to number (or null if empty)
      const profileData = { ...req.body };
      if (profileData.agentCommission !== undefined) {
        const commission = profileData.agentCommission;
        if (commission === "" || commission === null) {
          profileData.agentCommission = null;
        } else {
          const numericValue = parseFloat(commission);
          profileData.agentCommission = isNaN(numericValue) ? null : numericValue.toString();
        }
      }
      
      const updated = await storage.updateUser(userId, profileData);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/user/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { tier } = req.body;
      const updated = await storage.updateUser(userId, { subscriptionTier: tier });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  app.get("/api/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const incomeRecords = await storage.getIncome(userId);
      const expenseRecords = await storage.getExpenses(userId);
      const taxCalculation = await storage.calculateTax(userId);

      const monthlyData = calculateMonthlyData(incomeRecords, expenseRecords);
      const expensesByCategory = calculateExpensesByCategory(expenseRecords);

      res.json({
        income: incomeRecords,
        expenses: expenseRecords,
        taxCalculation,
        monthlyData,
        expensesByCategory,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  app.get("/api/income", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const incomeRecords = await storage.getIncome(userId);
      res.json(incomeRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to get income" });
    }
  });

  app.post("/api/income", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertIncomeSchema.parse({ ...req.body, userId });
      const incomeRecord = await storage.createIncome(data);
      res.status(201).json(incomeRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create income" });
    }
  });

  app.delete("/api/income/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteIncome(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Income not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete income" });
    }
  });

  app.get("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const expenseRecords = await storage.getExpenses(userId);
      res.json(expenseRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to get expenses" });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const data = insertExpenseSchema.parse({ ...req.body, userId });
      const expense = await storage.createExpense(data);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.delete("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.get("/api/receipts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const receiptRecords = await storage.getReceipts(userId);
      res.json(receiptRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.post("/api/receipts/upload", isAuthenticated, upload.array("files", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if user has Personal or Corporate subscription
      if (user.subscriptionTier === "basic") {
        return res.status(403).json({ 
          error: "Receipt uploads require Personal or Corporate subscription",
          message: "Upgrade to a paid plan to upload receipts."
        });
      }
      
      const files = req.files as Express.Multer.File[];
      const notes = req.body.notes || "";

      const receiptRecords = await Promise.all(
        files.map((file) =>
          storage.createReceipt({
            userId,
            imageUrl: `/uploads/${file.filename}`,
            notes,
          })
        )
      );

      res.status(201).json(receiptRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload receipts" });
    }
  });

  app.delete("/api/receipts/:id", isAuthenticated, async (req, res) => {
    try {
      const receipt = await storage.getReceiptById(req.params.id);
      if (receipt?.imageUrl) {
        const filePath = path.join(process.cwd(), receipt.imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      const deleted = await storage.deleteReceipt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete receipt" });
    }
  });

  app.get("/api/tax-calculation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      // Tax calculator requires Personal or Corporate tier
      const isBasicTier = user?.subscriptionTier === "basic";
      if (isBasicTier) {
        return res.status(403).json({ 
          error: "Tax calculator requires a paid subscription. Upgrade to Personal or Corporate tier to access this feature.",
          locked: true
        });
      }
      
      const calculation = await storage.calculateTax(userId);
      
      // Get user's net income for bracket breakdown
      const incomeRecords = await storage.getIncome(userId);
      const expenseRecords = await storage.getExpenses(userId);
      const grossIncome = incomeRecords.reduce((sum, i) => sum + parseFloat(i.amount), 0);
      const totalExpenses = expenseRecords.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const netIncome = Math.max(0, grossIncome - totalExpenses);

      const breakdown = {
        federalBrackets: [
          { bracket: "$0 - $57,375", rate: 15, tax: calculation.federalTax * 0.35 },
          { bracket: "$57,375 - $114,750", rate: 20.5, tax: calculation.federalTax * 0.4 },
          { bracket: "$114,750+", rate: 26, tax: calculation.federalTax * 0.25 },
        ],
        provincialBrackets: storage.getProvincialBracketBreakdown(netIncome, user?.province || "ON"),
      };

      res.json({ calculation, user, breakdown });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate tax" });
    }
  });

  app.get("/api/optimization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      // Optimization requires Corporate tier AND corporate tax filing status
      const isCorporateTier = user?.subscriptionTier === "corporate";
      const isIncorporated = user?.taxFilingStatus === "personal_and_corporate";
      
      if (!isCorporateTier) {
        return res.status(403).json({ 
          error: "Dividend vs salary optimization requires a Corporate subscription. Upgrade to Corporate tier to access this feature.",
          locked: true
        });
      }
      
      if (!isIncorporated) {
        return res.status(403).json({ 
          error: "Dividend vs salary optimization requires corporate tax filing status. Update your profile to access this feature.",
          locked: true
        });
      }
      
      const incomeRecords = await storage.getIncome(userId);
      const corporateIncome = incomeRecords.reduce((sum, i) => sum + parseFloat(i.amount), 0);

      const { scenarios, optimalScenario } = await storage.calculateOptimization(
        userId,
        corporateIncome
      );

      res.json({
        user,
        corporateIncome,
        scenarios,
        optimalScenario,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate optimization" });
    }
  });

  app.get("/api/gst-hst", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      // GST/HST tracking is available to anyone with a GST number
      if (!user?.hasGstNumber) {
        return res.status(403).json({ 
          error: "GST/HST tracking requires a GST number. Add your GST number in your profile to access this feature." 
        });
      }

      const summary = await storage.calculateGstHst(userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate GST/HST" });
    }
  });

  app.get("/api/questionnaires", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const questionnaires = await storage.getQuestionnaires(userId);
      res.json(questionnaires);
    } catch (error) {
      console.error("Error fetching questionnaires:", error);
      res.status(500).json({ error: "Failed to fetch questionnaires" });
    }
  });

  app.get("/api/questionnaires/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const questionnaire = await storage.getQuestionnaireById(req.params.id);
      
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      if (questionnaire.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const responses = await storage.getQuestionnaireResponses(questionnaire.id);
      res.json({ questionnaire, responses });
    } catch (error) {
      console.error("Error fetching questionnaire:", error);
      res.status(500).json({ error: "Failed to fetch questionnaire" });
    }
  });

  app.post("/api/questionnaires", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { questionnaireType, taxYear } = req.body;
      
      if (questionnaireType === "t1" && user.subscriptionTier === "basic") {
        return res.status(403).json({ error: "T1 filing requires Personal or Corporate subscription" });
      }
      
      if (questionnaireType === "t2" && user.subscriptionTier !== "corporate") {
        return res.status(403).json({ error: "T2 filing requires Corporate subscription" });
      }
      
      const questionnaire = await storage.createQuestionnaire({
        userId,
        questionnaireType,
        taxYear: taxYear || new Date().getFullYear().toString(),
        status: "draft",
        currentStep: "personal_info",
      });
      
      res.status(201).json(questionnaire);
    } catch (error) {
      console.error("Error creating questionnaire:", error);
      res.status(500).json({ error: "Failed to create questionnaire" });
    }
  });

  app.patch("/api/questionnaires/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const questionnaire = await storage.getQuestionnaireById(req.params.id);
      
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      if (questionnaire.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await storage.updateQuestionnaire(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating questionnaire:", error);
      res.status(500).json({ error: "Failed to update questionnaire" });
    }
  });

  app.delete("/api/questionnaires/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const questionnaire = await storage.getQuestionnaireById(req.params.id);
      
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      if (questionnaire.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteQuestionnaire(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting questionnaire:", error);
      res.status(500).json({ error: "Failed to delete questionnaire" });
    }
  });

  app.post("/api/questionnaires/:id/responses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const questionnaire = await storage.getQuestionnaireById(req.params.id);
      
      if (!questionnaire) {
        return res.status(404).json({ error: "Questionnaire not found" });
      }
      
      if (questionnaire.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { sectionId, questionId, value } = req.body;
      
      const response = await storage.upsertQuestionnaireResponse({
        questionnaireId: req.params.id,
        sectionId,
        questionId,
        value,
      });
      
      res.json(response);
    } catch (error) {
      console.error("Error saving response:", error);
      res.status(500).json({ error: "Failed to save response" });
    }
  });

  // GET /api/vehicles - get user's vehicles
  app.get("/api/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const vehicleRecords = await storage.getVehicles(userId);
      res.json(vehicleRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to get vehicles" });
    }
  });

  // POST /api/vehicles - create vehicle
  app.post("/api/vehicles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      console.log("Received request body:", JSON.stringify(req.body, null, 2));
      
      // Clean up empty strings - be more explicit
      const cleanedData: any = {
        name: req.body.name?.trim() || "",
        userId,
        isPrimary: req.body.isPrimary === true || req.body.isPrimary === "true",
      };
      
      // Handle optional fields - convert empty strings to null
      cleanedData.make = (req.body.make && req.body.make.trim()) ? req.body.make.trim() : null;
      cleanedData.model = (req.body.model && req.body.model.trim()) ? req.body.model.trim() : null;
      cleanedData.licensePlate = (req.body.licensePlate && req.body.licensePlate.trim()) ? req.body.licensePlate.trim() : null;
      
      // Handle year - convert to number or null
      if (req.body.year && req.body.year.toString().trim()) {
        const yearStr = req.body.year.toString().trim();
        const yearNum = parseInt(yearStr, 10);
        cleanedData.year = (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) ? yearNum : null;
      } else {
        cleanedData.year = null;
      }
      
      console.log("Creating vehicle with cleaned data:", JSON.stringify(cleanedData, null, 2));
      
      // Validate with schema
      const data = insertVehicleSchema.parse(cleanedData);
      console.log("Schema validation passed, parsed data:", JSON.stringify(data, null, 2));
      
      // Try to create
      console.log("Attempting to insert into database...");
      const vehicle = await storage.createVehicle(data);
      console.log("Vehicle created successfully:", vehicle.id);
      
      res.status(201).json(vehicle);
    } catch (error: any) {
      console.error("=== ERROR START ===");
      console.error("Error type:", error?.constructor?.name);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      console.error("Full error object:", error);
      if (error?.stack) {
        console.error("Stack trace:", error.stack);
      }
      console.error("=== ERROR END ===");
      
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: error.errors });
      }
      const errorMessage = error?.message || String(error);
      res.status(500).json({ 
        error: "Failed to create vehicle",
        details: errorMessage,
        code: error?.code
      });
    }
  });

  // PATCH /api/vehicles/:id - update vehicle
  app.patch("/api/vehicles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const vehicle = await storage.getVehicleById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Clean up empty strings and convert year to number if provided
      const cleanedData: any = {};
      if (req.body.make !== undefined) cleanedData.make = req.body.make || null;
      if (req.body.model !== undefined) cleanedData.model = req.body.model || null;
      if (req.body.year !== undefined) cleanedData.year = req.body.year ? parseFloat(req.body.year) : null;
      if (req.body.licensePlate !== undefined) cleanedData.licensePlate = req.body.licensePlate || null;
      if (req.body.name !== undefined) cleanedData.name = req.body.name;
      if (req.body.isPrimary !== undefined) cleanedData.isPrimary = req.body.isPrimary;
      
      const updated = await storage.updateVehicle(req.params.id, cleanedData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  // DELETE /api/vehicles/:id - delete vehicle
  app.delete("/api/vehicles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const vehicle = await storage.getVehicleById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteVehicle(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Rename expense category
  app.patch("/api/expenses/categories/rename", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { oldCategory, newCategory } = req.body;

      if (!oldCategory || !newCategory) {
        return res.status(400).json({ error: "oldCategory and newCategory are required" });
      }

      if (oldCategory === newCategory) {
        return res.status(400).json({ error: "New category name must be different" });
      }

      // Check if new category already exists
      const existingExpenses = await storage.getExpenses(userId);
      const hasNewCategory = existingExpenses.some((e) => e.category === newCategory);
      if (hasNewCategory) {
        return res.status(400).json({ error: "Category name already exists" });
      }

      // Update all expenses with the old category
      const updated = await storage.updateExpenseCategory(userId, oldCategory, newCategory);
      
      res.json({ 
        success: true, 
        updatedCount: updated 
      });
    } catch (error) {
      console.error("Error renaming category:", error);
      res.status(500).json({ error: "Failed to rename category" });
    }
  });

  // Delete expense category (only if not in use)
  app.delete("/api/expenses/categories/:category", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const category = decodeURIComponent(req.params.category);

      // Check if category is in use
      const expenses = await storage.getExpenses(userId);
      const categoryExpenses = expenses.filter((e) => e.category === category);
      
      if (categoryExpenses.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete category. It is used by ${categoryExpenses.length} expense(s).` 
        });
      }

      // Category is not in use, so deletion is just a no-op (category will disappear when not used)
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  return httpServer;
}

function calculateMonthlyData(
  income: any[],
  expenses: any[]
): Array<{ month: string; income: number; expenses: number }> {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const data = months.map((month) => ({
    month,
    income: 0,
    expenses: 0,
  }));

  income.forEach((item) => {
    const date = new Date(item.date);
    const monthIndex = date.getMonth();
    data[monthIndex].income += parseFloat(item.amount);
  });

  expenses.forEach((item) => {
    const date = new Date(item.date);
    const monthIndex = date.getMonth();
    data[monthIndex].expenses += parseFloat(item.amount);
  });

  return data;
}

function calculateExpensesByCategory(
  expenses: any[]
): Array<{ category: string; amount: number; color: string }> {
  const categoryLabels: Record<string, string> = {
    equipment: "Equipment",
    travel: "Travel",
    meals: "Meals",
    accommodation: "Accommodation",
    union_dues: "Union Dues",
    agent_fees: "Agent Fees",
    wardrobe: "Wardrobe",
    training: "Training",
    office_supplies: "Office",
    phone_internet: "Phone/Internet",
    vehicle: "Vehicle",
    professional_services: "Professional",
    marketing: "Marketing",
    insurance: "Insurance",
    other: "Other",
  };

  const categoryTotals: Record<string, number> = {};

  expenses.forEach((expense) => {
    const category = expense.category;
    categoryTotals[category] = (categoryTotals[category] || 0) + parseFloat(expense.amount);
  });

  return Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category: categoryLabels[category] || category,
      amount,
      color: "",
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}
