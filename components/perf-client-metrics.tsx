"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

const enabled = process.env.NEXT_PUBLIC_PERF_LOGGING === "1";

export function PerfClientMetrics() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    if (!enabled) return;
    console.info(
      `[web-vitals] metric=${metric.name} value=${metric.value} rating=${metric.rating ?? "n/a"} path=${pathname}`,
    );
  });

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      const resourceCount = performance
        .getEntriesByType("resource")
        .filter((entry) => "initiatorType" in entry)
        .length;
      console.info(`[web-resources] path=${pathname} count=${resourceCount}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
