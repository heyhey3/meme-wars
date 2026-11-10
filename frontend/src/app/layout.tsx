import type { Metadata, Viewport } from "next";
import "@near-wallet-selector/modal-ui/styles.css";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { DemoBanner } from "@/components/DemoBanner";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Meme Wars ($WAR) — The joke needs rules",
  description:
    "Two factions. One map. Every day the losing stake burns. A NEP-141 memecoin where the supply reacts to the community.",
  applicationName: "Meme Wars",
  keywords: [
    "NEAR",
    "memecoin",
    "NEP-141",
    "hackathon",
    "game",
    "Meme Wars",
  ],
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <Nav />
          <DemoBanner />
          <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
            {children}
          </main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
