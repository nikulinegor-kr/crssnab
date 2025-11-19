const TrustedBy = () => {
  return (
    <section className="flex flex-col gap-10 py-8 animate-fade-in">
      <h2 className="text-foreground text-xl md:text-2xl font-bold text-center">
        Нам доверяют лидеры отрасли
      </h2>
      <div className="flex flex-wrap justify-center items-center gap-12 md:gap-16 opacity-40 grayscale hover:grayscale-0 hover:opacity-70 transition-all duration-500">
        {/* Logo placeholders */}
        {[1, 2, 3, 4].map((index) => (
          <div 
            key={index} 
            className="h-8"
          >
            <svg className="h-full w-auto text-foreground fill-current" viewBox="0 0 128 35">
              <path d="M64 35C28.65 35 0 27.16 0 17.5S28.65 0 64 0s64 7.84 64 17.5-28.65 17.5-64 17.5zM36.1 17.5c0 7.1 12.44 12.83 27.9 12.83S91.9 24.6 91.9 17.5 79.46 4.67 64 4.67 36.1 10.4 36.1 17.5z" />
            </svg>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustedBy;
