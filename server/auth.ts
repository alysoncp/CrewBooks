import type { Express, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }
    const jwksUrl = new URL("/auth/v1/keys", supabaseUrl).toString();
    jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwks;
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

    const verifier = await getJwks();
    const { payload } = await jwtVerify(token, verifier, {
      // aud/iss checks can be added if required
    });

    // Attach a user compatible with existing code paths
    // Keep shape: { claims: <payload>, expires_at: <exp> }
    req.user = {
      claims: payload,
      expires_at: payload.exp,
    };

    // Additionally expose raw claims for new code
    req.auth = payload as JWTPayload;

    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

