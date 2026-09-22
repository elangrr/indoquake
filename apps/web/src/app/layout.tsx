import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Indoquake — Monitor Gempa & Tsunami Jawa",
  description:
    "Informasi gempa bumi dan tsunami terkini untuk Pulau Jawa berdasarkan data terbuka BMKG. Sumber data: BMKG.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden">
        <SiteHeader />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
