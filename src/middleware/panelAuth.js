const crypto = require("crypto");

const SESSION_COOKIE = "bot_panel_session";
const sessions = new Map();
const loginFailures = new Map();

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;
  for (const part of String(headerValue).split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
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

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function signSessionId(sessionId, secret) {
  return `${sessionId}.${hmac(secret, sessionId)}`;
}

function verifySignedSessionId(signedValue, secret) {
  const raw = String(signedValue || "");
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = hmac(secret, sessionId);
  if (!timingSafeEqualString(signature, expected)) return null;
  return sessionId;
}

function cleanupExpiredSessions(now = Date.now()) {
  for (const [id, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now || session.idleExpiresAt <= now) sessions.delete(id);
  }
}

function cleanupExpiredLoginFailures(now = Date.now()) {
  for (const [ip, item] of loginFailures.entries()) {
    if (!item) {
      loginFailures.delete(ip);
      continue;
    }
    const windowExpired = item.windowStartedAt + item.windowMs <= now;
    const lockExpired = !item.lockedUntil || item.lockedUntil <= now;
    if (windowExpired && lockExpired) loginFailures.delete(ip);
  }
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function createPanelAuth(config) {
  const sessionMaxAgeSec = Math.max(300, Number(config.panelSessionMaxAgeSec || 43_200));
  const sessionIdleTimeoutSec = Math.max(5, Number(config.panelSessionIdleTimeoutSec || 1_800));
  const loginMaxFailuresPerIp = Math.max(1, Number(config.panelLoginMaxFailuresPerIp || 5));
  const loginFailureWindowSec = Math.max(60, Number(config.panelLoginFailureWindowSec || 900));
  const loginLockoutSec = Math.max(60, Number(config.panelLoginLockoutSec || 1_800));
  const cookieSecure = Boolean(config.isProduction);
  const sessionSecret =
    (typeof config.panelSessionSecret === "string" && config.panelSessionSecret.trim()) ||
    crypto.randomBytes(32).toString("hex");

  if (!config.isProduction && (!config.panelSessionSecret || String(config.panelSessionSecret).length < 32)) {
    console.warn("[SECURITY] PANEL_SESSION_SECRET nao definido/curto em dev. Usando segredo efemero por boot.");
  }

  function credentialsMatch(username, password) {
    return (
      timingSafeEqualString(String(username || ""), config.panelAuthUser) &&
      timingSafeEqualString(String(password || ""), config.panelAuthPassword)
    );
  }

  function attachSession(req, res, next) {
    res.locals.currentUser = null;
    if (!config.panelAuthEnabled) return next();

    cleanupExpiredSessions();
    cleanupExpiredLoginFailures();
    const cookies = parseCookies(req.headers.cookie);
    const signed = cookies[SESSION_COOKIE];
    if (!signed) return next();

    const sessionId = verifySignedSessionId(signed, sessionSecret);
    if (!sessionId) return next();

    const session = sessions.get(sessionId);
    if (!session) return next();
    const now = Date.now();
    if (session.expiresAt <= now || session.idleExpiresAt <= now) {
      sessions.delete(sessionId);
      return next();
    }

    session.lastSeenAt = now;
    session.idleExpiresAt = now + sessionIdleTimeoutSec * 1000;

    req.user = { username: session.username, ip: session.ip };
    req.sessionId = sessionId;
    res.locals.currentUser = req.user;
    next();
  }

  function issueSession(res, username, req) {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    sessions.set(sessionId, {
      username,
      ip: getClientIp(req),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + sessionMaxAgeSec * 1000,
      idleExpiresAt: now + sessionIdleTimeoutSec * 1000
    });
    setCookie(res, SESSION_COOKIE, signSessionId(sessionId, sessionSecret), {
      path: "/",
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "Strict",
      maxAge: sessionMaxAgeSec
    });
  }

  function getLoginBlockState(req) {
    if (!config.panelAuthEnabled) return { blocked: false, retryAfterSec: 0 };
    cleanupExpiredLoginFailures();
    const ip = getClientIp(req);
    const item = loginFailures.get(ip);
    const now = Date.now();
    if (!item || !item.lockedUntil || item.lockedUntil <= now) {
      return { blocked: false, retryAfterSec: 0 };
    }
    return { blocked: true, retryAfterSec: Math.ceil((item.lockedUntil - now) / 1000) };
  }

  function recordLoginFailure(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowMs = loginFailureWindowSec * 1000;
    let item = loginFailures.get(ip);
    if (!item || now - item.windowStartedAt > windowMs) {
      item = { count: 0, windowStartedAt: now, windowMs, lockedUntil: 0 };
    }
    item.count += 1;
    if (item.count >= loginMaxFailuresPerIp) {
      item.lockedUntil = now + loginLockoutSec * 1000;
    }
    loginFailures.set(ip, item);
    return {
      blocked: Boolean(item.lockedUntil && item.lockedUntil > now),
      count: item.count,
      retryAfterSec: item.lockedUntil && item.lockedUntil > now ? Math.ceil((item.lockedUntil - now) / 1000) : 0
    };
  }

  function recordLoginSuccess(req) {
    loginFailures.delete(getClientIp(req));
  }

  function clearSession(req, res) {
    if (req.sessionId) sessions.delete(req.sessionId);
    const cookies = parseCookies(req.headers.cookie);
    const signed = cookies[SESSION_COOKIE];
    if (signed) {
      const sessionId = verifySignedSessionId(signed, sessionSecret);
      if (sessionId) sessions.delete(sessionId);
    }
    setCookie(res, SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "Strict",
      maxAge: 0
    });
    req.user = null;
    req.sessionId = null;
    res.locals.currentUser = null;
  }

  function requireAuth(req, res, next) {
    if (!config.panelAuthEnabled) return next();
    if (req.user && req.user.username) return next();
    const params = new URLSearchParams();
    if (req.originalUrl && req.originalUrl !== "/login") {
      params.set("next", req.originalUrl);
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return res.redirect(`/login${suffix}`);
  }

  function redirectIfAuthenticated(req, res, next) {
    if (req.user && req.user.username) return res.redirect("/");
    next();
  }

  return {
    attachSession,
    requireAuth,
    redirectIfAuthenticated,
    credentialsMatch,
    issueSession,
    clearSession,
    getClientIp,
    getLoginBlockState,
    recordLoginFailure,
    recordLoginSuccess
  };
}

module.exports = {
  createPanelAuth
};
