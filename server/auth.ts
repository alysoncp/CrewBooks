import type { Express, RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, decodeProtectedHeader } from "jose";

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

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
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

    const header = decodeProtectedHeader(token);
    const isHs = header.alg?.startsWith("HS");
    const { payload } = isHs
      ? await jwtVerify(token, getJwtSecret(), {
          // aud/iss checks can be added if required
        })
      : await jwtVerify(token, await getJwks(), {
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

