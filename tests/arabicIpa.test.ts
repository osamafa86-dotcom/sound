import { describe, expect, it } from "vitest";
import { applyIpa, arabicToIpa, hasDiacritics, stripDiacritics } from "@/lib/arabic/ipa";

/**
 * الكتابة الصوتية للكلمة المشكولة — حتمية بقواعد الفصحى. الحالة الأولى هي
 * التي كشفها المالك: «أُحُد» قُرئت «أُحَد» على الجيل الرابع، وكتابتها
 * الصوتية /ʔuħud/ نُطقت صحيحة في 4 من 4 حتى بثبات 0.3 مع وسم أداء.
 */

describe("الكلمة المشكولة ← IPA", () => {
  it.each([
    ["أُحُد", "ʔuħud"],
    ["اُحُد", "ʔuħud"],
    ["أَحَد", "ʔaħad"],
    ["مَعْرَكَةُ", "maʕrakatu"],
    ["مَدْرَسَة", "madrasa"],
    ["عِلْمٌ", "ʕilmun"],
    ["عَلَمٌ", "ʕalamun"],
    ["مُحَمَّدٌ", "muħammadun"],
    ["قَالَ", "qaːla"],
    ["يَقُولُ", "jaquːlu"],
    ["كَبِيرٌ", "kabiːrun"],
    ["يَوْمٌ", "jawmun"],
    ["سُئِلَ", "suʔila"],
    ["حَقّ", "ħaqq"],
    ["كِتَابًا", "kitaːban"],
    ["كِتَاباً", "kitaːban"],
    ["هُدًى", "hudan"],
    ["عَلَى", "ʕalaː"],
    ["إِلَى", "ʔilaː"],
    ["هٰذِهِ", "haːðihi"],
    ["هٰذَا", "haːðaː"],
    ["لٰكِنَّ", "laːkinna"],
    ["اللّٰه", "allaːh"],
    ["الشَّمْسُ", "aʃʃamsu"],
    ["الْقَمَرُ", "alqamaru"],
    ["الكِتَابُ", "alkitaːbu"],
    ["وَالشَّمْسِ", "waʃʃamsi"],
    ["وَالْقَمَرِ", "walqamari"],
    ["وَالِدٌ", "waːlidun"],
    ["لِلشَّمْسِ", "liʃʃamsi"],
    ["الَّذِي", "allaðiː"],
    ["قُرْآنٌ", "qurʔaːnun"],
    ["مَسْؤُولٌ", "masʔuːlun"],
    ["مَاءٌ", "maːʔun"],
    ["جُزْءًا", "dʒuzʔan"],
    ["طَالِبٌ", "tˤaːlibun"],
    ["ظَهَرَ", "ðˤahara"],
    ["الحَاجُّ", "alħaːddʒu"],
    ["الصَّبْرُ", "assˤabru"],
  ])("%s ← /%s/", (word, ipa) => {
    expect(arabicToIpa(word)).toBe(ipa);
  });

  it("ما ينقصه تشكيل يحسم نطقه يعيد null — لا كتابة صوتية مخمَّنة", () => {
    expect(arabicToIpa("أحد")).toBeNull();
    expect(arabicToIpa("كتاب")).toBeNull();
    expect(arabicToIpa("مَعركة")).toBeNull();
    expect(arabicToIpa("hello")).toBeNull();
    expect(arabicToIpa("")).toBeNull();
  });
});

describe("استبدال الكلمات الحساسة في النص", () => {
  it("يستبدل الكلمة كاملةً بكتابتها الصوتية بين شرطتين", () => {
    expect(applyIpa("هٰذِهِ مَعْرَكَةُ أُحُد", ["أُحُد"])).toBe("هٰذِهِ مَعْرَكَةُ /ʔuħud/");
  });

  it("لا يمس الكلمة داخل كلمة أطول، ولا ما لا يُحسم", () => {
    expect(applyIpa("جَبَلُ أُحُدٍ وَأُحُد", ["أُحُد"])).toBe("جَبَلُ أُحُدٍ وَأُحُد");
    expect(applyIpa("معركة أحد", ["أحد"])).toBe("معركة أحد");
  });

  it("كل تكرار يُستبدل، والوسوم والترقيم حولها تبقى", () => {
    expect(applyIpa("[sad] أُحُد، ثُمَّ أُحُد!", ["أُحُد"])).toBe("[sad] /ʔuħud/، ثُمَّ /ʔuħud/!");
  });

  it("أدوات التشكيل", () => {
    expect(hasDiacritics("أُحُد")).toBe(true);
    expect(hasDiacritics("أحد")).toBe(false);
    expect(stripDiacritics("مَعْرَكَةُ أُحُدٍ")).toBe("معركة أحد");
  });
});

describe("أدوات المحرر", () => {
  it("tokenizeArabic يقطّع الكلمات ويُبقي ما بينها كما هو", async () => {
    const { tokenizeArabic } = await import("@/lib/arabic/ipa");
    const tokens = tokenizeArabic("مَعْرَكَةُ أُحُد، [sad] تمّت.");
    expect(tokens.map((t) => t.text).join("")).toBe("مَعْرَكَةُ أُحُد، [sad] تمّت.");
    expect(tokens.filter((t) => t.word).map((t) => t.text)).toEqual(["مَعْرَكَةُ", "أُحُد", "sad", "تمّت"]);
  });

  it("enforceableWords يُبقي ما تحسمه حركاته وحده", async () => {
    const { enforceableWords } = await import("@/lib/arabic/ipa");
    expect(enforceableWords(["أُحُد", "أحد", "أُحُد", "مَعركة"])).toEqual(["أُحُد"]);
  });

  it("ترويسة الكلمات المفروضة: ترميز آمن ذهاباً وإياباً، وأي تلف يعود فارغاً", async () => {
    const { encodeCriticalHeader, decodeCriticalHeader } = await import("@/lib/arabic/ipa");
    const encoded = encodeCriticalHeader(["أُحُد", "عِلْمٌ"]);
    expect(/^[\x20-\x7e]+$/.test(encoded)).toBe(true);
    expect(decodeCriticalHeader(encoded)).toEqual(["أُحُد", "عِلْمٌ"]);
    expect(decodeCriticalHeader(null)).toEqual([]);
    expect(decodeCriticalHeader("%E0%A4%A")).toEqual([]);
  });
});
