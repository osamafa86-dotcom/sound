/** عائلة اللون الموسيقي — للتصفية في الواجهة وتنويع ألوان الطرب */
export type MaqamFamily = "arabic" | "turkish" | "western";

export const MAQAM_FAMILIES: { id: MaqamFamily | "all"; name: string }[] = [
  { id: "all", name: "الكل" },
  { id: "arabic", name: "🎵 عربية" },
  { id: "turkish", name: "🌙 تركية" },
  { id: "western", name: "🌍 غربية" },
];

export type Maqam = {
  id: string;
  name: string;
  mood: string;
  description: string;
  /** درجات السلّم بالنسبة لدرجة الأساس، بوحدة نصف النغمة (0.5 = ربع نغمة) */
  scale: number[];
  /** وصف الأسلوب بالإنجليزية — يُستخدم لبناء البرومبت الموسيقي لمحركات التوليد */
  stylePrompt: string;
  family: MaqamFamily;
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
    family: "arabic",
  },
  {
    id: "hijaz",
    name: "حجاز",
    mood: "شرقي، روحاني، شجي",
    description: "المقام الشرقي الأشهر بطابعه الروحاني، حاضر في الأذان والموشحات.",
    scale: [0, 1, 4, 5, 7, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Hijaz on D (jins Hijaz: half step then augmented second, D Eb F# G), spiritual devotional atmosphere of adhan and muwashahat, rich melisma and ornamentation, expressive long-breathed phrases",
    family: "arabic",
  },
  {
    id: "rast",
    name: "راست",
    mood: "فخم، متزن، أصيل",
    description: "«أبو المقامات» — أساس الغناء الطربي الكلاسيكي، متزن وفخم.",
    scale: [0, 2, 3.5, 5, 7, 9, 10.5, 12],
    stylePrompt:
      "Arabic maqam Rast on C (quarter tones: E half-flat and B half-flat), the father of maqamat, stately classical tarab grandeur, golden-age orchestra, samai and wahda rhythms, dignified noble melody",
    family: "arabic",
  },
  {
    id: "saba",
    name: "صبا",
    mood: "حزين، عميق، مؤثر",
    description: "مقام الشجن والحزن العميق، يلمس القلب مباشرة.",
    scale: [0, 1.5, 3, 4, 6, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Saba on D (jins Saba: D, E half-flat quarter tone, F, G-flat — its diminished fourth is the sound of grief), deep melancholic lament, weeping nay and violin, slow heavy phrases sinking downward",
    family: "arabic",
  },
  {
    id: "kurd",
    name: "كرد",
    mood: "رومانسي، عصري، سلس",
    description: "مقام الأغنية العصرية والرومانسية، سلس وقريب من الأذن الحديثة.",
    scale: [0, 1, 3, 5, 7, 8, 10, 12],
    stylePrompt:
      "Arabic maqam Kurd on D (jins Kurd, phrygian-like half step above tonic, no quarter tones), smooth modern romantic Arabic pop, contemporary production with oriental strings, flowing catchy melody",
    family: "arabic",
  },
  {
    id: "nahawand",
    name: "نهاوند",
    mood: "عاطفي، درامي",
    description: "قريب من السلّم الصغير الغربي، مثالي للأغاني العاطفية والدرامية.",
    scale: [0, 2, 3, 5, 7, 8, 11, 12],
    stylePrompt:
      "Arabic maqam Nahawand on C (harmonic-minor-like with raised seventh), dramatic cinematic emotion, passionate rises and falls, orchestral Arabic ballad intensity, aching romantic climaxes",
    family: "arabic",
  },
  {
    id: "ajam",
    name: "عجم",
    mood: "مشرق، احتفالي",
    description: "قريب من السلّم الكبير الغربي، مشرق ومناسب للأناشيد والأغاني الحماسية.",
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    stylePrompt:
      "Arabic maqam Ajam on Bb (major-like scale), bright celebratory anthem, triumphant uplifting energy, festive full arrangement with driving percussion, patriotic joyful chorus feel",
    family: "arabic",
  },
  {
    id: "sikah",
    name: "سيكاه",
    mood: "تراثي، مميز",
    description: "مقام ذو شخصية فريدة يبدأ من ربع نغمة، حاضر بقوة في التراث والموشحات.",
    scale: [0, 2, 3.5, 5.5, 7, 8.5, 10.5, 12],
    stylePrompt:
      "Arabic maqam Sikah (tonic on E half-flat quarter tone, jins Sikah trichord), distinctive floating heritage color of Andalusian muwashahat, samai thaqil 10/8 rhythm, ornamented traditional takht ensemble",
    family: "arabic",
  },

  // ══ المدرسة التركية — أشهر مقامات الطرب العثماني بألوانها المميزة ══
  {
    id: "huzzam",
    name: "هزّام",
    mood: "شجي، ساحر، تركي أصيل",
    description: "درّة الطرب التركي: رقّة السيكاه بلوعة الحجاز — لون «سيرة الحب» الخالد.",
    scale: [0, 1.5, 3.5, 4.5, 7.5, 8.5, 10.5, 12],
    stylePrompt:
      "Turkish makam Hüzzam (Segah-family tonic on a quarter tone with Hicaz tetrachord on the third), bittersweet Istanbul classical elegance, ornamented kanun and clarinet phrases, refined yearning melody with delicate melisma",
    family: "turkish",
  },
  {
    id: "hicazkar",
    name: "حجازكار",
    mood: "عثماني، مهيب، فخم",
    description: "فخامة القصور العثمانية — حجاز مضاعف يمنح جلالاً وشجناً أرستقراطياً.",
    scale: [0, 1, 4, 5, 7, 8, 11, 12],
    stylePrompt:
      "Turkish makam Hicazkâr on G (double Hicaz color above and below the dominant), stately Ottoman court grandeur, sweeping longa energy, oud taksim opening into majestic strings, aristocratic melancholic nobility",
    family: "turkish",
  },
  {
    id: "nikriz",
    name: "نكريز",
    mood: "غجري، مغامر، حيوي",
    description: "قفزته الجريئة تمنحه روح البلقان والأناضول — لون غجري مشاكس لا يُنسى.",
    scale: [0, 2, 3, 6, 7, 9, 10, 12],
    stylePrompt:
      "Makam Nikriz (bold augmented second between third and fourth degrees), fiery Rom gypsy Balkan-Anatolian dance color, driving 9/8 karsilama rhythm, virtuosic clarinet over kanun tremolo, daring playful twists",
    family: "turkish",
  },
  {
    id: "karcigar",
    name: "كارجيغار",
    mood: "راقص، لاذع، ملوّن",
    description: "بياتي يلتقي بلذعة الحجاز في وسطه — مقام الرقصات التركية المشتعلة.",
    scale: [0, 1.5, 3, 5, 6, 9, 10, 12],
    stylePrompt:
      "Turkish makam Karcığar (Uşşak with a quarter-tone second on the tonic meeting Hicaz on the fourth), tangy spirited çiftetelli dance groove, darbuka and def interplay, teasing clarinet slides, colorful festive folk celebration",
    family: "turkish",
  },
  {
    id: "sultaniyegah",
    name: "سلطاني يكاه",
    mood: "ملكي، رومانسي، واسع",
    description: "مينور شرقي بنكهة البلاط العثماني — اتساع رومانسي مهيب من روائع القرن التاسع عشر.",
    scale: [0, 2, 3, 5, 7, 8, 11, 12],
    stylePrompt:
      "Turkish makam Sultanîyegâh on D (regal minor color with raised leading tone), romantic Ottoman court breadth, cinematic sweeping string orchestra with kanun cascades, dignified longing, grand classical phrases",
    family: "turkish",
  },

  // ══ الألوان الغربية — أشهر السلالم العالمية لتلوين الطرب بلمسة معاصرة ══
  {
    id: "major",
    name: "ماجور (السلّم الكبير)",
    mood: "مشرق، متفائل، عالمي",
    description: "لغة البوب العالمي والأناشيد المشرقة — تفاؤل مباشر يعانق الأذن فوراً.",
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    stylePrompt:
      "Western major scale, bright uplifting global pop-anthem color, polished modern production, warm acoustic guitar and piano beds, soaring optimistic chorus with layered vocal harmonies",
    family: "western",
  },
  {
    id: "minor",
    name: "مينور (السلّم الصغير)",
    mood: "حالم، سينمائي، عاطفي",
    description: "سلّم البالادات الغربية والموسيقى التصويرية — عاطفة ناعمة بظلال حالمة.",
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    stylePrompt:
      "Western natural minor, dreamy cinematic ballad color, intimate felt piano and airy pads, slow-building emotional strings, tender wistful atmosphere with wide reverb",
    family: "western",
  },
  {
    id: "blues",
    name: "بلوز",
    mood: "شجن حر، دافئ، عتيق",
    description: "شجن أمريكا العميق بتطويعه الحر للنغمة — أخو الموّال في صدق الإحساس.",
    scale: [0, 3, 5, 6, 7, 10, 12],
    stylePrompt:
      "Blues scale with bent blue notes, smoky slow 12/8 blues shuffle, expressive electric guitar licks answering the voice, warm Hammond organ, raw soulful ache and freedom",
    family: "western",
  },
  {
    id: "jazz",
    name: "جاز (دوريان)",
    mood: "أنيق، ليلي، ارتجالي",
    description: "أناقة النوادي الليلية وحرية الارتجال — دوريان الجاز بدفئه الراقي.",
    scale: [0, 2, 3, 5, 7, 9, 10, 12],
    stylePrompt:
      "Jazz Dorian mode, late-night club elegance, walking upright bass and brushed drums, lush extended piano chords, smooth improvisational phrasing, sophisticated cool delivery",
    family: "western",
  },
  {
    id: "flamenco",
    name: "فلامنكو أندلسي",
    mood: "ناري، أندلسي، شغوف",
    description: "نار الأندلس المشتركة: فريجيان الفلامنكو قريبُ الحجاز — جسر بين الضفتين.",
    scale: [0, 1, 4, 5, 7, 8, 10, 12],
    stylePrompt:
      "Spanish Phrygian flamenco color (por medio), fiery Andalusian passion, virtuosic flamenco guitar falsetas, palmas handclaps and cajón groove, bulería drive, intense duende expression",
    family: "western",
  },
  {
    id: "pentatonic",
    name: "خماسي شرق آسيوي",
    mood: "صافٍ، تأملي، بعيد",
    description: "نقاء السلّم الخماسي في موسيقى الشرق الأقصى — صفاء تأملي بلا توترات.",
    scale: [0, 2, 4, 7, 9, 12],
    stylePrompt:
      "East-Asian major pentatonic purity, meditative guzheng and bamboo flute textures, spacious koto-like plucked phrases, serene floating calm, delicate minimal arrangement",
    family: "western",
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
  // ألوان المشاعر — لكل مقام لونه ولكل موقف إنساني غناؤه
  { id: "ritha", name: "🕊️ رثاء ووداع", en: "Arabic ritha elegy: dignified mourning farewell, grieving yet noble, slow heavy tempo, sparse solemn arrangement" },
  { id: "shajan", name: "💔 شجن وحزن", en: "sorrowful melancholic Arabic ballad, heartbreak and loss, aching tender delivery with long sighing phrases" },
  { id: "atab", name: "🥀 عتاب ولوم", en: "Arabic itab reproach song: wounded blame and tender accusation toward a beloved, bittersweet dignity" },
  { id: "haneen", name: "🏠 حنين واغتراب", en: "nostalgic longing for homeland and family, expatriate yearning, bittersweet warmth and distant memories" },
  { id: "ibtihal", name: "🤲 ابتهال وروحانيات", en: "Islamic devotional ibtihal supplication, reverent spiritual vocal, humble prayerful atmosphere, vocals forward" },
  { id: "afrah", name: "💍 أفراح وزفّة", en: "Arabic wedding zaffa celebration, joyous festive energy, ululation-ready chorus, driving drums and clapping" },
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
