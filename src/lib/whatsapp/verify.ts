import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * التحقق من صحة ما يصل من Meta.
 *
 * مسار الـ webhook عام بالضرورة — أي أحد على الإنترنت يستطيع استدعاءه.
 * بلا تحقق من التوقيع يستطيع أي شخص حقن «رسالة واردة» مزوّرة في صندوقك.
 * لذلك التوقيع يُفحص قبل قراءة الحمولة، لا بعدها.
 */

/** توقيع الحمولة كما تحسبه Meta: HMAC-SHA256 بالنص الخام وسرّ التطبيق */
export function payloadSignature(rawBody: string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

/**
 * مقارنة التوقيع الوارد بالمحسوب، بزمن ثابت.
 * تُحسب على **النص الخام** لا على الكائن بعد التحليل: إعادة ترميز JSON
 * تغيّر بايتاً واحداً فيفشل التوقيع الصحيح.
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  appSecret: string
): boolean {
  if (!header) return false;
  const expected = payloadSignature(rawBody, appSecret);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type InboundMessage = {
  /** معرّف الرسالة لدى واتساب — فريد، به نمنع التكرار عند إعادة الإرسال */
  waId: string;
  /** رقم المرسِل بصيغة دولية بلا + */
  from: string;
  /** اسم المرسِل كما ضبطه في واتساب، إن أتاحه */
  name: string | null;
  type: string;
  text: string | null;
  /** معرّف الوسائط لتنزيلها لاحقاً عبر Graph */
  mediaId: string | null;
  timestamp: string;
};

type WebhookValue = {
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: {
    id?: string;
    from?: string;
    type?: string;
    timestamp?: string;
    text?: { body?: string };
    image?: { id?: string; caption?: string };
    audio?: { id?: string };
    video?: { id?: string; caption?: string };
    document?: { id?: string; filename?: string };
    button?: { text?: string };
    interactive?: { list_reply?: { title?: string }; button_reply?: { title?: string } };
  }[];
};

/**
 * استخراج الرسائل من حمولة الـ webhook.
 *
 * البنية متداخلة عمداً لدى Meta (entry ← changes ← value ← messages) لأن
 * الحمولة الواحدة قد تحمل تغييرات لعدة أرقام. نقرأها بتسامح: أي حقل ناقص
 * يُتجاهل ولا يُسقط بقية الرسائل.
 */
export function extractMessages(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const body = payload as { entry?: { changes?: { value?: WebhookValue }[] }[] };

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value?.messages?.length) continue;

      const nameOf = (from: string) =>
        value.contacts?.find((c) => c.wa_id === from)?.profile?.name ?? null;

      for (const m of value.messages) {
        if (!m?.id || !m.from) continue;
        out.push({
          waId: m.id,
          from: m.from,
          name: nameOf(m.from),
          type: m.type ?? "unknown",
          text: readText(m),
          mediaId: m.image?.id ?? m.audio?.id ?? m.video?.id ?? m.document?.id ?? null,
          timestamp: m.timestamp ?? String(Math.floor(Date.now() / 1000)),
        });
      }
    }
  }
  return out;
}

/** النص أياً كان نوع الرسالة — تعليق الصورة ونص الزر رسائل أيضاً */
function readText(m: NonNullable<WebhookValue["messages"]>[number]): string | null {
  return (
    m.text?.body ??
    m.image?.caption ??
    m.video?.caption ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    (m.document?.filename ? `📄 ${m.document.filename}` : null)
  );
}
