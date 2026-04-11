const AUTH_TOKEN_STORAGE_KEY = "employees_access_token";
const FALLBACK_COOKIE_NAME = "employees_session_fallback";
const FALLBACK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secureCookieSuffix() {
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function readStoredAuthToken() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn("[auth] Failed to read stored auth token.", error);
    return null;
  }
}

export function persistAuthToken(token: string) {
  if (typeof window === "undefined") {
    return { storage: false, cookie: false };
  }

  let storage = false;
  let cookie = false;

  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    storage = true;
  } catch (error) {
    console.warn("[auth] Failed to persist auth token to localStorage.", error);
  }

  try {
    document.cookie = `${FALLBACK_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${FALLBACK_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureCookieSuffix()}`;
    cookie = true;
  } catch (error) {
    console.warn("[auth] Failed to persist fallback auth cookie.", error);
  }

  return { storage, cookie };
}

export function clearPersistedAuth() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn("[auth] Failed to clear stored auth token.", error);
  }

  try {
    document.cookie = `${FALLBACK_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secureCookieSuffix()}`;
  } catch (error) {
    console.warn("[auth] Failed to clear fallback auth cookie.", error);
  }
}

type AuthFetchInit = RequestInit & {
  omitAuthorization?: boolean;
};

export async function authFetch(input: RequestInfo | URL, init: AuthFetchInit = {}) {
  const headers = new Headers(init.headers ?? undefined);

  if (!init.omitAuthorization) {
    const token = readStoredAuthToken();
    if (token && !headers.has("authorization")) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}

export async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  return safeParseJson<T>(text);
}

export async function restoreSessionFromPersistedToken(reason: string) {
  const token = readStoredAuthToken();

  if (!token) {
    console.info("[auth] Session restore skipped because no persisted token exists.", { reason });
    return { ok: false, response: null as Response | null, body: null as Record<string, unknown> | null };
  }

  const persisted = persistAuthToken(token);
  console.info("[auth] Re-applied persisted auth token before restore.", { reason, persisted });

  const response = await authFetch("/api/auth/restore", {
    method: "POST",
    cache: "no-store",
  });
  const body = await parseJsonResponse<Record<string, unknown>>(response);
  console.info("[auth] Restore response received.", {
    reason,
    ok: response.ok,
    status: response.status,
    body,
  });

  if (response.ok && typeof body?.token === "string") {
    const persistedRefresh = persistAuthToken(body.token);
    console.info("[auth] Refreshed persisted auth token after restore.", { reason, persisted: persistedRefresh });
  }

  return { ok: response.ok, response, body };
}

export async function probeCookieSession(reason: string) {
  const response = await fetch("/api/me", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
  });
  const body = await parseJsonResponse<Record<string, unknown>>(response);
  console.info("[auth] Cookie/session probe completed.", {
    reason,
    ok: response.ok,
    status: response.status,
    body,
  });
  return { ok: response.ok, response, body };
}
