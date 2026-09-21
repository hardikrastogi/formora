import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@hardikrastogi/react/styles.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Formora: schema-driven forms",
    template: "%s · Formora",
  },
  description:
    "Describe a form as JSON and render a working, validated, themeable form from it. Installable npm packages for any React app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          Formora is open source under the MIT license.
        </footer>
      </body>
    </html>
  );
}
