import { describe, expect, it } from "vitest";
import { sanitizePlan } from "@/lib/assistant/plan";
import { mockAssistant } from "@/lib/assistant/mock";

describe("تعقيم الخطة الذكية ضد الكتالوجات", () => {
  it("يمرر خطة سليمة كما هي", () => {
    const plan = sanitizePlan({
      styleId: "shajan",
      singer: "male",
      dialectId: "palestinian",
      instrumentIds: ["oud", "nay"],
      bpm: 72,
      reason: "الكلمات حزينة",
    })!;
    expect(plan.styleId).toBe("shajan");
    expect(plan.singer).toBe("male");
    expect(plan.dialectId).toBe("palestinian");
    expect(plan.instrumentIds).toEqual(["oud", "nay"]);
    expect(plan.bpm).toBe(72);
  });

  it("القيم الخارجة عن الكتالوجات تُستبدل بافتراضات آمنة", () => {
    const plan = sanitizePlan({
      styleId: "death-metal",
      singer: "robot",
      dialectId: "klingon",
      instrumentIds: ["guitar-hero", "oud", "theremin"],
      bpm: 900,
      reason: 42,
    })!;
    expect(plan.styleId).toBe("tarab");
    expect(plan.singer).toBe("female");
    expect(plan.dialectId).toBe("fusha");
    expect(plan.instrumentIds).toEqual(["oud"]); // غير المعروف يُرشَّح
    expect(plan.bpm).toBe(200); // يُحصر بسقف المنصة
    expect(plan.reason).toBe("");
  });

  it("bpm صفر ⟵ null: متروك لتقدير المحرك", () => {
    expect(sanitizePlan({ bpm: 0 })!.bpm).toBeNull();
    expect(sanitizePlan({})!.bpm).toBeNull();
  });

  it("آلات فارغة ⟵ تخت شرقي افتراضي، وغير الكائن ⟵ undefined", () => {
    expect(sanitizePlan({ instrumentIds: [] })!.instrumentIds).toEqual(["oud", "qanun", "darbuka"]);
    expect(sanitizePlan(null)).toBeUndefined();
    expect(sanitizePlan("plan")).toBeUndefined();
  });
});

describe("الخطة في الوضع التجريبي", () => {
  it("وضع الخطة: كلمات المستخدم تعود حرفياً ومعها خطة كاملة", async () => {
    const lyrics = "يا دار جدي وقفت بالباب\nوالدمع من عيني ما غاب";
    const r = await mockAssistant.assist({
      mode: "plan",
      lyrics,
      dialectId: "palestinian",
      styleId: "tarab",
      auto: true,
    });
    expect(r.lyrics).toBe(lyrics);
    expect(r.plan).toBeDefined();
    expect(r.plan!.instrumentIds.length).toBeGreaterThan(0);
    expect(r.plan!.dialectId).toBe("palestinian");
  });

  it("اللون يُستنتج من الكلمات المفتاحية: الرثاء رثاءً والعرس أفراحاً", async () => {
    const ritha = await mockAssistant.assist({
      mode: "write",
      idea: "رثاء جدي الذي رحل وترك الدار",
      dialectId: "fusha",
      styleId: "tarab",
      auto: true,
    });
    expect(ritha.plan?.styleId).toBe("ritha");

    const afrah = await mockAssistant.assist({
      mode: "write",
      idea: "زفة عريس في حارة العيلة",
      dialectId: "fusha",
      styleId: "tarab",
      auto: true,
    });
    expect(afrah.plan?.styleId).toBe("afrah");
  });

  it("بلا auto: لا خطة، والأسلوب يبقى خيار المستخدم", async () => {
    const r = await mockAssistant.assist({
      mode: "write",
      idea: "فرحة النجاح",
      dialectId: "fusha",
      styleId: "pop",
    });
    expect(r.plan).toBeUndefined();
    expect(r.stylePromptEn).toContain("modern Arabic pop");
  });
});
