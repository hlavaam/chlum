import { notFound } from "next/navigation";

import { WorkOnboardingWizard } from "@/components/work-onboarding-wizard";
import { invitesService } from "@/lib/services/invites";
import { nowIso } from "@/lib/utils";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WorkInvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const invite = await invitesService.findByToken(token);
  if (!invite) notFound();

  const invalid =
    invite.expiresAt < nowIso() || (typeof invite.maxUses === "number" && invite.useCount >= invite.maxUses);
  const query = await searchParams;
  const error = readString(query.error);

  if (invalid) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-backdrop" />
        <div className="wizard-shell">
          <section className="wizard-card panel">
            <p className="alert">Tento onboarding odkaz už neplatí nebo vyčerpal limit použití.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <WorkOnboardingWizard
      token={token}
      inviteEmail={invite.email}
      error={error}
    />
  );
}
