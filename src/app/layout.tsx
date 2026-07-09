import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { Header } from "@/components/Header";
import { PWARegistration } from "@/components/PWARegistration";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RawShare",
  description: "View and download shared media files in high resolution.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${outfit.variable} ${outfit.className} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-black text-white">
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          <Toaster theme="dark" position="bottom-right" />
          <PWARegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
