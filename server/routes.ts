import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertIncomeSchema, insertExpenseSchema, insertVehicleSchema, insertVehicleMileageLogSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { setupAuth, isAuthenticated } from "./auth";
import { eq, desc, asc } from "drizzle-orm";
import { processReceiptOCR, type OCRResult } from "./veryfi-ocr";

// Logging function to avoid circular dependency (disabled for production)
function logRoute(message: string, source = "routes") {
  // Logging disabled
}

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

/**
 * Helper function to map vendor/description to expense category
 */
function mapVendorToCategory(vendor?: string, description?: string): string {
  if (!vendor && !description) {
    return "office_expenses"; // Default category
  }

  const searchText = `${vendor || ""} ${description || ""}`.toLowerCase();

  // Fuel and gas stations
  if (searchText.match(/\b(petro|shell|esso|chevron|mobil|gas|fuel|petrol|diesel)\b/)) {
    return "fuel_costs";
  }

  // Vehicle-related
  if (searchText.match(/\b(auto|car|vehicle|tire|mechanic|repair shop|dealer|honda|toyota|ford|gm|nissan)\b/)) {
    return "motor_vehicle_expenses";
  }

  // Office supplies
  if (searchText.match(/\b(staples|office depot|office max|paper|pen|pencil|notebook|folder|binder)\b/)) {
    return "office_supplies";
  }

  // Restaurants and meals
  if (searchText.match(/\b(restaurant|cafe|coffee|starbucks|tim hortons|mcdonald|subway|pizza|food|meal|dining)\b/)) {
    return "meals_entertainment";
  }

  // Hotels and travel
  if (searchText.match(/\b(hotel|motel|airbnb|booking|travel|airline|air canada|westjet|airport|taxi|uber|lyft)\b/)) {
    return "travel_expenses";
  }

  // Professional services
  if (searchText.match(/\b(lawyer|attorney|legal|accountant|accounting|consultant|professional service)\b/)) {
    return "professional_fees";
  }

  // Insurance
  if (searchText.match(/\b(insurance|coverage|policy|premium)\b/)) {
    return "insurance";
  }

  // Training and education
  if (searchText.match(/\b(course|training|education|class|workshop|seminar|university|college|school)\b/)) {
    return "training";
  }

  // Advertising
  if (searchText.match(/\b(advertising|ad|marketing|promotion|social media|facebook|google ads)\b/)) {
    return "advertising";
  }

  // Rent
  if (searchText.match(/\b(rent|lease|landlord|apartment|building)\b/)) {
    return "rent";
  }

  // Utilities
  if (searchText.match(/\b(hydro|electric|water|gas utility|utility bill|power)\b/)) {
    return "utilities";
  }

  // Default to office expenses
  return "office_expenses";
}

/**
 * Convert OCR result to expense data format
 */
function convertOCRToExpenseData(ocrResult: OCRResult): any {
  // Map vendor/description to expense category
  const category = mapVendorToCategory(ocrResult.vendor, ocrResult.lineItems?.[0]?.description);

  // Calculate tax breakdown (assuming Canadian GST/PST)
  let baseCost = 0;
  let gstAmount = 0;
  let pstAmount = 0;
  let total = ocrResult.amount || 0;

  if (ocrResult.tax && ocrResult.tax > 0 && total > 0) {
    // Try to infer tax breakdown
    const taxRate = ocrResult.tax / total;
    
    if (taxRate >= 0.12 && taxRate <= 0.14) {
      // Likely HST (13% in ON)
      baseCost = total / 1.13;
      gstAmount = baseCost * 0.05;
      pstAmount = baseCost * 0.08; // HST = GST + PST equivalent
    } else if (taxRate >= 0.04 && taxRate <= 0.06) {
      // Likely GST only (5%)
      baseCost = total / 1.05;
      gstAmount = baseCost * 0.05;
    } else {
      // Use tax amount as GST, calculate base
      baseCost = total - ocrResult.tax;
      gstAmount = ocrResult.tax;
    }
  } else {
    // No tax detected, assume total is base cost
    baseCost = total;
  }

  return {
    amount: total.toString(),
    baseCost: baseCost.toString(),
    gstAmount: gstAmount.toString(),
    pstAmount: pstAmount.toString(),
    date: ocrResult.date || new Date().toISOString().split("T")[0],
    title: ocrResult.lineItems?.[0]?.description || ocrResult.vendor || "Receipt Expense",
    category: category,
    vendor: ocrResult.vendor || "",
    description: ocrResult.lineItems?.map(item => item.description).join(", ") || "",
    isTaxDeductible: true,
  };
}

/**
 * Convert OCR result to income data format for paystubs
 */
function convertOCRToIncomeData(ocrResult: OCRResult): any {
  // For paystubs, extract amount (net pay or gross pay depending on what Veryfi extracts)
  const amount = ocrResult.amount || 0;
  
  // Extract date from OCR result
  const date = ocrResult.date || new Date().toISOString().split("T")[0];
  
  // Extract vendor name (employer name from paystub)
  const employerName = ocrResult.vendor || "";
  
  // Default to union_production as income type (user can change this)
  // This is a reasonable default for film/TV industry paystubs
  const incomeType = "union_production";
  
  // Use employer name as production name or accounting office
  const productionName = employerName || undefined;
  const accountingOffice = employerName || undefined;
  
  // Combine line items as description if available
  const description = ocrResult.lineItems?.map(item => item.description).join(", ") || undefined;

  return {
    amount: amount.toString(),
    date: date,
    incomeType: incomeType,
    productionName: productionName,
    accountingOffice: accountingOffice,
    description: description,
  };
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
      
      // Convert homeOfficePercentage from string to number (or null if empty)
      if (profileData.homeOfficePercentage !== undefined) {
        const percentage = profileData.homeOfficePercentage;
        if (percentage === "" || percentage === null) {
          profileData.homeOfficePercentage = null;
        } else {
          const numericValue = parseFloat(percentage);
          profileData.homeOfficePercentage = isNaN(numericValue) ? null : numericValue.toString();
        }
      }
      
      // Ensure hasHomeOffice is explicitly set as a boolean
      if (profileData.hasHomeOffice !== undefined) {
        profileData.hasHomeOffice = Boolean(profileData.hasHomeOffice);
      }
      
      const updated = await storage.updateUser(userId, profileData);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
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
      const { linkedReceiptId, ...expenseData } = req.body;
      const data = insertExpenseSchema.parse({ ...expenseData, userId });
      const expense = await storage.createExpense(data);
      
      // If expense was created from a receipt, link them
      if (linkedReceiptId) {
        const receipt = await storage.getReceiptById(linkedReceiptId);
        if (receipt && receipt.userId === userId) {
          await storage.updateReceipt(linkedReceiptId, {
            linkedExpenseId: expense.id,
          });
        }
      }
      
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const expense = await storage.getExpenseById(req.params.id);
      
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      
      if (expense.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await storage.updateExpense(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update expense" });
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
      logRoute("=== RECEIPT UPLOAD REQUEST ===", "receipts");
      logRoute(`Request body keys: ${Object.keys(req.body).join(", ")}`, "receipts");
      logRoute(`Request body scanWithOCR: ${req.body.scanWithOCR}`, "receipts");
      logRoute(`Request body scanWithOCR type: ${typeof req.body.scanWithOCR}`, "receipts");
      logRoute(`Files count: ${req.files?.length || 0}`, "receipts");
      
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
      
      // Debug: Log all body fields
      logRoute(`All body fields: ${JSON.stringify(req.body)}`, "receipts");
      
      // Parse scanWithOCR - it comes as a string "true" or "false" from FormData
      const scanWithOCRRaw = req.body.scanWithOCR;
      const scanWithOCR = scanWithOCRRaw === "true" || scanWithOCRRaw === true || scanWithOCRRaw === "1";
      
      logRoute(`Parsed scanWithOCR: ${scanWithOCR} (raw: ${scanWithOCRRaw}, type: ${typeof scanWithOCRRaw})`, "receipts");

      // Process receipts with optional OCR
      const receiptRecords = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(process.cwd(), "uploads", file.filename);
          
          // Create receipt record
          const receipt = await storage.createReceipt({
            userId,
            imageUrl: `/uploads/${file.filename}`,
            notes,
            ocrStatus: scanWithOCR ? "processing" : null,
          });

          // If OCR is requested, process it synchronously
          if (scanWithOCR) {
            logRoute(`=== PROCESSING OCR FOR RECEIPT ${receipt.id} ===`, "ocr");
            logRoute(`File path: ${filePath}`, "ocr");
            logRoute(`File exists: ${fs.existsSync(filePath)}`, "ocr");
            try {
              // Process OCR - specify "expense" category for receipts
              const ocrResult = await processReceiptOCR(filePath, "expense");
              // Log summary only (detailed logs are in veryfi-ocr.ts)
              if (ocrResult.status === "completed") {
                logRoute(`OCR completed for receipt ${receipt.id}: $${ocrResult.amount} at ${ocrResult.vendor}`, "ocr");
              } else {
                logRoute(`OCR ${ocrResult.status} for receipt ${receipt.id}`, "ocr");
              }
              
              // Store OCR results
              await storage.updateReceipt(receipt.id, {
                ocrJobId: ocrResult.documentId,
                ocrStatus: ocrResult.status,
                ocrResult: ocrResult.rawResponse || ocrResult,
                ocrProcessedAt: ocrResult.status === "completed" ? new Date() : null,
              });

              // If OCR completed successfully, return expense data for review
              if (ocrResult.status === "completed") {
                const expenseData = convertOCRToExpenseData(ocrResult);
                return {
                  ...receipt,
                  ocrStatus: ocrResult.status,
                  expenseData: expenseData,
                  confidence: ocrResult.confidence,
                };
              } else {
                // OCR failed
                return {
                  ...receipt,
                  ocrStatus: ocrResult.status,
                  ocrError: ocrResult.rawResponse?.error || "OCR processing failed",
                };
              }
            } catch (error: any) {
              logRoute(`Failed to process OCR for receipt ${receipt.id}: ${error.message}`, "ocr");
              logRoute(`Error stack: ${error.stack}`, "ocr");
              await storage.updateReceipt(receipt.id, {
                ocrStatus: "failed",
                ocrResult: { error: error.message || "Unknown error" },
              });
              
              return {
                ...receipt,
                ocrStatus: "failed",
                ocrError: error.message || "Unknown error",
              };
            }
          } else {
            logRoute(`OCR not requested for receipt ${receipt.id}`, "receipts");
          }

          return receipt;
        })
      );

      res.status(201).json(receiptRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload receipts" });
    }
  });

  app.get("/api/receipts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      if (receipt.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ error: "Failed to get receipt" });
    }
  });

  app.get("/api/receipts/:id/ocr-to-expense", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      if (receipt.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!receipt.ocrResult) {
        return res.status(400).json({ error: "OCR has not been processed for this receipt" });
      }

      if (receipt.ocrStatus !== "completed") {
        return res.status(400).json({ 
          error: "OCR is still processing",
          status: receipt.ocrStatus,
        });
      }

      const ocrData = receipt.ocrResult as any;
      const ocrResult: OCRResult = {
        amount: ocrData.total || ocrData.amount,
        date: ocrData.date,
        vendor: ocrData.vendor?.name || ocrData.merchant_name || ocrData.vendor,
        tax: ocrData.tax || ocrData.total_tax,
        lineItems: ocrData.line_items,
        confidence: ocrData.confidence_score || ocrData.confidence || 0,
        status: "completed",
        documentId: receipt.ocrJobId || undefined,
        rawResponse: ocrData,
      };

      // Convert OCR to expense data using helper function
      const expenseData = convertOCRToExpenseData(ocrResult);

      res.json({
        expenseData,
        confidence: ocrResult.confidence,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to convert OCR to expense data" });
    }
  });

  app.patch("/api/receipts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      
      if (receipt.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Only allow updating linkedExpenseId
      if (req.body.linkedExpenseId !== undefined) {
        // Validate that the expense exists and belongs to the user (if not null)
        if (req.body.linkedExpenseId !== null) {
          const userExpenses = await storage.getExpenses(userId);
          const expenseExists = userExpenses.some(e => e.id === req.body.linkedExpenseId);
          if (!expenseExists) {
            return res.status(400).json({ error: "Expense not found or access denied" });
          }
        }
        
        // Update only the linkedExpenseId field
        const updated = await storage.updateReceipt(req.params.id, { 
          linkedExpenseId: req.body.linkedExpenseId 
        });
        if (!updated) {
          return res.status(404).json({ error: "Receipt not found" });
        }
        
        return res.json(updated);
      }
      
      // If no valid fields to update, return error
      return res.status(400).json({ error: "No valid fields to update" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update receipt" });
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

  app.get("/api/paystubs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const paystubRecords = await storage.getPaystubs(userId);
      res.json(paystubRecords);
    } catch (error: any) {
      console.error("Error getting paystubs:", error);
      res.status(500).json({ error: "Failed to get paystubs", details: error?.message });
    }
  });

  app.post("/api/paystubs/upload", isAuthenticated, upload.array("files", 10), async (req: any, res) => {
    try {
      logRoute("=== PAYSTUB UPLOAD REQUEST ===", "paystubs");
      logRoute(`Request body keys: ${Object.keys(req.body).join(", ")}`, "paystubs");
      logRoute(`Request body scanWithOCR: ${req.body.scanWithOCR}`, "paystubs");
      logRoute(`Files count: ${req.files?.length || 0}`, "paystubs");
      
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const files = req.files as Express.Multer.File[];
      const notes = req.body.notes || "";
      
      // Parse scanWithOCR - it comes as a string "true" or "false" from FormData
      const scanWithOCRRaw = req.body.scanWithOCR;
      const scanWithOCR = scanWithOCRRaw === "true" || scanWithOCRRaw === true || scanWithOCRRaw === "1";
      
      logRoute(`Parsed scanWithOCR: ${scanWithOCR} (raw: ${scanWithOCRRaw}, type: ${typeof scanWithOCRRaw})`, "paystubs");

      // Process paystubs with optional OCR
      const paystubRecords = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(process.cwd(), "uploads", file.filename);
          
          // Create paystub record
          const paystub = await storage.createPaystub({
            userId,
            imageUrl: `/uploads/${file.filename}`,
            notes,
            ocrStatus: scanWithOCR ? "processing" : null,
          });

          // If OCR is requested, process it synchronously
          if (scanWithOCR) {
            logRoute(`=== PROCESSING OCR FOR PAYSTUB ${paystub.id} ===`, "ocr");
            logRoute(`File path: ${filePath}`, "ocr");
            logRoute(`File exists: ${fs.existsSync(filePath)}`, "ocr");
            try {
              // Process OCR - don't specify category to let Veryfi auto-detect paystubs
              const ocrResult = await processReceiptOCR(filePath);
              
              if (ocrResult.status === "completed") {
                logRoute(`OCR completed for paystub ${paystub.id}`, "ocr");
              } else {
                logRoute(`OCR ${ocrResult.status} for paystub ${paystub.id}`, "ocr");
              }
              
              // Store OCR results
              await storage.updatePaystub(paystub.id, {
                ocrJobId: ocrResult.documentId,
                ocrStatus: ocrResult.status,
                ocrResult: ocrResult.rawResponse || ocrResult,
                ocrProcessedAt: ocrResult.status === "completed" ? new Date() : null,
              });

              // If OCR completed successfully, return income data for review
              if (ocrResult.status === "completed") {
                const incomeData = convertOCRToIncomeData(ocrResult);
                return {
                  ...paystub,
                  ocrStatus: ocrResult.status,
                  incomeData: incomeData,
                  confidence: ocrResult.confidence,
                };
              } else {
                // OCR failed
                return {
                  ...paystub,
                  ocrStatus: ocrResult.status,
                  ocrError: ocrResult.rawResponse?.error || "OCR processing failed",
                };
              }
            } catch (error: any) {
              logRoute(`Failed to process OCR for paystub ${paystub.id}: ${error.message}`, "ocr");
              await storage.updatePaystub(paystub.id, {
                ocrStatus: "failed",
                ocrResult: { error: error.message || "Unknown error" },
              });
              
              return {
                ...paystub,
                ocrStatus: "failed",
                ocrError: error.message || "Unknown error",
              };
            }
          } else {
            logRoute(`OCR not requested for paystub ${paystub.id}`, "paystubs");
          }

          return paystub;
        })
      );

      res.status(201).json(paystubRecords);
    } catch (error: any) {
      console.error("Error uploading paystubs:", error);
      res.status(500).json({ error: "Failed to upload paystubs", details: error?.message });
    }
  });

  app.get("/api/paystubs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const paystub = await storage.getPaystubById(req.params.id);
      
      if (!paystub) {
        return res.status(404).json({ error: "Paystub not found" });
      }
      
      if (paystub.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(paystub);
    } catch (error) {
      res.status(500).json({ error: "Failed to get paystub" });
    }
  });

  app.get("/api/paystubs/:id/ocr-to-income", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const paystub = await storage.getPaystubById(req.params.id);
      
      if (!paystub) {
        return res.status(404).json({ error: "Paystub not found" });
      }
      
      if (paystub.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!paystub.ocrResult) {
        return res.status(400).json({ error: "OCR has not been processed for this paystub" });
      }

      if (paystub.ocrStatus !== "completed") {
        return res.status(400).json({ 
          error: "OCR is still processing",
          status: paystub.ocrStatus,
        });
      }

      const ocrData = paystub.ocrResult as any;
      const ocrResult: OCRResult = {
        amount: ocrData.total || ocrData.amount,
        date: ocrData.date,
        vendor: ocrData.vendor?.name || ocrData.merchant_name || ocrData.vendor,
        tax: ocrData.tax || ocrData.total_tax,
        lineItems: ocrData.line_items,
        confidence: ocrData.confidence_score || ocrData.confidence || 0,
        status: "completed",
        documentId: paystub.ocrJobId || undefined,
        rawResponse: ocrData,
      };

      // Convert OCR to income data using helper function
      const incomeData = convertOCRToIncomeData(ocrResult);

      res.json({
        incomeData,
        confidence: ocrResult.confidence,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to convert OCR to income data" });
    }
  });

  app.patch("/api/paystubs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const paystub = await storage.getPaystubById(req.params.id);
      
      if (!paystub) {
        return res.status(404).json({ error: "Paystub not found" });
      }
      
      if (paystub.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Only allow updating linkedIncomeId
      if (req.body.linkedIncomeId !== undefined) {
        // Validate that the income exists and belongs to the user (if not null)
        if (req.body.linkedIncomeId !== null) {
          const userIncome = await storage.getIncome(userId);
          const incomeExists = userIncome.some(i => i.id === req.body.linkedIncomeId);
          if (!incomeExists) {
            return res.status(400).json({ error: "Income not found or access denied" });
          }
        }
        
        // Update only the linkedIncomeId field
        const updated = await storage.updatePaystub(req.params.id, { 
          linkedIncomeId: req.body.linkedIncomeId 
        });
        if (!updated) {
          return res.status(404).json({ error: "Paystub not found" });
        }
        
        return res.json(updated);
      }
      
      // If no valid fields to update, return error
      return res.status(400).json({ error: "No valid fields to update" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update paystub" });
    }
  });

  app.delete("/api/paystubs/:id", isAuthenticated, async (req, res) => {
    try {
      const paystub = await storage.getPaystubById(req.params.id);
      if (paystub?.imageUrl) {
        const filePath = path.join(process.cwd(), paystub.imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      const deleted = await storage.deletePaystub(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Paystub not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete paystub" });
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
        provincialBrackets: storage.getProvincialBracketBreakdown(netIncome, user?.province || "BC"),
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

      // Handle new fields
      cleanedData.usedExclusivelyForBusiness = req.body.usedExclusivelyForBusiness === true || req.body.usedExclusivelyForBusiness === "true";
      cleanedData.claimsCca = req.body.claimsCca === true || req.body.claimsCca === "true";
      cleanedData.ccaClass = (req.body.ccaClass && req.body.ccaClass.trim()) ? req.body.ccaClass.trim() : null;
      cleanedData.purchasedThisYear = req.body.purchasedThisYear === true || req.body.purchasedThisYear === "true";
      // Convert numbers to strings for schema validation (Drizzle numeric columns expect strings)
      cleanedData.purchasePrice = req.body.purchasePrice !== null && req.body.purchasePrice !== undefined ? String(req.body.purchasePrice) : null;
      cleanedData.currentMileage = req.body.currentMileage !== null && req.body.currentMileage !== undefined ? String(req.body.currentMileage) : null;
      cleanedData.mileageAtBeginningOfYear = req.body.mileageAtBeginningOfYear !== null && req.body.mileageAtBeginningOfYear !== undefined ? String(req.body.mileageAtBeginningOfYear) : null;
      
      // Validate with schema
      const data = insertVehicleSchema.parse(cleanedData);
      
      // Try to create
      const vehicle = await storage.createVehicle(data);
      
      res.status(201).json(vehicle);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
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
      if (req.body.usedExclusivelyForBusiness !== undefined) cleanedData.usedExclusivelyForBusiness = req.body.usedExclusivelyForBusiness;
      if (req.body.claimsCca !== undefined) cleanedData.claimsCca = req.body.claimsCca;
      if (req.body.ccaClass !== undefined) cleanedData.ccaClass = req.body.ccaClass || null;
      if (req.body.purchasedThisYear !== undefined) cleanedData.purchasedThisYear = req.body.purchasedThisYear;
      // Convert numbers to strings for schema validation (Drizzle numeric columns expect strings)
      if (req.body.purchasePrice !== undefined) cleanedData.purchasePrice = req.body.purchasePrice !== null && req.body.purchasePrice !== undefined ? String(req.body.purchasePrice) : null;
      if (req.body.currentMileage !== undefined) cleanedData.currentMileage = req.body.currentMileage !== null && req.body.currentMileage !== undefined ? String(req.body.currentMileage) : null;
      if (req.body.mileageAtBeginningOfYear !== undefined) cleanedData.mileageAtBeginningOfYear = req.body.mileageAtBeginningOfYear !== null && req.body.mileageAtBeginningOfYear !== undefined ? String(req.body.mileageAtBeginningOfYear) : null;
      
      const updated = await storage.updateVehicle(req.params.id, cleanedData);
      res.json(updated);
    } catch (error) {
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
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // GET /api/vehicles/:vehicleId/mileage-logs - get mileage logs for a vehicle
  app.get("/api/vehicles/:vehicleId/mileage-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const vehicle = await storage.getVehicleById(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const logs = await storage.getVehicleMileageLogs(req.params.vehicleId, userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get mileage logs" });
    }
  });

  // POST /api/vehicles/:vehicleId/mileage-logs - create mileage log
  app.post("/api/vehicles/:vehicleId/mileage-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const vehicle = await storage.getVehicleById(req.params.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      if (vehicle.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = insertVehicleMileageLogSchema.parse({ ...req.body, vehicleId: req.params.vehicleId, userId });
      const log = await storage.createVehicleMileageLog(data);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create mileage log" });
    }
  });

  // PATCH /api/mileage-logs/:id - update mileage log
  app.patch("/api/mileage-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const log = await storage.getVehicleMileageLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Mileage log not found" });
      }
      if (log.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const cleanedData: any = {};
      if (req.body.date !== undefined) cleanedData.date = req.body.date;
      if (req.body.odometerReading !== undefined) cleanedData.odometerReading = req.body.odometerReading !== null && req.body.odometerReading !== undefined ? String(req.body.odometerReading) : null;
      if (req.body.description !== undefined) cleanedData.description = req.body.description || null;
      if (req.body.isBusinessUse !== undefined) cleanedData.isBusinessUse = req.body.isBusinessUse;
      const updated = await storage.updateVehicleMileageLog(req.params.id, cleanedData);
      if (!updated) {
        return res.status(404).json({ error: "Mileage log not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update mileage log" });
    }
  });

  // DELETE /api/mileage-logs/:id - delete mileage log
  app.delete("/api/mileage-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const log = await storage.getVehicleMileageLogById(req.params.id);
      if (!log) {
        return res.status(404).json({ error: "Mileage log not found" });
      }
      if (log.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteVehicleMileageLog(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mileage log" });
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
