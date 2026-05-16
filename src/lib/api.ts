import {
  API_ERROR_COOLDOWN_MS,
  API_TIMEOUT_MS,
  API_URL,
  buildApiHeaders,
  getRetryAfterSeconds,
  validateApiClientConfig,
  validateFormDataUploadSize,
} from "./api-config";

const apiErrorLastLog = new Map<string, number>();

export interface ApiResponse<T = unknown> {
  status: boolean;
  message: string;
  auth_token?: string | null;
  data?: T;
}

interface ApiCallOptions {
  endpoint: string;
  body?: Record<string, unknown>;
  formData?: FormData;
}

function flattenToFormData(body: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        params.append(`${key}[${i}]`, String(item));
      });
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

export async function apiCall<T = unknown>({
  endpoint,
  body,
  formData,
}: ApiCallOptions): Promise<ApiResponse<T>> {
  const configError = validateApiClientConfig();
  if (configError) {
    return {
      status: false,
      message: configError,
    };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      status: false,
      message: "Connexion internet indisponible.",
    };
  }

  const url = `${API_URL}/${endpoint}`;
  const headers: Record<string, string> = buildApiHeaders();

  let requestBody: BodyInit | undefined;

  if (formData) {
    const uploadSizeError = validateFormDataUploadSize(endpoint, formData);
    if (uploadSizeError) {
      return {
        status: false,
        message: uploadSizeError,
      };
    }

    requestBody = formData;
  } else if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = flattenToFormData(body).toString();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    if (process.env.NODE_ENV === "development") {
      console.log(`[API] POST ${endpoint}`, body ? Object.keys(body) : "FormData");
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = getRetryAfterSeconds(response.headers.get("retry-after"));
        return {
          status: false,
          message: retryAfter
            ? `Trop de requêtes. Réessayez dans ${retryAfter} seconde(s).`
            : "Trop de requêtes. Veuillez réessayer dans un moment.",
        };
      }

      if (response.status === 401) {
        return {
          status: false,
          message: "Session expirée ou non autorisée. Reconnectez-vous.",
        };
      }

      if (response.status === 403) {
        return {
          status: false,
          message: "Accès refusé.",
        };
      }

      if (response.status === 413) {
        return {
          status: false,
          message:
            "Fichier trop volumineux. Reduisez sa taille ou choisissez un fichier plus leger.",
        };
      }

      let serverMessage = `Erreur serveur (${response.status}). Veuillez réessayer.`;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const errorJson = await response.json();
          if (typeof errorJson?.message === "string" && errorJson.message.trim()) {
            serverMessage = errorJson.message;
          }
        } catch {
          // Fallback to the generic message below.
        }
      }

      return {
        status: false,
        message: serverMessage,
      };
    }

    const json = await response.json();

    // Normalize: some backend endpoints return { message, data } without
    // an explicit `status` field. When `data` is present and `status` is
    // absent we treat the response as successful so callers don't silently
    // discard valid payloads.
    if (typeof json.status === "undefined" && json.data !== undefined) {
      json.status = true;
    }

    if (process.env.NODE_ENV === "development" && !json.status) {
      console.warn(`[API] ${endpoint} →`, json.message);
    }

    return json as ApiResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        status: false,
        message: "La requête a expiré. Vérifiez votre connexion internet.",
      };
    }
    const message = error instanceof Error ? error.message : "Erreur réseau";
    const now = Date.now();
    const lastLogAt = apiErrorLastLog.get(endpoint) ?? 0;
    if (now - lastLogAt >= API_ERROR_COOLDOWN_MS) {
      apiErrorLastLog.set(endpoint, now);
      console.warn(`[API] ${endpoint} ERREUR:`, message);
    }
    return {
      status: false,
      message: `Impossible de contacter le serveur. ${message}`,
    };
  }
}
