import type { ReactNode } from "react";

export const metadata = {
  title: "استوديو الأغاني والمقامات",
  description: "اكتب كلماتك ولحّنها على المقامات العربية الأصيلة — أغانٍ كاملة بالذكاء الاصطناعي بأساليب خليجية وشامية وفلسطينية.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
