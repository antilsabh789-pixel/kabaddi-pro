import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kabaddi Pro - Live Scoring & Tournaments",
  description: "Track live kabaddi matches, manage tournaments, and score in real-time with Kabaddi Pro.",
  keywords: ["Kabaddi", "Pro Kabaddi", "Scoring", "Tournament", "Live Score"],
  authors: [{ name: "Kabaddi Pro" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/app-icon.png",
  },
  openGraph: {
    title: "Kabaddi Pro",
    description: "Live kabaddi scoring & tournament management",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kabaddi Pro",
    description: "Live kabaddi scoring & tournament management",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/*
          NOTE: Cashfree JS SDK removed — we now use server-side form POST
          to Cashfree's /pg/view/sessions/checkout endpoint which is more
          reliable on mobile (no JS SDK loading issues, no "Invalid Session ID").
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
