/**
 * CCA (Capital Cost Allowance) Calculator
 * Calculates CCA deductions for capital assets according to CRA rules
 */

import type { Asset, AssetCcaHistory, InsertAssetCcaHistory } from "@shared/schema";
import { CCA_CLASSES, type CCAClass } from "@shared/schema";

export interface CCACalculationResult {
  openingUcc: number;
  additions: number;
  dispositions: number;
  ccaRate: number;
  ccaClaimed: number;
  closingUcc: number;
  halfYearRuleApplied: boolean;
}

export interface AssetCCACalculation {
  assetId: string;
  assetName: string;
  ccaClass: CCAClass;
  businessUsePercentage: number;
  calculation: CCACalculationResult;
}

/**
 * Calculate CCA for a single asset for a tax year
 */
export function calculateAssetCCA(
  asset: Asset,
  previousYearHistory: AssetCcaHistory | null,
  taxYear: string,
  additions: number = 0,
  dispositions: number = 0
): CCACalculationResult {
  const ccaClassInfo = CCA_CLASSES[asset.ccaClass as CCAClass];
  if (!ccaClassInfo) {
    throw new Error(`Invalid CCA class: ${asset.ccaClass}`);
  }

  const ccaRate = ccaClassInfo.rate;
  const businessUsePercentage = parseFloat(asset.businessUsePercentage?.toString() || "100") / 100;

  // Opening UCC: either from previous year's closing UCC, or purchase price if first year
  let openingUcc: number;
  if (previousYearHistory) {
    openingUcc = parseFloat(previousYearHistory.closingUcc.toString());
  } else {
    // First year: use purchase price
    openingUcc = parseFloat(asset.purchasePrice.toString());
  }

  // Add additions (e.g., improvements)
  openingUcc += additions;

  // Subtract dispositions
  openingUcc -= dispositions;

  // Calculate base for CCA (before half-year rule)
  let ccaBase = openingUcc * businessUsePercentage;

  // Apply half-year rule for first year (unless disabled)
  const isFirstYear = !previousYearHistory;
  const applyHalfYearRule = asset.applyHalfYearRule && isFirstYear;
  const halfYearRuleApplied = applyHalfYearRule;

  if (applyHalfYearRule) {
    ccaBase = ccaBase * 0.5;
  }

  // Calculate CCA (can't exceed opening UCC)
  let ccaClaimed = ccaBase * ccaRate;
  const maxCca = openingUcc * businessUsePercentage;
  ccaClaimed = Math.min(ccaClaimed, maxCca);

  // Closing UCC = Opening UCC - CCA claimed
  const closingUcc = openingUcc - ccaClaimed;

  // Ensure closing UCC doesn't go negative
  const finalClosingUcc = Math.max(0, closingUcc);

  return {
    openingUcc,
    additions,
    dispositions,
    ccaRate,
    ccaClaimed,
    closingUcc: finalClosingUcc,
    halfYearRuleApplied,
  };
}

/**
 * Calculate CCA for all assets by class for a tax year
 */
export function calculateCCAByClass(
  assets: Asset[],
  assetHistories: Map<string, AssetCcaHistory[]>,
  taxYear: string
): Map<CCAClass, AssetCCACalculation[]> {
  const resultsByClass = new Map<CCAClass, AssetCCACalculation[]>();

  for (const asset of assets) {
    // Skip disposed assets (unless disposed in this tax year)
    if (!asset.isActive && asset.disposalDate) {
      const disposalYear = new Date(asset.disposalDate).getFullYear().toString();
      if (disposalYear !== taxYear) {
        continue;
      }
    }

    const ccaClass = asset.ccaClass as CCAClass;
    if (!CCA_CLASSES[ccaClass]) {
      continue; // Skip invalid classes
    }

    const history = assetHistories.get(asset.id) || [];
    // Find previous year's history (year before taxYear)
    const previousYear = (parseInt(taxYear) - 1).toString();
    const previousYearHistory = history.find(h => h.taxYear === previousYear) || null;

    // Calculate additions and dispositions for this year
    let additions = 0;
    let dispositions = 0;

    // Check if asset was purchased this year
    const purchaseYear = new Date(asset.purchaseDate).getFullYear().toString();
    if (purchaseYear === taxYear && !previousYearHistory) {
      // Asset purchased this year - no additions needed, already in opening UCC
    }

    // Check if asset was disposed this year
    if (asset.disposalDate) {
      const disposalYear = new Date(asset.disposalDate).getFullYear().toString();
      if (disposalYear === taxYear) {
        dispositions = parseFloat(asset.disposalProceeds?.toString() || "0");
      }
    }

    const calculation = calculateAssetCCA(asset, previousYearHistory, taxYear, additions, dispositions);

    if (!resultsByClass.has(ccaClass)) {
      resultsByClass.set(ccaClass, []);
    }

    resultsByClass.get(ccaClass)!.push({
      assetId: asset.id,
      assetName: asset.name,
      ccaClass,
      businessUsePercentage: parseFloat(asset.businessUsePercentage?.toString() || "100"),
      calculation,
    });
  }

  return resultsByClass;
}

/**
 * Calculate total CCA for all assets in a class
 */
export function calculateTotalCCAByClass(
  calculations: AssetCCACalculation[]
): number {
  return calculations.reduce((sum, calc) => sum + calc.calculation.ccaClaimed, 0);
}

/**
 * Generate CCA history record for an asset
 */
export function generateCCAHistoryRecord(
  assetId: string,
  userId: string,
  taxYear: string,
  calculation: CCACalculationResult,
  additions: number = 0,
  dispositions: number = 0
): InsertAssetCcaHistory {
  return {
    assetId,
    userId,
    taxYear,
    openingUcc: calculation.openingUcc.toString(),
    additions: additions.toString(),
    dispositions: dispositions.toString(),
    ccaClaimed: calculation.ccaClaimed.toString(),
    closingUcc: calculation.closingUcc.toString(),
  };
}

