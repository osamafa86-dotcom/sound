import { redirect } from "next/navigation";

/** المدفوعات معطلة — الموقع خاص خلف كلمة سر واحدة بلا رسوم ولا اشتراكات */
export default function PricingPage() {
  redirect("/");
}
