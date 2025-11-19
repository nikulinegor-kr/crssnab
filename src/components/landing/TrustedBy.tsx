const TrustedBy = () => {
  return (
    <section className="flex flex-col gap-10 py-8 animate-fade-in">
      <h2 className="text-foreground text-xl md:text-2xl font-bold text-center">
        Нам доверяют лидеры отрасли
      </h2>
      <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 opacity-50">
        {[1, 2, 3, 4].map((index) => (
          <div 
            key={index} 
            className="w-24 h-12 glassmorphism rounded-lg border border-border/30 flex items-center justify-center hover-scale"
          >
            <span className="text-muted-foreground text-xs font-medium">Logo {index}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustedBy;
