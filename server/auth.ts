import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Auto-create sessions table
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only use secure cookies in production
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

// Simple development auth - replace with Supabase Auth or another provider for production
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Simple login endpoint for development
  // TODO: Replace with proper authentication (Supabase Auth, etc.)
  app.post("/api/login", async (req, res) => {
    try {
      console.log("[LOGIN] Login request received");
      const { email } = req.body;
      console.log("[LOGIN] Email:", email);
      
      if (!email) {
        console.log("[LOGIN] Missing email, returning 400");
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if SESSION_SECRET is set
      if (!process.env.SESSION_SECRET) {
        console.error("SESSION_SECRET environment variable is not set");
        return res.status(500).json({ message: "Server configuration error: SESSION_SECRET not set" });
      }

      // Get or create user
      let user;
      try {
        console.log("[LOGIN] Looking up user in database...");
        user = await storage.getUserByEmail(email);
        if (!user) {
          console.log("[LOGIN] User not found, creating new user...");
          // Create a new user for development
          user = await storage.upsertUser({
            id: `dev-${Date.now()}`,
            email,
            firstName: "Dev",
            lastName: "User",
          });
          console.log("[LOGIN] New user created:", user.id);
        } else {
          console.log("[LOGIN] Existing user found:", user.id);
        }
      } catch (dbError) {
        console.error("[LOGIN] Database error during login:", dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        const errorStack = dbError instanceof Error ? dbError.stack : undefined;
        console.error("[LOGIN] Error stack:", errorStack);
        
        // Check for specific database connection errors
        if (errorMessage.includes("connection") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("timeout")) {
          return res.status(500).json({ 
            message: "Database connection failed. Please check your DATABASE_URL and ensure the database server is running.",
            details: errorMessage
          });
        }
        
        // Check for authentication errors
        if (errorMessage.includes("password authentication failed") || errorMessage.includes("login") || errorMessage.toLowerCase().includes("authentication")) {
          return res.status(500).json({ 
            message: "Database authentication failed. Please check your DATABASE_URL credentials (username and password).",
            details: errorMessage
          });
        }
        
        // Check for database not found errors
        if (errorMessage.includes("database") && (errorMessage.includes("does not exist") || errorMessage.includes("not found"))) {
          return res.status(500).json({ 
            message: "Database not found. Please check that the database name in your DATABASE_URL is correct.",
            details: errorMessage
          });
        }
        
        return res.status(500).json({ 
          message: "Database error during login",
          details: errorMessage
        });
      }

      // Set up session
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[LOGIN] Passport login error:", err);
          return res.status(500).json({ 
            message: "Failed to create session",
            details: err instanceof Error ? err.message : String(err)
          });
        }
        console.log("[LOGIN] Login successful for user:", user.email);
        res.json({ user, message: "Logged in successfully" });
      });
    } catch (error) {
      console.error("Unexpected login error:", error);
      res.status(500).json({ 
        message: "Login failed",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    console.log("[AUTH] Authentication check failed - not authenticated or no user");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if token is expired (for development, we'll just check if user exists)
  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now > user.expires_at) {
    console.log("[AUTH] Session expired");
    return res.status(401).json({ message: "Session expired" });
  }

  console.log("[AUTH] User authenticated:", user.claims.sub);
  return next();
};

