import type { ReactNode } from "react";

export const metadata = {
  title: "البودكاست الذكي",
  description: "موضوع واحد أو مقالك الخاص يتحول إلى حلقة بودكاست حوارية كاملة بمقدّمَين وثيم موسيقي مؤلَّف خصيصاً.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
