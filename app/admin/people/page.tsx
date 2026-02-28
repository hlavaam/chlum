import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createLocationAction,
  createUserAction,
  deleteUserAction,
  updateLocationAction,
  updateUserPasswordAction,
  updateUserRoleAction,
} from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { APP_ROLES, roleLabels } from "@/lib/constants";
import { getLocationsCached, getUsersCached } from "@/lib/services/cached-reads";

export default async function AdminPeoplePage() {
  const admin = await requireRoles(["admin"]);
  const [users, locations] = await Promise.all([getUsersCached(), getLocationsCached()]);

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <h2>Nový uživatel</h2>
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
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="Jméno">{user.name}</td>
                    <td data-label="E-mail">{user.email}</td>
                    <td data-label="Role">{roleLabels[user.role]}</td>
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
                          <input
                            type="password"
                            name="password"
                            minLength={6}
                            placeholder="Nové heslo"
                            required
                          />
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
                        <input
                          form={formId}
                          type="text"
                          name="address"
                          defaultValue={location.address}
                          required
                        />
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
