import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Social metadata belongs to the public brand domain, even when APP_URL
  // still points at the deployment provider's internal/default hostname.
  metadataBase: new URL("https://surviver.lol"),
  title: {
    default: "Surviver.lol — 32 products enter. One survives.",
    template: "%s — Surviver.lol",
  },
  description:
    "A performance-based promotional tournament for SaaS products. Every product gets equal exposure. Measured visitor interest decides who advances.",
  openGraph: {
    title: "Surviver.lol — 32 products enter. One survives.",
    description:
      "A performance-based promotional tournament for SaaS products. Every product gets equal exposure. Measured visitor interest decides who advances.",
    siteName: "Surviver.lol",
    type: "website",
    images: [{
      url: "/social-preview.png",
      width: 1200,
      height: 630,
      alt: "Surviver.lol — 32 products enter. One survives. A tournament for SaaS products.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{
      url: "/social-preview.png",
      alt: "Surviver.lol — 32 products enter. One survives. A tournament for SaaS products.",
    }],
    title: "Surviver.lol — 32 products enter. One survives.",
    description:
      "A performance-based promotional tournament for SaaS products. Attention decides who advances.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f2f5",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">{children}</body>
    </html>
  );
}
