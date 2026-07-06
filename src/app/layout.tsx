import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TenantProvider } from "@/lib/context/TenantContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FleetFlow SaaS - لوحة إدارة أساطيل حركة السيارات",
  description: "نظام متكامل لإدارة حركة السيارات، السائقين، الصيانة، والتسويات المالية لمكاتب تأجير السيارات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <TenantProvider>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}


