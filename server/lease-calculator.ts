/**
 * Lease Expense Calculator
 * Calculates deductible lease expenses according to CRA rules
 */

import type { LeaseContract, LeasePayment } from "@shared/schema";

export interface LeaseExpenseCalculation {
  leaseContractId: string;
  leaseName: string;
  leaseType: string;
  totalPayments: number;
  businessUsePercentage: number;
  businessUseAmount: number;
  craLimitApplied: boolean;
  craLimitAmount: number;
  deductibleAmount: number;
  gstPaid: number;
  pstPaid: number;
}

// CRA Passenger Vehicle Lease Limits (updated annually)
// For 2024: $950/month + GST/HST
const PASSENGER_VEHICLE_LEASE_LIMIT_MONTHLY = 950;
const PASSENGER_VEHICLE_LEASE_LIMIT_ANNUAL = PASSENGER_VEHICLE_LEASE_LIMIT_MONTHLY * 12;

/**
 * Calculate annual lease expense for a lease contract
 */
export function calculateLeaseExpense(
  contract: LeaseContract,
  payments: LeasePayment[],
  taxYear: string
): LeaseExpenseCalculation {
  const leaseType = contract.leaseType;
  const businessUsePercentage = parseFloat(contract.businessUsePercentage?.toString() || "100") / 100;

  // Filter payments for the tax year
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;
  const yearPayments = payments.filter(p => {
    const paymentDate = p.paymentDate;
    return paymentDate >= yearStart && paymentDate <= yearEnd;
  });

  // Calculate total payments (base amount, excluding GST/PST for limit calculation)
  const totalPayments = yearPayments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const totalGst = yearPayments.reduce((sum, p) => sum + parseFloat(p.gstAmount?.toString() || "0"), 0);
  const totalPst = yearPayments.reduce((sum, p) => sum + parseFloat(p.pstAmount?.toString() || "0"), 0);

  // Apply business use percentage
  let businessUseAmount = totalPayments * businessUsePercentage;

  // Apply CRA limits for passenger vehicles
  let craLimitApplied = false;
  let craLimitAmount = 0;
  let deductibleAmount = businessUseAmount;

  if (leaseType === "vehicle") {
    // Check if it's a passenger vehicle (typically cars, not commercial trucks)
    // For simplicity, we apply the limit to all vehicle leases
    // In a more sophisticated system, you'd check vehicle type

    // Calculate annual equivalent (if monthly payments, multiply by 12)
    let annualEquivalent = totalPayments;
    if (contract.paymentFrequency === "monthly") {
      annualEquivalent = totalPayments * 12; // Approximate annual
    } else if (contract.paymentFrequency === "quarterly") {
      annualEquivalent = totalPayments * 4;
    }

    // Apply CRA limit ($950/month + GST/HST)
    // The limit applies to the base payment amount (before GST/HST)
    const monthlyEquivalent = annualEquivalent / 12;
    if (monthlyEquivalent > PASSENGER_VEHICLE_LEASE_LIMIT_MONTHLY) {
      craLimitApplied = true;
      // Limit applies to business use portion
      const limitedAnnualBase = PASSENGER_VEHICLE_LEASE_LIMIT_MONTHLY * 12 * businessUsePercentage;
      craLimitAmount = limitedAnnualBase;
      deductibleAmount = limitedAnnualBase;
    }
  }

  return {
    leaseContractId: contract.id,
    leaseName: contract.name,
    leaseType,
    totalPayments,
    businessUsePercentage: businessUsePercentage * 100,
    businessUseAmount,
    craLimitApplied,
    craLimitAmount,
    deductibleAmount,
    gstPaid: totalGst * businessUsePercentage,
    pstPaid: totalPst * businessUsePercentage,
  };
}

/**
 * Calculate total lease expenses for all contracts in a tax year
 */
export function calculateTotalLeaseExpenses(
  contracts: LeaseContract[],
  paymentsByContract: Map<string, LeasePayment[]>,
  taxYear: string
): {
  totalDeductible: number;
  totalGst: number;
  totalPst: number;
  calculations: LeaseExpenseCalculation[];
} {
  const calculations: LeaseExpenseCalculation[] = [];
  let totalDeductible = 0;
  let totalGst = 0;
  let totalPst = 0;

  for (const contract of contracts) {
    // Skip inactive contracts (unless they have payments in this year)
    if (!contract.isActive) {
      const payments = paymentsByContract.get(contract.id) || [];
      const yearStart = `${taxYear}-01-01`;
      const yearEnd = `${taxYear}-12-31`;
      const hasYearPayments = payments.some(p => {
        return p.paymentDate >= yearStart && p.paymentDate <= yearEnd;
      });
      if (!hasYearPayments) {
        continue;
      }
    }

    const payments = paymentsByContract.get(contract.id) || [];
    const calculation = calculateLeaseExpense(contract, payments, taxYear);

    calculations.push(calculation);
    totalDeductible += calculation.deductibleAmount;
    totalGst += calculation.gstPaid;
    totalPst += calculation.pstPaid;
  }

  return {
    totalDeductible,
    totalGst,
    totalPst,
    calculations,
  };
}

