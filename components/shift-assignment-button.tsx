"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  shiftId: string;
  action: "signup" | "unassign";
  className?: string;
  children: React.ReactNode;
};

export function ShiftAssignmentButton({ shiftId, action, className, children }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        const y = window.scrollY;
        startTransition(async () => {
          const response = await fetch(`/api/shifts/${shiftId}/${action}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          if (!response.ok) return;
          router.refresh();
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "auto" });
          });
        });
      }}
    >
      {pending ? "..." : children}
    </button>
  );
}
