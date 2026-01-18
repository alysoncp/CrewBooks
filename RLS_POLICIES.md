# Row-Level Security (RLS) Policy Guide

## Overview

RLS is the database-level security layer that ensures users can only access their own data. **This is non-negotiable for CrewBooks**—even if your backend code has bugs, RLS ensures data never leaks.

## Current Status

Your tables currently exist but **we need to verify RLS is enabled**. This guide provides the exact SQL policies to run in your Supabase SQL Editor.

## Critical Rule

✅ **MUST: RLS enabled on ALL user-owned tables**  
❌ **NEVER: Public tables for sensitive data**  
❌ **NEVER: Policies that allow cross-user access**

---

## How RLS Works with User-Scoped Clients

When you query with a user-scoped Supabase client (from the new middleware):

1. Client sends request with `Authorization: Bearer <user-token>`
2. Supabase DB receives token and extracts `auth.uid()` (the user's ID)
3. RLS policies automatically filter results to `WHERE user_id = auth.uid()`
4. Even if your code forgets the WHERE clause, RLS protects you

**Example**: Your code does `SELECT * FROM receipts`
- Backend code: Simple query, easy to reason about
- Database: Automatically becomes `SELECT * FROM receipts WHERE user_id = auth.uid()`
- Result: User only sees their own receipts

---

## Policies to Enable

Run these SQL commands in **Supabase > SQL Editor** for your project:

### 1. Enable RLS on all tables

```sql
-- Users table (special: users can read their own profile only)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Income
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

-- Expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Receipts
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Paystubs
ALTER TABLE public.paystubs ENABLE ROW LEVEL SECURITY;

-- Vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Vehicle Mileage Logs
ALTER TABLE public.vehicle_mileage_logs ENABLE ROW LEVEL SECURITY;

-- Odometer Photos
ALTER TABLE public.odometer_photos ENABLE ROW LEVEL SECURITY;

-- Assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Asset CCA History
ALTER TABLE public.asset_cca_history ENABLE ROW LEVEL SECURITY;

-- Lease Contracts
ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;

-- Lease Payments
ALTER TABLE public.lease_payments ENABLE ROW LEVEL SECURITY;

-- Tax Questionnaires
ALTER TABLE public.tax_questionnaires ENABLE ROW LEVEL SECURITY;

-- Questionnaire Responses
ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;
```

### 2. Create policies for each table

#### Income
```sql
-- SELECT: Users can only see their own income
CREATE POLICY "income_select_own" ON public.income
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can only insert income for themselves
CREATE POLICY "income_insert_own" ON public.income
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own income
CREATE POLICY "income_update_own" ON public.income
  FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Users can only delete their own income
CREATE POLICY "income_delete_own" ON public.income
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Expenses
```sql
CREATE POLICY "expenses_select_own" ON public.expenses
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "expenses_insert_own" ON public.expenses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update_own" ON public.expenses
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "expenses_delete_own" ON public.expenses
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Receipts
```sql
CREATE POLICY "receipts_select_own" ON public.receipts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "receipts_insert_own" ON public.receipts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "receipts_update_own" ON public.receipts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "receipts_delete_own" ON public.receipts
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Paystubs
```sql
CREATE POLICY "paystubs_select_own" ON public.paystubs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "paystubs_insert_own" ON public.paystubs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "paystubs_update_own" ON public.paystubs
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "paystubs_delete_own" ON public.paystubs
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Vehicles
```sql
CREATE POLICY "vehicles_select_own" ON public.vehicles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vehicles_insert_own" ON public.vehicles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vehicles_update_own" ON public.vehicles
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "vehicles_delete_own" ON public.vehicles
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Vehicle Mileage Logs
```sql
CREATE POLICY "vehicle_mileage_logs_select_own" ON public.vehicle_mileage_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vehicle_mileage_logs_insert_own" ON public.vehicle_mileage_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vehicle_mileage_logs_update_own" ON public.vehicle_mileage_logs
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "vehicle_mileage_logs_delete_own" ON public.vehicle_mileage_logs
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Odometer Photos
```sql
CREATE POLICY "odometer_photos_select_own" ON public.odometer_photos
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "odometer_photos_insert_own" ON public.odometer_photos
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "odometer_photos_update_own" ON public.odometer_photos
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "odometer_photos_delete_own" ON public.odometer_photos
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Assets
```sql
CREATE POLICY "assets_select_own" ON public.assets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "assets_update_own" ON public.assets
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Asset CCA History
```sql
CREATE POLICY "asset_cca_history_select_own" ON public.asset_cca_history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "asset_cca_history_insert_own" ON public.asset_cca_history
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "asset_cca_history_update_own" ON public.asset_cca_history
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "asset_cca_history_delete_own" ON public.asset_cca_history
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Lease Contracts
```sql
CREATE POLICY "lease_contracts_select_own" ON public.lease_contracts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "lease_contracts_insert_own" ON public.lease_contracts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lease_contracts_update_own" ON public.lease_contracts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "lease_contracts_delete_own" ON public.lease_contracts
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Lease Payments
```sql
CREATE POLICY "lease_payments_select_own" ON public.lease_payments
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "lease_payments_insert_own" ON public.lease_payments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lease_payments_update_own" ON public.lease_payments
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "lease_payments_delete_own" ON public.lease_payments
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Tax Questionnaires
```sql
CREATE POLICY "tax_questionnaires_select_own" ON public.tax_questionnaires
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "tax_questionnaires_insert_own" ON public.tax_questionnaires
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tax_questionnaires_update_own" ON public.tax_questionnaires
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "tax_questionnaires_delete_own" ON public.tax_questionnaires
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Questionnaire Responses
```sql
CREATE POLICY "questionnaire_responses_select_own" ON public.questionnaire_responses
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "questionnaire_responses_insert_own" ON public.questionnaire_responses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "questionnaire_responses_update_own" ON public.questionnaire_responses
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "questionnaire_responses_delete_own" ON public.questionnaire_responses
  FOR DELETE
  USING (user_id = auth.uid());
```

#### Users (Special)
```sql
-- Users can only SELECT their own user profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id = auth.uid());

-- Users can UPDATE their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (id = auth.uid());

-- DELETE policy: typically don't let users delete themselves
-- If you want to allow this, you'd use: USING (id = auth.uid());
-- For now, we'll omit DELETE to prevent accidental account deletion
```

---

## How to Run These Policies

1. **Go to Supabase Dashboard** → Your Project
2. **SQL Editor** → Create New Query
3. **Copy and paste** each SQL block from above
4. **Run Query** (blue "Run" button)
5. **Verify**: You should see "Success. No rows returned" or similar

---

## Verification Checklist

After running the policies:

- [ ] All tables in the list have RLS enabled
- [ ] Each table has SELECT, INSERT, UPDATE, DELETE policies
- [ ] Each policy checks `user_id = auth.uid()` (except users table which checks `id = auth.uid()`)
- [ ] You can log in to the app and see your own data (tests the happy path)
- [ ] Opening the app in a private window with a different user account doesn't show other users' data

---

## Future: Service Role Operations

If you ever need to query as service role (e.g., for admin tasks or migrations):

```typescript
import { getSupabaseAdmin } from "@/server/auth";

const admin = getSupabaseAdmin();

// This bypasses RLS (dangerous!)
const { data } = await admin
  .from("income")
  .select("*")
  .eq("user_id", "some-user-id"); // Always filter manually!
```

**Golden rule**: When using service role, ALWAYS add `WHERE user_id = ...` even though RLS is bypassed. This prevents accidents.

---

## Testing RLS

Quick test to verify RLS is working:

1. Create 2 Supabase accounts (user A and user B)
2. User A creates an income entry
3. User B logs in and tries to fetch `/api/income`
4. Result: User B should see an empty list (RLS blocked them)

---

## Troubleshooting

**"Permission denied" errors**: RLS is working! Check that your query includes the correct `user_id`.

**"Cannot read property of undefined"**: You might be accessing a column that RLS filtered out. Ensure your app only relies on `user_id` being the current user.

**Users seeing other users' data**: RLS is probably NOT enabled. Run the enable commands above.

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
