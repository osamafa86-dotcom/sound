import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getSharedGeneration, type SharedGeneration } from "@/lib/sharedGeneration";
import { siteOrigin } from "@/lib/share";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

/**
 * صفحة المشاركة العامة — الوجه الذي تراه المنصات الخارجية.
 *
 * وسوم OG هنا هي ما يصنع بطاقة المعاينة في فيسبوك وواتساب وتويتر، ولهذا
 * تُبنى على الخادم: زاحف فيسبوك لا ينفّذ جافاسكربت ولن يرى وسماً يُضاف لاحقاً.
 */

type Props = { params: Promise<{ shareId: string }> };

function describe(generation: SharedGeneration): string {
  if (generation.kind === "song") {
    const maqam = MAQAMAT.find((m) => m.id === generation.maqamId);
    return maqam ? `أغنية بمقام ${maqam.name} — من استوديو مقام` : "أغنية من استوديو مقام";
  }
  const voice = VOICES.find((v) => v.id === generation.voiceId);
  return voice
    ? `بصوت ${voice.name} (${voice.dialect}) — من استوديو مقام`
    : "عمل صوتي من استوديو مقام";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const generation = await getSharedGeneration(shareId);
  if (!generation) return { title: "العمل غير متاح" };

  const origin = siteOrigin({ headers: await headers() });
  const title = generation.title || describe(generation);
  const description = generation.content?.slice(0, 200) || describe(generation);
  const audioUrl = `${origin}/api/share/${shareId}/audio`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${origin}/s/${shareId}`,
      type: "music.song",
      locale: "ar_AR",
      audio: [{ url: audioUrl, type: "audio/mpeg" }],
    },
    twitter: { card: "player", title, description },
    // صفحة عامة لعمل خاص بصاحبه: لا نريدها في نتائج البحث بلا إذن صريح
    robots: { index: false, follow: false },
  };
}

export default async function SharedWork({ params }: Props) {
  const { shareId } = await params;
  const generation = await getSharedGeneration(shareId);
  if (!generation) notFound();

  const title = generation.title || describe(generation);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-border-soft bg-surface-card p-8">
        <span className="text-4xl">{generation.kind === "song" ? "🎼" : "🎙️"}</span>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{describe(generation)}</p>

        <audio
          controls
          preload="metadata"
          src={`/api/share/${shareId}/audio`}
          className="mt-6 w-full"
        />

        {generation.content && (
          <p className="mt-6 whitespace-pre-wrap border-t border-border-soft pt-6 text-sm leading-relaxed text-muted">
            {generation.content}
          </p>
        )}

        <p className="mt-6 text-xs text-muted">
          {new Date(generation.createdAt).toLocaleDateString("ar", { dateStyle: "long" })}
        </p>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted">صُنع بالذكاء الاصطناعي على</p>
        <Link href="/" className="mt-1 inline-block text-xl font-bold">
          مقام<span className="text-primary">.</span>
        </Link>
        <p className="mt-3">
          <Link
            href="/tts"
            className="inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            جرّب أن تصنع مثله مجاناً
          </Link>
        </p>
      </div>
    </div>
  );
}
