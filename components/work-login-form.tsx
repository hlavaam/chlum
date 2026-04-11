"use client";

import { useEffect, useRef, useState } from "react";

import {
  clearPersistedAuth,
  parseJsonResponse,
  persistAuthToken,
  probeCookieSession,
  readStoredAuthToken,
  restoreSessionFromPersistedToken,
} from "@/lib/auth/client";

type LoginResponse = {
  ok?: boolean;
  error?: string;
  token?: string;
  redirectTo?: string;
};

type Props = {
  initialError: boolean;
  nextPath?: string;
  submitLabel?: string;
  loginPath?: string;
};

function normalizeNextPath(value?: string) {
  if (!value || !value.startsWith("/")) {
    return null;
  }

  return value;
}

export function WorkLoginForm({
  initialError,
  nextPath,
  submitLabel = "Vstoupit do worku",
  loginPath = "/work",
}: Props) {
  const restoreAttemptRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? "Neplatný e-mail nebo heslo." : null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (restoreAttemptRef.current) return;
    restoreAttemptRef.current = true;

    let cancelled = false;

    void (async () => {
      if (!readStoredAuthToken()) {
        console.info("[auth] User appears logged out after reload because no persisted token was found.", { nextPath });
        return;
      }

      setPending(true);
      setStatus("Kontroluji uložené přihlášení...");

      const restore = await restoreSessionFromPersistedToken("login_page_boot");
      if (cancelled) return;

      if (!restore.ok) {
        if (restore.response) {
          console.warn("[auth] User appears logged out after reload and persisted restore failed.", {
            nextPath,
            status: restore.response.status,
            body: restore.body,
          });
          if (restore.response.status === 401) {
            clearPersistedAuth();
          }
        }
        setPending(false);
        setStatus(null);
        return;
      }

      const cookieProbe = await probeCookieSession("login_page_boot");
      if (!cookieProbe.ok) {
        console.warn("[auth] Session cookie is still unavailable after startup restore; relying on fallback token/cookie.", {
          nextPath,
          body: cookieProbe.body,
        });
      }

      const target = normalizeNextPath(nextPath) ?? normalizeNextPath(typeof restore.body?.redirectTo === "string" ? restore.body.redirectTo : undefined) ?? "/work/employees";
      console.info("[auth] Redirecting after startup restore.", { target, nextPath });
      window.location.replace(target);
    })();

    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus("Přihlašuji...");

    const formData = new FormData(event.currentTarget);
    const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";
    const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const result = await parseJsonResponse<LoginResponse>(response);

      console.info("[auth] Login request completed.", {
        ok: response.ok,
        status: response.status,
        hasToken: typeof result?.token === "string",
        body: result,
      });

      if (!response.ok || typeof result?.token !== "string") {
        clearPersistedAuth();
        setError("Neplatný e-mail nebo heslo.");
        setPending(false);
        setStatus(null);
        return;
      }

      const persisted = persistAuthToken(result.token);
      console.info("[auth] Persisted login token after successful login.", { persisted });

      const restore = await restoreSessionFromPersistedToken("login_submit");
      if (!restore.ok) {
        console.warn("[auth] Cookie restore after login failed; fallback token will be used.", { body: restore.body });
      }

      const cookieProbe = await probeCookieSession("post_login");
      if (!cookieProbe.ok) {
        console.warn("[auth] Session check after login indicates cookie auth is unavailable; fallback token remains active.", {
          body: cookieProbe.body,
        });
      }

      const target = normalizeNextPath(nextPath) ?? normalizeNextPath(result.redirectTo) ?? "/work/employees";
      console.info("[auth] Redirecting after login.", { target, nextPath });
      window.location.assign(target);
    } catch (submitError) {
      console.error("[auth] Login request crashed.", submitError);
      setError("Nepodařilo se spojit se serverem.");
      setPending(false);
      setStatus(null);
    }
  }

  return (
    <form action="/api/auth/login" method="post" onSubmit={handleSubmit} className="stack">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <input type="hidden" name="loginPath" value={loginPath} />
      <label>
        E-mail
        <input type="email" name="email" autoComplete="username" required disabled={pending} />
      </label>
      <label>
        Heslo
        <input type="password" name="password" autoComplete="current-password" required disabled={pending} />
      </label>
      {error ? <p className="alert">{error}</p> : null}
      {status ? <p className="subtle">{status}</p> : null}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Přihlašuji..." : submitLabel}
      </button>
    </form>
  );
}
