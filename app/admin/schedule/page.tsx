import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSchedulePage(_props: Props) {
  redirect("/admin");
}
