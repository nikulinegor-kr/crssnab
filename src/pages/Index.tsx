import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import VideoPreview from "@/components/landing/VideoPreview";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col">
          <Header />
          <main className="flex flex-col gap-32 md:gap-40 lg:gap-48">
            <Hero />
            <Features />
            <VideoPreview />
            <CTASection />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Index;
