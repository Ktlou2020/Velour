import type { Metadata, Viewport } from "next";
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from "./site";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import MobileNav from "@/components/MobileNav";
import PageTransition from "@/components/PageTransition";
import { ToastProvider } from "@/lib/toast-context";
import { ToastContainer } from "@/components/Toast";
import PWAInstall from "@/components/PWAInstall";
import AgeGate from "@/components/AgeGate";
import CookieBanner from "@/components/CookieBanner";
import OnlineTracker from "@/components/OnlineTracker";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "dating South Africa",
    "lifestyle dating",
    "couples dating",
    "discreet dating",
    "verified dating",
    "Johannesburg dating",
    "Cape Town dating",
    "Durban dating",
    "Hush",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    // The image itself comes from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom: blocking it fails WCAG 1.4.4 (resize text).
  viewportFit: "cover",
  themeColor: "#0A0A0F",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0A0F] text-white antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <AgeGate />
        <SessionProvider>
          <CookieBanner />
          <ToastProvider>
            <OnlineTracker />
            <PageTransition>
              {children}
            </PageTransition>
            <ToastContainer />
            <MobileNav />
            <PWAInstall />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
