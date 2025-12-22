import {
  type User,
  type UpsertUser,
  type Income,
  type InsertIncome,
  type Expense,
  type InsertExpense,
  type Receipt,
  type InsertReceipt,
  type TaxCalculation,
  type DividendSalaryScenario,
  type GstHstSummary,
  type TaxQuestionnaire,
  type InsertQuestionnaire,
  type QuestionnaireResponse,
  type InsertQuestionnaireResponse,
  type Vehicle,
  type InsertVehicle,
  users,
  income,
  expenses,
  receipts,
  taxQuestionnaires,
  questionnaireResponses,
  vehicles,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  getIncome(userId: string): Promise<Income[]>;
  getIncomeById(id: string): Promise<Income | undefined>;
  createIncome(income: InsertIncome): Promise<Income>;
  deleteIncome(id: string): Promise<boolean>;

  getExpenses(userId: string): Promise<Expense[]>;
  getExpenseById(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<boolean>;

  getReceipts(userId: string): Promise<Receipt[]>;
  getReceiptById(id: string): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, data: Partial<Receipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: string): Promise<boolean>;

  calculateTax(userId: string): Promise<TaxCalculation>;
  calculateOptimization(userId: string, corporateIncome?: number): Promise<{
    scenarios: DividendSalaryScenario[];
    optimalScenario: DividendSalaryScenario;
  }>;
  calculateGstHst(userId: string): Promise<GstHstSummary>;

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

  updateExpenseCategory(userId: string, oldCategory: string, newCategory: string): Promise<number>;
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

  async calculateTax(userId: string): Promise<TaxCalculation> {
    const incomeRecords = await this.getIncome(userId);
    const expenseRecords = await this.getExpenses(userId);
    const user = await this.getUser(userId);

    const grossIncome = incomeRecords.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpenses = expenseRecords
      .filter((e) => e.isTaxDeductible)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const netIncome = Math.max(0, grossIncome - totalExpenses);

    const federalTax = this.calculateFederalTax(netIncome);
    const provincialTax = this.calculateProvincialTax(netIncome, user?.province || "ON");
    const cppContribution = this.calculateCPP(netIncome);
    const totalIncomeTax = federalTax + provincialTax;
    const totalOwed = totalIncomeTax + cppContribution;
    const effectiveTaxRate = netIncome > 0 ? (totalOwed / netIncome) * 100 : 0;

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

    const basicPersonalAmount = 15705;
    const basicCredit = basicPersonalAmount * 0.15;
    return Math.max(0, tax - basicCredit);
  }

  private calculateProvincialTax(income: number, province: string): number {
    const ontarioBrackets = [
      { limit: 51446, rate: 0.0505 },
      { limit: 102894, rate: 0.0915 },
      { limit: 150000, rate: 0.1116 },
      { limit: 220000, rate: 0.1216 },
      { limit: Infinity, rate: 0.1316 },
    ];

    const brackets = ontarioBrackets;
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

    const basicPersonalAmount = 11865;
    const basicCredit = basicPersonalAmount * 0.0505;
    return Math.max(0, tax - basicCredit);
  }

  private calculateCPP(income: number): number {
    const maxPensionableEarnings = 68500;
    const basicExemption = 3500;
    const rate = 0.119;

    const pensionableEarnings = Math.min(income, maxPensionableEarnings);
    const contributionBase = Math.max(0, pensionableEarnings - basicExemption);
    return contributionBase * rate;
  }

  async calculateOptimization(
    userId: string,
    corporateIncome: number = 100000
  ): Promise<{
    scenarios: DividendSalaryScenario[];
    optimalScenario: DividendSalaryScenario;
  }> {
    const scenarios: DividendSalaryScenario[] = [];
    const splits = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    for (const salaryPercent of splits) {
      const salaryAmount = (corporateIncome * salaryPercent) / 100;
      const dividendAmount = corporateIncome - salaryAmount;

      const corporateTax = this.calculateCorporateTax(dividendAmount);
      const afterCorpTaxDividend = dividendAmount - corporateTax;

      const personalTaxOnSalary = this.calculateFederalTax(salaryAmount) + 
        this.calculateProvincialTax(salaryAmount, "ON");
      const personalTaxOnDividend = this.calculateDividendTax(afterCorpTaxDividend);
      const personalTax = personalTaxOnSalary + personalTaxOnDividend;

      const cppContribution = this.calculateCPP(salaryAmount);

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

  async calculateGstHst(userId: string): Promise<GstHstSummary> {
    const incomeRecords = await this.getIncome(userId);
    const expenseRecords = await this.getExpenses(userId);

    const gstHstCollected = incomeRecords.reduce(
      (sum, i) => sum + (i.gstHstCollected ? parseFloat(i.gstHstCollected) : 0),
      0
    );

    const inputTaxCredits = expenseRecords.reduce(
      (sum, e) => sum + (e.gstHstPaid ? parseFloat(e.gstHstPaid) : 0),
      0
    );

    const transactionsWithGstHst = 
      incomeRecords.filter((i) => i.gstHstCollected && parseFloat(i.gstHstCollected) > 0).length +
      expenseRecords.filter((e) => e.gstHstPaid && parseFloat(e.gstHstPaid) > 0).length;

    return {
      gstHstCollected,
      inputTaxCredits,
      netGstHstOwing: gstHstCollected - inputTaxCredits,
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
    const [record] = await db
      .insert(vehicles)
      .values(vehicleData)
      .returning();
    return record;
  }

  async updateVehicle(id: string, vehicleData: Partial<InsertVehicle>): Promise<Vehicle> {
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

  async updateExpenseCategory(userId: string, oldCategory: string, newCategory: string): Promise<number> {
    const result = await db
      .update(expenses)
      .set({ category: newCategory })
      .where(and(eq(expenses.userId, userId), eq(expenses.category, oldCategory)))
      .returning({ id: expenses.id });
    
    return result.length;
  }
}

export const storage = new DatabaseStorage();
