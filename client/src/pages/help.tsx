import { useState, useMemo } from "react";
import { Search, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HelpSection {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: `Welcome to CrewBooks! This app helps film and TV professionals manage their finances and taxes.

**Tax Year Selection**: Use the dropdown in the sidebar header to select which tax year you want to view. All data (income, expenses, etc.) will be filtered to show only entries for the selected year.

**Navigation**: Use the sidebar on the left to navigate between different sections of the app. The sidebar is organized into:
- Overview: Dashboard, Income, Expenses, Receipts, Vehicle Mileage
- Assets: Assets and Leases
- Tax Tools: Various tax-related features (availability depends on your subscription tier)
- Settings: Profile, Expense Settings, Vehicle Management, Subscription

**Dashboard**: The main dashboard provides an overview of your financial data for the selected tax year, including total income, expenses, deductible amounts, and tax estimates.`,
    keywords: ["getting started", "welcome", "navigation", "tax year", "sidebar", "dashboard", "overview", "basics"],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: `The Dashboard gives you an at-a-glance view for the selected tax year.

**Summary Cards**:
- **Total Income**: All income recorded for the year (year-to-date)
- **Deductible Expenses**: Tax-deductible portion of your expenses based on expense type and rules (e.g., vehicle business use, home office)
- **Net Business Income**: Total income minus deductible expenses

**Charts**:
- **Income vs. Expenses (Monthly)**: Area chart showing monthly totals of income and expenses for the year
- **Business Expenses by Category**: Pie chart showing distribution of business expenses by category with a legend of top categories

All numbers reflect the currently selected tax year. As you add or modify income and expenses, the dashboard updates automatically.`,
    keywords: ["dashboard", "overview", "metrics", "charts", "income", "expenses", "tax breakdown", "statistics"],
  },
  {
    id: "income-management",
    title: "Income Management",
    content: `Track all your income sources in the Income section.

**Adding Income**:
1. Click the "Add Income" button
2. Select whether you would like to upload a paystub to have the information autofilled, or if you would like to manually enter the information.
If uploading a paystub: Select the photo or PDF of the paystub you wish to add. Ensure "Scan with OCR" is selected and hit upload. The information sould automatically populate the new income dialog box. IT IS IMPORTANT TO DOUBLE CHECK THE UPLOAD IS CORRECT.
3. Select/Verify the type of income you are adding (Film and TV Income, Regular Employment Income, or Other Income)
4. Select/Verify the Show Type and the Issuer - This is important for Film Income. Cast and Crew Service and Entertainment Partners handle their Income Records differently.
5. Enter/Verify the Show Name and Date. These items help you filter/organize your income entries.
6. Enter/Verify the Gross Pay, GST (if collected), Deductions, and Net Pay
*Optional : Enter/Verify the Deduction details, if you wish to track your benefits.
7. Click "Save" to add the entry

**Editing Income**: Click the edit icon next to any income entry to modify it.

**Deleting Income**: Click the delete icon to remove an income entry. This action cannot be undone.

**Paystubs**: The Paystubs section allows you to upload and track paystub documents. This helps you keep organized records of your income sources.

**Filtering**: Use the search bar to filter income entries by description or amount.`,
    keywords: ["income", "wages", "residuals", "per diem", "buyouts", "royalties", "paystubs", "add income", "edit income"],
  },
  {
    id: "expense-management",
    title: "Expense Management",
    content: `Manage all your business and personal expenses in the Expenses section.

**Adding Expenses**:
1. Click "Add Expense"
2. Select the expense type:
   - **Self-Employment**: Fully deductible business expenses
   - **Vehicle**: Vehicle-related expenses (requires vehicle selection and uses business use percentage)
   - **Mixed**: Expenses with both business and personal use (requires business use percentage)
   - **Personal**: Non-deductible personal expenses
   - **Home Office/Living**: Home office expenses (uses home office percentage from profile)
3. Select the category appropriate for your expense
4. Enter the date, base cost, GST amount (if applicable), PST amount (if applicable), and description
5. For vehicle expenses, select the vehicle from the dropdown
6. For mixed expenses, enter the business use percentage
7. Toggle "Tax Deductible" if the expense is deductible
8. Click "Save"

**Expense Categories**: Categories are organized by expense type. Common categories include Equipment, Union Dues, Agent Fees, Wardrobe, Travel, Meals, and many more.

**Editing Expenses**: Click the edit icon to modify an expense entry.

**Deleting Expenses**: Click the delete icon to remove an expense. This cannot be undone.

**Receipts**: Link receipts to expenses by uploading photos in the Receipts section. Receipts can be attached to specific expense entries for tax documentation.

**Filtering**: Use the search bar and filters to find specific expenses by category, type, date range, or description.`,
    keywords: ["expenses", "expense types", "self-employment", "vehicle expenses", "mixed expenses", "personal expenses", "home office", "categories", "receipts", "deductible", "GST", "PST"],
  },
  {
    id: "vehicle-mileage",
    title: "Vehicle Mileage",
    content: `Track vehicle usage and calculate business use percentages for vehicle expense deductions.

**Adding Odometer Readings**:
1. Select a vehicle from the dropdown
2. Enter the date and odometer reading
3. Add a description (optional)
4. Click "Add Reading"

**Business Use Percentage**: The app automatically calculates the business use percentage for each vehicle based on odometer readings. This percentage is used to determine the deductible portion of vehicle expenses.

**Viewing History**: See all odometer readings for a vehicle, sorted by date. This helps you track vehicle usage over time.

**Vehicle Management**: Add and manage vehicles in the Settings > Manage Vehicles section. Each vehicle needs a name and optional details.

**Expense Deduction**: When you add a vehicle expense, select the vehicle and the app will use the calculated business use percentage to determine the deductible amount.`,
    keywords: ["vehicle", "mileage", "odometer", "business use percentage", "vehicle expenses", "deduction", "tracking"],
  },
  {
    id: "assets",
    title: "Assets",
    content: `Track business assets such as equipment, vehicles, and other capital assets.

**Adding Assets**:
1. Click "Add Asset"
2. Enter asset details including name, purchase date, cost, and description
3. Select the asset category
4. Save the asset

**Asset Categories**: Common categories include Equipment, Vehicles, Furniture, Software, and more.

**Depreciation**: Track depreciation information for assets that depreciate over time.

**Editing Assets**: Click the edit icon to modify asset details.

**Deleting Assets**: Remove assets that are no longer owned or relevant.`,
    keywords: ["assets", "equipment", "capital assets", "depreciation", "business assets"],
  },
  {
    id: "leases",
    title: "Leases",
    content: `Track lease agreements for equipment, vehicles, or office space.

**Adding Leases**:
1. Click "Add Lease"
2. Enter lease details including lessor name, start date, end date, monthly payment, and description
3. Save the lease

**Lease Management**: View all active and expired leases. Edit or delete leases as needed.

**Lease Payments**: Track monthly lease payments as expenses in the Expenses section, linking them to the lease if desired.`,
    keywords: ["leases", "lease agreements", "equipment lease", "vehicle lease", "office lease", "lease payments"],
  },
  {
    id: "tax-estimator",
    title: "Tax Estimator",
    content: `Estimate your tax obligations using the Tax Estimator tool (available for Personal and Corporate subscription tiers).

**Using the Tax Estimator**:
1. The estimator uses your income and expense data for the selected tax year
2. It calculates federal tax, provincial tax, and CPP contributions based on current tax brackets
3. Results show estimated tax owed or refund expected
4. The estimate updates automatically as you add or modify income and expenses

**Tax Brackets**: The calculator uses current Canadian federal and provincial tax brackets. Provincial tax is calculated based on your profile province setting.

**CPP Contributions**: Self-employed individuals must pay both employer and employee portions of CPP, which is reflected in the calculations.

**Note**: These are estimates only. Consult with a tax professional for actual tax filing.`,
    keywords: ["tax estimator", "tax calculator", "tax calculation", "federal tax", "provincial tax", "CPP", "tax brackets", "estimate"],
  },
  {
    id: "t2-filing",
    title: "T2 Filing (Corporate)",
    content: `Complete a T2 Corporate Tax Return questionnaire (available for Corporate subscription tier only).

**T2 Filing Process**:
1. Navigate to Tax Tools > T2 Filing
2. Complete the multi-step questionnaire about your corporation
3. The questionnaire covers:
   - Corporate information
   - Income details
   - Expenses and deductions
   - Capital cost allowance
   - Other corporate tax items
4. Save your progress at any time
5. Review and submit when complete

**Resume Progress**: You can save your progress and return to complete the questionnaire later. Your answers are saved automatically.

**Corporate Tax**: This tool helps you prepare information needed for filing a T2 corporate tax return. Consult with a tax professional for actual filing.`,
    keywords: ["T2", "corporate tax", "T2 filing", "corporation", "corporate return", "questionnaire"],
  },
  {
    id: "optimization",
    title: "Optimization (Dividend vs Salary)",
    content: `Optimize your corporate income structure by comparing dividend vs salary strategies (available for Corporate tier only).

**Using Optimization**:
1. Navigate to Tax Tools > Optimization
2. Enter your corporate income amount
3. The tool calculates tax implications for:
   - Taking income as salary
   - Taking income as dividends
   - A combination of both
4. Compare effective tax rates and after-tax income for each strategy
5. Adjust the salary/dividend split to find the optimal balance

**Factors Considered**:
- Personal tax brackets
- Corporate tax rates
- CPP contributions (required for salary, not for dividends)
- Dividend tax credits
- Overall tax efficiency

**Note**: This is a planning tool. Consult with a tax professional before making decisions about salary vs dividend strategies.`,
    keywords: ["optimization", "dividend", "salary", "corporate", "income splitting", "tax optimization", "dividend vs salary"],
  },
  {
    id: "gst-hst",
    title: "GST/HST Tracking",
    content: `Track GST/HST collected and paid if you have a GST/HST number (available when you have a GST number registered in your profile).

**GST/HST Overview**:
- **GST/HST Collected**: Tax collected on income (if applicable)
- **GST/HST Paid**: Tax paid on expenses (input tax credits)
- **Net GST/HST**: The difference (amount to remit or refund)

**Using GST/HST Tracking**:
1. Ensure your profile has a GST/HST number registered
2. When adding expenses, enter the GST amount paid
3. The app tracks GST/HST paid on all eligible expenses
4. View your GST/HST summary in the GST/HST section
5. Use this information when filing GST/HST returns

**Input Tax Credits**: GST/HST paid on business expenses can be claimed as input tax credits, reducing your GST/HST remittance.

**Filing**: Use the summary information when preparing your GST/HST return with the CRA.`,
    keywords: ["GST", "HST", "GST/HST", "input tax credits", "GST remittance", "tax credits", "GST number"],
  },
  {
    id: "profile-settings",
    title: "Profile Settings",
    content: `Manage your personal information and account settings.

**Profile Information**:
- Update your name, email, and contact information
- Upload a profile picture
- Set your province (affects provincial tax calculations)
- Set your home office percentage (used for home office/living expense deductions)

**Home Office Percentage**: This percentage is applied to home office/living expenses to calculate the deductible portion. For example, if your home office is 20% of your home, enter 20%.

**GST/HST Number**: If you have a GST/HST number, enter it here to enable GST/HST tracking features.

**Subscription Tier**: View your current subscription tier (Basic, Personal, or Corporate) and upgrade if needed.`,
    keywords: ["profile", "settings", "personal information", "home office percentage", "GST number", "subscription", "account"],
  },
  {
    id: "expense-settings",
    title: "Expense Settings",
    content: `Configure default expense categories and settings.

**Category Management**:
- View all available expense categories
- Add custom categories if needed
- Organize categories by expense type

**Default Settings**:
- Set default expense types for common scenarios
- Configure default tax rates if applicable

**Category Organization**: Categories are organized by expense type to make it easier to find the right category when adding expenses.`,
    keywords: ["expense settings", "categories", "custom categories", "expense configuration", "default settings"],
  },
  {
    id: "vehicle-management",
    title: "Vehicle Management",
    content: `Add and manage vehicles used for business purposes.

**Adding Vehicles**:
1. Navigate to Settings > Manage Vehicles
2. Click "Add Vehicle"
3. Enter vehicle details:
   - Vehicle name/description
   - Year, make, model (optional)
   - License plate (optional)
4. Save the vehicle

**Editing Vehicles**: Click the edit icon to modify vehicle information.

**Deleting Vehicles**: Remove vehicles that are no longer in use. Note: This will not delete associated expenses or odometer readings.

**Business Use Tracking**: Once vehicles are added, you can track odometer readings in the Vehicle Mileage section. The app calculates business use percentage based on these readings.`,
    keywords: ["vehicles", "vehicle management", "add vehicle", "edit vehicle", "business vehicles"],
  },
  {
    id: "subscription",
    title: "Subscription Management",
    content: `Manage your subscription tier and billing.

**Subscription Tiers**:
- **Basic**: Income and expense tracking only
- **Personal**: Includes tax tools (Tax Estimator, Business Summary)
- **Corporate**: Includes all features plus T2 Filing and Optimization tools

**Upgrading**: Navigate to Settings > Subscription to view available tiers and upgrade your subscription.

**Features by Tier**: Different subscription tiers unlock different features. Check the pricing page to see what's included in each tier.

**Billing**: Manage your subscription and billing information in the Subscription section.`,
    keywords: ["subscription", "pricing", "tier", "basic", "personal", "corporate", "upgrade", "billing"],
  },
  {
    id: "receipts",
    title: "Receipt Management",
    content: `Upload and manage receipt photos for tax documentation.

**Uploading Receipts**:
1. Navigate to the Receipts section
2. Click "Upload Receipt" or use the camera icon
3. Take a photo or select an image file
4. The image will be compressed automatically
5. Add a description and link to an expense (optional)
6. Save the receipt

**Linking to Expenses**: You can link receipts to specific expense entries. This helps you keep organized records and makes it easy to find receipts when needed for tax filing.

**Viewing Receipts**: Click on any receipt to view the full image. Receipts are stored securely and can be accessed anytime.

**Deleting Receipts**: Remove receipts that are no longer needed. This action cannot be undone.

**Image Compression**: Receipt images are automatically compressed to save storage space while maintaining readability.`,
    keywords: ["receipts", "upload receipt", "receipt photos", "documentation", "link receipt", "image compression"],
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const handleSearch = () => {
    setActiveSearch(searchQuery.toLowerCase().trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const filteredSections = useMemo(() => {
    if (!activeSearch) {
      return helpSections;
    }

    const query = activeSearch.toLowerCase();
    return helpSections.filter((section) => {
      const titleMatch = section.title.toLowerCase().includes(query);
      const contentMatch = section.content.toLowerCase().includes(query);
      const keywordMatch = section.keywords.some((keyword) =>
        keyword.toLowerCase().includes(query)
      );
      return titleMatch || contentMatch || keywordMatch;
    });
  }, [activeSearch]);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HelpCircle className="h-6 w-6" />
          Help & Documentation
        </h1>
        <p className="text-muted-foreground mt-1">
          Learn how to navigate and use CrewBooks to manage your finances and taxes.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search help topics... (Press Enter to search)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
            {activeSearch && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setActiveSearch("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {activeSearch && (
            <p className="text-sm text-muted-foreground mt-2">
              Found {filteredSections.length} result{filteredSections.length !== 1 ? "s" : ""} for "{activeSearch}"
            </p>
          )}
        </CardContent>
      </Card>

      

      {filteredSections.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No results found. Try a different search term.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{highlightText(section.title, activeSearch)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {section.content.split("\n").map((paragraph, index) => {
                    if (paragraph.trim() === "") return null;
                    if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
                      const boldText = paragraph.slice(2, -2);
                      return (
                        <p key={index} className="font-semibold mt-4 mb-2">
                          {highlightText(boldText, activeSearch)}
                        </p>
                      );
                    }
                    return (
                      <p key={index} className="mb-3 text-sm leading-relaxed">
                        {highlightText(paragraph, activeSearch)}
                      </p>
                    );
                  })}
                </div>
                {section.id === "income-management" && (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <figure className="space-y-2">
                      <img
                        src="/images/paystubs/EP_breakdown.jpg"
                        alt="Entertainment Partners paystub example"
                        className="w-full max-w-full rounded border"
                      />
                      <figcaption className="text-sm text-muted-foreground">
                        Entertainment Partners paystub example
                      </figcaption>
                    </figure>
                    <figure className="space-y-2">
                      <img
                        src="/images/paystubs/CandC_breakdown.png"
                        alt="Cast & Crew paystub example"
                        className="w-full max-w-full rounded border"
                      />
                      <figcaption className="text-sm text-muted-foreground">
                        Cast & Crew paystub example
                      </figcaption>
                    </figure>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
