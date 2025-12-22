import fs from "fs";
import path from "path";

/**
 * Veryfi OCR Service
 * Handles receipt OCR processing using Veryfi API
 */

// Veryfi API configuration
const VERYFI_API_URL = "https://api.veryfi.com/api/v8/partner/documents";

export interface OCRResult {
  amount?: number;
  date?: string;
  vendor?: string;
  tax?: number;
  lineItems?: Array<{ description: string; amount: number }>;
  confidence: number;
  status: "processing" | "completed" | "failed";
  documentId?: string;
  rawResponse?: any;
}

/**
 * Process a receipt image through Veryfi OCR
 */
export async function processReceiptOCR(imagePath: string): Promise<OCRResult> {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const clientSecret = process.env.VERYFI_CLIENT_SECRET;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !clientSecret || !username || !apiKey) {
    throw new Error(
      "Veryfi API credentials are not configured. Please set VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME, and VERYFI_API_KEY environment variables."
    );
  }

  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);

    // Create form data for Veryfi API
    // Use form-data package for Node.js compatibility
    let FormDataClass: any;
    try {
      FormDataClass = (await import("form-data")).default;
    } catch {
      // If form-data is not installed, try using native FormData (Node 18+)
      FormDataClass = globalThis.FormData;
      if (!FormDataClass) {
        throw new Error(
          "form-data package is required. Please install it: npm install form-data"
        );
      }
    }

    const formData = new FormDataClass();
    
    // Append file - form-data package uses different API than native FormData
    if (FormDataClass.prototype.getHeaders) {
      // form-data package
      formData.append("file", imageBuffer, {
        filename: fileName,
        contentType: "image/jpeg",
      });
    } else {
      // Native FormData (Node 18+)
      const blob = new Blob([imageBuffer], { type: "image/jpeg" });
      formData.append("file", blob, fileName);
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "CLIENT-ID": clientId,
      "AUTHORIZATION": `apikey ${username}:${apiKey}`,
    };

    // Add form-data headers if using form-data package
    if (formData.getHeaders) {
      Object.assign(headers, formData.getHeaders());
    }

    // Make request to Veryfi API
    const response = await fetch(VERYFI_API_URL, {
      method: "POST",
      headers,
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Veryfi API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    // Parse Veryfi response into our OCRResult format
    return parseVeryfiResponse(data);
  } catch (error: any) {
    console.error("Error processing receipt OCR:", error);
    
    // Handle specific error types
    if (error.message?.includes("credentials")) {
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: "Veryfi API credentials are not configured correctly" },
      };
    }
    
    if (error.message?.includes("rate limit") || error.message?.includes("429")) {
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: "Veryfi API rate limit exceeded. Please try again later." },
      };
    }
    
    return {
      status: "failed",
      confidence: 0,
      rawResponse: { error: error.message || "Unknown error occurred during OCR processing" },
    };
  }
}

/**
 * Get OCR result by document ID (for polling/status checks)
 */
export async function getOCRResult(documentId: string): Promise<OCRResult> {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !username || !apiKey) {
    throw new Error("Veryfi API credentials are not configured.");
  }

  try {
    const response = await fetch(`${VERYFI_API_URL}/${documentId}`, {
      method: "GET",
      headers: {
        "CLIENT-ID": clientId,
        "AUTHORIZATION": `apikey ${username}:${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: "processing",
          confidence: 0,
        };
      }
      throw new Error(`Veryfi API error: ${response.status}`);
    }

    const data = await response.json();
    return parseVeryfiResponse(data);
  } catch (error: any) {
    console.error("Error fetching OCR result:", error);
    return {
      status: "failed",
      confidence: 0,
      rawResponse: { error: error.message },
    };
  }
}

/**
 * Parse Veryfi API response into our OCRResult format
 */
function parseVeryfiResponse(data: any): OCRResult {
  // Veryfi returns structured data with confidence scores
  const result: OCRResult = {
    status: "completed",
    confidence: data.confidence_score || 0,
    documentId: data.id?.toString(),
    rawResponse: data,
  };

  // Extract total amount
  if (data.total !== null && data.total !== undefined) {
    result.amount = parseFloat(data.total.toString());
  }

  // Extract date
  if (data.date) {
    // Veryfi returns date in various formats, try to parse it
    try {
      const date = new Date(data.date);
      if (!isNaN(date.getTime())) {
        result.date = date.toISOString().split("T")[0];
      }
    } catch (e) {
      // If date parsing fails, try to use as-is if it's already in YYYY-MM-DD format
      if (typeof data.date === "string" && data.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.date = data.date;
      }
    }
  }

  // Extract vendor/merchant name
  if (data.vendor?.name) {
    result.vendor = data.vendor.name;
  } else if (data.merchant_name) {
    result.vendor = data.merchant_name;
  }

  // Extract tax
  if (data.tax !== null && data.tax !== undefined) {
    result.tax = parseFloat(data.tax.toString());
  } else if (data.total_tax !== null && data.total_tax !== undefined) {
    result.tax = parseFloat(data.total_tax.toString());
  }

  // Extract line items
  if (data.line_items && Array.isArray(data.line_items)) {
    result.lineItems = data.line_items
      .filter((item: any) => item.description && item.total !== undefined)
      .map((item: any) => ({
        description: item.description,
        amount: parseFloat(item.total?.toString() || "0"),
      }));
  }

  return result;
}

