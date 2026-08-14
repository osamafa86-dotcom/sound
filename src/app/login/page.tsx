import { redirect } from "next/navigation";

/** لا حسابات ولا تسجيل دخول — الدخول بكلمة سر الموقع الواحدة فقط (/gate) */
export default function LoginPage() {
  redirect("/");
}
