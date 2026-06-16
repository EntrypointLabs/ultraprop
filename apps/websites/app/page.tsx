import { Nav } from "@/components/Nav";
import { BottomCta } from "@/components/sections/BottomCta";
import { Faq } from "@/components/sections/Faq";
import { Features } from "@/components/sections/Features";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { Investors } from "@/components/sections/Investors";
import { Press } from "@/components/sections/Press";
import { Stats } from "@/components/sections/Stats";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Features />
        <Investors />
        <Press />
        <Faq />
        <BottomCta />
      </main>
      <Footer />
    </>
  );
}
