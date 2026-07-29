/** حالة التحميل العامة — موجات صوتية نابضة على هوية مقام */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-end gap-1.5" aria-label="جارٍ التحميل">
        {[18, 32, 24, 38, 20].map((h, i) => (
          <span
            key={i}
            className="w-1.5 animate-pulse rounded-full bg-primary"
            style={{ height: h, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
