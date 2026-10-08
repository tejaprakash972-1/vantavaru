import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPermission = "prompt" | "granted" | "denied" | "unsupported";
const registrations = new Map<string, Promise<void>>();

export function requestWebPushPermission(): Promise<NotificationPermission> {
    return Notification.requestPermission();
}

export async function getPushPermission(): Promise<PushPermission> {
    if (Capacitor.isNativePlatform()) {
        if (Capacitor.getPlatform() !== "android") return "unsupported";
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { receive } = await PushNotifications.checkPermissions();
        return receive === "granted" || receive === "denied" ? receive : "prompt";
    }
    if (typeof Notification === "undefined" || !globalThis.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in globalThis)) return "unsupported";
    return Notification.permission === "default" ? "prompt" : Notification.permission;
}

export function isNativePush() {
    return Capacitor.isNativePlatform();
}

export async function getAndroidPushToken(prompt: boolean) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted" && prompt) permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") throw new Error("Notifications are blocked. Enable them in your device settings.");
    const handles: PluginListenerHandle[] = [];
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    try {
        return await new Promise<string>((resolve, reject) => {
            const finish = (token?: string, error?: Error) => {
                if (settled) return;
                settled = true;
                if (error) reject(error); else if (token) resolve(token); else reject(new Error("Unable to enable notifications."));
            };
            timer = setTimeout(() => finish(undefined, new Error("Notification registration timed out.")), 20000);
            async function listen(handle: Promise<PluginListenerHandle>) {
                const listener = await handle;
                if (settled) await listener.remove(); else handles.push(listener);
            }
            async function register() {
                await listen(PushNotifications.addListener("registration", ({ value }) => finish(value)));
                await listen(PushNotifications.addListener("registrationError", () => finish(undefined, new Error("Unable to enable notifications."))));
                if (!settled) await PushNotifications.register();
            }
            void register().catch(() => finish(undefined, new Error("Unable to enable notifications.")));
        });
    } finally {
        settled = true;
        clearTimeout(timer!);
        await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
    }
}

export function registerCookPush(client: SupabaseClient, userId: string, prompt = false): Promise<void> {
    const existing = registrations.get(userId);
    if (existing) return existing;
    const registration = (async () => {
        try {
            const platform = Capacitor.isNativePlatform() ? "android" : "web";
            if (Capacitor.isNativePlatform() && Capacitor.getPlatform() !== "android") throw new Error("Push notifications are not supported in this browser.");
            const pushToken = platform === "android" ? await getAndroidPushToken(prompt) : await (await import("@/lib/firebase")).getWebPushToken();
            const { data: { session }, error } = await client.auth.getSession();
            if (error || !session || session.user.id !== userId) throw new Error("Please sign in again to enable notifications.");
            const response = await fetch("/api/cook/push-device", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ push_token: pushToken, platform }),
            });
            const result = await response.json();
            if (!response.ok || result.enabled !== true) throw new Error("Unable to save notification device.");
        } catch (error) {
            const known = ["Notifications are not configured.", "Notifications are blocked. Enable them in your device settings.", "Push notifications are not supported in this browser.", "Please sign in again to enable notifications.", "Notification registration timed out.", "Unable to save notification device."];
            throw new Error(error instanceof Error && known.includes(error.message) ? error.message : "Unable to enable notifications.");
        }
    })();
    registrations.set(userId, registration);
    void registration.finally(() => {
        if (registrations.get(userId) === registration) registrations.delete(userId);
    }).catch(() => undefined);
    return registration;
}