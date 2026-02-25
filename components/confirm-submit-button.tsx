"use client";

import type { ComponentProps } from "react";

type Props = ComponentProps<"button"> & {
  confirmMessage?: string;
};

export function ConfirmSubmitButton({
  confirmMessage = "Opravdu pokračovat?",
  onClick,
  ...props
}: Props) {
  return (
    <button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    />
  );
}
