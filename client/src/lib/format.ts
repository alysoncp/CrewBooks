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

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
  }).format(d);
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    advertising: 'Advertising',
    meals_entertainment: 'Meals & Entertainment',
    insurance: 'Insurance',
    business_taxes: 'Business Taxes',
    licenses_memberships: 'Licenses & Memberships',
    office_expenses: 'Office Expenses',
    office_supplies: 'Office Supplies',
    professional_fees: 'Professional Fees',
    management_admin_fees: 'Management & Admin Fees',
    rent: 'Rent',
    repairs_maintenance: 'Repairs and Maintenance',
    salaries_wages: 'Salaries & Wages',
    property_tax: 'Property Tax',
    travel_expenses: 'Travel Expenses',
    utilities: 'Utilities',
    fuel_costs: 'Fuel (excluding motor vehicles)',
    delivery_freight: 'Delivery & Freight',
    motor_vehicle_expenses: 'Motor Vehicle Expenses',
    home_office_expenses: 'Home Office Expenses',
    equipment: 'Equipment',
    commissions_agent_fees: 'Commissions & Agent Fees',
    training: 'Training',
  };
  return labels[category] || category;
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
