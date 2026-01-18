import type { Express, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
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

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    const auth = req.headers["authorization"] as string | undefined;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = auth.slice("Bearer ".length);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach a user compatible with existing code paths
    // Keep shape: { claims: <user data>, expires_at: <exp> }
    req.user = {
      claims: {
        sub: data.user.id,
        email: data.user.email,
        ...data.user.user_metadata,
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    // Additionally expose raw user data
    req.auth = data.user;

    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

