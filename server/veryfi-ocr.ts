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
 * Process a receipt image through Veryfi OCR
 */
export async function processReceiptOCR(imagePath: string): Promise<OCRResult> {
  const clientId = process.env.VERYFI_CLIENT_ID;
  const clientSecret = process.env.VERYFI_CLIENT_SECRET;
  const username = process.env.VERYFI_USERNAME;
  const apiKey = process.env.VERYFI_API_KEY;

  if (!clientId || !clientSecret || !username || !apiKey) {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.error(`${formattedTime} [veryfi] === VERYFI CREDENTIALS MISSING ===`);
    console.error(`${formattedTime} [veryfi] VERYFI_CLIENT_ID: ${clientId ? "SET" : "MISSING"}`);
    console.error(`${formattedTime} [veryfi] VERYFI_CLIENT_SECRET: ${clientSecret ? "SET" : "MISSING"}`);
    console.error(`${formattedTime} [veryfi] VERYFI_USERNAME: ${username ? "SET" : "MISSING"}`);
    console.error(`${formattedTime} [veryfi] VERYFI_API_KEY: ${apiKey ? "SET" : "MISSING"}`);
    throw new Error(
      "Veryfi API credentials are not configured. Please set VERYFI_CLIENT_ID, VERYFI_CLIENT_SECRET, VERYFI_USERNAME, and VERYFI_API_KEY environment variables."
    );
  }
  
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [veryfi] Veryfi credentials found, proceeding with OCR...`);

  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);

    // Veryfi API v8 expects file_data as a base64-encoded string in JSON payload
    // Convert image buffer to base64
    const mimeType = "image/jpeg"; // or detect dynamically if you want
    const fileDataBase64 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

    
    // Create JSON payload for Veryfi API
    // Include categories and auto_delete as recommended by Veryfi docs
    const payload = {
      file_data: fileDataBase64,
      file_name: fileName,
      categories: ["expense"],
      auto_delete: true,
    };
    

    // Prepare headers - ensure Content-Type is set correctly
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "CLIENT-ID": clientId,
      "CLIENT-SECRET": clientSecret,
      "AUTHORIZATION": `apikey ${username}:${apiKey}`,
    };
    

    // Make request to Veryfi API using axios (more reliable than fetch for this use case)
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    console.log(`${formattedTime} [veryfi] Making request to Veryfi API: ${VERYFI_API_URL}`);
    console.log(`${formattedTime} [veryfi] Headers: CLIENT-ID=${clientId.substring(0, 8)}..., AUTHORIZATION=apikey ${username}:***`);
    console.log(`${formattedTime} [veryfi] File: ${fileName}, Size: ${imageBuffer.length} bytes, Base64: ${fileDataBase64.length} chars`);
    console.log(`${formattedTime} [veryfi] Payload keys: ${Object.keys(payload).join(", ")}, has file_data: ${!!payload.file_data}, file_data length: ${payload.file_data?.length || 0}`);
    
    console.log("[veryfi] Auth sanity:", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasUsername: !!username,
      hasApiKey: !!apiKey,
    });


    const response = await axios.post(
      VERYFI_API_URL,
      payload,
      {
        headers,
        timeout: 30000, // 30 second timeout
      }
    );

    console.log(`${formattedTime} [veryfi] Veryfi API response status: ${response.status} ${response.statusText || ""}`);
    console.log(`${formattedTime} [veryfi] Veryfi API response received, parsing...`);

    const data = response.data;

    // Parse Veryfi response into our OCRResult format
    return parseVeryfiResponse(data);
  } catch (error: any) {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    
    // Axios error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const errorText = error.response.data ? JSON.stringify(error.response.data) : error.response.statusText;
      console.error(`${formattedTime} [veryfi] Veryfi API error: ${status} - ${errorText}`);
      
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
      console.error(`${formattedTime} [veryfi] No response from Veryfi API:`, error.message);
      return {
        status: "failed",
        confidence: 0,
        rawResponse: { error: "No response from Veryfi API. Please check your connection." },
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(`${formattedTime} [veryfi] Error setting up request:`, error.message);
      
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

