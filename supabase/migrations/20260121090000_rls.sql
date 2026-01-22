-- RLS: owner-only policies for user-scoped tables (user_id)
-- Assumes public.<table>.user_id is TEXT/VARCHAR storing auth.uid() as a string UUID.
-- Safe to re-run: policies are guarded against duplicate_object.

-- Helper macro (conceptual): owner check is (user_id = auth.uid()::text)

-- asset_cca_history
alter table public.asset_cca_history enable row level security;

do $$ begin
  create policy "asset_cca_history_select_own"
  on public.asset_cca_history for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "asset_cca_history_insert_own"
  on public.asset_cca_history for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "asset_cca_history_update_own"
  on public.asset_cca_history for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "asset_cca_history_delete_own"
  on public.asset_cca_history for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- assets
alter table public.assets enable row level security;

do $$ begin
  create policy "assets_select_own"
  on public.assets for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "assets_insert_own"
  on public.assets for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "assets_update_own"
  on public.assets for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "assets_delete_own"
  on public.assets for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- expenses
alter table public.expenses enable row level security;

do $$ begin
  create policy "expenses_select_own"
  on public.expenses for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "expenses_insert_own"
  on public.expenses for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "expenses_update_own"
  on public.expenses for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "expenses_delete_own"
  on public.expenses for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- income
alter table public.income enable row level security;

do $$ begin
  create policy "income_select_own"
  on public.income for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "income_insert_own"
  on public.income for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "income_update_own"
  on public.income for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "income_delete_own"
  on public.income for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- lease_contracts
alter table public.lease_contracts enable row level security;

do $$ begin
  create policy "lease_contracts_select_own"
  on public.lease_contracts for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_contracts_insert_own"
  on public.lease_contracts for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_contracts_update_own"
  on public.lease_contracts for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_contracts_delete_own"
  on public.lease_contracts for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- lease_payments
alter table public.lease_payments enable row level security;

do $$ begin
  create policy "lease_payments_select_own"
  on public.lease_payments for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_payments_insert_own"
  on public.lease_payments for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_payments_update_own"
  on public.lease_payments for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lease_payments_delete_own"
  on public.lease_payments for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- odometer_photos
alter table public.odometer_photos enable row level security;

do $$ begin
  create policy "odometer_photos_select_own"
  on public.odometer_photos for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "odometer_photos_insert_own"
  on public.odometer_photos for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "odometer_photos_update_own"
  on public.odometer_photos for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "odometer_photos_delete_own"
  on public.odometer_photos for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- paystubs
alter table public.paystubs enable row level security;

do $$ begin
  create policy "paystubs_select_own"
  on public.paystubs for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "paystubs_insert_own"
  on public.paystubs for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "paystubs_update_own"
  on public.paystubs for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "paystubs_delete_own"
  on public.paystubs for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- receipts
alter table public.receipts enable row level security;

do $$ begin
  create policy "receipts_select_own"
  on public.receipts for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "receipts_insert_own"
  on public.receipts for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "receipts_update_own"
  on public.receipts for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "receipts_delete_own"
  on public.receipts for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- tax_questionnaires
alter table public.tax_questionnaires enable row level security;

do $$ begin
  create policy "tax_questionnaires_select_own"
  on public.tax_questionnaires for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tax_questionnaires_insert_own"
  on public.tax_questionnaires for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tax_questionnaires_update_own"
  on public.tax_questionnaires for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tax_questionnaires_delete_own"
  on public.tax_questionnaires for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- vehicle_mileage_logs
alter table public.vehicle_mileage_logs enable row level security;

do $$ begin
  create policy "vehicle_mileage_logs_select_own"
  on public.vehicle_mileage_logs for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicle_mileage_logs_insert_own"
  on public.vehicle_mileage_logs for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicle_mileage_logs_update_own"
  on public.vehicle_mileage_logs for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicle_mileage_logs_delete_own"
  on public.vehicle_mileage_logs for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- vehicles
alter table public.vehicles enable row level security;

do $$ begin
  create policy "vehicles_select_own"
  on public.vehicles for select
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicles_insert_own"
  on public.vehicles for insert
  with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicles_update_own"
  on public.vehicles for update
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "vehicles_delete_own"
  on public.vehicles for delete
  using (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;
