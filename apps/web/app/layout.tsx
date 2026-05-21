import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionBootstrap } from "@/components/auth/session-bootstrap";
import { Providers } from "@/app/providers";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist"
});

export const metadata: Metadata = {
  title: "AI Social Media Automation Platform",
  description: "Automate Instagram and Facebook comments, DMs, AI replies, leads, analytics, and multi-brand workflows."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} antialiased`}>
        <Providers>
          <SessionBootstrap>{children}</SessionBootstrap>
        </Providers>
      </body>
    </html>
  );
}
