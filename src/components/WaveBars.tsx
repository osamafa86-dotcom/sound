/** موجة صوتية زخرفية متحركة — CSS فقط بلا JavaScript */
export default function WaveBars({ bars = 32, className = "" }: { bars?: number; className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-1 ${className}`}>
      {Array.from({ length: bars }, (_, i) => {
        // ارتفاعات شبه عشوائية ثابتة (تعتمد على الفهرس حتى يتطابق العرض بين الخادم والمتصفح)
        const h = 18 + ((i * 37) % 43);
        const delay = ((i * 13) % 10) / 10;
        const duration = 1.1 + ((i * 7) % 6) / 10;
        return (
          <span
            key={i}
            className="wave-bar w-1 md:w-1.5"
            style={{
              height: `${h}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
