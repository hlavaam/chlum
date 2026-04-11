import { WorkLoginForm } from "@/components/work-login-form";

export function WorkBaseAccessForm({ error }: { error?: boolean }) {
  return (
    <div className="stack gap-sm">
      <div>
        <p className="eyebrow">Základna</p>
        <h1>Přihlášení do píchačky</h1>
      </div>
      <p className="subtle">
        Přihlas se účtem Základna. Po přihlášení uvidíš jen kioskovou docházku pro dnešní provoz.
      </p>
      <WorkLoginForm initialError={Boolean(error)} submitLabel="Vstoupit do Základny" loginPath="/work/zakladna" />
    </div>
  );
}
