"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type UserOption = {
  id: string;
  name: string;
  role: string;
  photoDataUrl?: string;
  activeRecord?: {
    clockInAt: string;
    locationId: string;
  } | null;
};

type CurrentUserOption = {
  id: string;
  name: string;
  role: string;
} | null;

type PunchResponse = {
  ok?: boolean;
  error?: string;
  action?: "clock_in" | "clock_out";
  user?: {
    id: string;
    name: string;
  };
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkBaseTerminal({
  locations,
  users,
  currentUser,
}: {
  locations: LocationOption[];
  users: UserOption[];
  currentUser: CurrentUserOption;
}) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id ?? "");
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id ?? users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
  const currentUserState = currentUser ? users.find((user) => user.id === currentUser.id) ?? null : null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;

  function stopScanner() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerReady(false);
  }

  async function submitPunch(body: Record<string, string>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/work/base/punch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as PunchResponse;
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Píchačka se nepovedla.");
        return;
      }
      setPassword("");
      setMessage(
        `${result.user?.name ?? "Brigádník"}: ${result.action === "clock_in" ? "příchod zapsán" : "odchod zapsán"}.`,
      );
      router.refresh();
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setPending(false);
    }
  }

  async function handleSelfPunch() {
    if (!selectedLocationId) return;
    await submitPunch({ mode: "self", locationId: selectedLocationId });
  }

  async function handlePasswordPunch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocationId || !selectedUserId || !password) {
      setError("Vyber brigádníka, základnu a zadej heslo.");
      return;
    }
    await submitPunch({
      mode: "password",
      locationId: selectedLocationId,
      userId: selectedUserId,
      password,
    });
  }

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      return;
    }

    let cancelled = false;
    let detector: BarcodeDetector | null = null;

    async function startScanner() {
      if (typeof window === "undefined" || !("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        setScannerSupported(false);
        return;
      }

      setScannerSupported(true);
      try {
        detector = new BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScannerReady(true);

        const scanFrame = async () => {
          if (cancelled || !detector || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const token = codes.find((code) => Boolean(code.rawValue))?.rawValue;
            if (token) {
              setScannerOpen(false);
              await submitPunch({ mode: "qr", locationId: selectedLocationId, qrToken: token });
              return;
            }
          } catch {
            // Ignore detector frame errors and keep scanning.
          }
          frameRef.current = requestAnimationFrame(scanFrame);
        };

        frameRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setError("Nepodařilo se spustit kameru.");
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen, selectedLocationId]);

  return (
    <section className="panel stack gap-lg">
      <div className="stack gap-sm">
        <div>
          <p className="eyebrow">Píchačka</p>
          <h2>Základna</h2>
        </div>
        <div className="base-location-switcher" role="tablist" aria-label="Výběr základny">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              className={cx("base-location-chip", selectedLocationId === location.id && "active")}
              onClick={() => setSelectedLocationId(location.id)}
            >
              {location.name}
            </button>
          ))}
        </div>
        <p className="subtle">
          Vybraná základna: <strong>{selectedLocation?.name ?? "Nevybráno"}</strong>
        </p>
        {message ? <p className="badge success">{message}</p> : null}
        {error ? <p className="alert">{error}</p> : null}
      </div>

      {currentUser ? (
        <article className="base-terminal-card stack gap-sm">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Můj příchod / odchod</p>
              <h3>{currentUser.name}</h3>
            </div>
            {currentUserState?.activeRecord ? <span className="badge success">Právě na základně</span> : <span className="badge neutral">Mimo základnu</span>}
          </div>
          <p className="subtle">
            {currentUserState?.activeRecord
              ? `Píchnuto od ${new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(currentUserState.activeRecord.clockInAt))}.`
              : "Klikem si zapíšeš příchod nebo odchod pod vlastním účtem."}
          </p>
          <button type="button" className="button" disabled={pending || !selectedLocationId} onClick={handleSelfPunch}>
            {currentUserState?.activeRecord ? "Odpíchnout sebe" : "Píchnout sebe"}
          </button>
        </article>
      ) : null}

      <div className="grid-2 base-terminal-grid">
        <article className="base-terminal-card stack gap-sm">
          <div>
            <p className="eyebrow">Přes heslo</p>
            <h3>Vyber brigádníka</h3>
          </div>
          <form className="stack gap-sm" onSubmit={handlePasswordPunch}>
            <label>
              Brigádník
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle">
              {selectedUser?.activeRecord
                ? "Vybraný brigádník je právě píchnutý. Tlačítko zapíše odchod."
                : "Vybraný brigádník zatím není píchnutý. Tlačítko zapíše příchod."}
            </p>
            <label>
              Heslo
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Zadej heslo brigádníka"
                required
              />
            </label>
            <button type="submit" className="button ghost" disabled={pending || !selectedLocationId}>
              {selectedUser?.activeRecord ? "Odpíchnout přes heslo" : "Píchnout přes heslo"}
            </button>
          </form>
        </article>

        <article className="base-terminal-card stack gap-sm">
          <div>
            <p className="eyebrow">Přes QR</p>
            <h3>Naskenovat osobní kód</h3>
          </div>
          <p className="subtle">
            Brigádník otevře svůj QR v profilu a kamera ho načte. Když už je píchnutý, stejný QR zapíše odchod.
          </p>
          <div className="row gap-sm wrap">
            <button type="button" className="button ghost" disabled={pending || !selectedLocationId} onClick={() => setScannerOpen((value) => !value)}>
              {scannerOpen ? "Zavřít kameru" : "Spustit kameru"}
            </button>
            {!scannerSupported && scannerOpen ? <span className="subtle tiny">Tenhle prohlížeč QR skener nepodporuje.</span> : null}
          </div>
          {scannerOpen ? (
            <div className="base-scanner-box">
              <video ref={videoRef} className="base-scanner-video" muted playsInline />
              <div className="base-scanner-frame" aria-hidden="true" />
              <p className="subtle tiny">{scannerReady ? "Zaměř QR doprostřed rámečku." : "Spouštím kameru..."}</p>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}
