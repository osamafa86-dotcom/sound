import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sound-five-inky.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // خاص بالمستخدم أو تشغيلي — لا قيمة لفهرسته
      disallow: ["/api/", "/admin", "/library", "/pay/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
