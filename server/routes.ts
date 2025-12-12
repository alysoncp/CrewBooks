import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertIncomeSchema, insertExpenseSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { setupAuth, isAuthenticated } from "./replitAuth";

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

      const breakdown = {
        federalBrackets: [
          { bracket: "$0 - $55,867", rate: 15, tax: calculation.federalTax * 0.35 },
          { bracket: "$55,867 - $111,733", rate: 20.5, tax: calculation.federalTax * 0.4 },
          { bracket: "$111,733+", rate: 26, tax: calculation.federalTax * 0.25 },
        ],
        provincialBrackets: [
          { bracket: "$0 - $51,446", rate: 5.05, tax: calculation.provincialTax * 0.4 },
          { bracket: "$51,446 - $102,894", rate: 9.15, tax: calculation.provincialTax * 0.4 },
          { bracket: "$102,894+", rate: 11.16, tax: calculation.provincialTax * 0.2 },
        ],
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
