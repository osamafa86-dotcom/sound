import AuthForm from "@/components/AuthForm";

export const metadata = { title: "تسجيل الدخول" };

export default function Login() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold">
        تسجيل <span className="text-gradient">الدخول</span>
      </h1>
      <p className="mt-2 text-muted">ادخل إلى حسابك للوصول لمكتبتك السحابية.</p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
