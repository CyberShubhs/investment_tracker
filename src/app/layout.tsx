import "./globals.css";
import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/Nav";
import { RegisterSW } from "@/components/RegisterSW";

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
    icon: [{ url: "/icon-192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-192.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-base text-white antialiased">
        <StoreProvider>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
            <header className="py-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold">$</div>
                <div>
                  <div className="text-sm leading-tight font-semibold">Investment Tracker</div>
                  <div className="text-[11px] text-muted leading-tight">Personal net worth dashboard</div>
                </div>
              </div>
              <a href="/integrations" className="pill">Settings</a>
            </header>
            <Nav />
            <main className="mt-4">{children}</main>
          </div>
          <RegisterSW />
        </StoreProvider>
      </body>
    </html>
  );
}
