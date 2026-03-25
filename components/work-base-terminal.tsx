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
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkBaseTerminal({
  locations,
  users,
  rosterByLocation,
  lockSingleLocation = false,
}: {
  locations: LocationOption[];
  users: UserOption[];
  rosterByLocation: Record<string, RosterEntry[]>;
  lockSingleLocation?: boolean;
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

  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedRoster = rosterByLocation[selectedLocationId] ?? [];
  const selectedRosterEntry = selectedRoster.find((entry) => entry.userId === selectedUserId) ?? null;
  const selectableUsers = useMemo(() => {
    const rosterIds = new Set(selectedRoster.map((entry) => entry.userId));
    return users.filter((user) => rosterIds.has(user.id));
  }, [selectedRoster, users]);
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
    const nextUsers = selectableUsers.length > 0 ? selectableUsers : users;
    if (!nextUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(nextUsers[0]?.id ?? "");
      setPin("");
    }
  }, [selectableUsers, selectedUserId, users]);

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
      setPin("");
      setMessage(`${result.user?.name ?? "Brigádník"}: ${result.action === "clock_in" ? "příchod zapsán" : "odchod zapsán"}.`);
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
      setError("Vyber brigádníka, základnu a zadej 4místný PIN.");
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
        {message ? <p className="badge success">{message}</p> : null}
        {error ? <p className="alert">{error}</p> : null}
      </div>

      <div className="grid-2 base-terminal-grid">
        <article className="base-terminal-card stack gap-sm">
          <div className="row between wrap">
            <div>
              <p className="eyebrow">Dnešní brigádníci</p>
              <h3>{selectedLocation?.name ?? "Vyber pobočku"}</h3>
            </div>
            <span className="badge neutral">{selectedRoster.length} jmen</span>
          </div>
          {selectedRoster.length === 0 ? <p className="subtle">Na dnešek tu zatím není nikdo rozepsaný.</p> : null}
          <div className="stack gap-sm">
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

        <div className="stack gap-lg">
          <article className="base-terminal-card stack gap-sm">
            <div>
              <p className="eyebrow">PIN</p>
              <h3>{selectedUser?.name ?? "Klikni na jméno"}</h3>
            </div>
            <p className="subtle">
              {selectedRosterEntry?.present
                ? "Brigádník je právě přítomen. Po zadání PINu se zapíše odchod."
                : "Po zadání 4místného PINu se zapíše příchod nebo odchod."}
            </p>
            <form className="stack gap-sm" onSubmit={handlePinPunch}>
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

          <article className="base-terminal-card stack gap-sm">
            <div>
              <p className="eyebrow">QR kód</p>
              <h3>Naskenovat brigádníka</h3>
            </div>
            <p className="subtle">QR z profilu brigádníka zapíše příchod nebo odchod automaticky.</p>
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
      </div>
    </section>
  );
}
