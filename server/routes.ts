import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertIncomeSchema, insertExpenseSchema, insertReceiptSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { seedDatabase } from "./seed";

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

let demoUserId: string = "";

async function getDemoUserId(): Promise<string> {
  if (!demoUserId) {
    const demoUser = await seedDatabase();
    demoUserId = demoUser.id;
  }
  return demoUserId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  });

  app.get("/api/user/profile", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  app.patch("/api/user/profile", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const updated = await storage.updateUser(userId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.patch("/api/user/subscription", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const { tier } = req.body;
      const updated = await storage.updateUser(userId, { subscriptionTier: tier });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const income = await storage.getIncome(userId);
      const expenses = await storage.getExpenses(userId);
      const taxCalculation = await storage.calculateTax(userId);

      const monthlyData = calculateMonthlyData(income, expenses);
      const expensesByCategory = calculateExpensesByCategory(expenses);

      res.json({
        income,
        expenses,
        taxCalculation,
        monthlyData,
        expensesByCategory,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  app.get("/api/income", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const income = await storage.getIncome(userId);
      res.json(income);
    } catch (error) {
      res.status(500).json({ error: "Failed to get income" });
    }
  });

  app.post("/api/income", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const data = insertIncomeSchema.parse({ ...req.body, userId });
      const income = await storage.createIncome(data);
      res.status(201).json(income);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create income" });
    }
  });

  app.delete("/api/income/:id", async (req, res) => {
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

  app.get("/api/expenses", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const expenses = await storage.getExpenses(userId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to get expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const userId = await getDemoUserId();
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

  app.delete("/api/expenses/:id", async (req, res) => {
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

  app.get("/api/receipts", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const receipts = await storage.getReceipts(userId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get receipts" });
    }
  });

  app.post("/api/receipts/upload", upload.array("files", 10), async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const files = req.files as Express.Multer.File[];
      const notes = req.body.notes || "";

      const receipts = await Promise.all(
        files.map((file) =>
          storage.createReceipt({
            userId,
            imageUrl: `/uploads/${file.filename}`,
            notes,
          })
        )
      );

      res.status(201).json(receipts);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload receipts" });
    }
  });

  app.delete("/api/receipts/:id", async (req, res) => {
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

  app.get("/api/tax-calculation", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const user = await storage.getUser(userId);
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

  app.get("/api/optimization", async (req, res) => {
    try {
      const userId = await getDemoUserId();
      const user = await storage.getUser(userId);
      
      const income = await storage.getIncome(userId);
      const corporateIncome = income.reduce((sum, i) => sum + parseFloat(i.amount), 0);

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

  const data = months.map((month, index) => ({
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
