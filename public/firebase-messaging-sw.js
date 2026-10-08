self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

const config = JSON.parse(new URL(self.location.href).searchParams.get("config"));
firebase.initializeApp(config);
firebase.messaging().onBackgroundMessage((payload) => {
    if (payload.notification) return;
    return self.registration.showNotification(payload.data?.title || "New Vantavaru Booking", {
        body: payload.data?.body || "You have a new cooking request.",
        data: { url: "/cook-home" },
    });
});