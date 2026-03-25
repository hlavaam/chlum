"use client";

import type { ComponentProps } from "react";

type Props = ComponentProps<"button"> & {
  confirmMessage?: string;
};

export function ConfirmSubmitButton({ confirmMessage: _confirmMessage, ...props }: Props) {
  return <button {...props} />;
}
