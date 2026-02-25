import { requireUser } from "@/lib/auth/rbac";
import { scheduleService } from "@/lib/services/schedule";
import { formatTimeRange } from "@/lib/utils";

export default async function MyPage() {
  const user = await requireUser();
  if (user.role !== "brigadnik") {
    return (
      <div className="panel stack">
        <h2>Moje směny</h2>
        <p className="subtle">Manažer/Admin zde směny neřeší. Použij záložku Admin pro vypisování provozu.</p>
      </div>
    );
  }
  const myShifts = await scheduleService.myShifts(user.id);

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <h2>Moje směny</h2>
        {myShifts.length === 0 ? <p className="subtle">Zatím nejsi přihlášen/a na žádný den.</p> : null}
        {myShifts.map((item) => (
          <div className="list-row my-shift-row" key={item.assignment.id}>
            <div>
              <p>
                <strong>{item.shift.date}</strong> • {formatTimeRange(item.shift.startTime, item.shift.endTime)}
              </p>
              <p className="subtle">
                {item.location?.name ?? item.shift.locationId} • {item.shift.type}
              </p>
            </div>
            <span className={`badge ${item.assignment.status === "pending" ? "warning" : "success"}`}>
              {item.assignment.status === "pending" ? "Čeká" : "Potvrzeno"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
