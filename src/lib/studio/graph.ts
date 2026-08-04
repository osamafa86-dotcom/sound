/**
 * مساحة مقام — منطق مخطط البطاقات النقي:
 * أنواع المنافذ، توافق الربط، والترتيب الطوبولوجي للتشغيل.
 * منفصل عن الواجهة ليبقى قابلاً للاختبار حتى آخر حافة.
 */

export type PortType = "text" | "audio";

export type NodeKind =
  | "text"
  | "lyrics"
  | "enhance"
  | "tts"
  | "song"
  | "isolate"
  | "stt"
  | "save";

export type NodeDef = {
  kind: NodeKind;
  name: string;
  icon: string;
  desc: string;
  /** منفذ الدخل — null لبطاقات المصدر */
  input: PortType | null;
  /** منفذ الخرج — null لبطاقات النهاية */
  output: PortType | null;
  /** كلفة التشغيل بالنقاط للعرض (المصدر الحقيقي في الخادم) */
  cost?: number;
};

export const NODE_DEFS: Record<NodeKind, NodeDef> = {
  text: {
    kind: "text",
    name: "نص",
    icon: "📝",
    desc: "نقطة البداية — اكتب أو الصق نصك",
    input: null,
    output: "text",
  },
  lyrics: {
    kind: "lyrics",
    name: "كتابة كلمات",
    icon: "✍️",
    desc: "فكرة أو موضوع يتحول كلمات أغنية",
    input: "text",
    output: "text",
  },
  enhance: {
    kind: "enhance",
    name: "تشكيل وتدقيق",
    icon: "✨",
    desc: "تشكيل كامل وتطبيع الأرقام والاختصارات",
    input: "text",
    output: "text",
  },
  tts: {
    kind: "tts",
    name: "توليد صوت",
    icon: "🎙️",
    desc: "النص يُؤدى بالمحرك التعبيري",
    input: "text",
    output: "audio",
    cost: 2,
  },
  song: {
    kind: "song",
    name: "تلحين أغنية",
    icon: "🎼",
    desc: "الكلمات تُلحَّن على المقام المختار",
    input: "text",
    output: "audio",
    cost: 25,
  },
  isolate: {
    kind: "isolate",
    name: "عازل الضجيج",
    icon: "🧹",
    desc: "ينقّي الصوت من الضجيج والخلفية",
    input: "audio",
    output: "audio",
    cost: 5,
  },
  stt: {
    kind: "stt",
    name: "تفريغ نصي",
    icon: "📜",
    desc: "الجسر من الصوت إلى النص — تسجيل يتحول كلمات",
    input: "audio",
    output: "text",
    cost: 3,
  },
  save: {
    kind: "save",
    name: "حفظ في المكتبة",
    icon: "💾",
    desc: "الناتج يُحفظ في مكتبتك",
    input: "audio",
    output: null,
  },
};

export type GraphNode = { id: string; kind: NodeKind };
export type GraphEdge = { source: string; target: string };

/** توافق الربط: خرج المصدر يطابق دخل الهدف نوعاً */
export function canConnect(sourceKind: NodeKind, targetKind: NodeKind): boolean {
  const out = NODE_DEFS[sourceKind]?.output;
  const inp = NODE_DEFS[targetKind]?.input;
  return !!out && !!inp && out === inp;
}

/**
 * الترتيب الطوبولوجي (Kahn) — ترتيب تشغيل يضمن جاهزية مدخل كل بطاقة.
 * يعيد null عند وجود دورة (ربط دائري لا يمكن تشغيله).
 */
export function executionOrder(nodes: GraphNode[], edges: GraphEdge[]): string[] | null {
  const ids = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const id of ids) indegree.set(id, 0);
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    children.set(e.source, [...(children.get(e.source) ?? []), e.target]);
  }

  const queue = [...ids].filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of children.get(id) ?? []) {
      const d = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, d);
      if (d === 0) queue.push(child);
    }
  }
  return order.length === ids.size ? order : null;
}

/** مصدر مدخل بطاقة — منفذ دخل واحد لكل بطاقة بالتصميم */
export function inputSourceOf(nodeId: string, edges: GraphEdge[]): string | null {
  return edges.find((e) => e.target === nodeId)?.source ?? null;
}
