import {
  type User,
  type UpsertUser,
  type Income,
  type InsertIncome,
  type Expense,
  type InsertExpense,
  type Receipt,
  type InsertReceipt,
  type Paystub,
  type InsertPaystub,
  type TaxCalculation,
  type DividendSalaryScenario,
  type GstHstSummary,
  type TaxQuestionnaire,
  type InsertQuestionnaire,
  type QuestionnaireResponse,
  type InsertQuestionnaireResponse,
  type Vehicle,
  type InsertVehicle,
  type VehicleMileageLog,
  type InsertVehicleMileageLog,
  type OdometerPhoto,
  type InsertOdometerPhoto,
  type Asset,
  type InsertAsset,
  type AssetCcaHistory,
  type InsertAssetCcaHistory,
  type LeaseContract,
  type InsertLeaseContract,
  type LeasePayment,
  type InsertLeasePayment,
  users,
  income,
  expenses,
  receipts,
  paystubs,
  taxQuestionnaires,
  questionnaireResponses,
  vehicles,
  vehicleMileageLogs,
  odometerPhotos,
  assets,
  assetCcaHistory,
  leaseContracts,
  leasePayments,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, gte, lte } from "drizzle-orm";
import { calculateCCAByClass, calculateTotalCCAByClass, type AssetCCACalculation } from "./cca-calculator";
import { calculateTotalLeaseExpenses } from "./lease-calculator";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  getIncome(userId: string): Promise<Income[]>;
  getIncomeById(id: string): Promise<Income | undefined>;
  createIncome(income: InsertIncome): Promise<Income>;
  updateIncome(id: string, data: Partial<InsertIncome>): Promise<Income | undefined>;
  deleteIncome(id: string): Promise<boolean>;

  getExpenses(userId: string): Promise<Expense[]>;
  getExpenseById(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  getReceipts(userId: string): Promise<Receipt[]>;
  getReceiptById(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, data: Partial<Receipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;

  getPaystubs(userId: string): Promise<Paystub[]>;
  getPaystubById(id: string): Promise<Paystub | undefined>;
  createPaystub(paystub: InsertPaystub): Promise<Paystub>;
  updatePaystub(id: string, data: Partial<Paystub>): Promise<Paystub | undefined>;
  deletePaystub(id: string): Promise<boolean>;

  calculateTax(userId: string, taxYear?: string): Promise<TaxCalculation>;
  calculateOptimization(userId: string, corporateIncome?: number, taxYear?: string): Promise<{
    scenarios: DividendSalaryScenario[];
    optimalScenario: DividendSalaryScenario;
  }>;
  calculateGstHst(userId: string, taxYear?: string): Promise<GstHstSummary>;

  getQuestionnaires(userId: string): Promise<TaxQuestionnaire[]>;
  getQuestionnaireById(id: string): Promise<TaxQuestionnaire | undefined>;
  createQuestionnaire(data: InsertQuestionnaire): Promise<TaxQuestionnaire>;
  updateQuestionnaire(id: string, data: Partial<TaxQuestionnaire>): Promise<TaxQuestionnaire | undefined>;
  deleteQuestionnaire(id: string): Promise<boolean>;

  getQuestionnaireResponses(questionnaireId: string): Promise<QuestionnaireResponse[]>;
  upsertQuestionnaireResponse(data: InsertQuestionnaireResponse): Promise<QuestionnaireResponse>;

  getVehicles(userId: string): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicleData: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicleData: Partial<InsertVehicle>): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<boolean>;

  getVehicleMileageLogs(vehicleId: string, userId: string): Promise<VehicleMileageLog[]>;
  getVehicleMileageLogById(id: string): Promise<VehicleMileageLog | undefined>;
  createVehicleMileageLog(logData: InsertVehicleMileageLog): Promise<VehicleMileageLog>;
  updateVehicleMileageLog(id: string, logData: Partial<InsertVehicleMileageLog>): Promise<VehicleMileageLog | undefined>;
  deleteVehicleMileageLog(id: string): Promise<boolean>;

  getOdometerPhotos(vehicleId: string, userId: string): Promise<OdometerPhoto[]>;
  getOdometerPhotoById(id: string): Promise<OdometerPhoto | undefined>;
  createOdometerPhoto(photoData: InsertOdometerPhoto): Promise<OdometerPhoto>;
  updateOdometerPhoto(id: string, photoData: Partial<InsertOdometerPhoto>): Promise<OdometerPhoto | undefined>;
  deleteOdometerPhoto(id: string): Promise<boolean>;

  updateExpenseCategory(userId: string, oldCategory: string, newCategory: string): Promise<number>;
  getProvincialBracketBreakdown(income: number, province: string): Array<{ bracket: string; rate: number; tax: number }>;

  // Assets
  getAssets(userId: string): Promise<Asset[]>;
  getAssetById(id: string): Promise<Asset | undefined>;
  createAsset(assetData: InsertAsset): Promise<Asset>;
  updateAsset(id: string, assetData: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<boolean>;

  // Asset CCA History
  getAssetCcaHistory(assetId: string, userId: string): Promise<AssetCcaHistory[]>;
  getAssetCcaHistoryById(id: string): Promise<AssetCcaHistory | undefined>;
  createAssetCcaHistory(historyData: InsertAssetCcaHistory): Promise<AssetCcaHistory>;
  updateAssetCcaHistory(id: string, historyData: Partial<InsertAssetCcaHistory>): Promise<AssetCcaHistory | undefined>;
  deleteAssetCcaHistory(id: string): Promise<boolean>;
  calculateCCASummary(userId: string, taxYear: string): Promise<{
    totalCCA: number;
    ccaByClass: Map<string, number>;
  }>;

  // Lease Contracts
  getLeaseContracts(userId: string): Promise<LeaseContract[]>;
  getLeaseContractById(id: string): Promise<LeaseContract | undefined>;
  createLeaseContract(contractData: InsertLeaseContract): Promise<LeaseContract>;
  updateLeaseContract(id: string, contractData: Partial<InsertLeaseContract>): Promise<LeaseContract | undefined>;
  deleteLeaseContract(id: string): Promise<boolean>;

  // Lease Payments
  getLeasePayments(leaseContractId: string, userId: string): Promise<LeasePayment[]>;
  getLeasePaymentById(id: string): Promise<LeasePayment | undefined>;
  createLeasePayment(paymentData: InsertLeasePayment): Promise<LeasePayment>;
  updateLeasePayment(id: string, paymentData: Partial<InsertLeasePayment>): Promise<LeasePayment | undefined>;
  deleteLeasePayment(id: string): Promise<boolean>;
  calculateLeaseExpenseSummary(userId: string, taxYear: string): Promise<{
    totalLeaseExpense: number;
    totalGst: number;
    totalPst: number;
  }>;
  calculateT2125Summary(userId: string, taxYear: string): Promise<{
    taxYear: string;
    grossRevenue: number;
    expensesByCategory: Record<string, number>;
    totalExpenses: number;
    ccaDeduction: number;
    leaseExpenseDeduction: number;
    netIncome: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getIncome(userId: string): Promise<Income[]> {
    return await db
      .select()
      .from(income)
      .where(eq(income.userId, userId))
      .orderBy(desc(income.date));
  }

  async getIncomeById(id: string): Promise<Income | undefined> {
    const [record] = await db.select().from(income).where(eq(income.id, id));
    return record || undefined;
  }

  async createIncome(incomeData: InsertIncome): Promise<Income> {
    const [record] = await db
      .insert(income)
      .values(incomeData)
      .returning();
    return record;
  }

  async updateIncome(id: string, data: Partial<InsertIncome>): Promise<Income | undefined> {
    const [record] = await db
      .update(income)
      .set(data)
      .where(eq(income.id, id))
      .returning();
    return record || undefined;
  }

  async deleteIncome(id: string): Promise<boolean> {
    const result = await db.delete(income).where(eq(income.id, id)).returning();
    return result.length > 0;
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    return await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(desc(expenses.date));
  }

  async getExpenseById(id: string): Promise<Expense | undefined> {
    const [record] = await db.select().from(expenses).where(eq(expenses.id, id));
    return record || undefined;
  }

  async createExpense(expenseData: InsertExpense): Promise<Expense> {
    const [record] = await db
      .insert(expenses)
      .values(expenseData)
      .returning();
    return record;
  }

  async updateExpense(id: string, expenseData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [record] = await db
      .update(expenses)
      .set(expenseData)
      .where(eq(expenses.id, id))
      .returning();
    return record || undefined;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return result.length > 0;
  }

  async getReceipts(userId: string): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(eq(receipts.userId, userId))
      .orderBy(desc(receipts.uploadedAt));
  }

  async getReceiptById(id: string): Promise<Receipt | undefined> {
    const [record] = await db.select().from(receipts).where(eq(receipts.id, id));
    return record || undefined;
  }

  async createReceipt(receiptData: InsertReceipt): Promise<Receipt> {
    const [record] = await db
      .insert(receipts)
      .values(receiptData)
      .returning();
    return record;
  }

  async updateReceipt(id: string, data: Partial<Receipt>): Promise<Receipt | undefined> {
    const [record] = await db
      .update(receipts)
      .set(data)
      .where(eq(receipts.id, id))
      .returning();
    return record || undefined;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    const result = await db.delete(receipts).where(eq(receipts.id, id)).returning();
    return result.length > 0;
  }

  async getPaystubs(userId: string): Promise<Paystub[]> {
    return await db
      .select()
      .from(paystubs)
      .where(eq(paystubs.userId, userId))
      .orderBy(desc(paystubs.uploadedAt));
  }

  async getPaystubById(id: string): Promise<Paystub | undefined> {
    const [record] = await db.select().from(paystubs).where(eq(paystubs.id, id));
    return record || undefined;
  }

  async getPaystubsByLinkedIncome(incomeId: string): Promise<Paystub[]> {
    return await db
      .select()
      .from(paystubs)
      .where(eq(paystubs.linkedIncomeId, incomeId));
  }

  async getIncomeByPaystub(paystubId: string): Promise<Income | undefined> {
    const paystub = await this.getPaystubById(paystubId);
    if (!paystub?.linkedIncomeId) {
      return undefined;
    }
    return await this.getIncomeById(paystub.linkedIncomeId);
  }

  async createPaystub(paystubData: InsertPaystub): Promise<Paystub> {
    const [record] = await db
      .insert(paystubs)
      .values(paystubData)
      .returning();
    return record;
  }

  async updatePaystub(id: string, data: Partial<Paystub>): Promise<Paystub | undefined> {
    const [record] = await db
      .update(paystubs)
      .set(data)
      .where(eq(paystubs.id, id))
      .returning();
    return record || undefined;
  }

  async deletePaystub(id: string): Promise<boolean> {
    const result = await db.delete(paystubs).where(eq(paystubs.id, id)).returning();
    return result.length > 0;
  }

  // Get the marginal federal tax rate for a given income
  private getFederalMarginalRate(income: number): number {
    const brackets = [
      { limit: 55867, rate: 0.15 },
      { limit: 111733, rate: 0.205 },
      { limit: 173205, rate: 0.26 },
      { limit: 246752, rate: 0.29 },
      { limit: Infinity, rate: 0.33 },
    ];

    for (const bracket of brackets) {
      if (income <= bracket.limit) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1].rate;
  }

  // Get the marginal provincial tax rate for a given income and province
  private getProvincialMarginalRate(income: number, province: string): number {
    const provincialBrackets: Record<string, Array<{ limit: number; rate: number }>> = {
      AB: [
        { limit: 60000, rate: 0.08 },
        { limit: 151234, rate: 0.10 },
        { limit: 181481, rate: 0.12 },
        { limit: 241974, rate: 0.13 },
        { limit: 362961, rate: 0.14 },
        { limit: Infinity, rate: 0.15 },
      ],
      BC: [
        { limit: 49279, rate: 0.0506 },
        { limit: 98560, rate: 0.077 },
        { limit: 113158, rate: 0.105 },
        { limit: 137407, rate: 0.1229 },
        { limit: 186306, rate: 0.147 },
        { limit: 259829, rate: 0.168 },
        { limit: Infinity, rate: 0.205 },
      ],
      MB: [
        { limit: 47000, rate: 0.108 },
        { limit: 100000, rate: 0.1275 },
        { limit: Infinity, rate: 0.174 },
      ],
      NB: [
        { limit: 51306, rate: 0.094 },
        { limit: 102614, rate: 0.14 },
        { limit: 190060, rate: 0.16 },
        { limit: Infinity, rate: 0.195 },
      ],
      NL: [
        { limit: 44192, rate: 0.087 },
        { limit: 88382, rate: 0.145 },
        { limit: 157792, rate: 0.158 },
        { limit: 220910, rate: 0.178 },
        { limit: 282214, rate: 0.198 },
        { limit: 564429, rate: 0.208 },
        { limit: 1128858, rate: 0.213 },
        { limit: Infinity, rate: 0.218 },
      ],
      NS: [
        { limit: 30507, rate: 0.0879 },
        { limit: 61015, rate: 0.1495 },
        { limit: 95883, rate: 0.1667 },
        { limit: 154650, rate: 0.175 },
        { limit: Infinity, rate: 0.21 },
      ],
      NT: [
        { limit: 51964, rate: 0.059 },
        { limit: 103930, rate: 0.086 },
        { limit: 168967, rate: 0.122 },
        { limit: Infinity, rate: 0.1405 },
      ],
      NU: [
        { limit: 54707, rate: 0.04 },
        { limit: 109413, rate: 0.07 },
        { limit: 177885, rate: 0.09 },
        { limit: Infinity, rate: 0.115 },
      ],
      ON: [
        { limit: 52886, rate: 0.0505 },
        { limit: 105775, rate: 0.0915 },
        { limit: 150000, rate: 0.1116 },
        { limit: 220000, rate: 0.1216 },
        { limit: Infinity, rate: 0.1316 },
      ],
      PE: [
        { limit: 33328, rate: 0.095 },
        { limit: 64656, rate: 0.1347 },
        { limit: 105000, rate: 0.166 },
        { limit: 140000, rate: 0.1762 },
        { limit: Infinity, rate: 0.19 },
      ],
      QC: [
        { limit: 53255, rate: 0.14 },
        { limit: 106495, rate: 0.19 },
        { limit: 129590, rate: 0.24 },
        { limit: Infinity, rate: 0.2575 },
      ],
      SK: [
        { limit: 53463, rate: 0.105 },
        { limit: 152750, rate: 0.125 },
        { limit: Infinity, rate: 0.145 },
      ],
      YT: [
        { limit: 57375, rate: 0.064 },
        { limit: 114750, rate: 0.09 },
        { limit: 177882, rate: 0.109 },
        { limit: 500000, rate: 0.128 },
        { limit: Infinity, rate: 0.15 },
      ],
    };

    const brackets = provincialBrackets[province] || provincialBrackets.BC;

    for (const bracket of brackets) {
      if (income <= bracket.limit) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1].rate;
  }

  async calculateTax(userId: string, taxYear?: string): Promise<TaxCalculation> {
    const user = await this.getUser(userId);
    
    // Use provided tax year or current year
    const currentTaxYear = taxYear || new Date().getFullYear().toString();
    const yearNum = parseInt(currentTaxYear, 10);
    const yearStart = `${yearNum}-01-01`;
    const yearEnd = `${yearNum}-12-31`;

    // Filter income by tax year
    const allIncomeRecords = await this.getIncome(userId);
    const incomeRecords = allIncomeRecords.filter((i) => {
      const incomeDate = new Date(i.date);
      const startDate = new Date(yearStart);
      const endDate = new Date(yearEnd);
      return incomeDate >= startDate && incomeDate <= endDate;
    });

    // Filter expenses by tax year
    const allExpenseRecords = await this.getExpenses(userId);
    const expenseRecords = allExpenseRecords.filter((e) => {
      const expenseDate = new Date(e.date);
      const startDate = new Date(yearStart);
      const endDate = new Date(yearEnd);
      return expenseDate >= startDate && expenseDate <= endDate;
    });

    // Calculate gross income (use grossPay if available, otherwise use amount/net pay as fallback)
    const grossIncome = incomeRecords.reduce((sum, i) => {
      const gross = i.grossPay ? parseFloat(i.grossPay) : parseFloat(i.amount);
      return sum + gross;
    }, 0);
    const totalExpenses = expenseRecords
      .filter((e) => e.isTaxDeductible)
      .reduce((sum, e) => {
        const baseCost = e.baseCost ? parseFloat(e.baseCost.toString()) : 0;
        const pstAmount = e.pstAmount ? parseFloat(e.pstAmount.toString()) : 0;
        let deductibleAmount = baseCost + pstAmount;
        
        // Apply home office percentage for home office expenses
        if (e.category === "home_office_expenses" && user?.homeOfficePercentage) {
          const percentage = parseFloat(user.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * percentage;
        } else if (e.category === "meals_entertainment") {
          // CRA limits most meals & entertainment to 50%
          deductibleAmount = deductibleAmount * 0.50;
        } else {
          // For non-home-office expenses, use the total amount if baseCost/pstAmount not available
          if (baseCost === 0 && pstAmount === 0) {
            deductibleAmount = parseFloat(e.amount);
          }
        }
        
        return sum + deductibleAmount;
      }, 0);
    
    // Add CCA deductions
    const ccaSummary = await this.calculateCCASummary(userId, currentTaxYear);
    const ccaDeduction = ccaSummary.totalCCA;
    
    // Add lease expense deductions
    const leaseSummary = await this.calculateLeaseExpenseSummary(userId, currentTaxYear);
    const leaseDeduction = leaseSummary.totalLeaseExpense;
    
    const totalExpensesWithCCAAndLease = totalExpenses + ccaDeduction + leaseDeduction;
    const netIncome = Math.max(0, grossIncome - totalExpensesWithCCAAndLease);

    // Apply basic personal amount deduction (~$15,000) before calculating tax
    const basicPersonalAmount = 15000;
    const taxableIncome = Math.max(0, netIncome - basicPersonalAmount);

    const federalTax = this.calculateFederalTax(taxableIncome);
    const provincialTax = this.calculateProvincialTax(taxableIncome, user?.province || "BC");
    const cppContribution = this.calculateCPP(netIncome, currentTaxYear);
    const totalIncomeTax = federalTax + provincialTax;
    const totalOwed = totalIncomeTax + cppContribution;
    const effectiveTaxRate = netIncome > 0 ? (totalOwed / netIncome) * 100 : 0;
    
    // Calculate marginal tax rate (federal + provincial rate for the current bracket)
    const federalMarginalRate = this.getFederalMarginalRate(netIncome);
    const provincialMarginalRate = this.getProvincialMarginalRate(netIncome, user?.province || "BC");
    const marginalTaxRate = (federalMarginalRate + provincialMarginalRate) * 100;

    return {
      grossIncome,
      totalExpenses,
      netIncome,
      federalTax,
      provincialTax,
      totalIncomeTax,
      cppContribution,
      totalOwed,
      effectiveTaxRate,
      marginalTaxRate,
    };
  }

  private calculateFederalTax(income: number): number {
    const brackets = [
      { limit: 55867, rate: 0.15 },
      { limit: 111733, rate: 0.205 },
      { limit: 173205, rate: 0.26 },
      { limit: 246752, rate: 0.29 },
      { limit: Infinity, rate: 0.33 },
    ];

    let tax = 0;
    let remaining = income;
    let prevLimit = 0;

    for (const bracket of brackets) {
      const taxableInBracket = Math.min(remaining, bracket.limit - prevLimit);
      if (taxableInBracket <= 0) break;
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      prevLimit = bracket.limit;
    }

    // Basic personal amount is now applied as a deduction before this function is called
    return Math.max(0, tax);
  }

  private calculateProvincialTax(income: number, province: string): number {
    // 2025 Provincial/Territorial Tax Brackets
    const provincialBrackets: Record<string, Array<{ limit: number; rate: number }>> = {
      // Alberta
      AB: [
        { limit: 60000, rate: 0.08 },
        { limit: 151234, rate: 0.10 },
        { limit: 181481, rate: 0.12 },
        { limit: 241974, rate: 0.13 },
        { limit: 362961, rate: 0.14 },
        { limit: Infinity, rate: 0.15 },
      ],
      // British Columbia
      BC: [
        { limit: 49279, rate: 0.0506 },
        { limit: 98560, rate: 0.077 },
        { limit: 113158, rate: 0.105 },
        { limit: 137407, rate: 0.1229 },
        { limit: 186306, rate: 0.147 },
        { limit: 259829, rate: 0.168 },
        { limit: Infinity, rate: 0.205 },
      ],
      // Manitoba
      MB: [
        { limit: 47000, rate: 0.108 },
        { limit: 100000, rate: 0.1275 },
        { limit: Infinity, rate: 0.174 },
      ],
      // New Brunswick
      NB: [
        { limit: 51306, rate: 0.094 },
        { limit: 102614, rate: 0.14 },
        { limit: 190060, rate: 0.16 },
        { limit: Infinity, rate: 0.195 },
      ],
      // Newfoundland and Labrador
      NL: [
        { limit: 44192, rate: 0.087 },
        { limit: 88382, rate: 0.145 },
        { limit: 157792, rate: 0.158 },
        { limit: 220910, rate: 0.178 },
        { limit: 282214, rate: 0.198 },
        { limit: 564429, rate: 0.208 },
        { limit: 1128858, rate: 0.213 },
        { limit: Infinity, rate: 0.218 },
      ],
      // Nova Scotia
      NS: [
        { limit: 30507, rate: 0.0879 },
        { limit: 61015, rate: 0.1495 },
        { limit: 95883, rate: 0.1667 },
        { limit: 154650, rate: 0.175 },
        { limit: Infinity, rate: 0.21 },
      ],
      // Northwest Territories
      NT: [
        { limit: 51964, rate: 0.059 },
        { limit: 103930, rate: 0.086 },
        { limit: 168967, rate: 0.122 },
        { limit: Infinity, rate: 0.1405 },
      ],
      // Nunavut
      NU: [
        { limit: 54707, rate: 0.04 },
        { limit: 109413, rate: 0.07 },
        { limit: 177885, rate: 0.09 },
        { limit: Infinity, rate: 0.115 },
      ],
      // Ontario (2025 brackets)
      ON: [
        { limit: 52886, rate: 0.0505 },
        { limit: 105775, rate: 0.0915 },
        { limit: 150000, rate: 0.1116 },
        { limit: 220000, rate: 0.1216 },
        { limit: Infinity, rate: 0.1316 },
      ],
      // Prince Edward Island
      PE: [
        { limit: 33328, rate: 0.095 },
        { limit: 64656, rate: 0.1347 },
        { limit: 105000, rate: 0.166 },
        { limit: 140000, rate: 0.1762 },
        { limit: Infinity, rate: 0.19 },
      ],
      // Quebec (note: Quebec has separate tax filing)
      QC: [
        { limit: 53255, rate: 0.14 },
        { limit: 106495, rate: 0.19 },
        { limit: 129590, rate: 0.24 },
        { limit: Infinity, rate: 0.2575 },
      ],
      // Saskatchewan
      SK: [
        { limit: 53463, rate: 0.105 },
        { limit: 152750, rate: 0.125 },
        { limit: Infinity, rate: 0.145 },
      ],
      // Yukon
      YT: [
        { limit: 57375, rate: 0.064 },
        { limit: 114750, rate: 0.09 },
        { limit: 177882, rate: 0.109 },
        { limit: 500000, rate: 0.128 },
        { limit: Infinity, rate: 0.15 },
      ],
    };

    // Get brackets for the province, default to British Columbia if not found
    const brackets = provincialBrackets[province] || provincialBrackets.BC;
    
    let tax = 0;
    let remaining = income;
    let prevLimit = 0;

    for (const bracket of brackets) {
      const taxableInBracket = Math.min(remaining, bracket.limit - prevLimit);
      if (taxableInBracket <= 0) break;
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
      prevLimit = bracket.limit;
    }

    // Basic personal amount is now applied as a deduction before this function is called
    return Math.max(0, tax);
  }

  /**
   * Get CPP parameters (max pensionable earnings and rates) by tax year
   */
  private getCPPParameters(taxYear: string | number): {
    maxPensionableEarnings: number;
    basicExemption: number;
    selfEmployedRate: number;
  } {
    const year = typeof taxYear === 'string' ? parseInt(taxYear, 10) : taxYear;
    
    // CPP parameters by tax year
    // Source: Canada Revenue Agency - Year's Maximum Pensionable Earnings
    const cppParamsByYear: Record<number, { maxPensionableEarnings: number; basicExemption: number; selfEmployedRate: number }> = {
      2020: { maxPensionableEarnings: 58700, basicExemption: 3500, selfEmployedRate: 0.1095 }, // 10.95%
      2021: { maxPensionableEarnings: 61600, basicExemption: 3500, selfEmployedRate: 0.1095 }, // 10.95%
      2022: { maxPensionableEarnings: 64900, basicExemption: 3500, selfEmployedRate: 0.1115 }, // 11.15%
      2023: { maxPensionableEarnings: 66600, basicExemption: 3500, selfEmployedRate: 0.1140 }, // 11.40%
      2024: { maxPensionableEarnings: 68500, basicExemption: 3500, selfEmployedRate: 0.1190 }, // 11.90%
      2025: { maxPensionableEarnings: 71300, basicExemption: 3500, selfEmployedRate: 0.1190 }, // 11.90%
      2026: { maxPensionableEarnings: 74600, basicExemption: 3500, selfEmployedRate: 0.1190 }, // 11.90% (estimated)
    };
    
    // Use year-specific params if available, otherwise use most recent
    const params = cppParamsByYear[year] || cppParamsByYear[2026];
    return params;
  }

  private calculateCPP(income: number, taxYear: string | number = new Date().getFullYear(), cppAlreadyPaid: number = 0): number {
    const { maxPensionableEarnings, basicExemption, selfEmployedRate } = this.getCPPParameters(taxYear);
    
    // Maximum CPP contribution for self-employed individuals
    const maxContributoryEarnings = maxPensionableEarnings - basicExemption;
    const maxCPPContribution = maxContributoryEarnings * selfEmployedRate;

    const pensionableEarnings = Math.min(income, maxPensionableEarnings);
    // CPP has its own basic personal exemption (currently $3,500) - apply it here
    const contributionBase = Math.max(0, pensionableEarnings - basicExemption);
    const calculatedCPP = contributionBase * selfEmployedRate;
    
    // Apply annual cap: total CPP (already paid + calculated) cannot exceed maximum
    const totalCPP = cppAlreadyPaid + calculatedCPP;
    const cappedCPP = Math.min(totalCPP, maxCPPContribution);
    
    // Return only the additional CPP needed (could be negative if already over cap)
    return Math.max(0, cappedCPP - cppAlreadyPaid);
  }

  async calculateOptimization(
    userId: string,
    corporateIncome: number = 100000,
    taxYear?: string
  ): Promise<{
    scenarios: DividendSalaryScenario[];
    optimalScenario: DividendSalaryScenario;
  }> {
    const scenarios: DividendSalaryScenario[] = [];
    const splits = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const currentTaxYear = taxYear || new Date().getFullYear().toString();

    for (const salaryPercent of splits) {
      const salaryAmount = (corporateIncome * salaryPercent) / 100;
      const dividendAmount = corporateIncome - salaryAmount;

      const corporateTax = this.calculateCorporateTax(dividendAmount);
      const afterCorpTaxDividend = dividendAmount - corporateTax;

      const personalTaxOnSalary = this.calculateFederalTax(salaryAmount) + 
        this.calculateProvincialTax(salaryAmount, "ON");
      const personalTaxOnDividend = this.calculateDividendTax(afterCorpTaxDividend);
      const personalTax = personalTaxOnSalary + personalTaxOnDividend;

      const cppContribution = this.calculateCPP(salaryAmount, currentTaxYear);

      const totalTax = corporateTax + personalTax + cppContribution;
      const afterTaxIncome = corporateIncome - totalTax;

      scenarios.push({
        salaryAmount,
        dividendAmount,
        personalTax,
        corporateTax,
        cppContribution,
        totalTax,
        afterTaxIncome,
        isOptimal: false,
      });
    }

    const optimalIndex = scenarios.reduce(
      (maxIdx, scenario, idx, arr) =>
        scenario.afterTaxIncome > arr[maxIdx].afterTaxIncome ? idx : maxIdx,
      0
    );

    scenarios[optimalIndex].isOptimal = true;

    return {
      scenarios,
      optimalScenario: scenarios[optimalIndex],
    };
  }

  private calculateCorporateTax(income: number): number {
    const smallBusinessRate = 0.09;
    const smallBusinessLimit = 500000;

    if (income <= smallBusinessLimit) {
      return income * smallBusinessRate;
    }

    const generalRate = 0.15;
    return smallBusinessLimit * smallBusinessRate + 
      (income - smallBusinessLimit) * generalRate;
  }

  private calculateDividendTax(grossDividend: number): number {
    const grossUpRate = 1.15;
    const dividendTaxCredit = 0.09;

    const grossedUpDividend = grossDividend * grossUpRate;
    const taxOnGrossedUp = this.calculateFederalTax(grossedUpDividend) + 
      this.calculateProvincialTax(grossedUpDividend, "ON");
    const credit = grossedUpDividend * dividendTaxCredit;

    return Math.max(0, taxOnGrossedUp - credit);
  }

  async calculateGstHst(userId: string, taxYear?: string): Promise<GstHstSummary> {
    const currentYear = taxYear || new Date().getFullYear().toString();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:858',message:'calculateGstHst entry',data:{currentYear,taxYear,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    const incomeRecords = await this.getIncome(userId);
    const expenseRecords = await this.getExpenses(userId);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:861',message:'All income records fetched',data:{totalIncomeRecords:incomeRecords.length,incomeRecords:incomeRecords.map(i=>({id:i.id,date:i.date,dateType:typeof i.date,dateStr:String(i.date),gstHstCollected:i.gstHstCollected}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Filter income records by tax year - extract year from date string (YYYY-MM-DD format)
    const yearIncomeRecords = incomeRecords.filter((i) => {
      if (!i.date) return false;
      // Extract year from date string (format: YYYY-MM-DD)
      const dateStr = i.date.toString();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:867',message:'Date filtering check',data:{incomeId:i.id,dateStr,dateType:typeof i.date,rawDate:i.date},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const yearMatch = dateStr.match(/^(\d{4})-/);
      if (!yearMatch) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:870',message:'Year match failed',data:{incomeId:i.id,dateStr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return false;
      }
      const incomeYear = yearMatch[1];
      const matches = incomeYear === currentYear;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:873',message:'Year comparison result',data:{incomeId:i.id,incomeYear,currentYear,matches,gstHstCollected:i.gstHstCollected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return matches;
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:875',message:'Filtered income records',data:{filteredCount:yearIncomeRecords.length,filteredRecords:yearIncomeRecords.map(i=>({id:i.id,date:i.date,gstHstCollected:i.gstHstCollected}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Filter expense records by tax year - extract year from date string (YYYY-MM-DD format)
    const yearExpenseRecords = expenseRecords.filter((e) => {
      if (!e.date) return false;
      // Extract year from date string (format: YYYY-MM-DD)
      const dateStr = e.date.toString();
      const yearMatch = dateStr.match(/^(\d{4})-/);
      if (!yearMatch) return false;
      const expenseYear = yearMatch[1];
      return expenseYear === currentYear;
    });

    const gstHstCollected = yearIncomeRecords.reduce(
      (sum, i) => {
        const gstValue = i.gstHstCollected ? parseFloat(i.gstHstCollected) : 0;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:888',message:'GST collected accumulation',data:{incomeId:i.id,gstHstCollected:i.gstHstCollected,gstValue,currentSum:sum,newSum:sum+gstValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return sum + gstValue;
      },
      0
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:894',message:'Total GST collected from income',data:{gstHstCollected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Use gstAmount for Input Tax Credits (GST amount calculated from expense breakdown)
    let inputTaxCredits = yearExpenseRecords.reduce(
      (sum, e) => {
        const gstAmount = e.gstAmount ? parseFloat(e.gstAmount.toString()) : 0;
        return sum + gstAmount;
      },
      0
    );

    // Add GST/HST from asset purchases (Input Tax Credits)
    const userAssets = await this.getAssets(userId);
    for (const asset of userAssets) {
      const purchaseYear = new Date(asset.purchaseDate).getFullYear().toString();
      // Only include GST from assets purchased in the current tax year
      if (purchaseYear === currentYear && asset.purchaseGst) {
        inputTaxCredits += parseFloat(asset.purchaseGst.toString());
      }
      
      // Add GST/HST from asset dispositions (GST/HST collected on sale)
      if (asset.disposalDate) {
        const disposalYear = new Date(asset.disposalDate).getFullYear().toString();
        if (disposalYear === currentYear && asset.disposalGst) {
          // Note: This adds to gstHstCollected, but we'll handle it separately for clarity
          // Actually, for now we'll include it in inputTaxCredits as a negative (which is incorrect)
          // Let me reconsider - disposal GST should be added to gstHstCollected
        }
      }
    }

    // Add GST/HST from lease payments (Input Tax Credits)
    const leaseSummary = await this.calculateLeaseExpenseSummary(userId, currentYear);
    inputTaxCredits += leaseSummary.totalGst;

    // Add GST/HST from asset dispositions to collected amount
    let assetDisposalGst = 0;
    for (const asset of userAssets) {
      if (asset.disposalDate) {
        const disposalYear = new Date(asset.disposalDate).getFullYear().toString();
        if (disposalYear === currentYear && asset.disposalGst) {
          const disposalGstValue = parseFloat(asset.disposalGst.toString());
          assetDisposalGst += disposalGstValue;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:930',message:'Asset disposal GST added',data:{assetId:asset.id,disposalDate:asset.disposalDate,disposalYear,currentYear,disposalGst:asset.disposalGst,disposalGstValue,totalAssetDisposalGst:assetDisposalGst},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:936',message:'Total asset disposal GST',data:{assetDisposalGst,totalAssets:userAssets.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    const finalGstHstCollected = gstHstCollected + assetDisposalGst;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6b99a64-dfde-48f8-95da-efaab67ee43b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'storage.ts:940',message:'Final GST collected calculation',data:{gstHstCollected,assetDisposalGst,finalGstHstCollected},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    const transactionsWithGstHst = 
      yearIncomeRecords.filter((i) => i.gstHstCollected && parseFloat(i.gstHstCollected) > 0).length +
      yearExpenseRecords.filter((e) => {
        const gstAmount = e.gstAmount ? parseFloat(e.gstAmount.toString()) : 0;
        return gstAmount > 0;
      }).length +
      userAssets.filter((a) => {
        const purchaseYear = new Date(a.purchaseDate).getFullYear().toString();
        return purchaseYear === currentYear && a.purchaseGst && parseFloat(a.purchaseGst.toString()) > 0;
      }).length +
      userAssets.filter((a) => {
        if (!a.disposalDate) return false;
        const disposalYear = new Date(a.disposalDate).getFullYear().toString();
        return disposalYear === currentYear && a.disposalGst && parseFloat(a.disposalGst.toString()) > 0;
      }).length;

    return {
      gstHstCollected: finalGstHstCollected,
      inputTaxCredits,
      netGstHstOwing: finalGstHstCollected - inputTaxCredits,
      transactionsWithGstHst,
    };
  }

  async getQuestionnaires(userId: string): Promise<TaxQuestionnaire[]> {
    return await db
      .select()
      .from(taxQuestionnaires)
      .where(eq(taxQuestionnaires.userId, userId))
      .orderBy(desc(taxQuestionnaires.createdAt));
  }

  async getQuestionnaireById(id: string): Promise<TaxQuestionnaire | undefined> {
    const [questionnaire] = await db
      .select()
      .from(taxQuestionnaires)
      .where(eq(taxQuestionnaires.id, id));
    return questionnaire || undefined;
  }

  async createQuestionnaire(data: InsertQuestionnaire): Promise<TaxQuestionnaire> {
    const [questionnaire] = await db
      .insert(taxQuestionnaires)
      .values(data)
      .returning();
    return questionnaire;
  }

  async updateQuestionnaire(id: string, data: Partial<TaxQuestionnaire>): Promise<TaxQuestionnaire | undefined> {
    const [questionnaire] = await db
      .update(taxQuestionnaires)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taxQuestionnaires.id, id))
      .returning();
    return questionnaire || undefined;
  }

  async deleteQuestionnaire(id: string): Promise<boolean> {
    await db.delete(questionnaireResponses).where(eq(questionnaireResponses.questionnaireId, id));
    const result = await db.delete(taxQuestionnaires).where(eq(taxQuestionnaires.id, id)).returning();
    return result.length > 0;
  }

  async getQuestionnaireResponses(questionnaireId: string): Promise<QuestionnaireResponse[]> {
    return await db
      .select()
      .from(questionnaireResponses)
      .where(eq(questionnaireResponses.questionnaireId, questionnaireId));
  }

  async upsertQuestionnaireResponse(data: InsertQuestionnaireResponse): Promise<QuestionnaireResponse> {
    const existing = await db
      .select()
      .from(questionnaireResponses)
      .where(
        and(
          eq(questionnaireResponses.questionnaireId, data.questionnaireId),
          eq(questionnaireResponses.sectionId, data.sectionId),
          eq(questionnaireResponses.questionId, data.questionId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(questionnaireResponses)
        .set({ value: data.value, updatedAt: new Date() })
        .where(eq(questionnaireResponses.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(questionnaireResponses)
      .values(data)
      .returning();
    return created;
  }

  async getVehicles(userId: string): Promise<Vehicle[]> {
    return await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.userId, userId))
      .orderBy(desc(vehicles.isPrimary), asc(vehicles.name));
  }

  async getVehicleById(id: string): Promise<Vehicle | undefined> {
    const [record] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return record || undefined;
  }

  async createVehicle(vehicleData: InsertVehicle): Promise<Vehicle> {
    // Data already comes as strings from schema validation (Drizzle numeric columns expect strings)
    const [record] = await db
      .insert(vehicles)
      .values(vehicleData)
      .returning();
    return record;
  }

  async updateVehicle(id: string, vehicleData: Partial<InsertVehicle>): Promise<Vehicle> {
    // Data already comes as strings from schema validation (Drizzle numeric columns expect strings)
    const [record] = await db
      .update(vehicles)
      .set({ ...vehicleData, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    return record;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const result = await db.delete(vehicles).where(eq(vehicles.id, id)).returning();
    return result.length > 0;
  }

  async getVehicleMileageLogs(vehicleId: string, userId: string): Promise<VehicleMileageLog[]> {
    return await db
      .select()
      .from(vehicleMileageLogs)
      .where(and(eq(vehicleMileageLogs.vehicleId, vehicleId), eq(vehicleMileageLogs.userId, userId)))
      .orderBy(desc(vehicleMileageLogs.date), desc(vehicleMileageLogs.createdAt));
  }

  async calculateVehicleBusinessUsePercentage(vehicleId: string, userId: string, taxYear: string, enableInterpolation: boolean = false): Promise<number> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) {
      return 100; // Default if vehicle not found
    }
    
    // Get user to check mileage logging style
    const user = await this.getUser(userId);
    const isOdometerStyle = user?.mileageLoggingStyle === "odometer";
    
    const logs = await this.getVehicleMileageLogs(vehicleId, userId);
    
    // Filter logs for the tax year
    const yearStart = `${taxYear}-01-01`;
    const yearEnd = `${taxYear}-12-31`;
    const yearLogs = logs.filter(log => {
      const logDate = log.date;
      return logDate >= yearStart && logDate <= yearEnd;
    });

    if (yearLogs.length === 0) {
      return 100; // Default to 100% if no logs
    }

    // Calculate business mileage from logs
    let businessMileage = 0;
    const sortedLogs = [...yearLogs].sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate business mileage between consecutive logs
    for (let i = 1; i < sortedLogs.length; i++) {
      const prevReading = parseFloat(sortedLogs[i - 1].odometerReading.toString());
      const currReading = parseFloat(sortedLogs[i].odometerReading.toString());
      const distance = Math.max(0, currReading - prevReading);
      
      if (sortedLogs[i].isBusinessUse) {
        businessMileage += distance;
      }
    }

    // Get total annual mileage (priority: photos > logs > legacy field)
    let totalAnnualMileage: number | null = null;
    let hasCompleteYearData = false;
    
    // Try photos first
    totalAnnualMileage = await this.calculateTotalMileageFromPhotos(vehicleId, userId, taxYear);
    
    // Check if photos cover the full year (have photos at start and end of year)
    if (totalAnnualMileage !== null) {
      const photos = await this.getOdometerPhotos(vehicleId, userId);
      const yearStart = `${taxYear}-01-01`;
      const yearEnd = `${taxYear}-12-31`;
      const yearPhotos = photos.filter(photo => {
        const photoDate = photo.photoDate;
        return photoDate >= yearStart && photoDate <= yearEnd && photo.mileage !== null;
      });
      
      if (yearPhotos.length >= 2) {
        const sortedPhotos = [...yearPhotos].sort((a, b) => a.photoDate.localeCompare(b.photoDate));
        const firstPhotoDate = sortedPhotos[0].photoDate;
        const lastPhotoDate = sortedPhotos[sortedPhotos.length - 1].photoDate;
        // Consider it complete if we have photos near the start and end of the year
        hasCompleteYearData = firstPhotoDate <= `${taxYear}-01-31` && lastPhotoDate >= `${taxYear}-12-01`;
      }
    }
    
    // Fall back to logs if no photos
    if (totalAnnualMileage === null) {
      totalAnnualMileage = await this.calculateTotalMileageFromLogs(vehicleId, userId, taxYear);
      
      // Check if logs cover the full year
      if (totalAnnualMileage !== null && yearLogs.length > 0) {
        const firstLogDate = sortedLogs[0].date;
        const lastLogDate = sortedLogs[sortedLogs.length - 1].date;
        // Consider it complete if logs span most of the year
        hasCompleteYearData = firstLogDate <= `${taxYear}-02-28` && lastLogDate >= `${taxYear}-11-01`;
      }
    }
    
    // Last resort: legacy totalAnnualMileage field (backward compatibility)
    if (totalAnnualMileage === null && vehicle.totalAnnualMileage) {
      totalAnnualMileage = parseFloat(vehicle.totalAnnualMileage.toString());
      hasCompleteYearData = true; // Assume legacy field represents complete year
    }

    // If we don't have complete year data but have business mileage logs and estimated yearly mileage,
    // use estimated mileage to calculate percentage proportionally
    if (!hasCompleteYearData && businessMileage > 0 && yearLogs.length > 0 && vehicle.estimatedYearlyMileage) {
      const estimatedYearlyMileage = parseFloat(vehicle.estimatedYearlyMileage.toString());
      
      if (estimatedYearlyMileage > 0) {
        // Calculate the date range of available logs
        const firstLogDate = new Date(sortedLogs[0].date);
        const lastLogDate = new Date(sortedLogs[sortedLogs.length - 1].date);
        
        // Use current date if we're still in the tax year, otherwise use year end
        const currentDate = new Date();
        const yearEndDate = new Date(`${taxYear}-12-31`);
        const periodEndDate = currentDate < yearEndDate ? currentDate : yearEndDate;
        
        // Calculate days elapsed from start of year to period end
        const yearStartDate = new Date(`${taxYear}-01-01`);
        const daysElapsed = Math.max(1, Math.ceil((periodEndDate.getTime() - yearStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        // Calculate estimated mileage for the period
        const estimatedMileageForPeriod = estimatedYearlyMileage * (daysElapsed / 365);
        
        if (estimatedMileageForPeriod > 0) {
          return (businessMileage / estimatedMileageForPeriod) * 100;
        }
      }
    }

    // If odometer method with interpolation enabled, we need to account for personal use between business logs
    // The total mileage from photos/logs includes both business and personal
    // Interpolation helps identify personal use periods between business logs
    if (isOdometerStyle && enableInterpolation) {
      // For interpolation, we calculate total as: business mileage + interpolated personal mileage
      // Interpolated personal = total from photos/logs - business mileage
      // This assumes any mileage not logged as business is personal
      if (totalAnnualMileage !== null) {
        const interpolatedPersonalMileage = Math.max(0, totalAnnualMileage - businessMileage);
        // The total is already correct from photos/logs, so we just use it as is
        // The interpolation is implicit - any mileage not in business logs is personal
      }
    }

    if (!totalAnnualMileage || totalAnnualMileage === 0) {
      // If no total mileage but we have estimated mileage and business logs, use estimated
      if (businessMileage > 0 && vehicle.estimatedYearlyMileage) {
        const estimatedYearlyMileage = parseFloat(vehicle.estimatedYearlyMileage.toString());
        if (estimatedYearlyMileage > 0) {
          // Use estimated yearly mileage as total
          return (businessMileage / estimatedYearlyMileage) * 100;
        }
      }
      return 100; // Default to 100% if no total mileage available
    }

    return (businessMileage / totalAnnualMileage) * 100;
  }

  async getVehicleMileageLogById(id: string): Promise<VehicleMileageLog | undefined> {
    const [record] = await db.select().from(vehicleMileageLogs).where(eq(vehicleMileageLogs.id, id));
    return record || undefined;
  }

  async createVehicleMileageLog(logData: InsertVehicleMileageLog): Promise<VehicleMileageLog> {
    const [record] = await db
      .insert(vehicleMileageLogs)
      .values(logData)
      .returning();
    return record;
  }

  async updateVehicleMileageLog(id: string, logData: Partial<InsertVehicleMileageLog>): Promise<VehicleMileageLog | undefined> {
    const [record] = await db
      .update(vehicleMileageLogs)
      .set({ ...logData, updatedAt: new Date() })
      .where(eq(vehicleMileageLogs.id, id))
      .returning();
    return record || undefined;
  }

  async deleteVehicleMileageLog(id: string): Promise<boolean> {
    const result = await db.delete(vehicleMileageLogs).where(eq(vehicleMileageLogs.id, id)).returning();
    return result.length > 0;
  }

  async getOdometerPhotos(vehicleId: string, userId: string): Promise<OdometerPhoto[]> {
    return await db
      .select()
      .from(odometerPhotos)
      .where(and(eq(odometerPhotos.vehicleId, vehicleId), eq(odometerPhotos.userId, userId)))
      .orderBy(desc(odometerPhotos.photoDate), desc(odometerPhotos.uploadedAt));
  }

  async getOdometerPhotoById(id: string): Promise<OdometerPhoto | undefined> {
    const [record] = await db.select().from(odometerPhotos).where(eq(odometerPhotos.id, id));
    return record || undefined;
  }

  async createOdometerPhoto(photoData: InsertOdometerPhoto): Promise<OdometerPhoto> {
    const [record] = await db
      .insert(odometerPhotos)
      .values(photoData)
      .returning();
    return record;
  }

  async updateOdometerPhoto(id: string, photoData: Partial<InsertOdometerPhoto>): Promise<OdometerPhoto | undefined> {
    const [record] = await db
      .update(odometerPhotos)
      .set(photoData)
      .where(eq(odometerPhotos.id, id))
      .returning();
    return record || undefined;
  }

  async deleteOdometerPhoto(id: string): Promise<boolean> {
    const result = await db.delete(odometerPhotos).where(eq(odometerPhotos.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Calculate total mileage from odometer photos for a given tax year
   * Returns the difference between first and last photo with mileage values
   */
  async calculateTotalMileageFromPhotos(vehicleId: string, userId: string, taxYear: string): Promise<number | null> {
    const photos = await this.getOdometerPhotos(vehicleId, userId);
    
    // Filter photos for the tax year
    const yearStart = `${taxYear}-01-01`;
    const yearEnd = `${taxYear}-12-31`;
    const yearPhotos = photos.filter(photo => {
      const photoDate = photo.photoDate;
      return photoDate >= yearStart && photoDate <= yearEnd && photo.mileage !== null;
    });

    if (yearPhotos.length < 2) {
      return null; // Need at least 2 photos with mileage to calculate
    }

    // Sort by date
    const sortedPhotos = [...yearPhotos].sort((a, b) => a.photoDate.localeCompare(b.photoDate));
    const firstPhoto = sortedPhotos[0];
    const lastPhoto = sortedPhotos[sortedPhotos.length - 1];

    if (!firstPhoto.mileage || !lastPhoto.mileage) {
      return null;
    }

    const firstMileage = parseFloat(firstPhoto.mileage.toString());
    const lastMileage = parseFloat(lastPhoto.mileage.toString());
    
    return Math.max(0, lastMileage - firstMileage);
  }

  /**
   * Calculate total mileage from mileage logs for a given tax year
   * Works for both odometer and trip_distance logging styles
   */
  async calculateTotalMileageFromLogs(vehicleId: string, userId: string, taxYear: string): Promise<number | null> {
    const logs = await this.getVehicleMileageLogs(vehicleId, userId);
    
    // Filter logs for the tax year
    const yearStart = `${taxYear}-01-01`;
    const yearEnd = `${taxYear}-12-31`;
    const yearLogs = logs.filter(log => {
      const logDate = log.date;
      return logDate >= yearStart && logDate <= yearEnd;
    });

    if (yearLogs.length === 0) {
      return null;
    }

    // Sort by date
    const sortedLogs = [...yearLogs].sort((a, b) => a.date.localeCompare(b.date));
    
    // For odometer method: calculate from first to last reading
    // For trip_distance method: sum all distances between consecutive readings
    // Both methods store cumulative odometer readings, so we can use the same logic
    const firstReading = parseFloat(sortedLogs[0].odometerReading.toString());
    const lastReading = parseFloat(sortedLogs[sortedLogs.length - 1].odometerReading.toString());
    
    return Math.max(0, lastReading - firstReading);
  }

  async updateExpenseCategory(userId: string, oldCategory: string, newCategory: string): Promise<number> {
    const result = await db
      .update(expenses)
      .set({ category: newCategory })
      .where(and(eq(expenses.userId, userId), eq(expenses.category, oldCategory)))
      .returning({ id: expenses.id });
    
    return result.length;
  }

  // Assets
  async getAssets(userId: string): Promise<Asset[]> {
    return await db
      .select()
      .from(assets)
      .where(eq(assets.userId, userId))
      .orderBy(desc(assets.createdAt));
  }

  async getAssetById(id: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset || undefined;
  }

  async createAsset(assetData: InsertAsset): Promise<Asset> {
    const [record] = await db.insert(assets).values(assetData).returning();
    return record;
  }

  async updateAsset(id: string, assetData: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [record] = await db
      .update(assets)
      .set(assetData)
      .where(eq(assets.id, id))
      .returning();
    return record || undefined;
  }

  async deleteAsset(id: string): Promise<boolean> {
    const result = await db.delete(assets).where(eq(assets.id, id)).returning();
    return result.length > 0;
  }

  // Asset CCA History
  async getAssetCcaHistory(assetId: string, userId: string): Promise<AssetCcaHistory[]> {
    return await db
      .select()
      .from(assetCcaHistory)
      .where(and(eq(assetCcaHistory.assetId, assetId), eq(assetCcaHistory.userId, userId)))
      .orderBy(asc(assetCcaHistory.taxYear));
  }

  async getAssetCcaHistoryById(id: string): Promise<AssetCcaHistory | undefined> {
    const [history] = await db.select().from(assetCcaHistory).where(eq(assetCcaHistory.id, id));
    return history || undefined;
  }

  async createAssetCcaHistory(historyData: InsertAssetCcaHistory): Promise<AssetCcaHistory> {
    const [record] = await db.insert(assetCcaHistory).values(historyData).returning();
    return record;
  }

  async updateAssetCcaHistory(id: string, historyData: Partial<InsertAssetCcaHistory>): Promise<AssetCcaHistory | undefined> {
    const [record] = await db
      .update(assetCcaHistory)
      .set(historyData)
      .where(eq(assetCcaHistory.id, id))
      .returning();
    return record || undefined;
  }

  async deleteAssetCcaHistory(id: string): Promise<boolean> {
    const result = await db.delete(assetCcaHistory).where(eq(assetCcaHistory.id, id)).returning();
    return result.length > 0;
  }

  async calculateCCASummary(userId: string, taxYear: string): Promise<{
    totalCCA: number;
    ccaByClass: Map<string, number>;
  }> {
    const userAssets = await this.getAssets(userId);
    const assetHistoriesMap = new Map<string, AssetCcaHistory[]>();

    // Get all CCA histories for user's assets
    for (const asset of userAssets) {
      const histories = await this.getAssetCcaHistory(asset.id, userId);
      assetHistoriesMap.set(asset.id, histories);
    }

    const ccaByClass = calculateCCAByClass(userAssets, assetHistoriesMap, taxYear);
    const ccaByClassTotals = new Map<string, number>();

    let totalCCA = 0;
    const ccaEntries = Array.from(ccaByClass.entries());
    for (const [ccaClass, calculations] of ccaEntries) {
      const classTotal = calculateTotalCCAByClass(calculations);
      ccaByClassTotals.set(ccaClass, classTotal);
      totalCCA += classTotal;
    }

    return {
      totalCCA,
      ccaByClass: ccaByClassTotals,
    };
  }

  // Lease Contracts
  async getLeaseContracts(userId: string): Promise<LeaseContract[]> {
    return await db
      .select()
      .from(leaseContracts)
      .where(eq(leaseContracts.userId, userId))
      .orderBy(desc(leaseContracts.createdAt));
  }

  async getLeaseContractById(id: string): Promise<LeaseContract | undefined> {
    const [contract] = await db.select().from(leaseContracts).where(eq(leaseContracts.id, id));
    return contract || undefined;
  }

  async createLeaseContract(contractData: InsertLeaseContract): Promise<LeaseContract> {
    const [record] = await db.insert(leaseContracts).values(contractData).returning();
    return record;
  }

  async updateLeaseContract(id: string, contractData: Partial<InsertLeaseContract>): Promise<LeaseContract | undefined> {
    const [record] = await db
      .update(leaseContracts)
      .set(contractData)
      .where(eq(leaseContracts.id, id))
      .returning();
    return record || undefined;
  }

  async deleteLeaseContract(id: string): Promise<boolean> {
    const result = await db.delete(leaseContracts).where(eq(leaseContracts.id, id)).returning();
    return result.length > 0;
  }

  // Lease Payments
  async getLeasePayments(leaseContractId: string, userId: string): Promise<LeasePayment[]> {
    return await db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.leaseContractId, leaseContractId), eq(leasePayments.userId, userId)))
      .orderBy(desc(leasePayments.paymentDate));
  }

  async getLeasePaymentById(id: string): Promise<LeasePayment | undefined> {
    const [payment] = await db.select().from(leasePayments).where(eq(leasePayments.id, id));
    return payment || undefined;
  }

  async createLeasePayment(paymentData: InsertLeasePayment): Promise<LeasePayment> {
    const [record] = await db.insert(leasePayments).values(paymentData).returning();
    return record;
  }

  async updateLeasePayment(id: string, paymentData: Partial<InsertLeasePayment>): Promise<LeasePayment | undefined> {
    const [record] = await db
      .update(leasePayments)
      .set(paymentData)
      .where(eq(leasePayments.id, id))
      .returning();
    return record || undefined;
  }

  async deleteLeasePayment(id: string): Promise<boolean> {
    const result = await db.delete(leasePayments).where(eq(leasePayments.id, id)).returning();
    return result.length > 0;
  }

  async calculateLeaseExpenseSummary(userId: string, taxYear: string): Promise<{
    totalLeaseExpense: number;
    totalGst: number;
    totalPst: number;
  }> {
    const contracts = await this.getLeaseContracts(userId);
    const paymentsByContract = new Map<string, LeasePayment[]>();

    // Get all payments for user's contracts
    for (const contract of contracts) {
      const payments = await this.getLeasePayments(contract.id, userId);
      paymentsByContract.set(contract.id, payments);
    }

    const summary = calculateTotalLeaseExpenses(contracts, paymentsByContract, taxYear);

    return {
      totalLeaseExpense: summary.totalDeductible,
      totalGst: summary.totalGst,
      totalPst: summary.totalPst,
    };
  }

  async calculateT2125Summary(userId: string, taxYear: string): Promise<{
    taxYear: string;
    grossRevenue: number;
    expensesByCategory: Record<string, number>;
    totalExpenses: number;
    ccaDeduction: number;
    leaseExpenseDeduction: number;
    netIncome: number;
  }> {
    const incomeRecords = await this.getIncome(userId);
    const expenseRecords = await this.getExpenses(userId);
    const user = await this.getUser(userId);
    
    // Calculate gross revenue from income
    const grossRevenue = incomeRecords.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    
    // Aggregate expenses by category
    const expensesByCategory: Record<string, number> = {};
    
    expenseRecords
      .filter((e) => e.isTaxDeductible)
      .forEach((e) => {
        const baseCost = e.baseCost ? parseFloat(e.baseCost.toString()) : 0;
        const pstAmount = e.pstAmount ? parseFloat(e.pstAmount.toString()) : 0;
        let deductibleAmount = baseCost + pstAmount;
        
        // Apply home office percentage for home office expenses
        if (e.category === "home_office_expenses" && user?.homeOfficePercentage) {
          const percentage = parseFloat(user.homeOfficePercentage.toString()) / 100;
          deductibleAmount = deductibleAmount * percentage;
        } else if (e.category === "meals_entertainment") {
          // CRA limits most meals & entertainment to 50%
          deductibleAmount = deductibleAmount * 0.50;
        } else {
          // For non-home-office expenses, use the total amount if baseCost/pstAmount not available
          if (baseCost === 0 && pstAmount === 0) {
            deductibleAmount = parseFloat(e.amount);
          }
        }
        
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + deductibleAmount;
      });
    
    const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
    
    // Get CCA and lease deductions
    const ccaSummary = await this.calculateCCASummary(userId, taxYear);
    const ccaDeduction = ccaSummary.totalCCA;
    
    const leaseSummary = await this.calculateLeaseExpenseSummary(userId, taxYear);
    const leaseExpenseDeduction = leaseSummary.totalLeaseExpense;
    
    const netIncome = Math.max(0, grossRevenue - totalExpenses - ccaDeduction - leaseExpenseDeduction);
    
    return {
      taxYear,
      grossRevenue,
      expensesByCategory,
      totalExpenses,
      ccaDeduction,
      leaseExpenseDeduction,
      netIncome,
    };
  }

  // Get provincial bracket breakdown for display
  getProvincialBracketBreakdown(income: number, province: string): Array<{ bracket: string; rate: number; tax: number }> {
    // Use the same brackets structure from calculateProvincialTax
    const provincialBrackets: Record<string, Array<{ limit: number; rate: number }>> = {
      AB: [
        { limit: 60000, rate: 0.08 },
        { limit: 151234, rate: 0.10 },
        { limit: 181481, rate: 0.12 },
        { limit: 241974, rate: 0.13 },
        { limit: 362961, rate: 0.14 },
        { limit: Infinity, rate: 0.15 },
      ],
      BC: [
        { limit: 49279, rate: 0.0506 },
        { limit: 98560, rate: 0.077 },
        { limit: 113158, rate: 0.105 },
        { limit: 137407, rate: 0.1229 },
        { limit: 186306, rate: 0.147 },
        { limit: 259829, rate: 0.168 },
        { limit: Infinity, rate: 0.205 },
      ],
      MB: [
        { limit: 47000, rate: 0.108 },
        { limit: 100000, rate: 0.1275 },
        { limit: Infinity, rate: 0.174 },
      ],
      NB: [
        { limit: 51306, rate: 0.094 },
        { limit: 102614, rate: 0.14 },
        { limit: 190060, rate: 0.16 },
        { limit: Infinity, rate: 0.195 },
      ],
      NL: [
        { limit: 44192, rate: 0.087 },
        { limit: 88382, rate: 0.145 },
        { limit: 157792, rate: 0.158 },
        { limit: 220910, rate: 0.178 },
        { limit: 282214, rate: 0.198 },
        { limit: 564429, rate: 0.208 },
        { limit: 1128858, rate: 0.213 },
        { limit: Infinity, rate: 0.218 },
      ],
      NS: [
        { limit: 30507, rate: 0.0879 },
        { limit: 61015, rate: 0.1495 },
        { limit: 95883, rate: 0.1667 },
        { limit: 154650, rate: 0.175 },
        { limit: Infinity, rate: 0.21 },
      ],
      NT: [
        { limit: 51964, rate: 0.059 },
        { limit: 103930, rate: 0.086 },
        { limit: 168967, rate: 0.122 },
        { limit: Infinity, rate: 0.1405 },
      ],
      NU: [
        { limit: 54707, rate: 0.04 },
        { limit: 109413, rate: 0.07 },
        { limit: 177885, rate: 0.09 },
        { limit: Infinity, rate: 0.115 },
      ],
      ON: [
        { limit: 52886, rate: 0.0505 },
        { limit: 105775, rate: 0.0915 },
        { limit: 150000, rate: 0.1116 },
        { limit: 220000, rate: 0.1216 },
        { limit: Infinity, rate: 0.1316 },
      ],
      PE: [
        { limit: 33328, rate: 0.095 },
        { limit: 64656, rate: 0.1347 },
        { limit: 105000, rate: 0.166 },
        { limit: 140000, rate: 0.1762 },
        { limit: Infinity, rate: 0.19 },
      ],
      QC: [
        { limit: 53255, rate: 0.14 },
        { limit: 106495, rate: 0.19 },
        { limit: 129590, rate: 0.24 },
        { limit: Infinity, rate: 0.2575 },
      ],
      SK: [
        { limit: 53463, rate: 0.105 },
        { limit: 152750, rate: 0.125 },
        { limit: Infinity, rate: 0.145 },
      ],
      YT: [
        { limit: 57375, rate: 0.064 },
        { limit: 114750, rate: 0.09 },
        { limit: 177882, rate: 0.109 },
        { limit: 500000, rate: 0.128 },
        { limit: Infinity, rate: 0.15 },
      ],
    };

    const brackets = provincialBrackets[province] || provincialBrackets.BC;
    const breakdown: Array<{ bracket: string; rate: number; tax: number }> = [];
    
    let prevLimit = 0;
    let remaining = income;

    // Always show ALL brackets for the province
    for (let i = 0; i < brackets.length; i++) {
      const bracket = brackets[i];
      
      // Calculate how much income falls in this bracket (0 if income hasn't reached it)
      const bracketSize = bracket.limit === Infinity 
        ? Math.max(0, remaining) 
        : Math.min(Math.max(0, remaining), bracket.limit - prevLimit);
      
      const taxInBracket = bracketSize * bracket.rate;
      
      const bracketLabel = bracket.limit === Infinity 
        ? `$${prevLimit.toLocaleString()}+`
        : `$${prevLimit.toLocaleString()} - $${bracket.limit.toLocaleString()}`;
      
      breakdown.push({
        bracket: bracketLabel,
        rate: bracket.rate * 100, // Convert to percentage for display
        tax: taxInBracket,
      });
      
      remaining -= bracketSize;
      prevLimit = bracket.limit;
    }

    return breakdown;
  }
}

export const storage = new DatabaseStorage();
