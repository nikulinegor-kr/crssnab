const VideoPreview = () => {
  return (
    <section className="flex flex-col gap-10 py-12 animate-fade-in">
      <h2 className="text-foreground text-3xl md:text-4xl font-black text-center">
        Посмотрите в действии
      </h2>
      <div className="w-full max-w-5xl mx-auto">
        <div className="relative w-full aspect-video glassmorphism rounded-2xl border border-border shadow-2xl overflow-hidden hover-scale">
          <div className="absolute inset-0 bg-card/30"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform cursor-pointer">
              <span className="material-symbols-outlined text-primary-foreground text-4xl">play_arrow</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoPreview;
