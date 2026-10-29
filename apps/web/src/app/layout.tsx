import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LiveProvider } from "@/components/live-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const textFont = localFont({
  src: "../lib/fonts/archivo-latin-wght-normal.woff2",
  variable: "--font-text",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: "Arial",
});

const figuresFont = localFont({
  src: "../lib/fonts/martian-mono-latin-wght-normal.woff2",
  variable: "--font-figures",
  weight: "100 800",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Indoquake · Gempa terkini Indonesia",
    template: "%s · Indoquake",
  },
  description:
    "Gempa bumi dan status tsunami terkini di seluruh Indonesia dari data terbuka BMKG, diperbarui langsung.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Indoquake",
    title: "Indoquake · Gempa terkini Indonesia",
    description:
      "Gempa bumi dan status tsunami terkini di seluruh Indonesia dari data terbuka BMKG.",
    url: SITE_URL,
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0ee" },
    { media: "(prefers-color-scheme: dark)", color: "#121517" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${textFont.variable} ${figuresFont.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col pb-16 sm:pb-0">
        <a href="#konten" className="skip-link">
          Lewati ke konten utama
        </a>
        <LiveProvider>
          <SiteHeader />
          <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
        </LiveProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
