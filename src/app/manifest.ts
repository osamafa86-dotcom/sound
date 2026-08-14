import type { MetadataRoute } from "next";

/** بيان تطبيق الويب (PWA) — يجعل الموقع قابلاً للتثبيت على الموبايل وسطح المكتب */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "لحّن — استوديو الصوتيات بالذكاء الاصطناعي",
    short_name: "لحّن",
    description:
      "منصة عربية لتحويل النص إلى صوت بجودة عالية، وكتابة وتلحين الأغاني حسب المقامات الصوتية بالذكاء الاصطناعي.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf8f4",
    theme_color: "#fbf8f4",
    categories: ["music", "productivity", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "النص إلى صوت",
        url: "/tts",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "استوديو الأغاني",
        url: "/songs",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "معمل الصوت",
        url: "/voice",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
