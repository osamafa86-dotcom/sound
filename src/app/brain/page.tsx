import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import { getVoiceScores } from "@/lib/brain";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { variantAvg, type PromptVariantRow } from "@/lib/promptVariants";
import WaveLine from "@/components/WaveLine";

/** لوحة العقل — شفافية كاملة: ماذا تعلمت المنصة ولماذا ترتب كما ترتب */
export const dynamic = "force-dynamic";

const SIGNAL_LABELS: Record<string, string> = {
  played_to_end: "🎧 استماع كامل",
  replayed: "🔁 إعادة استماع",
  downloaded: "⬇️ تنزيل",
  saved: "💾 حفظ في المكتبة",
  shared: "🔗 مشاركة",
  regenerated: "🔄 نسخة أخرى",
  section_regen: "🎯 إعادة مقطع",
  version_chosen: "🏆 اختيار نسخة",
  version_rejected: "📉 نسخة خاسرة",
};

async function collect() {
  const admin = getSupabaseAdmin();
  const voiceScores = await getVoiceScores();

  const signalsByKind = new Map<string, number>();
  let variants: PromptVariantRow[] = [];
  const auto = { tts: { count: 0, sum: 0 }, song: { count: 0, sum: 0 } };

  if (admin) {
    const [sigs, vars, evals] = await Promise.all([
      admin.from("signals").select("kind").order("created_at", { ascending: false }).limit(2000),
      admin.from("prompt_variants").select("*").order("maqam_id"),
      admin.from("auto_evals").select("kind, score").order("created_at", { ascending: false }).limit(2000),
    ]);
    for (const s of sigs.data ?? []) {
      signalsByKind.set(s.kind, (signalsByKind.get(s.kind) ?? 0) + 1);
    }
    variants = (vars.data ?? []) as PromptVariantRow[];
    for (const e of evals.data ?? []) {
      const bucket = e.kind === "tts" ? auto.tts : auto.song;
      bucket.count++;
      bucket.sum += Number(e.score);
    }
  }

  return { voiceScores, signalsByKind, variants, auto };
}

export default async function BrainPage() {
  const { voiceScores, signalsByKind, variants, auto } = await collect();
  const disabled = process.env.BRAIN_DISABLED === "1";

  const rankedVoices = [...voiceScores.values()]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)
    .map((s) => ({ ...s, voice: VOICES.find((v) => v.id === s.voiceId) }));

  const signalsTotal = [...signalsByKind.values()].reduce((a, b) => a + b, 0);

  const variantsByMaqam = new Map<string, PromptVariantRow[]>();
  for (const v of variants) {
    const g = variantsByMaqam.get(v.maqam_id) ?? [];
    g.push(v);
    variantsByMaqam.set(v.maqam_id, g);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        عقل <span className="text-gradient">المنصة</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-2 max-w-3xl leading-relaxed text-muted">
        كل ما تراه هنا تعلمته المنصة من الاستخدام الفعلي: نجوم التقييم، الإشارات الضمنية
        (استماع كامل، حفظ، مشاركة...)، والنقد الذاتي الآلي. لا شيء مرتب يدوياً.
      </p>
      {disabled && (
        <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          ⏸️ العقل متوقف مؤقتاً (BRAIN_DISABLED) — تُعرض البيانات المخزنة دون أي تعلم جديد.
        </p>
      )}

      {/* الحواس */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">👂 الحواس — {signalsTotal} إشارة ضمنية مجمعة</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(SIGNAL_LABELS).map(([kind, label]) => (
            <div key={kind} className="rounded-2xl border border-border-soft bg-surface-card p-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{signalsByKind.get(kind) ?? 0}</p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* النقد الذاتي */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">🔍 النقد الذاتي — العقل يقيّم نواتجه بالعينات</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
            <p className="text-sm font-semibold">🎙️ دقة نطق الأصوات (Scribe ↔ النص)</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {auto.tts.count ? `${Math.round((auto.tts.sum / auto.tts.count) * 100)}٪` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">{auto.tts.count} فحصاً آلياً</p>
          </div>
          <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
            <p className="text-sm font-semibold">🎼 الالتزام المقامي للأغاني (حكم Gemini)</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {auto.song.count ? `${Math.round((auto.song.sum / auto.song.count) * 100)}٪` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">{auto.song.count} استماعاً ناقداً</p>
          </div>
        </div>
      </section>

      {/* ترتيب الأصوات */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">🏅 الأصوات الأعلى رضاً (مدموجة من المصادر الثلاثة)</h2>
        {rankedVoices.length ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border-soft">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-surface-card text-start text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">الصوت</th>
                  <th className="px-4 py-3 text-start">اللهجة</th>
                  <th className="px-4 py-3 text-start">الدرجة</th>
                  <th className="px-4 py-3 text-start">الأدلة</th>
                </tr>
              </thead>
              <tbody>
                {rankedVoices.map((r) => (
                  <tr key={r.voiceId} className="border-t border-border-soft">
                    <td className="px-4 py-3 font-semibold">
                      {r.voice ? `${r.voice.gender === "male" ? "👨" : "👩"} ${r.voice.name}` : r.voiceId}
                    </td>
                    <td className="px-4 py-3 text-muted">{r.voice?.dialect ?? "—"}</td>
                    <td className="px-4 py-3 text-gold">★ {r.avg.toFixed(1)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border-soft p-6 text-sm text-muted">
            لا ترتيب بعد — يظهر حين تتجمع أدلة كافية (تقييمات أو إشارات أو فحوص آلية).
          </p>
        )}
      </section>

      {/* سلالات البرومبتات */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">🧬 سلالات برومبتات المقامات المتنافسة</h2>
        <p className="mt-1 text-sm text-muted">
          لكل مقام سلالات تتنافس؛ الأفضل يظهر أكثر، وجلسة التأمل الأسبوعية تلد سلالات محسّنة.
        </p>
        {variantsByMaqam.size ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[...variantsByMaqam.entries()].map(([maqamId, group]) => (
              <div key={maqamId} className="rounded-2xl border border-border-soft bg-surface-card p-4">
                <p className="font-bold">مقام {MAQAMAT.find((m) => m.id === maqamId)?.name ?? maqamId}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {group.map((v) => (
                    <div key={v.id} className="rounded-xl bg-surface p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${v.source === "seed" ? "bg-border-soft text-muted" : "bg-accent/15 text-accent"}`}>
                          {v.source === "seed" ? "🌱 بذرة" : "🧬 تأمل"}
                        </span>
                        {!v.active && <span className="text-red-400">معطَّلة</span>}
                        <span className="text-gold">
                          {v.score_count ? `${Math.round(variantAvg(v) * 100)}٪` : "لم تُحكَم بعد"}
                        </span>
                        <span className="text-muted">
                          {v.uses} استخداماً · {v.score_count} دليلاً
                        </span>
                      </div>
                      <p dir="ltr" className="mt-2 line-clamp-2 text-start leading-relaxed text-muted">
                        {v.prompt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-border-soft p-6 text-sm text-muted">
            السلالات تُبذر في أول جلسة تأمل — تعمل تلقائياً كل يوم اثنين، وحتى ذلك الحين يُستخدم
            برومبت المقام الأساسي.
          </p>
        )}
      </section>

      <p className="mt-12 rounded-2xl border border-border-soft bg-surface-card p-5 text-sm leading-relaxed text-muted">
        💡 كيف تجعل العقل أذكى؟ استخدم المنصة بصدق: قيّم أعمالك بالنجوم، احفظ ما يعجبك،
        وشارك أفضله — كل إشارة تصقل الترتيب والإعدادات والبرومبتات للجميع.
      </p>
    </div>
  );
}
