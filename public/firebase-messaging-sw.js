self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = {
      notification: {
        title: "ITGA",
        body: event.data.text(),
      },
    };
  }

  const root = payload && typeof payload === "object" ? payload : {};
  const data = root.data && typeof root.data === "object" ? root.data : {};
  const notif = root.notification && typeof root.notification === "object" ? root.notification : {};

  const title = notif.title || data.title || "ITGA";
  const body = notif.body || data.body || "Vous avez une nouvelle notification.";
  const icon = notif.icon || data.icon || "/itga_logo.png";
  const badge = notif.badge || data.badge || "/itga_logo.png";
  const url = data.url || data.link || "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      tag: data.tag || "itga-notification",
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.postMessage({ type: "ITGA_PUSH_CLICK", url });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
