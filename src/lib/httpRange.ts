/**
 * استجابة وسائط تدعم طلبات المدى (HTTP Range) — سفاري يشترطها لتشغيل
 * الصوت والفيديو: يرسل طلب مدى استكشافياً وإن لم يُجَب بـ 206 رفض التشغيل بصمت.
 */
export function rangeResponse(
  req: Request,
  data: Buffer,
  contentType: string,
  extraHeaders: Record<string, string> = {}
): Response {
  const total = data.length;
  const base: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    ...extraHeaders,
  };

  const match = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = parseInt(match[1], 10);
      end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    } else {
      // bytes=-N ← آخر N بايت
      start = Math.max(0, total - parseInt(match[2], 10));
      end = total - 1;
    }

    if (start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { ...base, "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = data.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunk.length),
      },
    });
  }

  return new Response(new Uint8Array(data), {
    headers: { ...base, "Content-Length": String(total) },
  });
}
