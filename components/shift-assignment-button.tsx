"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authFetch } from "@/lib/auth/client";
import type { StaffRole } from "@/types/models";

type Props = {
  shiftId: string;
  action: "signup" | "unassign";
  staffRole?: StaffRole;
  className?: string;
  children: React.ReactNode;
};

export function ShiftAssignmentButton({ shiftId, action, staffRole, className, children }: Props) {
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
          const response = await authFetch(`/api/shifts/${shiftId}/${action}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(action === "signup" && staffRole ? { staffRole } : {}),
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
