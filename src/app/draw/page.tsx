"use client";

/**
 * أكاديمية الرسم — موقع تعليم رسم متكامل داخل المنصة:
 * منهج ١٥ درساً في ٣ مستويات مع تتبع تقدم محلي، مدرب ذكي يقيّم رسمة
 * المتعلم المرفوعة (Gemini برؤية الصور عبر مسار /api/studio/ai النصي)،
 * وتوليد مرجع تدريبي بصري لكل درس عبر محرك الصور نفسه.
 */

import { useEffect, useState } from "react";
import { DRAW_LESSONS, LEVELS, type DrawLesson } from "@/lib/drawLessons";

const PROGRESS_KEY = "draw-academy-progress";

const COACH_LINES = [
  "👁️ المدرب يتفحص خطوطك...",
  "📐 يقيس النسب والاتزان...",
  "💡 يتتبع منطق الظل والنور...",
  "📝 يكتب ملاحظاته لك...",
];

export default function DrawAcademyPage() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<DrawLesson | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const [refUrl, setRefUrl] = useState("");
  const [refError, setRefError] = useState("");
  // المدرب الذكي
  const [work, setWork] = useState<File | null>(null);
  const [workPreview, setWorkPreview] = useState("");
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachLine, setCoachLine] = useState(COACH_LINES[0]);
  const [feedback, setFeedback] = useState("");
  const [coachError, setCoachError] = useState("");

  // التقدم محفوظ محلياً — لا حسابات في النسخة الخاصة
  useEffect(() => {
    // تأجيل القراءة لما بعد الالتحام — يمنع تعارض الترطيب وتسلسل التصيير
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (raw) setDone(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* تخزين غير متاح — نكمل بلا تتبع */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify([...next]));
      } catch {
        /* تجاهل */
      }
      return next;
    });
  }

  function openLesson(l: DrawLesson) {
    setOpen(l);
    setRefUrl("");
    setRefError("");
    setFeedback("");
    setCoachError("");
    pickWork(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickWork(f: File | null) {
    if (workPreview) URL.revokeObjectURL(workPreview);
    setWork(f);
    setWorkPreview(f ? URL.createObjectURL(f) : "");
  }

  /** توليد مرجع تدريبي بصري للدرس عبر محرك الصور */
  async function generateReference() {
    if (!open || refBusy) return;
    setRefBusy(true);
    setRefError("");
    try {
      const fd = new FormData();
      fd.append("mode", "image");
      fd.append(
        "prompt",
        open.refPrompt +
          "\nClean educational art reference sheet, clear demonstration, high detail, no text overlays, no watermark."
      );
      const res = await fetch("/api/studio/ai", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "تعذّر توليد المرجع");
      }
      if (refUrl) URL.revokeObjectURL(refUrl);
      setRefUrl(URL.createObjectURL(await res.blob()));
    } catch (e) {
      setRefError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setRefBusy(false);
    }
  }

  /** المدرب الذكي: يفحص رسمة المتعلم بعين الدرس الحالي (أو بعين عامة) */
  async function coachReview() {
    if (!work || coachBusy) return;
    setCoachBusy(true);
    setCoachError("");
    setFeedback("");
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % COACH_LINES.length;
      setCoachLine(COACH_LINES[i]);
    }, 2500);
    try {
      const focus = open
        ? `هذه الرسمة تمرين على درس «${open.title}» — ركّز تقييمك على: ${open.critFocus}.`
        : "هذه رسمة حرة — قيّمها تقييماً شاملاً: الخط، النسب، الظل والنور، التكوين.";
      const fd = new FormData();
      fd.append("mode", "text");
      fd.append(
        "prompt",
        `أنت مدرب رسم محترف حازم وحنون في أكاديمية رسم عربية. ${focus}
اكتب تقييمك بالعربية بهذا الشكل بالضبط:

⭐ الدرجة: (من ١٠)

💪 ثلاث نقاط قوة حقيقية في الرسمة (كن محدداً: أشر لمواضع بعينها)

🔍 أهم ثلاث ملاحظات للتحسين (اشرح لماذا وكيف يصلحها عملياً — لا نقداً عاماً)

🏋️ تمرين علاجي واحد مخصص لأكبر نقطة ضعف لاحظتها

🎯 جملة تشجيع صادقة تصف مستواه الحالي وقفزته القادمة`
      );
      fd.append("image", work, work.name || "drawing.jpg");
      const res = await fetch("/api/studio/ai", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التقييم — أعد المحاولة");
      setFeedback(String(data?.text ?? ""));
    } catch (e) {
      setCoachError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      clearInterval(timer);
      setCoachBusy(false);
    }
  }

  const total = DRAW_LESSONS.length;
  const doneCount = DRAW_LESSONS.filter((l) => done.has(l.id)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* الترويسة */}
      <div className="text-center">
        <p className="text-4xl">🎨</p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
          أكاديمية <span className="text-gradient">الرسم</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted">
          منهج متدرج من مسك القلم حتى البورتريه الاحترافي — ١٥ درساً عملياً،
          ومدرب ذكي يفحص رسوماتك ويعطيك ملاحظات مفصلة، ومراجع تدريب تولّدها بضغطة.
        </p>
        {/* شريط التقدم */}
        <div className="mx-auto mt-6 max-w-md">
          <div className="flex items-center justify-between text-xs font-bold text-muted">
            <span>تقدمك في المنهج</span>
            <span>
              {doneCount} / {total} درساً
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
          {doneCount === total && (
            <p className="mt-2 text-sm font-bold text-primary">🏆 أنهيت المنهج كاملاً — فنان معتمد من الأكاديمية!</p>
          )}
        </div>
      </div>

      {/* عرض الدرس المفتوح */}
      {open && (
        <div className="mt-10 rounded-3xl border border-gold/40 bg-surface-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-muted">
                {LEVELS.find((lv) => lv.id === open.level)?.name}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold">
                {open.emoji} {open.title}
              </h2>
              <p className="mt-1 text-sm text-accent">🎯 {open.goal}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleDone(open.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                  done.has(open.id)
                    ? "border-primary bg-primary text-white"
                    : "border-border-soft text-muted hover:border-primary hover:text-primary"
                }`}
              >
                {done.has(open.id) ? "✓ درس مكتمل" : "علّمه مكتملاً"}
              </button>
              <button
                onClick={() => setOpen(null)}
                className="rounded-xl border border-border-soft px-4 py-2 text-sm font-bold text-muted hover:text-body"
              >
                ✖ إغلاق
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* الشرح والخطوات */}
            <div className="space-y-5">
              <div>
                <h3 className="font-bold">📖 الفكرة</h3>
                {open.theory.map((t, i) => (
                  <p key={i} className="mt-2 text-sm leading-loose text-muted">
                    {t}
                  </p>
                ))}
              </div>
              <div>
                <h3 className="font-bold">🪜 خطوات التطبيق</h3>
                <ol className="mt-2 space-y-2">
                  {open.steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose text-xs font-extrabold text-primary">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl bg-rose p-4">
                <h3 className="text-sm font-extrabold text-primary">✍️ تمرين اليوم</h3>
                <p className="mt-1 text-sm leading-relaxed">{open.exercise}</p>
              </div>
            </div>

            {/* المرجع + تسليم التمرين */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-border-soft bg-surface p-5">
                <h3 className="font-bold">🖼️ مرجع تدريب للدرس</h3>
                <p className="mt-1 text-xs text-muted">
                  يولّده الذكاء الاصطناعي خصيصاً لموضوع هذا الدرس — انسخه بيدك على الورق.
                </p>
                {refUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={refUrl} alt={`مرجع ${open.title}`} className="mt-3 w-full rounded-xl border border-border-soft" />
                ) : null}
                <button
                  onClick={generateReference}
                  disabled={refBusy}
                  className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
                >
                  {refBusy ? "🎨 يرسم المرجع..." : refUrl ? "🔄 ولّد مرجعاً آخر" : "✨ ولّد مرجع التدريب"}
                </button>
                {refError && <p className="mt-2 text-xs font-bold text-primary-strong">{refError}</p>}
              </div>

              <div className="rounded-2xl border-2 border-dashed border-gold/50 bg-surface p-5">
                <h3 className="font-bold">👨‍🏫 سلّم تمرينك للمدرب</h3>
                <p className="mt-1 text-xs text-muted">
                  صوّر رسمتك بإضاءة جيدة وارفعها — يقيّمها المدرب الذكي بعين هذا الدرس تحديداً.
                </p>
                <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border-soft bg-surface-card p-4 text-center transition-colors hover:border-primary">
                  {workPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={workPreview} alt="تمرينك" className="max-h-52 rounded-lg" />
                  ) : (
                    <>
                      <span className="text-2xl">📤</span>
                      <span className="text-sm font-semibold">اضغط لرفع صورة رسمتك</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => pickWork(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  onClick={coachReview}
                  disabled={!work || coachBusy}
                  className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
                >
                  {coachBusy ? coachLine : "🎓 قيّم تمريني"}
                </button>
                {coachError && <p className="mt-2 text-xs font-bold text-primary-strong">{coachError}</p>}
                {feedback && (
                  <div className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-card p-4 text-sm leading-loose">
                    {feedback}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* المنهج */}
      {LEVELS.map((lv) => (
        <section key={lv.id} className="mt-12">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{lv.emoji}</span>
            <div>
              <h2 className="text-xl font-extrabold">{lv.name}</h2>
              <p className="text-sm text-muted">{lv.desc}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DRAW_LESSONS.filter((l) => l.level === lv.id).map((l, idx) => (
              <button
                key={l.id}
                onClick={() => openLesson(l)}
                className={`rounded-2xl border p-5 text-start transition-all hover:shadow-md ${
                  done.has(l.id)
                    ? "border-primary/50 bg-rose"
                    : "border-border-soft bg-surface-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{l.emoji}</span>
                  {done.has(l.id) && <span className="text-sm font-extrabold text-primary">✓ مكتمل</span>}
                </div>
                <p className="mt-2 text-xs font-bold text-muted">
                  الدرس {DRAW_LESSONS.filter((x) => x.level === lv.id).indexOf(l) + 1 + (lv.id === 1 ? 0 : lv.id === 2 ? 5 : 10)}
                </p>
                <h3 className="font-extrabold">{l.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{l.goal}</p>
                <span className="mt-3 inline-block text-sm font-bold text-primary">
                  ابدأ الدرس ←
                </span>
                {idx === -1 ? null : null}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* المدرب الحر */}
      {!open && (
        <section className="mt-14 rounded-3xl border border-gold/40 bg-surface-card p-6 text-center md:p-8">
          <span className="text-3xl">👨‍🏫</span>
          <h2 className="mt-2 text-xl font-extrabold">مدرب التقييم الحر</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            عندك رسمة خارج المنهج؟ ارفعها هنا وسيقيّمها المدرب الذكي تقييماً شاملاً:
            درجة، نقاط قوة، ملاحظات عملية، وتمرين علاجي مخصص لك.
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-soft bg-surface p-5 transition-colors hover:border-primary">
              {workPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={workPreview} alt="رسمتك" className="max-h-56 rounded-lg" />
              ) : (
                <>
                  <span className="text-2xl">📤</span>
                  <span className="text-sm font-semibold">ارفع صورة رسمتك</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => pickWork(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={coachReview}
              disabled={!work || coachBusy}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-3 font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {coachBusy ? coachLine : "🎓 قيّم رسمتي الآن"}
            </button>
            {coachError && <p className="mt-2 text-xs font-bold text-primary-strong">{coachError}</p>}
            {feedback && (
              <div className="mt-4 whitespace-pre-wrap rounded-xl bg-surface p-4 text-start text-sm leading-loose">
                {feedback}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
