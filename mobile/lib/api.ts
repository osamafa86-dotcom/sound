import { File, Paths } from "expo-file-system";
import { getServerUrl } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function base(): Promise<string> {
  const url = await getServerUrl();
  if (!url) throw new ApiError("اضبط رابط الخادم من شاشة الإعدادات أولاً", 0);
  return url;
}

async function readError(res: Response): Promise<string> {
  const fallback = `خطأ من الخادم (${res.status})`;
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

// ---------- الأصوات ----------
export type Voice = {
  id: string;
  name: string;
  gender?: "male" | "female";
  dialect: string;
  tone?: string;
  rating?: { avg: number; count: number };
};

export async function fetchVoices(): Promise<Voice[]> {
  const res = await fetch(`${await base()}/api/voices/catalog`);
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  const data = await res.json();
  return Array.isArray(data?.voices) ? data.voices : [];
}

// ---------- النص إلى صوت ----------
export type TTSResult = { uri: string; mock: boolean; provider: string };

export async function generateTTS(params: {
  text: string;
  voiceId: string;
  speed?: number;
}): Promise<TTSResult> {
  const res = await fetch(`${await base()}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new ApiError(await readError(res), res.status);

  const mime = res.headers.get("Content-Type") ?? "audio/mpeg";
  const ext = mime.includes("wav") ? "wav" : "mp3";
  const bytes = new Uint8Array(await res.arrayBuffer());

  const file = new File(Paths.cache, `tts-${Date.now()}.${ext}`);
  file.write(bytes);

  return {
    uri: file.uri,
    mock: res.headers.get("X-Mock") === "1",
    provider: res.headers.get("X-Provider") ?? "",
  };
}

// ---------- الأغاني ----------
export type SongJobStatus = {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  stage: string;
  tier: string;
  provider?: string;
  mock?: boolean;
  error?: string;
};

export async function createSongJob(body: {
  lyrics?: string;
  maqamId: string;
  styleId: string;
  ambience?: string;
  tier: "preview" | "full";
  durationSec?: number;
  dialectId?: string;
  singer?: "male" | "female";
}): Promise<string> {
  const res = await fetch(`${await base()}/api/songs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  const data = await res.json();
  if (typeof data?.jobId !== "string") throw new ApiError("استجابة غير متوقعة من الخادم", 502);
  return data.jobId;
}

export async function getSongJob(jobId: string): Promise<SongJobStatus> {
  const res = await fetch(`${await base()}/api/songs/${jobId}`);
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  return res.json();
}

export async function songAudioUrl(jobId: string): Promise<string> {
  return `${await base()}/api/songs/${jobId}/audio`;
}

/** فحص الاتصال بالخادم — يُستخدم من شاشة الإعدادات */
export async function pingServer(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${url}/api/voices/catalog`);
    if (!res.ok) return { ok: false, detail: `الخادم ردّ بحالة ${res.status}` };
    const data = await res.json();
    const count = Array.isArray(data?.voices) ? data.voices.length : 0;
    return { ok: true, detail: `متصل ✓ — ${count} صوتاً متاحاً` };
  } catch {
    return { ok: false, detail: "تعذّر الوصول للخادم — تأكد من الرابط والاتصال" };
  }
}
