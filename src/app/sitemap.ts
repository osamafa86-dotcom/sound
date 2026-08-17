import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sound.feedsnews.net";

/** الصفحات العامة القابلة للفهرسة — الرئيسية والاستوديوهات أولاً */
const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/tts", priority: 0.9 },
  { path: "/songs", priority: 0.9 },
  { path: "/voices", priority: 0.8 },
  { path: "/gallery", priority: 0.7 },
  { path: "/podcast", priority: 0.8 },
  { path: "/drama", priority: 0.7 },
  { path: "/voice", priority: 0.7 },
  { path: "/prompts", priority: 0.7 },
  { path: "/pricing", priority: 0.8 },
  { path: "/brain", priority: 0.5 },
  { path: "/support", priority: 0.5 },
  { path: "/terms", priority: 0.3 },
  { path: "/privacy", priority: 0.3 },
  { path: "/refund", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    changeFrequency: "weekly",
    priority: r.priority,
  }));
}
