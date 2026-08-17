/**
 * مساحة مقام — منطق مخطط البطاقات النقي:
 * منافذ متعددة مسماة لكل بطاقة (دخل جمعي وخرجان وأنواع جديدة)،
 * توافق الربط على مستوى المنفذ، وموجات التشغيل المتوازي.
 * منفصل عن الواجهة ليبقى قابلاً للاختبار حتى آخر حافة.
 */

export type PortType = "text" | "audio" | "voice" | "image" | "video";

/** هوية كل نوع منفذ: لونه واسمه ورمزه — تستخدمها البطاقات وشروح الربط */
export const PORT_META: Record<PortType, { color: string; label: string; chip: string }> = {
  text: { color: "#3b82f6", label: "نص", chip: "🔵" },
  audio: { color: "#d9a441", label: "صوت", chip: "🟡" },
  voice: { color: "#8b5cf6", label: "بصمة صوت", chip: "🟣" },
  image: { color: "#10b981", label: "صورة", chip: "🟢" },
  video: { color: "#ec4899", label: "فيديو", chip: "🌸" },
};

export type NodeKind =
  | "ai"
  | "text"
  | "upload"
  | "voiceprint"
  | "lyrics"
  | "enhance"
  | "tts"
  | "song"
  | "music"
  | "sfx"
  | "split"
  | "isolate"
  | "stt"
  | "save";

export type NodeConfig = Record<string, string>;

export type InputPort = {
  id: string;
  label: string;
  /** الأنواع التي يقبلها المنفذ */
  accepts: PortType[];
  /** منفذ جمعي: يستقبل عدة وصلات معاً — عقل جمعي يتغذى من بطاقات كثيرة */
  multi?: boolean;
  /** اختياري: التشغيل لا يتطلبه */
  optional?: boolean;
};

export type OutputPort = { id: string; label: string; type: PortType };

export type NodeDef = {
  kind: NodeKind;
  name: string;
  icon: string;
  desc: string;
  inputs: InputPort[];
  outputs: OutputPort[];
  /** كلفة التشغيل بالنقاط للعرض (المصدر الحقيقي في الخادم) */
  cost?: number;
};

/** أوضاع بطاقة الذكاء الشامل وكلفها — الخرج يتبدل نوعاً مع الوضع */
export const AI_MODES = [
  { id: "text", name: "نص", icon: "📝", cost: 1 },
  { id: "image", name: "صورة", icon: "🖼️", cost: 6 },
  { id: "video", name: "فيديو", icon: "🎬", cost: 20 },
] as const;

export type AiMode = (typeof AI_MODES)[number]["id"];

export function aiMode(config: NodeConfig): AiMode {
  return config.mode === "image" || config.mode === "video" ? config.mode : "text";
}

export function aiModeCost(config: NodeConfig): number {
  return AI_MODES.find((m) => m.id === aiMode(config))!.cost;
}

export const NODE_DEFS: Record<NodeKind, NodeDef> = {
  ai: {
    kind: "ai",
    name: "ذكاء مقام",
    icon: "🧞",
    desc: "البطاقة الشاملة: نص أو صورة أو فيديو — بعقل جمعي يتغذى من عدة بطاقات معاً",
    inputs: [
      {
        id: "ctx",
        label: "تغذية جمعية",
        accepts: ["text", "audio", "image", "video"],
        multi: true,
        optional: true,
      },
    ],
    outputs: [{ id: "out", label: "نص", type: "text" }],
  },
  text: {
    kind: "text",
    name: "نص",
    icon: "📝",
    desc: "نقطة البداية — اكتب أو الصق نصك",
    inputs: [],
    outputs: [{ id: "out", label: "نص", type: "text" }],
  },
  upload: {
    kind: "upload",
    name: "صوت من عندك",
    icon: "📤",
    desc: "ارفع أو سجّل صوتاً أو لحناً أو أغنية — نقطة بداية صوتية",
    inputs: [],
    outputs: [{ id: "out", label: "صوت", type: "audio" }],
  },
  voiceprint: {
    kind: "voiceprint",
    name: "بصمة صوت",
    icon: "🧬",
    desc: "عينة صوتك تصبح بصمة ينطق بها توليد الصوت",
    inputs: [{ id: "in", label: "عينة صوتك", accepts: ["audio"] }],
    outputs: [{ id: "out", label: "بصمة", type: "voice" }],
    cost: 40,
  },
  lyrics: {
    kind: "lyrics",
    name: "كتابة كلمات",
    icon: "✍️",
    desc: "فكرة أو موضوع يتحول كلمات أغنية",
    inputs: [{ id: "in", label: "فكرة", accepts: ["text"] }],
    outputs: [{ id: "out", label: "كلمات", type: "text" }],
  },
  enhance: {
    kind: "enhance",
    name: "تشكيل وتدقيق",
    icon: "✨",
    desc: "تشكيل كامل وتطبيع الأرقام والاختصارات",
    inputs: [{ id: "in", label: "نص", accepts: ["text"] }],
    outputs: [{ id: "out", label: "نص مشكّل", type: "text" }],
  },
  tts: {
    kind: "tts",
    name: "توليد صوت",
    icon: "🎙️",
    desc: "النص يُؤدى بالمحرك التعبيري — وببصمتك إن وصلتها",
    inputs: [
      { id: "in", label: "نص", accepts: ["text"] },
      { id: "voice", label: "بصمة صوت", accepts: ["voice"], optional: true },
    ],
    outputs: [{ id: "out", label: "صوت", type: "audio" }],
    cost: 2,
  },
  song: {
    kind: "song",
    name: "تلحين أغنية",
    icon: "🎼",
    desc: "الكلمات تُلحَّن على المقام — ولحن مرجعي يوجه روح التوزيع",
    inputs: [
      { id: "in", label: "كلمات", accepts: ["text"] },
      { id: "melody", label: "لحن مرجعي", accepts: ["audio"], optional: true },
    ],
    outputs: [{ id: "out", label: "أغنية", type: "audio" }],
    cost: 25,
  },
  music: {
    kind: "music",
    name: "موسيقى آلية",
    icon: "🎵",
    desc: "لحن بلا كلمات — ولحن مرجعي موصول يلهم التأليف",
    inputs: [{ id: "melody", label: "لحن مرجعي", accepts: ["audio"], optional: true }],
    outputs: [{ id: "out", label: "لحن", type: "audio" }],
    cost: 25,
  },
  sfx: {
    kind: "sfx",
    name: "مؤثر صوتي",
    icon: "🌩️",
    desc: "وصف نصي يتحول مؤثراً صوتياً حقيقياً (مطر، باب يصرّ، جمهور...) حتى ٣٠ ثانية — وخيار حلقة متكررة للخلفيات",
    inputs: [{ id: "in", label: "وصف المؤثر", accepts: ["text"], optional: true }],
    outputs: [{ id: "out", label: "مؤثر", type: "audio" }],
    cost: 2,
  },
  split: {
    kind: "split",
    name: "فصل الأغنية",
    icon: "✂️",
    desc: "أغنية تنفصل مسارين: الغناء وحده والموسيقى وحدها — لإعادة الاستفادة",
    inputs: [{ id: "in", label: "الأغنية", accepts: ["audio"] }],
    outputs: [
      { id: "vocals", label: "الغناء", type: "audio" },
      { id: "inst", label: "الموسيقى", type: "audio" },
    ],
    cost: 5,
  },
  isolate: {
    kind: "isolate",
    name: "عازل الضجيج",
    icon: "🧹",
    desc: "ينقّي الصوت من الضجيج والخلفية",
    inputs: [{ id: "in", label: "صوت", accepts: ["audio"] }],
    outputs: [{ id: "out", label: "صوت نقي", type: "audio" }],
    cost: 5,
  },
  stt: {
    kind: "stt",
    name: "تفريغ نصي",
    icon: "📜",
    desc: "الجسر من الصوت إلى النص — تسجيل يتحول كلمات",
    inputs: [{ id: "in", label: "صوت", accepts: ["audio"] }],
    outputs: [{ id: "out", label: "نص", type: "text" }],
    cost: 3,
  },
  save: {
    kind: "save",
    name: "حفظ في المكتبة",
    icon: "💾",
    desc: "الناتج يُحفظ في مكتبتك",
    inputs: [{ id: "in", label: "صوت", accepts: ["audio"] }],
    outputs: [],
  },
};

/**
 * منافذ البطاقة الفعلية بحسب إعداداتها — بطاقة الذكاء يتبدل نوع خرجها
 * مع الوضع المختار (نص/صورة/فيديو) فيتلون منفذها ويتغير ما يقبل الاتصال به.
 */
export function nodePorts(
  kind: NodeKind,
  config: NodeConfig = {}
): { inputs: InputPort[]; outputs: OutputPort[] } {
  const def = NODE_DEFS[kind];
  if (kind === "ai") {
    const mode = aiMode(config);
    const type: PortType = mode === "text" ? "text" : mode;
    return {
      inputs: def.inputs,
      outputs: [{ id: "out", label: PORT_META[type].label, type }],
    };
  }
  return { inputs: def.inputs, outputs: def.outputs };
}

/** طرف ربط: بطاقة (بإعداداتها) ومقبض منفذ — المقبض الغائب يعني المنفذ الأول */
export type PortRef = { kind: NodeKind; config?: NodeConfig; handle?: string | null };

export function resolveOutput(ref: PortRef): OutputPort | null {
  const { outputs } = nodePorts(ref.kind, ref.config ?? {});
  if (!outputs.length) return null;
  if (!ref.handle) return outputs[0];
  return outputs.find((o) => o.id === ref.handle) ?? null;
}

export function resolveInput(ref: PortRef): InputPort | null {
  const { inputs } = nodePorts(ref.kind, ref.config ?? {});
  if (!inputs.length) return null;
  if (!ref.handle) return inputs[0];
  return inputs.find((i) => i.id === ref.handle) ?? null;
}

/** توافق الربط: نوع خرج المصدر ضمن ما يقبله منفذ الهدف */
export function canConnect(source: PortRef, target: PortRef): boolean {
  const out = resolveOutput(source);
  const inp = resolveInput(target);
  return !!out && !!inp && inp.accepts.includes(out.type);
}

export type GraphNode = { id: string; kind: NodeKind };
export type GraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/**
 * موجات التشغيل المتوازي (Kahn بطبقات): كل موجة بطاقات مدخلاتها جاهزة
 * فتعمل معاً في آن واحد — الفروع المستقلة لا تنتظر بعضها.
 * يعيد null عند وجود دورة (ربط دائري لا يمكن تشغيله).
 */
export function executionLayers(nodes: GraphNode[], edges: GraphEdge[]): string[][] | null {
  const ids = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of ids) indegree.set(id, 0);
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
  }

  const layers: string[][] = [];
  let frontier = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0);
  let seen = 0;
  while (frontier.length) {
    layers.push(frontier);
    seen += frontier.length;
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        const d = (indegree.get(child) ?? 1) - 1;
        indegree.set(child, d);
        if (d === 0) next.push(child);
      }
    }
    frontier = next;
  }
  return seen === ids.size ? layers : null;
}

/** الترتيب الطوبولوجي المسطّح — للتوافق ولأغراض العرض */
export function executionOrder(nodes: GraphNode[], edges: GraphEdge[]): string[] | null {
  return executionLayers(nodes, edges)?.flat() ?? null;
}

/** أول مصدر موصول ببطاقة — للاستخدامات البسيطة أحادية المنفذ */
export function inputSourceOf(nodeId: string, edges: GraphEdge[]): string | null {
  return edges.find((e) => e.target === nodeId)?.source ?? null;
}

/**
 * وصلات دخل بطاقة مجمعة حسب منفذها — المقبض الغائب (وصلات قديمة محفوظة
 * قبل المنافذ المسماة) يُنسب للمنفذ الأول فتبقى المساحات القديمة تعمل.
 */
export function inputEdgesByPort(
  nodeId: string,
  kind: NodeKind,
  config: NodeConfig,
  edges: GraphEdge[]
): Map<string, GraphEdge[]> {
  const { inputs } = nodePorts(kind, config);
  const byPort = new Map<string, GraphEdge[]>();
  for (const port of inputs) byPort.set(port.id, []);
  const first = inputs[0]?.id;
  for (const e of edges) {
    if (e.target !== nodeId) continue;
    const portId = e.targetHandle ?? first;
    if (portId && byPort.has(portId)) byPort.get(portId)!.push(e);
  }
  return byPort;
}
