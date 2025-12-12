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
} from "@shared/schema";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private incomeRecords: Map<string, Income>;
  private expenses: Map<string, Expense>;
  private receipts: Map<string, Receipt>;

  constructor() {
    this.users = new Map();
    this.incomeRecords = new Map();
    this.expenses = new Map();
    this.receipts = new Map();

    this.initDemoData();
  }

  private initDemoData() {
    const demoUser: User = {
      id: "demo-user",
      username: "demo",
      password: "demo",
      displayName: "Alex Morgan",
      email: "alex@example.com",
      taxFilingStatus: "personal_only",
      province: "ON",
      subscriptionTier: "personal",
    };
    this.users.set(demoUser.id, demoUser);

    const incomeData: InsertIncome[] = [
      { userId: "demo-user", amount: "15000", date: "2024-01-15", incomeType: "wages", productionName: "The Crown Season 7", description: "Lead grip work" },
      { userId: "demo-user", amount: "8500", date: "2024-02-20", incomeType: "wages", productionName: "Suits Reboot", description: "Key grip" },
      { userId: "demo-user", amount: "2500", date: "2024-03-10", incomeType: "per_diem", productionName: "The Crown Season 7", description: "Travel days" },
      { userId: "demo-user", amount: "12000", date: "2024-04-05", incomeType: "wages", productionName: "Stranger Things Season 6", description: "Best boy grip" },
      { userId: "demo-user", amount: "1800", date: "2024-05-15", incomeType: "residuals", productionName: "Previous productions", description: "Q1 residuals" },
      { userId: "demo-user", amount: "9500", date: "2024-06-01", incomeType: "wages", productionName: "Wednesday Season 2", description: "Grip crew" },
      { userId: "demo-user", amount: "3200", date: "2024-07-20", incomeType: "per_diem", productionName: "Stranger Things Season 6", description: "Location shoot" },
      { userId: "demo-user", amount: "11000", date: "2024-08-10", incomeType: "wages", productionName: "Bridgerton Season 4", description: "Rigging grip" },
      { userId: "demo-user", amount: "7500", date: "2024-09-05", incomeType: "wages", productionName: "House of the Dragon", description: "Day call" },
      { userId: "demo-user", amount: "14000", date: "2024-10-15", incomeType: "wages", productionName: "The Witcher Season 4", description: "Lead grip" },
      { userId: "demo-user", amount: "2200", date: "2024-11-01", incomeType: "residuals", productionName: "Various", description: "Q3 residuals" },
      { userId: "demo-user", amount: "6000", date: "2024-12-01", incomeType: "wages", productionName: "Holiday Special", description: "Short film work" },
    ];

    incomeData.forEach((income) => {
      const id = randomUUID();
      this.incomeRecords.set(id, { ...income, id });
    });

    const expenseData: InsertExpense[] = [
      { userId: "demo-user", amount: "1200", date: "2024-01-10", category: "equipment", vendor: "Film Gear Rental", description: "Personal grip kit maintenance", isTaxDeductible: true },
      { userId: "demo-user", amount: "450", date: "2024-02-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
      { userId: "demo-user", amount: "320", date: "2024-03-05", category: "travel", vendor: "Air Canada", description: "Flight to set location", isTaxDeductible: true },
      { userId: "demo-user", amount: "180", date: "2024-04-20", category: "meals", vendor: "Various", description: "On-set meals during hiatus", isTaxDeductible: true },
      { userId: "demo-user", amount: "800", date: "2024-05-10", category: "training", vendor: "Film Skills Academy", description: "Safety certification renewal", isTaxDeductible: true },
      { userId: "demo-user", amount: "450", date: "2024-06-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
      { userId: "demo-user", amount: "2500", date: "2024-07-01", category: "equipment", vendor: "B&H Photo", description: "New rigging equipment", isTaxDeductible: true },
      { userId: "demo-user", amount: "150", date: "2024-08-20", category: "phone_internet", vendor: "Rogers", description: "Mobile plan - business portion", isTaxDeductible: true },
      { userId: "demo-user", amount: "600", date: "2024-09-10", category: "agent_fees", vendor: "Talent Agency", description: "Commission on recent jobs", isTaxDeductible: true },
      { userId: "demo-user", amount: "450", date: "2024-10-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
      { userId: "demo-user", amount: "280", date: "2024-11-05", category: "wardrobe", vendor: "Work Wear Store", description: "Steel-toe boots replacement", isTaxDeductible: true },
      { userId: "demo-user", amount: "350", date: "2024-12-01", category: "professional_services", vendor: "Tax Prep Inc", description: "Accountant retainer", isTaxDeductible: true },
    ];

    expenseData.forEach((expense) => {
      const id = randomUUID();
      this.expenses.set(id, { ...expense, id });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async getIncome(userId: string): Promise<Income[]> {
    return Array.from(this.incomeRecords.values())
      .filter((income) => income.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getIncomeById(id: string): Promise<Income | undefined> {
    return this.incomeRecords.get(id);
  }

  async createIncome(income: InsertIncome): Promise<Income> {
    const id = randomUUID();
    const record: Income = { ...income, id };
    this.incomeRecords.set(id, record);
    return record;
  }

  async deleteIncome(id: string): Promise<boolean> {
    return this.incomeRecords.delete(id);
  }

  async getExpenses(userId: string): Promise<Expense[]> {
    return Array.from(this.expenses.values())
      .filter((expense) => expense.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getExpenseById(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const record: Expense = { ...expense, id };
    this.expenses.set(id, record);
    return record;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }

  async getReceipts(userId: string): Promise<Receipt[]> {
    return Array.from(this.receipts.values())
      .filter((receipt) => receipt.userId === userId)
      .sort((a, b) => {
        const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return dateB - dateA;
      });
  }

  async getReceiptById(id: string): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    const record: Receipt = { ...receipt, id, uploadedAt: new Date() };
    this.receipts.set(id, record);
    return record;
  }

  async deleteReceipt(id: string): Promise<boolean> {
    return this.receipts.delete(id);
  }

  async calculateTax(userId: string): Promise<TaxCalculation> {
    const income = await this.getIncome(userId);
    const expenses = await this.getExpenses(userId);
    const user = await this.getUser(userId);

    const grossIncome = income.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    const totalExpenses = expenses
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
}

export const storage = new MemStorage();
