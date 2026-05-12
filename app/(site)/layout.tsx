import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { AosInit } from "@/components/site/aos-init";
import { resolvePublicSiteOrigin } from "@/payload/server-url";
import "aos/dist/aos.css";
import "../globals.css";
import "./operations.css";
import "./property-pro.css";

const metadataBaseUrl = resolvePublicSiteOrigin({
  nodeEnv: process.env.NODE_ENV,
  publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  siteUrl: process.env.SITE_URL,
  vercelUrl: process.env.VERCEL_URL,
});

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: "Nihai Emlak",
  description: "Supabase, Payload ve odeme iskeleti ile emlak operasyon platformu.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <Suspense fallback={null}>
          <NoncedThemeProvider>
            <AosInit>
              <div className="property-pro">
                {children}
              </div>
            </AosInit>
          </NoncedThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}

async function NoncedThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme={false}
      nonce={nonce}
    >
      {children}
    </ThemeProvider>
  );
}
