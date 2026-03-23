import type { Metadata, Viewport } from "next";
import { PerfClientMetrics } from "@/components/perf-client-metrics";

import "./globals.css";

export const metadata: Metadata = {
  title: "Restaurace Vyskeř",
  description: "Restaurace, penzion a interní systém brigádníků na jednom webu.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>
        {children}
        <PerfClientMetrics />
      </body>
    </html>
  );
}
