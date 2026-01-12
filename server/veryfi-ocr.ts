import fs from "fs";
import path from "path";
import axios from "axios";

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
 * Process a document image through Veryfi OCR
 * @param imagePath Path to the image file
 * @param category Optional category hint for Veryfi (e.g., "expense" for receipts, undefined for auto-detect)
 */
export async function processReceiptOCR(imagePath: string, category?: string): Promise<OCRResult> {
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

    // Veryfi API v8 expects file_data as a base64-encoded string in JSON payload
    // Detect MIME type based on file extension to support PDFs and images
    const ext = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      ext === ".heic" ? "image/heic" :
      ext === ".jpeg" || ext === ".jpg" ? "image/jpeg" :
      "application/octet-stream";
    const fileDataBase64 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

    
    // Create JSON payload for Veryfi API
    // Include categories and auto_delete as recommended by Veryfi docs
    const payload: any = {
      file_data: fileDataBase64,
      file_name: fileName,
      auto_delete: true,
    };
    
    // Only include category if specified (let Veryfi auto-detect for paystubs)
    if (category) {
      payload.categories = [category];
    }
    

    // Prepare headers - ensure Content-Type is set correctly
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "CLIENT-ID": clientId,
      "CLIENT-SECRET": clientSecret,
      "AUTHORIZATION": `apikey ${username}:${apiKey}`,
    };

    // Make request to Veryfi API using axios (more reliable than fetch for this use case)
    const response = await axios.post(
      VERYFI_API_URL,
      payload,
      {
        headers,
        timeout: 30000, // 30 second timeout
      }
    );

    const data = response.data;

    // Parse Veryfi response into our OCRResult format
    return parseVeryfiResponse(data);
  } catch (error: any) {
    // Axios error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const errorText = error.response.data ? JSON.stringify(error.response.data) : error.response.statusText;
      
      if (status === 429) {
        return {
          status: "failed",
          confidence: 0,
          rawResponse: { error: "Veryfi API rate limit exceeded. Please try again later." },
        };
      }
      
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: `Veryfi API error: ${status} - ${errorText}` },
      };
    } else if (error.request) {
      // The request was made but no response was received
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: "No response from Veryfi API. Please check your connection." },
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      if (error.message?.includes("credentials")) {
        return {
          status: "failed",
          confidence: 0,
          rawResponse: { error: "Veryfi API credentials are not configured correctly" },
        };
      }
      
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: error.message || "Unknown error occurred during OCR processing" },
      };
    }
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

  // Extract date - Veryfi can return dates in various formats
  if (data.date) {
    let parsedDate: Date | null = null;
    
    if (typeof data.date === "string") {
      const dateStr = data.date.trim();
      
      // Try ISO format first (YYYY-MM-DD)
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        parsedDate = new Date(dateStr);
      }
      // Try MM/DD/YYYY or DD/MM/YYYY format
      else if (dateStr.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/)) {
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          // Try MM/DD/YYYY (US format) first
          const month = parseInt(parts[0], 10);
          const day = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            parsedDate = new Date(year, month - 1, day);
          }
        }
      }
      // Try DD-MM-YYYY format
      else if (dateStr.match(/^\d{2}-\d{2}-\d{4}/)) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            parsedDate = new Date(year, month - 1, day);
          }
        }
      }
      // Last resort: try JavaScript Date parsing
      else {
        parsedDate = new Date(dateStr);
      }
    } else if (data.date instanceof Date) {
      parsedDate = data.date;
    }
    
    // Convert to YYYY-MM-DD format if we have a valid date
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      const day = String(parsedDate.getDate()).padStart(2, "0");
      result.date = `${year}-${month}-${day}`;
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

