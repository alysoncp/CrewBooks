# Storage Security Migration Guide

## Current State

Your app currently saves uploaded files to `/uploads` directory and serves them statically via Express. This works but has security issues:

- ❌ Files are not scoped to users
- ❌ No way to expire access to files
- ❌ Users could potentially guess filenames and download other users' files
- ❌ No audit trail of who accessed what

## Recommended: Server-Mediated Uploads

**Pattern**: Client → Express Server → Supabase Storage (with service role)

**Benefits**:
- ✅ Server controls upload validation
- ✅ Files are organized by user: `receipts/<user-id>/<uuid>`
- ✅ Can use signed URLs (expiring access)
- ✅ RLS policies on Storage can prevent direct client access
- ✅ Audit trail: server logs who uploaded what

---

## Phase 1: Set Up Supabase Storage Buckets

### 1.1 Create Buckets in Supabase Dashboard

Go to **Supabase > Storage** and create these buckets:

| Bucket Name | Public | Notes |
|-------------|--------|-------|
| `receipts` | ❌ Private | For receipt images/PDFs |
| `paystubs` | ❌ Private | For paystub images/PDFs |
| `odometer-photos` | ❌ Private | For vehicle odometer photos |

### 1.2 Create RLS Policies for Storage

In Supabase **SQL Editor**, run:

```sql
-- Receipts bucket
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload receipts to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to read their own receipts
CREATE POLICY "Users can read own receipts" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'receipts' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their own receipts
CREATE POLICY "Users can delete own receipts" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'receipts' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Paystubs bucket
CREATE POLICY "Users can upload paystubs to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'paystubs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own paystubs" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'paystubs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own paystubs" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'paystubs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Odometer Photos bucket
CREATE POLICY "Users can upload odometer photos to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'odometer-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own odometer photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'odometer-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own odometer photos" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'odometer-photos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## Phase 2: Update Backend to Use Supabase Storage

### 2.1 Create Storage Helper Module

Create `server/storage-upload.ts`:

```typescript
import { getSupabaseAdmin } from "./auth";
import path from "path";
import crypto from "crypto";

const RECEIPTS_BUCKET = "receipts";
const PAYSTUBS_BUCKET = "paystubs";
const ODOMETER_BUCKET = "odometer-photos";

export async function uploadReceiptToStorage(
  userId: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  const admin = getSupabaseAdmin();
  const fileExtension = path.extname(originalFilename);
  const fileName = `${crypto.randomUUID()}${fileExtension}`;
  const filePath = `${userId}/${fileName}`;

  const { error } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: getMimeType(fileExtension),
    });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  return filePath;
}

export async function uploadPaystubToStorage(
  userId: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  const admin = getSupabaseAdmin();
  const fileExtension = path.extname(originalFilename);
  const fileName = `${crypto.randomUUID()}${fileExtension}`;
  const filePath = `${userId}/${fileName}`;

  const { error } = await admin.storage
    .from(PAYSTUBS_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: getMimeType(fileExtension),
    });

  if (error) {
    throw new Error(`Failed to upload paystub: ${error.message}`);
  }

  return filePath;
}

export async function uploadOdometerPhotoToStorage(
  userId: string,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  const admin = getSupabaseAdmin();
  const fileExtension = path.extname(originalFilename);
  const fileName = `${crypto.randomUUID()}${fileExtension}`;
  const filePath = `${userId}/${fileName}`;

  const { error } = await admin.storage
    .from(ODOMETER_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: getMimeType(fileExtension),
    });

  if (error) {
    throw new Error(`Failed to upload odometer photo: ${error.message}`);
  }

  return filePath;
}

/**
 * Get a signed URL that expires in 1 hour
 * Use for downloads/previews
 */
export async function getSignedReceiptUrl(filePath: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function getSignedPaystubUrl(filePath: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(PAYSTUBS_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function getSignedOdometerPhotoUrl(filePath: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(ODOMETER_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteReceiptFile(filePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(RECEIPTS_BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn(`Failed to delete receipt file: ${error.message}`);
    // Don't throw—file might already be deleted
  }
}

export async function deletePaystubFile(filePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(PAYSTUBS_BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn(`Failed to delete paystub file: ${error.message}`);
  }
}

export async function deleteOdometerPhotoFile(filePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(ODOMETER_BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn(`Failed to delete odometer photo: ${error.message}`);
  }
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };

  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}
```

### 2.2 Update Receipt Upload Route

In `routes.ts`, update `/api/receipts/upload` to use Supabase Storage:

```typescript
// OLD (current): stores files in /uploads folder
// NEW: uploads to Supabase Storage

import { uploadReceiptToStorage, getSignedReceiptUrl, deleteReceiptFile } from "./storage-upload";
import fs from "fs";

app.post("/api/receipts/upload", isAuthenticated, upload.array("files", 10), async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.subscriptionTier === "basic") {
      return res.status(403).json({ 
        error: "Receipt uploads require Personal or Corporate subscription",
      });
    }

    const files = req.files as Express.Multer.File[];
    const notes = req.body.notes || "";
    const scanWithOCR = req.body.scanWithOCR === "true" || req.body.scanWithOCR === true;

    const receiptRecords = await Promise.all(
      files.map(async (file) => {
        try {
          // Read file from disk (multer saved it here)
          const fileBuffer = fs.readFileSync(file.path);

          // Upload to Supabase Storage
          const storagePath = await uploadReceiptToStorage(
            userId,
            fileBuffer,
            file.originalname
          );

          // Create database record pointing to storage path
          const receipt = await storage.createReceipt({
            userId,
            imageUrl: storagePath, // Store the path, not /uploads/filename
            notes,
            ocrStatus: scanWithOCR ? "processing" : null,
          });

          // Process OCR if requested
          if (scanWithOCR) {
            try {
              // Note: Your OCR service needs to read from Supabase Storage now
              // For now, keep reading from temp disk location
              const ocrResult = await processReceiptOCR(file.path, "expense");

              if (ocrResult.status === "completed") {
                const expenseData = convertOCRToExpenseData(ocrResult);
                expenseData.receiptId = receipt.id;
                expenseData.userId = userId;
                await storage.createExpense(expenseData);

                await storage.updateReceipt(receipt.id, {
                  ocrStatus: "completed",
                });
              }
            } catch (ocrError) {
              console.error("OCR processing failed:", ocrError);
              await storage.updateReceipt(receipt.id, { ocrStatus: "failed" });
            }
          }

          // Clean up temp file
          fs.unlinkSync(file.path);

          return receipt;
        } catch (error) {
          console.error("Failed to process file:", error);
          throw error;
        }
      })
    );

    res.status(201).json(receiptRecords);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to upload receipts" });
  }
});
```

---

## Phase 3: Update Database Schema (Optional but Recommended)

Add a column to track storage path vs local file:

```sql
-- Already have imageUrl, but make it consistent
-- Change imageUrl to store relative path like: receipts/user-id/uuid.jpg
-- When serving, frontend can call /api/receipts/:id/signed-url to get download link
```

Update schema to add helper column:

```typescript
// In shared/schema.ts - Receipt table definition
export const receipts = pgTable("receipts", {
  // ... existing fields
  imageUrl: text("image_url").notNull(), // Now stores: user-id/uuid.jpg
  storageBucket: text("storage_bucket").default("receipts"), // receipts, paystubs, etc
});
```

---

## Phase 4: Frontend Changes

### 4.1 Update File Upload

Instead of uploading directly to `/uploads`, upload to your Express endpoint:

```typescript
// client/src/lib/fileUpload.ts (new file)
import { supabase } from "./supabase";

export async function uploadReceiptFiles(
  files: File[],
  options: { notes?: string; scanWithOCR?: boolean } = {}
): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const formData = new FormData();
  files.forEach(file => formData.append("files", file));
  if (options.notes) formData.append("notes", options.notes);
  if (options.scanWithOCR) formData.append("scanWithOCR", "true");

  const res = await fetch("/api/receipts/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Upload failed");
  }

  return res.json();
}
```

### 4.2 Display Files with Signed URLs

```typescript
// When showing receipt preview:
async function getReceiptPreviewUrl(receiptId: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`/api/receipts/${receiptId}/signed-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { signedUrl } = await res.json();
  return signedUrl;
}
```

Add new route in `routes.ts`:

```typescript
app.get("/api/receipts/:id/signed-url", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const receipt = await storage.getReceiptById(req.params.id);

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const signedUrl = await getSignedReceiptUrl(receipt.imageUrl);
    res.json({ signedUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});
```

---

## Phase 5: Migration Script (Optional)

If you already have files in `/uploads` and want to migrate them:

```typescript
// script/migrate-files-to-supabase.ts
import { getSupabaseAdmin } from "../server/auth";
import { storage } from "../server/storage";
import fs from "fs";
import path from "path";

async function migrateFilesToSupabase() {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const files = fs.readdirSync(uploadsDir);

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const buffer = fs.readFileSync(filePath);

    // You'll need to match files to receipts somehow
    // This is a skeleton - adjust based on your naming scheme
    
    console.log(`Migrated ${file} to Supabase Storage`);
  }

  console.log("Migration complete!");
}

migrateFilesToSupabase().catch(console.error);
```

---

## Rollout Plan

### Immediate (Week 1)
1. ✅ Set up Supabase Storage buckets
2. ✅ Create RLS policies for storage
3. ✅ Create `storage-upload.ts` helper module
4. ✅ Update receipt upload route to use Supabase Storage

### Short-term (Week 2)
5. Update paystub and odometer photo uploads similarly
6. Add `/api/receipts/:id/signed-url` endpoint
7. Test end-to-end with a few manual uploads

### Medium-term (Week 3+)
8. Update frontend to use signed URL approach
9. Remove `/uploads` static serving once verified all files are in Supabase
10. (Optional) Run migration script for existing files

---

## Security Checklist

- [ ] Storage buckets created as **Private** (not public)
- [ ] RLS policies on storage created to scope access by user
- [ ] Server uses service role to upload (bypasses RLS, so server validates)
- [ ] Signed URLs have expiration (1 hour default)
- [ ] Frontend cannot directly upload to Supabase (uses server endpoint)
- [ ] File downloads use signed URLs (not permanent links)
- [ ] Deleted receipts also delete files from storage

---

## Troubleshooting

**"Permission denied" uploading**: Check that RLS policies allow service role to upload.

**Signed URL returns 404**: File path might be wrong. Verify it matches what was uploaded.

**Slow uploads**: Consider compressing images before upload (already done via `image-compression.ts`).

---

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Signed URLs](https://supabase.com/docs/guides/storage/signed-urls)
- [Storage RLS](https://supabase.com/docs/guides/storage/security)
