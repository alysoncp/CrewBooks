import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const storage = typeof window !== "undefined" ? window.localStorage : undefined;

const globalKey = "__crewbooks_supabase";
const globalAny = globalThis as typeof globalThis & {
  [globalKey]?: SupabaseClient;
};

export const supabase =
  globalAny[globalKey] ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage,
    },
  });

if (!globalAny[globalKey]) {
  globalAny[globalKey] = supabase;
}
