"use client";

import { useState } from "react";

export function CopyButton({ value, className = "button ghost small" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={className} onClick={() => void handleCopy()}>
      {copied ? "Zkopírováno" : "Kopírovat"}
    </button>
  );
}
