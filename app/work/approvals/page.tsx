import { AppLink } from "@/components/app-link";
import { WorkAppFrame } from "@/components/work-app-frame";
import { removeAssignmentAction, updateAssignmentStatusAction } from "@/lib/actions";
import { requireRoles } from "@/lib/auth/rbac";
import { staffRoleLabels, shiftTypeLabels } from "@/lib/constants";
import { workPaths } from "@/lib/paths";
import { assignmentsService } from "@/lib/services/assignments";
import { locationsService } from "@/lib/services/locations";
import { shiftsService } from "@/lib/services/shifts";
import { usersService } from "@/lib/services/users";

async function WorkApprovalsContent() {
  await requireRoles(["manager", "admin"], {
    loginPath: workPaths.login,
    fallbackPath: workPaths.schedule,
  });

  const [assignments, shifts, users, locations] = await Promise.all([
    assignmentsService.loadAll(),
    shiftsService.loadAll(),
    usersService.loadAll(),
    locationsService.loadAll(),
  ]);

  const pendingAssignments = assignments
    .filter((assignment) => assignment.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const locationMap = new Map(locations.map((location) => [location.id, location]));

  return (
    <div className="stack gap-lg">
      <section className="panel stack">
        <div className="row between wrap">
          <div>
            <p className="eyebrow">Schválení</p>
            <h1>Čekající brigádníci</h1>
          </div>
          <span className={`badge ${pendingAssignments.length > 0 ? "warning" : "success"}`}>
            {pendingAssignments.length} čeká
          </span>
        </div>
      </section>

      {pendingAssignments.length === 0 ? (
        <section className="panel">
          <p>Teď není nic ke schválení.</p>
        </section>
      ) : (
        pendingAssignments.map((assignment) => {
          const shift = shiftMap.get(assignment.shiftId);
          const user = userMap.get(assignment.userId);
          const location = shift ? locationMap.get(shift.locationId) : null;
          if (!shift || !user) return null;

          return (
            <article key={assignment.id} className="panel stack">
              <div className="row between wrap align-start">
                <div>
                  <p>
                    <strong>{user.name}</strong> • {staffRoleLabels[assignment.staffRole]}
                  </p>
                  <p className="subtle">
                    {shift.date} • {shift.startTime}–{shift.endTime} • {location?.name} • {shiftTypeLabels[shift.type]}
                  </p>
                </div>
                <div className="row gap-sm wrap">
                  <form action={updateAssignmentStatusAction}>
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="status" value="confirmed" />
                    <input type="hidden" name="redirectTo" value={workPaths.approvals} />
                    <button type="submit" className="button">
                      Potvrdit
                    </button>
                  </form>
                  <form action={removeAssignmentAction}>
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="date" value={shift.date} />
                    <input type="hidden" name="redirectTo" value={workPaths.approvals} />
                    <button type="submit" className="button ghost danger">
                      Odebrat
                    </button>
                  </form>
                  <AppLink className="button ghost" href={workPaths.employeeDay(shift.date, shift.id)}>
                    Otevřít směnu
                  </AppLink>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

export default function WorkApprovalsPage() {
  return (
    <WorkAppFrame>
      <WorkApprovalsContent />
    </WorkAppFrame>
  );
}
