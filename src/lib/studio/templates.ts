import type { NodeKind } from "./graph";

/**
 * قوالب مساحة مقام — خطوط إنتاج جاهزة بضغطة:
 * مواضع مرتبة يميناً-يساراً بصرياً (المصدر في اليمين على لوحة LTR معكوسة العرض).
 */

export type TemplateNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  config?: Record<string, string>;
};

export type SpaceTemplate = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  nodes: TemplateNode[];
  edges: { source: string; target: string }[];
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
];
