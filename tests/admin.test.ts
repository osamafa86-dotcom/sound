import { afterEach, describe, expect, it } from "vitest";
import { aggregateUsage, dayRange, parseLimitWindows, routeCostUsd } from "@/lib/admin/aggregate";
import { catalogs, features, integrations, limitsTable, ownerInfo } from "@/lib/admin/health";
import { isOwnerEmail, ownerEmails } from "@/lib/owner";
import { DEFAULT_SETTINGS, gateFor, normalizeSettings } from "@/lib/platformSettings";

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

afterEach(() => {
  delete process.env.OWNER_EMAILS;
  delete process.env.COST_TTS;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe("صلاحية المالك", () => {
  it("لا مالك إطلاقاً بلا ضبط OWNER_EMAILS", () => {
    expect(ownerEmails()).toEqual([]);
    expect(isOwnerEmail("someone@example.com")).toBe(false);
  });

  it("تتجاهل حالة الأحرف والفراغات", () => {
    process.env.OWNER_EMAILS = " Owner@Example.com , second@example.com ";
    expect(isOwnerEmail("owner@example.com")).toBe(true);
    expect(isOwnerEmail("  SECOND@EXAMPLE.COM ")).toBe(true);
    expect(isOwnerEmail("intruder@example.com")).toBe(false);
  });

  it("تتسامح مع فواصل الإدخال الشائعة في لوحات الاستضافة", () => {
    process.env.OWNER_EMAILS = "a@x.com، b@x.com; c@x.com\nd@x.com  e@x.com";
    expect(ownerEmails()).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"]);
    expect(isOwnerEmail("c@x.com")).toBe(true);
  });

  it("تتجاهل علامات التنصيص الملتصقة بالقيمة", () => {
    process.env.OWNER_EMAILS = '"owner@example.com"';
    expect(isOwnerEmail("owner@example.com")).toBe(true);
  });

  it("ترفض القيم الفارغة", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
  });
});

describe("تجميع الاستهلاك", () => {
  const rows = [
    { route: "tts", cost: 1, user_id: "u1", created_at: daysAgo(0) },
    { route: "tts", cost: 1, user_id: "u1", created_at: daysAgo(1) },
    { route: "songs", cost: 1, user_id: "u2", created_at: daysAgo(1) },
    { route: "drama", cost: 5, user_id: null, created_at: daysAgo(2) },
  ];

  it("يزن الأحداث بقيمة cost", () => {
    const agg = aggregateUsage(rows, 7, NOW);
    expect(agg.total).toBe(8);
    expect(agg.byRoute.find((r) => r.route === "drama")?.events).toBe(5);
  });

  it("يفصل المسجلين عن الزوار ويعدّ المستخدمين النشطين", () => {
    const agg = aggregateUsage(rows, 7, NOW);
    expect(agg.activeUsers).toBe(2);
    expect(agg.anonymousEvents).toBe(5);
    expect(agg.signedInEvents).toBe(3);
  });

  it("يبني سلسلة يومية متصلة بلا فجوات", () => {
    const agg = aggregateUsage(rows, 7, NOW);
    expect(agg.byDay).toHaveLength(7);
    expect(agg.byDay.at(-1)?.events).toBe(1); // اليوم
    expect(agg.byDay[4].events).toBe(5); // قبل يومين
    expect(agg.byDay[0].events).toBe(0); // يوم بلا استهلاك
  });

  it("يتجاهل الأحداث خارج المدة", () => {
    const agg = aggregateUsage([...rows, { route: "tts", cost: 99, user_id: "u9", created_at: daysAgo(40) }], 7, NOW);
    // الإجمالي يشمل كل ما جُلب، لكن السلسلة اليومية لا تتلوث بأيام خارج النافذة
    expect(agg.byDay.reduce((s, d) => s + d.events, 0)).toBe(8);
  });

  it("يرتّب المسارات تنازلياً ويحسب كلفة تقديرية", () => {
    const agg = aggregateUsage(rows, 7, NOW);
    expect(agg.byRoute[0].route).toBe("drama");
    expect(agg.estimatedUsd).toBeGreaterThan(0);
  });

  it("يرتّب أكثر المستخدمين استهلاكاً", () => {
    const agg = aggregateUsage(rows, 7, NOW);
    expect(agg.topUsers[0]).toEqual({ userId: "u1", events: 2 });
  });

  it("يعيد أصفاراً بلا بيانات", () => {
    const agg = aggregateUsage([], 3, NOW);
    expect(agg.total).toBe(0);
    expect(agg.byDay).toHaveLength(3);
    expect(agg.estimatedUsd).toBe(0);
  });
});

describe("كلفة المسار", () => {
  it("تحترم تجاوز البيئة", () => {
    process.env.COST_TTS = "0.5";
    expect(routeCostUsd("tts")).toBe(0.5);
  });

  it("تعيد صفراً لمسار غير معروف", () => {
    expect(routeCostUsd("unknown-route")).toBe(0);
  });

  it("dayRange يبني المدى منتهياً باليوم الحالي", () => {
    const range = dayRange(3, NOW);
    expect(range).toEqual(["2026-07-24", "2026-07-25", "2026-07-26"]);
  });
});

describe("نوافذ الحدود", () => {
  it("تفكّ المفتاح إلى نطاق وهوية وتحسب وقت التصفير", () => {
    const [global, user] = parseLimitWindows(
      [
        { key: "tts:global", window_start: new Date(NOW - 600_000).toISOString(), count: 120 },
        { key: "songs:user:abc-123", window_start: new Date(NOW - 600_000).toISOString(), count: 4 },
      ],
      () => 3600,
      NOW
    );
    expect(global.scope).toBe("tts");
    expect(global.subject).toBe("global");
    expect(global.resetInSec).toBe(3000);
    expect(user.identifier).toBe("abc-123");
  });

  it("ترتّب تنازلياً بالاستهلاك ولا تعيد وقتاً سالباً", () => {
    const windows = parseLimitWindows(
      [
        { key: "a:ip:1", window_start: new Date(NOW - 7200_000).toISOString(), count: 1 },
        { key: "b:ip:2", window_start: new Date(NOW).toISOString(), count: 50 },
      ],
      () => 3600,
      NOW
    );
    expect(windows[0].count).toBe(50);
    expect(windows[1].resetInSec).toBe(0);
  });
});

describe("صحة النظام", () => {
  it("لا تكشف قيمة أي مفتاح — وجوده فقط", () => {
    process.env.ELEVENLABS_API_KEY = "sk-super-secret-value";
    const serialized = JSON.stringify(integrations());
    expect(serialized).not.toContain("sk-super-secret-value");
    expect(integrations().find((i) => i.id === "elevenlabs")?.configured).toBe(true);
  });

  it("تتبع حالة الميزات المفاتيح المتوفرة", () => {
    const off = features();
    expect(off.find((f) => f.id === "tts")?.state).toBe("mock");
    expect(off.find((f) => f.id === "voice")?.state).toBe("off");

    process.env.ELEVENLABS_API_KEY = "x";
    process.env.GEMINI_API_KEY = "y";
    const on = features();
    expect(on.find((f) => f.id === "tts")?.state).toBe("live");
    expect(on.find((f) => f.id === "drama")?.state).toBe("live");
  });

  it("الوضع التجريبي القسري يجعل كل الميزات تجريبية", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    expect(features(true).find((f) => f.id === "tts")?.state).toBe("mock");
  });

  it("تقنّع بُرُد المالكين ولا تعرضها كاملة", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    const info = ownerInfo();
    expect(info.count).toBe(1);
    expect(info.masked[0]).toBe("ow***@example.com");
    expect(info.masked[0]).not.toContain("owner@");
  });

  it("تعدّ الكتالوجات والحدود", () => {
    const c = catalogs();
    expect(c.voices.total).toBeGreaterThan(0);
    expect(c.voices.elevenlabs + c.voices.azure).toBe(c.voices.total);
    expect(c.maqamat.length).toBeGreaterThan(0);

    const limits = limitsTable();
    expect(limits.find((l) => l.scope === "tts")?.perSignedIn).toBeGreaterThan(
      limits.find((l) => l.scope === "tts")!.perVisitor
    );
  });
});

describe("إعدادات المنصة", () => {
  it("تصحّح القيم غير الموثوقة", () => {
    const s = normalizeSettings({ maintenance: "yes", disabledRoutes: ["tts", 5, "tts"], banner: 42 });
    expect(s.maintenance).toBe(false); // ليست true حرفياً
    expect(s.disabledRoutes).toEqual(["tts"]); // بلا تكرار وبلا قيم غير نصية
    expect(s.banner).toBe("");
  });

  it("تعيد الافتراضيات من قيمة فارغة", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("وضع الصيانة يوقف كل المسارات", () => {
    const s = normalizeSettings({ maintenance: true, maintenanceMessage: "نعود قريباً" });
    expect(gateFor(s, "tts")).toEqual({ blocked: true, message: "نعود قريباً" });
    expect(gateFor(s, "songs").blocked).toBe(true);
  });

  it("إيقاف مسار بعينه لا يمسّ البقية", () => {
    const s = normalizeSettings({ disabledRoutes: ["songs"] });
    expect(gateFor(s, "songs").blocked).toBe(true);
    expect(gateFor(s, "tts").blocked).toBe(false);
  });

  it("بلا إعدادات كل شيء مفتوح", () => {
    expect(gateFor(DEFAULT_SETTINGS, "tts").blocked).toBe(false);
  });
});
