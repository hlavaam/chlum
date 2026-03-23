import { redirect } from "next/navigation";

import { workPaths } from "@/lib/paths";

export default function LegacyBrigadniciAdminEventsPage() {
  redirect(workPaths.events);
}
