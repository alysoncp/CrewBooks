import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tax Filing Status Types
export const TAX_FILING_STATUS = {
  PERSONAL_ONLY: "personal_only",
  PERSONAL_AND_CORPORATE: "personal_and_corporate",
} as const;

export type TaxFilingStatus = typeof TAX_FILING_STATUS[keyof typeof TAX_FILING_STATUS];

// Expense Categories for Film/TV Industry
export const EXPENSE_CATEGORIES = [
  "equipment",
  "travel",
  "meals",
  "accommodation",
  "union_dues",
  "agent_fees",
  "wardrobe",
  "training",
  "office_supplies",
  "phone_internet",
  "vehicle",
  "professional_services",
  "marketing",
  "insurance",
  "other",
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Income Types for Film/TV Industry
export const INCOME_TYPES = [
  "wages",
  "residuals",
  "per_diem",
  "buyout",
  "royalties",
  "consultation",
  "other",
] as const;

export type IncomeType = typeof INCOME_TYPES[number];

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users Table - Updated for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  taxFilingStatus: text("tax_filing_status").default("personal_only"),
  province: text("province").default("ON"),
  subscriptionTier: text("subscription_tier").default("personal"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  taxFilingStatus: true,
  province: true,
  subscriptionTier: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Income Table
export const income = pgTable("income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  incomeType: text("income_type").notNull(),
  productionName: text("production_name"),
  description: text("description"),
  paystubImageUrl: text("paystub_image_url"),
  gstHstCollected: numeric("gst_hst_collected", { precision: 12, scale: 2 }),
});

export const insertIncomeSchema = createInsertSchema(income).omit({ id: true });
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof income.$inferSelect;

// Expenses Table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  vendor: text("vendor"),
  receiptImageUrl: text("receipt_image_url"),
  isTaxDeductible: boolean("is_tax_deductible").default(true),
  gstHstPaid: numeric("gst_hst_paid", { precision: 12, scale: 2 }),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Receipts Table (for uploaded images)
export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  linkedExpenseId: varchar("linked_expense_id"),
  linkedIncomeId: varchar("linked_income_id"),
  notes: text("notes"),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({ id: true, uploadedAt: true });
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

// Tax Calculation Types (not stored, computed)
export interface TaxCalculation {
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;
  federalTax: number;
  provincialTax: number;
  totalIncomeTax: number;
  cppContribution: number;
  totalOwed: number;
  effectiveTaxRate: number;
}

// GST/HST Summary for incorporated users
export interface GstHstSummary {
  gstHstCollected: number;
  inputTaxCredits: number;
  netGstHstOwing: number;
  transactionsWithGstHst: number;
}

export interface DividendSalaryScenario {
  salaryAmount: number;
  dividendAmount: number;
  personalTax: number;
  corporateTax: number;
  cppContribution: number;
  totalTax: number;
  afterTaxIncome: number;
  isOptimal: boolean;
}

// Canadian Provinces
export const CANADIAN_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

// Pricing Tiers
export const PRICING_TIERS = {
  personal: {
    id: "personal",
    name: "Personal",
    price: 9.99,
    description: "For individuals filing personal taxes only",
    features: [
      "Unlimited income & expense tracking",
      "Receipt photo uploads",
      "Personal tax calculations",
      "CPP contribution tracking",
      "Monthly & yearly reports",
    ],
  },
  corporate: {
    id: "corporate",
    name: "Personal + Corporate",
    price: 24.99,
    description: "For incorporated individuals",
    features: [
      "Everything in Personal",
      "Corporate tax calculations",
      "Dividend vs. Salary optimizer",
      "GST/HST tracking",
      "Advanced tax planning tools",
      "Quarterly estimates",
    ],
  },
} as const;
