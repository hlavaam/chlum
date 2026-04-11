"use client";

import { useEffect } from "react";

export function ZakladnaPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/work/zakladna-sw.js", {
      scope: "/work/zakladna",
      updateViaCache: "none",
    }).catch((error) => {
      console.warn("[zakladna-pwa] Service worker registration failed.", error);
    });
  }, []);

  return null;
}
