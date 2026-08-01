/**
 * نسخة خفيفة من بيانات المقامات والأساليب — المرجع الكامل في
 * `src/lib/maqamat.ts` بالخادم، وهو من يبني البرومبت الموسيقي.
 * هنا نحتاج المعرّفات والأسماء فقط لعرض الخيارات.
 */
export const MAQAMAT = [
  { id: "bayati", name: "بياتي", mood: "دافئ، حنون، شعبي" },
  { id: "hijaz", name: "حجاز", mood: "شرقي، روحاني، شجي" },
  { id: "rast", name: "راست", mood: "فخم، متزن، أصيل" },
  { id: "saba", name: "صبا", mood: "حزين، عميق، مؤثر" },
  { id: "kurd", name: "كرد", mood: "رومانسي، عصري، سلس" },
  { id: "nahawand", name: "نهاوند", mood: "عاطفي، درامي" },
  { id: "ajam", name: "عجم", mood: "مشرق، احتفالي" },
  { id: "sikah", name: "سيكاه", mood: "تراثي، مميز" },
] as const;

export const SONG_STYLES = [
  { id: "tarab", name: "طرب كلاسيكي" },
  { id: "pop", name: "بوب عربي عصري" },
  { id: "muwashah", name: "موشح / تراثي" },
  { id: "dal3ona", name: "🇵🇸 دلعونا" },
  { id: "ataba", name: "🇵🇸 عتابا وميجانا" },
  { id: "zarif", name: "🇵🇸 زريف الطول" },
  { id: "dabke", name: "🇵🇸 دبكة شعبية" },
  { id: "watani-ps", name: "🇵🇸 وطنية فلسطينية" },
  { id: "instrumental", name: "موسيقى آلية (بدون غناء)" },
] as const;

export const AMBIENCES = [
  { id: "duff-tabl", name: "🥁 دف وطبل تراثي" },
  { id: "piano-calm", name: "🎹 بيانو هادئ" },
  { id: "nasheed", name: "🕌 إنشاد إسلامي" },
  { id: "dabke-folk", name: "🪘 مجوز ودبكة" },
  { id: "orchestra", name: "🎻 أوركسترا شرقية" },
] as const;

export const DIALECTS = [
  { id: "fusha", name: "فصحى" },
  { id: "egyptian", name: "مصرية" },
  { id: "gulf", name: "خليجية" },
  { id: "levantine", name: "شامية" },
  { id: "palestinian", name: "فلسطينية" },
  { id: "iraqi", name: "عراقية" },
  { id: "maghrebi", name: "مغربية" },
] as const;

export const DURATIONS = [
  { sec: 60, label: "دقيقة" },
  { sec: 90, label: "دقيقة ونصف" },
  { sec: 120, label: "دقيقتان" },
  { sec: 180, label: "٣ دقائق" },
] as const;
