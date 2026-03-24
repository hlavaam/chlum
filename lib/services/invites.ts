import { BaseCrudService } from "@/lib/services/base-crud";
import { invitesRepository } from "@/lib/storage/repositories";
import { loadResourceByField } from "@/lib/storage/resource-queries";
import type { InviteRecord } from "@/types/models";

function normalizeInvite(invite: InviteRecord): InviteRecord {
  return {
    ...invite,
    email: invite.email || undefined,
    label: invite.label || undefined,
    reusable: invite.reusable !== false,
    useCount: Number.isFinite(invite.useCount) ? invite.useCount : invite.usedAt ? 1 : 0,
    maxUses: typeof invite.maxUses === "number" ? invite.maxUses : undefined,
  };
}

class InvitesService extends BaseCrudService<InviteRecord> {
  async loadAll() {
    const rows = await super.loadAll();
    return rows.map(normalizeInvite);
  }

  async findByToken(token: string) {
    const rows = await loadResourceByField<InviteRecord>("invites", "token", token, () => this.loadAll());
    return rows[0] ? normalizeInvite(rows[0]) : null;
  }
}

export const invitesService = new InvitesService(invitesRepository);
