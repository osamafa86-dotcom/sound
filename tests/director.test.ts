import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_STYLES,
  STYLE_CATEGORIES,
  STYLE_LAYERS,
  getLayers,
  layerTagPrefix,
} from "@/lib/performance/styles";
import { stutterize } from "@/lib/performance/tags";

describe("التلعثم المتعمد", () => {
  it("يحوّل الكلمة المحددة إلى تلعثم بحرفها الأول", () => {
    const text = "قلت أنا لم أقصد";
    const start = text.indexOf("أنا");
    const out = stutterize(text, start, start + 3);
    expect(out.text).toBe("قلت أـ أـ أنا لم أقصد");
  });

  it("بلا تحديد: يتوسع لحدود الكلمة المحيطة بالمؤشر", () => {
    const text = "لم أقصد ذلك";
    const cursor = text.indexOf("أقصد") + 2;
    const out = stutterize(text, cursor, cursor);
    expect(out.text).toBe("لم أـ أـ أقصد ذلك");
    expect(out.cursor).toBe(out.text.indexOf("أقصد") + "أقصد".length);
  });

  it("يعيد النص كما هو عندما لا توجد كلمة عربية", () => {
    const text = "123 !!";
    expect(stutterize(text, 0, 3).text).toBe(text);
  });
});

describe("مكتبة المشاهد والطبقات", () => {
  it("المعرّفات فريدة عبر الأساليب والطبقات معاً", () => {
    const ids = [...PERFORMANCE_STYLES.map((s) => s.id), ...STYLE_LAYERS.map((l) => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("كل فئة معلنة فيها أسلوب واحد على الأقل", () => {
    for (const cat of STYLE_CATEGORIES) {
      expect(
        PERFORMANCE_STYLES.some((s) => s.category === cat),
        `فئة ${cat} فارغة`
      ).toBe(true);
    }
  });

  it("تركيب وسوم الطبقات: كل وسم بين قوسين ويتجاهل المعرفات المجهولة", () => {
    const prefix = layerTagPrefix(["shivering", "old-radio", "unknown-id"]);
    expect(prefix).toMatch(/^\[.+\] \[.+\]$/);
    expect(getLayers(["unknown-id"])).toHaveLength(0);
  });

  it("وسوم المشاهد إنجليزية خالصة — بادئة صالحة للمحرك", () => {
    for (const s of PERFORMANCE_STYLES.filter((x) => x.category === "مشاهد")) {
      for (const t of s.tags) expect(t).toMatch(/^[a-zA-Z0-9\s,'-]+$/);
    }
  });
});
