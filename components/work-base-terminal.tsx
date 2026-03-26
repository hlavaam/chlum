"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
}: {
  locations: LocationOption[];
  users: UserOption[];
  rosterByLocation: Record<string, RosterEntry[]>;
  lockSingleLocation?: boolean;
  compactMode?: boolean;
}) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(locations[0]?.id ?? "");
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selectedLocationId && locations[0]) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    const nextUsers = [...selectableUsers, ...additionalUsers];
    if (!nextUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(nextUsers[0]?.id ?? users[0]?.id ?? "");
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
    const previousBodyTouchAction = body.style.touchAction;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.touchAction = previousBodyTouchAction;
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
              onClick={() => {
                setSelectedLocationId(location.id);
                setPin("");
              }}
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
                onClick={() => {
                  setSelectedUserId(entry.userId);
                  setPin("");
                  setError(null);
                }}
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
                onClick={() => setScannerOpen((value) => !value)}
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
            <form className="stack gap-sm" onSubmit={handlePinPunch}>
              <label>
                Jméno
                <select value={selectedUserId} onChange={(event) => {
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
              <div className="base-pin-display" aria-live="polite">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={`pin-slot-${index}`} className={cx("base-pin-slot", index < pin.length && "filled")} />
                ))}
              </div>
              <div className="base-keypad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" className="base-key" onClick={() => pushDigit(digit)}>
                    {digit}
                  </button>
                ))}
                <button type="button" className="base-key ghost" onClick={clearPin}>
                  C
                </button>
                <button type="button" className="base-key" onClick={() => pushDigit("0")}>
                  0
                </button>
                <button type="button" className="base-key ghost" onClick={backspacePin}>
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
