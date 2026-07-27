import type { ReactNode } from "react";

export const metadata = {
  title: "مكتبتي",
  description: "كل أعمالك الصوتية محفوظة في مكان واحد — استمع، نزّل، قيّم، وانشر ما تريد في المعرض العام.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
