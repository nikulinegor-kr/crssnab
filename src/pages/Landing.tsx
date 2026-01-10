import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import VideoPreview from "@/components/landing/VideoPreview";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import AnimatedSection from "@/components/landing/AnimatedSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <div className="flex flex-1 justify-center py-3 md:py-5 px-2 sm:px-4 md:px-6 lg:px-10">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          <main className="flex flex-col gap-4 md:gap-6 lg:gap-8">
            <Hero />
            <AnimatedSection>
              <Features className="mx-0 px-[4px]" />
            </AnimatedSection>
            <AnimatedSection delay={100}>
              <VideoPreview />
            </AnimatedSection>
            <AnimatedSection delay={150}>
              <FAQSection />
            </AnimatedSection>
            <AnimatedSection delay={200}>
              <CTASection />
            </AnimatedSection>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Index;