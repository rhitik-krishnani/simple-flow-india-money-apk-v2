import express from "express";
import path from "path";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import fs from "fs";
import {
  parseVoiceTransaction,
  extractStatementTransactions,
  extractMutualFundInvestments,
  parsePdfStatement,
  getFinancialAdvice
} from "./services/geminiServiceServer";
import {
  createTokenVerifier, requireAuth, requireAdmin, createCors, createRateLimiter, validateAIRequest, parseList, DEFAULT_ORIGINS
} from "./server/security";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000; // hosts such as Cloud Run / Render inject PORT
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // ---- Configuration (see .env.example)
  let projectId = process.env.FIREBASE_PROJECT_ID || "";
  if (!projectId) {
    try { projectId = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8")).projectId || ""; } catch { /* handled below */ }
  }
  const allowedOrigins = [...DEFAULT_ORIGINS, ...parseList(process.env.ALLOWED_ORIGINS)];
  const adminEmails = parseList(process.env.ADMIN_EMAILS);
  const aiConfigured = !!process.env.GEMINI_API_KEY && !!projectId;
  if (!projectId) console.warn("WARNING: FIREBASE_PROJECT_ID is not set. AI routes are disabled.");
  if (!process.env.GEMINI_API_KEY) console.warn("WARNING: GEMINI_API_KEY is not set. AI routes are disabled.");

  app.use(createCors(allowedOrigins));
  app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiConfigured }));

  const verify = createTokenVerifier(projectId || "unset");
  const auth = requireAuth(verify);
  const notConfigured: express.RequestHandler = (_req, res, next) =>
    aiConfigured ? next() : void res.status(503).json({ error: "AI is not set up on the server yet.", code: "not-configured" });
  const aiLimiter = createRateLimiter({ perMinute: Number(process.env.AI_PER_MINUTE) || 10, perDay: Number(process.env.AI_PER_DAY) || 100 });

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ 
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes

  // AI PROXY: signed-in users only, rate limited, payload validated, Gemini key never leaves the server
  const allowedActions: Record<string, Function> = {
    parseVoiceTransaction,
    extractStatementTransactions,
    extractMutualFundInvestments,
    parsePdfStatement,
    getFinancialAdvice
  };

  app.post("/api/gemini", notConfigured, auth, aiLimiter, express.json({ limit: "15mb" }), async (req, res) => {
    const { action, args } = req.body || {};
    if (typeof action !== "string" || !Object.prototype.hasOwnProperty.call(allowedActions, action)) {
      return res.status(404).json({ error: "Unsupported AI action." });
    }
    const invalid = validateAIRequest(action, args);
    if (invalid) return res.status(400).json({ error: invalid });
    try {
      console.log(`AI action=${action} uid=${req.user?.uid}`); // never log payloads: they contain financial data
      const result = await allowedActions[action](...args);
      res.json({ result });
    } catch (error: any) {
      console.error(`AI action failed [${action}]:`, error?.message || error);
      res.status(502).json({ error: "The AI service could not complete that request. Please try again." });
    }
  });

  // Video studio (Veo) is an internal marketing tool: admin only, and off unless ADMIN_EMAILS is configured.
  const videoGate: express.RequestHandler[] = [
    (_req, res, next) => (adminEmails.length ? next() : void res.status(404).json({ error: "Not found." })),
    notConfigured, auth, requireAdmin(adminEmails), createRateLimiter({ perMinute: 5, perDay: 30 }), express.json({ limit: "100kb" }),
  ];
  app.use(["/api/generate-video", "/api/video-status", "/api/video-download"], ...videoGate);

  // 1. Start Video Generation
  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt, aspectRatio, resolution } = req.body;
      
      if (!apiKey) {
        console.error("Missing Gemini API Key");
        return res.status(401).json({ error: "Missing Gemini API Key. Please configure it in Settings > Secrets." });
      }

      console.log(`Starting video gen: ${prompt} (${aspectRatio}, ${resolution})`);
      const operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt || 'Cinematic shot of a gold coin spinning on a high-tech glass table, futuristic financial data in background, 4k, hyper-realistic',
        config: {
          numberOfVideos: 1,
          resolution: resolution || '1080p',
          aspectRatio: aspectRatio || '16:9'
        }
      });

      console.log("Operation started:", operation.name);
      res.json({ operationName: operation.name });
    } catch (error: any) {
      console.error("Video Gen Start Error:", error);
      
      // Handle Quota/Rate limit specifically for pro user awareness
      if (error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({ 
          error: "Veo 3.1 Pro is currently at capacity. Even for Pro users, video generation has strict minute-by-minute quotas. Please wait 1-2 minutes and try again.",
          isRateLimit: true
        });
      }
      
      res.status(500).json({ error: error.message || "Internal Server Error during video generation start" });
    }
  });

  // 2. Poll Video Status
  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      const op = new GenerateVideosOperation();
      op.name = operationName;
      
      const updated = await ai.operations.getVideosOperation({ operation: op });
      res.json({ 
        done: updated.done, 
        status: updated.metadata?.state,
        progress: updated.metadata?.progressPercent 
      });
    } catch (error: any) {
      console.error("Video Status Error:", error);
      res.status(500).json({ error: "Video request failed." });
    }
  });

  // 3. Download Video (Proxy)
  app.get("/api/video-download", async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(401).json({ error: "Missing Gemini API Key" });
      }

      const operationName = req.query.name as string;
      if (!operationName) {
        return res.status(400).json({ error: "Operation name is required" });
      }
      
      const op = new GenerateVideosOperation();
      op.name = operationName;
      
      const updated = await ai.operations.getVideosOperation({ operation: op });
      
      if (!updated.done) {
        return res.status(400).json({ error: "Operation not complete" });
      }

      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        return res.status(404).json({ error: "Video URI not found" });
      }

      const videoRes = await fetch(uri, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!videoRes.ok) {
        const errText = await videoRes.text();
        console.error("Source video fetch failed:", errText);
        return res.status(videoRes.status).json({ error: "Failed to fetch video from source", details: errText });
      }

      res.setHeader('Content-Type', 'video/mp4');
      const opId = operationName.split('/').pop();
      res.setHeader('Content-Disposition', `attachment; filename="video_${opId}.mp4"`);

      if (videoRes.body) {
        // @ts-ignore - pipeTo might have type issues but works in this env
        await videoRes.body.pipeTo(
          new WritableStream({
            write(chunk) { res.write(chunk); },
            close() { res.end(); },
          })
        );
      } else {
        res.status(500).send("No video body received");
      }
      
    } catch (error: any) {
      console.error("Video Download Error:", error);
      res.status(500).json({ error: "Video request failed." });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import: vite is a dev dependency and must not be required when running in production.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Never leak stack traces or internals to clients
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "That file is too large." });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
    console.error("Unhandled server error:", err?.message || err);
    res.status(500).json({ error: "Something went wrong." });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
