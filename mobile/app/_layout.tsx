import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import { colors } from "../lib/theme";

// عربي أولاً: تفعيل الاتجاه من اليمين لليسار (يسري بعد أول إعادة تشغيل)
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  useEffect(() => {
    // التشغيل حتى مع مفتاح الصامت على آيفون — تطبيق صوتيات بالنهاية
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </>
  );
}
