import { storage } from "./storage";

export async function seedDatabase() {
  try {
    const demoUser = await (storage as any).seedDemoUser();
    const userId = demoUser.id;

    const incomeRecords = await storage.getIncome(userId);
    if (incomeRecords.length === 0) {
      const incomeData = [
        { userId, amount: "15000", date: "2024-01-15", incomeType: "wages", productionName: "The Crown Season 7", description: "Lead grip work" },
        { userId, amount: "8500", date: "2024-02-20", incomeType: "wages", productionName: "Suits Reboot", description: "Key grip" },
        { userId, amount: "2500", date: "2024-03-10", incomeType: "per_diem", productionName: "The Crown Season 7", description: "Travel days" },
        { userId, amount: "12000", date: "2024-04-05", incomeType: "wages", productionName: "Stranger Things Season 6", description: "Best boy grip" },
        { userId, amount: "1800", date: "2024-05-15", incomeType: "residuals", productionName: "Previous productions", description: "Q1 residuals" },
        { userId, amount: "9500", date: "2024-06-01", incomeType: "wages", productionName: "Wednesday Season 2", description: "Grip crew" },
        { userId, amount: "3200", date: "2024-07-20", incomeType: "per_diem", productionName: "Stranger Things Season 6", description: "Location shoot" },
        { userId, amount: "11000", date: "2024-08-10", incomeType: "wages", productionName: "Bridgerton Season 4", description: "Rigging grip" },
        { userId, amount: "7500", date: "2024-09-05", incomeType: "wages", productionName: "House of the Dragon", description: "Day call" },
        { userId, amount: "14000", date: "2024-10-15", incomeType: "wages", productionName: "The Witcher Season 4", description: "Lead grip" },
        { userId, amount: "2200", date: "2024-11-01", incomeType: "residuals", productionName: "Various", description: "Q3 residuals" },
        { userId, amount: "6000", date: "2024-12-01", incomeType: "wages", productionName: "Holiday Special", description: "Short film work" },
      ];

      for (const income of incomeData) {
        await storage.createIncome(income);
      }
      console.log("Seeded income records");
    }

    const expenseRecords = await storage.getExpenses(userId);
    if (expenseRecords.length === 0) {
      const expenseData = [
        { userId, amount: "1200", date: "2024-01-10", category: "equipment", vendor: "Film Gear Rental", description: "Personal grip kit maintenance", isTaxDeductible: true },
        { userId, amount: "450", date: "2024-02-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
        { userId, amount: "320", date: "2024-03-05", category: "travel", vendor: "Air Canada", description: "Flight to set location", isTaxDeductible: true },
        { userId, amount: "180", date: "2024-04-20", category: "meals", vendor: "Various", description: "On-set meals during hiatus", isTaxDeductible: true },
        { userId, amount: "800", date: "2024-05-10", category: "training", vendor: "Film Skills Academy", description: "Safety certification renewal", isTaxDeductible: true },
        { userId, amount: "450", date: "2024-06-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
        { userId, amount: "2500", date: "2024-07-01", category: "equipment", vendor: "B&H Photo", description: "New rigging equipment", isTaxDeductible: true },
        { userId, amount: "150", date: "2024-08-20", category: "phone_internet", vendor: "Rogers", description: "Mobile plan - business portion", isTaxDeductible: true },
        { userId, amount: "600", date: "2024-09-10", category: "agent_fees", vendor: "Talent Agency", description: "Commission on recent jobs", isTaxDeductible: true },
        { userId, amount: "450", date: "2024-10-15", category: "union_dues", vendor: "IATSE Local 873", description: "Quarterly dues", isTaxDeductible: true },
        { userId, amount: "280", date: "2024-11-05", category: "wardrobe", vendor: "Work Wear Store", description: "Steel-toe boots replacement", isTaxDeductible: true },
        { userId, amount: "350", date: "2024-12-01", category: "professional_services", vendor: "Tax Prep Inc", description: "Accountant retainer", isTaxDeductible: true },
      ];

      for (const expense of expenseData) {
        await storage.createExpense(expense);
      }
      console.log("Seeded expense records");
    }

    console.log("Database seeding complete");
    return demoUser;
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
