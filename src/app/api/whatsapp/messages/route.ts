import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { whatsappConfigured } from "@/lib/whatsapp/config";
import { listConversations, listMessages } from "@/lib/whatsapp/store";

/**
 * قراءة الصندوق — لمالك النظام وحده.
 * هذه رسائل زبائن حقيقية بأرقامهم، فلا تُفتح لغير صاحب المنصة.
 */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  if (!whatsappConfigured()) {
    return NextResponse.json({ configured: false, conversations: [], messages: [] });
  }

  const contact = req.nextUrl.searchParams.get("contact");
  return NextResponse.json({
    configured: true,
    conversations: await listConversations(),
    messages: contact ? await listMessages(contact) : [],
  });
}
