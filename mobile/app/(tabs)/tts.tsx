import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import Player from "../../components/Player";
import {
  Card,
  Chip,
  ChipRow,
  ErrorText,
  Field,
  MutedText,
  PrimaryButton,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../components/ui";
import { ApiError, fetchVoices, generateTTS, type TTSResult, type Voice } from "../../lib/api";

const SPEEDS = [
  { value: 0.85, label: "متأنٍ" },
  { value: 1, label: "طبيعي" },
  { value: 1.15, label: "سريع" },
] as const;

export default function TTSScreen() {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TTSResult | null>(null);

  // كتالوج الأصوات يُجلب عند فتح الشاشة (وقد يتغير حين يضبط المستخدم الخادم)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchVoices()
        .then((v) => {
          if (!alive) return;
          setVoices(v);
          setVoiceId((current) => current || v[0]?.id || "");
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [])
  );

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      setResult(await generateTTS({ text: text.trim(), voiceId, speed }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر التوليد — حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  // تجميع الأصوات حسب اللهجة مع الحفاظ على ترتيب الخادم (الأعلى تقييماً أولاً)
  const dialects = [...new Set(voices.map((v) => v.dialect))];

  return (
    <Screen>
      <Title>النص إلى صوت</Title>
      <Subtitle>اكتب نصك، اختر الصوت والسرعة، واسمع النتيجة فوراً.</Subtitle>

      <Card>
        <Field
          multiline
          placeholder="اكتب النص هنا... (حتى ٢٠ ألف حرف — النصوص الطويلة تُدمج تلقائياً)"
          value={text}
          onChangeText={setText}
          maxLength={20000}
        />

        {dialects.length > 0 ? (
          dialects.map((d) => (
            <ChipRow key={d}>
              {voices
                .filter((v) => v.dialect === d)
                .map((v) => (
                  <Chip
                    key={v.id}
                    label={`${v.name} · ${d}`}
                    hint={v.tone}
                    selected={v.id === voiceId}
                    onPress={() => setVoiceId(v.id)}
                  />
                ))}
            </ChipRow>
          ))
        ) : (
          <MutedText>
            لم تصل قائمة الأصوات بعد — تأكد من ضبط رابط الخادم في الإعدادات.
          </MutedText>
        )}

        <SectionTitle>السرعة</SectionTitle>
        <ChipRow>
          {SPEEDS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              selected={speed === s.value}
              onPress={() => setSpeed(s.value)}
            />
          ))}
        </ChipRow>

        <PrimaryButton
          label="🎙️ ولّد الصوت"
          onPress={generate}
          loading={loading}
          disabled={!text.trim() || !voiceId}
        />
        <ErrorText>{error}</ErrorText>
      </Card>

      {result && (
        <Player
          uri={result.uri}
          badge={
            result.mock
              ? "وضع تجريبي — فعّل مفاتيح المحركات على الخادم للصوت الحقيقي"
              : `المحرك: ${result.provider}`
          }
        />
      )}
    </Screen>
  );
}
