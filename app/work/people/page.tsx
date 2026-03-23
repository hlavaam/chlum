import AdminPeoplePage from "@/app/admin/people/page";
import { WorkAppFrame } from "@/components/work-app-frame";

export default function WorkPeoplePage() {
  return (
    <WorkAppFrame>
      <AdminPeoplePage />
    </WorkAppFrame>
  );
}
