import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { WorkAppFrame } from "@/components/work-app-frame";
import {
  createInviteAction,
  createLocationAction,
  createUserAction,
  deleteInviteAction,
  deleteUserAction,
  updateLocationAction,
  updateUserPasswordAction,
  updateUserRoleAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { APP_ROLES, roleLabels, staffRoleLabels, workDayPreferenceLabels, workPeriodLabels } from "@/lib/constants";
import { workPaths } from "@/lib/paths";
import { getInvitesCached, getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";
import { nowIso } from "@/lib/utils";

async function WorkPeopleContent() {
  const admin = await requireRoles(["manager", "admin"], {
    loginPath: workPaths.login,
    fallbackPath: workPaths.schedule,
  });
  const [users, locations, invites] = await Promise.all([getUsersCached(), getLocationsCached(), getInvitesCached()]);
  const activeInvites = invites
    .filter((invite) => invite.expiresAt >= nowIso() && (typeof invite.maxUses !== "number" || invite.useCount < invite.maxUses))
    .sort((a, b) => (a.label ?? a.token).localeCompare(b.label ?? b.token));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vysker.com";

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <h2>Vytvořit sdílený onboarding odkaz</h2>
        <form action={createInviteAction} className="grid-form">
          <label>
            Název odkazu
            <input type="text" name="label" placeholder="Např. Letní brigádníci 2026" />
          </label>
          <label>
            Pozice
            <input type="text" name="position" placeholder="Např. Plac / Kuchyň / Úklid" />
          </label>
          <label>
            Role účtu
            <select name="role" defaultValue="brigadnik">
              {APP_ROLES.filter((role) => role !== "base").map((role) => (
                <option key={`invite-${role}`} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Poznámka k pozvánce
            <input type="text" name="note" placeholder="Např. letní výpomoc / plac + úklid" />
          </label>
          <fieldset className="full">
            <legend>Pobočky</legend>
            <div className="checkbox-grid">
              {locations.map((location) => (
                <label key={`invite-location-${location.id}`} className="checkbox-pill">
                  <input type="checkbox" name="locationIds" value={location.id} defaultChecked />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="button">
            Vytvořit onboarding odkaz
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2>Aktivní onboarding odkazy</h2>
        {activeInvites.length === 0 ? <p className="subtle">Zatím tu nejsou žádné aktivní pozvánky.</p> : null}
        {activeInvites.map((invite) => (
          <div key={invite.id} className="stack gap-sm list-row">
            <div>
              <p>
                <strong>{invite.label ?? "Sdílený onboarding odkaz"}</strong>
              </p>
              <p className="subtle">
                Pozice: <strong>{invite.position ?? "Neuvedeno"}</strong>
              </p>
              <p className="subtle">
                Platí do {invite.expiresAt.slice(0, 10)} • použito {invite.useCount}x
                {invite.note ? ` • ${invite.note}` : ""}
              </p>
            </div>
            <div className="stack gap-sm">
              <input readOnly value={`${siteUrl}${workPaths.join(invite.token)}`} />
              <form action={deleteInviteAction}>
                <input type="hidden" name="inviteId" value={invite.id} />
                <ConfirmSubmitButton
                  type="submit"
                  className="button ghost danger small"
                  confirmMessage={`Smazat onboarding odkaz ${invite.label ?? "bez názvu"}?`}
                >
                  Smazat odkaz
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2>Nový uživatel bez onboardingu</h2>
        <p className="subtle">
          Pro kioskové účty na píchačku zvol roli <strong>Základna</strong> a vyber pobočku, kterou má ten účet obsluhovat.
        </p>
        <form action={createUserAction} className="grid-form">
          <label>
            Jméno
            <input type="text" name="name" required />
          </label>
          <label>
            E-mail
            <input type="email" name="email" required />
          </label>
          <label>
            Heslo
            <input type="password" name="password" defaultValue="heslo123" required />
          </label>
          <label>
            PIN
            <input type="password" name="pin" inputMode="numeric" pattern="[0-9]{4}" placeholder="4 čísla" />
          </label>
          <label>
            Role
            <select name="role" defaultValue="brigadnik">
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="full">
            <legend>Pobočky</legend>
            <div className="checkbox-grid">
              {locations.map((location) => (
                <label key={location.id} className="checkbox-pill">
                  <input type="checkbox" name="locationIds" value={location.id} />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="button">
            Vytvořit uživatele
          </button>
        </form>
      </section>

      <section className="grid-2">
        <div className="panel stack">
          <h2>Uživatelé</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Jméno</th>
                  <th>E-mail</th>
                  <th>Role</th>
                  <th>Profil brigádníka</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Jméno">
                      <div className="row gap-sm align-center wrap">
                        {user.photoDataUrl ? <img className="approval-user-photo" src={user.photoDataUrl} alt={user.name} /> : null}
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td data-label="E-mail">{user.email}</td>
                    <td data-label="Role">{roleLabels[user.role]}</td>
                    <td data-label="Profil brigádníka">
                      {user.role === "base" ? (
                        <div className="stack gap-sm">
                          <p className="tiny">
                            <strong>Kiosk účet:</strong> jen pro přihlášení do Základny
                          </p>
                          <p className="tiny">
                            <strong>Pobočky:</strong>{" "}
                            {user.locationIds.length > 0
                              ? user.locationIds
                                  .map((locationId) => locations.find((location) => location.id === locationId)?.name ?? locationId)
                                  .join(", ")
                              : "neuvedeno"}
                          </p>
                        </div>
                      ) : (
                        <div className="stack gap-sm">
                          <p className="tiny">
                            <strong>Onboarding:</strong> {user.onboardingCompleted ? "hotovo" : "čeká"}
                          </p>
                          <p className="tiny">
                            <strong>Preferuje:</strong>{" "}
                            {user.preferredRoles.length > 0
                              ? user.preferredRoles.map((role) => staffRoleLabels[role]).join(", ")
                              : "neuvedeno"}
                          </p>
                          <p className="tiny">
                            <strong>Nechce:</strong>{" "}
                            {user.excludedRoles.length > 0
                              ? user.excludedRoles.map((role) => staffRoleLabels[role]).join(", ")
                              : "neuvedeno"}
                          </p>
                          <p className="tiny">
                            <strong>Období:</strong>{" "}
                            {user.workPeriods.length > 0
                              ? user.workPeriods.map((period) => workPeriodLabels[period]).join(", ")
                              : "neuvedeno"}
                          </p>
                          <p className="tiny">
                            <strong>Dny:</strong>{" "}
                            {user.workDayPreferences.length > 0
                              ? user.workDayPreferences.map((value) => workDayPreferenceLabels[value]).join(", ")
                              : "neuvedeno"}
                          </p>
                        </div>
                      )}
                    </td>
                    <td data-label="Akce">
                      <div className="stack admin-user-actions">
                        <form action={updateUserRoleAction} className="row gap-sm wrap admin-inline-form">
                          <input type="hidden" name="userId" value={user.id} />
                          <select name="role" defaultValue={user.role}>
                            {APP_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="button ghost">
                            Uložit roli
                          </button>
                        </form>

                        <form action={updateUserPasswordAction} className="row gap-sm wrap admin-inline-form">
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="password" name="password" minLength={6} placeholder="Nové heslo" required />
                          <button type="submit" className="button ghost">
                            Změnit heslo
                          </button>
                        </form>

                        <form action={deleteUserAction} className="row gap-sm wrap admin-inline-form">
                          <input type="hidden" name="userId" value={user.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            className="button ghost danger"
                            disabled={admin.id === user.id}
                            confirmMessage={`Smazat uživatele ${user.name}?`}
                          >
                            Smazat uživatele
                          </ConfirmSubmitButton>
                        </form>
                        {admin.id === user.id ? <p className="subtle tiny">Aktuálně přihlášený admin nejde smazat.</p> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel stack">
          <h2>Pobočky</h2>
          <form action={createLocationAction} className="stack">
            <label>
              Název
              <input type="text" name="name" required />
            </label>
            <label>
              Kód
              <input type="text" name="code" required />
            </label>
            <label>
              Adresa
              <input type="text" name="address" required />
            </label>
            <button type="submit" className="button">
              Přidat pobočku
            </button>
          </form>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kód</th>
                  <th>Název</th>
                  <th>Adresa</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => {
                  const formId = `location-edit-${location.id}`;
                  return (
                    <tr key={location.id}>
                      <td data-label="Kód">
                        <input form={formId} type="text" name="code" defaultValue={location.code} required />
                      </td>
                      <td data-label="Název">
                        <input form={formId} type="text" name="name" defaultValue={location.name} required />
                      </td>
                      <td data-label="Adresa">
                        <input form={formId} type="text" name="address" defaultValue={location.address} required />
                      </td>
                      <td data-label="Akce">
                        <form id={formId} action={updateLocationAction} className="row gap-sm wrap admin-inline-form">
                          <input type="hidden" name="locationId" value={location.id} />
                          <button type="submit" className="button ghost">
                            Uložit
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function WorkPeoplePage() {
  return (
    <WorkAppFrame>
      <WorkPeopleContent />
    </WorkAppFrame>
  );
}
