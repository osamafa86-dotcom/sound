/**
 * ذاكرة النطق — «العضو الأول» في عقل المنصة.
 *
 * كل تصحيح نطق يضيفه المستخدم يُخزَّن في قاموس نطق لدى ElevenLabs ويُطبَّق تلقائياً
 * على كل توليد لاحق، فتتحسّن دقة المنصة تراكمياً بلا حدود ودون إعادة تدريب أي نموذج.
 *
 * نستخدم قواعد alias (استبدال كتابي) لأنها الأنسب للعربية: الأسماء الأعجمية،
 * الاختصارات، الأرقام، والكلمات التي تحتاج تشكيلاً ليُنطق المعنى الصحيح.
 */

const API_BASE = "https://api.elevenlabs.io/v1";

/** اسم القاموس الموحّد للمنصة — يُنشأ مرة واحدة ثم يُحدَّث */
export const DICT_NAME = "maqam-arabic-pronunciation";

export type PronunciationRule = {
  /** الكلمة كما تُكتب في النص */
  word: string;
  /** النطق الصحيح كما يجب أن يُقرأ (مشكّلاً أو مكتوباً صوتياً) */
  alias: string;
};

export type DictionaryRef = { id: string; versionId: string };

type ElevenDictionary = { id: string; name: string; latest_version_id?: string; version_id?: string };

/** البحث عن قاموس المنصة بين قواميس الحساب */
export async function findDictionary(apiKey: string): Promise<DictionaryRef | null> {
  const res = await fetch(`${API_BASE}/pronunciation-dictionaries?page_size=100`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const found = (data?.pronunciation_dictionaries ?? []).find(
    (d: ElevenDictionary) => d.name === DICT_NAME
  );
  if (!found) return null;

  return { id: found.id, versionId: found.latest_version_id ?? found.version_id ?? "" };
}

/** إنشاء القاموس لأول مرة مع قاعدة واحدة على الأقل (الـ API يشترط محتوى) */
async function createDictionary(apiKey: string, rules: PronunciationRule[]): Promise<DictionaryRef> {
  const lexicon = buildLexicon(rules);
  const form = new FormData();
  form.append("name", DICT_NAME);
  form.append("description", "قاموس النطق العربي المتراكم لمنصة مقام");
  form.append("file", new Blob([lexicon], { type: "text/xml" }), "lexicon.pls");

  const res = await fetch(`${API_BASE}/pronunciation-dictionaries/add-from-file`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`تعذّر إنشاء القاموس: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const data = await res.json();
  return { id: data.id, versionId: data.version_id ?? data.latest_version_id ?? "" };
}

/** بناء ملف PLS من قواعد alias */
function buildLexicon(rules: PronunciationRule[]): string {
  const entries = rules
    .map(
      (r) =>
        `  <lexeme>\n    <grapheme>${escapeXml(r.word)}</grapheme>\n    <alias>${escapeXml(r.alias)}</alias>\n  </lexeme>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
         alphabet="ipa" xml:lang="ar">
${entries}
</lexicon>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** إضافة قواعد جديدة — ينشئ القاموس إن لم يكن موجوداً، وإلا يضيف عليه */
export async function addRules(
  apiKey: string,
  rules: PronunciationRule[]
): Promise<DictionaryRef> {
  const existing = await findDictionary(apiKey);
  if (!existing) return createDictionary(apiKey, rules);

  const res = await fetch(
    `${API_BASE}/pronunciation-dictionaries/${existing.id}/add-rules`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: rules.map((r) => ({ type: "alias", string_to_replace: r.word, alias: r.alias })),
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`تعذّر إضافة القواعد: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  return { id: existing.id, versionId: data?.version_id ?? existing.versionId };
}

/** حذف قاعدة (عند التراجع عن تصحيح) */
export async function removeRules(apiKey: string, words: string[]): Promise<void> {
  const existing = await findDictionary(apiKey);
  if (!existing) return;

  await fetch(`${API_BASE}/pronunciation-dictionaries/${existing.id}/remove-rules`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ rule_strings: words }),
  });
}
