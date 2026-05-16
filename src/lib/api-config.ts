import { getApiAuthToken } from "./api-auth-token";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
export const API_ERROR_COOLDOWN_MS = 15000;
export const API_TIMEOUT_MS = 20000;
export const API_UPLOAD_LIMITS_MB: Record<string, number> = {
  testupload: 10,
  editProfile: 16,
  uploadReel: 120,
  profileVerification: 20,
  addPost: 80,
  createStory: 60,
  uploadFile: 32,
  createRoom: 12,
  editRoom: 12,
  "Company/editProfile": 8,
  "Company/createPost": 80,
  "Application/applyToJob": 8,
};

const BYTES_PER_MB = 1024 * 1024;

export function validateApiClientConfig(): string | null {
  if (!API_URL) {
    return "Configuration API manquante (NEXT_PUBLIC_API_URL).";
  }

  if (!API_KEY) {
    return "Configuration API manquante (NEXT_PUBLIC_API_KEY).";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(API_URL);
  } catch {
    return "Configuration API invalide (NEXT_PUBLIC_API_URL).";
  }

  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    return "Configuration API non securisee: HTTPS est obligatoire en production.";
  }

  return null;
}

export function buildApiHeaders(
  options: {
    extraHeaders?: Record<string, string>;
    includeAuthorization?: boolean;
  } = {}
): Record<string, string> {
  const { extraHeaders, includeAuthorization = true } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: API_KEY,
  };

  if (includeAuthorization) {
    const apiAuthToken = getApiAuthToken();
    if (apiAuthToken) {
      headers.Authorization = `Bearer ${apiAuthToken}`;
    }
  }

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  return headers;
}

export function getRetryAfterSeconds(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const seconds = Number.parseInt(retryAfter.trim(), 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }
  return null;
}

export function getUploadLimitMB(endpoint: string): number | null {
  const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, "");
  return API_UPLOAD_LIMITS_MB[normalizedEndpoint] ?? null;
}

export function getUploadLimitBytes(endpoint: string): number | null {
  const limitMB = getUploadLimitMB(endpoint);
  return limitMB === null ? null : limitMB * BYTES_PER_MB;
}

export function validateFormDataUploadSize(
  endpoint: string,
  formData: FormData
): string | null {
  const limitMB = getUploadLimitMB(endpoint);
  const limitBytes = getUploadLimitBytes(endpoint);

  if (limitMB === null || limitBytes === null) {
    return null;
  }

  let totalBytes = 0;
  for (const value of formData.values()) {
    if (typeof value === "object" && value !== null && "size" in value) {
      const size = (value as { size?: unknown }).size;
      if (typeof size === "number" && Number.isFinite(size)) {
        totalBytes += size;
      }
    }
  }

  if (totalBytes > limitBytes) {
    return `Fichier trop volumineux. Limite: ${limitMB} Mo. Reduisez sa taille ou choisissez un fichier plus leger.`;
  }

  return null;
}
