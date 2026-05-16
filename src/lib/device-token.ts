const DEVICE_TOKEN_KEY = "itga_web_device_token";

function makeToken(): string {
  const fromCrypto = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `web_${fromCrypto}`;
}

export function getWebDeviceToken(): string {
  if (typeof window === "undefined") {
    return makeToken();
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (existing) {
      return existing;
    }

    const created = makeToken();
    window.localStorage.setItem(DEVICE_TOKEN_KEY, created);
    return created;
  } catch {
    return makeToken();
  }
}

export function saveWebDeviceToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    // ignore storage failures
  }
}
