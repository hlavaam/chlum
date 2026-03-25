import { loginWorkAction } from "@/lib/actions";

export function WorkBaseAccessForm({ error }: { error?: boolean }) {
  return (
    <form className="stack gap-sm" action={loginWorkAction}>
      <div>
        <p className="eyebrow">Základna</p>
        <h1>Přihlášení do píchačky</h1>
      </div>
      <p className="subtle">
        Přihlas se účtem Základna. Po přihlášení uvidíš jen kioskovou docházku pro dnešní provoz.
      </p>
      {error ? <p className="alert">Neplatný e-mail nebo heslo.</p> : null}
      <label>
        E-mail
        <input type="email" name="email" placeholder="ucet@zakladna.cz" required />
      </label>
      <label>
        Heslo
        <input type="password" name="password" placeholder="Zadej heslo" required />
      </label>
      <button type="submit" className="button">Vstoupit do Základny</button>
    </form>
  );
}
