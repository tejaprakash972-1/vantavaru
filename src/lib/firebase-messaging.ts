import { Capacitor } from "@capacitor/core";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import app from "./firebase";

export async function getFCMToken(): Promise<string | null> {
    try {
        if (Capacitor.isNativePlatform()) {
            if (Capacitor.getPlatform() !== "android") return null;

            const { PushNotifications } = await import("@capacitor/push-notifications");
            let permission = await PushNotifications.checkPermissions();
            if (permission.receive !== "granted") {
                permission = await PushNotifications.requestPermissions();
            }
            if (permission.receive !== "granted") return null;

            let resolveToken!: (token: string) => void;
            let rejectToken!: (error: Error) => void;
            const tokenPromise = new Promise<string>((resolve, reject) => {
                resolveToken = resolve;
                rejectToken = reject;
            });
            const registration = await PushNotifications.addListener("registration", ({ value }) => resolveToken(value));
            const failure = await PushNotifications.addListener("registrationError", (error) => rejectToken(new Error(JSON.stringify(error))));
            const timeout = setTimeout(() => rejectToken(new Error("Push registration timed out")), 15000);
            try {
                await PushNotifications.register();
                return await tokenPromise;
            } finally {
                clearTimeout(timeout);
                await registration.remove();
                await failure.remove();
            }
        }

        const supported = await isSupported();

        if (!supported) {
            console.log("Firebase Messaging is not supported in this browser");
            return null;
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("Notification permission was not granted");
            return null;
        }

        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration:
                await navigator.serviceWorker.register(
                    "/firebase-messaging-sw.js"
                ),
        });

        return token;
    } catch (error) {
        console.error("Failed to get FCM token:", error);
        return null;
    }
}