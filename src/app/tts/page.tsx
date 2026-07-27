"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SaveToLibrary from "@/components/SaveToLibrary";
import WaveLine from "@/components/WaveLine";
import { VOICES, type Voice } from "@/lib/voices";
import {
  LAYER_CATEGORIES,
  PERFORMANCE_STYLES,
  STYLE_CATEGORIES,
  STYLE_LAYERS,
} from "@/lib/performance/styles";
import { LRI, PDI, SPOKEN_CUES, TAG_GROUPS, insertTagAt, stutterize } from "@/lib/performance/tags";
import { authHeaders } from "@/lib/supabase";

type CustomVoice = { id: string; name: string };

/** صوت الكتالوج مُثرى بإشارات عقل المنصة: تقييم المستخدمين وإعدادات متعلمة */
type CatalogVoice = Voice & {
  rating?: { avg: number; count: number };
  learned?: { stability: number; speed: number };
};

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function TTSStudio() {
  const [voices, setVoices] = useState<CatalogVoice[]>(VOICES);
  const [text, setText] = useState("");
  const [dialect, setDialect] = useState<string>("الكل");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);

  // المخرج الصوتي: المحرك التعبيري + أسلوب الأداء + وسوم داخل النص
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [expressive, setExpressive] = useState(true);
  const [perfStyle, setPerfStyle] = useState("auto");
  const [liveliness, setLiveliness] = useState(0.35);
  const [takes, setTakes] = useState(1);

  // قاعدة الطبقات: حالة جسدية + بيئة صوتية تتراكب فوق الأسلوب
  const [layers, setLayers] = useState<string[]>([]);
  // موجه المخرج الحر — توجيه إضافي بأي لغة يُحقن فوق الأزرار
  const [directorNote, setDirectorNote] = useState("");
  // وصفات المخرج المحفوظة محلياً
  type Recipe = { name: string; styleId: string; layers: string[]; note: string };
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeName, setRecipeName] = useState("");

  useEffect(() => {
    // تأجيل القراءة لما بعد الرسم الأول — يرضي قاعدة عدم التزامن في التأثيرات
    const t = setTimeout(() => {
      try {
        setRecipes(JSON.parse(localStorage.getItem("maqam-director-recipes") ?? "[]"));
      } catch {
        /* تجاهل */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function saveRecipe() {
    const name = recipeName.trim();
    if (!name) return;
    const next = [
      { name, styleId: perfStyle, layers, note: directorNote.trim() },
      ...recipes.filter((r) => r.name !== name),
    ].slice(0, 12);
    setRecipes(next);
    setRecipeName("");
    localStorage.setItem("maqam-director-recipes", JSON.stringify(next));
  }

  function applyRecipe(r: Recipe) {
    setPerfStyle(r.styleId);
    setLayers(r.layers);
    setDirectorNote(r.note);
    setExpressive(true);
  }

  function deleteRecipe(name: string) {
    const next = recipes.filter((r) => r.name !== name);
    setRecipes(next);
    localStorage.setItem("maqam-director-recipes", JSON.stringify(next));
  }

  function toggleLayer(id: string) {
    setLayers((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  }

  /** التلعثم المتعمد — على الكلمة المحددة أو التي عند المؤشر */
  function applyStutter() {
    const el = textRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? start;
    const next = stutterize(text, start, end);
    setText(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  }
  const [takesResults, setTakesResults] = useState<
    { url: string; blob: Blob; score: number | null; ext: string }[] | null
  >(null);
  const [takesMock, setTakesMock] = useState(false);

  /**
   * إدراج وسم أداء عند موضع المؤشر — الوسم الإنجليزي يُعزل اتجاهياً
   * كي يظهر في موضعه الصحيح داخل النص العربي، والثبات «الرصين» يتجاهل
   * الوسوم رسمياً فنخفضه لـ«طبيعي» عند أول إدراج.
   */
  function insertTag(tag: string) {
    const el = textRef.current;
    const cursor = el ? el.selectionStart : text.length;
    const wrapped = tag.startsWith("[") ? `${LRI}${tag}${PDI}` : tag;
    const next = insertTagAt(text, cursor, wrapped);
    setText(next.text);
    if (tag.startsWith("[") && stability >= 0.75) setStability(0.5);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  // الأصوات المستنسخة + نموذج الاستنساخ
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const [cloneSuccess, setCloneSuccess] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // تصميم صوت جديد من وصف نصي
  const [designOpen, setDesignOpen] = useState(false);
  const [designDesc, setDesignDesc] = useState("");
  const [designName, setDesignName] = useState("");
  const [designing, setDesigning] = useState(false);
  const [savingDesign, setSavingDesign] = useState("");
  const [designError, setDesignError] = useState("");
  const [previews, setPreviews] = useState<{ generatedVoiceId: string; url: string }[]>([]);

  async function designVoice() {
    setDesignError("");
    setPreviews([]);
    setDesigning(true);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ description: designDesc }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تصميم الصوت");

      setPreviews(
        (data.previews ?? []).map((p: { generatedVoiceId: string; audio: string; mediaType: string }) => ({
          generatedVoiceId: p.generatedVoiceId,
          url: `data:${p.mediaType};base64,${p.audio}`,
        }))
      );
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setDesigning(false);
    }
  }

  async function saveDesign(generatedVoiceId: string) {
    if (!designName.trim()) {
      setDesignError("اكتب اسماً للصوت قبل الحفظ");
      return;
    }
    setDesignError("");
    setSavingDesign(generatedVoiceId);
    try {
      const res = await fetch("/api/voices/design", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ name: designName.trim(), description: designDesc, generatedVoiceId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر حفظ الصوت");

      setCustomVoices((prev) => [{ id: data.voiceId, name: data.name }, ...prev]);
      setVoiceId(`custom:${data.voiceId}`);
      setPreviews([]);
      setDesignName("");
      setDesignDesc("");
      setCloneSuccess(`تم حفظ صوت «${data.name}» — اخترناه لك، اكتب نصاً وجرّبه!`);
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSavingDesign("");
    }
  }

  // ذاكرة النطق المتراكمة — «عقل» المنصة الذي يكبر مع كل تصحيح
  const [pronOpen, setPronOpen] = useState(false);
  const [pronRules, setPronRules] = useState<{ word: string; alias: string }[]>([]);
  const [pronWord, setPronWord] = useState("");
  const [pronAlias, setPronAlias] = useState("");
  const [pronSaving, setPronSaving] = useState(false);
  const [pronMsg, setPronMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voices", { headers: await authHeaders() });
        const d = await res.json();
        setCustomVoices(d.voices ?? []);
      } catch {
        /* تجاهل */
      }
    })();
    fetch("/api/pronunciation")
      .then((r) => r.json())
      .then((d) => setPronRules(d.rules ?? []))
      .catch(() => {});
  }, []);

  // تعليم النطق بالصوت: تسجيل ← تحليل صوتي ← تشكيل دقيق
  const [pronRecording, setPronRecording] = useState(false);
  const [pronAnalyzing, setPronAnalyzing] = useState(false);
  const [pronAnalysis, setPronAnalysis] = useState<{
    heardWord: string;
    vocalized: string;
    ipa: string;
    confidence: number;
    note: string;
  } | null>(null);
  const pronRecRef = useRef<MediaRecorder | null>(null);
  const pronChunksRef = useRef<Blob[]>([]);

  async function startPronRecording() {
    setPronMsg("");
    setPronAnalysis(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      pronChunksRef.current = [];
      rec.ondataavailable = (e) => pronChunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const raw = new Blob(pronChunksRef.current, { type: rec.mimeType || "audio/webm" });
        await analyzePronunciation(raw);
      };
      rec.start();
      pronRecRef.current = rec;
      setPronRecording(true);
    } catch {
      setPronMsg("تعذر الوصول للمايكروفون — تأكد من السماح للموقع باستخدامه");
    }
  }

  function stopPronRecording() {
    pronRecRef.current?.stop();
    setPronRecording(false);
  }

  async function analyzePronunciation(raw: Blob) {
    setPronAnalyzing(true);
    try {
      const { blobToWav } = await import("@/lib/wavEncoder");
      const wav = await blobToWav(raw);

      const fd = new FormData();
      fd.append("file", new File([wav], "pron.wav", { type: "audio/wav" }));
      if (pronWord.trim()) fd.append("word", pronWord.trim());

      const res = await fetch("/api/pronunciation/from-audio", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل التسجيل");

      setPronAnalysis(data);
      if (!pronWord.trim() && data.heardWord) setPronWord(data.heardWord);
      setPronAlias(data.vocalized);
    } catch (e) {
      setPronMsg(e instanceof Error ? e.message : "حدث خطأ في التحليل");
    } finally {
      setPronAnalyzing(false);
    }
  }

  async function teachPronunciation() {
    if (!pronWord.trim() || !pronAlias.trim()) return;
    setPronSaving(true);
    setPronMsg("");
    try {
      const res = await fetch("/api/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ word: pronWord.trim(), alias: pronAlias.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الحفظ");

      setPronRules((prev) => [{ word: pronWord.trim(), alias: pronAlias.trim() }, ...prev]);
      setPronMsg(`تعلّمت المنصة نطق «${pronWord.trim()}» — سيُطبَّق تلقائياً من الآن فصاعداً`);
      setPronWord("");
      setPronAlias("");
    } catch (e) {
      setPronMsg(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setPronSaving(false);
    }
  }

  async function forgetPronunciation(word: string) {
    setPronRules((prev) => prev.filter((r) => r.word !== word));
    await fetch(`/api/pronunciation?word=${encodeURIComponent(word)}`, { method: "DELETE" }).catch(() => {});
  }

  async function startRecording() {
    setCloneError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setCloneFile(new File([blob], "تسجيل-مباشر.webm", { type: blob.type }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setCloneError("تعذر الوصول للمايكروفون — تأكد من السماح للموقع باستخدامه");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function submitClone() {
    if (!cloneName.trim() || !cloneFile || !consent) return;
    setCloneError("");
    setCloneSuccess("");
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName.trim());
      fd.append("file", cloneFile);
      fd.append("consent", "true");
      const res = await fetch("/api/voices", { method: "POST", headers: await authHeaders(), body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذر استنساخ الصوت");
      setCustomVoices((prev) => [{ id: data.voiceId, name: data.name }, ...prev]);
      setVoiceId(`custom:${data.voiceId}`);
      setCloneSuccess(`تم إنشاء صوت «${data.name}» — اخترناه لك، اكتب نصاً وجرّبه!`);
      setCloneName("");
      setCloneFile(null);
      setConsent(false);
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setCloning(false);
    }
  }
  // المستشار الصوتي: تشكيل كامل + تطبيع + اقتراح الصوت والإعدادات
  const [advising, setAdvising] = useState(false);
  const [advice, setAdvice] = useState<{
    enhanced: string;
    contentType: string;
    changes: string;
    recommendedVoiceId: string;
    voiceReason: string;
    stability: number;
    speed: number;
  } | null>(null);
  const [adviceError, setAdviceError] = useState("");
  const [originalText, setOriginalText] = useState<string | null>(null);

  const [speed, setSpeed] = useState(1);
  const [stability, setStability] = useState(0.5);
  // مع «تلقائي» غير الملموس: يُترك الثبات للخادم ليطبق ثبات الأسلوب المصنف
  const [stabilityTouched, setStabilityTouched] = useState(false);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; blob: Blob; mock: boolean; ext: string; fellBack: boolean } | null>(null);
  const [error, setError] = useState("");

  // الشخصنة: الافتراضات من ذوق المستخدم المتعلم لا من ترتيب القائمة
  const [personalized, setPersonalized] = useState("");

  // كتالوج المنصة الفعلي من الخادم — الأصوات المتاحة حسب المفاتيح المضبوطة (ElevenLabs / Azure)
  useEffect(() => {
    let cancelled = false;
    // قادم من معرض الأصوات برابط ?voice= — اختياره الصريح يتقدم على الشخصنة
    const urlVoice = new URLSearchParams(window.location.search).get("voice");
    async function loadVoices() {
      try {
        const res = await fetch("/api/voices/catalog");
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data) {
          if (urlVoice && VOICES.some((v) => v.id === urlVoice)) setVoiceId(urlVoice);
          return;
        }
        const all: CatalogVoice[] = data.voices ?? [];
        if (all.length) {
          setVoices(all);
          setVoiceId((prev) =>
            prev.startsWith("custom:") || all.some((v) => v.id === prev) ? prev : all[0].id
          );
        }
        if (urlVoice && all.some((v) => v.id === urlVoice)) {
          setVoiceId(urlVoice);
          return;
        }

        // ملف الذوق: صوت المستخدم المفضل يتقدم افتراضياً مع إعداداته المريحة
        const pres = await fetch("/api/me/profile");
        const pdata = await pres.json().catch(() => null);
        const profile = pdata?.profile;
        if (cancelled || !profile) return;
        const favorite = (profile.topVoices ?? [])
          .map((t: { voiceId: string }) => all.find((v) => v.id === t.voiceId))
          .find(Boolean) as CatalogVoice | undefined;
        if (favorite) {
          setVoiceId(favorite.id);
          if (Number.isFinite(profile.avgStability)) setStability(profile.avgStability);
          if (Number.isFinite(profile.avgSpeed)) setSpeed(Math.min(1.5, Math.max(0.5, profile.avgSpeed)));
          setPersonalized(favorite.name);
        }
      } catch {
        /* الكتالوج الثابت يبقى بديلاً */
      }
    }
    loadVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  /** اختيار صوت مع تطبيق إعداداته المتعلمة من تقييمات المستخدمين إن وُجدت */
  function selectVoice(v: CatalogVoice) {
    setVoiceId(v.id);
    if (v.learned) {
      setSpeed(Math.min(1.5, Math.max(0.5, v.learned.speed)));
      setStability(Math.min(1, Math.max(0, v.learned.stability)));
    }
  }

  const dialects = useMemo(() => [...new Set(voices.map((v) => v.dialect))], [voices]);
  const shownVoices = useMemo(
    () => (dialect === "الكل" ? voices : voices.filter((v) => v.dialect === dialect)),
    [dialect, voices]
  );

  async function runAdvisor() {
    if (!text.trim()) return;
    setAdviceError("");
    setAdvising(true);
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text, dialect }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل النص");

      setAdvice(data);
      setOriginalText(text);
      setText(data.enhanced);
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setAdvising(false);
    }
  }

  /** تطبيق الصوت والإعدادات التي اقترحها المستشار */
  function applyAdvice() {
    if (!advice) return;
    setVoiceId(advice.recommendedVoiceId);
    setStability(advice.stability);
    setSpeed(advice.speed);
    const v = VOICES.find((x) => x.id === advice.recommendedVoiceId);
    if (v) setDialect(v.dialect);
  }

  /** التراجع عن التشكيل والعودة للنص الأصلي */
  function undoAdvice() {
    if (originalText === null) return;
    setText(originalText);
    setOriginalText(null);
    setAdvice(null);
  }

  async function generate() {
    if (!text.trim()) {
      setError("اكتب النص أولاً");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    setTakesResults(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          text,
          voiceId,
          speed,
          // مع «تلقائي» بلا لمس للمنزلق: الخادم يطبق ثبات الأسلوب المصنف
          stability:
            expressive && perfStyle === "auto" && !stabilityTouched ? undefined : stability,
          format,
          expressive,
          // إيقاف المحرك التعبيري يعطّل الأسلوب والطبقات والموجه أيضاً
          styleId: expressive ? perfStyle : "",
          layerIds: expressive ? layers : [],
          directorNote: expressive ? directorNote.trim() : "",
          liveliness,
          takes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد، حاول مجدداً");
      }

      // التوليد المتعدد يعود JSON بكل النسخ ودرجاتها؛ النسخة الواحدة تعود صوتاً مباشراً
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        const items = (data.takes ?? []).map(
          (t: { audio: string; mimeType: string; score: number | null }) => {
            const blob = b64ToBlob(t.audio, t.mimeType);
            return {
              url: URL.createObjectURL(blob),
              blob,
              score: t.score,
              ext: t.mimeType === "audio/mpeg" ? "mp3" : "wav",
            };
          }
        );
        setTakesMock(!!data.mock);
        setTakesResults(items);
        return;
      }

      const mock = res.headers.get("X-Mock") === "1";
      const fellBack = res.headers.has("X-Fallback");
      const blob = await res.blob();
      const ext = blob.type === "audio/mpeg" ? "mp3" : "wav";
      setResult({ url: URL.createObjectURL(blob), blob, mock, ext, fellBack });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        استوديو <span className="text-gradient">النص إلى صوت</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-3 text-muted">
        اكتب نصك، اختر الصوت واللهجة، واضبط الأداء — ثم استمع وحمّل الناتج.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* النص */}
        <div className="flex flex-col gap-4">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20000}
            placeholder={"اكتب النص هنا...\nمثال: أهلاً بكم في منصة مقام، حيث تتحول الكلمات إلى صوتٍ نابضٍ بالحياة."}
            className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-relaxed outline-none transition-colors focus:border-primary"
          />
          {/* المخرج الصوتي — المحرك التعبيري (الجيل الثالث) */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  🎬 المخرج الصوتي
                  <span className="mx-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    المحرك التعبيري v3
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  أداء بشري بمشاعر حقيقية: اختر أسلوب أداء جاهزاً، أو ضع المؤشر داخل النص
                  وأدرج وسوم مشاعر وتوقفات تتحكم باللحظة نفسها.
                </p>
              </div>
              <button
                onClick={() => setExpressive(!expressive)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                  expressive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border-soft text-muted hover:text-body"
                }`}
              >
                {expressive ? "● مفعّل" : "○ متوقف"}
              </button>
            </div>

            {expressive && (
              <>
                {/* مكتبة أساليب الأداء */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold">أسلوب الأداء</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setPerfStyle("auto")}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        perfStyle === "auto"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                      }`}
                      title="يحلل الذكاء الاصطناعي نصك ويختار الأسلوب الأنسب بنفسه"
                    >
                      ✨ تلقائي — يقرأ النص ويختار
                    </button>
                    <button
                      onClick={() => setPerfStyle("")}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        perfStyle === ""
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                      }`}
                      title="بلا أسلوب مسبق — الوسوم داخل النص وحدها تتحكم"
                    >
                      بدون أسلوب
                    </button>
                  </div>
                  {STYLE_CATEGORIES.map((cat) => (
                    <div key={cat} className="mt-2.5">
                      <p className="text-[10px] font-semibold text-muted">{cat}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {PERFORMANCE_STYLES.filter((s) => s.category === cat).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setPerfStyle(s.id);
                              // ثبات الأسلوب المضبوط مخبرياً ينعكس على المنزلق فوراً
                              setStability(s.stability);
                            }}
                            title={s.desc}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                              perfStyle === s.id
                                ? "border-primary bg-primary/15 font-semibold text-primary"
                                : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                            }`}
                          >
                            {s.icon} {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* وسوم داخل النص */}
                <div className="mt-4 border-t border-border-soft pt-3">
                  <p className="mb-1 text-xs font-semibold">
                    وسوم داخل النص{" "}
                    <span className="font-normal text-muted">
                      — ضع المؤشر في الموضع المطلوب ثم اضغط الوسم
                    </span>
                  </p>
                  {TAG_GROUPS.map((g) => (
                    <div key={g.id} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted">
                        {g.icon} {g.name}:
                      </span>
                      {g.tags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => insertTag(t.tag)}
                          className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:border-primary/50 hover:text-body"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  ))}
                  {/* دلالات منطوقة + التلعثم — تعمل على النص العربي نفسه */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted">🗣️ دلالات منطوقة:</span>
                    {SPOKEN_CUES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => insertTag(c.cue)}
                        className="rounded-lg border border-border-soft px-2 py-1 text-xs text-muted transition-colors hover:border-primary/50 hover:text-body"
                      >
                        {c.name}
                      </button>
                    ))}
                    <button
                      onClick={applyStutter}
                      title="حدد كلمة (أو ضع المؤشر عليها) ثم اضغط — تصير: أـ أـ أنا"
                      className="rounded-lg border border-gold/50 px-2 py-1 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
                    >
                      😨 تلعثم الكلمة المحددة
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted">
                    💡 الترقيم نوتتك الموسيقية: الفاصلة (،) وقفة قصيرة · النقاط (...) تردد ووقفة
                    درامية · التعجب المتكرر (!!!) صراخ · والتشكيل يحسم النطق (عَلَم / عِلْم).
                    وتذكّر: الوسوم تستجيب بقوة مع ثبات «مبدع» أو «طبيعي» — و«الرصين» يتجاهلها.
                  </p>
                </div>

                {/* قاعدة الطبقات: حالة جسدية + بيئة صوتية فوق الأسلوب */}
                <div className="mt-4 border-t border-border-soft pt-3">
                  <p className="mb-1 text-xs font-semibold">
                    طبقات الأداء{" "}
                    <span className="font-normal text-muted">
                      — تتراكب فوق الأسلوب: مشهد + حالة جسدية + بيئة معاً
                    </span>
                  </p>
                  {LAYER_CATEGORIES.map((cat) => (
                    <div key={cat.id} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted">
                        {cat.icon} {cat.name}:
                      </span>
                      {STYLE_LAYERS.filter((l) => l.category === cat.id).map((l) => (
                        <button
                          key={l.id}
                          onClick={() => toggleLayer(l.id)}
                          className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                            layers.includes(l.id)
                              ? "border-primary bg-primary/15 font-semibold text-primary"
                              : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                          }`}
                        >
                          {l.icon} {l.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* موجه المخرج الحر */}
                <div className="mt-4 border-t border-border-soft pt-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    🎩 موجه المخرج{" "}
                    <span className="font-normal text-muted">
                      — للمحترفين: توجيه إضافي حر بأي لغة يُضاف فوق كل ما سبق
                    </span>
                  </p>
                  <input
                    value={directorNote}
                    onChange={(e) => setDirectorNote(e.target.value)}
                    maxLength={200}
                    placeholder="مثال: like a 1950s Cairo radio host — أو: بأسلوب حكواتي شامي عجوز"
                    className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-xs outline-none transition-colors focus:border-primary"
                  />
                </div>

                {/* وصفات المخرج المحفوظة */}
                <div className="mt-4 border-t border-border-soft pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold">📋 وصفاتي:</span>
                    {recipes.map((r) => (
                      <span key={r.name} className="inline-flex items-center overflow-hidden rounded-lg border border-border-soft">
                        <button
                          onClick={() => applyRecipe(r)}
                          title={`أسلوب + ${r.layers.length} طبقة${r.note ? " + موجه" : ""}`}
                          className="px-2 py-1 text-xs text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                        >
                          {r.name}
                        </button>
                        <button
                          onClick={() => deleteRecipe(r.name)}
                          className="border-s border-border-soft px-1.5 py-1 text-[10px] text-muted hover:text-primary"
                          title="حذف الوصفة"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <input
                      value={recipeName}
                      onChange={(e) => setRecipeName(e.target.value)}
                      maxLength={30}
                      placeholder="اسم للتركيبة الحالية..."
                      className="w-36 rounded-lg border border-border-soft bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
                    />
                    <button
                      onClick={saveRecipe}
                      disabled={!recipeName.trim()}
                      className="rounded-lg border border-primary px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                    >
                      💾 احفظ
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* التوليد المتعدد */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-soft pt-3">
              <p className="text-xs font-semibold">
                التوليد المتعدد{" "}
                <span className="font-normal text-muted">
                  — نسخ بأداءات مختلفة تُرتَّب آلياً حسب دقة النطق
                </span>
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTakes(n)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      takes === n
                        ? "border-primary bg-primary/15 font-semibold text-primary"
                        : "border-border-soft text-muted hover:border-primary/50 hover:text-body"
                    }`}
                  >
                    {n === 1 ? "نسخة واحدة" : `${n} نسخ`}
                  </button>
                ))}
              </div>
              {takes > 1 && (
                <p className="w-full text-[10px] text-muted">
                  كل نسخة إضافية تُحتسب توليداً من حصتك اليومية.
                </p>
              )}
            </div>
          </div>

          {/* المستشار الصوتي */}
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">🧭 المستشار الصوتي</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  يشكّل نصك تشكيلاً كاملاً ويحوّل الأرقام والاختصارات لصيغتها المنطوقة،
                  ثم يقترح الصوت والإعدادات الأنسب. أكبر قفزة في جودة النطق العربي.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {originalText !== null && (
                  <button
                    onClick={undoAdvice}
                    className="rounded-lg border border-border-soft px-3 py-2 text-xs text-muted transition-colors hover:text-body"
                  >
                    ↩ النص الأصلي
                  </button>
                )}
                <button
                  onClick={runAdvisor}
                  disabled={advising || !text.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {advising ? "جارٍ التحليل..." : "✨ حلّل وشكّل النص"}
                </button>
              </div>
            </div>

            {adviceError && (
              <p className="mt-3 rounded-lg border border-primary/40 bg-rose px-3 py-2 text-xs text-primary-strong">
                {adviceError}
              </p>
            )}

            {advice && (
              <div className="mt-3 rounded-xl border border-accent/40 bg-surface p-3 text-xs">
                <p className="font-semibold text-accent">
                  نوع المحتوى: {advice.contentType}
                </p>
                <p className="mt-1.5 leading-relaxed text-muted">{advice.changes}</p>
                <p className="mt-2 leading-relaxed">
                  <span className="text-muted">الصوت المقترح:</span>{" "}
                  <span className="font-semibold">
                    {VOICES.find((v) => v.id === advice.recommendedVoiceId)?.name ?? advice.recommendedVoiceId}
                  </span>{" "}
                  <span className="text-muted">— {advice.voiceReason}</span>
                </p>
                <p className="mt-1 text-muted">
                  الإعدادات المقترحة: ثبات {Math.round(advice.stability * 100)}% · سرعة{" "}
                  {advice.speed.toFixed(2)}×
                </p>
                <button
                  onClick={applyAdvice}
                  className="mt-3 w-full rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
                >
                  ✓ طبّق الصوت والإعدادات المقترحة
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>{text.length} / 20000 حرف</span>
            <span>النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج تلقائياً</span>
          </div>

          {error && (
            <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {loading ? "جارٍ التوليد..." : "🎙️ توليد الصوت"}
          </button>

          {result && (
            <AudioPlayer
              src={result.url}
              title="الناتج الصوتي"
              mock={result.mock}
              signal={result.mock ? undefined : { voiceId, settings: { stability, speed } }}
              filename={`maqam-tts.${result.ext}`}
              note={
                result.fellBack
                  ? "تعذّر الوصول لمحرك ElevenLabs من هذه البيئة، فعُرضت نغمة تجريبية بدلاً منه."
                  : undefined
              }
            >
              <SaveToLibrary
                url={result.url}
                kind="tts"
                title={`تعليق صوتي — ${voices.find((v) => v.id === voiceId)?.name ?? ""}`}
                content={text}
                voiceId={voiceId}
                provider={result.mock ? "mock" : "elevenlabs"}
                settings={{ speed, stability, format }}
              />
            </AudioPlayer>
          )}

          {takesResults && takesResults.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">
                🎛️ النسخ المولّدة — مرتبة آلياً حسب دقة النطق، استمع واختر الأفضل لأذنك
              </p>
              {takesResults.map((t, i) => (
                <AudioPlayer
                  key={t.url}
                  src={t.url}
                  title={`النسخة ${i + 1}${
                    t.score !== null ? ` — دقة النطق ${Math.round(t.score * 100)}%` : ""
                  }${i === 0 && t.score !== null ? " ⭐" : ""}`}
                  mock={takesMock}
                  signal={takesMock ? undefined : { voiceId, settings: { stability, speed } }}
                  filename={`maqam-tts-take${i + 1}.${t.ext}`}
                >
                  <SaveToLibrary
                    url={t.url}
                    kind="tts"
                    title={`تعليق صوتي — ${voices.find((v) => v.id === voiceId)?.name ?? ""} (نسخة ${i + 1})`}
                    content={text}
                    voiceId={voiceId}
                    provider={takesMock ? "mock" : "elevenlabs"}
                    settings={{ speed, stability, format, style: perfStyle }}
                  />
                </AudioPlayer>
              ))}
            </div>
          )}
        </div>

        {/* الإعدادات */}
        <aside className="flex h-fit flex-col gap-5 rounded-2xl border border-border-soft bg-surface-card p-5">
          {/* استنساخ الصوت */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <button
              onClick={() => setCloneOpen(!cloneOpen)}
              className="flex w-full items-center justify-between text-sm font-bold"
            >
              <span>🎤 صوتك الخاص (استنساخ)</span>
              <span className={`text-muted transition-transform ${cloneOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {cloneOpen && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  ارفع عينة من صوتك (30 ثانية – 3 دقائق كلام واضح بلا ضجيج) أو سجّلها الآن،
                  وسينطق الموقع أي نص بنفس نبرتك وطبقتك.
                </p>

                <input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  maxLength={60}
                  placeholder="اسم الصوت... مثال: صوتي"
                  className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />

                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer rounded-lg border border-border-soft px-3 py-2 text-center text-xs text-muted transition-colors hover:border-accent hover:text-body">
                    📁 اختر ملفاً
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        setCloneFile(e.target.files?.[0] ?? null);
                        setCloneError("");
                      }}
                    />
                  </label>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      recording
                        ? "animate-pulse border-primary bg-rose text-primary-strong"
                        : "border-border-soft text-muted hover:border-accent hover:text-body"
                    }`}
                  >
                    {recording ? "⏹ إيقاف التسجيل" : "🔴 سجّل من المايك"}
                  </button>
                </div>

                {cloneFile && (
                  <p className="rounded-lg bg-surface px-3 py-2 text-xs text-accent">
                    ✓ العينة جاهزة: {cloneFile.name} ({(cloneFile.size / 1024 / 1024).toFixed(1)}MB)
                  </p>
                )}

                <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  أقرّ أن هذا الصوت لي، أو أن لديّ إذناً صريحاً من صاحبه باستنساخه واستخدامه.
                </label>

                {cloneError && (
                  <p className="rounded-lg border border-primary/40 bg-rose px-3 py-2 text-xs text-primary-strong">
                    {cloneError}
                  </p>
                )}
                {cloneSuccess && (
                  <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                    {cloneSuccess}
                  </p>
                )}

                <button
                  onClick={submitClone}
                  disabled={cloning || !cloneName.trim() || !cloneFile || !consent}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cloning ? "جارٍ الاستنساخ..." : "🧬 استنسخ الصوت"}
                </button>
              </div>
            )}
          </div>

          {/* ذاكرة النطق */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <button
              onClick={() => setPronOpen(!pronOpen)}
              className="flex w-full items-center justify-between text-sm font-bold"
            >
              <span>
                🧠 ذاكرة النطق
                {pronRules.length > 0 && (
                  <span className="mx-2 rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                    {pronRules.length} كلمة
                  </span>
                )}
              </span>
              <span className={`text-muted transition-transform ${pronOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {pronOpen && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  سمعت كلمة نُطقت خطأً؟ علّمها للمنصة مرة واحدة، وستنطقها صحيحة في كل مرة بعدها —
                  للأبد ولكل الأصوات. هكذا يتعلّم الموقع ويتحسّن مع استخدامك.
                </p>

                <input
                  value={pronWord}
                  onChange={(e) => setPronWord(e.target.value)}
                  maxLength={100}
                  placeholder="الكلمة كما تُكتب... مثال: نابلس"
                  className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={pronAlias}
                  onChange={(e) => setPronAlias(e.target.value)}
                  maxLength={200}
                  placeholder="النطق الصحيح (مشكّلاً)... مثال: نَابُلُس"
                  className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                />

                {/* التعليم بالصوت */}
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                  <p className="mb-2 text-xs leading-relaxed text-muted">
                    🎙️ <strong className="text-accent">أو علّمها بصوتك:</strong> انطق الكلمة بشكل
                    صحيح، وسيستمع الذكاء الاصطناعي لتسجيلك ويستخرج التشكيل الدقيق بنفسه.
                  </p>
                  <button
                    onClick={pronRecording ? stopPronRecording : startPronRecording}
                    disabled={pronAnalyzing}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      pronRecording
                        ? "animate-pulse border-primary bg-rose text-primary-strong"
                        : "border-accent text-accent hover:bg-accent/10"
                    }`}
                  >
                    {pronAnalyzing
                      ? "جارٍ تحليل نطقك..."
                      : pronRecording
                        ? "⏹ أنهيت النطق"
                        : "🎙️ سجّل نطق الكلمة"}
                  </button>

                  {pronAnalysis && (
                    <div className="mt-3 rounded-lg bg-surface p-3 text-xs">
                      <p className="font-semibold text-accent">
                        سمعت: «{pronAnalysis.heardWord}» ← {pronAnalysis.vocalized}
                      </p>
                      <p dir="ltr" className="mt-1 text-muted">
                        IPA: {pronAnalysis.ipa}
                      </p>
                      <p className="mt-1 leading-relaxed text-muted">{pronAnalysis.note}</p>
                      <p className="mt-1 text-muted">
                        الثقة: {Math.round((pronAnalysis.confidence ?? 0) * 100)}% — راجع الحقول
                        أعلاه ثم احفظ.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={teachPronunciation}
                  disabled={pronSaving || !pronWord.trim() || !pronAlias.trim()}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pronSaving ? "جارٍ التعليم..." : "🧠 علّم المنصة"}
                </button>

                {pronMsg && (
                  <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
                    {pronMsg}
                  </p>
                )}

                {pronRules.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted">ما تعلّمته المنصة:</p>
                    {pronRules.slice(0, 12).map((r) => (
                      <div
                        key={r.word}
                        className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-xs"
                      >
                        <span>
                          {r.word} <span className="text-muted">←</span>{" "}
                          <span className="text-primary">{r.alias}</span>
                        </span>
                        <button
                          onClick={() => forgetPronunciation(r.word)}
                          className="text-muted transition-colors hover:text-primary-strong"
                          title="حذف"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* تصميم صوت من وصف */}
          <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
            <button
              onClick={() => setDesignOpen(!designOpen)}
              className="flex w-full items-center justify-between text-sm font-bold"
            >
              <span>🎨 صمّم صوتاً جديداً</span>
              <span className={`text-muted transition-transform ${designOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {designOpen && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  صف الصوت الذي تريده بالعربية — العمر، الجنس، اللهجة، النبرة — وسيصنعه الذكاء
                  الاصطناعي من الصفر. مثالي لإنشاء أصوات فلسطينية بتنويعات غير متوفرة في المكتبة.
                </p>

                <textarea
                  value={designDesc}
                  onChange={(e) => setDesignDesc(e.target.value)}
                  maxLength={800}
                  rows={3}
                  placeholder="مثال: امرأة فلسطينية في الثلاثينات من نابلس، صوت دافئ وحنون بلهجة شامية، نبرة هادئة مناسبة لسرد القصص"
                  className="resize-y rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                />

                <button
                  onClick={designVoice}
                  disabled={designing || designDesc.trim().length < 20}
                  className="rounded-lg bg-gold px-3 py-2 text-sm font-bold text-wine transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {designing ? "جارٍ التصميم..." : "🎨 صمّم 3 معاينات"}
                </button>

                {designError && (
                  <p className="rounded-lg border border-primary/40 bg-rose px-3 py-2 text-xs text-primary-strong">
                    {designError}
                  </p>
                )}

                {previews.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <input
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                      maxLength={60}
                      placeholder="اسم الصوت... مثال: نور الفلسطينية"
                      className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <p className="text-xs text-muted">استمع للثلاثة واحفظ الأفضل:</p>
                    {previews.map((p, i) => (
                      <div key={p.generatedVoiceId} className="rounded-lg border border-border-soft bg-surface p-3">
                        <p className="mb-2 text-xs font-semibold">المعاينة {i + 1}</p>
                        <audio controls src={p.url} className="w-full" preload="none" />
                        <button
                          onClick={() => saveDesign(p.generatedVoiceId)}
                          disabled={!!savingDesign}
                          className="mt-2 w-full rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-40"
                        >
                          {savingDesign === p.generatedVoiceId ? "جارٍ الحفظ..." : "✓ احفظ هذا الصوت"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* أصواتي المستنسخة */}
          {customVoices.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-semibold">أصواتي المستنسخة</label>
              <div className="flex flex-col gap-2">
                {customVoices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceId(`custom:${v.id}`)}
                    className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                      voiceId === `custom:${v.id}`
                        ? "border-accent bg-accent/10"
                        : "border-border-soft hover:border-accent/50"
                    }`}
                  >
                    <span className="font-semibold">🧬 {v.name}</span>
                    <span className="mt-1 block text-xs text-muted">صوت مستنسخ — ينطق بنبرة صاحبه</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold">اللهجة</label>
            <select
              value={dialect}
              onChange={(e) => {
                setDialect(e.target.value);
                const first = e.target.value === "الكل" ? voices[0] : voices.find((v) => v.dialect === e.target.value);
                if (first) selectVoice(first);
              }}
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 outline-none focus:border-primary"
            >
              <option>الكل</option>
              {dialects.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">الصوت</label>
            {personalized && (
              <p className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                ✨ اخترنا لك «{personalized}» وإعداداتك المريحة — من ذوقك المتعلم
              </p>
            )}
            <div className="flex flex-col gap-2">
              {shownVoices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVoice(v)}
                  className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    voiceId === v.id
                      ? "border-primary bg-primary/10"
                      : "border-border-soft hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">
                      {v.gender === "male" ? "👨" : "👩"} {v.name}
                      <span className="mx-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                        {v.dialect}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      {v.learned && (
                        <span title="إعدادات متعلمة من تقييمات المستخدمين — تُطبَّق تلقائياً عند الاختيار">🧠</span>
                      )}
                      {v.rating && (
                        <span className="text-gold" title={`متوسط ${v.rating.avg} من ${v.rating.count} تقييماً`}>
                          ★ {v.rating.avg.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{v.tone}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={expressive ? "opacity-50" : ""}>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>السرعة</span>
              <span className="text-muted">{speed.toFixed(2)}×</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={expressive}
              className="w-full"
            />
            {expressive && (
              <p className="mt-1 text-xs text-muted">
                المحرك التعبيري يضبط الإيقاع بنفسه — تحكّم به عبر وسوم التوقفات وأسلوب الأداء
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>الثبات ↔ التعبير</span>
              <span className="text-muted">
                {expressive
                  ? stability < 0.25
                    ? "مبدع"
                    : stability < 0.75
                      ? "طبيعي"
                      : "رصين"
                  : `${Math.round(stability * 100)}%`}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={stability}
              onChange={(e) => {
                setStability(Number(e.target.value));
                setStabilityTouched(true);
              }}
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted">
              {expressive
                ? "المحرك التعبيري يعمل بثلاث درجات: مبدع (تعبير أقصى) · طبيعي (متوازن) · رصين (متزن)"
                : "ثبات أعلى = أداء متزن؛ ثبات أقل = تعبير عاطفي أقوى"}
            </p>
          </div>

          {!expressive && (
            <div>
              <label className="mb-2 flex justify-between text-sm font-semibold">
                <span>قوة التعبير</span>
                <span className="text-muted">{Math.round(liveliness * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={liveliness}
                onChange={(e) => setLiveliness(Number(e.target.value))}
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted">
                يضخّم حيوية الأداء في المحرك الكلاسيكي — قيم عالية قد تقلل الثبات
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold">صيغة الملف</label>
            <div className="grid grid-cols-2 gap-2">
              {(["mp3", "wav"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-xl border py-2 text-sm font-semibold uppercase transition-colors ${
                    format === f ? "border-primary bg-primary/10" : "border-border-soft"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
