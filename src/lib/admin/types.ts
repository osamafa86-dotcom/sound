/**
 * أنواع «السلك» بين مسارات اللوحة وواجهتها — إعادة تصدير للأنواع فقط،
 * فلا يُحمَّل أي كود خادمي (مفتاح الخدمة) داخل حزمة المتصفح.
 */

export type { PlatformSettings } from "@/lib/platformSettings";
export type { RouteStat, UsageAggregate, LimitWindow } from "./aggregate";
export type { FeatureStatus, IntegrationStatus } from "./health";
export type {
  AdminCustomVoice,
  AdminJob,
  AdminUser,
  AuditEntry,
  Configured,
  ContentStats,
} from "./stats";

import type { Configured, ContentStats } from "./stats";
import type { UsageAggregate } from "./aggregate";
import type { FeatureStatus, IntegrationStatus } from "./health";
import type { PlatformSettings } from "@/lib/platformSettings";

export type UsageStats = Configured<{ days: number } & UsageAggregate>;

export type LimitRuleRow = {
  scope: string;
  label: string;
  perVisitor: number;
  perSignedIn: number;
  global: number;
  windowSec: number;
  estimatedUsdPerEvent: number;
};

export type Overview = {
  viewer: string;
  settings: PlatformSettings;
  runtime: {
    nodeVersion: string;
    environment: string;
    region: string | null;
    deploymentUrl: string | null;
    commit: string | null;
    commitMessage: string | null;
    branch: string | null;
    startedAt: string;
  };
  owner: { configured: boolean; count: number; masked: string[] };
  integrations: IntegrationStatus[];
  features: FeatureStatus[];
  limits: LimitRuleRow[];
  catalogs: {
    voices: {
      total: number;
      available: number;
      elevenlabs: number;
      azure: number;
      male: number;
      female: number;
      dialects: number;
      byDialect: Record<string, number>;
    };
    maqamat: { id: string; name: string; mood: string }[];
  };
  usageToday: UsageStats;
  usageWeek: UsageStats;
  content: Configured<ContentStats>;
};
