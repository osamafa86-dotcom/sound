import { describe, expect, it } from "vitest";
import { extractDocxXmlText } from "@/lib/docx";

const wrap = (body: string) =>
  `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

describe("extractDocxXmlText", () => {
  it("يستخرج الفقرات كل واحدة في سطر", () => {
    const xml = wrap(
      `<w:p w:rsidR="00"><w:r><w:t>الفقرة الأولى</w:t></w:r></w:p>` +
        `<w:p w:rsidR="01"><w:r><w:t>الفقرة الثانية</w:t></w:r></w:p>`
    );
    expect(extractDocxXmlText(xml)).toBe("الفقرة الأولى\nالفقرة الثانية");
  });

  it("يجمع النص المقسم على عدة runs في فقرة واحدة", () => {
    const xml = wrap(
      `<w:p w:x="1"><w:r><w:t>مرحباً </w:t></w:r><w:r><w:t xml:space="preserve">بكم في مقام</w:t></w:r></w:p>`
    );
    expect(extractDocxXmlText(xml)).toBe("مرحباً بكم في مقام");
  });

  it("يحوّل فواصل الأسطر والجداول ويفك كيانات XML", () => {
    const xml = wrap(
      `<w:p w:x="1"><w:r><w:t>قبل</w:t></w:r><w:br/><w:r><w:t>بعد &amp; &lt;وسم&gt;</w:t></w:r></w:p>`
    );
    expect(extractDocxXmlText(xml)).toBe("قبل\nبعد & <وسم>");
  });

  it("يتجاهل وسوم التنسيق ويعيد نصاً فارغاً لوثيقة بلا فقرات", () => {
    expect(extractDocxXmlText(wrap(`<w:sectPr><w:pgSz w:w="11906"/></w:sectPr>`))).toBe("");
  });
});
