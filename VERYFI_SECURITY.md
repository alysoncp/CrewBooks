# Veryfi OCR Security Implementation

## Overview

This document outlines the secure architecture for Veryfi OCR integration in CrewBooks. The critical principle is:

**Veryfi API must ONLY be called from your Express server, never from the browser or frontend.**

## Architecture

```
User Browser
    ↓ (HTTPS)
Express API Server (/api/receipts/upload)
    ↓ (Server-side Only)
Veryfi API (with credentials)
    ↓
Express API Server (normalized response)
    ↓
Supabase (store results + original file)
    ↓ (HTTPS)
User Browser (view results)
```

## Security Model

### ✅ What We Do

- **Server-side only credentials**: `VERYFI_*` env vars exist only on the server
- **Centralized processing**: Single module (`server/veryfi-ocr.ts`) handles all Veryfi calls
- **Rate limiting**: Per-user monthly OCR limits prevent abuse and unexpected costs
- **Input validation**: All uploads checked for file type and size before Veryfi call
- **Error handling**: Veryfi failures don't expose credentials or API details to users

### ❌ What We Never Do

- ❌ Expose Veryfi credentials to frontend (no `VITE_VERYFI_*` vars)
- ❌ Call Veryfi from browser/client code
- ❌ Expose Veryfi API responses directly to users
- ❌ Allow unlimited OCR requests (tier-based monthly quotas)
- ❌ Store raw user receipts in Veryfi (auto_delete: true)

## Implementation Details

### 1. Credentials Configuration

**File**: `.env` (server-side only)

```env
VERYFI_CLIENT_ID=...
VERYFI_CLIENT_SECRET=...
VERYFI_USERNAME=...
VERYFI_API_KEY=...
```

**Rules**:
- These variables are NEVER prefixed with `VITE_`
- They exist ONLY on the server
- They are loaded at startup and validated
- Check server logs on startup for credential status:
  ```
  🔐 Veryfi Credentials Status: { clientId: true, clientSecret: true, username: true, apiKey: true }
  ✅ Veryfi credentials loaded successfully
  ```

### 2. Centralized OCR Module

**File**: `server/veryfi-ocr.ts`

Key functions:
- `validateVeryfiCredentials()` - Check credentials at startup
- `processReceiptOCR(imagePath, category)` - Call Veryfi API
- `checkOCRRateLimit(userId, tier)` - Enforce monthly limits
- `incrementOCRCounter(userId)` - Track usage

**Usage Pattern**:
```typescript
// Good ✅
import { processReceiptOCR } from "./veryfi-ocr";

app.post("/api/receipts/upload", requireUser, async (req, res) => {
  // File already saved to temp location
  const result = await processReceiptOCR(tempFilePath);
  // Store normalized result in Supabase
});

// Bad ❌
// Never call Veryfi from routes without going through this module
// Never expose Veryfi credentials to client code
```

### 3. Receipt Upload Flow

**File**: `server/routes.ts` - `/api/receipts/upload`

Flow:
1. **Auth check**: `requireUser` middleware verifies Bearer token
2. **Validation**: Check file size, type, user subscription tier
3. **Save file**: Store uploaded file temporarily in `uploads/`
4. **Call Veryfi**: Send to Veryfi API (server-side, using centralized module)
5. **Normalize response**: Convert OCR data to structured format
6. **Store in DB**: Save receipt record + OCR results to Supabase
7. **Return to client**: Receipt ID and any pre-filled form data (no credentials exposed)
8. **Cleanup**: Delete temp file after Veryfi processes it

### 4. Rate Limiting (Cost Protection)

**Implementation**:
- User model tracks `ocrRequestsThisMonth` and `lastOcrReset`
- Tier-based monthly limits:
  - **Basic**: 0 (no OCR access)
  - **Personal**: 100 requests/month
  - **Corporate**: 500 requests/month
- Check happens BEFORE calling Veryfi
- Users get helpful error messages when limit exceeded

**Example**:
```typescript
const { allowed, reason, remaining } = await checkOCRRateLimit(userId, user.subscriptionTier);
if (!allowed) {
  return res.status(429).json({ 
    error: reason,
    nextReset: calculateResetDate()
  });
}
// Safe to call Veryfi
const result = await processReceiptOCR(filePath);
await incrementOCRCounter(userId);
```

### 5. Debug Endpoint (Development Only)

**Endpoint**: `POST /api/debug/veryfi`
**Available**: Only in `NODE_ENV=development`
**Purpose**: Test Veryfi credentials in isolation

**Usage**:
```bash
# Upload a test receipt image
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-receipt.jpg" \
  http://localhost:5000/api/debug/veryfi
```

**Response** (success):
```json
{
  "success": true,
  "message": "Veryfi credentials are working correctly",
  "ocrResult": {
    "vendor": "...",
    "amount": 123.45,
    "status": "completed",
    "confidence": 0.95
  }
}
```

**Response** (failure):
```json
{
  "success": false,
  "error": "Invalid CLIENT-ID or CLIENT-SECRET",
  "hint": "Check server logs for detailed error..."
}
```

**Troubleshooting steps**:
1. ✅ Auth works? (if you got this far, yes)
2. ✅ Veryfi responds? (check `status` in response)
3. Check server logs: `npm run dev 2>&1 | grep -i veryfi`

### 6. Error Handling

Never expose:
- ❌ Veryfi API keys or credentials in error messages
- ❌ Raw Veryfi error responses (contain internal API details)
- ❌ File paths or system information

Always sanitize:
- ✅ Generic error messages to users: "OCR processing failed. Please try again later."
- ✅ Detailed logs on server (searchable in production logs)
- ✅ Include helpful hints for specific errors (rate limit, invalid file, etc.)

## Deployment Checklist

### Before deploying to production:

- [ ] Remove any `VITE_VERYFI_*` environment variables
- [ ] Verify `VERYFI_*` credentials set on hosting platform (Render, etc.)
- [ ] Confirm `/api/debug/veryfi` is disabled when `NODE_ENV !== development`
- [ ] Test receipt upload with real account (not from browser devtools)
- [ ] Verify rate limits work correctly
- [ ] Check server logs for: `🔐 Veryfi Credentials Status`
- [ ] Ensure Supabase Storage bucket is configured for file uploads

### Credentials Migration:

If you change Veryfi credentials:
1. Update in `.env` locally
2. Update on hosting platform (Render Environment Variables)
3. Redeploy or restart server
4. Old credentials become invalid immediately
5. In-flight requests with old credentials will fail (expected)

## Monitoring & Debugging

### Startup Logs (Good ✅)

```
🔐 Veryfi Credentials Status: { clientId: true, clientSecret: true, username: true, apiKey: true }
✅ Veryfi credentials loaded successfully
```

### Startup Logs (Bad ❌)

```
🔐 Veryfi Credentials Status: { clientId: false, clientSecret: true, username: true, apiKey: true }
❌ Missing Veryfi credentials. Check your .env file.
```

### OCR Request Logs (Good ✅)

```
🧪 DEBUG: Testing Veryfi OCR
📁 File: 1234567890-receipt.jpg
👤 User: usr_abc123
✅ DEBUG: Veryfi responded
Status: completed
📊 OCR counter incremented for user usr_abc123
```

### OCR Request Logs (Bad ❌)

```
❌ DEBUG: Veryfi test failed
Error: Invalid CLIENT-ID or CLIENT-SECRET
Hint: Check server logs for detailed error...
```

## Cost Protection Strategy

### Monthly Quotas

- Prevent runaway costs from bugs or abuse
- Tier-based limits align with subscription value
- Users see remaining count before uploading

### Monitoring

- Track `ocrRequestsThisMonth` per user
- Alert if user approaching limit
- Dashboard shows usage statistics

### Optimization

- Batch similar receipts together
- Implement retry logic with backoff
- Cache OCR results for duplicate receipts (future enhancement)

## Testing

### Local Development

1. **Start server**: `npm run dev`
2. **Check credentials**: Look for startup logs above
3. **Test upload**: Use the browser UI or:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "files=@receipt.jpg" \
     http://localhost:5000/api/receipts/upload
   ```
4. **Debug if needed**: `POST /api/debug/veryfi`

### Production

- Monitor error rates in logs
- Set up alerts for Veryfi API failures
- Track OCR usage trends
- Review cost monthly

## References

- [Veryfi API Documentation](https://api.veryfi.com/docs/)
- `.env.example` - Template for credentials
- `server/veryfi-ocr.ts` - Central OCR module
- `server/routes.ts` - Receipt upload endpoint
- `SECURITY_IMPLEMENTATION.md` - Full security architecture
