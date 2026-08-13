import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vision Agent Perú — Agentic Intelligence Dashboard",
  description: "VP-grade dashboard for the Vision Agent Perú agentic system: entity correlation network + n8n-style agent decision flow visualization.",
  keywords: ["vision agent", "Perú", "agentic AI", "decision flow", "correlation network", "n8n", "anomaly detection"],
  authors: [{ name: "Vision Agent Perú" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Vision Agent Perú — Agentic Intelligence Dashboard",
    description: "Entity correlation network + n8n-style agent decision flow visualization",
    url: "https://pillb.github.io/vision-agent-peru/",
    siteName: "Vision Agent Perú",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vision Agent Perú — Agentic Intelligence Dashboard",
    description: "Entity correlation network + n8n-style agent decision flow visualization",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
