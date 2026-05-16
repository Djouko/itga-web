import type { Company } from "./types";

const COMPANY_STORAGE_KEY = "itga-company";
const ACTING_COMPANY_KEY = "itga-acting-company-id";
const MODE_EVENT = "itga-company-mode-change";

function emitModeChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MODE_EVENT));
}

export function getCompanyFromStorage(): Company | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Company) : null;
  } catch {
    return null;
  }
}

/** Retourne l'owner_user_id du compte entreprise stocké, ou null. */
export function getOwnerUserId(): number | null {
  const company = getCompanyFromStorage();
  if (!company) return null;
  const id = company.owner_user_id;
  return typeof id === "number" && id > 0 ? id : null;
}

export function getActingCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ACTING_COMPANY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isCompanyActingMode(): boolean {
  return getActingCompanyId() !== null;
}

export function canCompanyActAsUser(company: Company | null | undefined): boolean {
  const ownerId = company?.owner_user_id;
  return typeof ownerId === "number" && ownerId > 0;
}

export function enableCompanyActingMode(companyId: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTING_COMPANY_KEY, String(companyId));
  emitModeChange();
}

export function disableCompanyActingMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTING_COMPANY_KEY);
  emitModeChange();
}

export function companyModeEventName(): string {
  return MODE_EVENT;
}
