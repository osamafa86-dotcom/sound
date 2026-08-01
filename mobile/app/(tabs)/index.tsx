import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, MutedText, Screen, Subtitle, Title } from "../../components/ui";
import { getServerUrl } from "../../lib/config";
import { colors, radius } from "../../lib/theme";

const SECTIONS = [
  {
    href: "/tts" as const,
    icon: "mic-outline" as const,
    title: "استوديو النص إلى صوت",
    desc: "أصوات عربية بالفصحى واللهجات — اكتب نصك واسمعه بجودة عالية.",
  },
  {
    href: "/songs" as const,
    icon: "musical-notes-outline" as const,
    title: "استوديو الأغاني والمقامات",
    desc: "كلماتك تصبح أغنية كاملة على المقام الذي تختاره: بياتي، حجاز، راست...",
  },
] as const;

export default function Home() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      getServerUrl().then((url) => setConfigured(!!url));
    }, [])
  );

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Ionicons name="pulse" size={30} color="#fff" />
        </View>
        <Title>مقام</Title>
        <Subtitle>
          استوديو الصوتيات بالذكاء الاصطناعي — حوّل كلماتك إلى صوتٍ وأغنية على المقامات
          العربية، من جيبك مباشرة.
        </Subtitle>
      </View>

      {configured === false && (
        <Link href="/settings" asChild>
          <Pressable style={styles.setupBanner} accessibilityRole="button">
            <Ionicons name="alert-circle-outline" size={20} color={colors.primaryStrong} />
            <Text style={styles.setupText}>
              ابدأ بضبط رابط خادم «مقام» من الإعدادات — ضغطة واحدة من هنا
            </Text>
          </Pressable>
        </Link>
      )}

      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} asChild>
          <Pressable accessibilityRole="button">
            <Card>
              <View style={styles.cardRow}>
                <View style={styles.cardIcon}>
                  <Ionicons name={s.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardDesc}>{s.desc}</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.faint} />
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}

      <MutedText>
        معمل الصوت (الاستنساخ والتفريغ) والمكتبة السحابية متاحان حالياً عبر الموقع، وقادمان
        إلى التطبيق في التحديثات المقبلة.
      </MutedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "flex-end", gap: 8, marginBottom: 6 },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  setupBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.rose,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
  },
  setupText: {
    flex: 1,
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.rose,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.body,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardDesc: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 20,
  },
});
