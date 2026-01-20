import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, boolean, timestamp, index, jsonb, integer } from "drizzle-orm/pg-core";
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
  UBCP: { id: "ubcp", name: "UBCP", levels: ["apprentice", "full", "background"] },
  IATSE: { id: "iatse", name: "IATSE", levels: ["permittee", "full"] },
} as const;

export interface UnionAffiliation {
  unionId: string;
  level: string;
}

export type UnionId = keyof typeof UNIONS;

// Self-Employment Expense Categories for Film/TV Industry
export const SELF_EMPLOYMENT_EXPENSE_CATEGORIES = [
  "advertising",
  "business_taxes",
  "commissions_agent_fees",
  "delivery_freight",
  "fuel_non_vehicle",
  "insurance",
  "licenses_memberships",
  "management_admin_fees",
  "meals_entertainment",
  "office_supplies",
  "professional_fees",
  "repairs_maintenance",
  "salaries_wages",
  "training",
  "travel_expenses",
] as const;

// Home Office / Living Expense Categories
export const HOME_OFFICE_LIVING_CATEGORIES = [
  "rent",
  "utilities",
  "internet",
  "phone",
  "heat",
  "electricity",
  "insurance_home",
  "maintenance_home",
  "mortgage_interest",
  "property_taxes",
] as const;

// Vehicle Expense Categories
export const VEHICLE_CATEGORIES = [
  "fuel_costs",
  "electric_vehicle_charging",
  "vehicle_insurance",
  "parking_tolls",
  "lease_payment",
  "vehicle_repairs",
] as const;

export type SelfEmploymentExpenseCategory = typeof SELF_EMPLOYMENT_EXPENSE_CATEGORIES[number];
export type HomeOfficeLivingCategory = typeof HOME_OFFICE_LIVING_CATEGORIES[number];
export type VehicleCategory = typeof VEHICLE_CATEGORIES[number];

// Expense Types
export const EXPENSE_TYPES = {
  HOME_OFFICE_LIVING: "home_office_living",
  VEHICLE: "vehicle",
  SELF_EMPLOYMENT: "self_employment",
  PERSONAL: "personal",
  MIXED: "mixed",
} as const;

export type ExpenseType = typeof EXPENSE_TYPES[keyof typeof EXPENSE_TYPES];

// Tax-deductible Personal Expense Categories
export const TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES = [
  "child_care_expenses",
  "medical_expenses",
  "charitable_donations",
  "moving_expenses",
  "student_loan_interest",
  "disability_supports",
  "investment_counsel_fees",
  "tuition",
] as const;

// Non-deductible Personal Expense Categories
export const NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES = [
  "personal_phone",
  "grocery",
  "entertainment",
  "dining_out",
  "clothing",
  "transportation",
  "insurance_personal",
  "health_fitness",
  "gifts",
  "household_supplies",
] as const;

// All Personal Expense Categories (combined)
export const PERSONAL_EXPENSE_CATEGORIES = [
  ...TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
  ...NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES,
] as const;

export type TaxDeductiblePersonalExpenseCategory = typeof TAX_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES[number];
export type NonDeductiblePersonalExpenseCategory = typeof NON_DEDUCTIBLE_PERSONAL_EXPENSE_CATEGORIES[number];
export type PersonalExpenseCategory = typeof PERSONAL_EXPENSE_CATEGORIES[number];

// Income Types for Film/TV Industry
export const INCOME_TYPES = [
  "union_production",
  "non_union_production",
  "royalty_residual",
  "cash",
] as const;

export type IncomeType = typeof INCOME_TYPES[number];

// Users Table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  taxFilingStatus: text("tax_filing_status").default("personal_only"),
  province: text("province").default("BC"),
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
  hasHomeOffice: boolean("has_home_office").default(false),
  homeOfficePercentage: numeric("home_office_percentage", { precision: 5, scale: 2 }),
  enabledExpenseCategories: jsonb("enabled_expense_categories").$type<string[]>(),
  enabledPersonalExpenseCategories: jsonb("enabled_personal_expense_categories").$type<string[]>(),
  enabledGeneralExpenseCategories: jsonb("enabled_general_expense_categories").$type<string[]>(),
  mileageLoggingStyle: text("mileage_logging_style").default("trip_distance"), // "odometer" | "trip_distance"
  // OCR rate limiting (security: prevent abuse and cost overruns)
  ocrRequestsThisMonth: integer("ocr_requests_this_month").default(0),
  lastOcrReset: timestamp("last_ocr_reset").defaultNow(),
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
  hasHomeOffice: true,
  homeOfficePercentage: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// Income Categories
export const INCOME_CATEGORIES = {
  FILM_TV: "film_tv",
  REGULAR_EMPLOYMENT: "regular_employment",
  OTHER_SELF_EMPLOYMENT: "other_self_employment",
  OTHER: "other",
} as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[keyof typeof INCOME_CATEGORIES];

// Income Table
export const income = pgTable("income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // Net pay
  date: date("date").notNull(),
  incomeType: text("income_type").notNull(),
  incomeCategory: text("income_category").default("film_tv"), // film_tv, regular_employment, other_self_employment, other
  productionName: text("production_name"), // For Film/TV
  accountingOffice: text("accounting_office"), // For Film/TV
  employerName: text("employer_name"), // For Regular Employment
  businessName: text("business_name"), // For Other Self-Employment
  description: text("description"),
  paystubImageUrl: text("paystub_image_url"),
  gstHstCollected: numeric("gst_hst_collected", { precision: 12, scale: 2 }),
  // Deductions for Regular Employment
  cppContribution: numeric("cpp_contribution", { precision: 12, scale: 2 }),
  eiContribution: numeric("ei_contribution", { precision: 12, scale: 2 }),
  incomeTaxDeduction: numeric("income_tax_deduction", { precision: 12, scale: 2 }),
  // Film/TV Deductions
  dues: numeric("dues", { precision: 12, scale: 2 }),
  retirement: numeric("retirement", { precision: 12, scale: 2 }),
  pension: numeric("pension", { precision: 12, scale: 2 }),
  insurance: numeric("insurance", { precision: 12, scale: 2 }),
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
  title: text("title"),
  category: text("category").notNull(),
  subcategory: text("subcategory"), // Add this if missing
  vehicleId: varchar("vehicle_id"), // Add this if missing
  description: text("description"),
  vendor: text("vendor"),
  receiptImageUrl: text("receipt_image_url"),
  isTaxDeductible: boolean("is_tax_deductible").default(true),
  baseCost: numeric("base_cost", { precision: 12, scale: 2 }),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }),
  pstAmount: numeric("pst_amount", { precision: 12, scale: 2 }),
  expenseType: text("expense_type").default("self_employment"), // home_office_living, vehicle, self_employment, personal, mixed
  businessUsePercentage: numeric("business_use_percentage", { precision: 5, scale: 2 }), // For mixed expenses (0-100)
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
  ocrJobId: varchar("ocr_job_id"), // Track Veryfi document ID
  ocrStatus: text("ocr_status"), // 'processing', 'completed', 'failed'
  ocrResult: jsonb("ocr_result"), // Store parsed OCR data
  ocrProcessedAt: timestamp("ocr_processed_at"), // When OCR completed
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
  usedExclusivelyForBusiness: boolean("used_exclusively_for_business").default(false),
  claimsCca: boolean("claims_cca").default(false),
  ccaClass: text("cca_class"),
  currentMileage: numeric("current_mileage", { precision: 12, scale: 2 }),
  mileageAtBeginningOfYear: numeric("mileage_at_beginning_of_year", { precision: 12, scale: 2 }),
  totalAnnualMileage: numeric("total_annual_mileage", { precision: 12, scale: 2 }),
  estimatedYearlyMileage: numeric("estimated_yearly_mileage", { precision: 12, scale: 2 }),
  mileageEstimate: boolean("mileage_estimate").default(false),
  purchasedThisYear: boolean("purchased_this_year").default(false),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// Odometer Photos Table - Store dated odometer photos for vehicles
export const odometerPhotos = pgTable("odometer_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  userId: varchar("user_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  photoDate: date("photo_date").notNull(), // Date the photo was taken (from EXIF or user input)
  mileage: numeric("mileage", { precision: 12, scale: 2 }), // Odometer reading shown in the photo
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  notes: text("notes"),
});

export const insertOdometerPhotoSchema = createInsertSchema(odometerPhotos).omit({ id: true, uploadedAt: true });
export type InsertOdometerPhoto = z.infer<typeof insertOdometerPhotoSchema>;
export type OdometerPhoto = typeof odometerPhotos.$inferSelect;

// Vehicle Mileage Logs Table - Track mileage entries over time
export const vehicleMileageLogs = pgTable("vehicle_mileage_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  userId: varchar("user_id").notNull(),
  date: date("date").notNull(),
  odometerReading: numeric("odometer_reading", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  isBusinessUse: boolean("is_business_use").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVehicleMileageLogSchema = createInsertSchema(vehicleMileageLogs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVehicleMileageLog = z.infer<typeof insertVehicleMileageLogSchema>;
export type VehicleMileageLog = typeof vehicleMileageLogs.$inferSelect;

// CCA Classes for Capital Cost Allowance
export const CCA_CLASSES = {
  "Class 10": { rate: 0.30, description: "Vehicles (cars, trucks, trailers) - 30%" },
  "Class 10.1": { rate: 0.30, description: "Passenger vehicles over $36,000 - 30%" },
  "Class 8": { rate: 0.20, description: "Furniture, fixtures, equipment - 20%" },
  "Class 12": { rate: 1.00, description: "Tools under $500, computer software - 100%" },
  "Class 50": { rate: 0.55, description: "Computer hardware, systems software - 55%" },
  "Class 45": { rate: 0.45, description: "Data network infrastructure - 45%" },
} as const;

export type CCAClass = keyof typeof CCA_CLASSES;

// Assets Table - Capital assets for CCA tracking
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull(),
  purchaseGst: numeric("purchase_gst", { precision: 12, scale: 2 }),
  purchasePst: numeric("purchase_pst", { precision: 12, scale: 2 }),
  ccaClass: text("cca_class").notNull(),
  businessUsePercentage: numeric("business_use_percentage", { precision: 5, scale: 2 }).default("100"),
  applyHalfYearRule: boolean("apply_half_year_rule").default(true),
  vehicleId: varchar("vehicle_id"), // Link to vehicle if applicable
  isActive: boolean("is_active").default(true),
  disposalDate: date("disposal_date"),
  disposalProceeds: numeric("disposal_proceeds", { precision: 12, scale: 2 }),
  disposalGst: numeric("disposal_gst", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Asset CCA History Table - Track CCA claims by tax year
export const assetCcaHistory = pgTable("asset_cca_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  userId: varchar("user_id").notNull(),
  taxYear: text("tax_year").notNull(),
  openingUcc: numeric("opening_ucc", { precision: 12, scale: 2 }).notNull(), // Undepreciated Capital Cost at start
  additions: numeric("additions", { precision: 12, scale: 2 }).default("0"),
  dispositions: numeric("dispositions", { precision: 12, scale: 2 }).default("0"),
  ccaClaimed: numeric("cca_claimed", { precision: 12, scale: 2 }).default("0"),
  closingUcc: numeric("closing_ucc", { precision: 12, scale: 2 }).notNull(), // UCC at end of year
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssetCcaHistorySchema = createInsertSchema(assetCcaHistory).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssetCcaHistory = z.infer<typeof insertAssetCcaHistorySchema>;
export type AssetCcaHistory = typeof assetCcaHistory.$inferSelect;

// Lease Contracts Table
export const leaseContracts = pgTable("lease_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  leaseType: text("lease_type").notNull(), // "vehicle" or "equipment"
  name: text("name").notNull(),
  description: text("description"),
  lessorName: text("lessor_name"),
  leaseStartDate: date("lease_start_date").notNull(),
  leaseEndDate: date("lease_end_date"),
  monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2 }).notNull(),
  paymentFrequency: text("payment_frequency").default("monthly"), // monthly, quarterly, annual
  businessUsePercentage: numeric("business_use_percentage", { precision: 5, scale: 2 }).default("100"),
  vehicleId: varchar("vehicle_id"), // Link to vehicle if applicable
  assetCategory: text("asset_category"), // For equipment leases
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeaseContractSchema = createInsertSchema(leaseContracts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeaseContract = z.infer<typeof insertLeaseContractSchema>;
export type LeaseContract = typeof leaseContracts.$inferSelect;

// Lease Payments Table
export const leasePayments = pgTable("lease_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseContractId: varchar("lease_contract_id").notNull(),
  userId: varchar("user_id").notNull(),
  paymentDate: date("payment_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 12, scale: 2 }),
  pstAmount: numeric("pst_amount", { precision: 12, scale: 2 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLeasePaymentSchema = createInsertSchema(leasePayments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeasePayment = z.infer<typeof insertLeasePaymentSchema>;
export type LeasePayment = typeof leasePayments.$inferSelect;

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
  marginalTaxRate: number;
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

// T2125 Summary for self-employed business activities
export interface T2125Summary {
  taxYear: string;
  grossRevenue: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  ccaDeduction: number;
  leaseExpenseDeduction: number;
  netIncome: number;
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
    description: "Best for occasional or part time unincorporated performers",
    features: [
      "Unlimited income & expense tracking",
      "GST/HST tracking (with GST number)",
      "Basic reports",
    ],
  },
  personal: {
    id: "personal",
    name: "Personal",
    price: 9.99,
    description: "Best for full union members who work regularly but have not yet incorporated",
    features: [
      "Everything in Basic",
      "Receipt photo uploads",
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
    description: "For Incorporated Performers",
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

// Paystubs Table (for uploaded paystub images)
export const paystubs = pgTable("paystubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  imageUrl: text("image_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  linkedIncomeId: varchar("linked_income_id"),
  notes: text("notes"),
  ocrJobId: varchar("ocr_job_id"), // Track Veryfi document ID
  ocrStatus: text("ocr_status"), // 'processing', 'completed', 'failed'
  ocrResult: jsonb("ocr_result"), // Store parsed OCR data
  ocrProcessedAt: timestamp("ocr_processed_at"), // When OCR completed
});

export const insertPaystubSchema = createInsertSchema(paystubs).omit({ id: true, uploadedAt: true });
export type InsertPaystub = z.infer<typeof insertPaystubSchema>;
export type Paystub = typeof paystubs.$inferSelect;
