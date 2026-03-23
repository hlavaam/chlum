import { WorkAppFrame } from "@/components/work-app-frame";

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  return <WorkAppFrame>{children}</WorkAppFrame>;
}
