import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl) {
  throw new Error(
    "VITE_SUPABASE_URL is required. Please set it in your .env file.\n" +
    "For local development, use: http://localhost:54321\n" +
    "Get your keys by running: supabase status"
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_ANON_KEY is required. Please set it in your .env file.\n" +
    "Get your keys by running: supabase status"
  );
}

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
