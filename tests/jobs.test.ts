import { describe, expect, it } from "vitest";
import { memoryJobsStore } from "@/lib/jobs";
import type { MusicRequest } from "@/lib/providers/types";

const request: MusicRequest = {
  maqamId: "bayati",
  styleId: "tarab",
  instrumentIds: ["oud"],
  stylePrompt: "Arabic maqam Bayati",
  durationSec: 30,
};

describe("مخزن المهام في الذاكرة", () => {
  it("دورة حياة كاملة: إنشاء → تشغيل → اكتمال مع الصوت", async () => {
    const job = await memoryJobsStore.create("preview", request, "user-1");
    expect(job.status).toBe("pending");
    expect(job.userId).toBe("user-1");

    await memoryJobsStore.update(job.id, { status: "running", stage: "جارٍ التوليد" });
    const running = await memoryJobsStore.get(job.id);
    expect(running?.status).toBe("running");

    const audio = Buffer.from("RIFF-fake-wav");
    await memoryJobsStore.complete(job.id, {
      audio,
      mimeType: "audio/wav",
      provider: "mock",
      mock: true,
    });

    const done = await memoryJobsStore.get(job.id);
    expect(done?.status).toBe("done");
    expect(done?.provider).toBe("mock");
    expect(done?.mock).toBe(true);

    const stored = await memoryJobsStore.getAudio(job.id);
    expect(stored?.mimeType).toBe("audio/wav");
    expect(stored?.audio.equals(audio)).toBe(true);
  });

  it("الفشل يسجّل الخطأ ولا يوفر صوتاً", async () => {
    const job = await memoryJobsStore.create("full", request);
    await memoryJobsStore.update(job.id, { status: "failed", error: "boom" });
    const failed = await memoryJobsStore.get(job.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("boom");
    expect(await memoryJobsStore.getAudio(job.id)).toBeUndefined();
  });

  it("مهمة غير موجودة تعيد undefined", async () => {
    expect(await memoryJobsStore.get("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});
