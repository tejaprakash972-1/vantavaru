import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

export const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCMuxrus6QjXhzxbTM3TSIA7l-Q1r8Yob0",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "vantavaru.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "vantavaru",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "vantavaru.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "192660516815",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:192660516815:web:bff4f6fb3e4f768cae6cba",
};

export async function waitForActivation(registration: ServiceWorkerRegistration) {
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw new Error("Unable to enable notifications.");
    if (worker.state === "activated") return;
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error("Notification registration timed out.")), 20000);
        function finish(error?: Error) {
            clearTimeout(timer);
            worker!.removeEventListener("statechange", check);
            if (error) reject(error); else resolve();
        }
        function check() {
            if (worker!.state === "activated") finish();
            else if (worker!.state === "redundant") finish(new Error("Unable to enable notifications."));
        }
        worker.addEventListener("statechange", check);
        check();
    });
}

export async function getWebPushToken() {
    if (!await isSupported()) throw new Error("Push notifications are not supported in this browser.");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error("Notifications are not configured.");
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(firebaseConfig))}`,
        { scope: "/" },
    );
    await waitForActivation(serviceWorkerRegistration);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration });
    if (!token) throw new Error("Unable to enable notifications.");
    return token;
}