import { redirect } from "next/navigation";

/** البوابة أُلغيت — الموقع مفتوح. الرابط القديم يعيد للرئيسية. */
export default function GatePage() {
  redirect("/");
}
