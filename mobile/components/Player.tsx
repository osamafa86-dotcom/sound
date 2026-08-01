import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { colors, radius } from "../lib/theme";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** مشغّل صوت موحّد — يقبل ملفاً محلياً أو رابطاً من الخادم */
export default function Player({ uri, badge }: { uri: string; badge?: string }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [sharing, setSharing] = useState(false);

  // مصدر جديد (توليد آخر) — نبدّل بدل إنشاء مشغّل جديد
  useEffect(() => {
    player.replace({ uri });
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    // انتهى المقطع؟ أعد من البداية
    if (status.duration > 0 && status.currentTime >= status.duration - 0.1) {
      player.seekTo(0);
    }
    player.play();
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let localUri = uri;
      // روابط الخادم تُنزَّل لملف مؤقت أولاً — المشاركة تتطلب ملفاً محلياً
      if (/^https?:\/\//i.test(uri)) {
        const file = await File.downloadFileAsync(uri, Paths.cache);
        localUri = file.uri;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      }
    } catch {
      // المشاركة اختيارية — فشلها لا يعطل التشغيل
    } finally {
      setSharing(false);
    }
  };

  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={toggle} style={styles.playBtn} accessibilityRole="button">
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={22}
            color="#fff"
            style={!status.playing && { marginStart: 2 }}
          />
        </Pressable>
        <View style={styles.middle}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.time}>
            {fmt(status.currentTime)} / {fmt(status.duration)}
          </Text>
        </View>
        <Pressable onPress={share} style={styles.shareBtn} accessibilityRole="button">
          <Ionicons
            name={sharing ? "hourglass-outline" : "share-social-outline"}
            size={20}
            color={colors.primary}
          />
        </Pressable>
      </View>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: { flex: 1, gap: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
    flexDirection: "row-reverse",
  },
  fill: { backgroundColor: colors.primary, borderRadius: 3 },
  time: { color: colors.muted, fontSize: 12, textAlign: "left" },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
