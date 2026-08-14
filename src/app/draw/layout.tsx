import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "أكاديمية الرسم",
  description:
    "تعلّم الرسم من الصفر إلى الاحتراف: منهج من ١٥ درساً في ٣ مستويات، مدرب ذكي يقيّم رسوماتك المرفوعة بالتفصيل، ومراجع تدريب مولّدة لكل درس.",
};

export default function DrawLayout({ children }: { children: React.ReactNode }) {
  return children;
}
