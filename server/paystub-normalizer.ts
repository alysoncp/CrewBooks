/**
 * Paystub OCR Normalization
 * 
 * Rule-based normalization for paystub OCR results
 * Uses issuer-specific parsers for reliable data extraction
 */

import type { OCRResult } from "./veryfi-ocr";

export interface NormalizedPaystub {
  issuer: string;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  grossPay: number | null;
  netPay: number | null;
  taxes: Record<string, number>;
  deductions: Record<string, number>;
  employerName: string | null;
  employeeName: string | null;
  confidence: number;
}

/**
 * Classify document type from Veryfi OCR data
 */
export function classifyDocument(veryfiData: any): "receipt" | "paystub" | "unknown" {
  // Check for paystub-specific fields
  if (
    veryfiData.pay_period_start ||
    veryfiData.pay_period_end ||
    veryfiData.gross_pay !== undefined ||
    veryfiData.net_pay !== undefined ||
    veryfiData.pay_period ||
    veryfiData.period_start ||
    veryfiData.period_end
  ) {
    return "paystub";
  }

  // Check for receipt-specific fields
  if (veryfiData.total && veryfiData.vendor) {
    return "receipt";
  }

  // Additional heuristics: check line items for paystub patterns
  if (veryfiData.line_items && Array.isArray(veryfiData.line_items)) {
    const itemTexts = veryfiData.line_items
      .map((item: any) => (item.description || "").toLowerCase())
      .join(" ");
    
    if (
      itemTexts.includes("gross") ||
      itemTexts.includes("net pay") ||
      itemTexts.includes("deduction") ||
      itemTexts.includes("federal tax") ||
      itemTexts.includes("provincial tax") ||
      itemTexts.includes("cpp") ||
      itemTexts.includes("ei")
    ) {
      return "paystub";
    }
  }

  return "unknown";
}

/**
 * Detect paystub issuer from OCR data
 */
export function detectPaystubIssuer(data: any): "ENTERTAINMENT_PARTNERS" | "CAST_AND_CREW" | "UNKNOWN" {
  // Check ocr_text first (most reliable for paystubs)
  const ocrText = (data.ocr_text || "").toLowerCase();
  const text = JSON.stringify(data).toLowerCase();
  const vendorName = (data.vendor?.name || data.merchant_name || "").toLowerCase();
  
  // Combine all text sources for checking
  const allText = `${ocrText} ${text} ${vendorName}`;

  // Check for Entertainment Partners Canada
  // Use stable anchors: "TIME REPORT SUMMARY" is extremely reliable for EP paystubs
  if (
    ocrText.includes("time report summary") ||
    allText.includes("entertainment partners") ||
    allText.includes("ep canada") ||
    allText.includes("epc") ||
    (ocrText.includes("entertainment") && ocrText.includes("partners"))
  ) {
    return "ENTERTAINMENT_PARTNERS";
  }

  // Check for Cast and Crew Services
  if (
    allText.includes("cast and crew") ||
    allText.includes("cast & crew") ||
    allText.includes("c&c")
  ) {
    return "CAST_AND_CREW";
  }

  return "UNKNOWN";
}

/**
 * Get display name for issuer (used as accounting office)
 */
function getIssuerDisplayName(issuer: string): string | null {
  switch (issuer) {
    case "ENTERTAINMENT_PARTNERS":
      return "Entertainment Partners Canada";
    case "CAST_AND_CREW":
      return "Cast and Crew Services";
    case "UNKNOWN":
      return null;
    default:
      return issuer;
  }
}

/**
 * Convert issuer enum to dropdown value format (matches frontend ACCOUNTING_OFFICES)
 */
function getIssuerDropdownValue(issuer: string): string | null {
  switch (issuer) {
    case "ENTERTAINMENT_PARTNERS":
      return "entertainment_partners_canada";
    case "CAST_AND_CREW":
      return "cast_and_crew_services";
    case "UNKNOWN":
      return null;
    default:
      return null;
  }
}

/**
 * Extract numeric value from various formats
 */
function extractNumeric(value: any): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value === "string") {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

/**
 * Extract date from various formats
 * Parses date strings directly to avoid timezone conversion issues
 * NEVER uses Date objects to avoid timezone shifts
 */
function extractDate(value: any): string | null {
  if (!value) return null;
  
  // If it's a Date object, convert to ISO string and extract date part
  if (value instanceof Date) {
    const isoString = value.toISOString(); // Always UTC
    const dateMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return dateMatch[0]; // Returns YYYY-MM-DD
    }
  }
  
  if (typeof value === "string") {
    // Handle "YYYY-MM-DD HH:MM:SS" format (Veryfi often uses this)
    const dateStr = value.split(" ")[0]; // Take just the date part
    
    // Parse directly from string to avoid timezone conversion
    // Format should be YYYY-MM-DD - extract components directly from string
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      // Validate the date parts are reasonable
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        // Return the date string directly - NO Date object conversion
        return `${year}-${month}-${day}`;
      }
    }
    
    // If format doesn't match YYYY-MM-DD, try other common formats without Date object
    // Try MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, part1, part2, year] = slashMatch;
      // Assume MM/DD/YYYY format (common in US/Canada)
      const month = part1.padStart(2, "0");
      const day = part2.padStart(2, "0");
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  return null;
}

/**
 * Extract production name from Entertainment Partners paystub OCR data
 */
function extractProductionName(data: any): string | null {
  // Try to extract from bill_to address (often contains show name)
  if (data.bill_to?.address) {
    const address = data.bill_to.address;
    // Look for show name patterns (often in first line)
    const lines = address.split("\n");
    if (lines.length > 0) {
      // First line often has the show name, but skip if it's just a date/format code
      const firstLine = lines[0].trim();
      // Skip if it's just a date/format code or too short
      if (firstLine && !firstLine.match(/^\d{4}.*\d{4}$/) && firstLine.length > 5) {
        return firstLine;
      }
    }
  }
  
  // Try to extract from ocr_text
  if (data.ocr_text) {
    // Look for "SHOW: <name>" pattern
    const showMatch = data.ocr_text.match(/SHOW:\s*([^\n\t]+)/i);
    if (showMatch && showMatch[1]) {
      return showMatch[1].trim();
    }
  }
  
  return null;
}

/**
 * Calculate confidence score for paystub data
 */
export function calculatePaystubConfidence(data: NormalizedPaystub): number {
  let score = 1.0;

  // Deduct points for missing critical fields
  if (!data.payPeriodStart) score -= 0.15;
  if (!data.payPeriodEnd) score -= 0.15;
  if (data.grossPay === null || data.grossPay === undefined) score -= 0.25;
  if (data.netPay === null || data.netPay === undefined) score -= 0.25;
  if (!data.employerName) score -= 0.1;
  
  // Deduct points for invalid issuer
  if (data.issuer === "UNKNOWN") score -= 0.1;

  return Math.max(score, 0);
}

/**
 * Validate paystub data consistency
 */
export function validatePaystub(data: NormalizedPaystub): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate dates
  if (data.payPeriodStart && data.payPeriodEnd) {
    const start = new Date(data.payPeriodStart);
    const end = new Date(data.payPeriodEnd);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push("Invalid date format");
    } else if (start >= end) {
      errors.push("Pay period start must be before end date");
    } else {
      // Check if duration is reasonable (7-14 days typically)
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < 1 || daysDiff > 31) {
        errors.push(`Pay period duration (${Math.round(daysDiff)} days) seems unusual`);
      }
    }

    // Check if dates are in the future
    const now = new Date();
    if (end > now) {
      errors.push("Pay period end date is in the future");
    }
  }

  // Validate math consistency - EP-specific logic (more lenient)
  if (data.issuer === "ENTERTAINMENT_PARTNERS") {
    // For EP, we're more lenient because:
    // - GST collected (not withheld) affects totals
    // - Buyouts are included in gross but are income, not deductions
    // - Pension/insurance may be duplicated in summary blocks
    if (data.grossPay !== null && data.netPay !== null) {
      if (data.grossPay < data.netPay) {
        errors.push(`Gross pay (${data.grossPay}) less than net pay (${data.netPay})`);
      }
      if (data.netPay <= 0) {
        errors.push(`Net pay must be positive (got ${data.netPay})`);
      }
    }
    // Skip strict recomputation for EP - trust the OCR anchors
  } else {
    // Generic validation for other issuers
    if (data.grossPay !== null && data.netPay !== null && data.grossPay > 0) {
      if (data.grossPay < data.netPay) {
        errors.push("Gross pay cannot be less than net pay");
      }

      // Only count actual deductions (not earnings like buyout/labour)
      const deductionKeys = ["unionDues", "pension", "retirement", "insurance"];
      const totalDeductions = deductionKeys
        .map(k => data.deductions[k] || 0)
        .reduce((a, b) => a + b, 0);
      
      const totalTaxes = Object.values(data.taxes).reduce((sum, val) => sum + val, 0);
      const calculatedNet = data.grossPay - totalTaxes - totalDeductions;
      const difference = Math.abs(calculatedNet - data.netPay);

      // Allow small tolerance for rounding differences
      if (difference > 1.0 && data.grossPay > 0) {
        errors.push(`Math inconsistency: gross (${data.grossPay}) - taxes/deductions (${totalTaxes + totalDeductions}) ≠ net (${data.netPay})`);
      }
    }
  }

  // Validate currency sanity
  if (data.netPay !== null && data.netPay > 100000) {
    errors.push("Net pay seems unusually high (>$100k)");
  }
  
  if (data.grossPay !== null && data.grossPay < 0) {
    errors.push("Gross pay cannot be negative");
  }
  
  if (data.netPay !== null && data.netPay < 0) {
    errors.push("Net pay cannot be negative");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parse Entertainment Partners Canada paystub
 */
function parseEntertainmentPartners(data: any): NormalizedPaystub {
  // Gate logging for production (contains PII)
  const shouldLog = process.env.NODE_ENV !== "production";
  if (shouldLog) {
    console.log("=== PARSE ENTERTAINMENT PARTNERS ===");
    console.log("Available fields in data:", Object.keys(data).slice(0, 30));
    console.log("Gross pay candidates:", {
      gross_pay: data.gross_pay,
      gross: data.gross,
      "line_items with 'gross'": data.line_items?.filter((li: any) => li.description?.toLowerCase().includes("gross")),
    });
    console.log("Net pay candidates:", {
      net_pay: data.net_pay,
      net: data.net,
      subtotal: data.subtotal,
      total: data.total,
    });
    console.log("Tax fields:", {
      tax: data.tax,
      federal_tax: data.federal_tax,
      provincial_tax: data.provincial_tax,
      total_tax: data.total_tax,
    });
    console.log("Deduction fields:", {
      cpp: data.cpp,
      ei: data.ei,
      cp_ei: data.cp_ei,
      line_items_count: data.line_items?.length,
      "sample line items": data.line_items?.slice(0, 5).map((li: any) => ({
        description: li.description,
        amount: li.amount,
        total: li.total,
      })),
    });
    console.log("Date fields:", {
      pay_period_start: data.pay_period_start,
      pay_period_end: data.pay_period_end,
      period_start: data.period_start,
      period_end: data.period_end,
      service_start_date: data.service_start_date,
      service_end_date: data.service_end_date,
      date: data.date,
    });
  }
  
  // Extract gross and net pay from ocr_text FIRST (most reliable for Entertainment Partners)
  let grossPay: number | null = null;
  let netPay: number | null = null;
  
  if (data.ocr_text) {
    const ocrText = data.ocr_text;
    
    // Extract GROSS PAY from ocr_text (format: "GROSS PAY\t1234.56\t5678.90" or "Gross Pay\t1234.56" - first number is current period)
    const grossPayMatch = ocrText.match(/\bGROSS\s+PAY\b[\t\s]+(\d+\.?\d*)/i);
    if (grossPayMatch && grossPayMatch[1]) {
      grossPay = extractNumeric(grossPayMatch[1]);
      if (shouldLog && grossPay) console.log(`  → Extracted GROSS PAY from ocr_text: ${grossPay}`);
    } else {
      // Try "Gross Pay" (mixed case)
      const grossPayMatch2 = ocrText.match(/\bGross\s+Pay\b[\t\s]+(\d+\.?\d*)/i);
      if (grossPayMatch2 && grossPayMatch2[1]) {
        grossPay = extractNumeric(grossPayMatch2[1]);
        if (shouldLog && grossPay) console.log(`  → Extracted Gross Pay from ocr_text: ${grossPay}`);
      } else {
        // Try just "Gross"
        const grossMatch = ocrText.match(/\bGross\b[\t\s]+(\d+\.?\d*)/i);
        if (grossMatch && grossMatch[1]) {
          grossPay = extractNumeric(grossMatch[1]);
          if (shouldLog && grossPay) console.log(`  → Extracted Gross from ocr_text: ${grossPay}`);
        }
      }
    }
    
    // Extract NET PAY from ocr_text (format: "NET PAY\t987.65\t4321.09" or "Net Pay\t987.65" - first number is current period)
    const netPayMatch = ocrText.match(/\bNET\s+PAY\b[\t\s]+(\d+\.?\d*)/i);
    if (netPayMatch && netPayMatch[1]) {
      netPay = extractNumeric(netPayMatch[1]);
      if (shouldLog && netPay) console.log(`  → Extracted NET PAY from ocr_text: ${netPay}`);
    } else {
      // Try "Net Pay" (mixed case)
      const netPayMatch2 = ocrText.match(/\bNet\s+Pay\b[\t\s]+(\d+\.?\d*)/i);
      if (netPayMatch2 && netPayMatch2[1]) {
        netPay = extractNumeric(netPayMatch2[1]);
        if (shouldLog && netPay) console.log(`  → Extracted Net Pay from ocr_text: ${netPay}`);
      } else {
        // Try just "Net"
        const netMatch = ocrText.match(/\bNet\b[\t\s]+(\d+\.?\d*)/i);
        if (netMatch && netMatch[1]) {
          netPay = extractNumeric(netMatch[1]);
          if (shouldLog && netPay) console.log(`  → Extracted Net from ocr_text: ${netPay}`);
        }
      }
    }
  }
  
  // Fallback to structured fields if ocr_text extraction failed
  // Note: total field in raw OCR data often contains gross pay
  if (!grossPay) {
    grossPay = extractNumeric(data.gross_pay || data.gross || data.total);
    if (shouldLog && grossPay) console.log(`  → Extracted Gross Pay from structured fields (gross_pay/gross/total): ${grossPay}`);
  }
  if (!netPay) {
    // For net pay, prefer net_pay or net, but if total exists and subtotal exists, subtotal is likely net
    netPay = extractNumeric(data.net_pay || data.net || (data.subtotal ? data.subtotal : data.total));
    if (shouldLog && netPay) console.log(`  → Extracted Net Pay from structured fields: ${netPay}`);
  }
  
  const normalized: NormalizedPaystub = {
    issuer: "ENTERTAINMENT_PARTNERS",
    payPeriodStart: extractDate(data.pay_period_start || data.period_start || data.service_start_date),
    payPeriodEnd: extractDate(data.pay_period_end || data.period_end || data.service_end_date || data.date),
    grossPay,
    netPay,
    taxes: {},
    deductions: {},
    employerName: data.vendor?.name || data.merchant_name || null,
    employeeName: data.employee_name || null,
    confidence: 0,
  };
  
  // Extract production name from OCR text (SHOW: <name>) and use it as employerName
  // This is more accurate than vendor name for Entertainment Partners paystubs
  const extractedProductionName = extractProductionName(data);
  if (extractedProductionName) {
    normalized.employerName = extractedProductionName;
    if (shouldLog) console.log(`Extracted production name from OCR: "${extractedProductionName}"`);
  }
  
  if (shouldLog) {
    console.log("After initial extraction:", {
      payPeriodStart: normalized.payPeriodStart,
      payPeriodEnd: normalized.payPeriodEnd,
      grossPay: normalized.grossPay,
      netPay: normalized.netPay,
      employerName: normalized.employerName,
    });
  }

  // Extract taxes
  if (data.federal_tax !== undefined) normalized.taxes.federal = extractNumeric(data.federal_tax) || 0;
  if (data.provincial_tax !== undefined) normalized.taxes.provincial = extractNumeric(data.provincial_tax) || 0;
  if (data.tax !== undefined && !normalized.taxes.federal && !normalized.taxes.provincial) {
    // If only generic tax field, try to split it (rough estimate)
    const taxAmount = extractNumeric(data.tax) || 0;
    normalized.taxes.federal = taxAmount * 0.6;
    normalized.taxes.provincial = taxAmount * 0.4;
  }

  // Extract deductions
  if (data.cpp !== undefined) normalized.deductions.cpp = extractNumeric(data.cpp) || 0;
  if (data.ei !== undefined) normalized.deductions.ei = extractNumeric(data.ei) || 0;
  if (data.cp_ei !== undefined) {
    // Combined CPP/EI - split roughly (this is an approximation)
    const combined = extractNumeric(data.cp_ei) || 0;
    normalized.deductions.cpp = combined * 0.7;
    normalized.deductions.ei = combined * 0.3;
  }

  // Extract deductions from ocr_text FIRST (more reliable for Entertainment Partners format)
  // Format is typically: NAME\tAMOUNT\tYEAR_TO_DATE (tab-separated)
  // We want the first number (current period), not year-to-date
  if (data.ocr_text) {
    if (shouldLog) console.log("Extracting deductions and taxes from ocr_text (prioritizing ocr_text over line_items)");
    const ocrText = data.ocr_text;
    
    // Extract Dues (format: "Dues\t93.07\t137.59" - first number is current period)
    const duesMatch = ocrText.match(/Dues[\t\s]+(\d+\.?\d*)/i);
    if (duesMatch && duesMatch[1]) {
      const duesAmount = extractNumeric(duesMatch[1]);
      if (duesAmount) {
        normalized.deductions.unionDues = duesAmount;
        if (shouldLog) console.log(`  → Extracted Dues from ocr_text (first value): ${duesAmount}`);
      }
    }
    
    // Extract Pension (format: "Pension\t248.19\t366.92" - first number is current period)
    const pensionMatch = ocrText.match(/\bPension\b[\t\s]+(\d+\.?\d*)/i);
    if (pensionMatch && pensionMatch[1]) {
      const pensionAmount = extractNumeric(pensionMatch[1]);
      if (pensionAmount) {
        normalized.deductions.pension = pensionAmount;
        if (shouldLog) console.log(`  → Extracted Pension from ocr_text (first value): ${pensionAmount}`);
      }
    }
    
    // Extract Retire/Retirement (format: "Retire\t124.10\t183.46" - first number is current period)
    const retireMatch = ocrText.match(/\bRetire\b[\t\s]+(\d+\.?\d*)/i);
    if (retireMatch && retireMatch[1]) {
      const retireAmount = extractNumeric(retireMatch[1]);
      if (retireAmount) {
        normalized.deductions.retirement = retireAmount;
        if (shouldLog) console.log(`  → Extracted Retire from ocr_text (first value): ${retireAmount}`);
      }
    }
    
    // Extract Insurance (format: "Insurance\t248.19\t366.92" - first number is current period)
    const insuranceMatch = ocrText.match(/Insurance[\t\s]+(\d+\.?\d*)/i);
    if (insuranceMatch && insuranceMatch[1]) {
      const insuranceAmount = extractNumeric(insuranceMatch[1]);
      if (insuranceAmount) {
        normalized.deductions.insurance = insuranceAmount;
        if (shouldLog) console.log(`  → Extracted Insurance from ocr_text (first value): ${insuranceAmount}`);
      }
    }
    
    // Extract Buyout (format: "Buyout\t2094.65" - this is typically in "OTHER PAYMENTS" section)
    if (!normalized.deductions.buyout) {
      const buyoutMatch = ocrText.match(/\bBuyout\b[\t\s]+(\d+\.?\d*)/i);
      if (buyoutMatch && buyoutMatch[1]) {
        const buyoutAmount = extractNumeric(buyoutMatch[1]);
        if (buyoutAmount) {
          normalized.deductions.buyout = buyoutAmount;
          if (shouldLog) console.log(`  → Extracted Buyout from ocr_text: ${buyoutAmount} (NOTE: This is income, not a deduction)`);
        }
      }
    }
    
    // Extract Mileage (format: "Mileage\t8.77\t17.37")
    if (!normalized.deductions.mileage) {
      const mileageMatch = ocrText.match(/\bMileage\b[\t\s]+(\d+\.?\d*)/i);
      if (mileageMatch && mileageMatch[1]) {
        const mileageAmount = extractNumeric(mileageMatch[1]);
        if (mileageAmount) {
          normalized.deductions.mileage = mileageAmount;
          if (shouldLog) console.log(`  → Extracted Mileage from ocr_text: ${mileageAmount}`);
        }
      }
    }
    
    // Extract Labour (might be in line items or as "Straight Time" + "Overtime" in summary)
    // Look for "Straight Time" amount
    if (!normalized.deductions.labour) {
      const straightTimeMatch = ocrText.match(/Straight\s+Time[\t\s]+(\d+\.?\d*)/i);
      if (straightTimeMatch && straightTimeMatch[1]) {
        const straightTimeAmount = extractNumeric(straightTimeMatch[1]);
        // Also look for Overtime and add them together
        const overtimeMatch = ocrText.match(/Overtime[\t\s]+(\d+\.?\d*)/i);
        const overtimeAmount = overtimeMatch && overtimeMatch[1] ? extractNumeric(overtimeMatch[1]) : 0;
        const totalLabour = (straightTimeAmount || 0) + (overtimeAmount || 0);
        if (totalLabour > 0) {
          normalized.deductions.labour = totalLabour;
          if (shouldLog) console.log(`  → Extracted Labour from ocr_text (Straight Time: ${straightTimeAmount}, Overtime: ${overtimeAmount}, Total: ${totalLabour}) (NOTE: This is income, not a deduction)`);
        }
      }
    }
    
    // Extract G/HST (P) from ocr_text (format: "G/HST (P)\t232.08\t343.32")
    // This is GST/HST collected, which should go into taxes
    const gstMatch = ocrText.match(/G\/HST\s*\(P\)[\t\s]+(\d+\.?\d*)/i);
    if (gstMatch && gstMatch[1]) {
      const gstAmount = extractNumeric(gstMatch[1]);
      if (gstAmount) {
        normalized.taxes.gstHst = gstAmount;
        if (shouldLog) console.log(`  → Extracted G/HST (P) from ocr_text: ${gstAmount}`);
      }
    }
  }

  if (shouldLog) {
    console.log("Final deductions extracted:", normalized.deductions);
    console.log("Final confidence:", normalized.confidence);
    console.log("=== END PARSE ENTERTAINMENT PARTNERS ===");
  }
  normalized.confidence = calculatePaystubConfidence(normalized);
  return normalized;
}

/**
 * Parse Cast and Crew Services paystub
 */
function parseCastAndCrew(data: any): NormalizedPaystub {
  const normalized: NormalizedPaystub = {
    issuer: "CAST_AND_CREW",
    payPeriodStart: extractDate(data.pay_period_start || data.period_start || data.service_start_date),
    payPeriodEnd: extractDate(data.pay_period_end || data.period_end || data.service_end_date || data.date),
    // Veryfi often uses subtotal for net pay and may not have gross_pay directly
    grossPay: extractNumeric(data.gross_pay || data.gross),
    netPay: extractNumeric(data.net_pay || data.net || data.subtotal || (data.total && data.subtotal ? data.subtotal : data.total)),
    taxes: {},
    deductions: {},
    employerName: data.vendor?.name || data.merchant_name || null,
    employeeName: data.employee_name || null,
    confidence: 0,
  };

  // Use OCR text anchors for Cast & Crew specific fields
  const shouldLog = process.env.NODE_ENV !== "production";
  const ocrTextRaw: string = data.ocr_text || "";
  if (ocrTextRaw) {
    // Gross Pay
    const grossMatch = ocrTextRaw.match(/gross\s*pay\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (grossMatch && grossMatch[1]) {
      const val = extractNumeric(grossMatch[1]);
      if (val !== null) {
        normalized.grossPay = val;
        if (shouldLog) console.log("[C&C] OCR Gross Pay:", val);
      }
    }

    // Net Income -> Amount Deposited
    const netMatch = ocrTextRaw.match(/amount\s+deposited\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (netMatch && netMatch[1]) {
      const val = extractNumeric(netMatch[1]);
      if (val !== null) {
        normalized.netPay = val;
        if (shouldLog) console.log("[C&C] OCR Net (Amount Deposited):", val);
      }
    }

    // GST/HST collected
    // Prefer explicit "GST/HST:" anchor first
    let gstMatch = ocrTextRaw.match(/gst\s*\/\s*hst\s*:\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (!gstMatch) {
      // Generic GST/HST with optional colon or dash
      gstMatch = ocrTextRaw.match(/gst\s*\/?\s*hst\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    }
    if (!gstMatch) {
      // Fallback to G/HST (P)
      gstMatch = ocrTextRaw.match(/g\/?hst\s*\(p\)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    }
    if (gstMatch && gstMatch[1]) {
      const val = extractNumeric(gstMatch[1]);
      if (val !== null) {
        (normalized.taxes as any).gstHst = val;
        if (shouldLog) console.log("[C&C] OCR GST/HST:", val);
      }
    }

    // Dues: Permit Fee or Member Fee
    const duesMatch = ocrTextRaw.match(/(permit\s*fee|member\s*fee)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (duesMatch && duesMatch[2]) {
      const val = extractNumeric(duesMatch[2]);
      if (val !== null) {
        (normalized.deductions as any).unionDues = ((normalized.deductions as any).unionDues || 0) + val;
        if (shouldLog) console.log("[C&C] OCR Dues (Permit/Member Fee):", val);
      }
    }

    // Insurance: "Ins. Ded"
    const insMatch = ocrTextRaw.match(/ins\.\s*ded\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (insMatch && insMatch[1]) {
      const val = extractNumeric(insMatch[1]);
      if (val !== null) {
        (normalized.deductions as any).insurance = ((normalized.deductions as any).insurance || 0) + val;
        if (shouldLog) console.log("[C&C] OCR Insurance (Ins. Ded):", val);
      }
    }

    // Pension: "Retir. Emp"
    const pensionMatch = ocrTextRaw.match(/retir\.\s*emp\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (pensionMatch && pensionMatch[1]) {
      const val = extractNumeric(pensionMatch[1]);
      if (val !== null) {
        (normalized.deductions as any).pension = ((normalized.deductions as any).pension || 0) + val;
        if (shouldLog) console.log("[C&C] OCR Pension (Retir. Emp):", val);
      }
    }

    // Retirement: "Retire Ded"
    const retireMatch = ocrTextRaw.match(/retire\s*ded\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (retireMatch && retireMatch[1]) {
      const val = extractNumeric(retireMatch[1]);
      if (val !== null) {
        (normalized.deductions as any).retirement = ((normalized.deductions as any).retirement || 0) + val;
        if (shouldLog) console.log("[C&C] OCR Retirement (Retire Ded):", val);
      }
    }
  }

  // Similar parsing logic (can be customized for Cast and Crew format)
  if (data.federal_tax !== undefined) normalized.taxes.federal = extractNumeric(data.federal_tax) || 0;
  if (data.provincial_tax !== undefined) normalized.taxes.provincial = extractNumeric(data.provincial_tax) || 0;
  if (data.tax !== undefined && !normalized.taxes.federal && !normalized.taxes.provincial) {
    const taxAmount = extractNumeric(data.tax) || 0;
    normalized.taxes.federal = taxAmount * 0.6;
    normalized.taxes.provincial = taxAmount * 0.4;
  }

  if (data.cpp !== undefined) normalized.deductions.cpp = extractNumeric(data.cpp) || 0;
  if (data.ei !== undefined) normalized.deductions.ei = extractNumeric(data.ei) || 0;

  // Extract deductions from line items
  if (data.line_items && Array.isArray(data.line_items)) {
    data.line_items.forEach((item: any) => {
      const desc = (item.description || "").toLowerCase();
      const amount = extractNumeric(item.total || item.amount) || 0;
      
      if (amount > 0) {
        if (desc.includes("union") || desc.includes("dues")) {
          normalized.deductions.unionDues = (normalized.deductions.unionDues || 0) + amount;
        } else if (desc.includes("pension")) {
          normalized.deductions.pension = (normalized.deductions.pension || 0) + amount;
        } else if (desc.includes("retire") && !desc.includes("pension")) {
          // "Retire" is separate from "Pension" on Entertainment Partners paystubs
          normalized.deductions.retirement = (normalized.deductions.retirement || 0) + amount;
        } else if (desc.includes("insurance")) {
          normalized.deductions.insurance = (normalized.deductions.insurance || 0) + amount;
        }
      }
    });
  }

  normalized.confidence = calculatePaystubConfidence(normalized);
  return normalized;
}

/**
 * Parse unknown issuer paystub (generic fallback)
 */
function parseUnknownIssuer(data: any): NormalizedPaystub {
  const normalized: NormalizedPaystub = {
    issuer: "UNKNOWN",
    payPeriodStart: extractDate(data.pay_period_start || data.period_start),
    payPeriodEnd: extractDate(data.pay_period_end || data.period_end),
    grossPay: extractNumeric(data.gross_pay || data.gross),
    netPay: extractNumeric(data.net_pay || data.net || data.total || data.amount),
    taxes: {},
    deductions: {},
    employerName: data.vendor?.name || data.merchant_name || null,
    employeeName: data.employee_name || null,
    confidence: 0,
  };

  // Try to extract taxes and deductions generically
  if (data.tax !== undefined) {
    const taxAmount = extractNumeric(data.tax) || 0;
    normalized.taxes.federal = taxAmount * 0.6;
    normalized.taxes.provincial = taxAmount * 0.4;
  }

  normalized.confidence = calculatePaystubConfidence(normalized);
  return normalized;
}

/**
 * Normalize paystub OCR data using issuer-specific parsers
 */
export function normalizePaystubOCR(ocrData: any): {
  normalized: NormalizedPaystub;
  validation: { isValid: boolean; errors: string[] };
} {
  // Debug: Log what we're receiving
  // Gate logging for production (contains PII)
  const shouldLog = process.env.NODE_ENV !== "production";
  if (shouldLog) {
    console.log("=== NORMALIZING PAYSTUB OCR (FUNCTION CALLED) ===");
    console.log("ocrData type:", typeof ocrData);
    console.log("ocrData is null/undefined:", ocrData === null || ocrData === undefined);
  }
  if (ocrData) {
    console.log("OCR Data keys:", Object.keys(ocrData).slice(0, 30));
  }
  console.log("Sample fields:", {
    total: ocrData?.total,
    amount: ocrData?.amount,
    net_pay: ocrData?.net_pay,
    gross_pay: ocrData?.gross_pay,
    vendor: ocrData?.vendor,
    merchant_name: ocrData?.merchant_name,
    date: ocrData?.date,
    pay_period_start: ocrData?.pay_period_start,
    pay_period_end: ocrData?.pay_period_end,
    line_items_count: ocrData?.line_items?.length || 0,
  });
  
  const issuer = detectPaystubIssuer(ocrData);
  console.log("Detected issuer:", issuer);
  
  let normalized: NormalizedPaystub;
  
  switch (issuer) {
    case "ENTERTAINMENT_PARTNERS":
      normalized = parseEntertainmentPartners(ocrData);
      break;
    case "CAST_AND_CREW":
      normalized = parseCastAndCrew(ocrData);
      break;
    default:
      normalized = parseUnknownIssuer(ocrData);
  }

  if (shouldLog) {
    console.log("Normalized paystub:", JSON.stringify(normalized, null, 2));
  }

  const validation = validatePaystub(normalized);
  if (shouldLog) {
    console.log("Validation:", validation);
  }

  return {
    normalized,
    validation,
  };
}

/**
 * Convert normalized paystub to income data format
 */
export function normalizedPaystubToIncomeData(
  normalized: NormalizedPaystub,
  defaultIncomeType: string = "union_production"
): {
  amount: string;
  date: string;
  incomeType: string;
  productionName: string | undefined;
  accountingOffice: string | undefined;
  gstHstCollected?: string;
  dues?: string;
  retirement?: string;
  labour?: string;
  buyout?: string;
  pension?: string;
  insurance?: string;
  confidence: number;
  needsReview: boolean;
} {
  // Gate logging for production (contains PII)
  const shouldLog = process.env.NODE_ENV !== "production";
  if (shouldLog) {
    console.log("=== CONVERT NORMALIZED TO INCOME DATA ===");
    console.log("Input normalized paystub:", {
      grossPay: normalized.grossPay,
      netPay: normalized.netPay,
      deductions: normalized.deductions,
      taxes: normalized.taxes,
      employerName: normalized.employerName,
    });
  }
  
  // Use net pay as the amount (what the performer actually receives)
  const amount = normalized.netPay || normalized.grossPay || 0;
  if (shouldLog) console.log("Calculated amount (net pay):", amount);
  if (shouldLog) console.log("Gross pay:", normalized.grossPay);
  
  // Use pay period end date as the income date (when payment was received)
  const date = normalized.payPeriodEnd || normalized.payPeriodStart || new Date().toISOString().split("T")[0];
  if (shouldLog) console.log("Calculated date:", date);


  // Extract deductions for the income form
  // NOTE: buyout and labour are earnings (income), not deductions, but we store them
  // separately so they can be displayed in the form. They should NOT be subtracted from gross.
  const dues = normalized.deductions.unionDues !== undefined ? normalized.deductions.unionDues.toString() : undefined;
  const retirement = normalized.deductions.retirement !== undefined ? normalized.deductions.retirement.toString() : undefined;
  const pension = normalized.deductions.pension !== undefined ? normalized.deductions.pension.toString() : undefined;
  const insurance = normalized.deductions.insurance !== undefined ? normalized.deductions.insurance.toString() : undefined;
  const buyout = normalized.deductions.buyout !== undefined ? normalized.deductions.buyout.toString() : undefined;
  const labour = normalized.deductions.labour !== undefined ? normalized.deductions.labour.toString() : undefined;
  // Note: Mileage is typically an expense, not a deduction on income, but include it if needed
  // const mileage = normalized.deductions.mileage !== undefined ? normalized.deductions.mileage.toString() : undefined;
  
  if (shouldLog) {
    console.log("Extracted deductions:", {
      dues,
      retirement,
      pension,
      insurance,
      buyout,
      labour,
    });
  }
  
  // GST/HST - use G/HST (P) from taxes if available, otherwise calculate from total taxes
  const gstHstAmount = normalized.taxes.gstHst || 
    Object.values(normalized.taxes).reduce((sum, val) => sum + val, 0);
  const gstHstCollected = gstHstAmount > 0 ? gstHstAmount.toString() : undefined;
  if (shouldLog) console.log("GST/HST collected:", gstHstCollected);

  // Determine if review is needed (low confidence or validation errors)
  const needsReview = normalized.confidence < 0.7;

  const result = {
    amount: amount.toString(), // Net pay
    grossPay: normalized.grossPay ? normalized.grossPay.toString() : undefined,
    date,
    incomeType: defaultIncomeType,
    productionName: normalized.employerName || undefined,
    accountingOffice: getIssuerDropdownValue(normalized.issuer) || undefined,
    gstHstCollected,
    dues,
    retirement,
    pension,
    insurance,
    buyout,
    labour,
    confidence: normalized.confidence,
    needsReview,
  };
  
  if (shouldLog) {
    console.log("Final income data result:", result);
    console.log("=== END CONVERT NORMALIZED TO INCOME DATA ===");
  }
  
  return result;
}

