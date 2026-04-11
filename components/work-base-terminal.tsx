"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authFetch } from "@/lib/auth/client";

const QR_RESCAN_COOLDOWN_MS = 5_000;

type LocationOption = {
  id: string;
  name: string;
  code: string;
};

type UserOption = {
  id: string;
  name: string;
  role: string;
  activeRecord?: {
    clockInAt: string;
    locationId: string;
  } | null;
};

type RosterEntry = {
  userId: string;
  name: string;
  present: boolean;
  waiting: boolean;
  done: boolean;
  clockInTime?: string | null;
  clockOutTime?: string | null;
};

type PunchResponse = {
  ok?: boolean;
  error?: string;
  action?: "clock_in" | "clock_out";
  user?: {
    id: string;
    name: string;
  };
  record?: {
    clockInAt?: string;
    clockOutAt?: string;
  };
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function playSuccessFeedback() {
  if (typeof window === "undefined") return;

  try {
    if ("vibrate" in navigator) {
      navigator.vibrate?.([80, 40, 120]);
    }
  } catch {
    // ignore vibration errors
  }

  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
    oscillator.onended = () => {
      void context.close().catch(() => undefined);
    };
  } catch {
    // ignore audio errors
  }
}

export function WorkBaseTerminal({
  locations,
  users,
  rosterByLocation,
  lockSingleLocation = false,
  compactMode = false,
  legacyMode = false,
  redirectTo = "/work/zakladna",
  initialLocationId,
  initialUserId,
  initialPin = "",
  initialMessage = null,
  initialError = null,
}: {
  locations: LocationOption[];
  users: UserOption[];
  rosterByLocation: Record<string, RosterEntry[]>;
  lockSingleLocation?: boolean;
  compactMode?: boolean;
  legacyMode?: boolean;
  redirectTo?: string;
  initialLocationId?: string;
  initialUserId?: string;
  initialPin?: string;
  initialMessage?: string | null;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId || locations[0]?.id || "");
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || "");
  const [pin, setPin] = useState(initialPin);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [error, setError] = useState<string | null>(initialError);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const qrCooldownRef = useRef<{ token: string; until: number } | null>(null);

  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedRoster = rosterByLocation[selectedLocationId] ?? [];
  const selectedRosterEntry = selectedRoster.find((entry) => entry.userId === selectedUserId) ?? null;
  const selectableUsers = useMemo(() => {
    const rosterIds = new Set(selectedRoster.map((entry) => entry.userId));
    return users.filter((user) => rosterIds.has(user.id));
  }, [selectedRoster, users]);
  const additionalUsers = useMemo(
    () => users.filter((user) => !selectedRoster.some((entry) => entry.userId === user.id)),
    [selectedRoster, users],
  );
  const selectedUser = useMemo(
    () => selectableUsers.find((user) => user.id === selectedUserId) ?? users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, selectableUsers, users],
  );

  function bindTap(action: () => void) {
    return {
      onClick: action,
      onTouchEnd: (event: React.TouchEvent<HTMLElement>) => {
        event.preventDefault();
        action();
      },
    };
  }

  useEffect(() => {
    if (!selectedLocationId && locations[0]) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    if (!legacyMode) return;
    setSelectedLocationId(initialLocationId || locations[0]?.id || "");
  }, [initialLocationId, legacyMode, locations]);

  useEffect(() => {
    if (!legacyMode) return;
    setSelectedUserId(initialUserId || "");
  }, [initialUserId, legacyMode]);

  useEffect(() => {
    if (!legacyMode) return;
    setPin(initialPin);
  }, [initialPin, legacyMode]);

  useEffect(() => {
    if (!legacyMode) return;
    setMessage(initialMessage);
  }, [initialMessage, legacyMode]);

  useEffect(() => {
    if (!legacyMode) return;
    setError(initialError);
  }, [initialError, legacyMode]);

  useEffect(() => {
    const nextUsers = [...selectableUsers, ...additionalUsers];
    if (selectedUserId && !nextUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId("");
      setPin("");
    }
  }, [additionalUsers, selectableUsers, selectedUserId, users]);

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
    qrCooldownRef.current = null;
  }

  function formatFeedbackTime(iso?: string) {
    if (!iso) return null;
    return new Intl.DateTimeFormat("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  async function submitPunch(body: Record<string, string>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch("/api/work/base/punch", {
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
      setPin("");
      const feedbackTime = formatFeedbackTime(
        result.action === "clock_in" ? result.record?.clockInAt : result.record?.clockOutAt,
      );
      setMessage(
        `${result.user?.name ?? "Uživatel"}: ${
          result.action === "clock_in" ? "příchod" : "odchod"
        }${feedbackTime ? ` v ${feedbackTime}` : ""}.`,
      );
      playSuccessFeedback();
      router.refresh();
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setPending(false);
    }
  }

  async function handlePinPunch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLocationId || !selectedUserId || pin.length !== 4) {
      setError("Vyber člověka, základnu a zadej 4místný PIN.");
      return;
    }
    await submitPunch({
      mode: "pin",
      locationId: selectedLocationId,
      userId: selectedUserId,
      pin,
    });
  }

  function pushDigit(value: string) {
    setPin((current) => (current.length >= 4 ? current : `${current}${value}`));
  }

  function clearPin() {
    setPin("");
  }

  function backspacePin() {
    setPin((current) => current.slice(0, -1));
  }

  useEffect(() => {
    if (pin.length === 4 && selectedLocationId && selectedUserId && !pending) {
      void submitPunch({
        mode: "pin",
        locationId: selectedLocationId,
        userId: selectedUserId,
        pin,
      });
    }
  }, [pin]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!compactMode) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [compactMode]);

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
              const now = Date.now();
              if (pending) {
                frameRef.current = requestAnimationFrame(scanFrame);
                return;
              }
              if (qrCooldownRef.current?.token === token && qrCooldownRef.current.until > now) {
                frameRef.current = requestAnimationFrame(scanFrame);
                return;
              }
              qrCooldownRef.current = {
                token,
                until: now + QR_RESCAN_COOLDOWN_MS,
              };
              await submitPunch({ mode: "qr", locationId: selectedLocationId, qrToken: token });
            }
          } catch {
            // ignore frame errors
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

  if (legacyMode) {
    const fallbackLocationId = initialLocationId || locations[0]?.id || "";
    const compactRoster = rosterByLocation[fallbackLocationId] ?? [];
    const activeCompactUser = compactRoster.find((entry) => entry.userId === selectedUserId) ?? null;
    const activeCompactUserLabel = activeCompactUser?.name ?? selectedUser?.name ?? "";

    return (
      <section className="panel stack gap-lg">
        {message ? <div className="base-floating-toast success">{message}</div> : null}
        <div className="stack gap-sm">
          <div>
            <p className="eyebrow">Píchačka</p>
            <h2>Základna</h2>
          </div>
          {error ? <p className="alert">{error}</p> : null}
          <p className="subtle">
            Vyber pobocku, klikni na cloveka a zadej 4 cisla. Po ctvrtém cisle se prichod nebo odchod zapise sam.
          </p>
        </div>

        <article className="base-terminal-card stack gap-sm">
          <form className="stack gap-sm" action={redirectTo} method="get">
            <label>
              Pobocka
              <select name="locationId" defaultValue={fallbackLocationId} required>
                {locations.map((location) => (
                  <option key={`fallback-location-${location.id}`} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button ghost">
              Zobrazit lidi
            </button>
          </form>
        </article>

        <section className="stack gap-sm">
          <article className="base-terminal-card stack gap-sm">
            <div className="row between wrap">
              <div>
                <p className="eyebrow">Dnesni tym</p>
                <h3>{locations.find((location) => location.id === fallbackLocationId)?.name ?? "Pobocka"}</h3>
              </div>
              <span className="badge neutral">{compactRoster.length} jmen</span>
            </div>
            {compactRoster.length === 0 ? <p className="subtle">Na dnesek tu zatim neni nikdo rozepsany.</p> : null}
            {compactRoster.length > 0 ? (
              <div className="stack gap-sm">
                {compactRoster.map((entry) => (
                  <form key={`fallback-entry-${fallbackLocationId}-${entry.userId}`} action={redirectTo} method="get">
                    <input type="hidden" name="locationId" value={fallbackLocationId} />
                    <input type="hidden" name="userId" value={entry.userId} />
                    <button type="submit" className={`base-roster-item ${selectedUserId === entry.userId ? "active" : ""}`.trim()}>
                      <div>
                        <p><strong>{entry.name}</strong></p>
                        <p className="tiny subtle">
                          {entry.clockInTime ? `Prichod ${entry.clockInTime}` : "Bez prichodu"}
                          {entry.clockOutTime ? ` • Odchod ${entry.clockOutTime}` : ""}
                        </p>
                      </div>
                      <span className={`badge ${entry.present ? "success" : entry.done ? "neutral" : entry.waiting ? "warning" : "neutral"}`}>
                        {entry.present ? "Pritomen" : entry.done ? "Hotovo" : entry.waiting ? "Ceka" : "Mimo"}
                      </span>
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
          </article>
        </section>

        {selectedUserId ? (
          <article className="base-terminal-card stack gap-sm">
            <div className="row between wrap align-center">
              <div>
                <p className="eyebrow">PIN</p>
                <h3>{activeCompactUserLabel || "Vybrany clovek"}</h3>
              </div>
              <form action={redirectTo} method="get">
                <input type="hidden" name="locationId" value={fallbackLocationId} />
                <button type="submit" className="button ghost small">Zavrit klavesnici</button>
              </form>
            </div>
            <div className="base-pin-display" aria-live="polite">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`compact-pin-slot-${index}`} className={cx("base-pin-slot", index < pin.length && "filled")} />
              ))}
            </div>
            <form className="stack gap-sm" action="/api/work/base/punch" method="post">
              <input type="hidden" name="mode" value="pin" />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="locationId" value={fallbackLocationId} />
              <input type="hidden" name="userId" value={selectedUserId} />
              <input type="hidden" name="pin" value={pin} />
              <div className="base-keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={`compact-digit-${digit}`}
                    type="submit"
                    className="base-key"
                    name="keypadDigit"
                    value={digit}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="submit"
                  className="base-key ghost"
                  name="keypadAction"
                  value="clear"
                >
                  C
                </button>
                <button
                  type="submit"
                  className="base-key"
                  name="keypadDigit"
                  value="0"
                >
                  0
                </button>
                <button
                  type="submit"
                  className="base-key ghost"
                  name="keypadAction"
                  value="backspace"
                >
                  ←
                </button>
              </div>
            </form>
          </article>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel stack gap-lg">
      {message ? <div className="base-floating-toast success">{message}</div> : null}
      <div className={cx("stack", compactMode ? "gap-xs" : "gap-sm")}>
        {!compactMode ? (
          <div>
            <p className="eyebrow">Píchačka</p>
            <h2>Základna</h2>
          </div>
        ) : null}
        <div className="base-location-switcher" role="tablist" aria-label="Výběr základny">
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              className={cx("base-location-chip", selectedLocationId === location.id && "active")}
              {...bindTap(() => {
                setSelectedLocationId(location.id);
                setPin("");
              })}
              disabled={lockSingleLocation}
            >
              {location.name}
            </button>
          ))}
        </div>
        {error ? <p className="alert">{error}</p> : null}
      </div>

      <div className={cx("base-terminal-grid", compactMode && "base-terminal-grid-kiosk")}>
        <article className="base-terminal-card base-roster-card stack gap-sm">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Dnešní tým</p>
              <h3>{selectedLocation?.name ?? "Vyber pobočku"}</h3>
            </div>
          </div>
          {selectedRoster.length === 0 ? <p className="subtle">Na dnešek tu zatím není nikdo rozepsaný.</p> : null}
          <div className="stack gap-sm base-roster-list">
            {selectedRoster.map((entry) => (
              <button
                key={`${entry.userId}-${entry.name}`}
                type="button"
                className={cx("base-roster-item", selectedUserId === entry.userId && "active")}
                {...bindTap(() => {
                  setSelectedUserId(entry.userId);
                  setPin("");
                  setError(null);
                })}
              >
                <div>
                  <p><strong>{entry.name}</strong></p>
                  {entry.clockInTime || entry.clockOutTime ? (
                    <p className="tiny subtle">
                      {entry.clockInTime ? `Příchod ${entry.clockInTime}` : ""}
                      {entry.clockInTime && entry.clockOutTime ? " • " : ""}
                      {entry.clockOutTime ? `Odchod ${entry.clockOutTime}` : ""}
                    </p>
                  ) : null}
                </div>
                <span className={`badge ${entry.present ? "success" : entry.done ? "neutral" : entry.waiting ? "warning" : "neutral"}`}>
                  {entry.present ? "Přítomen" : entry.done ? "Hotovo" : entry.waiting ? "Čeká" : "Mimo"}
                </span>
              </button>
            ))}
          </div>
        </article>

        <div className="base-terminal-side stack gap-sm">
          <article className="base-terminal-card base-compact-card stack gap-sm">
            <div className="row between wrap">
              <div>
                <p className="eyebrow">QR</p>
                <h3>Kamera</h3>
              </div>
              <button
                type="button"
                className="button ghost small"
                disabled={pending || !selectedLocationId}
                {...bindTap(() => setScannerOpen((value) => !value))}
              >
                {scannerOpen ? "Zavřít" : "Načíst QR"}
              </button>
            </div>
            {!scannerSupported && scannerOpen ? <span className="subtle tiny">Tenhle prohlížeč QR skener nepodporuje.</span> : null}
            {scannerOpen ? (
              <div className="base-scanner-box compact">
                <video ref={videoRef} className="base-scanner-video compact" muted playsInline />
                <div className="base-scanner-frame compact" aria-hidden="true" />
              </div>
            ) : null}
          </article>

          <article className="base-terminal-card stack gap-sm">
            <div>
              <p className="eyebrow">PIN</p>
              <h3>{selectedUser?.name ?? "Klikni na jméno"}</h3>
            </div>
            <form className="stack gap-sm" onSubmit={handlePinPunch} action="/api/work/base/punch" method="post">
              <input type="hidden" name="mode" value="pin" />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label>
                Pobočka
                <select name="locationId" value={selectedLocationId} onChange={(event) => {
                  setSelectedLocationId(event.target.value);
                  setPin("");
                  setError(null);
                }}>
                  {locations.map((location) => (
                    <option key={`terminal-location-${location.id}`} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jméno
                <select name="userId" value={selectedUserId} onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setPin("");
                  setError(null);
                }}>
                  {selectableUsers.length > 0 ? (
                    <optgroup label="Dnešní tým">
                      {selectableUsers.map((user) => (
                        <option key={`roster-${user.id}`} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {additionalUsers.length > 0 ? (
                    <optgroup label="Všichni ostatní">
                      {additionalUsers.map((user) => (
                        <option key={`other-${user.id}`} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
              <label>
                PIN
                <input
                  type="password"
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  autoComplete="one-time-code"
                  placeholder="Zadej 4místný PIN"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setError(null);
                  }}
                />
              </label>
              <div className="base-pin-display" aria-live="polite">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={`pin-slot-${index}`} className={cx("base-pin-slot", index < pin.length && "filled")} />
                ))}
              </div>
              <div className="base-keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" className="base-key" {...bindTap(() => pushDigit(digit))}>
                    {digit}
                  </button>
                ))}
                <button type="button" className="base-key ghost" {...bindTap(clearPin)}>
                  C
                </button>
                <button type="button" className="base-key" {...bindTap(() => pushDigit("0"))}>
                  0
                </button>
                <button type="button" className="base-key ghost" {...bindTap(backspacePin)}>
                  ←
                </button>
              </div>
              <button type="submit" className="button ghost" disabled={pending || !selectedUserId || pin.length !== 4}>
                Potvrdit PIN
              </button>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}
