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
    stylePrompt:
      "Arabic maqam Bayati on D (jins Bayati root: D, E half-flat quarter tone, F, G), warm intimate folk tarab, tender vocal phrases descending to the tonic, maqsum and baladi rhythms",
  },
  {
    id: "hijaz",
    name: "حجاز",
    mood: "شرقي، روحاني، شجي",
    description: "المقام الشرقي الأشهر بطابعه الروحاني، حاضر في الأذان والموشحات.",
    scale: [0, 1, 4, 5, 7, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Hijaz on D (jins Hijaz: half step then augmented second, D Eb F# G), spiritual devotional atmosphere of adhan and muwashahat, rich melisma and ornamentation, expressive long-breathed phrases",
  },
  {
    id: "rast",
    name: "راست",
    mood: "فخم، متزن، أصيل",
    description: "«أبو المقامات» — أساس الغناء الطربي الكلاسيكي، متزن وفخم.",
    scale: [0, 2, 3.5, 5, 7, 9, 10.5, 12],
    stylePrompt:
      "Arabic maqam Rast on C (quarter tones: E half-flat and B half-flat), the father of maqamat, stately classical tarab grandeur, golden-age orchestra, samai and wahda rhythms, dignified noble melody",
  },
  {
    id: "saba",
    name: "صبا",
    mood: "حزين، عميق، مؤثر",
    description: "مقام الشجن والحزن العميق، يلمس القلب مباشرة.",
    scale: [0, 1.5, 3, 4, 6, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Saba on D (jins Saba: D, E half-flat quarter tone, F, G-flat — its diminished fourth is the sound of grief), deep melancholic lament, weeping nay and violin, slow heavy phrases sinking downward",
  },
  {
    id: "kurd",
    name: "كرد",
    mood: "رومانسي، عصري، سلس",
    description: "مقام الأغنية العصرية والرومانسية، سلس وقريب من الأذن الحديثة.",
    scale: [0, 1, 3, 5, 7, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Kurd on D (jins Kurd, phrygian-like half step above tonic, no quarter tones), smooth modern romantic Arabic pop, contemporary production with oriental strings, flowing catchy melody",
  },
  {
    id: "nahawand",
    name: "نهاوند",
    mood: "عاطفي، درامي",
    description: "قريب من السلّم الصغير الغربي، مثالي للأغاني العاطفية والدرامية.",
    scale: [0, 2, 3, 5, 7, 8, 11, 12],
    stylePrompt:
      "Arabic maqam Nahawand on C (harmonic-minor-like with raised seventh), dramatic cinematic emotion, passionate rises and falls, orchestral Arabic ballad intensity, aching romantic climaxes",
  },
  {
    id: "ajam",
    name: "عجم",
    mood: "مشرق، احتفالي",
    description: "قريب من السلّم الكبير الغربي، مشرق ومناسب للأناشيد والأغاني الحماسية.",
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    stylePrompt:
      "Arabic maqam Ajam on Bb (major-like scale), bright celebratory anthem, triumphant uplifting energy, festive full arrangement with driving percussion, patriotic joyful chorus feel",
  },
  {
    id: "sikah",
    name: "سيكاه",
    mood: "تراثي، مميز",
    description: "مقام ذو شخصية فريدة يبدأ من ربع نغمة، حاضر بقوة في التراث والموشحات.",
    scale: [0, 2, 3.5, 5.5, 7, 8.5, 10.5, 12],
    stylePrompt:
      "Arabic maqam Sikah (tonic on E half-flat quarter tone, jins Sikah trichord), distinctive floating heritage color of Andalusian muwashahat, samai thaqil 10/8 rhythm, ornamented traditional takht ensemble",
  },
];

export const INSTRUMENTS = [
  { id: "oud", name: "عود", en: "oud" },
  { id: "qanun", name: "قانون", en: "qanun" },
  { id: "nay", name: "ناي", en: "nay flute" },
  { id: "violin", name: "كمان شرقي", en: "Arabic violin section" },
  { id: "darbuka", name: "دربكة وإيقاع", en: "darbuka percussion" },
  { id: "daff", name: "دف", en: "daff frame drum" },
  { id: "tabl", name: "طبل", en: "tabl baladi bass drum" },
  { id: "mijwiz", name: "مجوز ويرغول", en: "mijwiz and yarghul double-reed" },
  { id: "shubbabeh", name: "شبابة", en: "shubbabeh reed flute" },
  { id: "piano", name: "بيانو", en: "piano" },
  { id: "strings", name: "وتريات حديثة", en: "modern strings and pads" },
] as const;

/**
 * الأجواء الجاهزة — ضغطة واحدة تضبط الآلات وطابع الترتيب معاً.
 * en يُضاف لبرومبت المحرك، وinstrumentIds تحل محل الاختيار اليدوي.
 */
export const AMBIENCES = [
  {
    id: "duff-tabl",
    name: "🥁 دف وطبل تراثي",
    en: "traditional percussion-forward arrangement: daff frame drum and tabl baladi leading, hand-clap accents, minimal melodic backing",
    instrumentIds: ["daff", "tabl", "oud"],
  },
  {
    id: "piano-calm",
    name: "🎹 بيانو هادئ",
    en: "intimate calm piano-led arrangement with soft strings, gentle and spacious, ballad mood",
    instrumentIds: ["piano", "strings", "nay"],
  },
  {
    id: "nasheed",
    name: "🕌 إنشاد إسلامي",
    en: "Islamic nasheed style: expressive vocals with daff percussion only, no melodic instruments, layered vocal harmonies, reverent devotional atmosphere",
    instrumentIds: ["daff"],
  },
  {
    id: "dabke-folk",
    name: "🪘 مجوز ودبكة",
    en: "Palestinian dabke folk band: screaming mijwiz lead over drone, pounding darbuka and tabl, stomping communal energy",
    instrumentIds: ["mijwiz", "darbuka", "tabl"],
  },
  {
    id: "orchestra",
    name: "🎻 أوركسترا شرقية",
    en: "full Arabic orchestra: lush violin sections, qanun and oud interplay, nay solos, golden-age cinematic production",
    instrumentIds: ["violin", "qanun", "oud", "nay"],
  },
] as const;

export const SONG_STYLES = [
  { id: "tarab", name: "طرب كلاسيكي", en: "classical Arabic tarab" },
  { id: "pop", name: "بوب عربي عصري", en: "modern Arabic pop" },
  { id: "muwashah", name: "موشح / تراثي", en: "traditional muwashah" },
  // قوالب التراث الفلسطيني — حمضها الموسيقي الكامل في lib/heritage/palestinian
  { id: "dal3ona", name: "🇵🇸 دلعونا", en: "Palestinian Dal'ona folk song" },
  { id: "ataba", name: "🇵🇸 عتابا وميجانا", en: "Palestinian Ataba and Mijana sung poetry" },
  { id: "zarif", name: "🇵🇸 زريف الطول", en: "Palestinian Zarif al-Tul folk song" },
  { id: "dabke", name: "🇵🇸 دبكة شعبية", en: "Palestinian dabke line-dance song" },
  { id: "watani-ps", name: "🇵🇸 وطنية فلسطينية", en: "Palestinian patriotic anthem" },
  { id: "instrumental", name: "موسيقى آلية (بدون غناء)", en: "instrumental only, no vocals" },
] as const;

/** لهجات كتابة الكلمات المتاحة في مساعد الذكاء الاصطناعي */
export const DIALECTS = [
  { id: "fusha", name: "فصحى", en: "Modern Standard Arabic" },
  { id: "egyptian", name: "مصرية", en: "Egyptian Arabic dialect" },
  { id: "gulf", name: "خليجية", en: "Gulf Arabic dialect" },
  { id: "levantine", name: "شامية", en: "Levantine Arabic dialect" },
  { id: "palestinian", name: "فلسطينية", en: "Palestinian Arabic dialect" },
  { id: "iraqi", name: "عراقية", en: "Iraqi Arabic dialect" },
  { id: "maghrebi", name: "مغربية", en: "Maghrebi Arabic dialect" },
] as const;
