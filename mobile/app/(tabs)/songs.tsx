import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import {
  ApiError,
  createSongJob,
  getSongJob,
  songAudioUrl,
  type SongJobStatus,
} from "../../lib/api";
import { AMBIENCES, DIALECTS, DURATIONS, MAQAMAT, SONG_STYLES } from "../../lib/data";
import { colors, radius } from "../../lib/theme";

const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

type Phase =
  | { kind: "idle" }
  | { kind: "working"; stage: string }
  | { kind: "done"; uri: string; job: SongJobStatus }
  | { kind: "error"; message: string };

export default function SongsScreen() {
  const [lyrics, setLyrics] = useState("");
  const [maqamId, setMaqamId] = useState<string>(MAQAMAT[0].id);
  const [styleId, setStyleId] = useState<string>(SONG_STYLES[0].id);
  const [ambience, setAmbience] = useState("");
  const [dialectId, setDialectId] = useState("");
  const [singer, setSinger] = useState<"" | "male" | "female">("");
  const [tier, setTier] = useState<"preview" | "full">("preview");
  const [durationSec, setDurationSec] = useState<number>(60);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // تنظيف الاستعلام الدوري عند مغادرة الشاشة
  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const generate = async () => {
    stopPolling();
    setPhase({ kind: "working", stage: "إرسال الطلب..." });
    try {
      const jobId = await createSongJob({
        lyrics: lyrics.trim() || undefined,
        maqamId,
        styleId,
        ambience: ambience || undefined,
        dialectId: dialectId || undefined,
        singer: singer || undefined,
        tier,
        durationSec: tier === "full" ? durationSec : undefined,
      });

      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const job = await getSongJob(jobId);
          if (job.status === "done") {
            stopPolling();
            setPhase({ kind: "done", uri: await songAudioUrl(jobId), job });
          } else if (job.status === "failed") {
            stopPolling();
            setPhase({ kind: "error", message: job.error || "فشل التوليد — حاول مجدداً" });
          } else {
            setPhase({ kind: "working", stage: job.stage });
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
              stopPolling();
              setPhase({ kind: "error", message: "استغرق التوليد أطول من المتوقع — حاول مجدداً" });
            }
          }
        } catch {
          // خطأ شبكة عابر أثناء الاستعلام — نستمر بالمحاولة حتى المهلة
        }
      }, POLL_MS);
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof ApiError ? e.message : "تعذّر إنشاء المهمة — حاول مجدداً",
      });
    }
  };

  const working = phase.kind === "working";

  return (
    <Screen>
      <Title>استوديو الأغاني</Title>
      <Subtitle>
        اكتب كلماتك (أو اتركها للذكاء الاصطناعي)، اختر المقام والأسلوب، واحصل على أغنية كاملة.
      </Subtitle>

      <Card>
        <Field
          multiline
          placeholder="كلمات الأغنية... (اتركها فارغة لموسيقى آلية أو كلمات يولّدها المحرك)"
          value={lyrics}
          onChangeText={setLyrics}
          maxLength={3000}
        />

        <SectionTitle>المقام</SectionTitle>
        <ChipRow>
          {MAQAMAT.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              hint={m.mood}
              selected={maqamId === m.id}
              onPress={() => setMaqamId(m.id)}
            />
          ))}
        </ChipRow>

        <SectionTitle>الأسلوب</SectionTitle>
        <ChipRow>
          {SONG_STYLES.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              selected={styleId === s.id}
              onPress={() => setStyleId(s.id)}
            />
          ))}
        </ChipRow>

        <SectionTitle>الأجواء (اختياري)</SectionTitle>
        <ChipRow>
          {AMBIENCES.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={ambience === a.id}
              onPress={() => setAmbience(ambience === a.id ? "" : a.id)}
            />
          ))}
        </ChipRow>

        <SectionTitle>لهجة الأداء والمغني (اختياري)</SectionTitle>
        <ChipRow>
          {DIALECTS.map((d) => (
            <Chip
              key={d.id}
              label={d.name}
              selected={dialectId === d.id}
              onPress={() => setDialectId(dialectId === d.id ? "" : d.id)}
            />
          ))}
        </ChipRow>
        <ChipRow>
          <Chip label="🎤 مغني" selected={singer === "male"} onPress={() => setSinger(singer === "male" ? "" : "male")} />
          <Chip label="🎤 مغنية" selected={singer === "female"} onPress={() => setSinger(singer === "female" ? "" : "female")} />
        </ChipRow>

        <SectionTitle>النسخة</SectionTitle>
        <ChipRow>
          <Chip
            label="معاينة سريعة"
            hint="~٣٠ ثانية"
            selected={tier === "preview"}
            onPress={() => setTier("preview")}
          />
          <Chip
            label="أغنية كاملة"
            hint="حتى ٣ دقائق"
            selected={tier === "full"}
            onPress={() => setTier("full")}
          />
        </ChipRow>
        {tier === "full" && (
          <ChipRow>
            {DURATIONS.map((d) => (
              <Chip
                key={d.sec}
                label={d.label}
                selected={durationSec === d.sec}
                onPress={() => setDurationSec(d.sec)}
              />
            ))}
          </ChipRow>
        )}

        <PrimaryButton label="🎵 ولّد الأغنية" onPress={generate} loading={working} />
      </Card>

      {working && (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.progressText}>{phase.stage}</Text>
        </View>
      )}

      {phase.kind === "error" && <ErrorText>{phase.message}</ErrorText>}

      {phase.kind === "done" && (
        <>
          <Player
            uri={phase.uri}
            badge={
              phase.job.mock
                ? "وضع تجريبي — سلّم المقام الحقيقي بأرباع النغمات"
                : phase.job.provider
                  ? `المحرك: ${phase.job.provider}`
                  : undefined
            }
          />
          <MutedText>
            أعجبتك؟ ولّد نسخة كاملة أو جرّب مقاماً آخر — كل توليد بلمسة مختلفة.
          </MutedText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
  },
  progressText: {
    flex: 1,
    color: colors.body,
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
