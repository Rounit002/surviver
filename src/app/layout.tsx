import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";

/* DM Sans for language — outbid.lol uses it. Geist Mono for figures. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
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
    default: "Surviver.lol — the SaaS survival tournament",
    template: "%s — Surviver.lol",
  },
  description:
    "A promotional tournament for SaaS products. One flat entry fee, equal exposure for everyone, and measured visitor interest decides which product survives each round.",
  openGraph: {
    title: "Surviver.lol — the SaaS survival tournament",
    description:
      "35 products enter, one survives. One flat entry fee, equal exposure, and a rank nobody can buy.",
    siteName: "Surviver.lol",
    type: "website",
    images: [{
      url: "/social-preview.png",
      width: 1200,
      height: 630,
      alt: "Surviver.lol — 35 products enter. One survives.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    images: [{
      url: "/social-preview.png",
      alt: "Surviver.lol — 35 products enter. One survives.",
    }],
    title: "Surviver.lol — the SaaS survival tournament",
    description:
      "35 products enter, one survives. Equal exposure, a flat entry fee, and a rank nobody can buy.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fffdfa",
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
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* The doodle wallpaper is parked, not deleted: the background is plain
          for now. `DoodleField` and its `.doodle-*` rules in `globals.css` are
          still here, so bringing it back is re-adding the import and one
          `<DoodleField />` below.

          The background still belongs on the root rather than on `body`. That
          was done for the wallpaper, which paints at `z-index: -1` and would be
          covered by a background on `body`, and it needs to stay that way for
          the same reason the day the wallpaper returns. */}
      <body className="text-foreground flex min-h-full flex-col">
        {/* Applies a remembered dark theme before the page paints.

            It has to be inline and synchronous: anything deferred, imported or
            hydrated runs after first paint, and the reader would watch a warm
            page turn dark on every single navigation. Only "dark" is handled,
            because "light" is already what the server rendered. The nonce is
            what gets it past the CSP in `proxy.ts`. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"){document.documentElement.dataset.theme="dark";document.querySelector('meta[name="theme-color"]').content="#1a1512"}}catch(e){}`,
          }}
        />
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Surviver.lol",
          url: "https://surviver.lol",
          description: "A promotional tournament for SaaS products. 35 products enter, one survives.",
          inLanguage: "en",
        }).replace(/</g, "\\u003c") }} />
        {children}
      </body>
    </html>
  );
}
