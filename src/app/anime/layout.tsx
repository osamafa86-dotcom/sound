import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مولد الأنمي",
  description:
    "حوّل خيالك — أو صورتك الحقيقية — إلى لوحة أنمي احترافية: ثمانية أساليب فنية، إضاءات ومزاجات، وتوليد فوري بالذكاء الاصطناعي.",
};

export default function AnimeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
