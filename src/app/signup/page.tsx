import AuthForm from "@/components/AuthForm";

export const metadata = { title: "إنشاء حساب" };

export default function Signup() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">
        إنشاء <span className="text-gradient">حساب</span>
      </h1>
      <p className="mt-2 text-muted">احفظ توليداتك في مكتبة سحابية تعود إليها من أي جهاز.</p>
      <div className="mt-8">
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
