import { type Express } from "express";
import { createServer as createViteServer, createLogger, loadEnv } from "vite";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  // Load environment variables from project root
  const mode = process.env.NODE_ENV || "development";
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const env = loadEnv(mode, projectRoot, "VITE_");
  
  // Validate required environment variables
  if (!env.VITE_SUPABASE_URL) {
    console.error("ERROR: VITE_SUPABASE_URL is not set in .env file");
    console.error(`Looking in: ${projectRoot}`);
    console.error("Please add VITE_SUPABASE_URL to your .env file in the project root");
  }
  if (!env.VITE_SUPABASE_ANON_KEY) {
    console.error("ERROR: VITE_SUPABASE_ANON_KEY is not set in .env file");
    console.error(`Looking in: ${projectRoot}`);
    console.error("Please add VITE_SUPABASE_ANON_KEY to your .env file in the project root");
  }
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  // Use the config file normally - Vite will process it and load env vars
  const vite = await createViteServer({
    configFile: path.resolve(projectRoot, "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Only serve HTML for non-API routes
  app.use("*", async (req, res, next) => {
    // Skip API routes - let Express handle them
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
