import { Play } from "lucide-react";

const VideoPreview = () => {
  return (
    <section className="flex flex-col gap-6 py-6 animate-fade-in">
      <h2 className="text-foreground text-3xl md:text-4xl font-black text-center">
        Посмотрите в действии
      </h2>
      <div className="w-full max-w-5xl mx-auto">
        <div className="relative w-full aspect-video glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 bg-card/30 group-hover:bg-card/40 transition-colors duration-300"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button 
              className="relative flex items-center justify-center rounded-full w-20 h-20 bg-primary/80 text-primary-foreground backdrop-blur-sm hover:bg-primary transition-all duration-300 transform group-hover:scale-110 shadow-lg shadow-primary/20"
              aria-label="Play demo video"
            >
              <Play className="w-10 h-10 fill-current ml-1" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoPreview;
