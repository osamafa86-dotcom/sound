import type { ReactNode } from "react";

export const metadata = {
  title: "معرض الأصوات",
  description: "استمع لعينات حية من عشرات الأصوات العربية الأصيلة بكل اللهجات، واختر صوتك المفضل وانطلق به إلى الاستوديو.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
