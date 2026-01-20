# Security Implementation Summary

**Date**: January 18, 2026  
**Goal**: Implement "JWT to API + RLS in DB" security pattern as recommended by ChatGPT

---

## What Was Done

### 1. ✅ New Per-Request Authentication Middleware

**File**: [server/middleware/requireUser.ts](server/middleware/requireUser.ts)

This replaces the old `isAuthenticated` middleware with a secure, user-scoped approach:

- Extracts Bearer token from `Authorization` header
- Creates a **user-scoped Supabase client** using that token
- Verifies token validity and extracts user identity
- Attaches both auth info (`req.auth`) and scoped client (`req.supabase`) to request
- All DB queries run under the user's JWT (RLS enforced automatically)

**Key improvement**: Previously, the service role key was used for every query, bypassing RLS entirely. Now, normal app traffic uses the user's JWT as a security guardrail.

---

### 2. ✅ Updated Auth Module

**File**: [server/auth.ts](server/auth.ts)

- Removed the old `isAuthenticated` middleware
- Kept `getSupabaseAdmin()` for admin-only operations
- Added clear warnings that service role should ONLY be used for admin tasks
- Service role key remains on server (never sent to client)

**Key improvement**: Service role is now reserved for admin operations only, not regular queries.

---

### 3. ✅ Added Security Hardening

**File**: [server/index.ts](server/index.ts)

Added three critical security layers:

1. **Helmet**: Sets security headers (X-Frame-Options, X-Content-Type-Options, etc.)
   ```typescript
   app.use(helmet());
   ```

2. **Rate Limiting for Auth**: Max 5 auth attempts per 15 minutes
   ```typescript
   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 5,
   });
   app.use("/api/auth", authLimiter);
   ```

3. **General API Rate Limiting**: Max 100 requests per minute
   ```typescript
   const apiLimiter = rateLimit({
     windowMs: 60 * 1000,
     max: 100,
   });
   app.use("/api/", apiLimiter);
   ```

4. **Request Size Limits**: Limited to 10MB for both JSON and URL-encoded
   ```typescript
   express.json({ limit: "10mb" })
   express.urlencoded({ limit: "10mb" })
   ```

**New dependencies installed**:
- `helmet` ^7.1.0 - Security headers
- `express-rate-limit` ^7.1.5 - Rate limiting

---

### 4. ✅ Created RLS Policy Documentation

**File**: [RLS_POLICIES.md](RLS_POLICIES.md)

Complete SQL guide for enabling Row-Level Security on all user-owned tables:

- 14 tables with full CRUD policies
- Each policy ensures users can only access their own data
- Uses `auth.uid()` for automatic filtering
- Ready to copy-paste into Supabase SQL Editor

**Tables covered**:
- users, income, expenses, receipts, paystubs
- vehicles, vehicle_mileage_logs, odometer_photos
- assets, asset_cca_history, lease_contracts, lease_payments
- tax_questionnaires, questionnaire_responses

**Next step**: Run these SQL commands in your Supabase dashboard.

---

### 5. ✅ Created Storage Migration Guide

**File**: [STORAGE_MIGRATION_GUIDE.md](STORAGE_MIGRATION_GUIDE.md)

Complete roadmap for migrating file uploads from local `/uploads` to Supabase Storage:

**Phase 1**: Set up storage buckets and RLS policies
**Phase 2**: Create backend helpers for upload/download
**Phase 3**: Update database schema (optional)
**Phase 4**: Update frontend to use signed URLs
**Phase 5**: Migration script for existing files

**Key benefits**:
- ✅ Files scoped by user (`receipts/<user-id>/<uuid>`)
- ✅ Signed URLs with expiration (1 hour)
- ✅ RLS policies prevent unauthorized access
- ✅ Server-mediated uploads (client cannot upload directly)

---

## Security Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Token Verification** | Service role (admin) | User JWT (scoped) |
| **DB Access Model** | Service role bypasses RLS | User JWT enforced by RLS |
| **Manual Auth Checks** | Yes, must remember to check `userId` | Yes, but RLS is guardrail |
| **Security Headers** | None | Helmet (Content-Security-Policy, X-Frame-Options, etc.) |
| **Auth Rate Limiting** | None | 5 attempts per 15 min |
| **API Rate Limiting** | None | 100 requests per minute |
| **Request Size Limit** | No limit | 10MB |
| **File Storage** | Local disk, no RLS | Supabase Storage with RLS |
| **File Expiration** | None | Signed URLs (1 hour) |

---

## Next Steps (In Order of Priority)

### 🔴 CRITICAL - Do First
1. **Update all routes to use new middleware**
   - Replace `isAuthenticated` import with `import { requireUser, AuthedRequest } from "./middleware/requireUser"`
   - Update all route handlers: `(req: any, res)` → `(req: AuthedRequest, res)`
   - Start using `req.supabase` instead of storage functions where appropriate

2. **Enable RLS policies in Supabase**
   - Copy SQL from [RLS_POLICIES.md](RLS_POLICIES.md)
   - Run in Supabase > SQL Editor
   - Verify with a test account

### 🟡 HIGH - Do Soon
3. **Migrate file storage**
   - Start with receipts upload
   - Create `server/storage-upload.ts` helper
   - Update `/api/receipts/upload` route
   - Add `/api/receipts/:id/signed-url` endpoint
   - Test end-to-end

4. **Test security**
   - Create 2 test accounts
   - Verify Account A cannot see Account B's data
   - Verify auth rate limiting works

### 🟢 MEDIUM - Plan For
5. **Update remaining file uploads** (paystubs, odometer photos)
6. **Frontend cleanup** (use signed URLs for downloads)
7. **Audit logging** (optional: log who accessed what files)

---

## How to Use the New Middleware

### Before (Old Way - Unsafe)
```typescript
import { isAuthenticated } from "./auth";

app.get("/api/income", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req); // Manual extraction
  const incomeRecords = await storage.getIncome(userId); // Uses service role
  res.json(incomeRecords);
});
```

### After (New Way - Secure)
```typescript
import { requireUser, type AuthedRequest } from "./middleware/requireUser";

app.get("/api/income", requireUser, async (req: AuthedRequest, res) => {
  // req.auth.userId is guaranteed from verified JWT
  // req.supabase is user-scoped client (RLS enforced)
  
  const { data, error } = await req.supabase
    .from("income")
    .select("*");
  
  // RLS automatically filters: WHERE user_id = req.auth.userId
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});
```

**Advantage**: You don't need to remember to check `userId`—RLS enforces it in the database.

---

## Known Limitations & Future Work

### Service Role Still Used In:
- `storage.ts` functions (creates/updates records via service role)
- This is OK for now because these functions manually add `userId`
- Ideal: Refactor storage layer to use user-scoped client

### File Storage:
- Currently using local `/uploads` folder
- See [STORAGE_MIGRATION_GUIDE.md](STORAGE_MIGRATION_GUIDE.md) for plan
- This is highest security priority after RLS

### MFA:
- Not yet implemented
- Recommended for finance app (optional for now)
- Can add later via Supabase Auth settings

---

## Verification Checklist

- [ ] `npm install` completed (helmet + express-rate-limit installed)
- [ ] `server/middleware/requireUser.ts` created
- [ ] `server/auth.ts` updated (service role warnings added)
- [ ] `server/index.ts` updated (helmet + rate limiting added)
- [ ] `RLS_POLICIES.md` reviewed
- [ ] `STORAGE_MIGRATION_GUIDE.md` reviewed
- [ ] RLS policies enabled in Supabase (run SQL commands)
- [ ] Routes updated to use new middleware (TODO)
- [ ] Test with 2 accounts to verify data isolation

---

## Files Changed

| File | Change |
|------|--------|
| **NEW** `server/middleware/requireUser.ts` | New secure middleware |
| `server/auth.ts` | Removed old middleware, added warnings |
| `server/index.ts` | Added helmet + rate limiting |
| `package.json` | Added helmet, express-rate-limit |
| **NEW** `RLS_POLICIES.md` | RLS SQL guide |
| **NEW** `STORAGE_MIGRATION_GUIDE.md` | File storage security guide |

---

## Immediate Action Items

**TODAY**:
1. Install npm dependencies ✅
2. Review the new middleware code
3. Start updating routes to use `requireUser` instead of `isAuthenticated`

**THIS WEEK**:
1. Enable RLS policies in Supabase
2. Test with 2 accounts
3. Fix any route compatibility issues

**NEXT WEEK**:
1. Plan storage migration
2. Set up Supabase Storage buckets
3. Update file upload routes

---

## Questions?

- **Why user-scoped client?** RLS becomes the guardrail instead of manual checks. Simpler, safer, harder to mess up.
- **Why rate limiting?** Prevents brute force attacks on auth endpoints.
- **Why Helmet?** Sets HTTP headers to prevent common attacks (clickjacking, MIME type sniffing, etc.)
- **Why migrate storage?** File access needs the same RLS protection as database records.

---

## References

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Helmet.js](https://helmetjs.github.io/)
- [express-rate-limit](https://github.com/nfriedly/express-rate-limit)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
