"use client";

export default function AudioPlayer({
  src,
  title,
  mock,
  filename = "maqam-audio.wav",
  note,
}: {
  src: string;
  title: string;
  mock?: boolean;
  filename?: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {mock && (
          <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            وضع تجريبي — بانتظار ربط مفاتيح الـ API
          </span>
        )}
      </div>
      <audio controls src={src} className="w-full" preload="auto" />
      {note && <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>}
      <a
        href={src}
        download={filename}
        className="mt-3 inline-block rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
      >
        ⬇ تنزيل الملف
      </a>
    </div>
  );
}
