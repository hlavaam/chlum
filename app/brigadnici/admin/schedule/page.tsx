import { redirect } from "next/navigation";

import { workPaths } from "@/lib/paths";

export default function LegacyBrigadniciAdminSchedulePage() {
  redirect(workPaths.schedule);
}
