export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Gets today's date in local timezone as YYYY-MM-DD string.
 * This avoids timezone issues that occur with toISOString().
 */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts the year from a date string (YYYY-MM-DD format).
 * This avoids timezone conversion issues that occur with new Date().getFullYear()
 */
export function getYearFromDateString(dateString: string): number {
  // Dates from the database are in YYYY-MM-DD format
  // Split and take the first part to avoid timezone issues
  const parts = dateString.split('-');
  return parseInt(parts[0], 10);
}

export function formatDate(date: string | Date): string {
  let d: Date;
  if (typeof date === 'string') {
    // Parse date string (YYYY-MM-DD) without timezone conversion
    // This prevents the date from shifting by one day
    const parts = date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatMonth(date: string | Date): string {
  let d: Date;
  if (typeof date === 'string') {
    // Parse date string (YYYY-MM-DD) without timezone conversion
    const parts = date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      d = new Date(year, month, day);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
  }).format(d);
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    advertising: 'Advertising',
    meals_entertainment: 'Meals & Entertainment',
    insurance: 'Business Insurance',
    business_taxes: 'Business Taxes',
    licenses_memberships: 'Licenses, memberships, & Annual Dues',
    office_expenses: 'Office Expenses',
    office_supplies: 'Office Supplies',
    professional_fees: 'Professional Fees',
    management_admin_fees: 'Management & Admin Fees',
    rent: 'Rent (other than Home Office)',
    repairs_maintenance: 'Repairs and Maintenance',
    salaries_wages: 'Salaries & Wages',
    property_tax: 'Property Tax',
    travel_expenses: 'Travel Expenses',
    utilities: 'Utilities (other than for home office)',
    fuel_costs: 'Fuel (excluding motor vehicles)',
    delivery_freight: 'Delivery & Freight',
    motor_vehicle_expenses: 'Vehicle Expenses',
    home_office_expenses: 'Home Office Expenses',
    commissions_agent_fees: 'Commissions & Agent Fees',
    training: 'Training and Convention',
  };
  
  // If it's a known category, return the label
  if (labels[category]) {
    return labels[category];
  }
  
  // For custom categories, format snake_case to Title Case
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getIncomeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    union_production: 'Union Production',
    non_union_production: 'Non-union Production',
    royalty_residual: 'Royalty/Residual',
    cash: 'Cash',
  };
  return labels[type] || type;
}

export function getIncomeCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    film_tv: 'Film/TV Income',
    regular_employment: 'Regular Employment Income',
    other_self_employment: 'Other Self-Employment',
    other: 'Other',
  };
  return labels[category] || category;
}

export function getPersonalExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    child_care_expenses: 'Child Care Expenses',
    medical_expenses: 'Medical Expenses',
    charitable_donations: 'Charitable Donations',
    moving_expenses: 'Moving Expenses',
    student_loan_interest: 'Student Loan Interest',
    rrsp_contributions: 'RRSP Contributions',
    disability_supports: 'Disability Supports',
    employment_expenses: 'Employment Expenses',
    legal_fees: 'Legal Fees',
    investment_counsel_fees: 'Investment Counsel Fees',
  };
  
  // If it's a known category, return the label
  if (labels[category]) {
    return labels[category];
  }
  
  // For custom categories, format snake_case to Title Case
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getGeneralExpenseCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    rent: 'Rent',
    grocery: 'Grocery',
    utilities: 'Utilities',
    phone: 'Phone',
    internet: 'Internet',
    subscriptions: 'Subscriptions',
    entertainment: 'Entertainment',
    dining_out: 'Dining Out',
    clothing: 'Clothing',
    transportation: 'Transportation',
    insurance_personal: 'Personal Insurance',
    health_fitness: 'Health & Fitness',
    education: 'Education',
    gifts: 'Gifts',
    household_supplies: 'Household Supplies',
  };
  
  // If it's a known category, return the label
  if (labels[category]) {
    return labels[category];
  }
  
  // For custom categories, format snake_case to Title Case
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getExpenseTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    personal: 'Personal',
    business: 'Business',
    mixed: 'Mixed',
  };
  return labels[type] || type;
}