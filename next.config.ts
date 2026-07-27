import type { NextConfig } from "next";

/** ترويسات أمان أساسية — تمنع التضمين في إطارات خارجية وتشديد أنواع المحتوى */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // المايكروفون مسموح (التسجيل والاستنساخ) — الكاميرا والموقع لا يستخدمهما الموقع
  { key: "Permissions-Policy", value: "camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
