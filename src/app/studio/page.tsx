"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import WaveLine from "@/components/WaveLine";
import MemberNotice from "@/components/MemberNotice";
import CardNode, {
  type CardData,
  type CardNodeType,
  type MediaResult,
} from "@/components/studio/CardNode";
import {
  NODE_DEFS,
  PORT_META,
  aiMode,
  canConnect,
  executionLayers,
  nodePorts,
  resolveInput,
  resolveOutput,
  type NodeKind,
} from "@/lib/studio/graph";
import { uploadStore } from "@/lib/studio/uploads";
import { extractInstrumental } from "@/lib/stems";
import { SPACE_TEMPLATES, type SpaceTemplate } from "@/lib/studio/templates";
import { MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";

const nodeTypes = { card: CardNode };

/** ناتج منفذ واحد — نص أو صوت/صورة/فيديو أو بصمة صوت */
type RunOutput = { text?: string; blob?: Blob; voiceId?: string; note?: string };

/** ناتج تشغيل بطاقة: قيمة لكل منفذ خرج + ملاحظة شفافية للعرض */
type NodeResult = { ports: Record<string, RunOutput>; note?: string };

/** مدخلات بطاقة مجمعة حسب منفذ الدخل — المنفذ الجمعي يحمل عدة قيم مرتبة */
type NodeInputs = Map<string, RunOutput[]>;

let nextId = 1;
const newId = () => `n${Date.now().toString(36)}${nextId++}`;

function makeNode(kind: NodeKind, x: number, y: number, config: Record<string, string> = {}): CardNodeType {
  return { id: newId(), type: "card", position: { x, y }, data: { kind, config, status: "idle" } };
}

export default function StudioSpace() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [running, setRunning] = useState(false);
  const [flowError, setFlowError] = useState("");
  // شرح فوري لسبب رفض الربط — بدل حيرة «الوصلة ما بتشبك»
  const [connectHint, setConnectHint] = useState("");
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [savedSpaces, setSavedSpaces] = useState<string[]>([]);
  const urlsRef = useRef<string[]>([]);

  // قائمة المساحات المحفوظة محلياً
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setSavedSpaces(Object.keys(JSON.parse(localStorage.getItem("maqam-spaces") ?? "{}")));
      } catch {
        /* تجاهل */
      }
    }, 0);
    const urls = urlsRef.current;
    return () => {
      clearTimeout(t);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const showHint = useCallback((msg: string) => {
    setConnectHint((prev) => (prev === msg ? prev : msg));
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setConnectHint(""), 8000);
  }, []);

  /** الربط على مستوى المنفذ: توافق النوع + سعة المنفذ — مع شرح فوري عند الرفض */
  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!src || !tgt || conn.source === conn.target) return false;

      const srcRef = { kind: src.data.kind, config: src.data.config, handle: conn.sourceHandle };
      const tgtRef = { kind: tgt.data.kind, config: tgt.data.config, handle: conn.targetHandle };

      if (!canConnect(srcRef, tgtRef)) {
        const out = resolveOutput(srcRef);
        const inp = resolveInput(tgtRef);
        const outName = out ? `${PORT_META[out.type].label} ${PORT_META[out.type].chip}` : "لا شيء";
        const inName = inp
          ? inp.accepts.map((a) => `${PORT_META[a].label} ${PORT_META[a].chip}`).join(" أو ")
          : "لا شيء";
        showHint(
          `«${NODE_DEFS[src.data.kind].name}» يُخرج ${outName} بينما هذا المنفذ في «${NODE_DEFS[tgt.data.kind].name}» يستقبل ${inName} — ` +
            (out?.type === "audio" && inp?.accepts.includes("text")
              ? "ضع بطاقة «📜 تفريغ نصي» بينهما كجسر، أو أوصل الهدف بمصدر النص نفسه مباشرة."
              : "أوصل منفذين متوافقي اللون.")
        );
        return false;
      }

      // سعة المنفذ: الجمعي يقبل عدة وصلات، وسواه وصلة واحدة
      const inp = resolveInput(tgtRef)!;
      if (!inp.multi) {
        const firstIn = nodePorts(tgt.data.kind, tgt.data.config).inputs[0]?.id;
        const occupied = edges.some(
          (e) => e.target === conn.target && (e.targetHandle ?? firstIn) === inp.id
        );
        if (occupied) {
          showHint(
            `منفذ «${inp.label}» يقبل وصلة واحدة — احذف القديمة أولاً (حددها واضغط Delete). المنفذ المتدرّج في بطاقة الذكاء هو الجمعي.`
          );
          return false;
        }
      }
      return true;
    },
    [nodes, edges, showHint]
  );

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) => addEdge({ ...conn, animated: true, style: { strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  /** أُفلتت الوصلة في الفراغ: دليل فوري بكل الوجهات المتوافقة بدل الحيرة */
  const onConnectEnd: OnConnectEnd = useCallback(
    (_event, state) => {
      if (state.isValid || !state.fromNode || state.toNode) return;
      const data = state.fromNode.data as { kind?: NodeKind; config?: Record<string, string> };
      if (!data?.kind) return;
      const ref = { kind: data.kind, config: data.config, handle: state.fromHandle?.id };

      if (state.fromHandle?.type === "source") {
        const out = resolveOutput(ref);
        if (!out) return;
        const targets = [
          ...new Set(
            Object.values(NODE_DEFS).flatMap((d) =>
              d.inputs
                .filter((p) => p.accepts.includes(out.type))
                .map((p) => (d.inputs.length > 1 ? `«${d.name}» (منفذ ${p.label})` : `«${d.name}»`))
            )
          ),
        ];
        showHint(
          `خرج «${NODE_DEFS[data.kind].name}» ${PORT_META[out.type].chip} ${PORT_META[out.type].label} يوصَل بـ: ${targets.join(
            "، "
          )}. أفلت الوصلة قرب النقطة الملونة المتوافقة — تلتقط وحدها من مسافة قريبة.`
        );
      } else {
        const inp = resolveInput(ref);
        if (!inp) return;
        const sources = [
          ...new Set(
            Object.values(NODE_DEFS)
              .filter((d) => d.outputs.some((o) => inp.accepts.includes(o.type)))
              .map((d) => `«${d.name}»`)
          ),
        ];
        showHint(
          `منفذ «${inp.label}» في «${NODE_DEFS[data.kind].name}» يستقبل من: ${sources.join("، ")}.`
        );
      }
    },
    [showHint]
  );

  function addCard(kind: NodeKind) {
    const offset = nodes.length * 24;
    setNodes((ns) => [...ns, makeNode(kind, 80 + (offset % 240), 60 + (offset % 320))]);
  }

  function loadTemplate(t: SpaceTemplate) {
    const idMap = new Map<string, string>();
    const newNodes = t.nodes.map((n) => {
      const node = makeNode(n.kind, n.x, n.y, n.config ?? {});
      idMap.set(n.id, node.id);
      return node;
    });
    const newEdges: Edge[] = t.edges.map((e) => ({
      id: newId(),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      ...(e.sourceHandle && { sourceHandle: e.sourceHandle }),
      ...(e.targetHandle && { targetHandle: e.targetHandle }),
      animated: true,
      style: { strokeWidth: 2 },
    }));
    setNodes(newNodes);
    setEdges(newEdges);
    setFlowError("");
  }

  const patchNode = useCallback(
    (id: string, patch: Partial<CardData>) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    [setNodes]
  );

  /** إنشاء مهمة تلحين/موسيقى واستعلامها حتى الاكتمال — مشترك بين البطاقتين */
  async function runSongJob(nodeId: string, body: Record<string, unknown>): Promise<RunOutput> {
    const createRes = await fetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
    const created = await createRes.json().catch(() => null);
    if (!createRes.ok) throw new Error(created?.error ?? "تعذّر بدء التوليد");
    const jobId = created?.jobId;
    if (!jobId) throw new Error("لم تُنشأ مهمة التوليد");

    // استعلام دوري حتى الاكتمال — التلحين يستغرق دقيقة إلى ثلاث
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      const st = await fetch(`/api/songs/${jobId}`).then((r) => r.json()).catch(() => null);
      if (!st) continue;
      if (st.stage) patchNode(nodeId, { stage: st.stage });
      if (st.status === "failed") throw new Error(st.error ?? "فشل التوليد");
      if (st.status === "done") {
        const audio = await fetch(`/api/songs/${jobId}/audio`);
        if (!audio.ok) throw new Error("تعذّر جلب الناتج");
        // شفافية كاملة: الرجوع التجريبي لا يمر صامتاً — يظهر سببه على البطاقة
        const note = st.mock
          ? `⚠️ هذا سلّم تجريبي لا أغنية — رفض محرك التوليد الطلب أو تعذّر${st.fellBack ? ` (${st.fellBack})` : ""}. جرّب تعديل الكلمات أو محركاً آخر من قائمة البطاقة.`
          : st.fellBack
            ? `ملاحظة: تحوّل التوليد لمحرك بديل (${st.fellBack})`
            : undefined;
        return { blob: await audio.blob(), note };
      }
    }
    throw new Error("انتهت مهلة الانتظار — جرّب من استوديو الأغاني");
  }

  /** لحن مرجعي موصول ← موجز أسلوبي من أذن المنصة يقود التلحين */
  async function melodyBrief(
    melody: Blob
  ): Promise<{ aiStylePrompt: string; bpm?: number; note: string }> {
    const fd = new FormData();
    fd.append("audio", melody, "melody.mp3");
    const res = await fetch("/api/studio/brief", {
      method: "POST",
      headers: await authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل اللحن المرجعي");
    return {
      aiStylePrompt: data.stylePromptEn,
      ...(data.bpm && { bpm: data.bpm }),
      note: `🎧 استُلهم اللحن المرجعي: ${data.descriptionAr ?? ""}`,
    };
  }

  /** تشغيل بطاقة واحدة حسب نوعها — مدخلاتها مجمعة حسب منافذها المسماة */
  async function runNode(node: CardNodeType, inputs: NodeInputs): Promise<NodeResult> {
    const cfg = node.data.config;
    const kind = node.data.kind;
    const first = (portId: string) => inputs.get(portId)?.[0];
    const out = (o: RunOutput, note?: string): NodeResult => ({ ports: { [nodePorts(kind, cfg).outputs[0]?.id ?? "out"]: o }, note: note ?? o.note });

    if (kind === "text") {
      const text = (cfg.text ?? "").trim();
      if (!text) throw new Error("اكتب النص في البطاقة أولاً");
      return out({ text });
    }

    if (kind === "upload") {
      const blob = uploadStore.get(node.id);
      if (!blob) throw new Error("ارفع ملفاً أو سجّل صوتاً في البطاقة أولاً");
      return out({ blob });
    }

    if (kind === "voiceprint") {
      const sample = first("in")?.blob;
      if (!sample) throw new Error("أوصل عينة صوت أولاً (بطاقة «صوت من عندك» مثلاً)");
      if (cfg.consent !== "true") {
        throw new Error("علّم خانة الإقرار أولاً: أن الصوت صوتك أو مأذون لك باستنساخه");
      }
      const name = (cfg.name ?? "").trim() || "بصمة من المساحة";
      const fd = new FormData();
      fd.append("name", name);
      fd.append("consent", "true");
      fd.append("samples", sample, "sample.mp3");
      const res = await fetch("/api/voices/clone", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر إنشاء البصمة");
      if (!data?.voiceId) throw new Error("لم تُنشأ البصمة");
      return out({ voiceId: data.voiceId }, `🧬 بصمة «${name}» جاهزة — أوصلها بمنفذ 🟣 في «توليد صوت»`);
    }

    if (kind === "lyrics") {
      const idea = first("in")?.text?.trim();
      if (!idea) throw new Error("أوصل بطاقة نص بالفكرة أولاً");
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mode: "write", idea: idea.slice(0, 500) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت كتابة الكلمات");
      if (!data?.lyrics) throw new Error("لم يُعد المساعد كلمات");
      return out({ text: data.lyrics });
    }

    if (kind === "enhance") {
      const text = first("in")?.text?.trim();
      if (!text) throw new Error("أوصل بطاقة نص أولاً");
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التشكيل");
      return out({ text: data.enhanced ?? text });
    }

    if (kind === "tts") {
      const text = first("in")?.text?.trim();
      if (!text) throw new Error("أوصل بطاقة نص أولاً");
      // بصمة موصولة تتقدم على الصوت المختار من القائمة
      const voiceId = first("voice")?.voiceId ?? cfg.voiceId ?? VOICES[0].id;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text, voiceId, expressive: true, styleId: "auto" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر توليد الصوت");
      }
      const note =
        res.headers.get("X-Mock") === "1"
          ? "⚠️ نغمة تجريبية لا صوت حقيقي — محرك النطق غير متاح حالياً"
          : first("voice")?.voiceId
            ? "🧬 نُطق ببصمة الصوت الموصولة"
            : undefined;
      return out({ blob: await res.blob() }, note);
    }

    if (kind === "sfx") {
      // الوصف من بطاقة نص موصولة، أو من حقل البطاقة نفسها
      const prompt = (first("in")?.text ?? cfg.prompt ?? "").trim();
      if (!prompt) throw new Error("صف المؤثر في البطاقة أو أوصل بطاقة نص بالوصف");
      const durationSec = Number(cfg.durationSec);
      const res = await fetch("/api/sfx", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          prompt: prompt.slice(0, 450),
          ...(Number.isFinite(durationSec) && durationSec > 0 && { durationSec }),
          loop: cfg.loop === "true",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر توليد المؤثر");
      }
      return out(
        { blob: await res.blob() },
        cfg.loop === "true" ? "🔁 مؤثر حلقي — يصلح خلفية مستمرة" : undefined
      );
    }

    if (kind === "song") {
      const lyrics = first("in")?.text?.trim();
      if (!lyrics) throw new Error("أوصل بطاقة كلمات أولاً");
      const melody = first("melody")?.blob;
      const brief = melody ? await melodyBrief(melody) : null;
      const result = await runSongJob(node.id, {
        maqamId: cfg.maqamId ?? MAQAMAT[0].id,
        styleId: cfg.styleId ?? SONG_STYLES[0].id,
        lyrics,
        instrumentIds: [],
        // اختيار المحرك من البطاقة — Eleven Music يغني الكلمات بوضوح أعلى
        ...(cfg.provider && { provider: cfg.provider }),
        ...(brief && { aiStylePrompt: brief.aiStylePrompt }),
        ...(brief?.bpm && { bpm: brief.bpm }),
      });
      return out(result, [brief?.note, result.note].filter(Boolean).join("\n") || undefined);
    }

    if (kind === "music") {
      const melody = first("melody")?.blob;
      const brief = melody ? await melodyBrief(melody) : null;
      // بلا كلمات = لحن آلي خالص، والأسلوب يلوّن طابع اللحن
      const result = await runSongJob(node.id, {
        maqamId: cfg.maqamId ?? MAQAMAT[0].id,
        styleId: cfg.styleId ?? "instrumental",
        durationSec: Number(cfg.durationSec ?? 30) || 30,
        instrumentIds: [],
        ...(brief && { aiStylePrompt: brief.aiStylePrompt }),
        ...(brief?.bpm && { bpm: brief.bpm }),
      });
      return out(result, [brief?.note, result.note].filter(Boolean).join("\n") || undefined);
    }

    if (kind === "split") {
      const song = first("in")?.blob;
      if (!song) throw new Error("أوصل الأغنية أولاً (بطاقة «صوت من عندك» مثلاً)");
      // مساران متوازيان: الغناء عبر العازل، والموسيقى محلياً بإلغاء الوسط
      const [vocals, inst] = await Promise.allSettled([
        (async () => {
          const fd = new FormData();
          fd.append("audio", song, "song.mp3");
          const res = await fetch("/api/isolate", {
            method: "POST",
            headers: await authHeaders(),
            body: fd,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? "تعذّر عزل الغناء");
          }
          return res.blob();
        })(),
        extractInstrumental(song),
      ]);

      const ports: Record<string, RunOutput> = {};
      const problems: string[] = [];
      if (vocals.status === "fulfilled") ports.vocals = { blob: vocals.value };
      else problems.push(`الغناء: ${vocals.reason instanceof Error ? vocals.reason.message : "تعذّر"}`);
      if (inst.status === "fulfilled") ports.inst = { blob: inst.value };
      else problems.push(`الموسيقى: ${inst.reason instanceof Error ? inst.reason.message : "تعذّر"}`);

      if (!Object.keys(ports).length) throw new Error(problems.join(" • "));
      return { ports, note: problems.length ? `⚠️ اكتمل جزئياً — ${problems.join(" • ")}` : undefined };
    }

    if (kind === "ai") {
      const mode = aiMode(cfg);
      const prompt = (cfg.prompt ?? "").trim();
      if (!prompt) throw new Error("اكتب توجيهك في بطاقة الذكاء أولاً");

      // التغذية الجمعية: كل ما وصل للمنفذ — نصوص ووسائط بترتيب الوصل
      const ctx = inputs.get("ctx") ?? [];
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("prompt", prompt);
      fd.append(
        "texts",
        JSON.stringify(ctx.filter((o) => o.text !== undefined).map((o) => o.text))
      );
      for (const o of ctx) {
        if (!o.blob) continue;
        const field = o.blob.type.startsWith("image/")
          ? "image"
          : o.blob.type.startsWith("video/")
            ? "video"
            : "audio";
        fd.append(field, o.blob, `ctx.${field}`);
      }
      if (mode === "video") {
        fd.append("durationSec", cfg.durationSec ?? "8");
        fd.append("aspectRatio", cfg.aspectRatio ?? "16:9");
      }

      patchNode(node.id, {
        stage: mode === "video" ? "يولّد الفيديو (قد يستغرق دقائق)..." : "يفكر...",
      });
      const res = await fetch("/api/studio/ai", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد");
      }
      if (mode === "text") {
        const data = await res.json();
        return out({ text: data.text });
      }
      return out({ blob: await res.blob() });
    }

    if (kind === "isolate") {
      const audio = first("in")?.blob;
      if (!audio) throw new Error("أوصل بطاقة صوت أولاً");
      const fd = new FormData();
      fd.append("audio", audio, "audio.mp3");
      const res = await fetch("/api/isolate", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر العزل");
      }
      return out({ blob: await res.blob() });
    }

    if (kind === "stt") {
      const audio = first("in")?.blob;
      if (!audio) throw new Error("أوصل بطاقة صوت أولاً");
      const fd = new FormData();
      fd.append("audio", audio, "audio.mp3");
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التفريغ");
      if (!data?.text) throw new Error("لم يُعد التفريغ نصاً");
      return out({ text: data.text });
    }

    // save
    const audio = first("in")?.blob;
    if (!audio) throw new Error("أوصل بطاقة صوت أولاً");
    const fd = new FormData();
    const ext = audio.type === "audio/wav" ? "wav" : "mp3";
    fd.append("file", new File([audio], `maqam-space.${ext}`, { type: audio.type }));
    fd.append("kind", "tts");
    fd.append("title", cfg.title?.trim() || "عمل من مساحة مقام");
    fd.append("provider", "elevenlabs");
    fd.append("settings", JSON.stringify({ studioSpace: true }));
    const res = await fetch("/api/generations", {
      method: "POST",
      headers: await authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "تعذّر الحفظ — سجّل الدخول أولاً");
    return { ports: {} };
  }

  /**
   * تشغيل المساحة بموجات متوازية: كل موجة بطاقات مدخلاتها جاهزة تعمل معاً —
   * الفروع المستقلة لا تنتظر بعضها، وفشل فرع لا يوقف البقية.
   */
  async function runFlow() {
    setFlowError("");
    if (!nodes.length) {
      setFlowError("أضف بطاقات أولاً — أو ابدأ من قالب جاهز");
      return;
    }
    const graphEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    const layers = executionLayers(
      nodes.map((n) => ({ id: n.id, kind: n.data.kind })),
      graphEdges
    );
    if (!layers) {
      setFlowError("الربط فيه دورة مغلقة — فك الحلقة أولاً");
      return;
    }

    setRunning(true);
    // تصفير الحالات
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        data: { ...n.data, status: "idle" as const, error: undefined, stage: undefined },
      }))
    );

    // النواتج بمفتاح «بطاقة:منفذ» — بطاقة الفصل مثلاً تملأ منفذين
    const outputs = new Map<string, RunOutput>();
    const failed = new Set<string>();

    for (const layer of layers) {
      await Promise.all(
        layer.map(async (id) => {
          const node = nodes.find((n) => n.id === id);
          if (!node) return;
          const ports = nodePorts(node.data.kind, node.data.config);
          const firstIn = ports.inputs[0]?.id;

          // تجميع المدخلات حسب المنفذ — وصلة قديمة بلا مقبض تُنسب للمنفذ الأول
          const inputMap: NodeInputs = new Map();
          let blocked = false;
          for (const port of ports.inputs) {
            const values: RunOutput[] = [];
            for (const e of graphEdges) {
              if (e.target !== id || (e.targetHandle ?? firstIn) !== port.id) continue;
              if (failed.has(e.source)) {
                patchNode(id, { status: "error", error: "تعطل المصدر قبلها" });
                failed.add(id);
                blocked = true;
                break;
              }
              const srcNode = nodes.find((n) => n.id === e.source);
              if (!srcNode) continue;
              const srcFirst = nodePorts(srcNode.data.kind, srcNode.data.config).outputs[0]?.id;
              const val = outputs.get(`${e.source}:${e.sourceHandle ?? srcFirst}`);
              if (val) values.push(val);
            }
            if (blocked) break;
            if (!values.length && !port.optional) {
              patchNode(id, {
                status: "error",
                error: ports.inputs.length > 1 ? `منفذ «${port.label}» غير موصول بمصدر` : "البطاقة غير موصولة بمصدر",
              });
              failed.add(id);
              blocked = true;
              break;
            }
            inputMap.set(port.id, values);
          }
          if (blocked) return;

          patchNode(id, { status: "running" });
          try {
            const result = await runNode(node, inputMap);
            const media: MediaResult[] = [];
            let resultText: string | undefined;
            for (const [portId, value] of Object.entries(result.ports)) {
              outputs.set(`${id}:${portId}`, value);
              if (value.text !== undefined && resultText === undefined) resultText = value.text;
              if (value.blob) {
                const url = URL.createObjectURL(value.blob);
                urlsRef.current.push(url);
                const label = ports.outputs.find((o) => o.id === portId)?.label ?? portId;
                media.push({ label, url, mime: value.blob.type || "audio/mpeg" });
              }
            }
            patchNode(id, {
              status: "done",
              stage: undefined,
              ...(resultText !== undefined && { resultText }),
              media: media.length ? media : undefined,
              note: result.note,
            });
          } catch (e) {
            patchNode(id, {
              status: "error",
              stage: undefined,
              error: e instanceof Error ? e.message : "خطأ غير متوقع",
            });
            failed.add(id);
          }
        })
      );
    }
    setRunning(false);
  }

  /** حفظ واستدعاء المساحات محلياً — البنية فقط (المواضع والإعدادات والروابط) */
  function saveSpace() {
    const name = spaceName.trim();
    if (!name) return;
    try {
      const all = JSON.parse(localStorage.getItem("maqam-spaces") ?? "{}");
      all[name] = {
        nodes: nodes.map((n) => ({
          id: n.id,
          kind: n.data.kind,
          x: n.position.x,
          y: n.position.y,
          config: n.data.config,
        })),
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          ...(e.sourceHandle && { sourceHandle: e.sourceHandle }),
          ...(e.targetHandle && { targetHandle: e.targetHandle }),
        })),
      };
      localStorage.setItem("maqam-spaces", JSON.stringify(all));
      setSavedSpaces(Object.keys(all));
      setSpaceName("");
    } catch {
      setFlowError("تعذّر الحفظ محلياً");
    }
  }

  function loadSpace(name: string) {
    try {
      const all = JSON.parse(localStorage.getItem("maqam-spaces") ?? "{}");
      const space = all[name];
      if (!space) return;
      loadTemplate({ id: name, name, icon: "📂", desc: "", nodes: space.nodes, edges: space.edges });
    } catch {
      /* تجاهل */
    }
  }

  function deleteSpace(name: string) {
    try {
      const all = JSON.parse(localStorage.getItem("maqam-spaces") ?? "{}");
      delete all[name];
      localStorage.setItem("maqam-spaces", JSON.stringify(all));
      setSavedSpaces(Object.keys(all));
    } catch {
      /* تجاهل */
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        مساحة <span className="text-gradient">مقام</span>
      </h1>
      <WaveLine className="mt-3" />
      <MemberNotice />
      <p className="mt-2 max-w-3xl leading-relaxed text-muted">
        ركّب خط إنتاجك بنفسك: بطاقات تتوصل ببعضها بالسحب، وكل منفذ ملون بنوعه —
        🔵 نص، 🟡 صوت، 🟣 بصمة صوت، 🟢 صورة، 🌸 فيديو — والأنواع غير المتوافقة ترفض الاتصال.
        المنفذ المتدرّج في بطاقة الذكاء جمعي: عدة بطاقات تغذيه معاً. اضغط ▶ وتعمل الفروع
        المستقلة بالتوازي.
      </p>

      {/* شريط الأدوات */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={runFlow}
          disabled={running}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
        >
          {running ? "⏳ يعمل..." : "▶ شغّل المساحة"}
        </button>
        <span className="mx-1 h-6 w-px bg-border-soft" />
        {(Object.keys(NODE_DEFS) as NodeKind[]).map((k) => (
          <button
            key={k}
            onClick={() => addCard(k)}
            title={NODE_DEFS[k].desc}
            className="rounded-xl border border-border-soft px-3 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {NODE_DEFS[k].icon} {NODE_DEFS[k].name}
          </button>
        ))}
      </div>

      {/* القوالب والمساحات المحفوظة */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-muted">قوالب:</span>
        {SPACE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => loadTemplate(t)}
            title={t.desc}
            className="rounded-lg border border-gold/50 px-2.5 py-1.5 font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            {t.icon} {t.name}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border-soft" />
        {savedSpaces.map((name) => (
          <span key={name} className="inline-flex items-center overflow-hidden rounded-lg border border-border-soft">
            <button onClick={() => loadSpace(name)} className="px-2 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary">
              📂 {name}
            </button>
            <button onClick={() => deleteSpace(name)} className="border-s border-border-soft px-1.5 py-1.5 text-muted hover:text-primary" title="حذف">
              ✕
            </button>
          </span>
        ))}
        <input
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          maxLength={30}
          placeholder="اسم المساحة..."
          className="w-32 rounded-lg border border-border-soft bg-surface-card px-2 py-1.5 outline-none focus:border-primary"
        />
        <button
          onClick={saveSpace}
          disabled={!spaceName.trim() || !nodes.length}
          className="rounded-lg border border-primary px-2.5 py-1.5 font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
        >
          💾 احفظ المساحة
        </button>
      </div>

      {flowError && (
        <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-2.5 text-sm text-primary-strong">
          {flowError}
        </p>
      )}
      {connectHint && (
        <p className="mt-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-2.5 text-sm leading-relaxed">
          💡 {connectHint}
        </p>
      )}

      {/* اللوحة — اتجاه LTR داخلي لاستقرار الإحداثيات، والبطاقات نفسها RTL */}
      <div dir="ltr" className="mt-4 h-[70vh] overflow-hidden rounded-3xl border border-border-soft bg-surface-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          // الالتقاط بالقرب: إفلات الوصلة قرب المنفذ يكفي — لا حاجة لإصابة 12 بكسل
          connectionRadius={48}
          deleteKeyCode={["Delete", "Backspace"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        💡 جرّب: سجّل صوتك ← بصمة صوت ← «توليد صوت» ينطق أي نص ببصمتك. أو ارفع أغنية ←
        «فصل الأغنية» يعيدها غناءً وحده وموسيقى وحدها. وبطاقة «🧞 ذكاء مقام» تستقبل عدة
        بطاقات معاً على منفذها الجمعي — نصوصاً وأصواتاً وصوراً — وتولّد نصاً أو صورة أو
        فيديو. الناتج النصي لأي بطاقة قابل للتعديل قبل إعادة التشغيل، وتكاليف النقاط على
        البطاقات المدفوعة (⚡).
      </p>
    </div>
  );
}
