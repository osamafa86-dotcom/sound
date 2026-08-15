import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "غرفة الدردشة",
  description: "غرفة دردشة عامة حية على منصة لحّن — ادخل باسمك وتحدّث مع الجميع لحظياً.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
