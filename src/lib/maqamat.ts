export type Maqam = {
  id: string;
  name: string;
  mood: string;
  description: string;
  /** درجات السلّم بالنسبة لدرجة الأساس، بوحدة نصف النغمة (0.5 = ربع نغمة) */
  scale: number[];
  /** وصف الأسلوب بالإنجليزية — يُستخدم لبناء البرومبت الموسيقي لمحركات التوليد */
  stylePrompt: string;
};

export const MAQAMAT: Maqam[] = [
  {
    id: "bayati",
    name: "بياتي",
    mood: "دافئ، حنون، شعبي",
    description: "أكثر المقامات انتشاراً في الغناء العربي، يمتاز بدفء وقرب من الوجدان.",
    scale: [0, 1.5, 3, 5, 7, 8, 10, 12],
    stylePrompt: "Arabic maqam Bayati, warm emotional tarab, quarter tones",
  },
  {
    id: "hijaz",
    name: "حجاز",
    mood: "شرقي، روحاني، شجي",
    description: "المقام الشرقي الأشهر بطابعه الروحاني، حاضر في الأذان والموشحات.",
    scale: [0, 1, 4, 5, 7, 8, 10, 12],
    stylePrompt: "Arabic maqam Hijaz, spiritual oriental melody, expressive ornamentation",
  },
  {
    id: "rast",
    name: "راست",
    mood: "فخم، متزن، أصيل",
    description: "«أبو المقامات» — أساس الغناء الطربي الكلاسيكي، متزن وفخم.",
    scale: [0, 2, 3.5, 5, 7, 9, 10.5, 12],
    stylePrompt: "Arabic maqam Rast, classical tarab grandeur, quarter tones",
  },
  {
    id: "saba",
    name: "صبا",
    mood: "حزين، عميق، مؤثر",
    description: "مقام الشجن والحزن العميق، يلمس القلب مباشرة.",
    scale: [0, 1.5, 3, 4, 6, 8, 10, 12],
    stylePrompt: "Arabic maqam Saba, deep melancholic sorrowful melody, quarter tones",
  },
  {
    id: "kurd",
    name: "كرد",
    mood: "رومانسي، عصري، سلس",
    description: "مقام الأغنية العصرية والرومانسية، سلس وقريب من الأذن الحديثة.",
    scale: [0, 1, 3, 5, 7, 8, 10, 12],
    stylePrompt: "Arabic maqam Kurd, modern romantic Arabic pop feel",
  },
  {
    id: "nahawand",
    name: "نهاوند",
    mood: "عاطفي، درامي",
    description: "قريب من السلّم الصغير الغربي، مثالي للأغاني العاطفية والدرامية.",
    scale: [0, 2, 3, 5, 7, 8, 11, 12],
    stylePrompt: "Arabic maqam Nahawand, dramatic emotional minor-like melody",
  },
  {
    id: "ajam",
    name: "عجم",
    mood: "مشرق، احتفالي",
    description: "قريب من السلّم الكبير الغربي، مشرق ومناسب للأناشيد والأغاني الحماسية.",
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    stylePrompt: "Arabic maqam Ajam, bright celebratory major-like anthem",
  },
  {
    id: "sikah",
    name: "سيكاه",
    mood: "تراثي، مميز",
    description: "مقام ذو شخصية فريدة يبدأ من ربع نغمة، حاضر بقوة في التراث والموشحات.",
    scale: [0, 2, 3.5, 5.5, 7, 8.5, 10.5, 12],
    stylePrompt: "Arabic maqam Sikah, traditional heritage muwashah character, quarter tones",
  },
];

export const INSTRUMENTS = [
  { id: "oud", name: "عود", en: "oud" },
  { id: "qanun", name: "قانون", en: "qanun" },
  { id: "nay", name: "ناي", en: "nay flute" },
  { id: "violin", name: "كمان شرقي", en: "Arabic violin section" },
  { id: "darbuka", name: "دربكة وإيقاع", en: "darbuka percussion" },
  { id: "strings", name: "وتريات حديثة", en: "modern strings and pads" },
] as const;

export const SONG_STYLES = [
  { id: "tarab", name: "طرب كلاسيكي", en: "classical Arabic tarab" },
  { id: "pop", name: "بوب عربي عصري", en: "modern Arabic pop" },
  { id: "muwashah", name: "موشح / تراثي", en: "traditional muwashah" },
  { id: "instrumental", name: "موسيقى آلية (بدون غناء)", en: "instrumental only, no vocals" },
] as const;

/** لهجات كتابة الكلمات المتاحة في مساعد الذكاء الاصطناعي */
export const DIALECTS = [
  { id: "fusha", name: "فصحى", en: "Modern Standard Arabic" },
  { id: "egyptian", name: "مصرية", en: "Egyptian Arabic dialect" },
  { id: "gulf", name: "خليجية", en: "Gulf Arabic dialect" },
  { id: "levantine", name: "شامية", en: "Levantine Arabic dialect" },
  { id: "iraqi", name: "عراقية", en: "Iraqi Arabic dialect" },
  { id: "maghrebi", name: "مغربية", en: "Maghrebi Arabic dialect" },
] as const;
