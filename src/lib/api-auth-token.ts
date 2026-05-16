const API_AUTH_TOKEN_KEY = "itga-api-auth-token";

export function getApiAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(API_AUTH_TOKEN_KEY);
    return token && token.trim() ? token : null;
  } catch {
    return null;
  }
}

export function saveApiAuthToken(token: string | null | undefined): void {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(API_AUTH_TOKEN_KEY, token);
  } catch {
    return;
  }
}

export function clearApiAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(API_AUTH_TOKEN_KEY);
  } catch {
    return;
  }
}
