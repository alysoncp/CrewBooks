import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

/**
 * AuthedRequest extends Express Request with authentication data.
 * Each request gets its own user-scoped Supabase client.
 */
export type AuthedRequest = Request & {
  auth: {
    userId: string;
    email?: string;
    accessToken: string;
  };
  supabase: any; // Supabase client type
};

/**
 * requireUser middleware: Core of the security system
 * 
 * What it does:
 * 1. Extracts Authorization: Bearer <token> from request
 * 2. Creates a user-scoped Supabase client using that token
 * 3. Verifies the token and extracts user identity
 * 4. Attaches req.auth and req.supabase for route handlers
 * 
 * Why this is secure:
 * - User identity comes only from verified JWT, never client input
 * - All DB queries run under user's JWT (RLS enforced automatically)
 * - Service role key stays on server (not used for regular queries)
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    
    if (!match) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const accessToken = match[1];

    // Create a request-scoped client that uses the user's JWT.
    // All queries through this client will be subject to RLS policies.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // Verify the token by calling auth.getUser()
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach auth info and user-scoped client to request
    (req as AuthedRequest).auth = {
      userId: data.user.id,
      email: data.user.email ?? undefined,
      accessToken,
    };
    (req as AuthedRequest).supabase = supabase;

    return next();
  } catch (e) {
    console.error("[requireUser] Unexpected error:", e);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
