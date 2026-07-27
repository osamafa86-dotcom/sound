/**
 * مستخرج نصوص DOCX — بلا أي اعتماديات خارجية.
 *
 * ملف DOCX هو أرشيف ZIP يحوي word/document.xml، فنقرأ فهرس الأرشيف يدوياً
 * ونفك ضغط المدخل عبر DecompressionStream المدمج في المتصفح، ثم نحوّل
 * XML الفقرات إلى نص عادي. يعمل بالكامل على جهاز المستخدم — الملف لا يغادره.
 */

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

/** تحويل XML وثيقة Word إلى نص: فقرات بأسطر، ومحتوى <w:t> فقط */
export function extractDocxXmlText(xml: string): string {
  const paragraphs: string[] = [];
  // كل <w:p>...</w:p> فقرة مستقلة — والوسوم الذاتية الإغلاق فقرات فارغة
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  for (const match of xml.match(paraRe) ?? []) {
    let text = "";
    // فواصل الأسطر والجداول داخل الفقرة
    const runRe = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>|<w:(?:br|cr)\s*\/>|<w:tab\s*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(match))) {
      if (m[1] !== undefined) text += decodeXmlEntities(m[1]);
      else if (m[0].includes("tab")) text += " ";
      else text += "\n";
    }
    paragraphs.push(text);
  }
  return paragraphs
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** قراءة ملف docx كاملاً واستخراج نصه — يرمي خطأً عربياً واضحاً عند التلف */
export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const xml = await readZipEntry(buf, "word/document.xml");
  if (!xml) throw new Error("الملف ليس مستند Word صالحاً (docx)");
  return extractDocxXmlText(xml);
}

/** إيجاد مدخل بعينه في أرشيف ZIP وفك ضغطه نصاً */
async function readZipEntry(buf: ArrayBuffer, entryName: string): Promise<string | null> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // سجل نهاية الفهرس المركزي — نمسحه من آخر الملف (التعليق حتى 64كيلوبايت)
  let eocd = -1;
  const scanStart = Math.max(0, buf.byteLength - 22 - 65535);
  for (let i = buf.byteLength - 22; i >= scanStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder("utf-8");

  for (let e = 0; e < entryCount; e++) {
    if (offset + 46 > buf.byteLength || view.getUint32(offset, true) !== CENTRAL_SIG) return null;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));

    if (name === entryName) {
      if (view.getUint32(localOffset, true) !== LOCAL_SIG) return null;
      // أطوال الاسم والإضافات في الترويسة المحلية قد تختلف عن المركزية — نقرأها منها
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) return decoder.decode(data);
      if (method === 8) {
        const stream = new Blob([new Uint8Array(data)])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(stream).text();
      }
      return null;
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
