drop extension if exists "pg_net";


  create table if not exists "public"."asset_cca_history" (
    "id" character varying not null default gen_random_uuid(),
    "asset_id" character varying not null,
    "user_id" character varying not null,
    "tax_year" text not null,
    "opening_ucc" numeric(12,2) not null,
    "additions" numeric(12,2) default '0'::numeric,
    "dispositions" numeric(12,2) default '0'::numeric,
    "cca_claimed" numeric(12,2) default '0'::numeric,
    "closing_ucc" numeric(12,2) not null,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."assets" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "name" text not null,
    "description" text,
    "purchase_date" date not null,
    "purchase_price" numeric(12,2) not null,
    "purchase_gst" numeric(12,2),
    "purchase_pst" numeric(12,2),
    "cca_class" text not null,
    "business_use_percentage" numeric(5,2) default '100'::numeric,
    "apply_half_year_rule" boolean default true,
    "vehicle_id" character varying,
    "is_active" boolean default true,
    "disposal_date" date,
    "disposal_proceeds" numeric(12,2),
    "disposal_gst" numeric(12,2),
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."expenses" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "amount" numeric(12,2) not null,
    "date" date not null,
    "category" text not null,
    "description" text,
    "vendor" text,
    "receipt_image_url" text,
    "is_tax_deductible" boolean default true,
    "subcategory" text,
    "vehicle_id" character varying,
    "title" text,
    "base_cost" numeric(12,2),
    "gst_amount" numeric(12,2),
    "pst_amount" numeric(12,2),
    "expense_type" text default 'self_employment'::text,
    "business_use_percentage" numeric(5,2)
      );



  create table if not exists "public"."income" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "amount" numeric(12,2) not null,
    "date" date not null,
    "income_type" text not null,
    "production_name" text,
    "description" text,
    "paystub_image_url" text,
    "gst_hst_collected" numeric(12,2),
    "accounting_office" text,
    "gross_pay" numeric(12,2),
    "income_category" text default 'film_tv'::text,
    "employer_name" text,
    "business_name" text,
    "cpp_contribution" numeric(12,2),
    "ei_contribution" numeric(12,2),
    "income_tax_deduction" numeric(12,2),
    "dues" numeric(12,2),
    "retirement" numeric(12,2),
    "pension" numeric(12,2),
    "insurance" numeric(12,2)
      );



  create table if not exists "public"."lease_contracts" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "lease_type" text not null,
    "name" text not null,
    "description" text,
    "lessor_name" text,
    "lease_start_date" date not null,
    "lease_end_date" date,
    "monthly_payment" numeric(12,2) not null,
    "payment_frequency" text default 'monthly'::text,
    "business_use_percentage" numeric(5,2) default '100'::numeric,
    "vehicle_id" character varying,
    "asset_category" text,
    "is_active" boolean default true,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."lease_payments" (
    "id" character varying not null default gen_random_uuid(),
    "lease_contract_id" character varying not null,
    "user_id" character varying not null,
    "payment_date" date not null,
    "amount" numeric(12,2) not null,
    "gst_amount" numeric(12,2),
    "pst_amount" numeric(12,2),
    "description" text,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."odometer_photos" (
    "id" character varying not null default gen_random_uuid(),
    "vehicle_id" character varying not null,
    "user_id" character varying not null,
    "photo_url" text not null,
    "photo_date" date not null,
    "uploaded_at" timestamp without time zone default now(),
    "notes" text,
    "mileage" numeric(12,2)
      );



  create table if not exists "public"."paystubs" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "image_url" text not null,
    "uploaded_at" timestamp without time zone default now(),
    "linked_income_id" character varying,
    "notes" text,
    "ocr_job_id" character varying,
    "ocr_status" text,
    "ocr_result" jsonb,
    "ocr_processed_at" timestamp without time zone
      );



  create table if not exists "public"."questionnaire_responses" (
    "id" character varying not null default gen_random_uuid(),
    "questionnaire_id" character varying not null,
    "section_id" text not null,
    "question_id" text not null,
    "value" jsonb,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."receipts" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "image_url" text not null,
    "uploaded_at" timestamp without time zone default now(),
    "linked_expense_id" character varying,
    "linked_income_id" character varying,
    "notes" text,
    "ocr_job_id" character varying,
    "ocr_status" text,
    "ocr_result" jsonb,
    "ocr_processed_at" timestamp without time zone
      );



  create table if not exists "public"."tax_questionnaires" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "questionnaire_type" text not null,
    "tax_year" text not null,
    "status" text default 'draft'::text,
    "current_step" text default 'personal_info'::text,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."users" (
    "id" character varying not null default gen_random_uuid(),
    "email" character varying,
    "first_name" character varying,
    "last_name" character varying,
    "profile_image_url" character varying,
    "tax_filing_status" text default 'personal_only'::text,
    "province" text default 'BC'::text,
    "subscription_tier" text default 'basic'::text,
    "user_type" text,
    "union_affiliations" jsonb,
    "has_agent" boolean default false,
    "agent_name" text,
    "agent_commission" numeric(5,2),
    "has_business_number" boolean default false,
    "business_number" text,
    "has_gst_number" boolean default false,
    "gst_number" text,
    "uses_personal_vehicle" boolean default false,
    "has_regular_employment" boolean default false,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now(),
    "uses_corporate_vehicle" boolean default false,
    "has_home_office" boolean default false,
    "home_office_percentage" numeric(5,2),
    "enabled_expense_categories" jsonb,
    "enabled_personal_expense_categories" jsonb,
    "enabled_general_expense_categories" jsonb,
    "mileage_logging_style" text default 'trip_distance'::text,
    "ocr_requests_this_month" integer default 0,
    "last_ocr_reset" timestamp without time zone default now()
      );



  create table if not exists"public"."vehicle_mileage_logs" (
    "id" character varying not null default gen_random_uuid(),
    "vehicle_id" character varying not null,
    "user_id" character varying not null,
    "date" date not null,
    "odometer_reading" numeric(12,2) not null,
    "description" text,
    "is_business_use" boolean default true,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table if not exists "public"."vehicles" (
    "id" character varying not null default gen_random_uuid(),
    "user_id" character varying not null,
    "name" text not null,
    "make" text,
    "model" text,
    "year" numeric(4,0),
    "license_plate" text,
    "is_primary" boolean default false,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now(),
    "claims_cca" boolean default false,
    "purchased_this_year" boolean default false,
    "purchase_price" numeric(10,2),
    "cca_class" text,
    "current_mileage" numeric(12,2),
    "mileage_at_beginning_of_year" numeric(12,2),
    "mileage_estimate" boolean default false,
    "used_exclusively_for_business" boolean default false,
    "total_annual_mileage" numeric(12,2),
    "estimated_yearly_mileage" numeric(12,2)
      );


CREATE UNIQUE INDEX IF NOT EXISTS asset_cca_history_pkey ON public.asset_cca_history USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS assets_pkey ON public.assets USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_pkey ON public.expenses USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS income_pkey ON public.income USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS lease_contracts_pkey ON public.lease_contracts USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS lease_payments_pkey ON public.lease_payments USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS odometer_photos_pkey ON public.odometer_photos USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS paystubs_pkey ON public.paystubs USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS questionnaire_responses_pkey ON public.questionnaire_responses USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS receipts_pkey ON public.receipts USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS tax_questionnaires_pkey ON public.tax_questionnaires USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users USING btree (email);

CREATE UNIQUE INDEX IF NOT EXISTS users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_mileage_logs_pkey ON public.vehicle_mileage_logs USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_pkey ON public.vehicles USING btree (id);


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

grant delete on table "public"."asset_cca_history" to "anon";

grant insert on table "public"."asset_cca_history" to "anon";

grant references on table "public"."asset_cca_history" to "anon";

grant select on table "public"."asset_cca_history" to "anon";

grant trigger on table "public"."asset_cca_history" to "anon";

grant truncate on table "public"."asset_cca_history" to "anon";

grant update on table "public"."asset_cca_history" to "anon";

grant delete on table "public"."asset_cca_history" to "authenticated";

grant insert on table "public"."asset_cca_history" to "authenticated";

grant references on table "public"."asset_cca_history" to "authenticated";

grant select on table "public"."asset_cca_history" to "authenticated";

grant trigger on table "public"."asset_cca_history" to "authenticated";

grant truncate on table "public"."asset_cca_history" to "authenticated";

grant update on table "public"."asset_cca_history" to "authenticated";

grant delete on table "public"."asset_cca_history" to "service_role";

grant insert on table "public"."asset_cca_history" to "service_role";

grant references on table "public"."asset_cca_history" to "service_role";

grant select on table "public"."asset_cca_history" to "service_role";

grant trigger on table "public"."asset_cca_history" to "service_role";

grant truncate on table "public"."asset_cca_history" to "service_role";

grant update on table "public"."asset_cca_history" to "service_role";

grant delete on table "public"."assets" to "anon";

grant insert on table "public"."assets" to "anon";

grant references on table "public"."assets" to "anon";

grant select on table "public"."assets" to "anon";

grant trigger on table "public"."assets" to "anon";

grant truncate on table "public"."assets" to "anon";

grant update on table "public"."assets" to "anon";

grant delete on table "public"."assets" to "authenticated";

grant insert on table "public"."assets" to "authenticated";

grant references on table "public"."assets" to "authenticated";

grant select on table "public"."assets" to "authenticated";

grant trigger on table "public"."assets" to "authenticated";

grant truncate on table "public"."assets" to "authenticated";

grant update on table "public"."assets" to "authenticated";

grant delete on table "public"."assets" to "service_role";

grant insert on table "public"."assets" to "service_role";

grant references on table "public"."assets" to "service_role";

grant select on table "public"."assets" to "service_role";

grant trigger on table "public"."assets" to "service_role";

grant truncate on table "public"."assets" to "service_role";

grant update on table "public"."assets" to "service_role";

grant delete on table "public"."expenses" to "anon";

grant insert on table "public"."expenses" to "anon";

grant references on table "public"."expenses" to "anon";

grant select on table "public"."expenses" to "anon";

grant trigger on table "public"."expenses" to "anon";

grant truncate on table "public"."expenses" to "anon";

grant update on table "public"."expenses" to "anon";

grant delete on table "public"."expenses" to "authenticated";

grant insert on table "public"."expenses" to "authenticated";

grant references on table "public"."expenses" to "authenticated";

grant select on table "public"."expenses" to "authenticated";

grant trigger on table "public"."expenses" to "authenticated";

grant truncate on table "public"."expenses" to "authenticated";

grant update on table "public"."expenses" to "authenticated";

grant delete on table "public"."expenses" to "service_role";

grant insert on table "public"."expenses" to "service_role";

grant references on table "public"."expenses" to "service_role";

grant select on table "public"."expenses" to "service_role";

grant trigger on table "public"."expenses" to "service_role";

grant truncate on table "public"."expenses" to "service_role";

grant update on table "public"."expenses" to "service_role";

grant delete on table "public"."income" to "anon";

grant insert on table "public"."income" to "anon";

grant references on table "public"."income" to "anon";

grant select on table "public"."income" to "anon";

grant trigger on table "public"."income" to "anon";

grant truncate on table "public"."income" to "anon";

grant update on table "public"."income" to "anon";

grant delete on table "public"."income" to "authenticated";

grant insert on table "public"."income" to "authenticated";

grant references on table "public"."income" to "authenticated";

grant select on table "public"."income" to "authenticated";

grant trigger on table "public"."income" to "authenticated";

grant truncate on table "public"."income" to "authenticated";

grant update on table "public"."income" to "authenticated";

grant delete on table "public"."income" to "service_role";

grant insert on table "public"."income" to "service_role";

grant references on table "public"."income" to "service_role";

grant select on table "public"."income" to "service_role";

grant trigger on table "public"."income" to "service_role";

grant truncate on table "public"."income" to "service_role";

grant update on table "public"."income" to "service_role";

grant delete on table "public"."lease_contracts" to "anon";

grant insert on table "public"."lease_contracts" to "anon";

grant references on table "public"."lease_contracts" to "anon";

grant select on table "public"."lease_contracts" to "anon";

grant trigger on table "public"."lease_contracts" to "anon";

grant truncate on table "public"."lease_contracts" to "anon";

grant update on table "public"."lease_contracts" to "anon";

grant delete on table "public"."lease_contracts" to "authenticated";

grant insert on table "public"."lease_contracts" to "authenticated";

grant references on table "public"."lease_contracts" to "authenticated";

grant select on table "public"."lease_contracts" to "authenticated";

grant trigger on table "public"."lease_contracts" to "authenticated";

grant truncate on table "public"."lease_contracts" to "authenticated";

grant update on table "public"."lease_contracts" to "authenticated";

grant delete on table "public"."lease_contracts" to "service_role";

grant insert on table "public"."lease_contracts" to "service_role";

grant references on table "public"."lease_contracts" to "service_role";

grant select on table "public"."lease_contracts" to "service_role";

grant trigger on table "public"."lease_contracts" to "service_role";

grant truncate on table "public"."lease_contracts" to "service_role";

grant update on table "public"."lease_contracts" to "service_role";

grant delete on table "public"."lease_payments" to "anon";

grant insert on table "public"."lease_payments" to "anon";

grant references on table "public"."lease_payments" to "anon";

grant select on table "public"."lease_payments" to "anon";

grant trigger on table "public"."lease_payments" to "anon";

grant truncate on table "public"."lease_payments" to "anon";

grant update on table "public"."lease_payments" to "anon";

grant delete on table "public"."lease_payments" to "authenticated";

grant insert on table "public"."lease_payments" to "authenticated";

grant references on table "public"."lease_payments" to "authenticated";

grant select on table "public"."lease_payments" to "authenticated";

grant trigger on table "public"."lease_payments" to "authenticated";

grant truncate on table "public"."lease_payments" to "authenticated";

grant update on table "public"."lease_payments" to "authenticated";

grant delete on table "public"."lease_payments" to "service_role";

grant insert on table "public"."lease_payments" to "service_role";

grant references on table "public"."lease_payments" to "service_role";

grant select on table "public"."lease_payments" to "service_role";

grant trigger on table "public"."lease_payments" to "service_role";

grant truncate on table "public"."lease_payments" to "service_role";

grant update on table "public"."lease_payments" to "service_role";

grant delete on table "public"."odometer_photos" to "anon";

grant insert on table "public"."odometer_photos" to "anon";

grant references on table "public"."odometer_photos" to "anon";

grant select on table "public"."odometer_photos" to "anon";

grant trigger on table "public"."odometer_photos" to "anon";

grant truncate on table "public"."odometer_photos" to "anon";

grant update on table "public"."odometer_photos" to "anon";

grant delete on table "public"."odometer_photos" to "authenticated";

grant insert on table "public"."odometer_photos" to "authenticated";

grant references on table "public"."odometer_photos" to "authenticated";

grant select on table "public"."odometer_photos" to "authenticated";

grant trigger on table "public"."odometer_photos" to "authenticated";

grant truncate on table "public"."odometer_photos" to "authenticated";

grant update on table "public"."odometer_photos" to "authenticated";

grant delete on table "public"."odometer_photos" to "service_role";

grant insert on table "public"."odometer_photos" to "service_role";

grant references on table "public"."odometer_photos" to "service_role";

grant select on table "public"."odometer_photos" to "service_role";

grant trigger on table "public"."odometer_photos" to "service_role";

grant truncate on table "public"."odometer_photos" to "service_role";

grant update on table "public"."odometer_photos" to "service_role";

grant delete on table "public"."paystubs" to "anon";

grant insert on table "public"."paystubs" to "anon";

grant references on table "public"."paystubs" to "anon";

grant select on table "public"."paystubs" to "anon";

grant trigger on table "public"."paystubs" to "anon";

grant truncate on table "public"."paystubs" to "anon";

grant update on table "public"."paystubs" to "anon";

grant delete on table "public"."paystubs" to "authenticated";

grant insert on table "public"."paystubs" to "authenticated";

grant references on table "public"."paystubs" to "authenticated";

grant select on table "public"."paystubs" to "authenticated";

grant trigger on table "public"."paystubs" to "authenticated";

grant truncate on table "public"."paystubs" to "authenticated";

grant update on table "public"."paystubs" to "authenticated";

grant delete on table "public"."paystubs" to "service_role";

grant insert on table "public"."paystubs" to "service_role";

grant references on table "public"."paystubs" to "service_role";

grant select on table "public"."paystubs" to "service_role";

grant trigger on table "public"."paystubs" to "service_role";

grant truncate on table "public"."paystubs" to "service_role";

grant update on table "public"."paystubs" to "service_role";

grant delete on table "public"."questionnaire_responses" to "anon";

grant insert on table "public"."questionnaire_responses" to "anon";

grant references on table "public"."questionnaire_responses" to "anon";

grant select on table "public"."questionnaire_responses" to "anon";

grant trigger on table "public"."questionnaire_responses" to "anon";

grant truncate on table "public"."questionnaire_responses" to "anon";

grant update on table "public"."questionnaire_responses" to "anon";

grant delete on table "public"."questionnaire_responses" to "authenticated";

grant insert on table "public"."questionnaire_responses" to "authenticated";

grant references on table "public"."questionnaire_responses" to "authenticated";

grant select on table "public"."questionnaire_responses" to "authenticated";

grant trigger on table "public"."questionnaire_responses" to "authenticated";

grant truncate on table "public"."questionnaire_responses" to "authenticated";

grant update on table "public"."questionnaire_responses" to "authenticated";

grant delete on table "public"."questionnaire_responses" to "service_role";

grant insert on table "public"."questionnaire_responses" to "service_role";

grant references on table "public"."questionnaire_responses" to "service_role";

grant select on table "public"."questionnaire_responses" to "service_role";

grant trigger on table "public"."questionnaire_responses" to "service_role";

grant truncate on table "public"."questionnaire_responses" to "service_role";

grant update on table "public"."questionnaire_responses" to "service_role";

grant delete on table "public"."receipts" to "anon";

grant insert on table "public"."receipts" to "anon";

grant references on table "public"."receipts" to "anon";

grant select on table "public"."receipts" to "anon";

grant trigger on table "public"."receipts" to "anon";

grant truncate on table "public"."receipts" to "anon";

grant update on table "public"."receipts" to "anon";

grant delete on table "public"."receipts" to "authenticated";

grant insert on table "public"."receipts" to "authenticated";

grant references on table "public"."receipts" to "authenticated";

grant select on table "public"."receipts" to "authenticated";

grant trigger on table "public"."receipts" to "authenticated";

grant truncate on table "public"."receipts" to "authenticated";

grant update on table "public"."receipts" to "authenticated";

grant delete on table "public"."receipts" to "service_role";

grant insert on table "public"."receipts" to "service_role";

grant references on table "public"."receipts" to "service_role";

grant select on table "public"."receipts" to "service_role";

grant trigger on table "public"."receipts" to "service_role";

grant truncate on table "public"."receipts" to "service_role";

grant update on table "public"."receipts" to "service_role";

grant delete on table "public"."tax_questionnaires" to "anon";

grant insert on table "public"."tax_questionnaires" to "anon";

grant references on table "public"."tax_questionnaires" to "anon";

grant select on table "public"."tax_questionnaires" to "anon";

grant trigger on table "public"."tax_questionnaires" to "anon";

grant truncate on table "public"."tax_questionnaires" to "anon";

grant update on table "public"."tax_questionnaires" to "anon";

grant delete on table "public"."tax_questionnaires" to "authenticated";

grant insert on table "public"."tax_questionnaires" to "authenticated";

grant references on table "public"."tax_questionnaires" to "authenticated";

grant select on table "public"."tax_questionnaires" to "authenticated";

grant trigger on table "public"."tax_questionnaires" to "authenticated";

grant truncate on table "public"."tax_questionnaires" to "authenticated";

grant update on table "public"."tax_questionnaires" to "authenticated";

grant delete on table "public"."tax_questionnaires" to "service_role";

grant insert on table "public"."tax_questionnaires" to "service_role";

grant references on table "public"."tax_questionnaires" to "service_role";

grant select on table "public"."tax_questionnaires" to "service_role";

grant trigger on table "public"."tax_questionnaires" to "service_role";

grant truncate on table "public"."tax_questionnaires" to "service_role";

grant update on table "public"."tax_questionnaires" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."vehicle_mileage_logs" to "anon";

grant insert on table "public"."vehicle_mileage_logs" to "anon";

grant references on table "public"."vehicle_mileage_logs" to "anon";

grant select on table "public"."vehicle_mileage_logs" to "anon";

grant trigger on table "public"."vehicle_mileage_logs" to "anon";

grant truncate on table "public"."vehicle_mileage_logs" to "anon";

grant update on table "public"."vehicle_mileage_logs" to "anon";

grant delete on table "public"."vehicle_mileage_logs" to "authenticated";

grant insert on table "public"."vehicle_mileage_logs" to "authenticated";

grant references on table "public"."vehicle_mileage_logs" to "authenticated";

grant select on table "public"."vehicle_mileage_logs" to "authenticated";

grant trigger on table "public"."vehicle_mileage_logs" to "authenticated";

grant truncate on table "public"."vehicle_mileage_logs" to "authenticated";

grant update on table "public"."vehicle_mileage_logs" to "authenticated";

grant delete on table "public"."vehicle_mileage_logs" to "service_role";

grant insert on table "public"."vehicle_mileage_logs" to "service_role";

grant references on table "public"."vehicle_mileage_logs" to "service_role";

grant select on table "public"."vehicle_mileage_logs" to "service_role";

grant trigger on table "public"."vehicle_mileage_logs" to "service_role";

grant truncate on table "public"."vehicle_mileage_logs" to "service_role";

grant update on table "public"."vehicle_mileage_logs" to "service_role";

grant delete on table "public"."vehicles" to "anon";

grant insert on table "public"."vehicles" to "anon";

grant references on table "public"."vehicles" to "anon";

grant select on table "public"."vehicles" to "anon";

grant trigger on table "public"."vehicles" to "anon";

grant truncate on table "public"."vehicles" to "anon";

grant update on table "public"."vehicles" to "anon";

grant delete on table "public"."vehicles" to "authenticated";

grant insert on table "public"."vehicles" to "authenticated";

grant references on table "public"."vehicles" to "authenticated";

grant select on table "public"."vehicles" to "authenticated";

grant trigger on table "public"."vehicles" to "authenticated";

grant truncate on table "public"."vehicles" to "authenticated";

grant update on table "public"."vehicles" to "authenticated";

grant delete on table "public"."vehicles" to "service_role";

grant insert on table "public"."vehicles" to "service_role";

grant references on table "public"."vehicles" to "service_role";

grant select on table "public"."vehicles" to "service_role";

grant trigger on table "public"."vehicles" to "service_role";

grant truncate on table "public"."vehicles" to "service_role";

grant update on table "public"."vehicles" to "service_role";


