// Load dotenv FIRST, before any other imports
import * as dotenv from "dotenv";
dotenv.config();

// Now import everything else
import express, { NextFunction, type Request, Response } from "express";
import { createServer } from "http";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as veryfiOcr from "./veryfi-ocr";

const { validateVeryfiCredentials } = veryfiOcr as any;

const app = express();
const httpServer = createServer(app);

// Add health check endpoint BEFORE any middleware
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});


// Security middleware with development-aware CSP
// In development, Vite needs inline scripts for hot module reloading
// In production, we use a strict CSP
const isDev = process.env.NODE_ENV === "development";

app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
  
            // ✅ allow browser -> Supabase API/Auth/Storage
            connectSrc: [
              "'self'",
              "https://zurwoqrlvbcvmbxggocv.supabase.co",
              // ✅ only needed if you use Supabase Realtime
              "wss://zurwoqrlvbcvmbxggocv.supabase.co",
            ],
  
            // optional but commonly needed if you load Google Fonts
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          },
        },
  })
  
);

// Rate limiting for auth endpoints (login/signup only)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs - increased from 5
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit GET requests to /api/auth/user (checking session)
    return req.method === "GET" && req.path === "/user";
  },
});

// Rate limiting for general API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute - increased from 100
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply auth rate limiter to auth endpoints
app.use("/api/auth", authLimiter);

// Apply general rate limiter to API (but not uploads)
app.use((req, res, next) => {
  if (!req.path.startsWith("/uploads")) {
    apiLimiter(req, res, next);
  } else {
    next();
  }
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
    limit: "10mb", // Limit request body size
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

export function log(message: string, source = "express") {
  // Logging disabled
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Import routes AFTER dotenv has loaded
  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Check if headers have already been sent
    if (res.headersSent) {
      return _next(err);
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Don't throw the error after sending the response
  });

  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Validate Veryfi credentials on startup
  validateVeryfiCredentials();

  const port = parseInt(process.env.PORT || "5000", 10);
  // Listen on 0.0.0.0 to accept connections from other devices on the network
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    console.log(`Backend server running on http://localhost:${port}`);
    console.log(`Accessible from network at http://192.168.1.80:${port}`);
  });
})();