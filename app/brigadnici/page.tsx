import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { staffPaths } from "@/lib/paths";

export default async function StaffHomePage() {
  const user = await getCurrentUser();
  redirect(user ? staffPaths.employees : staffPaths.login);
}
