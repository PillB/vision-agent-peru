import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTimeZone } from "next-intl/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  style: ["normal"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vision Agent — Agentic Camera Intelligence for Peru",
  description: "An agentic camera intelligence system that converts Peru's public plaza feeds into automated, auditable incident response — running entirely in the browser.",
  keywords: ["agentic AI", "computer vision", "Cusco", "Peru", "COCO-SSD", "anomaly detection"],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Vision Agent",
    description: "Agentic camera intelligence for Peru's public plazas",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vision Agent",
    description: "Agentic camera intelligence for Peru's public plazas",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider timeZone={timeZone}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton duration={3000} expand={false} visibleToasts={3} />
      </body>
    </html>
  );
}
