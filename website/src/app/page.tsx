import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Problem } from "@/components/problem";
import { Meet } from "@/components/meet";
import { Features } from "@/components/features";
import { Download } from "@/components/download";
import { Footer } from "@/components/footer";
import { site } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "macOS (Apple Silicon)",
  softwareVersion: site.version,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  downloadUrl: site.releases,
  url: site.url,
  license: "https://opensource.org/licenses/MIT",
};

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Problem />
        <Meet />
        <Features />
        <Download />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
