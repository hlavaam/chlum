import type { Metadata, Viewport } from "next";

import { ZakladnaPwaRegister } from "@/components/zakladna-pwa-register";

export const metadata: Metadata = {
  manifest: "/work/zakladna/manifest.webmanifest",
  applicationName: "Zakladna Vysker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zakladna",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2ede3",
};

export default function ZakladnaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ZakladnaPwaRegister />
      {children}
    </>
  );
}
