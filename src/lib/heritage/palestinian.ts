/**
 * ذاكرة التراث الغنائي الفلسطيني — مرجع المنصة للأداء الفلسطيني الأصيل.
 *
 * ثلاث طبقات تتغذى منها:
 * 1. محركات التوليد: الحمض الموسيقي لكل قالب (إيقاع، آلات، مقام، طابع أداء)
 * 2. مساعد الكلمات: بنية كل قالب الشعرية ومعجم الأغنية الفلسطينية
 * 3. المدقق: خصوصيات النطق الفلسطيني في التشكيل
 *
 * المعرفة هنا بذرة ثابتة منتقاة؛ والتعلم المتراكم (سلالات البرومبتات،
 * الأمثلة الناجحة، ذاكرة النطق) يبني فوقها مع كل استخدام.
 */

export type HeritageStyle = {
  /** يطابق معرّف الأسلوب في SONG_STYLES */
  id: string;
  name: string;
  /** الحمض الموسيقي — يُحقن في برومبت المحرك */
  dna: string;
  /** البنية الشعرية — تُحقن في مساعد الكلمات */
  structureHint: string;
  /** المقامات الأليفة لهذا القالب */
  maqamIds: string[];
};

export const PALESTINIAN_STYLES: HeritageStyle[] = [
  {
    id: "dal3ona",
    name: "دلعونا",
    dna: "Dal'ona — the iconic Palestinian folk form: driving dabke groove in 4/4 at 115-130 BPM with tabla, daff frame drum and floor-stomp accents; lead mijwiz or yarghul double-reed over a sustained drone with oud fills; strophic AAAB quatrains answered by the beloved communal refrain 'Ala Dal'ona; jins Bayati melody within one octave; open-throat rural voice, joyous wedding energy, group answering vocals",
    structureHint:
      "بنية الدلعونا: مقاطع من أربع شطرات بقافية (أ أ أ ب)، الشطر الرابع يمهد للازمة الجماعية «ع الدلعونا»، واللازمة تتكرر بعد كل مقطع بصوت جماعي.",
    maqamIds: ["bayati", "kurd"],
  },
  {
    id: "ataba",
    name: "عتابا وميجانا",
    dna: "Ataba & Mijana — improvised Palestinian sung poetry: free-rhythm rubato mawwal verses over sparse oud and nay, long expressive melisma on Bayati or Saba carrying deep longing; each quatrain plays jinas wordplay (three lines ending in the same sound with different meanings, the fourth resolving on '-aba'); after the mawwal the communal Mijana refrain 'Mijana wa ya Mijana' enters at a gentle 4/4 with daff",
    structureHint:
      "بنية العتابا: رباعيات بجناس لفظي — ثلاثة أشطر تنتهي بلفظ متشابه مختلف المعنى، والرابع ينتهي بـ«ـابا»، وبعد الموّال لازمة «ميجانا ويا ميجانا» الجماعية.",
    maqamIds: ["bayati", "saba"],
  },
  {
    id: "zarif",
    name: "زريف الطول",
    dna: "Zarif al-Tul — beloved Palestinian folk melody: bright dabke-tinged 4/4 around 110 BPM, Bayati strophic verses addressing 'ya zarif al-tul', shubbabeh reed flute and oud lead, communal clapping and answering chorus, playful longing suspended between celebration and the sorrow of departure",
    structureHint:
      "بنية زريف الطول: مقاطع تخاطب «يا زريف الطول» بمطلعها الشهير، قافية موحدة داخل كل مقطع، ولازمة قصيرة يردها الجمع.",
    maqamIds: ["bayati"],
  },
  {
    id: "dabke",
    name: "دبكة شعبية",
    dna: "Palestinian dabke — high-energy line-dance: pounding syncopated darbuka with heavy synchronized floor-stomps at 120-140 BPM, screaming mijwiz lead over drone, call-and-response crowd shouts (hey! yalla! oof!), sahje hand-clap breakdowns, relentless communal energy of a Palestinian village wedding at full blaze",
    structureHint:
      "بنية أهزوجة الدبكة: عبارات قصيرة حماسية متكررة بردات جماعية (هيه! يلا!)، ومساحات لصيحات الجمهور وتصفيق السحجة بين المقاطع.",
    maqamIds: ["bayati", "kurd", "ajam"],
  },
  {
    id: "watani-ps",
    name: "وطنية فلسطينية",
    dna: "Palestinian patriotic anthem — cinematic and defiant: orchestral strings fused with folk instruments (oud, qanun, mijwiz accents), Ajam or Nahawand, dynamics building from solemn verses to a soaring layered-choir chorus, themes of land, olive trees, return and steadfast sumud, dignified powerful delivery",
    structureHint:
      "بنية النشيد الوطني الفلسطيني: مطلع مهيب متأملّ، لازمة جامعة سهلة الترديد الجماعي، وتصاعد شعوري نحو الختام — بمفردات الأرض والزيتون والعودة والصمود.",
    maqamIds: ["ajam", "nahawand", "bayati"],
  },
];

/** معجم الأغنية الفلسطينية وبيئتها — يوجه مساعد الكلمات */
export const PALESTINIAN_SONGWRITING_GUIDE = `مرجع كتابة الأغنية الفلسطينية:
- المعجم التراثي: يمّا، ولفي، الدار، البيارة، الزيتون والزعتر، الميرمية، الحنّون، السطوح، العين (نبع الماء)، الشال والكوفية، جفرا، الروزنا.
- التراكيب الفلسطينية: «ع» بدل «على»، «هالـ» للإشارة، «بدّي»، «تع/تعال»، «وين»، «هلّق/هسّا».
- روح الأداء: الرد الجماعي حاضر (اللازمة يرددها الجمع)، وفي الأفراح تحضر الزغاريد و«أويها».
- الصور من البيئة الفلسطينية: الجبل والبحر والبرتقال والقمح والحصاد ودوالي العنب — لا صوراً عامة بلا هوية.`;

/** خصوصيات النطق الفلسطيني — توجّه المدقق المُشكِّل (تشكيل فقط، لا تغيير رسم) */
export const PALESTINIAN_PRONUNCIATION_GUIDE = `خصوصيات التشكيل الفلسطيني (دون تغيير رسم الحروف أبداً):
- تسكين أواخر الكلمات هو الأصل في الوقف الغنائي العامي.
- الإمالة في تاء التأنيث: اكسر ما قبلها (مَدْرَسِة، دَارِة، حَبِيبِة).
- «ع» و«هالـ» و«بدّي» تُشكَّل كما تُنطق: عَـ، هَالْـ، بِدِّي.
- القاف تبقى برسمها؛ حركاتها تتبع سياق الكلمة العامية لا قواعد الفصحى.
- لا تنوين في العامية — استخدم السكون أو الحركة الطويلة بدلاً منه.`;

/** توجيه الأداء الصوتي الفلسطيني للمحركات */
export function heritageDeliveryEn(dialectId?: string, styleId?: string): string {
  if (dialectId !== "palestinian") return "";
  const base =
    "authentic Palestinian Levantine accent, native-speaker pronunciation with imala (final taa marbuta coloured toward -eh) and word-final consonant rests";
  return heritageStyle(styleId)
    ? `${base}, rural fallahi folk pronunciation and open-throat village vocal timbre`
    : base;
}

export function heritageStyle(styleId?: string): HeritageStyle | null {
  return PALESTINIAN_STYLES.find((s) => s.id === styleId) ?? null;
}

/** كتلة تُحقن في مساعد الكلمات عند السياق الفلسطيني */
export function heritageAssistBlock(dialectId?: string, styleId?: string): string {
  const parts: string[] = [];
  const style = heritageStyle(styleId);
  if (style) parts.push(style.structureHint);
  if (dialectId === "palestinian") parts.push(PALESTINIAN_SONGWRITING_GUIDE);
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
}

/** معرّفات القوالب التراثية — لواجهة الاستوديو (اختيار اللهجة تلقائياً) */
export const HERITAGE_STYLE_IDS = PALESTINIAN_STYLES.map((s) => s.id);
