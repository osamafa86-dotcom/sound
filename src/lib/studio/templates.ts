import type { NodeKind } from "./graph";

/**
 * قوالب مساحة مقام — خطوط إنتاج جاهزة بضغطة:
 * مواضع مرتبة يميناً-يساراً بصرياً (المصدر في اليمين على لوحة LTR معكوسة العرض).
 * الوصلات قد تسمي منفذها (sourceHandle/targetHandle) — الغائب يعني المنفذ الأول.
 */

export type TemplateNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  config?: Record<string, string>;
};

export type TemplateEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type SpaceTemplate = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  {
    id: "song-line",
    name: "خط إنتاج الأغنية",
    icon: "🎼",
    desc: "فكرة ← كلمات ← تلحين ← حفظ",
    nodes: [
      { id: "t1", kind: "text", x: 0, y: 80, config: { text: "أغنية عن حب الأرض والعودة إليها" } },
      { id: "t2", kind: "lyrics", x: 320, y: 80 },
      { id: "t3", kind: "song", x: 640, y: 80 },
      { id: "t4", kind: "save", x: 960, y: 110 },
    ],
    edges: [
      { source: "t1", target: "t2" },
      { source: "t2", target: "t3" },
      { source: "t3", target: "t4" },
    ],
  },
  {
    id: "voiceover-line",
    name: "خط التعليق الصوتي",
    icon: "🎙️",
    desc: "نص ← تشكيل ← صوت ← حفظ",
    nodes: [
      { id: "v1", kind: "text", x: 0, y: 80 },
      { id: "v2", kind: "enhance", x: 320, y: 80 },
      { id: "v3", kind: "tts", x: 640, y: 80 },
      { id: "v4", kind: "save", x: 960, y: 110 },
    ],
    edges: [
      { source: "v1", target: "v2" },
      { source: "v2", target: "v3" },
      { source: "v3", target: "v4" },
    ],
  },
  {
    id: "voice-compare",
    name: "مقارنة ثلاثة أصوات",
    icon: "🔀",
    desc: "نص واحد يتفرع لثلاثة أصوات تعمل معاً",
    nodes: [
      { id: "c1", kind: "text", x: 0, y: 200 },
      { id: "c2", kind: "tts", x: 380, y: 0, config: { voiceId: "v-pal-m1" } },
      { id: "c3", kind: "tts", x: 380, y: 210, config: { voiceId: "v-pal-f1" } },
      { id: "c4", kind: "tts", x: 380, y: 420, config: { voiceId: "v-jor-f1" } },
    ],
    edges: [
      { source: "c1", target: "c2" },
      { source: "c1", target: "c3" },
      { source: "c1", target: "c4" },
    ],
  },
  {
    id: "voiceprint-speaks",
    name: "بصمتك تتكلم",
    icon: "🧬",
    desc: "سجّل صوتك ← بصمة ← أي نص يُقرأ بصوتك",
    nodes: [
      { id: "p1", kind: "upload", x: 0, y: 60 },
      { id: "p2", kind: "voiceprint", x: 340, y: 60 },
      { id: "p3", kind: "text", x: 340, y: 340, config: { text: "أهلاً بكم في منصة مقام — هذا النص يُقرأ ببصمة صوتي أنا." } },
      { id: "p4", kind: "tts", x: 680, y: 180 },
    ],
    edges: [
      { source: "p1", target: "p2" },
      { source: "p2", target: "p4", targetHandle: "voice" },
      { source: "p3", target: "p4", targetHandle: "in" },
    ],
  },
  {
    id: "song-split",
    name: "فصل أغنية",
    icon: "✂️",
    desc: "ارفع أغنية ← الغناء وحده والموسيقى وحدها",
    nodes: [
      { id: "s1", kind: "upload", x: 0, y: 60 },
      { id: "s2", kind: "split", x: 340, y: 60 },
    ],
    edges: [{ source: "s1", target: "s2" }],
  },
  {
    id: "collective-cover",
    name: "عقل جمعي: غلاف من الكلمات",
    icon: "🧞",
    desc: "الفكرة والكلمات معاً تغذيان ذكاءً يصمم الغلاف — والتلحين بالتوازي",
    nodes: [
      { id: "g1", kind: "text", x: 0, y: 120, config: { text: "أغنية عن بيّارات يافا ورائحة البرتقال" } },
      { id: "g2", kind: "lyrics", x: 340, y: 0 },
      { id: "g3", kind: "song", x: 680, y: 0 },
      {
        id: "g4",
        kind: "ai",
        x: 680,
        y: 320,
        config: {
          mode: "image",
          prompt: "صمّم غلاف ألبوم يعكس روح هذه الفكرة والكلمات — بلا أي حروف أو نصوص داخل الصورة",
        },
      },
    ],
    edges: [
      { source: "g1", target: "g2" },
      { source: "g2", target: "g3" },
      { source: "g1", target: "g4", targetHandle: "ctx" },
      { source: "g2", target: "g4", targetHandle: "ctx" },
    ],
  },
];
