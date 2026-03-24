import { requireUser } from "@/lib/auth/rbac";
import { workPaths } from "@/lib/paths";
import { scheduleService } from "@/lib/services/schedule";
import { formatTimeRange } from "@/lib/utils";
import { staffRoleLabels } from "@/lib/constants";

export default async function MyPage() {
  const user = await requireUser({ loginPath: workPaths.login });
  const myShifts = await scheduleService.myShifts(user.id);

  return (
    <section className="panel stack">
      <h2>Moje směny</h2>
      {myShifts.length === 0 ? <p className="subtle">Zatím nejsi přihlášen/a na žádnou směnu.</p> : null}
      {myShifts.map((item) => (
        <div className="list-row my-shift-row" key={item.assignment.id}>
          <div>
            <p>
              <strong>{item.shift.date}</strong> • {formatTimeRange(item.shift.startTime, item.shift.endTime)}
            </p>
            <p className="subtle">
              {item.location?.name ?? item.shift.locationId} • {item.shift.type}
            </p>
            <p className="subtle tiny">Role na směně: {staffRoleLabels[item.assignment.staffRole] ?? item.assignment.staffRole}</p>
          </div>
          <span className={`badge ${item.assignment.status === "pending" ? "warning" : "success"}`}>
            {item.assignment.status === "pending" ? "Čeká" : "Potvrzeno"}
          </span>
        </div>
      ))}
    </section>
  );
}
