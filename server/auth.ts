import type { Express } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE ROLE SUPABASE CLIENT
 * 
 * ⚠️ IMPORTANT: This client uses the service role key and bypasses RLS.
 * Use ONLY for:
 * - Admin operations (e.g., creating users during signup)
 * - Seed/migration tasks
 * - Operations that genuinely need to bypass user-level access control
 * 
 * For regular app traffic, ALWAYS use the user-scoped client from middleware!
 */
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
    }
    
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

export async function setupAuth(app: Express) {
  // Stateless JWT auth – nothing to set up globally for now.
  app.set("trust proxy", 1);
}

