import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Velour — Where Connections Become Extraordinary",
  description:
    "Velour is the world's most refined lifestyle dating community. Discover genuine connections with like-minded individuals in a luxurious, discreet environment. Join 52,000+ extraordinary members today.",
  keywords:
    "dating, lifestyle, connections, premium dating, luxury dating community, relationships, velour",
  authors: [{ name: "Velour" }],
  creator: "Velour",
  publisher: "Velour",
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
    locale: "en_GB",
    url: "https://velour.dating",
    siteName: "Velour",
    title: "Velour — Where Connections Become Extraordinary",
    description:
      "Join the world's most refined lifestyle dating community. 52,000+ extraordinary members. 120+ countries. Premium matching technology.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Velour — Where Connections Become Extraordinary",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Velour — Where Connections Become Extraordinary",
    description:
      "Join the world's most refined lifestyle dating community. Premium, discreet, extraordinary.",
    creator: "@velour_dating",
    images: ["/og-image.jpg"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: "#0A0A0F",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
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
          <SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}
