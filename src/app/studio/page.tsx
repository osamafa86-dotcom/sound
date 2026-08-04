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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import WaveLine from "@/components/WaveLine";
import MemberNotice from "@/components/MemberNotice";
import CardNode, { type CardData, type CardNodeType } from "@/components/studio/CardNode";
import {
  NODE_DEFS,
  canConnect,
  executionOrder,
  inputSourceOf,
  type NodeKind,
} from "@/lib/studio/graph";
import { SPACE_TEMPLATES, type SpaceTemplate } from "@/lib/studio/templates";
import { MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";

const nodeTypes = { card: CardNode };

/** ناتج تشغيل بطاقة — نص أو صوت، مع تنبيه شفافية عند الرجوع التجريبي */
type RunOutput = { text?: string; blob?: Blob; note?: string };

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
    hintTimer.current = setTimeout(() => setConnectHint(""), 7000);
  }, []);

  /** الربط: توافق الأنواع + منفذ دخل واحد لكل بطاقة — مع شرح فوري عند الرفض */
  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!src || !tgt || conn.source === conn.target) return false;

      if (!canConnect(src.data.kind, tgt.data.kind)) {
        const srcDef = NODE_DEFS[src.data.kind];
        const tgtDef = NODE_DEFS[tgt.data.kind];
        const typeName = (t: "text" | "audio" | null) =>
          t === "text" ? "نصاً 🔵" : t === "audio" ? "صوتاً 🟡" : "لا شيء";
        showHint(
          `«${srcDef.name}» يُخرج ${typeName(srcDef.output)} بينما «${tgtDef.name}» يستقبل ${typeName(tgtDef.input)} — ` +
            (srcDef.output === "audio" && tgtDef.input === "text"
              ? `ضع بطاقة «📜 تفريغ نصي» بينهما كجسر، أو أوصل «${tgtDef.name}» بمصدر النص نفسه مباشرة (التفريع مسموح).`
              : "أوصل منفذين من نفس اللون.")
        );
        return false;
      }

      if (edges.some((e) => e.target === conn.target)) {
        showHint("لكل بطاقة مدخل واحد — احذف الوصلة القديمة أولاً (حددها واضغط Delete).");
        return false;
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

  /** تشغيل بطاقة واحدة حسب نوعها — يستدعي واجهات المنصة القائمة */
  async function runNode(node: CardNodeType, input: RunOutput | undefined): Promise<RunOutput> {
    const cfg = node.data.config;
    const kind = node.data.kind;

    if (kind === "text") {
      const text = (cfg.text ?? "").trim();
      if (!text) throw new Error("اكتب النص في البطاقة أولاً");
      return { text };
    }

    if (kind === "lyrics") {
      const idea = input?.text?.trim();
      if (!idea) throw new Error("أوصل بطاقة نص بالفكرة أولاً");
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mode: "write", idea: idea.slice(0, 500) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت كتابة الكلمات");
      if (!data?.lyrics) throw new Error("لم يُعد المساعد كلمات");
      return { text: data.lyrics };
    }

    if (kind === "enhance") {
      const text = input?.text?.trim();
      if (!text) throw new Error("أوصل بطاقة نص أولاً");
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التشكيل");
      return { text: data.enhanced ?? text };
    }

    if (kind === "tts") {
      const text = input?.text?.trim();
      if (!text) throw new Error("أوصل بطاقة نص أولاً");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          text,
          voiceId: cfg.voiceId ?? VOICES[0].id,
          expressive: true,
          styleId: "auto",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر توليد الصوت");
      }
      const note =
        res.headers.get("X-Mock") === "1"
          ? "⚠️ نغمة تجريبية لا صوت حقيقي — محرك النطق غير متاح حالياً"
          : undefined;
      return { blob: await res.blob(), note };
    }

    if (kind === "song") {
      const lyrics = input?.text?.trim();
      if (!lyrics) throw new Error("أوصل بطاقة كلمات أولاً");
      return runSongJob(node.id, {
        maqamId: cfg.maqamId ?? MAQAMAT[0].id,
        styleId: cfg.styleId ?? SONG_STYLES[0].id,
        lyrics,
        instrumentIds: [],
        // اختيار المحرك من البطاقة — Eleven Music يغني الكلمات بوضوح أعلى
        ...(cfg.provider && { provider: cfg.provider }),
      });
    }

    if (kind === "music") {
      // بلا كلمات = لحن آلي خالص، والأسلوب يلوّن طابع اللحن
      return runSongJob(node.id, {
        maqamId: cfg.maqamId ?? MAQAMAT[0].id,
        styleId: cfg.styleId ?? "instrumental",
        durationSec: Number(cfg.durationSec ?? 30) || 30,
        instrumentIds: [],
      });
    }

    if (kind === "stt") {
      if (!input?.blob) throw new Error("أوصل بطاقة صوت أولاً");
      const fd = new FormData();
      fd.append("audio", input.blob, "audio.mp3");
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التفريغ");
      if (!data?.text) throw new Error("لم يُعد التفريغ نصاً");
      return { text: data.text };
    }

    if (kind === "isolate") {
      if (!input?.blob) throw new Error("أوصل بطاقة صوت أولاً");
      const fd = new FormData();
      fd.append("audio", input.blob, "audio.mp3");
      const res = await fetch("/api/isolate", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر العزل");
      }
      return { blob: await res.blob() };
    }

    // save
    if (!input?.blob) throw new Error("أوصل بطاقة صوت أولاً");
    const fd = new FormData();
    const ext = input.blob.type === "audio/wav" ? "wav" : "mp3";
    fd.append("file", new File([input.blob], `maqam-space.${ext}`, { type: input.blob.type }));
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
    return {};
  }

  /** تشغيل المساحة كاملة بالترتيب الطوبولوجي — التفرع يعمل والفشل لا يوقف الفروع الأخرى */
  async function runFlow() {
    setFlowError("");
    if (!nodes.length) {
      setFlowError("أضف بطاقات أولاً — أو ابدأ من قالب جاهز");
      return;
    }
    const order = executionOrder(
      nodes.map((n) => ({ id: n.id, kind: n.data.kind })),
      edges.map((e) => ({ source: e.source, target: e.target }))
    );
    if (!order) {
      setFlowError("الربط فيه دورة مغلقة — فك الحلقة أولاً");
      return;
    }

    setRunning(true);
    // تصفير الحالات
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, status: "idle" as const, error: undefined, stage: undefined } })));

    const outputs = new Map<string, RunOutput>();
    const failed = new Set<string>();

    for (const id of order) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      const def = NODE_DEFS[node.data.kind];

      let input: RunOutput | undefined;
      if (def.input) {
        const src = inputSourceOf(id, edges);
        if (!src) {
          patchNode(id, { status: "error", error: "البطاقة غير موصولة بمصدر" });
          failed.add(id);
          continue;
        }
        if (failed.has(src)) {
          patchNode(id, { status: "error", error: "تعطل المصدر قبلها" });
          failed.add(id);
          continue;
        }
        input = outputs.get(src);
      }

      patchNode(id, { status: "running" });
      try {
        const out = await runNode(node, input);
        outputs.set(id, out);
        let resultUrl: string | undefined;
        if (out.blob) {
          resultUrl = URL.createObjectURL(out.blob);
          urlsRef.current.push(resultUrl);
        }
        patchNode(id, {
          status: "done",
          stage: undefined,
          ...(out.text !== undefined && { resultText: out.text }),
          ...(resultUrl && { resultUrl }),
          note: out.note,
        });
        // الناتج النصي المعدل يدوياً بعد تشغيل سابق يُحترم في التمرير التالي
        if (out.text !== undefined) outputs.set(id, { text: out.text });
      } catch (e) {
        patchNode(id, {
          status: "error",
          stage: undefined,
          error: e instanceof Error ? e.message : "خطأ غير متوقع",
        });
        failed.add(id);
      }
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
        edges: edges.map((e) => ({ source: e.source, target: e.target })),
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
        ركّب خط إنتاجك بنفسك: بطاقات تتوصل ببعضها بالسحب — المنفذ الأزرق نص والذهبي صوت،
        والأنواع غير المتوافقة ترفض الاتصال. اضغط ▶ وشاهد السلسلة تعمل بطاقة بطاقة.
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
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={1.5}
          deleteKeyCode={["Delete", "Backspace"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls position="bottom-left" />
        </ReactFlow>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        💡 جرّب: نص واحد يتفرع لثلاث بطاقات صوت بأصوات مختلفة — تعمل كلها في تمريرة واحدة
        للمقارنة. والناتج النصي لأي بطاقة قابل للتعديل قبل إعادة التشغيل، فتتحكم بكل حلقة في
        السلسلة. تكاليف النقاط تظهر على البطاقات المدفوعة (⚡).
      </p>
    </div>
  );
}
