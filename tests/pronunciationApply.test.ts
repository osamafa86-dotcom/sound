import { describe, expect, it } from "vitest";
import { applyPronunciationRules } from "@/lib/pronunciation";

describe("تطبيق ذاكرة النطق على كلمات الغناء", () => {
  it("يستبدل الكلمة كاملة بصيغتها المنطوقة", () => {
    const out = applyPronunciationRules("رحنا على المدرسة مبكرين", [
      { word: "المدرسة", alias: "المَدْرَسِة" },
    ]);
    expect(out).toBe("رحنا على المَدْرَسِة مبكرين");
  });

  it("لا يستبدل داخل كلمة أخرى", () => {
    const out = applyPronunciationRules("قال مقال", [{ word: "قال", alias: "آل" }]);
    expect(out).toBe("آل مقال");
  });

  it("يستبدل كل التكرارات وفي أول السطر وآخره", () => {
    const out = applyPronunciationRules("يافا يا يافا", [{ word: "يافا", alias: "يَافَا" }]);
    expect(out).toBe("يَافَا يا يَافَا");
  });

  it("يتجاهل القواعد الفارغة أو المطابقة لنفسها", () => {
    const text = "نص كما هو";
    expect(applyPronunciationRules(text, [{ word: "", alias: "x" }, { word: "نص", alias: "نص" }])).toBe(text);
  });

  it("أكثر من قاعدة تُطبَّق معاً", () => {
    const out = applyPronunciationRules("جيت من القدس على عمان", [
      { word: "القدس", alias: "القُدِس" },
      { word: "عمان", alias: "عَمَّان" },
    ]);
    expect(out).toBe("جيت من القُدِس على عَمَّان");
  });
});
