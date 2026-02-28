import Link from "next/link";

type Props = React.ComponentProps<typeof Link>;

export function AppLink({ prefetch = false, ...props }: Props) {
  return <Link prefetch={prefetch} {...props} />;
}
