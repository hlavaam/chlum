"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = { tone: "idle" | "error" | "loading"; message: string };

export function MaintenanceAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ tone: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ tone: "loading", message: "Oteviram nahled..." });

    const nextPath = searchParams.get("next") || "/";
    const response = await fetch("/api/maintenance/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, next: nextPath }),
    });
    const payload = await response.json().catch(() => null) as { error?: string; next?: string } | null;

    if (!response.ok) {
      setStatus({ tone: "error", message: payload?.error || "Vstup se nepodarilo overit." });
      return;
    }

    router.push(payload?.next || nextPath);
    router.refresh();
  }

  return (
    <form className="maintenance-form stack" onSubmit={onSubmit}>
      <label className="stack gap-sm" htmlFor="maintenance-password">
        <span className="maintenance-label">Vstupni heslo</span>
        <input
          id="maintenance-password"
          className="maintenance-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Zadejte heslo"
          autoComplete="current-password"
        />
      </label>

      <button className="button maintenance-button animate-tap" type="submit">
        Vstoupit do náhledu
      </button>

      <p className={`maintenance-status ${status.tone}`}>{status.message || "Bez hesla zůstává web skrytý."}</p>
    </form>
  );
}
