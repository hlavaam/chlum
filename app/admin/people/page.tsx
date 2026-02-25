import { createLocationAction, createUserAction, updateLocationAction, updateUserRoleAction } from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { APP_ROLES, roleLabels } from "@/lib/constants";
import { locationsService } from "@/lib/services/locations";
import { usersService } from "@/lib/services/users";

export default async function AdminPeoplePage() {
  await requireRoles(["admin"]);
  const [users, locations] = await Promise.all([usersService.loadAll(), locationsService.loadAll()]);

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
            <table>
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
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{roleLabels[user.role]}</td>
                    <td>
                      <form action={updateUserRoleAction} className="row gap-sm">
                        <input type="hidden" name="userId" value={user.id} />
                        <select name="role" defaultValue={user.role}>
                          {APP_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="button ghost">
                          Uložit
                        </button>
                      </form>
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
            <table>
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
                      <td>
                        <input form={formId} type="text" name="code" defaultValue={location.code} required />
                      </td>
                      <td>
                        <input form={formId} type="text" name="name" defaultValue={location.name} required />
                      </td>
                      <td>
                        <input
                          form={formId}
                          type="text"
                          name="address"
                          defaultValue={location.address}
                          required
                        />
                      </td>
                      <td>
                        <form id={formId} action={updateLocationAction} className="row gap-sm wrap">
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
