import { WA_BASE, type WhatsAppConfig } from "./config";

/**
 * إرسال رسالة نصية عبر Cloud API.
 *
 * قيد تفرضه Meta ويجب أن تعرفه: الرد الحرّ (بلا قالب معتمَد) مسموح فقط
 * ضمن **نافذة خدمة العملاء**: أربع وعشرون ساعة من آخر رسالة أرسلها الزبون.
 * بعدها تُرفض الرسالة الحرّة ويلزم قالب مُوافَق عليه مسبقاً من Meta.
 */

export type SendResult = { waId: string };

export async function sendText(
  cfg: WhatsAppConfig,
  to: string,
  body: string
): Promise<SendResult> {
  const res = await fetch(`${WA_BASE}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/[^0-9]/g, ""),
      type: "text",
      text: { preview_url: true, body },
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number; error_data?: { details?: string } };
  } | null;

  if (!res.ok || data?.error) {
    const err = data?.error;
    const detail = err?.error_data?.details || err?.message || `HTTP ${res.status}`;
    // الخطأ الأشيع عملياً — نترجمه بدل تمرير نص Meta الغامض
    if (err?.code === 131047 || /24 hours|re-?engagement/i.test(detail)) {
      throw new Error(
        "مضى أكثر من ٢٤ ساعة على آخر رسالة من هذا الرقم — الرد الحرّ غير مسموح الآن، ويلزم قالب معتمَد من Meta"
      );
    }
    throw new Error("واتساب رفض الإرسال: " + detail);
  }

  const waId = data?.messages?.[0]?.id;
  if (!waId) throw new Error("أُرسلت الرسالة لكن لم يُعد واتساب معرّفها");
  return { waId };
}
