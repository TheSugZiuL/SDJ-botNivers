const crypto = require("crypto");

const COOKIE_NAME = "bot_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseBoolean(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;
  for (const part of String(headerValue).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  res.append("Set-Cookie", parts.join("; "));
}

function timingSafeEqualString(a, b) {
  const aBuf = Buffer.from(String(a || ""), "utf8");
  const bBuf = Buffer.from(String(b || ""), "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string") {
    return proto.split(",")[0].trim().toLowerCase() === "https";
  }
  return false;
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function splitHostPort(hostHeader) {
  const raw = String(hostHeader || "").trim().toLowerCase();
  if (!raw) return { hostname: "", port: "" };
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end < 0) return { hostname: raw, port: "" };
    const hostname = raw.slice(0, end + 1);
    const port = raw.slice(end + 1).startsWith(":") ? raw.slice(end + 2) : "";
    return { hostname, port };
  }
  const lastColon = raw.lastIndexOf(":");
  if (lastColon > -1 && raw.indexOf(":") === lastColon) {
    return { hostname: raw.slice(0, lastColon), port: raw.slice(lastColon + 1) };
  }
  return { hostname: raw, port: "" };
}

function isAllowedOriginForRequest(origin, req) {
  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const reqHost = req.get("host");
  if (!reqHost) return false;
  const expectedProto = isSecureRequest(req) ? "https:" : "http:";
  const { hostname: reqHostname, port: reqPort } = splitHostPort(reqHost);
  const originHostname = String(originUrl.hostname || "").toLowerCase();
  const originPort = String(originUrl.port || "");

  if (originUrl.protocol !== expectedProto) return false;

  if (originHostname === reqHostname && originPort === reqPort) {
    return true;
  }

  // Desenvolvimento local: permite alternar localhost/127.0.0.1/::1 na mesma porta.
  if (isLoopbackHostname(originHostname) && isLoopbackHostname(reqHostname) && originPort === reqPort) {
    return true;
  }

  return false;
}

function createStrictHeadersMiddleware({ isProduction }) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' https: data:",
        "style-src 'self'",
        "script-src 'self'"
      ].join("; ")
    );
    if (isProduction && isSecureRequest(req)) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}

function createHttpsRedirectMiddleware({ enabled }) {
  return (req, res, next) => {
    if (!enabled || isSecureRequest(req)) return next();
    const host = req.get("host");
    if (!host) return next();
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  };
}

function createRateLimitMiddleware({ windowMs = 60_000, maxPerWindow = 120, maxPostPerWindow = 30 }) {
  const store = new Map();

  return (req, res, next) => {
    const key = getClientIp(req);
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.startedAt > windowMs) {
      entry = { startedAt: now, total: 0, writes: 0 };
      store.set(key, entry);
    }

    entry.total += 1;
    if (!SAFE_METHODS.has(req.method)) entry.writes += 1;

    if (entry.total > maxPerWindow || entry.writes > maxPostPerWindow) {
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      return res.status(429).send("Muitas requisicoes. Tente novamente em instantes.");
    }

    if (store.size > 5000) {
      for (const [ip, item] of store.entries()) {
        if (now - item.startedAt > windowMs) store.delete(ip);
      }
    }
    next();
  };
}

function createIpAllowlistMiddleware({ allowlist }) {
  const allowed = new Set((allowlist || []).filter(Boolean));
  if (!allowed.size) return (req, res, next) => next();

  return (req, res, next) => {
    const ip = getClientIp(req);
    if (allowed.has(ip)) return next();
    return res.status(403).send("Acesso bloqueado por IP.");
  };
}

function createCsrfMiddleware({ cookieSecure, checkOrigin }) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    let token = cookies[COOKIE_NAME];
    if (!token || token.length < 32) {
      token = crypto.randomBytes(32).toString("hex");
      setCookie(res, COOKIE_NAME, token, {
        path: "/",
        httpOnly: true,
        secure: cookieSecure,
        sameSite: "Strict",
        maxAge: 60 * 60 * 24 * 30
      });
    }

    res.locals.csrfToken = token;

    if (SAFE_METHODS.has(req.method)) return next();

    const bodyToken = req.body && typeof req.body._csrf === "string" ? req.body._csrf : "";
    const headerToken = typeof req.headers["x-csrf-token"] === "string" ? req.headers["x-csrf-token"] : "";
    const submittedToken = bodyToken || headerToken;

    if (!submittedToken || !timingSafeEqualString(submittedToken, token)) {
      return res.status(403).send("CSRF token invalido.");
    }

    if (checkOrigin) {
      const origin = req.get("origin");
      const referer = req.get("referer");
      if (origin && !isAllowedOriginForRequest(origin, req)) {
        return res.status(403).send("Origem da requisicao nao permitida.");
      }
      if (!origin && referer && !isAllowedOriginForRequest(referer, req)) {
        return res.status(403).send("Referer da requisicao nao permitido.");
      }
    }

    next();
  };
}

function assertSecurityConfig(config) {
  if (!config.isProduction) return;

  if (!config.panelAuthEnabled) {
    throw new Error("Em producao, habilite PANEL_BASIC_AUTH_ENABLED (protege o painel via login).");
  }
  if (!config.panelAuthUser || !config.panelAuthPassword) {
    throw new Error("Em producao, configure PANEL_LOGIN_USER e PANEL_LOGIN_PASSWORD.");
  }
  if (String(config.panelAuthPassword).length < 16) {
    throw new Error("Use PANEL_LOGIN_PASSWORD com pelo menos 16 caracteres em producao.");
  }
  if (!config.panelSessionSecret || String(config.panelSessionSecret).length < 32) {
    throw new Error("Configure PANEL_SESSION_SECRET com pelo menos 32 caracteres em producao.");
  }
}

function buildSecurityMiddlewares(config) {
  assertSecurityConfig(config);

  const cookieSecure = config.isProduction || parseBoolean(process.env.COOKIE_SECURE, false);

  return [
    createHttpsRedirectMiddleware({ enabled: config.requireHttps }),
    createStrictHeadersMiddleware({ isProduction: config.isProduction }),
    createRateLimitMiddleware({}),
    createIpAllowlistMiddleware({ allowlist: config.panelIpAllowlist }),
    createCsrfMiddleware({ cookieSecure, checkOrigin: config.csrfCheckOrigin })
  ];
}

module.exports = {
  buildSecurityMiddlewares
};
