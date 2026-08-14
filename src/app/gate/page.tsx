import { Suspense } from "react";
import type { Metadata } from "next";
import GateForm from "./GateForm";

export const metadata: Metadata = {
  title: "الدخول",
  robots: { index: false, follow: false },
};

export default function GatePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-16">
      <Suspense fallback={null}>
        <GateForm />
      </Suspense>
    </div>
  );
}
