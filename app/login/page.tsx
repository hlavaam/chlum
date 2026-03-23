import { redirect } from "next/navigation";

import { staffPaths } from "@/lib/paths";

export default function LegacyLoginPage() {
  redirect(staffPaths.login);
}
