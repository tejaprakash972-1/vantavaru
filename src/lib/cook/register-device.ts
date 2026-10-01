import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function registerCookDevice(supabase: SupabaseClient) {
    const { getFCMToken } = await import("@/lib/firebase-messaging");
    const token = await getFCMToken();
    if (!token) throw new Error(typeof Notification !== "undefined" && Notification.permission === "denied" ? "Notifications are blocked. Enable them in your browser settings." : "Unable to enable notifications on this device.");

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error("Please sign in again to enable notifications.");
    const response = await fetch("/api/cook/push-device", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ pushToken: token, platform: Capacitor.getPlatform() === "android" ? "android" : "web" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to register this device.");
}