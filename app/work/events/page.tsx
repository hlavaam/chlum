import AdminEventsPage from "@/app/admin/events/page";
import { WorkAppFrame } from "@/components/work-app-frame";

export default function WorkEventsPage() {
  return (
    <WorkAppFrame>
      <AdminEventsPage />
    </WorkAppFrame>
  );
}
