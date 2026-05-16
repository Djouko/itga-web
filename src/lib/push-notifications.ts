import app from "@/lib/firebase";
import { getWebDeviceToken, saveWebDeviceToken } from "@/lib/device-token";

const MESSAGING_SW_PATH = "/firebase-messaging-sw.js";

export interface PushSetupResult {
  token: string;
  permission: NotificationPermission | "unsupported";
  usingFcm: boolean;
}

export async function setupPushNotifications(
  opts?: {
    requestPermission?: boolean;
    onMessage?: (payload: unknown) => void;
  }
): Promise<{ result: PushSetupResult; unsubscribe?: () => void }> {
  const fallbackToken = getWebDeviceToken();

  if (typeof window === "undefined") {
    return {
      result: {
        token: fallbackToken,
        permission: "unsupported",
        usingFcm: false,
      },
    };
  }

  if (
    typeof Notification === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return {
      result: {
        token: fallbackToken,
        permission: "unsupported",
        usingFcm: false,
      },
    };
  }

  let permission: NotificationPermission = Notification.permission;

  if (permission === "default" && opts?.requestPermission) {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      result: {
        token: fallbackToken,
        permission,
        usingFcm: false,
      },
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    return {
      result: {
        token: fallbackToken,
        permission,
        usingFcm: false,
      },
    };
  }

  const registration = await navigator.serviceWorker.register(MESSAGING_SW_PATH);

  const { isSupported, getMessaging, getToken, onMessage } = await import("firebase/messaging");
  if (!(await isSupported())) {
    return {
      result: {
        token: fallbackToken,
        permission,
        usingFcm: false,
      },
    };
  }

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return {
      result: {
        token: fallbackToken,
        permission,
        usingFcm: false,
      },
    };
  }

  saveWebDeviceToken(token);

  const unsubscribe = opts?.onMessage
    ? onMessage(messaging, (payload) => {
        opts.onMessage?.(payload);
      })
    : undefined;

  return {
    result: {
      token,
      permission,
      usingFcm: true,
    },
    unsubscribe,
  };
}
