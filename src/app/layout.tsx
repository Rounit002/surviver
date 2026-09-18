import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import { DoodleField } from "@/components/layout/DoodleField";

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
  verification: { google: "8iN_AsYMOxUsABcU4cnGBQnuFxc1Jfj-XBCjLyLMgFE" },
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
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      // Light is the default, and it is the server that says so. The script
      // below is the only thing that moves off it.
      data-theme="light"
      // That script runs before hydration, so on a reader who chose dark the
      // attribute React finds is not the one it rendered. React reports that as
      // a mismatch and then leaves the DOM alone, which is both noisy and
      // exactly the behaviour we want — the alternative is rendering the wrong
      // theme first and correcting it in view. Scoped to this element only:
      // it does not cover any descendant.
      suppressHydrationWarning
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* No background on `body`: the root paints the canvas so the doodle
          wallpaper, which sits below the flow at `z-index: -1`, is not
          painted over. See the `html` rule in `globals.css`. */}
      <body className="text-foreground flex min-h-full flex-col">
        {/* Applies a remembered dark theme before the page paints.

            It has to be inline and synchronous: anything deferred, imported or
            hydrated runs after first paint, and the reader would watch a white
            page turn dark on every single navigation. Only "dark" is handled,
            because "light" is already what the server rendered. The nonce is
            what gets it past the CSP in `proxy.ts`. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"){document.documentElement.dataset.theme="dark";document.querySelector('meta[name="theme-color"]').content="#121016"}}catch(e){}`,
          }}
        />
        <DoodleField />
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Surviver.lol",
          url: "https://surviver.lol",
          description: "A performance-based promotional tournament for SaaS products.",
          inLanguage: "en",
        }).replace(/</g, "\\u003c") }} />
        {children}
      </body>
    </html>
  );
}
