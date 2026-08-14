import { Suspense } from "react";
import { redirect } from "next/navigation";
import GateForm from "./GateForm";
import { readSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";

/** صفحة الدخول — تظهر فقط حين تكون كلمة سر مفعّلة من صفحة الحماية */
export default async function GatePage() {
  const cfg = await readSecurity(true);
  if (!cfg.passwordHash) redirect("/");
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Suspense>
          <GateForm hasPasskeys={cfg.passkeys.length > 0} />
        </Suspense>
      </div>
    </div>
  );
}
