import express from "express";
import fetch from "node-fetch";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// =============================================================================
// Environment Configuration (IIS-Ready)
// =============================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function normalizePrefix(prefix) {
  if (!prefix) return "";
  const trimmed = String(prefix).trim();
  if (!trimmed || trimmed === "/") return "";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function prefixedPath(appPrefix, path) {
  if (!appPrefix) return path;
  if (path === "/") return appPrefix;
  return `${appPrefix}${path}`;
}

const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  appPrefix: normalizePrefix(process.env.APPLICATION_PREFIX || ""),
  upstreamUrl:
    process.env.UPSTREAM_URL ||
    "http://127.0.0.1/HelpE/Prod/api/Ticket/GetMonthlyTicketStats",
  // Do NOT ship tokens in source. Set via environment variables (e.g. IIS web.config)
  authToken: process.env.AUTH_TOKEN || "",
  logLevel: (process.env.LOG_LEVEL || "INFO").toUpperCase(),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
};

// =============================================================================
// Logging Configuration
// =============================================================================
const LOG_TAG = "[TICKET-PROXY]";

const LOG_CATEGORIES = {
  API_REQUEST: { enabled: true, description: "Incoming API requests" },
  API_RESPONSE: { enabled: true, description: "API response details" },
  UPSTREAM_CALL: { enabled: true, description: "External API calls" },
  ERROR: { enabled: true, description: "Error handling" },
  PERFORMANCE: { enabled: true, description: "Request timing metrics" },
  SERVER: { enabled: true, description: "Server lifecycle events" },
};

const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

function isCategoryEnabled(category) {
  const cat = String(category).replace(/[\[\]]/g, "").toUpperCase();
  return LOG_CATEGORIES[cat]?.enabled ?? false;
}

function isLevelEnabled(level) {
  const configured = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.INFO;
  const incoming = LOG_LEVELS[String(level).toUpperCase()] ?? LOG_LEVELS.INFO;
  return incoming >= configured;
}

function log(level, category, message, data = null) {
  if (!isLevelEnabled(level)) return;
  if (!isCategoryEnabled(category)) return;

  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} - ${String(level).toUpperCase()} - ${LOG_TAG}[${category}]`;

  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

const logger = {
  info: (category, message, data) => log("INFO", category, message, data),
  debug: (category, message, data) => log("DEBUG", category, message, data),
  warn: (category, message, data) => log("WARN", category, message, data),
  error: (category, message, data) => log("ERROR", category, message, data),
};

// Mask sensitive data in logs
function maskToken(token) {
  if (!token || token.length < 20) return "[MASKED]";
  return token.substring(0, 10) + "..." + token.substring(token.length - 10);
}

// =============================================================================
// Express App Setup
// =============================================================================
const app = express();
app.use(express.json());

// Request ID and timing middleware
app.use((req, _res, next) => {
  req.requestId = randomUUID().substring(0, 8);
  req.startTime = Date.now();
  next();
});

// Allow browser to call this proxy (avoid CORS issues)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();

  logger.info("API_REQUEST", `[${req.requestId}] ${req.method} ${req.path}`, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    origin: req.headers.origin || "unknown",
    userAgent: req.headers["user-agent"],
  });

  res.on("finish", () => {
    const duration = Date.now() - req.startTime;
    logger.info("PERFORMANCE", `[${req.requestId}] Request completed`, {
      requestId: req.requestId,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
});

// =============================================================================
// Health and Diagnostic Endpoints (for IIS monitoring)
// =============================================================================

app.get(prefixedPath(config.appPrefix, "/"), (_req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.get(prefixedPath(config.appPrefix, "/health"), (_req, res) => {
  res.json({
    status: "healthy",
    service: "ticket-proxy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    appPrefix: config.appPrefix || "(root)",
  });
});

app.get(prefixedPath(config.appPrefix, "/diag"), (_req, res) => {
  res.json({
    environment: {
      NODE_ENV: config.nodeEnv,
      APPLICATION_PREFIX: config.appPrefix,
      LOG_LEVEL: config.logLevel,
      UPSTREAM_URL: config.upstreamUrl,
      AUTH_TOKEN_SET: !!config.authToken,
      PUBLIC_BASE_URL: config.publicBaseUrl ? "[SET]" : "[NOT_SET]",
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cwd: process.cwd(),
    },
    server: {
      port: config.port,
      isIIS: !!process.env.IISNODE_VERSION,
      iisnodeVersion: process.env.IISNODE_VERSION || "N/A",
    },
  });
});

// =============================================================================
// Main API Endpoint
// =============================================================================

app.post(prefixedPath(config.appPrefix, "/tickets"), async (req, res) => {
  const requestId = req.requestId;

  try {
    logger.info("API_REQUEST", `[${requestId}] Request body received`, {
      requestId,
      body: req.body,
    });

    if (!config.authToken) {
      logger.error("ERROR", `[${requestId}] AUTH_TOKEN missing`, {
        requestId,
        hint: "Set AUTH_TOKEN in environment variables (e.g. IIS web.config).",
      });
      return res.status(500).json({ error: "AUTH_TOKEN is not configured" });
    }

    const upstreamStartTime = Date.now();
    logger.info("UPSTREAM_CALL", `[${requestId}] Calling upstream API`, {
      requestId,
      url: config.upstreamUrl,
      method: "POST",
      token: maskToken(config.authToken),
    });

    const apiResponse = await fetch(config.upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.authToken,
      },
      body: JSON.stringify(req.body),
    });

    const upstreamDuration = Date.now() - upstreamStartTime;
    const text = await apiResponse.text();

    logger.info("UPSTREAM_CALL", `[${requestId}] Upstream response received`, {
      requestId,
      status: apiResponse.status,
      statusText: apiResponse.statusText,
      durationMs: upstreamDuration,
      responseSize: text.length,
    });

    logger.info("API_RESPONSE", `[${requestId}] Sending response to client`, {
      requestId,
      status: apiResponse.status,
    });

    const contentType = apiResponse.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);
    res.status(apiResponse.status).send(text);
  } catch (err) {
    logger.error("ERROR", `[${requestId}] Request failed`, {
      requestId,
      error: err?.message,
      stack: err?.stack,
      name: err?.name,
      cause: err?.cause?.message,
    });

    res.status(500).json({ error: err?.message || "Unknown error" });
  }
});

// =============================================================================
// Server Startup
// =============================================================================

app.listen(config.port, () => {
  const isIIS = !!process.env.IISNODE_VERSION;

  const base =
    config.publicBaseUrl ||
    (isIIS ? "https://ai.milgam.co.il" : `http://localhost:${config.port}`);

  const baseUrl = config.appPrefix ? `${base}${config.appPrefix}` : base;

  logger.info("SERVER", `Server started`, {
    port: config.port,
    environment: config.nodeEnv,
    isIIS,
    iisnodeVersion: process.env.IISNODE_VERSION || "N/A",
    appPrefix: config.appPrefix || "(root)",
    endpoints: {
      tickets: `${baseUrl}/tickets`,
      health: `${baseUrl}/health`,
      diag: `${baseUrl}/diag`,
    },
    upstreamUrl: config.upstreamUrl,
    authToken: config.authToken ? maskToken(config.authToken) : "[NOT_SET]",
    logLevel: config.logLevel,
    logCategories: Object.entries(LOG_CATEGORIES)
      .filter(([_, v]) => v.enabled)
      .map(([k]) => k),
  });

  console.log(`[TICKET-PROXY] Server running at ${baseUrl}`);
  console.log(`[TICKET-PROXY] POST ${baseUrl}/tickets - Proxy endpoint`);
  console.log(`[TICKET-PROXY] GET  ${baseUrl}/health - Health check`);
  console.log(`[TICKET-PROXY] GET  ${baseUrl}/diag - Diagnostics`);
});

