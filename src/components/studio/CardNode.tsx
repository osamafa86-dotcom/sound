"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import Recorder from "@/components/Recorder";
import { authHeaders } from "@/lib/supabase";
import {
  AI_MODES,
  NODE_DEFS,
  PORT_META,
  aiMode,
  aiModeCost,
  nodePorts,
  type NodeKind,
} from "@/lib/studio/graph";
import { uploadStore } from "@/lib/studio/uploads";
import { MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

/** ناتج وسائطي لبطاقة — الفصل يخرج مقطعين والذكاء صورة أو فيديو */
export type MediaResult = { label: string; url: string; mime: string };

/** بيانات البطاقة داخل المخطط — الإعدادات والحالة والناتج */
export type CardData = {
  kind: NodeKind;
  config: Record<string, string>;
  status: "idle" | "running" | "done" | "error";
  stage?: string;
  error?: string;
  resultText?: string;
  media?: MediaResult[];
  /** تنبيه شفافية: رجوع تجريبي أو ملاحظة محرك — يظهر مع الناتج */
  note?: string;
};

export type CardNodeType = Node<CardData, "card">;

const STATUS_BORDER: Record<CardData["status"], string> = {
  idle: "border-border-soft",
  running: "border-primary animate-pulse",
  done: "border-success",
  error: "border-primary-strong",
};

/** موضع منفذ رأسياً — تحت الترويسة بمسافات متساوية */
const portTop = (i: number) => 46 + i * 24;

/** لون منفذ الدخل: نوع واحد بلونه، وعدة أنواع بتدرّج جمعي */
function inputBackground(accepts: string[]): string {
  if (accepts.length === 1) return PORT_META[accepts[0] as keyof typeof PORT_META].color;
  const colors = accepts.map((a) => PORT_META[a as keyof typeof PORT_META].color);
  return `linear-gradient(135deg, ${colors.join(", ")})`;
}

const inputClass =
  "nodrag w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary";

const EXT_BY_MIME: Record<string, string> = {
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** معاينة بالحجم الكامل فوق كل شيء — بوابة خارج اللوحة كي لا يحدّها تكبيرها */
function Lightbox({ media, onClose }: { media: MediaResult; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      dir="rtl"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute end-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/25"
        title="إغلاق (Esc)"
      >
        ✕ إغلاق
      </button>
      {media.mime.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt={media.label}
          className="max-h-[90vh] max-w-[94vw] rounded-xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <video
          controls
          autoPlay
          src={media.url}
          className="max-h-[90vh] max-w-[94vw] rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body
  );
}

/** ناتج وسائطي واحد: معاينة + تكبير + تنزيل + حفظ في المكتبة */
function MediaItem({
  media,
  showLabel,
  title,
  content,
  saveKind,
}: {
  media: MediaResult;
  showLabel: boolean;
  title: string;
  content?: string;
  saveKind: "tts" | "song" | "image" | "video";
}) {
  const [zoom, setZoom] = useState(false);
  const [save, setSave] = useState<"idle" | "saving" | "done">("idle");
  const [saveErr, setSaveErr] = useState("");
  const isImage = media.mime.startsWith("image/");
  const isVideo = media.mime.startsWith("video/");
  const ext = EXT_BY_MIME[media.mime] ?? (isImage ? "png" : isVideo ? "mp4" : "mp3");

  async function saveToLibrary() {
    setSave("saving");
    setSaveErr("");
    try {
      const blob = await fetch(media.url).then((r) => r.blob());
      const fd = new FormData();
      fd.append("file", new File([blob], `maqam.${ext}`, { type: media.mime }));
      fd.append("kind", saveKind);
      fd.append("title", title);
      if (content) fd.append("content", content);
      fd.append("provider", isImage || isVideo ? "gemini" : "elevenlabs");
      fd.append("settings", JSON.stringify({ studioSpace: true }));
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر الحفظ — سجّل الدخول أولاً");
      }
      setSave("done");
    } catch (e) {
      setSave("idle");
      setSaveErr(e instanceof Error ? e.message : "تعذّر الحفظ");
    }
  }

  const btn =
    "rounded-lg border border-border-soft px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:border-primary hover:text-primary";

  return (
    <div className="flex flex-col gap-1">
      {showLabel && <span className="text-[10px] font-semibold text-muted">{media.label}</span>}
      {isImage ? (
        // ناتج توليد لحظي برابط Blob محلي — مكوّن الصور المحسّنة لا يخدمه
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt={media.label}
          onClick={() => setZoom(true)}
          className="nodrag w-full cursor-zoom-in rounded-lg"
          title="اضغط للتكبير"
        />
      ) : isVideo ? (
        <video controls src={media.url} className="nodrag w-full rounded-lg" preload="metadata" />
      ) : (
        <audio controls src={media.url} className="nodrag w-full" preload="none" />
      )}
      <div className="nodrag flex flex-wrap items-center gap-1">
        {(isImage || isVideo) && (
          <button onClick={() => setZoom(true)} className={btn} title="معاينة بالحجم الكامل">
            🔍 تكبير
          </button>
        )}
        <a
          href={media.url}
          download={`maqam-${saveKind}.${ext}`}
          className={btn}
          title="تنزيل الملف إلى جهازك"
        >
          ⬇ تنزيل
        </a>
        <button
          onClick={saveToLibrary}
          disabled={save !== "idle"}
          className={`${btn} disabled:opacity-60`}
          title="حفظ في مكتبتك على المنصة"
        >
          {save === "done" ? "✓ في مكتبتك" : save === "saving" ? "جارٍ الحفظ..." : "💾 حفظ"}
        </button>
      </div>
      {saveErr && <p className="text-[10px] leading-relaxed text-primary-strong">{saveErr}</p>}
      {zoom && <Lightbox media={media} onClose={() => setZoom(false)} />}
    </div>
  );
}

export default function CardNode({ id, data }: NodeProps<CardNodeType>) {
  const def = NODE_DEFS[data.kind];
  const ports = nodePorts(data.kind, data.config);
  const { updateNodeData, deleteElements } = useReactFlow();

  const setConfig = (key: string, value: string) =>
    updateNodeData(id, { config: { ...data.config, [key]: value } });

  const cost = data.kind === "ai" ? aiModeCost(data.config) : def.cost;

  return (
    <div
      dir="rtl"
      className={`relative w-72 rounded-2xl border-2 bg-surface-card shadow-sm transition-colors ${STATUS_BORDER[data.status]}`}
    >
      {/* منافذ الدخل (يسار اللوحة) — مسماة وملونة بنوعها، والجمعي بتدرّج */}
      {ports.inputs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          style={{
            top: portTop(i),
            background: inputBackground(p.accepts),
            width: p.multi ? 15 : 12,
            height: p.multi ? 15 : 12,
            border: "2px solid var(--surface-card, #fff)",
          }}
          title={`${p.label} — يقبل: ${p.accepts
            .map((a) => PORT_META[a as keyof typeof PORT_META].label)
            .join(" / ")}${p.multi ? " (منفذ جمعي: عدة وصلات معاً)" : ""}`}
        />
      ))}
      {ports.inputs.length > 1 &&
        ports.inputs.map((p, i) => (
          <span
            key={`l-${p.id}`}
            className="pointer-events-none absolute z-10 text-[8px] font-semibold text-muted"
            style={{ left: 10, top: portTop(i) - 5 }}
          >
            {p.label}
          </span>
        ))}

      {/* منافذ الخرج (يمين اللوحة) */}
      {ports.outputs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          style={{
            top: portTop(i),
            background: PORT_META[p.type].color,
            width: 12,
            height: 12,
            border: "2px solid var(--surface-card, #fff)",
          }}
          title={`${p.label} (${PORT_META[p.type].label})`}
        />
      ))}
      {ports.outputs.length > 1 &&
        ports.outputs.map((p, i) => (
          <span
            key={`l-${p.id}`}
            className="pointer-events-none absolute z-10 text-[8px] font-semibold text-muted"
            style={{ right: 10, top: portTop(i) - 5 }}
          >
            {p.label}
          </span>
        ))}

      <div className="flex items-center justify-between rounded-t-2xl bg-surface-raised px-3 py-2">
        <p className="text-sm font-bold">
          {def.icon} {def.name}
          {cost ? <span className="mx-1.5 text-[10px] font-semibold text-gold">⚡{cost}</span> : null}
        </p>
        <div className="flex items-center gap-1.5">
          {data.status === "running" && (
            <span className="text-[10px] text-primary">{data.stage || "يعمل..."}</span>
          )}
          {data.status === "done" && <span className="text-xs text-success">✓</span>}
          <button
            onClick={() => {
              uploadStore.delete(id);
              deleteElements({ nodes: [{ id }] });
            }}
            className="nodrag text-xs text-muted transition-colors hover:text-primary"
            title="حذف البطاقة"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* إعدادات كل نوع */}
        {data.kind === "ai" && (
          <div className="flex flex-col gap-1.5">
            <select
              value={aiMode(data.config)}
              onChange={(e) => setConfig("mode", e.target.value)}
              className={inputClass}
              title="نوع الناتج — يغيّر نوع منفذ الخرج ولونه"
            >
              {AI_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon} توليد {m.name} — ⚡{m.cost}
                </option>
              ))}
            </select>
            <textarea
              value={data.config.prompt ?? ""}
              onChange={(e) => setConfig("prompt", e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="وجّه الذكاء: لخّص، حلّل، اكتب سيناريو، صمّم غلافاً، مشهداً سينمائياً..."
              className="nodrag nowheel w-full resize-y rounded-lg border border-border-soft bg-surface p-2 text-xs leading-relaxed outline-none focus:border-primary"
            />
            {aiMode(data.config) === "video" && (
              <div className="flex gap-1.5">
                <select
                  value={data.config.durationSec ?? "8"}
                  onChange={(e) => setConfig("durationSec", e.target.value)}
                  className={inputClass}
                >
                  <option value="8">٨ ثوانٍ</option>
                  <option value="6">٦ ثوانٍ</option>
                  <option value="4">٤ ثوانٍ</option>
                </select>
                <select
                  value={data.config.aspectRatio ?? "16:9"}
                  onChange={(e) => setConfig("aspectRatio", e.target.value)}
                  className={inputClass}
                >
                  <option value="16:9">أفقي 16:9</option>
                  <option value="9:16">عمودي 9:16</option>
                </select>
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-muted">
              المنفذ المتدرّج جمعي: أوصل به عدة بطاقات معاً — نصوصاً وأصواتاً وصوراً —
              فيتفاعل الذكاء مع مشروعك كله. الصورة الواصلة تصبح إطار الفيديو الافتتاحي.
            </p>
          </div>
        )}

        {data.kind === "text" && (
          <textarea
            value={data.config.text ?? ""}
            onChange={(e) => setConfig("text", e.target.value)}
            rows={4}
            maxLength={20000}
            placeholder="اكتب نصك أو فكرتك هنا..."
            className="nodrag nowheel w-full resize-y rounded-lg border border-border-soft bg-surface p-2 text-xs leading-relaxed outline-none focus:border-primary"
          />
        )}

        {data.kind === "upload" && (
          <div className="nodrag flex flex-col gap-1.5">
            <Recorder
              onAudio={(blob) => {
                uploadStore.set(id, blob);
                updateNodeData(id, { config: { ...data.config, hasAudio: "true" } });
              }}
            />
            <p className="text-[10px] leading-relaxed text-muted">
              {data.config.hasAudio === "true" ? "✓ الصوت جاهز في البطاقة. " : ""}
              الملف يعيش في هذه الجلسة فقط — حفظ المساحة يحفظ البنية لا الملفات.
            </p>
          </div>
        )}

        {data.kind === "voiceprint" && (
          <div className="flex flex-col gap-1.5">
            <input
              value={data.config.name ?? ""}
              onChange={(e) => setConfig("name", e.target.value)}
              maxLength={60}
              placeholder="اسم البصمة (بصمتي مثلاً)..."
              className={inputClass}
            />
            <label className="nodrag flex cursor-pointer items-start gap-1.5 text-[10px] leading-relaxed text-muted">
              <input
                type="checkbox"
                checked={data.config.consent === "true"}
                onChange={(e) => setConfig("consent", e.target.checked ? "true" : "")}
                className="mt-0.5"
              />
              أقرّ أن هذا صوتي أنا، أو لديّ إذن موثق من صاحبه باستنساخه.
            </label>
            <p className="text-[10px] leading-relaxed text-muted">
              أوصل عينة صوت (دقيقة تكفي) — تصبح بصمة توصلها بمنفذ 🟣 في «توليد صوت».
            </p>
          </div>
        )}

        {data.kind === "lyrics" && (
          <p className="text-[11px] leading-relaxed text-muted">
            يستلم الفكرة من البطاقة الموصولة ويكتب كلمات أغنية كاملة مشكّلة.
          </p>
        )}

        {data.kind === "enhance" && (
          <p className="text-[11px] leading-relaxed text-muted">
            تشكيل كامل + تحويل الأرقام والاختصارات لصيغتها المنطوقة — أكبر رافعة لجودة النطق.
          </p>
        )}

        {data.kind === "tts" && (
          <div className="flex flex-col gap-1.5">
            <select
              value={data.config.voiceId ?? VOICES[0].id}
              onChange={(e) => setConfig("voiceId", e.target.value)}
              className={inputClass}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.gender === "male" ? "👨" : "👩"} {v.name} — {v.dialect}
                </option>
              ))}
            </select>
            <p className="text-[10px] leading-relaxed text-muted">
              بصمة صوت موصولة بالمنفذ 🟣 تتقدم على الصوت المختار هنا.
            </p>
          </div>
        )}

        {data.kind === "song" && (
          <div className="flex flex-col gap-1.5">
            <select
              value={data.config.maqamId ?? MAQAMAT[0].id}
              onChange={(e) => setConfig("maqamId", e.target.value)}
              className={inputClass}
            >
              {MAQAMAT.map((m) => (
                <option key={m.id} value={m.id}>
                  مقام {m.name} — {m.mood}
                </option>
              ))}
            </select>
            <select
              value={data.config.styleId ?? SONG_STYLES[0].id}
              onChange={(e) => setConfig("styleId", e.target.value)}
              className={inputClass}
            >
              {SONG_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={data.config.provider ?? ""}
              onChange={(e) => setConfig("provider", e.target.value)}
              className={inputClass}
              title="أي محرك يلحّن؟ جرّب الاثنين وقارن"
            >
              <option value="">🎛️ محرك المنصة الافتراضي (Lyria)</option>
              <option value="eleven-music">🎤 Eleven Music — غناء الكلمات بوضوح</option>
              <option value="lyria">🎼 Lyria — الأقوى موسيقياً</option>
            </select>
            <p className="text-[10px] leading-relaxed text-muted">
              لحن مرجعي موصول بمنفذ «لحن مرجعي» يوجّه روح التوزيع والإيقاع.
            </p>
          </div>
        )}

        {data.kind === "music" && (
          <div className="flex flex-col gap-1.5">
            <select
              value={data.config.maqamId ?? MAQAMAT[0].id}
              onChange={(e) => setConfig("maqamId", e.target.value)}
              className={inputClass}
            >
              {MAQAMAT.map((m) => (
                <option key={m.id} value={m.id}>
                  مقام {m.name} — {m.mood}
                </option>
              ))}
            </select>
            <select
              value={data.config.styleId ?? "instrumental"}
              onChange={(e) => setConfig("styleId", e.target.value)}
              className={inputClass}
            >
              {SONG_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={data.config.durationSec ?? "30"}
              onChange={(e) => setConfig("durationSec", e.target.value)}
              className={inputClass}
            >
              <option value="30">٣٠ ثانية — تجربة سريعة</option>
              <option value="60">دقيقة كاملة</option>
              <option value="90">دقيقة ونصف</option>
            </select>
            <p className="text-[10px] leading-relaxed text-muted">
              اللحن يصدر آلياً بلا غناء أياً كان الأسلوب — للتجربة قبل إنفاق التلحين الكامل.
            </p>
          </div>
        )}

        {data.kind === "split" && (
          <p className="text-[11px] leading-relaxed text-muted">
            الغناء يُعزل عبر عازل المنصة، والموسيقى بإلغاء القناة الوسطى محلياً في متصفحك
            (تحتاج ملفاً ستيريو) — خرجان مستقلان تعيد استخدام أيّ منهما.
          </p>
        )}

        {data.kind === "isolate" && (
          <p className="text-[11px] leading-relaxed text-muted">
            يستلم الصوت الموصول ويعيده نقياً بلا ضجيج ولا خلفية.
          </p>
        )}

        {data.kind === "stt" && (
          <p className="text-[11px] leading-relaxed text-muted">
            يستلم صوتاً ويعيده نصاً مكتوباً — الجسر بين المنافذ الذهبية والزرقاء:
            صوت ← تفريغ ← تلحين مثلاً.
          </p>
        )}

        {data.kind === "save" && (
          <input
            value={data.config.title ?? ""}
            onChange={(e) => setConfig("title", e.target.value)}
            maxLength={120}
            placeholder="عنوان العمل في المكتبة..."
            className={inputClass}
          />
        )}

        {/* الخطأ */}
        {data.status === "error" && data.error && (
          <p className="rounded-lg border border-primary/40 bg-rose px-2 py-1.5 text-[11px] leading-relaxed text-primary-strong">
            {data.error}
          </p>
        )}

        {/* تنبيه الشفافية — رجوع تجريبي أو ملاحظة من المحرك */}
        {data.note && data.status === "done" && (
          <p className="rounded-lg border border-gold/50 bg-gold/10 px-2 py-1.5 text-[11px] leading-relaxed">
            {data.note}
          </p>
        )}

        {/* الناتج */}
        {data.resultText !== undefined && data.status === "done" && (
          <textarea
            value={data.resultText}
            onChange={(e) => updateNodeData(id, { resultText: e.target.value })}
            rows={5}
            className="nodrag nowheel w-full resize-y rounded-lg border border-success/40 bg-surface p-2 text-xs leading-relaxed outline-none"
            title="الناتج — يمكنك تعديله قبل تشغيل ما بعده"
          />
        )}
        {data.status === "done" &&
          data.media?.map((m) => (
            <MediaItem
              key={m.url}
              media={m}
              showLabel={data.media!.length > 1}
              title={
                m.mime.startsWith("image/")
                  ? "صورة من ذكاء مقام"
                  : m.mime.startsWith("video/")
                    ? "فيديو من ذكاء مقام"
                    : `${def.name}${data.media!.length > 1 ? ` — ${m.label}` : ""} (مساحة مقام)`
              }
              content={data.kind === "ai" ? data.config.prompt : undefined}
              saveKind={
                m.mime.startsWith("image/")
                  ? "image"
                  : m.mime.startsWith("video/")
                    ? "video"
                    : data.kind === "song" || data.kind === "music"
                      ? "song"
                      : "tts"
              }
            />
          ))}
        {data.kind === "save" && data.status === "done" && (
          <p className="text-[11px] font-semibold text-success">✓ حُفظ في مكتبتك</p>
        )}
      </div>
    </div>
  );
}
