import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { PerfClientMetrics } from "@/components/perf-client-metrics";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Restaurace Vyskeř",
  description: "Veřejný web restaurace Vyskeř s denním menu a základními informacemi pro hosty.",
  icons: {
    icon: "/hero/vyskerlogo.png",
    apple: "/hero/vyskerlogo.png",
    shortcut: "/hero/vyskerlogo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body className={montserrat.variable}>
        {children}
        <PerfClientMetrics />
      </body>
    </html>
  );
}
