/**
 * أفاتار الصوت — هوية بصرية حتمية لكل صوت بلا صور مخزنة:
 * تدرّج لوني يُشتق من معرّف الصوت نفسه، فيبقى ثابتاً في كل مكان يظهر فيه،
 * وحرف الاسم الأول في المنتصف. خفيف، فوري، ويعمل دون أي شبكة.
 */

/** توزيع حتمي للدرجة اللونية من نص المعرّف — نفس المعرّف = نفس اللون دائماً */
export function voiceHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export default function VoiceAvatar({
  id,
  name,
  size = 48,
  className = "",
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = voiceHue(id);
  const initial = name.trim().charAt(0) || "؟";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white shadow-inner ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 75% 32%))`,
      }}
    >
      {initial}
    </span>
  );
}
