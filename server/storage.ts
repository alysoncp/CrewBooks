import {
  type User,
  type InsertUser,
  type Income,
  type InsertIncome,
  type Expense,
  type InsertExpense,
  type Receipt,
  type InsertReceipt,
  type TaxCalculation,
  type DividendSalaryScenario,
  users,
  income,
  expenses,
  receipts,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
  deleteReceipt(id: string): Promise<boolean>;

  calculateTax(userId: string): Promise<TaxCalculation>;
  calculateOptimization(userId: string, corporateIncome?: number): Promise<{
    scenarios: DividendSalaryScenario[];
    optimalScenario: DividendSalaryScenario;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
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

  async seedDemoUser(): Promise<User> {
    const existing = await this.getUserByUsername("demo");
    if (existing) return existing;

    return await this.createUser({
      username: "demo",
      password: "demo",
      displayName: "Alex Morgan",
      email: "alex@example.com",
      taxFilingStatus: "personal_only",
      province: "ON",
      subscriptionTier: "personal",
    });
  }
}

export const storage = new DatabaseStorage();
