import type { ReactNode } from "react";

export const metadata = {
  title: "معرض الإبداعات",
  description: "أعمال حقيقية أنشأها مستخدمو مقام ونشروها — استمع وخذ الإلهام لعملك التالي.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
