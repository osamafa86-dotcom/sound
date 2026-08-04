"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { NODE_DEFS, type NodeKind, type PortType } from "@/lib/studio/graph";
import { MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

/** بيانات البطاقة داخل المخطط — الإعدادات والحالة والناتج */
export type CardData = {
  kind: NodeKind;
  config: Record<string, string>;
  status: "idle" | "running" | "done" | "error";
  stage?: string;
  error?: string;
  resultText?: string;
  resultUrl?: string;
};

export type CardNodeType = Node<CardData, "card">;

/** ألوان المنافذ حسب النوع — النص أزرق والصوت ذهبي */
const PORT_COLORS: Record<PortType, string> = {
  text: "#3b82f6",
  audio: "#d9a441",
};

const STATUS_BORDER: Record<CardData["status"], string> = {
  idle: "border-border-soft",
  running: "border-primary animate-pulse",
  done: "border-success",
  error: "border-primary-strong",
};

export default function CardNode({ id, data }: NodeProps<CardNodeType>) {
  const def = NODE_DEFS[data.kind];
  const { updateNodeData, deleteElements } = useReactFlow();

  const setConfig = (key: string, value: string) =>
    updateNodeData(id, { config: { ...data.config, [key]: value } });

  return (
    <div
      dir="rtl"
      className={`w-72 rounded-2xl border-2 bg-surface-card shadow-sm transition-colors ${STATUS_BORDER[data.status]}`}
    >
      {/* منفذا الدخل والخرج — بألوان النوع */}
      {def.input && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: PORT_COLORS[def.input], width: 12, height: 12 }}
        />
      )}
      {def.output && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: PORT_COLORS[def.output], width: 12, height: 12 }}
        />
      )}

      <div className="flex items-center justify-between rounded-t-2xl bg-surface-raised px-3 py-2">
        <p className="text-sm font-bold">
          {def.icon} {def.name}
          {def.cost ? <span className="mx-1.5 text-[10px] font-semibold text-gold">⚡{def.cost}</span> : null}
        </p>
        <div className="flex items-center gap-1.5">
          {data.status === "running" && (
            <span className="text-[10px] text-primary">{data.stage || "يعمل..."}</span>
          )}
          {data.status === "done" && <span className="text-xs text-success">✓</span>}
          <button
            onClick={() => deleteElements({ nodes: [{ id }] })}
            className="nodrag text-xs text-muted transition-colors hover:text-primary"
            title="حذف البطاقة"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* إعدادات كل نوع */}
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
          <select
            value={data.config.voiceId ?? VOICES[0].id}
            onChange={(e) => setConfig("voiceId", e.target.value)}
            className="nodrag w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.gender === "male" ? "👨" : "👩"} {v.name} — {v.dialect}
              </option>
            ))}
          </select>
        )}

        {data.kind === "song" && (
          <div className="flex flex-col gap-1.5">
            <select
              value={data.config.maqamId ?? MAQAMAT[0].id}
              onChange={(e) => setConfig("maqamId", e.target.value)}
              className="nodrag w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary"
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
              className="nodrag w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              {SONG_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {data.kind === "isolate" && (
          <p className="text-[11px] leading-relaxed text-muted">
            يستلم الصوت الموصول ويعيده نقياً بلا ضجيج ولا خلفية.
          </p>
        )}

        {data.kind === "save" && (
          <input
            value={data.config.title ?? ""}
            onChange={(e) => setConfig("title", e.target.value)}
            maxLength={120}
            placeholder="عنوان العمل في المكتبة..."
            className="nodrag w-full rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-xs outline-none focus:border-primary"
          />
        )}

        {/* الخطأ */}
        {data.status === "error" && data.error && (
          <p className="rounded-lg border border-primary/40 bg-rose px-2 py-1.5 text-[11px] leading-relaxed text-primary-strong">
            {data.error}
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
        {data.resultUrl && data.status === "done" && (
          <audio controls src={data.resultUrl} className="nodrag w-full" preload="none" />
        )}
        {data.kind === "save" && data.status === "done" && (
          <p className="text-[11px] font-semibold text-success">✓ حُفظ في مكتبتك</p>
        )}
      </div>
    </div>
  );
}
