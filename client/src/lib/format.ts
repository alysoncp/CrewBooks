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
    // Self-Employment categories
    advertising: 'Advertising',
    meals_entertainment: 'Meals & Entertainment',
    insurance: 'Business Insurance',
    business_taxes: 'Business Taxes',
    licenses_memberships: 'Licenses, memberships, & Annual Dues',
    office_expenses: 'Office Expenses',
    office_supplies: 'Office Supplies',
    professional_fees: 'Professional Fees',
    management_admin_fees: 'Management & Admin Fees',
    repairs_maintenance: 'Repairs and Maintenance',
    salaries_wages: 'Salaries & Wages',
    property_tax: 'Property Tax',
    travel_expenses: 'Travel Expenses',
    delivery_freight: 'Delivery & Freight',
    commissions_agent_fees: 'Commissions & Agent Fees',
    training: 'Training and Convention',
    fuel_non_vehicle: 'Fuel (Non-Motor Vehicle)',
    // Home Office/Living categories
    rent: 'Rent',
    utilities: 'Utilities',
    internet: 'Internet',
    phone: 'Phone',
    heat: 'Heat',
    electricity: 'Electricity',
    insurance_home: 'Home Insurance',
    maintenance_home: 'Home Maintenance',
    mortgage_interest: 'Mortgage Interest',
    property_taxes: 'Property Taxes',
    // Vehicle categories
    fuel_costs: 'Fuel (Motor Vehicle)',
    electric_vehicle_charging: 'Electric Vehicle Charging',
    vehicle_insurance: 'Vehicle Insurance',
    parking_tolls: 'Parking & Tolls',
    lease_payment: 'Lease or Loan Payment',
    vehicle_repairs: 'Vehicle Repairs',
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
    investment_counsel_fees: 'Investment Counsel Fees',
    tuition: 'Tuition',
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
    home_office_living: 'Home',
    vehicle: 'Vehicle',
    self_employment: 'Self-Employment',
    personal: 'Personal',
    mixed: 'Mixed',
    // Legacy types for backward compatibility
    business: 'Business',
  };
  return labels[type] || type;
}