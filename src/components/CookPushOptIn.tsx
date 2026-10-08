"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPushPermission, isNativePush, registerCookPush, requestWebPushPermission, type PushPermission } from "@/lib/cook/push";

export default function CookPushOptIn({ client, userId, t }: { client: SupabaseClient; userId: string; t: (text: string) => string }) {
    const [permission, setPermission] = useState<PushPermission | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const running = useRef(false);
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        let cancelled = false;
        async function check() {
            try {
                const next = await getPushPermission();
                if (cancelled) return;
                setPermission(next);
                if (next === "granted") {
                    running.current = true;
                    setBusy(true);
                    await registerCookPush(client, userId);
                    if (!cancelled) setEnabled(true);
                }
            } catch (failure) {
                if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to enable notifications.");
            } finally {
                if (!cancelled) { running.current = false; setBusy(false); }
            }
        }
        void check();
        return () => { cancelled = true; mounted.current = false; };
    }, [client, userId]);

    function enable() {
        if (running.current || enabled) return;
        running.current = true;
        setBusy(true);
        setError("");
        let permissionRequest: Promise<NotificationPermission> | undefined;
        try {
            if (!isNativePush()) permissionRequest = requestWebPushPermission();
        } catch {
            running.current = false;
            setBusy(false);
            setError("Unable to enable notifications.");
            return;
        }
        async function register() {
            try {
                if (permissionRequest) {
                    const next = await permissionRequest;
                    if (!mounted.current) return;
                    setPermission(next === "default" ? "prompt" : next);
                    if (next !== "granted") return;
                }
                await registerCookPush(client, userId, true);
                if (mounted.current) { setPermission("granted"); setEnabled(true); }
            } catch (failure) {
                if (mounted.current) {
                    setError(failure instanceof Error ? failure.message : "Unable to enable notifications.");
                    try {
                        const next = await getPushPermission();
                        if (mounted.current) setPermission(next);
                    } catch {
                        if (mounted.current) setPermission(null);
                    }
                }
            } finally {
                running.current = false;
                if (mounted.current) setBusy(false);
            }
        }
        void register();
    }

    const message = enabled ? "Notifications enabled" : permission === "denied" ? "Notifications are blocked. Enable them in your device settings." : permission === "unsupported" ? "Push notifications are not supported in this browser." : "Booking notifications";
    return <section className="cook-push-opt-in" aria-label={t("Booking notifications")}>
        <p role="status"><Bell size={18} aria-hidden="true" /> {t(message)}</p>
        {!enabled && permission !== "denied" && permission !== "unsupported" && <button type="button" className="cook-online-button" disabled={busy || !permission} onClick={enable}><Bell size={18} aria-hidden="true" /> {t(busy ? "Enabling notifications..." : "Enable notifications")}</button>}
        {error && <p role="alert">{t(error)}</p>}
    </section>;
}