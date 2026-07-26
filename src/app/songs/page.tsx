"use client";

import { useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import Karaoke from "@/components/Karaoke";
import SaveToLibrary from "@/components/SaveToLibrary";
import { findActiveWord, type KaraokeWord } from "@/lib/karaoke";
import { HERITAGE_STYLE_IDS, heritageStyle } from "@/lib/heritage/palestinian";
import { emitSignal } from "@/lib/signalClient";
import { DIALECTS, INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { authHeaders } from "@/lib/supabase";
import {
  MAX_SECTIONS,
  SECTION_LABELS,
  SECTION_MAX_SEC,
  SECTION_MIN_SEC,
  estimateDurationSec,
  joinSections,
  parseSections,
  sectionsTotalSec,
  type SectionKind,
  type SongSection,
} from "@/lib/songSections";
import type { AssistMode, AssistResult } from "@/lib/assistant/types";

const STEPS = ["الكلمات", "المقام والأسلوب", "التوليد"] as const;

type AssistResponse = AssistResult & { fellBack?: string };

type JobStatusResponse = {
  status: "pending" | "running" | "done" | "failed";
  stage?: string;
  provider?: string;
  stylePrompt?: string;
  mock?: boolean;
  fellBack?: string;
  error?: string;
  elevenSongId?: string;
};

type RecentJob = {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  stage: string;
  tier: "preview" | "full";
  maqamId: string;
  styleId: string;
  durationSec?: number;
  provider?: string;
  mock?: boolean;
  createdAt: number;
};

const DURATIONS = [
  { sec: 60, label: "دقيقة" },
  { sec: 120, label: "دقيقتان" },
  { sec: 180, label: "3 دقائق" },
] as const;

type SongResult = {
  url: string;
  blob: Blob;
  jobId: string;
  mock: boolean;
  prompt: string;
  ext: string;
  fellBack: boolean;
  provider?: string;
  /** لقطة وقت التوليد — تسمح بعرض النسخ السابقة بعناوينها الصحيحة */
  maqamName: string;
  title: string;
  /** معرّف الناتج لدى المحرك — يفتح إعادة التوليد الجزئي للمقاطع */
  elevenSongId?: string;
  /** مُعالج بلمسة الماستر (تطبيع + fade + قص صمت) */
  mastered?: boolean;
};

type ImageBriefResponse = {
  titleAr: string;
  descriptionAr: string;
  maqamId: string;
  maqamReason: string;
  stylePromptEn: string;
};

export default function SongsStudio() {
  const [step, setStep] = useState(0);
  const [lyrics, setLyrics] = useState("");
  const [maqamId, setMaqamId] = useState(MAQAMAT[0].id);
  const [styleId, setStyleId] = useState<string>(SONG_STYLES[0].id);
  const [instrumentIds, setInstrumentIds] = useState<string[]>(["oud", "darbuka"]);
  const [tier, setTier] = useState<"preview" | "full">("full");
  const [durationSec, setDurationSec] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<SongResult | null>(null);
  /** كل نسخ هذه الجلسة بالأحدث أولاً — للمقارنة واختيار الأفضل */
  const [versions, setVersions] = useState<SongResult[]>([]);
  const [error, setError] = useState("");

  const [idea, setIdea] = useState("");
  const [dialectId, setDialectId] = useState<string>(DIALECTS[0].id);
  const [assist, setAssist] = useState<AssistResponse | null>(null);
  const [assistLoading, setAssistLoading] = useState<"" | AssistMode>("");
  const [assistError, setAssistError] = useState("");

  // من صورة إلى موسيقى — عين المنصة
  const [imageBrief, setImageBrief] = useState<ImageBriefResponse | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [imageError, setImageError] = useState("");

  // سجل «توليداتي» — مهام المستخدم المحفوظة على الخادم
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  // الشخصنة: مقام المستخدم المفضل يتقدم افتراضياً
  const [personalMaqam, setPersonalMaqam] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/songs")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRecentJobs(d.jobs ?? []);
      })
      .catch(() => {});
    fetch("/api/me/profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const topMaqamId = d?.profile?.topMaqamId;
        const maqamName = MAQAMAT.find((m) => m.id === topMaqamId)?.name;
        if (topMaqamId && maqamName) {
          setMaqamId(topMaqamId);
          setPersonalMaqam(maqamName);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // عينات المقامات: اختر بأذنك — سلّم المقام بأرباع نغماته
  const [playingMaqam, setPlayingMaqam] = useState("");
  const [sampleError, setSampleError] = useState("");
  function toggleMaqamSample(id: string) {
    let audio = document.getElementById("maqam-sample") as HTMLAudioElement | null;
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "maqam-sample";
      audio.preload = "auto";
      document.body.appendChild(audio);
    }
    if (playingMaqam === id) {
      audio.pause();
      setPlayingMaqam("");
      return;
    }
    setSampleError("");
    audio.src = `/api/maqamat/${id}/sample`;
    audio.onended = () => setPlayingMaqam("");
    // فشل التحميل أو التشغيل لا يبقى صامتاً — يُطفأ الزر وتظهر رسالة
    audio.onerror = () => {
      setPlayingMaqam("");
      setSampleError("تعذّر تحميل عينة المقام — حدّث الصفحة وجرّب مجدداً");
    };
    audio
      .play()
      .then(() => setPlayingMaqam(id))
      .catch(() => {
        setPlayingMaqam("");
        setSampleError("منع المتصفح تشغيل الصوت — اضغط الزر مرة أخرى");
      });
  }

  // بنية الأغنية المُهيكلة + التحكم الغنائي
  const [sections, setSections] = useState<SongSection[] | null>(null);
  const [singer, setSinger] = useState<"female" | "male">("female");
  const [bpm, setBpm] = useState<number | null>(null);
  /** لهجة الأداء الغنائي — تتبع لهجة الكتابة افتراضياً وتُغيَّر في خطوة التوليد */
  const [deliveryDialectId, setDeliveryDialectId] = useState<string>(DIALECTS[0].id);

  // المدقق اللغوي: إملاء + تشكيل تام حسب اللهجة
  const [proofing, setProofing] = useState(false);
  const [proofIssues, setProofIssues] = useState<{ original: string; fixed: string; reason: string }[] | null>(null);

  async function proofread() {
    if (proofing) return;
    setProofing(true);
    setAssistError("");
    try {
      const res = await fetch("/api/lyrics/proofread", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          sections: sections ?? undefined,
          lyrics: sections ? undefined : lyrics,
          dialectId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التدقيق");
      if (sections && data.sections) {
        applySections(data.sections);
      } else {
        setLyrics(data.lyrics ?? lyrics);
      }
      setProofIssues(data.issues ?? []);
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setProofing(false);
    }
  }

  // التصحيح الموضعي المتعلم: علّم العقل النطق وأعد غناء المقطع المتأثر فقط
  const [fixWord, setFixWord] = useState("");
  const [fixAlias, setFixAlias] = useState("");
  const [fixBusy, setFixBusy] = useState(false);
  const [fixMsg, setFixMsg] = useState("");

  async function fixPronunciation() {
    const word = fixWord.trim();
    const alias = fixAlias.trim();
    if (!word || !alias || fixBusy || !result) return;
    setFixBusy(true);
    setFixMsg("");
    setError("");
    try {
      // ١) تعليم العقل — يُطبَّق تلقائياً على كل توليد قادم (أصواتاً وأغانيَ)
      const learn = await fetch("/api/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, alias }),
      });
      const learnData = await learn.json().catch(() => null);
      if (!learn.ok) throw new Error(learnData?.error ?? "تعذّر حفظ النطق");

      // ٢) تصحيح الكلمات محلياً
      const replaceIn = (text: string) => text.split(word).join(alias);
      const nextSections = sections?.map((s) => ({ ...s, lyrics: replaceIn(s.lyrics) })) ?? null;
      const affected = sections?.findIndex((s) => s.lyrics.includes(word)) ?? -1;
      if (nextSections) applySections(nextSections);
      else setLyrics(replaceIn(lyrics));

      // ٣) إعادة غناء المقطع المتأثر وحده إن أمكن — وإلا نسخة كاملة مصححة
      const canInpaint =
        affected >= 0 && nextSections && result.elevenSongId && tier === "full" && !result.mock;
      setFixWord("");
      setFixAlias("");
      if (canInpaint) {
        setFixMsg(
          `✓ تعلّم العقل نطق «${word}» — نعيد غناء ${SECTION_LABELS[nextSections[affected].kind]} وحده الآن`
        );
        await generate({
          sections: nextSections,
          regenerateSectionIndex: affected,
          sourceSongId: result.elevenSongId,
        });
      } else {
        setFixMsg(`✓ تعلّم العقل نطق «${word}» — نولّد نسخة مصححة كاملة`);
        await generate(nextSections ? { sections: nextSections } : undefined);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setFixBusy(false);
    }
  }

  /** تحديث المقاطع مع إبقاء النص الكامل متزامناً (هو ما يُحفظ ويُعدّ كلماته) */
  function applySections(next: SongSection[] | null) {
    setSections(next);
    if (next) setLyrics(joinSections(next));
  }

  function updateSection(i: number, patch: Partial<SongSection>) {
    if (!sections) return;
    applySections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function moveSection(i: number, dir: -1 | 1) {
    if (!sections) return;
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    applySections(next);
  }

  function addSection(kind: SectionKind) {
    const next = [...(sections ?? []), { kind, lyrics: "", durationSec: estimateDurationSec(kind, "") }];
    applySections(next.slice(0, MAX_SECTIONS));
  }

  const maqam = MAQAMAT.find((m) => m.id === maqamId)!;
  const instrumental = styleId === "instrumental";

  function toggleInstrument(id: string) {
    setInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runAssist(mode: AssistMode) {
    setAssistError("");
    setAssistLoading(mode);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mode, idea, lyrics, dialectId, styleId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "تعذّر تشغيل المساعد، حاول مجدداً");
      }
      setAssist(data);
      setLyrics(data.lyrics);
      setMaqamId(data.maqamId);
      // بنية المساعد تفتح محرر المقاطع مباشرة
      if (data.sections?.length) setSections(data.sections);
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setAssistLoading("");
    }
  }

  async function analyzeImage(file: File) {
    setImageError("");
    setImageBrief(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/songs/image-brief", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل الصورة");
      setImageBrief(data);
      // اعتماد قراءة الصورة تلقائياً: مقامها المقترح وأسلوب موسيقي آلي
      setMaqamId(data.maqamId);
      setStyleId("instrumental");
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setImageAnalyzing(false);
    }
  }

  /** متابعة مهمة حتى الاكتمال وجلب ناتجها — تخدم التوليد الجديد واستعادة المهام معاً */
  async function watchJob(jobId: string, snapshot: { maqamName: string; title: string }) {
    // استعلام دوري عن حالة المهمة حتى الاكتمال (مهلة قصوى ٢٠٠ محاولة × ١.٥ ثانية = ٥ دقائق)
    let status: JobStatusResponse | null = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const sres = await fetch(`/api/songs/${jobId}`);
      status = (await sres.json().catch(() => null)) as JobStatusResponse | null;
      if (!sres.ok) {
        throw new Error(status?.error ?? "تعذّر متابعة حالة المهمة");
      }
      setStage(status?.stage ?? "");
      if (status?.status === "done") break;
      if (status?.status === "failed") {
        throw new Error(status.error ?? "فشل التوليد، حاول مجدداً");
      }
    }
    if (status?.status !== "done") {
      throw new Error("انتهت مهلة انتظار التوليد، حاول مجدداً");
    }

    const ares = await fetch(`/api/songs/${jobId}/audio`);
    if (!ares.ok) {
      throw new Error("تعذّر جلب الملف الصوتي");
    }
    const blob = await ares.blob();
    const song: SongResult = {
      url: URL.createObjectURL(blob),
      blob,
      jobId,
      mock: !!status.mock,
      prompt: status.stylePrompt ?? "",
      ext: blob.type === "audio/mpeg" ? "mp3" : "wav",
      fellBack: !!status.fellBack,
      provider: status.provider,
      elevenSongId: status.elevenSongId,
      maqamName: snapshot.maqamName,
      title: snapshot.title,
    };
    // أدوات ما بعد التوليد تعود لنقطة الصفر مع كل ناتج جديد
    setKaraokeWords(null);
    setActiveWord(-1);
    setShareCopied(false);
    setCoverUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setResult(song);
    setVersions((prev) => [song, ...prev]);
  }

  async function generate(extras?: Record<string, unknown>) {
    // إشارات نفور ضمنية: طلب نسخة أخرى أو إعادة مقطع = عدم رضا عن السابقة
    if (result && !result.mock) {
      if (extras?.regenerateSectionIndex !== undefined) {
        emitSignal({
          kind: "section_regen",
          maqamId,
          settings: { stylePrompt: result.prompt },
          meta: { sectionIndex: extras.regenerateSectionIndex },
        });
      } else {
        emitSignal({ kind: "regenerated", maqamId, settings: { stylePrompt: result.prompt } });
      }
    }
    setError("");
    setLoading(true);
    setStage("جارٍ إنشاء المهمة...");
    setResult(null);
    try {
      // أولوية البرومبت: موجز الصورة ثم المساعد — ما دام المستخدم باقياً على المقام المقترح
      const aiStylePrompt =
        imageBrief && imageBrief.maqamId === maqamId && styleId === "instrumental"
          ? imageBrief.stylePromptEn
          : assist && assist.maqamId === maqamId
            ? assist.stylePromptEn
            : undefined;

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          lyrics,
          maqamId,
          styleId,
          instrumentIds,
          tier,
          durationSec,
          aiStylePrompt,
          // بنية المقاطع تُترجم خطة تأليف كاملة لدى المحرك (النسخة الكاملة فقط)
          sections: tier === "full" && sections?.length ? sections : undefined,
          singer: instrumental ? undefined : singer,
          bpm: bpm ?? undefined,
          // لهجة الأداء: نطق أصيل باللهجة المختارة
          dialectId: instrumental ? undefined : deliveryDialectId,
          // «نسخة أخرى»: رقم النسخة يدفع المحرك للتنويع بدل تكرار التوزيع
          variation: versions.length,
          ...extras,
        }),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(created?.error ?? "تعذّر التوليد، حاول مجدداً");
      }

      const maqamName = MAQAMAT.find((m) => m.id === maqamId)?.name ?? "";
      await watchJob(created.jobId as string, {
        maqamName,
        title:
          assist?.title && assist.title !== "مسودة تجريبية"
            ? assist.title
            : imageBrief?.titleAr && styleId === "instrumental"
              ? imageBrief.titleAr
              : tier === "preview"
                ? `معاينة بمقام ${maqamName}`
                : `أغنية بمقام ${maqamName}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  /** استعادة مهمة من سجل «توليداتي» — حتى بعد إغلاق الصفحة أثناء التوليد */
  async function resumeJob(job: RecentJob) {
    setStep(2);
    setError("");
    setLoading(true);
    setStage("جارٍ الاستعادة...");
    setResult(null);
    try {
      const maqamName = MAQAMAT.find((m) => m.id === job.maqamId)?.name ?? "";
      await watchJob(job.id, {
        maqamName,
        title: job.tier === "preview" ? `معاينة بمقام ${maqamName}` : `أغنية بمقام ${maqamName}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  // الكاريوكي والغلاف والمشاركة — أدوات ما بعد التوليد
  const [karaokeWords, setKaraokeWords] = useState<KaraokeWord[] | null>(null);
  const [karaokeBusy, setKaraokeBusy] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  /** موضع التشغيل يقود إضاءة كلمات الكاريوكي */
  function handlePlayerTime(sec: number) {
    if (!karaokeWords) return;
    const idx = findActiveWord(karaokeWords, sec);
    setActiveWord((prev) => (prev === idx ? prev : idx));
  }

  async function startKaraoke() {
    if (!result || karaokeBusy) return;
    setKaraokeBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("audio", result.blob, `song.${result.ext}`);
      const res = await fetch("/api/karaoke", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت مزامنة الكلمات");
      setKaraokeWords(data.words);
      setActiveWord(-1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setKaraokeBusy(false);
    }
  }

  async function makeCover() {
    if (!result || coverBusy) return;
    setCoverBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ title: result.title, maqamId, stylePrompt: result.prompt }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "تعذّر توليد الغلاف");
      }
      const blob = await res.blob();
      setCoverUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setCoverBusy(false);
    }
  }

  async function copyShareLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/share/${result.jobId}`);
      setShareCopied(true);
      // المشاركة أعلى إشارات الرضا
      emitSignal({ kind: "shared", maqamId, settings: { stylePrompt: result.prompt } });
    } catch {
      setError("تعذّر نسخ الرابط — انسخه يدوياً من شريط العنوان بعد فتح الصفحة");
    }
  }

  /** لمسة الماستر — معالجة نهائية في المتصفح: تطبيع + قص صمت + fade */
  const [mastering, setMastering] = useState(false);
  async function applyMaster() {
    if (!result || result.mastered || mastering) return;
    setMastering(true);
    try {
      const { masterAudio } = await import("@/lib/audioMaster");
      const blob = await masterAudio(result.blob);
      const song: SongResult = {
        ...result,
        blob,
        url: URL.createObjectURL(blob),
        ext: "wav",
        mastered: true,
      };
      setResult(song);
      setVersions((prev) => prev.map((v, i) => (i === 0 ? song : v)));
    } catch {
      setError("تعذّرت معالجة الماستر في هذا المتصفح — الملف الأصلي كما هو");
    } finally {
      setMastering(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        استوديو <span className="text-gradient">الأغاني والمقامات</span>
      </h1>
      <p className="mt-2 text-muted">
        ثلاث خطوات: اكتب الكلمات، اختر المقام والأسلوب، ثم ولّد أغنيتك.
      </p>

      {/* شريط الخطوات */}
      <ol className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              onClick={() => setStep(i)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                i === step
                  ? "border-gold bg-gold/10 text-gold"
                  : i < step
                    ? "border-border-soft text-body"
                    : "border-border-soft text-muted"
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {/* الخطوة 1: الكلمات */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            {/* مساعد الكلمات والمقامات */}
            <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <h2 className="text-lg font-bold">
                ✨ مساعد <span className="text-gradient">الكلمات والمقامات</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                اكتب فكرة أغنيتك ليؤلّف لك المساعد الكلمات ويقترح المقام الأنسب لمعناها، أو الصق كلماتك الجاهزة في الأسفل ثم حسّنها.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  maxLength={500}
                  placeholder="فكرة الأغنية... مثال: شوق للوطن بعد سنين غربة"
                  className="flex-1 rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-gold"
                />
                <select
                  value={dialectId}
                  onChange={(e) => {
                    setDialectId(e.target.value);
                    // لهجة الأداء الغنائي تتبع لهجة الكتابة حتى يغيّرها المستخدم بنفسه
                    setDeliveryDialectId(e.target.value);
                  }}
                  className="rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-gold"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => runAssist("write")}
                  disabled={!!assistLoading || !idea.trim()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistLoading === "write" ? "جارٍ التأليف..." : "✨ اكتب لي الكلمات"}
                </button>
                <button
                  onClick={() => runAssist("improve")}
                  disabled={!!assistLoading || !lyrics.trim()}
                  className="rounded-xl border border-gold px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistLoading === "improve" ? "جارٍ التحسين..." : "✨ حسّن كلماتي واقترح المقام"}
                </button>
              </div>
              {assistError && (
                <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {assistError}
                </p>
              )}
              {assist && (
                <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm">
                  <p className="font-semibold text-gold">
                    {assist.title && assist.title !== "مسودة تجريبية" && `«${assist.title}» — `}
                    المقام المقترح: {MAQAMAT.find((m) => m.id === assist.maqamId)?.name}
                  </p>
                  <p className="mt-1 leading-relaxed">{assist.maqamReason}</p>
                  <p className="mt-2 text-xs text-muted">
                    اعتُمد المقام المقترح تلقائياً — يمكنك تغييره في الخطوة التالية.
                  </p>
                  {assist.mock && (
                    <p className="mt-2 text-xs text-muted">
                      {assist.fellBack
                        ? "تعذّر الوصول لمحرك Claude من هذه البيئة، فعُرض اقتراح تجريبي مبسّط بدلاً منه."
                        : "اقتراح من الوضع التجريبي — يُفعَّل التأليف والتحليل الفعليان عند ربط مفتاح Claude API."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* من صورة إلى موسيقى */}
            <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <h2 className="text-lg font-bold">
                🖼️ من صورة إلى <span className="text-gradient">موسيقى</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                ارفع صورة — مشهداً، لوحة، ذكرى — وستقرأ المنصة مزاجها وتقترح المقام وتؤلف لها موسيقاها.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10">
                  {imageAnalyzing ? "جارٍ قراءة الصورة..." : imagePreview ? "🖼️ صورة أخرى" : "🖼️ اختر صورة"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={imageAnalyzing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) analyzeImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {imagePreview && (
                  /* eslint-disable-next-line @next/next/no-img-element -- معاينة blob محلية */
                  <img
                    src={imagePreview}
                    alt="الصورة المرفوعة"
                    className="h-16 w-16 rounded-xl border border-border-soft object-cover"
                  />
                )}
              </div>
              {imageError && (
                <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {imageError}
                </p>
              )}
              {imageBrief && (
                <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
                  <p className="font-semibold text-accent">
                    «{imageBrief.titleAr}» — المقام المقترح: {MAQAMAT.find((m) => m.id === imageBrief.maqamId)?.name}
                  </p>
                  <p className="mt-1 leading-relaxed">{imageBrief.descriptionAr}</p>
                  <p className="mt-1 text-xs text-muted">{imageBrief.maqamReason}</p>
                  <button
                    onClick={() => setStep(2)}
                    className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90"
                  >
                    🎼 اعتمد وانتقل للتوليد ←
                  </button>
                </div>
              )}
            </div>

            {sections ? (
              <div className="rounded-2xl border border-gold/40 bg-surface-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">
                    🧩 بنية <span className="text-gradient">الأغنية</span>
                    <span className="ms-3 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                      {sections.length} مقاطع · {Math.floor(sectionsTotalSec(sections) / 60)}:
                      {String(sectionsTotalSec(sections) % 60).padStart(2, "0")} دقيقة
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={proofread}
                      disabled={proofing}
                      title="إملاء + تشكيل تام لكل كلمة كما تُنطق باللهجة — أعلى رافعة لسلامة الغناء"
                      className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                    >
                      {proofing ? "جارٍ التدقيق..." : "✅ دقق وشكّل باللهجة"}
                    </button>
                    <button
                      onClick={() => applySections(null)}
                      className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                    >
                      ✍️ العودة للنص الحر
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">
                  كل مقطع يصل محرك التوليد باسمه ومدته وكلماته — فتأتي اللازمة لازمةً فعلاً والمقدمة آليةً كما رسمتها.
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  {sections.map((s, i) => (
                    <div key={i} className="rounded-xl border border-border-soft bg-surface p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={s.kind}
                          onChange={(e) => updateSection(i, { kind: e.target.value as SectionKind })}
                          className="rounded-lg border border-border-soft bg-surface-raised px-2 py-1.5 text-sm font-semibold outline-none focus:border-gold"
                        >
                          {(Object.keys(SECTION_LABELS) as SectionKind[]).map((k) => (
                            <option key={k} value={k}>
                              {SECTION_LABELS[k]}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-muted">
                          المدة
                          <input
                            type="number"
                            min={SECTION_MIN_SEC}
                            max={SECTION_MAX_SEC}
                            value={s.durationSec}
                            onChange={(e) =>
                              updateSection(i, {
                                durationSec: Math.min(
                                  SECTION_MAX_SEC,
                                  Math.max(SECTION_MIN_SEC, Math.round(Number(e.target.value) || SECTION_MIN_SEC))
                                ),
                              })
                            }
                            className="w-16 rounded-lg border border-border-soft bg-surface-raised px-2 py-1.5 text-center text-sm outline-none focus:border-gold"
                          />
                          ثانية
                        </label>
                        <div className="ms-auto flex items-center gap-1">
                          <button
                            onClick={() => moveSection(i, -1)}
                            disabled={i === 0}
                            title="تقديم المقطع"
                            className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:text-body disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveSection(i, 1)}
                            disabled={i === sections.length - 1}
                            title="تأخير المقطع"
                            className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:text-body disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => applySections(sections.filter((_, j) => j !== i))}
                            title="حذف المقطع"
                            className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {s.kind !== "intro" && s.kind !== "outro" ? (
                        <textarea
                          value={s.lyrics}
                          onChange={(e) => updateSection(i, { lyrics: e.target.value })}
                          rows={Math.max(2, s.lyrics.split("\n").length)}
                          placeholder="أسطر هذا المقطع..."
                          className="mt-3 w-full resize-y rounded-lg border border-border-soft bg-surface-raised p-3 text-sm leading-loose outline-none transition-colors focus:border-gold"
                        />
                      ) : (
                        <p className="mt-2 text-xs text-muted">مقطع آلي بلا كلمات — تحدده المدة فقط.</p>
                      )}
                    </div>
                  ))}
                </div>

                {sections.length < MAX_SECTIONS && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">أضف:</span>
                    {(Object.keys(SECTION_LABELS) as SectionKind[]).map((k) => (
                      <button
                        key={k}
                        onClick={() => addSection(k)}
                        className="rounded-full border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-gold hover:text-gold"
                      >
                        + {SECTION_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  maxLength={3000}
                  placeholder={"اكتب كلمات أغنيتك هنا (فصحى أو لهجة)...\nأو استخدم المساعد بالأعلى ليكتبها لك من فكرة."}
                  className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-loose outline-none transition-colors focus:border-gold"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">{lyrics.length} / 3000 حرف</span>
                  <div className="flex gap-2">
                    <button
                      onClick={proofread}
                      disabled={proofing || !lyrics.trim()}
                      title="إملاء + تشكيل تام لكل كلمة كما تُنطق باللهجة — أعلى رافعة لسلامة الغناء"
                      className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {proofing ? "جارٍ التدقيق..." : "✅ دقق وشكّل باللهجة"}
                    </button>
                    <button
                      onClick={() => applySections(parseSections(lyrics))}
                      disabled={!lyrics.trim()}
                      className="rounded-lg border border-gold px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      🧩 قسّم إلى مقاطع مُهيكلة
                    </button>
                  </div>
                </div>
              </>
            )}

            {proofIssues && (
              <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm">
                <p className="font-semibold text-accent">
                  ✅ تم التدقيق والتشكيل حسب اللهجة
                  {proofIssues.length ? ` — ${proofIssues.length} تصحيحاً بارزاً:` : " — الكلمات كانت سليمة، أضفنا التشكيل الكامل فقط."}
                </p>
                {proofIssues.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {proofIssues.map((issue, i) => (
                      <li key={i} className="rounded-lg bg-surface px-3 py-1.5">
                        <span className="text-red-300 line-through">{issue.original}</span>
                        {" ← "}
                        <span className="font-semibold text-accent">{issue.fixed}</span>
                        <span className="ms-2 text-muted">({issue.reason})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button
              onClick={() => setStep(1)}
              className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              التالي: اختيار المقام ←
            </button>
          </div>
        )}

        {/* الخطوة 2: المقام والأسلوب */}
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="mb-4 text-xl font-bold">اختر المقام</h2>
              {personalMaqam && (
                <p className="mb-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                  ✨ بدأنا لك بمقام {personalMaqam} — الأقرب لذوقك المتعلم
                </p>
              )}
              {sampleError && (
                <p className="mb-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm">
                  {sampleError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MAQAMAT.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setMaqamId(m.id)}
                    className={`cursor-pointer rounded-2xl border p-4 text-start transition-colors ${
                      maqamId === m.id
                        ? "border-gold bg-gold/10"
                        : "border-border-soft bg-surface-card hover:border-gold/50"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-lg font-bold">{m.name}</span>
                      {maqamId === m.id && <span className="text-gold">✓</span>}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-accent">{m.mood}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-muted">{m.description}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMaqamSample(m.id);
                      }}
                      title="اسمع سلّم المقام بأرباع نغماته"
                      className={`mt-3 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        playingMaqam === m.id
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border-soft text-muted hover:border-gold hover:text-gold"
                      }`}
                    >
                      {playingMaqam === m.id ? "⏸ إيقاف" : "🔊 اسمع السلّم"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">الأسلوب الغنائي</h2>
              {heritageStyle(styleId) && (
                <p className="mb-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm">
                  🇵🇸 قالب من ذاكرة التراث الفلسطيني — ضُبطت اللهجة والأداء والمقام الأليف
                  تلقائياً، وسيكتب المساعد ببنية {heritageStyle(styleId)!.name} الأصيلة.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SONG_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStyleId(s.id);
                      // قالب تراثي فلسطيني: اللهجة والأداء والمقام الأليف تلقائياً
                      const h = heritageStyle(s.id);
                      if (h) {
                        setDialectId("palestinian");
                        setDeliveryDialectId("palestinian");
                        if (!h.maqamIds.includes(maqamId)) setMaqamId(h.maqamIds[0]);
                      }
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      styleId === s.id
                        ? "border-primary bg-primary/10"
                        : HERITAGE_STYLE_IDS.includes(s.id)
                          ? "border-border-soft bg-surface-card hover:border-accent/60"
                          : "border-border-soft bg-surface-card hover:border-primary/50"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">الآلات</h2>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => toggleInstrument(inst.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      instrumentIds.includes(inst.id)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border-soft text-muted hover:text-body"
                    }`}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              التالي: التوليد ←
            </button>
          </div>
        )}

        {/* الخطوة 3: التوليد */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-4 text-xl font-bold">مستوى التوليد</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setTier("preview")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "preview"
                      ? "border-gold bg-gold/10"
                      : "border-border-soft bg-surface-card hover:border-gold/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎧 معاينة سريعة</span>
                    {tier === "preview" && <span className="text-gold">✓</span>}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">
                    مسودة آلية ~30 ثانية لتجربة المقام والأسلوب بأقل تكلفة (Lyria 3)، قبل توليد النسخة النهائية.
                  </span>
                </button>
                <button
                  onClick={() => setTier("full")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "full"
                      ? "border-gold bg-gold/10"
                      : "border-border-soft bg-surface-card hover:border-gold/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎼 النسخة الكاملة</span>
                    {tier === "full" && <span className="text-gold">✓</span>}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">
                    {instrumental
                      ? "موسيقى آلية كاملة بالمقام المختار (Lyria 3 Pro)."
                      : "أغنية كاملة بالغناء العربي عبر Eleven Music."}
                  </span>
                </button>
              </div>
              {tier === "full" &&
                (sections?.length ? (
                  <p className="mt-4 text-sm text-muted">
                    ⏱️ المدة من بنية المقاطع:{" "}
                    <span className="font-semibold text-body">
                      {Math.floor(sectionsTotalSec(sections) / 60)}:
                      {String(sectionsTotalSec(sections) % 60).padStart(2, "0")} دقيقة
                    </span>{" "}
                    — عدّلها من محرر البنية في الخطوة الأولى.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">المدة التقريبية:</span>
                    {DURATIONS.map((d) => (
                      <button
                        key={d.sec}
                        onClick={() => setDurationSec(d.sec)}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          durationSec === d.sec
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border-soft text-muted hover:text-body"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                ))}

              {tier === "full" && (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {!instrumental && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">صوت الغناء:</span>
                      {(
                        [
                          { id: "female", label: "👩 أنثى" },
                          { id: "male", label: "👨 ذكر" },
                        ] as const
                      ).map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setSinger(g.id)}
                          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                            singer === g.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-soft text-muted hover:text-body"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!instrumental && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">لهجة الأداء:</span>
                      <select
                        value={deliveryDialectId}
                        onChange={(e) => setDeliveryDialectId(e.target.value)}
                        className="rounded-xl border border-border-soft bg-surface-raised px-3 py-2 text-sm outline-none focus:border-primary"
                      >
                        {DIALECTS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">الإيقاع:</span>
                    {(
                      [
                        { v: null, label: "تلقائي" },
                        { v: 70, label: "هادئ ٧٠" },
                        { v: 90, label: "متزن ٩٠" },
                        { v: 110, label: "حيوي ١١٠" },
                        { v: 130, label: "راقص ١٣٠" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setBpm(t.v)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          bpm === t.v
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border-soft text-muted hover:text-body"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-soft bg-surface-card p-6">
              <h2 className="mb-4 text-xl font-bold">ملخص أغنيتك</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">المقام</dt>
                  <dd className="font-semibold">{maqam.name} — {maqam.mood}</dd>
                </div>
                <div>
                  <dt className="text-muted">الأسلوب</dt>
                  <dd className="font-semibold">{SONG_STYLES.find((s) => s.id === styleId)?.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">الآلات</dt>
                  <dd className="font-semibold">
                    {instrumentIds.length
                      ? INSTRUMENTS.filter((i) => instrumentIds.includes(i.id)).map((i) => i.name).join("، ")
                      : "اختيار تلقائي"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">الكلمات</dt>
                  <dd className="font-semibold">
                    {instrumental ? "موسيقى آلية بدون غناء" : lyrics.trim() ? `${lyrics.trim().split(/\s+/).length} كلمة` : "بدون كلمات بعد"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">البنية</dt>
                  <dd className="font-semibold">
                    {sections?.length
                      ? sections.map((s) => SECTION_LABELS[s.kind]).join(" ← ")
                      : "نص حر (بلا مقاطع مُهيكلة)"}
                  </dd>
                </div>
              </dl>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={() => generate()}
              disabled={loading}
              className="rounded-xl bg-gold px-6 py-3.5 font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? stage || "جارٍ التلحين والتوليد..."
                : tier === "preview"
                  ? "🎧 ولّد المعاينة"
                  : "🎼 ولّد الأغنية"}
            </button>

            {result && (
              <div className="flex flex-col gap-4">
                <AudioPlayer
                  src={result.url}
                  title={
                    result.mock
                      ? `معاينة مقام ${result.maqamName} (سلّم المقام بأرباع النغمات)`
                      : versions.length > 1
                        ? `«${result.title}» — النسخة ${versions.length}`
                        : `«${result.title}»`
                  }
                  mock={result.mock}
                  onTime={handlePlayerTime}
                  signal={result.mock ? undefined : { maqamId, settings: { stylePrompt: result.prompt } }}
                  filename={`maqam-song-v${versions.length}.${result.ext}`}
                  note={
                    result.fellBack
                      ? "تعذّر الوصول لمحرك التوليد من هذه البيئة (أو تتطلب الميزة باقة مدفوعة)، فعُرض سلّم المقام التجريبي بدلاً منه."
                      : undefined
                  }
                >
                  <SaveToLibrary
                    url={result.url}
                    kind="song"
                    title={result.title}
                    content={lyrics}
                    maqamId={maqamId}
                    styleId={styleId}
                    provider={result.provider}
                    settings={{
                      instrumentIds,
                      tier,
                      durationSec,
                      stylePrompt: result.prompt,
                      singer: instrumental ? undefined : singer,
                      bpm: bpm ?? undefined,
                      sectionsCount: sections?.length,
                    }}
                    onSaved={() => {
                      if (versions.length > 1) {
                        emitSignal({
                          kind: "version_chosen",
                          maqamId,
                          settings: { stylePrompt: result.prompt },
                          meta: { jobId: result.jobId, of: versions.length },
                        });
                      }
                    }}
                  />
                </AudioPlayer>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => generate()}
                    disabled={loading}
                    className="rounded-xl border border-gold px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                  >
                    🔁 ولّد نسخة أخرى بنفس الإعدادات
                  </button>
                  {!result.mock && (
                    <button
                      onClick={applyMaster}
                      disabled={mastering || result.mastered}
                      title="تطبيع علو الصوت + قص الصمت + دخول وخروج ناعمان — معالجة فورية في متصفحك"
                      className="rounded-xl border border-accent px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                    >
                      {result.mastered ? "✓ تم الماستر" : mastering ? "جارٍ المعالجة..." : "✨ لمسة الماستر"}
                    </button>
                  )}
                  {!result.mock && !instrumental && (
                    <button
                      onClick={startKaraoke}
                      disabled={karaokeBusy || !!karaokeWords}
                      title="مزامنة الكلمات مع الغناء كلمةً كلمة + تصدير SRT/LRC"
                      className="rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    >
                      {karaokeWords ? "✓ الكاريوكي جاهز" : karaokeBusy ? "جارٍ المزامنة..." : "🎤 كاريوكي"}
                    </button>
                  )}
                  {!result.mock && (
                    <button
                      onClick={makeCover}
                      disabled={coverBusy}
                      title="غلاف ألبوم مولّد من عنوان الأغنية ومقامها"
                      className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                    >
                      {coverBusy ? "جارٍ الرسم..." : coverUrl ? "🎨 غلاف آخر" : "🎨 غلاف الألبوم"}
                    </button>
                  )}
                  {!result.mock && (
                    <button
                      onClick={copyShareLink}
                      title="رابط عام لصفحة استماع أنيقة — شاركه في أي مكان"
                      className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                    >
                      {shareCopied ? "✓ نُسخ الرابط" : "🔗 شارك برابط"}
                    </button>
                  )}
                </div>

                {karaokeWords && (
                  <Karaoke words={karaokeWords} activeIndex={activeWord} title={result.title} />
                )}

                {coverUrl && (
                  <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">🎨 غلاف الألبوم</h3>
                      <a
                        href={coverUrl}
                        download="maqam-cover.png"
                        className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                      >
                        ⬇ تنزيل
                      </a>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element -- صورة blob محلية */}
                    <img
                      src={coverUrl}
                      alt={`غلاف ألبوم «${result.title}»`}
                      className="mx-auto mt-3 w-full max-w-sm rounded-2xl border border-border-soft"
                    />
                  </div>
                )}

                {tier === "full" && sections?.length && result.elevenSongId && !result.mock ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-surface-card p-3">
                    <span className="text-xs text-muted">
                      🎯 أعد توليد مقطعاً بعينه — يبقى باقي الأغنية كما هو:
                    </span>
                    {sections.map((s, i) => (
                      <button
                        key={i}
                        disabled={loading}
                        onClick={() =>
                          generate({ regenerateSectionIndex: i, sourceSongId: result.elevenSongId })
                        }
                        className="rounded-full border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                      >
                        {SECTION_LABELS[s.kind]} {i + 1}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!result.mock && !instrumental && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-semibold">🩹 سمعت كلمة منطوقة خطأ؟ صححها هنا:</p>
                    <p className="mt-1 text-xs text-muted">
                      يتعلم العقل النطق الصحيح للأبد (لكل الأصوات والأغاني القادمة)، ويُعاد غناء
                      المقطع المتأثر وحده — لا الأغنية كلها.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={fixWord}
                        onChange={(e) => setFixWord(e.target.value)}
                        maxLength={100}
                        placeholder="الكلمة كما كتبتها"
                        className="w-40 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <span className="text-muted">←</span>
                      <input
                        value={fixAlias}
                        onChange={(e) => setFixAlias(e.target.value)}
                        maxLength={200}
                        placeholder="نطقها الصحيح مشكّلة، مثل: مَدْرَسِة"
                        className="w-56 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button
                        onClick={fixPronunciation}
                        disabled={fixBusy || loading || !fixWord.trim() || !fixAlias.trim()}
                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
                      >
                        {fixBusy ? "جارٍ التعليم..." : "🧠 علّم وصحّح"}
                      </button>
                    </div>
                    {fixMsg && <p className="mt-2 text-xs text-accent">{fixMsg}</p>}
                  </div>
                )}

                {result.prompt && (
                  <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
                    <p className="mb-2 text-sm font-semibold">البرومبت الموسيقي المُولَّد لمحرك الذكاء الاصطناعي:</p>
                    <code dir="ltr" className="block rounded-lg bg-surface p-3 text-xs leading-relaxed text-accent">
                      {result.prompt}
                    </code>
                  </div>
                )}

                {versions.length > 1 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-muted">نسخ سابقة للمقارنة — احفظ أفضلها في مكتبتك</h3>
                    {versions.slice(1).map((v, i) => (
                      <AudioPlayer
                        key={v.jobId}
                        src={v.url}
                        title={`«${v.title}» — النسخة ${versions.length - 1 - i}`}
                        mock={v.mock}
                        signal={v.mock ? undefined : { maqamId, settings: { stylePrompt: v.prompt } }}
                        filename={`maqam-song-v${versions.length - 1 - i}.${v.ext}`}
                      >
                        <SaveToLibrary
                          url={v.url}
                          kind="song"
                          title={v.title}
                          content={lyrics}
                          maqamId={maqamId}
                          styleId={styleId}
                          provider={v.provider}
                          settings={{ instrumentIds, tier, durationSec, stylePrompt: v.prompt }}
                          onSaved={() =>
                            // حفظ نسخة من بين عدة نسخ = تفضيل صريح لها على أخواتها
                            emitSignal({
                              kind: "version_chosen",
                              maqamId,
                              settings: { stylePrompt: v.prompt },
                              meta: { jobId: v.jobId, of: versions.length },
                            })
                          }
                        />
                      </AudioPlayer>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recentJobs.length > 0 && (
              <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
                <h3 className="text-sm font-bold">🕘 توليداتك الأخيرة</h3>
                <p className="mt-1 text-xs text-muted">
                  مهامك محفوظة على الخادم — لو أغلقت الصفحة أثناء التوليد، استرجع النتيجة من هنا.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {recentJobs.map((j) => (
                    <div
                      key={j.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        {j.status === "done" ? "✅" : j.status === "failed" ? "❌" : "⏳"}{" "}
                        {j.tier === "preview" ? "معاينة" : "أغنية"} بمقام{" "}
                        {MAQAMAT.find((m) => m.id === j.maqamId)?.name ?? "—"}
                        <span className="ms-2 text-xs text-muted">
                          {new Date(j.createdAt).toLocaleString("ar", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {j.durationSec ? ` · ${j.durationSec} ث` : ""}
                        </span>
                      </span>
                      {j.status === "done" && (
                        <button
                          onClick={() => resumeJob(j)}
                          disabled={loading}
                          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                        >
                          ▶ استرجاع
                        </button>
                      )}
                      {(j.status === "pending" || j.status === "running") && (
                        <button
                          onClick={() => resumeJob(j)}
                          disabled={loading}
                          className="rounded-lg border border-gold px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                        >
                          📡 تابع التوليد
                        </button>
                      )}
                      {j.status === "failed" && (
                        <span className="text-xs text-red-400">{j.stage || "فشل التوليد"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
