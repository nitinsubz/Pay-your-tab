import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getSiteOrigin } from "@/lib/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const rootOgImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "TabWrapped",
} as const;

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: "TabWrapped",
  description: "It's like spotify wrapped, except its the tab your broke ass ran up and now you're even more broke, wrapped.",
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  openGraph: {
    siteName: "TabWrapped",
    type: "website",
    images: [rootOgImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [new URL(rootOgImage.url, getSiteOrigin()).toString()],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
