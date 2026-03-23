import AdminSchedulePage from "@/app/admin/schedule/page";
import { WorkAppFrame } from "@/components/work-app-frame";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function WorkSchedulePage(props: Props) {
  return (
    <WorkAppFrame>
      <AdminSchedulePage {...props} />
    </WorkAppFrame>
  );
}
