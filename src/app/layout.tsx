import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Archivo, Spline_Sans_Mono } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { Nav, MobileTabBar } from "@/components/Nav";
import { RegisterSW } from "@/components/RegisterSW";
import { AuthGate } from "@/components/AuthGate";

const sans = Archivo({ subsets: ["latin"], variable: "--font-sans" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Investment Tracker",
  description: "Track your assets, liabilities, investments, and net worth.",
  applicationName: "Investment Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "InvestTrack",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-192.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#070a0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg-base text-white antialiased font-sans">
        <AuthGate>
          <StoreProvider>
            <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-28 sm:pb-16">
              <header className="pt-[max(env(safe-area-inset-top),1.1rem)] pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold font-mono">
                    $
                  </div>
                  <div className="text-sm font-semibold tracking-tight">InvestTrack</div>
                </div>
                <Nav />
              </header>
              <main className="mt-1 sm:mt-3">{children}</main>
            </div>
            <MobileTabBar />
            <RegisterSW />
          </StoreProvider>
        </AuthGate>
      </body>
    </html>
  );
}
