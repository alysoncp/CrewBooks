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

// User Type (Performer, Crew, or Both)
export const USER_TYPES = {
  PERFORMER: "performer",
  CREW: "crew",
  BOTH: "both",
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

// Union Affiliations
export const UNIONS = {
  ACTRA: { id: "actra", name: "ACTRA", levels: ["apprentice", "full", "background"] },
  UBCP: { id: "ubcp", name: "UBCP", levels: ["apprentice", "full", "background"] },
  IATSE: { id: "iatse", name: "IATSE", levels: ["permittee", "full"] },
} as const;

export interface UnionAffiliation {
  unionId: string;
  level: string;
}

export type UnionId = keyof typeof UNIONS;

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
  "union_production",
  "non_union_production",
  "royalty_residual",
  "cash",
] as const;

export type IncomeType = typeof INCOME_TYPES[number];

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users Table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  taxFilingStatus: text("tax_filing_status").default("personal_only"),
  province: text("province").default("ON"),
  subscriptionTier: text("subscription_tier").default("basic"),
  // New profile fields
  userType: text("user_type"), // performer, crew, or both
  unionAffiliations: jsonb("union_affiliations").$type<UnionAffiliation[]>(),
  hasAgent: boolean("has_agent").default(false),
  agentName: text("agent_name"),
  agentCommission: numeric("agent_commission", { precision: 5, scale: 2 }),
  hasBusinessNumber: boolean("has_business_number").default(false),
  businessNumber: text("business_number"),
  hasGstNumber: boolean("has_gst_number").default(false),
  gstNumber: text("gst_number"),
  // Additional profile questions
  usesPersonalVehicle: boolean("uses_personal_vehicle").default(false),
  usesCorporateVehicle: boolean("uses_corporate_vehicle").default(false),
  hasRegularEmployment: boolean("has_regular_employment").default(false),
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
  userType: true,
  unionAffiliations: true,
  hasAgent: true,
  agentName: true,
  agentCommission: true,
  hasBusinessNumber: true,
  businessNumber: true,
  hasGstNumber: true,
  gstNumber: true,
  usesPersonalVehicle: true,
  usesCorporateVehicle: true,
  hasRegularEmployment: true,
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
  accountingOffice: text("accounting_office"),
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
  subcategory: text("subcategory"), // Add this if missing
  vehicleId: varchar("vehicle_id"), // Add this if missing
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

// Vehicles Table - User-defined vehicles
export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  make: text("make"),
  model: text("model"),
  year: numeric("year", { precision: 4, scale: 0 }),
  licensePlate: text("license_plate"),
  isPrimary: boolean("is_primary").default(false),
  claimsCca: boolean("claims_cca").default(false), // Add this line
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

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
  basic: {
    id: "basic",
    name: "Basic",
    price: 0,
    description: "Free for unincorporated individuals",
    features: [
      "Unlimited income & expense tracking",
      "Receipt photo uploads",
      "GST/HST tracking (with GST number)",
      "Basic reports",
    ],
  },
  personal: {
    id: "personal",
    name: "Personal",
    price: 9.99,
    description: "Full tax tools for individuals",
    features: [
      "Everything in Basic",
      "Personal tax calculator",
      "CPP contribution tracking",
      "Quarterly tax estimates",
      "Tax filing reports",
      "Monthly & yearly summaries",
    ],
  },
  corporate: {
    id: "corporate",
    name: "Corporate",
    price: 24.99,
    description: "For incorporated individuals",
    features: [
      "Everything in Personal",
      "Corporate tax calculations",
      "Dividend vs. Salary optimizer",
      "Advanced tax planning tools",
      "Corporate year-end reports",
    ],
  },
} as const;

// Tax Questionnaire Types
export const QUESTIONNAIRE_TYPES = {
  T1: "t1",
  T2: "t2",
} as const;

export type QuestionnaireType = typeof QUESTIONNAIRE_TYPES[keyof typeof QUESTIONNAIRE_TYPES];

export const QUESTIONNAIRE_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SUBMITTED: "submitted",
} as const;

export type QuestionnaireStatus = typeof QUESTIONNAIRE_STATUS[keyof typeof QUESTIONNAIRE_STATUS];

// Tax Questionnaires Table
export const taxQuestionnaires = pgTable("tax_questionnaires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  questionnaireType: text("questionnaire_type").notNull(), // t1 or t2
  taxYear: text("tax_year").notNull(),
  status: text("status").default("draft"),
  currentStep: text("current_step").default("personal_info"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuestionnaireSchema = createInsertSchema(taxQuestionnaires).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionnaire = z.infer<typeof insertQuestionnaireSchema>;
export type TaxQuestionnaire = typeof taxQuestionnaires.$inferSelect;

// Tax Questionnaire Responses Table
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionnaireId: varchar("questionnaire_id").notNull(),
  sectionId: text("section_id").notNull(),
  questionId: text("question_id").notNull(),
  value: jsonb("value"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertResponseSchema = createInsertSchema(questionnaireResponses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionnaireResponse = z.infer<typeof insertResponseSchema>;
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;

// T1 Personal Tax Return Sections
export const T1_SECTIONS = [
  { id: "personal_info", name: "Personal Information", description: "Your basic information and filing status" },
  { id: "income_sources", name: "Income Sources", description: "Employment, self-employment, and other income" },
  { id: "deductions", name: "Deductions & Credits", description: "RRSP, vehicle expenses, union dues, and more" },
  { id: "expenses", name: "Self-Employment Expenses", description: "Business expenses for your self-employment income" },
  { id: "summary", name: "Summary & Declaration", description: "Review and submit your return" },
] as const;

// T2 Corporate Tax Return Sections
export const T2_SECTIONS = [
  { id: "company_profile", name: "Company Profile", description: "Corporation details and fiscal year" },
  { id: "shareholders", name: "Shareholders & Officers", description: "Information about shareholders and directors" },
  { id: "income_streams", name: "Corporate Income", description: "Business revenue and income sources" },
  { id: "deductions_reserves", name: "Deductions & Reserves", description: "Corporate expenses and reserves" },
  { id: "schedule_adjustments", name: "Schedule 1 Adjustments", description: "Accounting to tax income adjustments" },
  { id: "gst_payroll", name: "GST/HST & Payroll", description: "Sales tax and employee payroll information" },
  { id: "summary", name: "Filing Summary", description: "Review and submit your corporate return" },
] as const;
