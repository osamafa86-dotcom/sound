import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import {
  Card,
  ErrorText,
  Field,
  MutedText,
  PrimaryButton,
  Screen,
  SectionTitle,
  Subtitle,
  Title,
} from "../../components/ui";
import { pingServer } from "../../lib/api";
import { getServerUrl, normalizeUrl, setServerUrl } from "../../lib/config";
import { colors, radius } from "../../lib/theme";

export default function SettingsScreen() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getServerUrl().then(setUrl);
  }, []);

  const saveAndTest = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const normalized = await setServerUrl(url);
      setUrl(normalized);
      if (!normalized) {
        setStatus({ ok: false, detail: "أدخل رابط الموقع المنشور على Vercel" });
        return;
      }
      setStatus(await pingServer(normalized));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>الإعدادات</Title>
      <Subtitle>التطبيق يتصل بخادم «مقام» نفسه الذي يشغّل الموقع — اضبط رابطه هنا.</Subtitle>

      <Card>
        <SectionTitle>رابط الخادم</SectionTitle>
        <Field
          placeholder="مثال: maqam.example.com"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textAlign="left"
          style={{ writingDirection: "ltr", textAlign: "left" }}
        />
        <PrimaryButton label="حفظ وفحص الاتصال" onPress={saveAndTest} loading={busy} />
        {status &&
          (status.ok ? (
            <View style={styles.okBox}>
              <Text style={styles.okText}>{status.detail}</Text>
            </View>
          ) : (
            <ErrorText>{status.detail}</ErrorText>
          ))}
        <MutedText>
          هو نفسه رابط موقعك المنشور (مثل my-app.vercel.app أو نطاقك الخاص). كل التوليد
          والذكاء الاصطناعي يعمل على الخادم — التطبيق واجهة له.
        </MutedText>
      </Card>

      <Card>
        <SectionTitle>الحساب والمكتبة</SectionTitle>
        <MutedText>
          تسجيل الدخول والمكتبة السحابية ومعمل الصوت قادمة للتطبيق في التحديثات المقبلة.
          حالياً كل التوليد يعمل بلا حساب، ويمكنك إدارة مكتبتك من الموقع.
        </MutedText>
        <PrimaryButton
          label="فتح الموقع في المتصفح"
          onPress={() => {
            const target = normalizeUrl(url);
            if (target) Linking.openURL(target).catch(() => {});
          }}
          disabled={!normalizeUrl(url)}
        />
      </Card>

      <MutedText>مقام — تطبيق الموبايل، الإصدار التجريبي الأول (v1.0.0)</MutedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  okBox: {
    backgroundColor: "#e8f4ee",
    borderRadius: radius.sm,
    padding: 10,
  },
  okText: {
    color: colors.success,
    textAlign: "right",
    writingDirection: "rtl",
    fontWeight: "600",
  },
});
