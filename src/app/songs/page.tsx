"use client";

import { useEffect, useRef, useState } from "react";
import AudioPlayer, { type PlayerControl } from "@/components/AudioPlayer";
import { renderSongVideo } from "@/lib/songVideo";
import LyricsEditor from "@/components/LyricsEditor";
import SaveToLibrary from "@/components/SaveToLibrary";
import SingAlongPanel from "@/components/SingAlongPanel";
import StemsPanel from "@/components/StemsPanel";
import LiveMaqamPanel from "@/components/LiveMaqamPanel";
import {
  adherencePercent,
  alignWordsToLyrics,
  findActiveWord,
  measureSectionStarts,
  type KaraokeWord,
} from "@/lib/karaoke";
import { replaceWholeWord } from "@/lib/textCompare";
import { HERITAGE_STYLE_IDS, LYRIC_FORMS, heritageStyle } from "@/lib/heritage/palestinian";
import { emitSignal } from "@/lib/signalClient";
import {
  AMBIENCES,
  DIALECTS,
  INSTRUMENTS,
  MAQAMAT,
  MAQAM_FAMILIES,
  SONG_STYLES,
  type MaqamFamily,
} from "@/lib/maqamat";
import { authHeaders } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
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
import WaveLine from "@/components/WaveLine";
import MemberNotice from "@/components/MemberNotice";

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
  /** الكلمات كما غُنّيت فعلاً — بعد التشكيل التلقائي على الخادم */
  lyrics?: string;
  sections?: SongSection[];
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
  /** السبب الفعلي للرجوع التجريبي كما سجّله الخادم — يُعرض لا يُرمى */
  fellBackReason?: string;
  provider?: string;
  /** لقطة وقت التوليد — تسمح بعرض النسخ السابقة بعناوينها الصحيحة */
  maqamName: string;
  title: string;
  /** معرّف الناتج لدى المحرك — يفتح إعادة التوليد الجزئي للمقاطع */
  elevenSongId?: string;
  /** مُعالج بلمسة الماستر (تطبيع + fade + قص صمت) */
  mastered?: boolean;
  /** الكلمات كما غُنّيت فعلاً (بعد التشكيل التلقائي) — تتبناها الواجهة */
  finalLyrics?: string;
  finalSections?: SongSection[];
};

type ImageBriefResponse = {
  titleAr: string;
  descriptionAr: string;
  maqamId: string;
  maqamReason: string;
  stylePromptEn: string;
};

/** وضع المقارنة التجريبي: النسخة نفسها من المحركين معاً للحكم على الجودة والنطق */
type CompareEngine = "lyria" | "eleven-music";

const ENGINE_LABELS: Record<CompareEngine, string> = {
  lyria: "Lyria 3 Pro — جوجل",
  "eleven-music": "Eleven Music",
};

type CompareSlot = {
  provider: CompareEngine;
  jobId: string;
  status: "running" | "done" | "failed";
  stage: string;
  song?: SongResult;
  error?: string;
};

export default function SongsStudio() {
  const [step, setStep] = useState(0);
  // وضعا الاستوديو: يدوي (ثلاث خطوات يتحكم بها المستخدم) وذكي (الذكاء يقرر كل شيء)
  const [studioMode, setStudioMode] = useState<"manual" | "smart">("manual");
  const [smartSource, setSmartSource] = useState<"idea" | "lyrics">("idea");
  const [smartText, setSmartText] = useState("");
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartError, setSmartError] = useState("");
  const [smartRan, setSmartRan] = useState(false);
  // تصفية بطاقات المقامات حسب العائلة — عربية وتركية وغربية
  const [maqamFamily, setMaqamFamily] = useState<MaqamFamily | "all">("all");
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

  // 🧪 وضع المقارنة (للمسجلين، اختياري): Lyria 3 Pro × Eleven Music لكل توليد كامل.
  // الافتراضي نسخة واحدة بالسلسلة الكاملة — أثبتت جولة التجربة أن فرض محرك واحد
  // لكل نسخة يُفقد الرجوع التلقائي بين المحركين فيتراجع الأداء المحسوس.
  const [signedIn, setSignedIn] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSlots, setCompareSlots] = useState<CompareSlot[] | null>(null);
  const [compareNote, setCompareNote] = useState("");
  /** إشارتا الفوز/الخسارة تُبثان مرة واحدة لكل مقارنة */
  const compareSignaledRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateCompareSlot(index: number, patch: Partial<CompareSlot>) {
    setCompareSlots((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : prev
    );
  }

  const [idea, setIdea] = useState("");
  const [dialectId, setDialectId] = useState<string>(DIALECTS[0].id);
  /** قالب الكتابة الشعرية (دلعونا/عتابا/حداية...) — مستقل عن الأسلوب الموسيقي */
  const [lyricForm, setLyricForm] = useState("auto");
  /** الأجواء الجاهزة للآلات — ضغطة تضبط الآلات وطابع الترتيب */
  const [ambience, setAmbience] = useState<string | null>(null);
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
  // 🎧 بروفة النطق: قراءة مسموعة للنص الملقَّن قبل دفع كلفة التلحين
  const [rehearsing, setRehearsing] = useState(false);
  const [rehearsal, setRehearsal] = useState<{
    url: string;
    dictated: string;
    issues: { original: string; fixed: string; reason: string }[];
    mock: boolean;
  } | null>(null);
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

  /**
   * قلب محرر النص والصوت — تعليم النطق وإعادة الإنشاد:
   * ١) يتعلم العقل النطق فيُطبَّق تلقائياً على كل توليد قادم (أصواتاً وأغانيَ)
   * ٢) تصحيح الكلمات محلياً
   * ٣) إعادة إنشاد المقطع المتأثر وحده إن أمكن — وإلا نسخة كاملة مصححة
   * sectionIndexHint: فهرس المقطع من الخط الزمني (ضغطة الكلمة في المحرر) —
   * الزمن أصدق من مطابقة النص لأن التفريغ قد يخالف الكتابة.
   */
  async function teachAndRegen(word: string, alias: string, sectionIndexHint?: number) {
    if (!word || !alias || !result) return;
    setError("");

    // حارس اللاجدوى: كلمة لا وجود لها في النص المكتوب (صيغة سماع لا كتابة)
    // تعني استبدالاً صفرياً وإعادة توليد عبثية بنفس النص — نوقف قبل أي كلفة
    const probe = (text: string) => replaceWholeWord(text, word, alias) !== text;
    const willChange = sections ? sections.some((s) => probe(s.lyrics)) : probe(lyrics);
    if (!willChange) {
      throw new Error(
        `لم أجد «${word}» في نصك المكتوب — عدّل حقل «الكلمة كما كُتبت» لتطابق كلمتك في النص حرفياً (بتشكيلها إن كانت مشكّلة)`
      );
    }

    const learn = await fetch("/api/pronunciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, alias }),
    });
    const learnData = await learn.json().catch(() => null);
    if (!learn.ok) throw new Error(learnData?.error ?? "تعذّر حفظ النطق");

    // قاعدة ثانية بالمفتاح العاري من الحركات — كي تصيب الذاكرة النصوص
    // القادمة قبل تشكيلها التلقائي كما تصيب نص الجلسة المشكّل
    const bareWord = word.replace(/[ً-ْٰـ]/g, "");
    if (bareWord && bareWord !== word) {
      await fetch("/api/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: bareWord, alias }),
      }).catch(() => {});
    }

    // استبدال كلمة كاملة فقط — «من» لا تصيب «منها» ولا «زمن»
    const replaceIn = (text: string) => replaceWholeWord(text, word, alias);
    const nextSections = sections?.map((s) => ({ ...s, lyrics: replaceIn(s.lyrics) })) ?? null;
    const byText = sections?.findIndex((s) => s.lyrics.includes(word)) ?? -1;
    const affected =
      sectionIndexHint !== undefined &&
      sections &&
      sectionIndexHint >= 0 &&
      sectionIndexHint < sections.length
        ? sectionIndexHint
        : byText;
    if (nextSections) applySections(nextSections);
    else setLyrics(replaceIn(lyrics));

    const canInpaint =
      affected >= 0 && nextSections && result.elevenSongId && tier === "full" && !result.mock;
    // التصحيح إصلاح موضعي — لا يفتح مقارنة محركين جديدة
    if (canInpaint) {
      setFixMsg(
        `✓ تعلّم العقل نطق «${word}» — نعيد إنشاد ${SECTION_LABELS[nextSections[affected].kind]} ${affected + 1} وحده الآن`
      );
      await generate({
        sections: nextSections,
        regenerateSectionIndex: affected,
        sourceSongId: result.elevenSongId,
        compare: false,
      });
    } else {
      setFixMsg(`✓ تعلّم العقل نطق «${word}» — نولّد نسخة مصححة كاملة`);
      // النص المصحح يُمرر صراحة — حالة lyrics لم يُعد تصييرها بعد (إغلاق متقادم)
      await generate(
        nextSections
          ? { sections: nextSections, compare: false }
          : { lyrics: replaceIn(lyrics), compare: false }
      );
    }
  }

  async function fixPronunciation() {
    const word = fixWord.trim();
    const alias = fixAlias.trim();
    if (!word || !alias || fixBusy || !result) return;
    setFixBusy(true);
    setFixMsg("");
    try {
      await teachAndRegen(word, alias);
      setFixWord("");
      setFixAlias("");
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
  /** المقارنة ستسري على التوليد القادم — لتسمية زر التوليد وحالة البطاقة */
  const wantCompareUi = compareMode && signedIn && tier === "full";

  function toggleInstrument(id: string) {
    // تعديل يدوي للآلات يفك ارتباط الأجواء الجاهزة (تبقى الآلات كما اختار)
    setAmbience(null);
    setInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function pickAmbience(id: string) {
    if (ambience === id) {
      setAmbience(null);
      return;
    }
    const preset = AMBIENCES.find((a) => a.id === id);
    if (!preset) return;
    setAmbience(id);
    setInstrumentIds([...preset.instrumentIds]);
  }

  async function runAssist(mode: AssistMode) {
    setAssistError("");
    setAssistLoading(mode);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mode, idea, lyrics, dialectId, styleId, formId: lyricForm }),
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

  /**
   * 🪄 الوضع الذكي — أمر واحد: فكرة (يؤلف الكلمات) أو كلمات جاهزة (لا تُمس)،
   * والذكاء يقرر وحده المقام واللون الغنائي والصوت واللهجة والآلات والسرعة،
   * تُعتمد قراراته في حالة الاستوديو (فيمكن تعديلها يدوياً لاحقاً) ويولّد فوراً.
   */
  async function runSmart() {
    const text = smartText.trim();
    if (!text || smartBusy || loading) return;
    setSmartError("");
    setSmartBusy(true);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(
          smartSource === "idea"
            ? { mode: "write", idea: text, auto: true, dialectId, styleId }
            : { mode: "plan", lyrics: text, auto: true, dialectId, styleId }
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "تعذّر التخطيط الذكي، حاول مجدداً");
      }
      const smart = data as AssistResponse;

      // اعتماد قرارات الذكاء في حالة الاستوديو كلها — تبقى مرجعاً للتعديل اليدوي
      setAssist(smart);
      setLyrics(smart.lyrics);
      setSections(smart.sections?.length ? smart.sections : null);
      setMaqamId(smart.maqamId);
      const plan = smart.plan;
      if (plan) {
        setStyleId(plan.styleId);
        setSinger(plan.singer);
        setDialectId(plan.dialectId);
        setDeliveryDialectId(plan.dialectId);
        setAmbience(null);
        setInstrumentIds(plan.instrumentIds);
        setBpm(plan.bpm);
      }
      setSmartRan(true);

      // التوليد فوراً بالقيم الصريحة — حالة React لم تُصيَّر بعد داخل هذه الدورة
      await generate(
        {
          lyrics: smart.lyrics,
          maqamId: smart.maqamId,
          sections: tier === "full" && smart.sections?.length ? smart.sections : undefined,
          aiStylePrompt: smart.stylePromptEn,
          compare: false,
          ...(plan && {
            styleId: plan.styleId,
            instrumentIds: plan.instrumentIds,
            singer: plan.styleId === "instrumental" ? undefined : plan.singer,
            dialectId: plan.styleId === "instrumental" ? undefined : plan.dialectId,
            bpm: plan.bpm ?? undefined,
          }),
        },
        { title: smart.title }
      );
    } catch (e) {
      setSmartError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSmartBusy(false);
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

  /** متابعة مهمة حتى الاكتمال وإرجاع ناتجها — بلا لمس حالة العرض (تخدم المقارنة أيضاً) */
  async function watchJobCore(
    jobId: string,
    snapshot: { maqamName: string; title: string },
    onStage?: (stage: string) => void
  ): Promise<SongResult> {
    // استعلام دوري عن حالة المهمة حتى الاكتمال (مهلة قصوى ٢٠٠ محاولة × ١.٥ ثانية = ٥ دقائق)
    let status: JobStatusResponse | null = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const sres = await fetch(`/api/songs/${jobId}`);
      status = (await sres.json().catch(() => null)) as JobStatusResponse | null;
      if (!sres.ok) {
        throw new Error(status?.error ?? "تعذّر متابعة حالة المهمة");
      }
      onStage?.(status?.stage ?? "");
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
    return {
      url: URL.createObjectURL(blob),
      blob,
      jobId,
      mock: !!status.mock,
      prompt: status.stylePrompt ?? "",
      ext: blob.type === "audio/mpeg" ? "mp3" : "wav",
      fellBack: !!status.fellBack,
      fellBackReason: status.fellBack || undefined,
      provider: status.provider,
      elevenSongId: status.elevenSongId,
      maqamName: snapshot.maqamName,
      title: snapshot.title,
      finalLyrics: status.lyrics,
      finalSections: status.sections,
    };
  }

  /** عرض ناتج جديد: أدوات ما بعد التوليد تعود لنقطة الصفر ويُحتسب نسخةً */
  function presentSong(song: SongResult) {
    // الكلمات كما غُنّيت فعلاً (بعد التشكيل التلقائي على الخادم) تتبناها الواجهة —
    // فيتطابق ما تراه في النص والمحرر مع ما نُطق حرفياً
    if (song.finalSections?.length && sections) applySections(song.finalSections);
    else if (song.finalLyrics && !sections) setLyrics(song.finalLyrics);
    setKaraokeWords(null);
    setKaraokeNote("");
    setKaraokeStarts(null);
    setActiveWord(-1);
    setShareCopied(false);
    setCoverUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setResult(song);
    setVersions((prev) => [song, ...prev]);
  }

  /** متابعة مهمة وعرض ناتجها — التوليد المفرد واستعادة المهام */
  async function watchJob(jobId: string, snapshot: { maqamName: string; title: string }) {
    const song = await watchJobCore(jobId, snapshot, setStage);
    presentSong(song);
  }

  /** اعتماد نسخة من المقارنة: تصبح الناتج الرئيسي وتُفتح عليها كل أدوات ما بعد التوليد */
  function adoptCompareVersion(index: number) {
    if (!compareSlots) return;
    const winner = compareSlots[index];
    if (!winner.song) return;
    const loser = compareSlots.find((_, i) => i !== index);
    // فوز صريح وخسارة صريحة بين المحركين — وقود ترتيب المحركات في عقل المنصة
    if (!compareSignaledRef.current) {
      compareSignaledRef.current = true;
      if (!winner.song.mock) {
        emitSignal({
          kind: "version_chosen",
          maqamId,
          settings: { stylePrompt: winner.song.prompt, engine: winner.provider },
          meta: { compare: true, provider: winner.provider, over: loser?.provider },
        });
      }
      if (loser?.song && !loser.song.mock) {
        emitSignal({
          kind: "version_rejected",
          maqamId,
          settings: { stylePrompt: loser.song.prompt, engine: loser.provider },
          meta: { compare: true, provider: loser.provider },
        });
      }
    }
    presentSong(winner.song);
  }

  async function generate(extras?: Record<string, unknown>, ui?: { title?: string }) {
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
    // روابط نسخ المقارنة السابقة غير المعتمدة تُبطل قبل الجولة الجديدة
    compareSlots?.forEach((s) => {
      if (s.song && !versions.some((v) => v.jobId === s.song!.jobId)) {
        URL.revokeObjectURL(s.song.url);
      }
    });
    setCompareSlots(null);
    setCompareNote("");
    compareSignaledRef.current = false;
    try {
      // تبديل المقام بضغطة: المقام الفعلي قد يصل تجاوزاً قبل تحديث الحالة
      const effectiveMaqamId = (extras?.maqamId as string) ?? maqamId;
      // المقارنة: للمسجلين وللنسخة الكاملة، وليست لإعادة التوليد الجزئي (ميزة Eleven وحده)
      const wantCompare =
        compareMode && signedIn && tier === "full" && extras?.regenerateSectionIndex === undefined;
      // أولوية البرومبت: موجز الصورة ثم المساعد — ما دام المقام الفعلي هو المقترح
      const aiStylePrompt =
        imageBrief && imageBrief.maqamId === effectiveMaqamId && styleId === "instrumental"
          ? imageBrief.stylePromptEn
          : assist && assist.maqamId === effectiveMaqamId
            ? assist.stylePromptEn
            : undefined;

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          lyrics,
          maqamId: effectiveMaqamId,
          styleId,
          ambience: ambience ?? undefined,
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
          compare: wantCompare,
          ...extras,
        }),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(created?.error ?? "تعذّر التوليد، حاول مجدداً");
      }

      const maqamName = MAQAMAT.find((m) => m.id === effectiveMaqamId)?.name ?? "";
      const snapshot = {
        maqamName,
        title:
          ui?.title && ui.title !== "مسودة تجريبية"
            ? ui.title
            : assist?.title && assist.title !== "مسودة تجريبية"
            ? assist.title
            : imageBrief?.titleAr && styleId === "instrumental"
              ? imageBrief.titleAr
              : tier === "preview"
                ? `معاينة بمقام ${maqamName}`
                : `أغنية بمقام ${maqamName}`,
      };

      if (created.compareNote) setCompareNote(created.compareNote);

      if (created.compare && Array.isArray(created.jobs) && created.jobs.length === 2) {
        // نسختان متوازيتان: تُتابعان معاً وتظهر كلٌّ منهما فور اكتمالها
        const slots: CompareSlot[] = (
          created.jobs as { jobId: string; provider: CompareEngine }[]
        ).map((j) => ({
          provider: j.provider,
          jobId: j.jobId,
          status: "running" as const,
          stage: "بانتظار البدء",
        }));
        setCompareSlots(slots);
        setStage("🧪 جارٍ توليد النسختين للمقارنة...");
        const outcomes = await Promise.all(
          slots.map(async (slot, i) => {
            try {
              const song = await watchJobCore(slot.jobId, snapshot, (stage) =>
                updateCompareSlot(i, { stage })
              );
              updateCompareSlot(i, { status: "done", song });
              return true;
            } catch (e) {
              updateCompareSlot(i, {
                status: "failed",
                error: e instanceof Error ? e.message : "فشل التوليد",
              });
              return false;
            }
          })
        );
        if (!outcomes.some(Boolean)) {
          throw new Error("فشل التوليد في المحركين معاً — حاول مجدداً");
        }
      } else {
        await watchJob(created.jobId as string, snapshot);
      }
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

  // محرر النص والصوت والغلاف والمشاركة — أدوات ما بعد التوليد
  const [karaokeWords, setKaraokeWords] = useState<KaraokeWord[] | null>(null);
  const [karaokeBusy, setKaraokeBusy] = useState(false);
  const [karaokeNote, setKaraokeNote] = useState("");
  /** بدايات المقاطع المقيسة من التفريغ — أصدق من المدد المخططة (Lyria يتجاهلها) */
  const [karaokeStarts, setKaraokeStarts] = useState<number[] | null>(null);
  const [activeWord, setActiveWord] = useState(-1);

  /** مرآة حية للناتج الحالي — حارس تقادم للعمليات غير المتزامنة بعد await */
  const resultRef = useRef<SongResult | null>(null);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  // تشغيل كلمة بعينها من المحرر: انتقال إلى ما قبلها بقليل وإيقاف بُعيد نهايتها
  const playerCtlRef = useRef<PlayerControl | null>(null);
  const wordStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (wordStopRef.current) clearTimeout(wordStopRef.current);
    };
  }, []);
  function playWord(w: KaraokeWord) {
    const ctl = playerCtlRef.current;
    if (!ctl) return;
    if (wordStopRef.current) clearTimeout(wordStopRef.current);
    ctl.seek(Math.max(0, w.start - 0.15));
    const durMs = Math.max(700, (w.end - w.start + 0.5) * 1000);
    wordStopRef.current = setTimeout(() => ctl.pause(), durMs);
  }
  const [coverUrl, setCoverUrl] = useState("");
  const [ytProgress, setYtProgress] = useState<number | null>(null);

  /**
   * نشر على يوتيوب — خط إنتاج كامل بضغطة واحدة:
   * ١) ماستر صوتي تلقائي (جهارة قياسية كالأغاني التجارية، قص الصمت)
   * ٢) توليد غلاف ألبوم تلقائياً إن لم يكن موجوداً
   * ٣) تصنيع الفيديو (الغلاف + الموجات + الصوت الممستر) وفتح صفحة الرفع
   */
  const [ytStage, setYtStage] = useState("");
  async function publishToYouTube() {
    if (!result || ytProgress !== null) return;
    setYtProgress(0);
    try {
      // ١) الماستر: صوت بجهارة يوتيوب القياسية — إن لم يُطبَّق سابقاً
      let audioBlob = result.blob;
      if (!result.mastered && !result.mock) {
        setYtStage("🎚️ ماستر صوتي — جهارة الأغاني التجارية...");
        try {
          const { masterAudio } = await import("@/lib/audioMaster");
          const m = await masterAudio(result.blob);
          if (m.changed) audioBlob = m.blob;
        } catch {
          /* الماستر كمالي — نكمل بالأصل */
        }
      }
      // ٢) الغلاف: يتولّد تلقائياً إن لم يطلبه المستخدم من قبل
      let effectiveCover = coverUrl;
      if (!effectiveCover && !result.mock) {
        setYtStage("🎨 يرسم غلاف الألبوم...");
        try {
          const res = await fetch("/api/cover", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeaders()) },
            body: JSON.stringify({ title: result.title, maqamId, stylePrompt: result.prompt }),
          });
          if (res.ok) {
            effectiveCover = URL.createObjectURL(await res.blob());
            setCoverUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return effectiveCover;
            });
          }
        } catch {
          /* الغلاف كمالي — الفيديو يرسم شعار لحّن بديلاً */
        }
      }
      // ٣) الفيديو
      setYtStage("");
      const video = await renderSongVideo({
        audioBlob,
        title: result.title || "أغنية من لحّن",
        subtitle: "أُنتجت على منصة لحّن 🎵",
        coverUrl: effectiveCover || undefined,
        onProgress: (f) => setYtProgress(f),
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(video);
      a.download = `${(result.title || "song").replace(/[\\/:*?"<>|]+/g, "_")}-youtube.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      window.open("https://www.youtube.com/upload", "_blank", "noopener");
    } catch (e) {
      alert(e instanceof Error ? e.message : "تعذّر تصنيع الفيديو");
    } finally {
      setYtProgress(null);
    }
  }
  const [coverBusy, setCoverBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // كنس المغادرة: تنقل SPA لا يحرر روابط blob تلقائياً — جلسة توليد نشطة
  // تراكم مئات الميغابايت (نسخ + مقارنات + غلاف) إن لم تُبطل عند التفكيك
  const liveUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    liveUrlsRef.current = [
      ...versions.map((v) => v.url),
      ...(compareSlots ?? []).flatMap((s) => (s.song ? [s.song.url] : [])),
      ...(coverUrl ? [coverUrl] : []),
      ...(imagePreview ? [imagePreview] : []),
    ];
  });
  useEffect(() => {
    return () => {
      liveUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  /** موضع التشغيل يقود إضاءة كلمات الكاريوكي */
  function handlePlayerTime(sec: number) {
    if (!karaokeWords) return;
    const idx = findActiveWord(karaokeWords, sec);
    setActiveWord((prev) => (prev === idx ? prev : idx));
  }

  /** تفريغ موقوت لملف صوتي ثم محاذاته مع النص المكتوب — يرمي عند الفشل */
  async function syncOnce(blob: Blob, ext: string): Promise<KaraokeWord[]> {
    const fd = new FormData();
    fd.append("audio", blob, `song.${ext}`);
    const res = await fetch("/api/karaoke", {
      method: "POST",
      headers: await authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "تعذّرت مزامنة الكلمات");
    return alignWordsToLyrics(data.words, lyrics);
  }

  // تصعيد القياس للغناء المعزول — مرة واحدة لكل ناتج مهما تكررت المزامنة
  const isolateSyncRef = useRef("");
  // الماستر التلقائي (الوضع الذكي) — مرة لكل ناتج؛ يُصفَّر عند استعادة نسخة أدق
  const autoMasterRef = useRef("");

  // 🎯 فرض الالتزام بالانتقاء (الوضع الذكي): دون هذه النسبة تُعاد التوليدة
  // تلقائياً مرة واحدة ويُبقى على الأدق — أقرب الممكن لقفلٍ مطلق في محركات
  // توليدية لا تضمن الحرفية في المحاولة الواحدة
  const SMART_RETAKE_BELOW = 90;
  const retakeRef = useRef<{
    prevJobId: string;
    pct: number;
    result: SongResult;
    words: KaraokeWord[];
    starts: number[] | null;
  } | null>(null);
  const retakeTriedRef = useRef("");
  const [retakeNote, setRetakeNote] = useState("");

  async function startKaraoke(auto = false) {
    if (!result || karaokeBusy) return;
    // حارس التقادم: لو تغيّر الناتج أثناء انتظار المزامنة، يُهمل الرد القديم
    // كي لا تُكتب كلمات وتوقيتات أغنية سابقة على الأغنية الجديدة
    const forJobId = result.jobId;
    setKaraokeBusy(true);
    setKaraokeNote("");
    if (!auto) setError("");
    try {
      let aligned = await syncOnce(result.blob, result.ext);
      let pct = adherencePercent(aligned);
      let refined = false;

      // نسبة منخفضة على المزيج الكامل غالباً ضجيج قياس: الموسيقى تشوّش أذن
      // التفريغ فيسمع كلمات غير المغناة. نعزل الغناء وحده ونعيد القياس عليه
      // ونعتمد الأصدق (الأعلى) — تصعيد واحد لكل ناتج، للأعضاء وغير التجريبي
      if (
        pct !== null &&
        pct < 90 &&
        signedIn &&
        !result.mock &&
        isolateSyncRef.current !== forJobId
      ) {
        isolateSyncRef.current = forJobId;
        try {
          const fd = new FormData();
          fd.append("audio", result.blob, `song.${result.ext}`);
          const iso = await fetch("/api/isolate", {
            method: "POST",
            headers: await authHeaders(),
            body: fd,
          });
          if (iso.ok) {
            const vocals = await iso.blob();
            const alignedVocals = await syncOnce(vocals, "mp3");
            const pctVocals = adherencePercent(alignedVocals);
            if (pctVocals !== null && pctVocals > pct) {
              aligned = alignedVocals;
              pct = pctVocals;
              refined = true;
            }
          }
        } catch {
          // التصعيد تحسين اختياري — قياس المزيج الأصلي يبقى معتمداً
        }
      }

      if (resultRef.current?.jobId !== forJobId) return;
      // عرض الكلمات بصورتها المكتوبة المشكّلة لا بصورة التفريغ العارية
      setKaraokeWords(aligned);
      // حدود المقاطع الحقيقية تُقاس من التوقيتات لا من المدد المخططة
      const starts = sections?.length ? measureSectionStarts(aligned, sections) : null;
      setKaraokeStarts(starts);
      setActiveWord(-1);
      // نسبة الالتزام مقياس موضوعي يغذي العقل — لكل توليدة، بمحركها
      const song = resultRef.current;
      if (pct !== null && song && !song.mock) {
        emitSignal({
          kind: "adherence",
          maqamId,
          settings: { stylePrompt: song.prompt, engine: song.provider ?? "unknown" },
          meta: { percent: pct, jobId: song.jobId, ...(refined && { isolated: true }) },
        });
      }

      // 🎯 فرض الالتزام بالانتقاء — في الوضع الذكي فقط (عقده: الذكاء يتكفل)
      if (studioMode === "smart" && pct !== null && song && !song.mock) {
        const pending = retakeRef.current;
        if (pending && pending.prevJobId !== song.jobId) {
          // هذه نسخة الإعادة: يُبقى على الأدق التزاماً
          if (pct <= pending.pct) {
            setResult(pending.result);
            setKaraokeWords(pending.words);
            setKaraokeStarts(pending.starts);
            // النسخة المستعادة تستحق ماستر تلقائياً من جديد
            autoMasterRef.current = "";
            setRetakeNote(
              `🎯 أعاد الذكاء التوليد فجاءت الإعادة ${pct}٪ — أُبقي على النسخة الأدق (${pending.pct}٪). النسختان في قائمة النسخ.`
            );
          } else {
            setRetakeNote(`🎯 إعادة التوليد التلقائية رفعت الالتزام من ${pending.pct}٪ إلى ${pct}٪.`);
          }
          retakeRef.current = null;
        } else if (
          pct < SMART_RETAKE_BELOW &&
          retakeTriedRef.current !== song.jobId &&
          !loading
        ) {
          retakeTriedRef.current = song.jobId;
          retakeRef.current = { prevJobId: song.jobId, pct, result: song, words: aligned, starts };
          setRetakeNote(
            `🎯 الالتزام ${pct}٪ دون عتبة ${SMART_RETAKE_BELOW}٪ — يعيد الذكاء التوليد تلقائياً ويُبقي الأدق...`
          );
          generate({ compare: false });
        } else if (!pending) {
          setRetakeNote("");
        }
      }
    } catch (e) {
      if (resultRef.current?.jobId !== forJobId) return;
      // فشل المزامنة التلقائية لا يقاطع الاحتفال بالناتج — ملاحظة هادئة وزر يدوي
      const message = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
      if (auto) setKaraokeNote(message);
      else setError(message);
    } finally {
      setKaraokeBusy(false);
    }
  }

  // المزامنة التلقائية: فور اكتمال أي توليد مغنّى تُعرض الكلمات متزامنة بلا ضغطة —
  // محاولة واحدة لكل ناتج، وفشلها يترك زر المزامنة اليدوي طريقاً بديلاً
  const autoSyncRef = useRef("");
  useEffect(() => {
    if (!result || result.mock || instrumental) return;
    if (karaokeWords || karaokeBusy) return;
    if (autoSyncRef.current === result.jobId) return;
    autoSyncRef.current = result.jobId;
    startKaraoke(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startKaraoke مستقرة ضمن هذا النطاق
  }, [result, karaokeWords, karaokeBusy, instrumental]);

  /**
   * 🎧 بروفة النطق — نفس خط التلقين الذي سيصل المولد حرفياً (ذاكرة النطق
   * ثم الملقّن الغنائي بالتشكيل الكامل) يُقرأ بصوت واضح متأنٍّ، فيُكتشف
   * أي لفظ منحرف ويُصحح قبل دفع كلفة التلحين.
   */
  async function rehearse() {
    if (!lyrics.trim() || rehearsing) return;
    setError("");
    setRehearsing(true);
    try {
      const res = await fetch("/api/songs/rehearse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ lyrics, dialectId: deliveryDialectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت البروفة، حاول مجدداً");
      const bin = atob(data.audio as string);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" }));
      setRehearsal((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          url,
          dictated: data.dictated as string,
          issues: Array.isArray(data.issues) ? data.issues : [],
          mock: !!data.mock,
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setRehearsing(false);
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
  async function applyMaster(auto = false) {
    if (!result || result.mastered || mastering) return;
    setMastering(true);
    const forJobId = result.jobId;
    const oldUrl = result.url;
    try {
      const { masterAudio } = await import("@/lib/audioMaster");
      const mastered = await masterAudio(result.blob);
      if (resultRef.current?.jobId !== forJobId) return;
      if (!mastered.changed) {
        // في الماستر التلقائي عدم الحاجة ليست خبراً — لا إزعاج
        if (!auto) setError("المقطع أقصر من أن يحتاج معالجة ماستر — بقي كما هو");
        return;
      }
      const song: SongResult = {
        ...result,
        blob: mastered.blob,
        url: URL.createObjectURL(mastered.blob),
        ext: "wav",
        mastered: true,
      };
      setResult(song);
      setVersions((prev) => prev.map((v, i) => (i === 0 ? song : v)));
      // قص مقدمة الملف يُزيح توقيتات الكاريوكي — تُصحح بدل أن تنحرف
      if (mastered.trimmedLeadSec > 0) {
        const lead = mastered.trimmedLeadSec;
        setKaraokeWords((prev) =>
          prev
            ? prev.map((w) => ({
                ...w,
                start: Math.max(0, w.start - lead),
                end: Math.max(0, w.end - lead),
              }))
            : prev
        );
        setKaraokeStarts((prev) =>
          prev ? prev.map((s) => Math.max(0, s - lead)) : prev
        );
      }
      // الرابط القديم لم يعد مرجعاً في أي مكان — يُبطل فلا يتراكم WAV ضخم
      URL.revokeObjectURL(oldUrl);
    } catch {
      if (!auto) setError("تعذّرت معالجة الماستر في هذا المتصفح — الملف الأصلي كما هو");
    } finally {
      setMastering(false);
    }
  }

  // 🪄 الوضع الذكي يطبّق «لمسة الماستر» تلقائياً — بعد حسم المزامنة أولاً،
  // لأن قصّ مقدمة الملف يُصحح توقيتات الكلمات المتزامنة بعدها لا قبلها
  useEffect(() => {
    if (studioMode !== "smart" || !result || result.mock || result.mastered || mastering) return;
    const syncSettled = instrumental || !!karaokeWords || !!karaokeNote;
    if (!syncSettled || karaokeBusy) return;
    if (autoMasterRef.current === result.jobId) return;
    autoMasterRef.current = result.jobId;
    applyMaster(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyMaster مستقرة ضمن هذا النطاق
  }, [studioMode, result, mastering, karaokeWords, karaokeNote, karaokeBusy, instrumental]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        استوديو <span className="text-gradient">الأغاني والمقامات</span>
      </h1>
      <WaveLine className="mt-3" />
      <MemberNotice />
      <p className="mt-3 text-muted">
        وضعان: يدوي تتحكم فيه بكل التفاصيل، أو ذكي يقرر فيه الذكاء كل شيء من فكرتك أو كلماتك.
      </p>

      {/* مبدّل وضعي الاستوديو */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="tablist" aria-label="وضع الاستوديو">
        <button
          role="tab"
          aria-selected={studioMode === "manual"}
          onClick={() => setStudioMode("manual")}
          className={`rounded-2xl border p-4 text-start transition-colors ${
            studioMode === "manual"
              ? "border-primary bg-rose"
              : "border-border-soft bg-surface-card hover:border-primary/50"
          }`}
        >
          <span className="text-base font-bold">🎛️ الوضع اليدوي</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            ثلاث خطوات تتحكم فيها بكل التفاصيل: الكلمات، فالمقام والأسلوب، فالتوليد.
          </span>
        </button>
        <button
          role="tab"
          aria-selected={studioMode === "smart"}
          onClick={() => setStudioMode("smart")}
          className={`rounded-2xl border p-4 text-start transition-colors ${
            studioMode === "smart"
              ? "border-gold bg-gold/10"
              : "border-border-soft bg-surface-card hover:border-gold/60"
          }`}
        >
          <span className="text-base font-bold">🪄 الوضع الذكي</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            فكرة أو كلماتك الجاهزة — والذكاء يقرر المقام واللون والصوت واللهجة والآلات ويولّد
            مباشرة.
          </span>
        </button>
      </div>

      {/* شريط الخطوات — للوضع اليدوي */}
      {studioMode === "manual" && (
        <ol className="mt-6 flex gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  i === step
                    ? "border-primary bg-rose text-primary"
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
      )}

      <div className="mt-8">
        {/* 🪄 الوضع الذكي: أمر واحد والذكاء يتكفل بالباقي */}
        {studioMode === "smart" && (
          <div className="mb-8 flex flex-col gap-4">
            <div className="rounded-2xl border border-gold/40 bg-surface-card p-5">
              <h2 className="text-lg font-bold">
                🪄 أعطِ الأمر — <span className="text-gradient">والذكاء يتكفل بالباقي</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                اكتب فكرة فيؤلّف الكلمات، أو الصق كلماتك الجاهزة (لن تُمس)، ثم يختار وحده
                المقام الأنسب من كل العائلات (عربية وتركية وغربية) واللون الغنائي والصوت
                واللهجة والآلات والسرعة — ويولّد الأغنية مباشرة مع شرح قراراته.
              </p>
              <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="مصدر الكلمات">
                <button
                  role="radio"
                  aria-checked={smartSource === "idea"}
                  onClick={() => setSmartSource("idea")}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    smartSource === "idea"
                      ? "border-primary bg-rose text-primary"
                      : "border-border-soft text-muted hover:text-body"
                  }`}
                >
                  ✍️ عندي فكرة — اكتبوا الكلمات
                </button>
                <button
                  role="radio"
                  aria-checked={smartSource === "lyrics"}
                  onClick={() => setSmartSource("lyrics")}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    smartSource === "lyrics"
                      ? "border-primary bg-rose text-primary"
                      : "border-border-soft text-muted hover:text-body"
                  }`}
                >
                  📝 كلماتي جاهزة — لحّنوها كما هي
                </button>
              </div>
              <textarea
                value={smartText}
                onChange={(e) => setSmartText(e.target.value)}
                maxLength={smartSource === "idea" ? 500 : 3000}
                placeholder={
                  smartSource === "idea"
                    ? "فكرة الأغنية... مثال: رثاء جدّي الذي علّمني الصبر — أو: فرحة عرس فلسطيني في الحارة"
                    : "الصق كلماتك هنا كما هي — لن يغيّر الذكاء فيها حرفاً، فقط يلحّنها"
                }
                className={`mt-3 w-full resize-y rounded-xl border border-border-soft bg-surface p-4 text-sm leading-relaxed outline-none transition-colors focus:border-gold ${
                  smartSource === "idea" ? "min-h-24" : "min-h-44"
                }`}
              />
              <button
                onClick={runSmart}
                disabled={smartBusy || loading || !smartText.trim()}
                className="mt-3 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {smartBusy
                  ? "🧠 يقرأ ويقرر الخطة..."
                  : loading
                    ? "🎼 يولّد الآن..."
                    : "🪄 لحّنها كاملة بأمر واحد"}
              </button>
              {smartError && (
                <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                  {smartError}
                </p>
              )}
            </div>

            {/* بطاقة قرارات الذكاء — شفافية كاملة مع مخرج للتعديل اليدوي */}
            {assist?.plan && smartRan && (
              <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    🧠 قرارات الذكاء
                    {assist.title && assist.title !== "مسودة تجريبية" && ` — «${assist.title}»`}
                  </h3>
                  <button
                    onClick={() => {
                      setStudioMode("manual");
                      setStep(1);
                    }}
                    className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                  >
                    🎛️ عدّل القرارات يدوياً
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                    🎼 المقام: {MAQAMAT.find((m) => m.id === assist.maqamId)?.name}
                    {(() => {
                      const fam = MAQAMAT.find((m) => m.id === assist.maqamId)?.family;
                      return fam === "turkish" ? " (تركي)" : fam === "western" ? " (غربي)" : "";
                    })()}
                  </span>
                  <span className="rounded-full bg-gold/15 px-3 py-1 font-semibold text-gold">
                    🎨 اللون: {SONG_STYLES.find((s) => s.id === assist.plan?.styleId)?.name}
                  </span>
                  <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
                    🎤 الصوت: {assist.plan.singer === "male" ? "رجالي" : "نسائي"}
                  </span>
                  <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
                    🗣️ اللهجة: {DIALECTS.find((d) => d.id === assist.plan?.dialectId)?.name}
                  </span>
                  <span className="rounded-full bg-surface px-3 py-1 text-muted">
                    🪕{" "}
                    {assist.plan.instrumentIds
                      .map((id) => INSTRUMENTS.find((i) => i.id === id)?.name)
                      .filter(Boolean)
                      .join("، ")}
                  </span>
                  <span className="rounded-full bg-surface px-3 py-1 text-muted">
                    ⏱️ {assist.plan.bpm ? `${assist.plan.bpm} نبضة/د` : "إيقاع حر"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{assist.maqamReason}</p>
                {assist.plan.reason && (
                  <p className="mt-1 text-sm leading-relaxed text-muted">{assist.plan.reason}</p>
                )}
                {assist.mock && (
                  <p className="mt-2 text-xs text-muted">
                    خطة من الوضع التجريبي — القرارات الذكية الفعلية تُفعَّل مع ربط مفاتيح
                    الذكاء الاصطناعي.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* الخطوة 1: الكلمات */}
        {studioMode === "manual" && step === 0 && (
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
                  className="flex-1 rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
                />
                <select
                  value={dialectId}
                  onChange={(e) => {
                    setDialectId(e.target.value);
                    // لهجة الأداء الغنائي تتبع لهجة الكتابة حتى يغيّرها المستخدم بنفسه
                    setDeliveryDialectId(e.target.value);
                  }}
                  aria-label="لهجة كتابة الكلمات"
                  className="rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={lyricForm}
                  onChange={(e) => setLyricForm(e.target.value)}
                  aria-label="قالب الكتابة الشعرية"
                  title="قالب الكتابة الشعرية — بنية النص بغض النظر عن اللحن"
                  className="rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {LYRIC_FORMS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.id === "auto" ? f.name : `قالب: ${f.name}`}
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
                  className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-rose disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistLoading === "improve" ? "جارٍ التحسين..." : "✨ حسّن كلماتي واقترح المقام"}
                </button>
              </div>
              {assistError && (
                <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                  {assistError}
                </p>
              )}
              {assist && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-rose p-4 text-sm">
                  <p className="font-semibold text-primary">
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
                        ? /429|quota|depleted|exceeded/i.test(assist.fellBack)
                          ? "نفد رصيد مزوّد الذكاء الاصطناعي لدى المنصة مؤقتاً، فعُرض اقتراح تجريبي مبسّط — أبلغ إدارة المنصة."
                          : "تعذّر الوصول لمحرك الذكاء الاصطناعي، فعُرض اقتراح تجريبي مبسّط بدلاً منه."
                        : "اقتراح من الوضع التجريبي — يُفعَّل التأليف والتحليل الفعليان عند ربط مفاتيح الذكاء الاصطناعي."}
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
                <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
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
                    className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
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
                          className="rounded-lg border border-border-soft bg-surface-raised px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary"
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
                            className="w-16 rounded-lg border border-border-soft bg-surface-raised px-2 py-1.5 text-center text-sm outline-none focus:border-primary"
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
                            className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:border-primary/60 hover:text-primary-strong"
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
                          className="mt-3 w-full resize-y rounded-lg border border-border-soft bg-surface-raised p-3 text-sm leading-loose outline-none transition-colors focus:border-primary"
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
                        className="rounded-full border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
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
                  className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-loose outline-none transition-colors focus:border-primary"
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
                      className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-rose disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      🧩 قسّم إلى مقاطع مُهيكلة
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 🎧 بروفة النطق — متاحة لوضعي النص الحر والمقاطع معاً */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={rehearse}
                disabled={rehearsing || loading || !lyrics.trim()}
                title="اسمع الكلمات بالتلقين الكامل (ذاكرة النطق + التشكيل باللهجة) قبل دفع كلفة التلحين"
                className="rounded-xl border border-gold/60 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {rehearsing ? "🎧 يجهّز التلقين ويقرأ..." : "🎧 بروفة النطق — اسمعها قبل التلحين"}
              </button>
              <span className="text-xs text-muted">
                قراءة واضحة لما سيُلقَّن للمولد حرفياً — لفظ منحرف هنا يعني لفظاً منحرفاً في الغناء
              </span>
            </div>

            {rehearsal && (
              <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4 text-sm">
                <p className="font-semibold">
                  🎧 هذا ما سيُلقَّن للمولد حرفياً
                  {rehearsal.mock && (
                    <span className="ms-2 text-xs font-normal text-muted">
                      (قراءة تجريبية — محرك النطق غير مفعّل في هذه البيئة)
                    </span>
                  )}
                </p>
                <audio controls src={rehearsal.url} className="mt-2 w-full" />
                <p dir="rtl" className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-3 leading-loose">
                  {rehearsal.dictated}
                </p>
                {rehearsal.issues.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {rehearsal.issues.map((issue, i) => (
                      <li key={i} className="rounded-lg bg-surface px-3 py-1.5">
                        <span className="text-primary-strong line-through">{issue.original}</span>
                        {" ← "}
                        <span className="font-semibold text-accent">{issue.fixed}</span>
                        <span className="ms-2 text-muted">({issue.reason})</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setLyrics(rehearsal.dictated);
                      if (sections) applySections(parseSections(rehearsal.dictated));
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-strong"
                  >
                    ✓ اعتمد النص الملقَّن للتلحين
                  </button>
                  <span className="text-xs text-muted">
                    سمعت لفظاً خاطئاً؟ عدّل الكلمة في النص (أو شكّلها بنفسك — تشكيلك يُحترم) ثم أعد البروفة.
                  </span>
                </div>
              </div>
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
                        <span className="text-primary-strong line-through">{issue.original}</span>
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
        {studioMode === "manual" && step === 1 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="mb-4 text-xl font-bold">اختر المقام</h2>
              <LiveMaqamPanel maqam={maqam} signedIn={signedIn} />
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
              {/* عائلات ألوان الطرب: عربية وتركية وغربية */}
              <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="عائلة المقام">
                {MAQAM_FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    role="radio"
                    aria-checked={maqamFamily === f.id}
                    onClick={() => setMaqamFamily(f.id)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                      maqamFamily === f.id
                        ? "border-primary bg-rose font-semibold text-primary"
                        : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                    }`}
                  >
                    {f.name}
                    <span className="ms-1.5 text-xs text-muted">
                      {f.id === "all"
                        ? MAQAMAT.length
                        : MAQAMAT.filter((m) => m.family === f.id).length}
                    </span>
                  </button>
                ))}
              </div>
              <div
                role="radiogroup"
                aria-label="اختيار المقام"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                {(maqamFamily === "all"
                  ? MAQAMAT
                  : MAQAMAT.filter((m) => m.family === maqamFamily)
                ).map((m) => (
                  <div
                    key={m.id}
                    role="radio"
                    aria-checked={maqamId === m.id}
                    tabIndex={0}
                    onClick={() => setMaqamId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setMaqamId(m.id);
                      }
                    }}
                    className={`cursor-pointer rounded-2xl border p-4 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                      maqamId === m.id
                        ? "border-primary bg-rose"
                        : "border-border-soft bg-surface-card hover:border-primary/50"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-lg font-bold">
                        {m.name}
                        {m.family !== "arabic" && (
                          <span className="ms-2 rounded-full bg-accent/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-accent">
                            {m.family === "turkish" ? "تركي" : "غربي"}
                          </span>
                        )}
                      </span>
                      {maqamId === m.id && <span className="text-primary">✓</span>}
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
                          ? "border-primary bg-rose text-primary"
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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">أجواء جاهزة:</span>
                {AMBIENCES.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pickAmbience(a.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      ambience === a.id
                        ? "border-primary bg-rose text-primary"
                        : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
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

        {/* الخطوة 3: التوليد — وفي الوضع الذكي تظهر مع أول أمر ذكي أو استعادة مهمة */}
        {(studioMode === "manual" ? step === 2 : smartRan || loading || !!result) && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-4 text-xl font-bold">مستوى التوليد</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setTier("preview")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "preview"
                      ? "border-primary bg-rose"
                      : "border-border-soft bg-surface-card hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎧 معاينة سريعة</span>
                    {tier === "preview" && <span className="text-primary">✓</span>}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">
                    مسودة آلية ~30 ثانية لتجربة المقام والأسلوب بأقل تكلفة (Lyria 3)، قبل توليد النسخة النهائية.
                  </span>
                </button>
                <button
                  onClick={() => setTier("full")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "full"
                      ? "border-primary bg-rose"
                      : "border-border-soft bg-surface-card hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎼 النسخة الكاملة</span>
                    {tier === "full" && <span className="text-primary">✓</span>}
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
                        aria-label="لهجة الأداء الغنائي"
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

            {tier === "full" && (
              <div
                className={`rounded-2xl border p-4 transition-colors ${
                  compareMode && signedIn
                    ? "border-accent/60 bg-accent/5"
                    : "border-border-soft bg-surface-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      🧪 وضع المقارنة بين المحركين{" "}
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                        تجريبي
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      الافتراضي نسخة واحدة بأقوى سلسلة: Lyria 3 Pro (محرك Google Flow
                      Music) مع رجوع تلقائي إلى Eleven Music v2 عند تعذّره. فعّل المقارنة
                      عندما تريد الحكم بنفسك: نسختان متوازيتان من المحركين، وتُحسبان
                      توليدَين من حدك.
                    </p>
                  </div>
                  {signedIn ? (
                    <button
                      onClick={() => setCompareMode((v) => !v)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                        compareMode
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border-soft text-muted hover:text-body"
                      }`}
                    >
                      {compareMode ? "✓ مفعّل" : "معطّل"}
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">
                      سجّل دخولك لتفعيل المقارنة
                    </span>
                  )}
                </div>
              </div>
            )}

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
              <p
                role="alert"
                className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong"
              >
                {error}
              </p>
            )}

            {/* إعلان حي لقارئ الشاشة عن مراحل التوليد — بصرياً تظهر في نص الزر */}
            <p role="status" aria-live="polite" className="sr-only">
              {loading ? stage : ""}
            </p>

            <button
              onClick={() => generate()}
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {loading
                ? stage || "جارٍ التلحين والتوليد..."
                : tier === "preview"
                  ? "🎧 ولّد المعاينة"
                  : wantCompareUi
                    ? "🧪 ولّد النسختين للمقارنة"
                    : "🎼 ولّد الأغنية"}
            </button>

            {compareNote && (
              <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm">
                {compareNote}
              </p>
            )}

            {compareSlots && (
              <div className="rounded-2xl border border-accent/40 bg-surface-card p-5">
                <h3 className="text-sm font-bold">🧪 المقارنة بين المحركين</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  استمع للنسختين ثم اعتمد الأفضل — اختيارك يُسجَّل في عقل المنصة ويحسم أي
                  محرك يتصدر للأغاني العربية، وتُفتح على النسخة المعتمدة كل أدوات ما بعد
                  التوليد.
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {compareSlots.map((slot, i) => (
                    <div
                      key={slot.jobId}
                      className="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span dir="ltr" className="text-sm font-bold">
                          {ENGINE_LABELS[slot.provider]}
                        </span>
                        {slot.song && result?.jobId === slot.song.jobId && (
                          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                            ✓ المعتمدة
                          </span>
                        )}
                      </div>
                      {slot.status === "running" && (
                        <p className="animate-pulse text-xs text-muted">
                          ⏳ {slot.stage || "جارٍ التوليد..."}
                        </p>
                      )}
                      {slot.status === "failed" && (
                        <p className="rounded-lg border border-primary/40 bg-rose px-3 py-2 text-xs text-primary-strong">
                          {slot.error}
                        </p>
                      )}
                      {slot.status === "done" && slot.song && (
                        <>
                          <AudioPlayer
                            src={slot.song.url}
                            title={`«${slot.song.title}»`}
                            mock={slot.song.mock}
                            filename={`maqam-${slot.provider}.${slot.song.ext}`}
                            signal={
                              slot.song.mock
                                ? undefined
                                : {
                                    maqamId,
                                    settings: {
                                      stylePrompt: slot.song.prompt,
                                      engine: slot.provider,
                                    },
                                  }
                            }
                            note={
                              slot.song.fellBack
                                ? slot.song.mock
                                  ? `تعذّر هذا المحرك فعُرض بديل تجريبي — لا يصلح للمقارنة. السبب: ${
                                      slot.song.fellBackReason?.slice(0, 160) ?? "غير معروف"
                                    }`
                                  : "رفض مرشّح ليرا الكلمات فغنّتها هذه النسخة عبر Eleven Music — النسختان من المحرك نفسه فالمقارنة غير دالة هذه الجولة."
                                : undefined
                            }
                          />
                          {result?.jobId !== slot.song.jobId && (
                            <button
                              onClick={() => adoptCompareVersion(i)}
                              className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
                            >
                              ⭐ اعتمد هذه النسخة
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  controlRef={playerCtlRef}
                  signal={result.mock ? undefined : { maqamId, settings: { stylePrompt: result.prompt } }}
                  filename={`maqam-song-v${versions.length}.${result.ext}`}
                  note={
                    result.fellBack
                      ? result.mock
                        ? `تعذّر محرك التوليد فعُرض سلّم المقام التجريبي بدلاً منه. السبب: ${
                            result.fellBackReason?.slice(0, 160) ?? "غير معروف"
                          }`
                        : `أصرّ مرشّح محتوى ليرا على رفض الكلمات بعد ثلاث محاولات (رفض متقلب لا يعيب كلماتك) فغنّاها محرك Eleven Music كاملةً — هذه أغنية حقيقية. «ولّد نسخة أخرى بنفس الإعدادات» يعيد المحاولة على ليرا.`
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
                    className="rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-50"
                  >
                    🔁 ولّد نسخة أخرى بنفس الإعدادات
                  </button>
                  {!result.mock && (
                    <button
                      onClick={() => applyMaster()}
                      disabled={mastering || result.mastered}
                      title="تطبيع علو الصوت + قص الصمت + دخول وخروج ناعمان — معالجة فورية في متصفحك"
                      className="rounded-xl border border-accent px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                    >
                      {result.mastered ? "✓ تم الماستر" : mastering ? "جارٍ المعالجة..." : "✨ لمسة الماستر"}
                    </button>
                  )}
                  {!result.mock && !instrumental && (
                    <button
                      onClick={() => startKaraoke()}
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
                      className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {coverBusy ? "جارٍ الرسم..." : coverUrl ? "🎨 غلاف آخر" : "🎨 غلاف الألبوم"}
                    </button>
                  )}
                  {!result.mock && (
                    <button
                      onClick={publishToYouTube}
                      disabled={ytProgress !== null}
                      title="يصنع فيديو جاهزاً (الغلاف + موجات متحركة + الصوت) وينزّله ويفتح صفحة رفع يوتيوب — يوتيوب لا يقبل ملفات صوت"
                      className="rounded-xl bg-[#FF0000] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {ytProgress !== null
                        ? ytStage || `🎬 يصنع الفيديو ${Math.round(ytProgress * 100)}٪`
                        : "▶️ نشر على يوتيوب"}
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

                {fixMsg && <p className="text-xs text-accent">{fixMsg}</p>}

                {studioMode === "smart" && retakeNote && (
                  <p className="rounded-xl border border-gold/50 bg-gold/10 px-4 py-2.5 text-xs leading-relaxed">
                    {retakeNote}
                  </p>
                )}

                {karaokeBusy && !karaokeWords && (
                  <p className="animate-pulse rounded-xl border border-border-soft bg-surface-card px-4 py-3 text-sm text-muted">
                    ⏳ جارٍ مزامنة الكلمات مع الغناء لفتح محرر النص والصوت...
                  </p>
                )}
                {karaokeNote && !karaokeWords && !karaokeBusy && (
                  <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs">
                    تعذّرت المزامنة التلقائية ({karaokeNote}) — جرّب زر «🎤 كاريوكي» بعد قليل.
                  </p>
                )}
                {karaokeWords && (
                  <LyricsEditor
                    words={karaokeWords}
                    activeIndex={activeWord}
                    title={result.title}
                    sections={sections}
                    sectionStarts={karaokeStarts}
                    canInpaint={
                      !!(sections?.length && result.elevenSongId && tier === "full" && !result.mock)
                    }
                    busy={loading || fixBusy}
                    onPlayWord={playWord}
                    onFix={({ wrong, alias, sectionIndex }) =>
                      teachAndRegen(wrong, alias, sectionIndex)
                    }
                  />
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

                {!result.mock && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-surface-card p-3">
                    <span className="text-xs text-muted">
                      🔄 نفس الأغنية بمقام آخر — بلا إعادة أي إعداد:
                    </span>
                    {MAQAMAT.filter((m) => m.id !== maqamId).map((m) => (
                      <button
                        key={m.id}
                        disabled={loading}
                        onClick={() => {
                          setMaqamId(m.id);
                          generate({ maqamId: m.id });
                        }}
                        className="rounded-full border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {m.name}
                      </button>
                    ))}
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
                        className="rounded-full border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {SECTION_LABELS[s.kind]} {i + 1}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!result.mock && !instrumental && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-semibold">
                      🩹 تصحيح يدوي — لكلمة لم تجدها في محرر النص والصوت أعلاه:
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      يتعلم العقل النطق الصحيح للأبد (لكل الأصوات والأغاني القادمة)، ويُعاد إنشاد
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
                  </div>
                )}

                {/* المرحلة 8: فصل المسارات (للأغاني المغناة) وغناء المستخدم على اللحن */}
                {!result.mock && !instrumental && (
                  <StemsPanel
                    key={`stems-${result.url}`}
                    song={{ blob: result.blob, title: result.title }}
                  />
                )}
                {!result.mock && (
                  <SingAlongPanel
                    key={`sing-${result.url}`}
                    song={{ blob: result.blob, title: result.title }}
                    isInstrumental={instrumental}
                    maqamId={maqamId}
                    styleId={styleId}
                  />
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
                          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-50"
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
