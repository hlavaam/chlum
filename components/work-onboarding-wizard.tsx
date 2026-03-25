"use client";

import { useMemo, useState } from "react";

import { completeInviteAction } from "@/lib/actions";
import {
  STAFF_ROLES,
  staffRoleLabels,
  WORK_DAY_PREFERENCES,
  workDayPreferenceLabels,
  WORK_PERIODS,
  workPeriodLabels,
} from "@/lib/constants";

type Props = {
  token: string;
  inviteEmail?: string;
  error?: string;
};

type StepId = "intro" | "name" | "email" | "password" | "pin" | "preferred" | "excluded" | "periods" | "days" | "finish";

const STEPS: StepId[] = ["intro", "name", "email", "password", "pin", "preferred", "excluded", "periods", "days", "finish"];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function WorkOnboardingWizard({
  token,
  inviteEmail,
  error,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [excludedRoles, setExcludedRoles] = useState<string[]>([]);
  const [workPeriods, setWorkPeriods] = useState<string[]>([]);
  const [workDayPreferences, setWorkDayPreferences] = useState<string[]>([]);

  const step = STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);
  const isLastStep = stepIndex === STEPS.length - 1;

  function nextStep() {
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function previousStep() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function canContinue() {
    if (step === "name") return name.trim().length > 1;
    if (step === "email") return inviteEmail ? true : email.includes("@");
    if (step === "password") return password.length >= 6;
    if (step === "pin") return /^\d{4}$/.test(pin);
    return true;
  }

  return (
    <main className="onboarding-shell">
      <div className="onboarding-backdrop" />
      <div className="wizard-shell">
        <section className="wizard-card panel">
          <div className="wizard-progress">
            <div className="wizard-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="wizard-topline">
            <span className="eyebrow">Work / Restaurace Vyskeř</span>
            <span className="wizard-step-indicator">
              {stepIndex + 1} / {STEPS.length}
            </span>
          </div>

          {step === "intro" ? (
            <div className="wizard-screen active">
              <div className="wizard-center">
                <h1>Chlum onboarding</h1>
              </div>
            </div>
          ) : null}

          {step === "name" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Jak se jmenuješ?</h2>
                <p className="subtle">Zadej jméno a příjmení do jednoho pole.</p>
              </div>
              <label className="wizard-field">
                Jméno a příjmení
                <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Např. Jan Novák" />
              </label>
            </div>
          ) : null}

          {step === "email" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Na jaký e-mail tě povedeme?</h2>
                <p className="subtle">Tenhle e-mail použiješ i pro přihlášení do work appky.</p>
              </div>
              <label className="wizard-field">
                E-mail
                <input
                  type="email"
                  value={email}
                  readOnly={Boolean(inviteEmail)}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="napr. jan@domena.cz"
                />
              </label>
            </div>
          ) : null}

          {step === "password" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Nastav si heslo</h2>
                <p className="subtle">Alespoň 6 znaků. Později si ho můžeš změnit v profilu.</p>
              </div>
              <label className="wizard-field">
                Heslo
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} />
              </label>
            </div>
          ) : null}

          {step === "pin" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Nastav si PIN do Základny</h2>
                <p className="subtle">Čtyři čísla. Tímhle PINem se budeš píchat na kiosku.</p>
              </div>
              <label className="wizard-field">
                4místný PIN
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                />
              </label>
            </div>
          ) : null}

          {step === "preferred" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Co tě láká nejvíc?</h2>
                <p className="subtle">Klidně vyber víc rolí.</p>
              </div>
              <div className="wizard-choice-grid">
                {STAFF_ROLES.map((role) => (
                  <button
                    key={`preferred-${role}`}
                    type="button"
                    className={`wizard-choice ${preferredRoles.includes(role) ? "active" : ""}`.trim()}
                    onClick={() => setPreferredRoles((current) => toggleValue(current, role))}
                  >
                    {staffRoleLabels[role]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "excluded" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Kam rozhodně nechceš?</h2>
                <p className="subtle">I tohle je důležité, ať tě manager nenasazuje špatně.</p>
              </div>
              <div className="wizard-choice-grid">
                {STAFF_ROLES.map((role) => (
                  <button
                    key={`excluded-${role}`}
                    type="button"
                    className={`wizard-choice danger ${excludedRoles.includes(role) ? "active" : ""}`.trim()}
                    onClick={() => setExcludedRoles((current) => toggleValue(current, role))}
                  >
                    {staffRoleLabels[role]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "periods" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Kdy plánuješ brigádu?</h2>
                <p className="subtle">Vyber období, kdy s tebou máme počítat.</p>
              </div>
              <div className="wizard-choice-grid">
                {WORK_PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`wizard-choice ${workPeriods.includes(period) ? "active" : ""}`.trim()}
                    onClick={() => setWorkPeriods((current) => toggleValue(current, period))}
                  >
                    {workPeriodLabels[period]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "days" ? (
            <div className="wizard-screen active">
              <div className="wizard-step-copy">
                <h2>Jaké dny ti sedí?</h2>
                <p className="subtle">Týden dává smysl hlavně přes prázdniny, víkendy celoročně.</p>
              </div>
              <div className="wizard-choice-grid">
                {WORK_DAY_PREFERENCES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`wizard-choice ${workDayPreferences.includes(value) ? "active" : ""}`.trim()}
                    onClick={() => setWorkDayPreferences((current) => toggleValue(current, value))}
                  >
                    {workDayPreferenceLabels[value]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "finish" ? (
            <div className="wizard-screen active">
              <div className="wizard-center">
                <h2>Hotovo</h2>
                <p className="public-lead">Účet je připravený. Po vstupu půjdeš rovnou do kalendáře.</p>
              </div>
            </div>
          ) : null}

          {error === "exists" ? <p className="alert">Uživatel s tímto e-mailem už existuje.</p> : null}
          {error === "email" ? <p className="alert">Doplň prosím e-mail.</p> : null}
          {error === "password" ? <p className="alert">Heslo musí mít aspoň 6 znaků.</p> : null}
          {error === "pin" ? <p className="alert">PIN musí mít přesně 4 čísla.</p> : null}
          {error && !["exists", "email", "password", "pin"].includes(error) ? <p className="alert">Formulář prosím zkus vyplnit znovu.</p> : null}

          <form action={completeInviteAction} className="wizard-actions">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="name" value={name} />
            {!inviteEmail ? <input type="hidden" name="email" value={email} /> : null}
            <input type="hidden" name="password" value={password} />
            <input type="hidden" name="pin" value={pin} />
            {preferredRoles.map((role) => (
              <input key={`hidden-preferred-${role}`} type="hidden" name="preferredRoles" value={role} />
            ))}
            {excludedRoles.map((role) => (
              <input key={`hidden-excluded-${role}`} type="hidden" name="excludedRoles" value={role} />
            ))}
            {workPeriods.map((period) => (
              <input key={`hidden-period-${period}`} type="hidden" name="workPeriods" value={period} />
            ))}
            {workDayPreferences.map((value) => (
              <input key={`hidden-day-${value}`} type="hidden" name="workDayPreferences" value={value} />
            ))}

            <div className="row between wrap wizard-button-row">
              <button type="button" className="button ghost" onClick={previousStep} disabled={stepIndex === 0}>
                Zpět
              </button>
              {isLastStep ? (
                <button type="submit" className="button">
                  Vstoupit do aplikace
                </button>
              ) : (
                <button type="button" className="button" onClick={nextStep} disabled={!canContinue()}>
                  Další
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
