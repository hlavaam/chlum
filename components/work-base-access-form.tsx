"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkBaseAccessForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/work/base/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body?.error ?? "Neplatné heslo.");
        return;
      }

      router.refresh();
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack gap-sm" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Základna</p>
        <h1>Vstup do píchačky</h1>
      </div>
      <p className="subtle">
        Pro otevření docházky zadej heslo. Po odemknutí zůstane základna dostupná i pro sken QR a píchání přes heslo.
      </p>
      {error ? <p className="alert">{error}</p> : null}
      <label>
        Heslo
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Zadej heslo"
          required
        />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Otevírám..." : "Odemknout základnu"}
      </button>
    </form>
  );
}
