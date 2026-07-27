import type { ReactNode } from "react";

export const metadata = {
  title: "الاستوديو الدرامي",
  description: "حوّل أي نص أو قصة إلى عمل مسموع متعدد الأصوات — توزيع شخصيات وانفعالات تلقائي بالذكاء الاصطناعي.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
