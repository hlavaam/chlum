"use client";

import { useState } from "react";

type Props = {
  email: string;
  phone: string;
};

export function PublicReservationForm({ email, phone }: Props) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState("2");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = encodeURIComponent(`Rezervace stolu - ${name || "bez jména"}`);
    const body = encodeURIComponent(
      [
        `Jméno: ${name || "-"}`,
        `Datum: ${date || "-"}`,
        `Čas: ${time || "-"}`,
        `Počet osob: ${partySize || "-"}`,
      ].join("\n"),
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  return (
    <form className="public-reservation-form stack" onSubmit={handleSubmit}>
      <div className="public-reservation-grid">
        <label>
          Jméno
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Vaše jméno" required />
        </label>
        <label>
          Datum
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label>
          Čas
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </label>
        <label>
          Počet osob
          <select value={partySize} onChange={(event) => setPartySize(event.target.value)}>
            {["2", "3", "4", "5", "6", "7", "8+"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="public-reservation-actions">
        <button type="submit" className="button public-reservation-submit">
          Rezervovat stůl
        </button>
        <a className="button ghost public-reservation-submit" href={`tel:${phone.replace(/\s+/g, "")}`}>
          Zavolat rovnou
        </a>
      </div>
    </form>
  );
}
