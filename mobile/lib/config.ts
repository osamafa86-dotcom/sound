import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "maqam.serverUrl";

/**
 * رابط خادم «مقام» — نفس موقع Next.js المنشور على Vercel.
 * يُضبط مرة واحدة من شاشة الإعدادات ويُحفظ محلياً،
 * ويمكن تثبيته وقت البناء عبر EXPO_PUBLIC_API_URL.
 */
let cached: string | null = null;

export function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

export async function getServerUrl(): Promise<string> {
  if (cached !== null) return cached;
  const stored = await AsyncStorage.getItem(KEY);
  cached = stored ?? normalizeUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
  return cached;
}

export async function setServerUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  cached = normalized;
  await AsyncStorage.setItem(KEY, normalized);
  return normalized;
}
