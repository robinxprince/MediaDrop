import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { MotionProvider } from "@/components/motion-provider";
import { site } from "@/lib/site";
import "./globals.css";

const title = "MediaDrop: Stop switching tabs. Start creating.";
const description =
  "Search stock video, music, sound effects, images and GIFs from many sites at once, and drop what you find straight into Adobe Premiere Pro. Free and open source for macOS.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title,
  description,
  applicationName: site.name,
  keywords: ["Premiere Pro", "stock footage", "video editing", "sound effects", "asset search", "content creators", "macOS"],
  authors: [{ name: "robinxprince", url: "https://github.com/robinxprince" }],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: site.name, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-fg focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
