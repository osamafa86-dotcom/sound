import { describe, expect, it } from "vitest";
import {
  buildOutline,
  detectChapters,
  estimateSeconds,
  formatDuration,
  headingOf,
  toArabicDigits,
} from "@/lib/audiobook/outline";
import { AUDIOBOOK_LIMITS } from "@/lib/audiobook/types";

const paragraph = "هذه فقرة عربية من الكتاب تحمل معنى كاملاً وتنتهي بنقطة. ".repeat(6);

describe("اكتشاف عناوين الفصول", () => {
  it("يتعرف على عناوين Markdown بلا اشتراط عزلة", () => {
    expect(headingOf("# الفصل الأول", false, false)).toBe("الفصل الأول");
    expect(headingOf("### تمهيد", false, false)).toBe("تمهيد");
  });

  it("يتعرف على «الفصل» و«المقدمة» عند بداية فقرة", () => {
    expect(headingOf("الفصل الثاني: الرحيل", true, true)).toBe("الفصل الثاني: الرحيل");
    expect(headingOf("المقدمة", true, true)).toBe("المقدمة");
    expect(headingOf("الخاتمة:", true, true)).toBe("الخاتمة");
  });

  it("لا يعدّ سطراً داخل فقرة عنواناً", () => {
    expect(headingOf("الفصل الأول كان قاسياً عليه", false, false)).toBeNull();
    expect(headingOf("وقال إن المقدمة طويلة", true, true)).toBeNull();
  });

  it("السطر المرقّم يحتاج عزلة من الجهتين كي لا تُقرأ القوائم فصولاً", () => {
    expect(headingOf("١- البداية", true, true)).toBe("١- البداية");
    expect(headingOf("١- البداية", true, false)).toBeNull();
  });

  it("الفاصل البصري يبدأ فصلاً بلا عنوان", () => {
    expect(headingOf("---", false, false)).toBe("");
    expect(headingOf("***", false, false)).toBe("");
  });
});

describe("تقسيم الكتاب إلى فصول", () => {
  it("يقسم عند العناوين ويحتفظ بمتن كل فصل", () => {
    const text = `# المقدمة\n\nنص المقدمة هنا.\n\n# الفصل الأول\n\nمتن الفصل الأول.\n\n# الفصل الثاني\n\nمتن الفصل الثاني.`;
    const chapters = detectChapters(text);
    expect(chapters.map((c) => c.title)).toEqual(["المقدمة", "الفصل الأول", "الفصل الثاني"]);
    expect(chapters[1].text).toBe("متن الفصل الأول.");
  });

  it("النص السابق لأول عنوان يصبح مقدمة ولا يُفقد", () => {
    const text = `كلام تمهيدي قبل أي عنوان.\n\n# الفصل الأول\n\nمتن الفصل.`;
    const chapters = detectChapters(text);
    expect(chapters[0].text).toBe("كلام تمهيدي قبل أي عنوان.");
    expect(chapters).toHaveLength(2);
  });

  it("العناوين الفارغة من المتن تُسقط", () => {
    const chapters = detectChapters(`# عنوان بلا متن\n\n# الفصل الأول\n\nمتن.`);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("الفصل الأول");
  });
});

describe("بناء فهرس الكتاب", () => {
  it("نص بلا عناوين يُقسَّم إلى مقاطع متوازنة عند حدود الفقرات", () => {
    const text = Array.from({ length: 40 }, () => paragraph.trim()).join("\n\n");
    const outline = buildOutline(text);
    expect(outline.chapters.length).toBeGreaterThan(1);
    expect(outline.chapters[0].title).toBe("المقطع ١");
    for (const chapter of outline.chapters) {
      expect(chapter.chars).toBeLessThanOrEqual(AUDIOBOOK_LIMITS.maxChapterChars);
    }
  });

  it("لا يفقد شيئاً من النص عند التقسيم", () => {
    const text = `# الفصل الأول\n\n${paragraph.trim()}\n\n# الفصل الثاني\n\n${paragraph.trim()}`;
    const outline = buildOutline(text);
    const rejoined = outline.chapters
      .map((c) => c.text)
      .join(" ")
      .replace(/\s+/g, " ");
    expect(rejoined).toContain(paragraph.trim().slice(0, 60));
    expect(outline.totalChars).toBeGreaterThanOrEqual(paragraph.trim().length * 2);
  });

  it("عنوان الكتاب يُؤخذ من المستخدم ثم من أول عنوان في النص", () => {
    expect(buildOutline("# رحلة إلى الشرق\n\nمتن الكتاب.").title).toBe("رحلة إلى الشرق");
    expect(buildOutline("# رحلة إلى الشرق\n\nمتن.", "اسم مختار").title).toBe("اسم مختار");
  });

  it("النص الأطول من الحد يُقتطع مع تعليمه", () => {
    const outline = buildOutline("ا".repeat(AUDIOBOOK_LIMITS.maxInputChars + 500));
    expect(outline.truncated).toBe(true);
    expect(outline.totalChars).toBeLessThanOrEqual(AUDIOBOOK_LIMITS.maxInputChars);
  });

  it("عدد الفصول لا يتجاوز الحد ولو كثرت العناوين", () => {
    const text = Array.from(
      { length: AUDIOBOOK_LIMITS.maxChapters + 30 },
      (_, i) => `# الفصل ${i + 1}\n\nمتن قصير للفصل رقم ${i + 1}.`
    ).join("\n\n");
    const outline = buildOutline(text);
    expect(outline.chapters.length).toBeLessThanOrEqual(AUDIOBOOK_LIMITS.maxChapters);
    // الدمج لا يفقد نصاً: متن الفصل الأخير ما زال موجوداً
    expect(outline.chapters.some((c) => c.text.includes(`رقم ${AUDIOBOOK_LIMITS.maxChapters + 30}`))).toBe(true);
  });

  it("الفصل الأطول من الحد يُقسَّم إلى أجزاء مرقّمة", () => {
    const long = "جملة طويلة داخل فصل ضخم جداً. ".repeat(700);
    const outline = buildOutline(`# فصل ضخم\n\n${long}`);
    expect(outline.chapters.length).toBeGreaterThan(1);
    expect(outline.chapters[0].title).toContain("فصل ضخم");
    expect(outline.chapters[0].title).toContain("١/");
  });
});

describe("تقدير المدة وعرضها", () => {
  it("المدة تتناسب عكسياً مع سرعة القراءة", () => {
    expect(estimateSeconds(1400)).toBe(100);
    expect(estimateSeconds(1400, 2)).toBe(50);
  });

  it("الصياغة العربية للمدة", () => {
    expect(formatDuration(45)).toBe("٤٥ ثانية");
    expect(formatDuration(300)).toBe("٥ دقيقة");
    expect(formatDuration(3600)).toBe("ساعة");
    expect(formatDuration(7920)).toBe("ساعتان و١٢ دقيقة");
    expect(formatDuration(10800)).toBe("٣ ساعات");
  });

  it("الأرقام تُكتب بالصيغة الهندية العربية", () => {
    expect(toArabicDigits(2026)).toBe("٢٠٢٦");
  });
});
