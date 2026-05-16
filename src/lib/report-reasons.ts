import type { SettingCommon } from "@/lib/types";

export const DEFAULT_REPORT_REASONS: string[] = [
  "Contenu inapproprié",
  "Spam ou publicité",
  "Harcèlement ou intimidation",
  "Discours haineux",
  "Violence ou contenu dangereux",
  "Usurpation d'identité",
  "Atteinte à la vie privée",
  "Fausses informations",
  "Faux profil",
  "Autre",
];

export function normalizeReportReasons(reasons: SettingCommon[] | null | undefined): string[] {
  if (!Array.isArray(reasons)) return [];

  const uniqueReasons = new Set<string>();
  for (const reason of reasons) {
    const title = reason?.title?.trim();
    if (!title) continue;
    uniqueReasons.add(title);
  }

  return Array.from(uniqueReasons);
}

export function getReportReasonsWithFallback(reasons: string[] | null | undefined): string[] {
  if (!Array.isArray(reasons)) return DEFAULT_REPORT_REASONS;

  const normalized = reasons
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalized.length > 0 ? normalized : DEFAULT_REPORT_REASONS;
}
