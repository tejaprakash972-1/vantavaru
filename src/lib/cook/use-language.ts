"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseCookLanguage, translateCook, type CookLanguage } from "./language";

const languageChanged = "cook-language-changed";

export function useCookLanguage() {
    const [language, setLanguage] = useState<CookLanguage>("en");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const supabase = getSupabaseBrowserClient();

    useEffect(() => {
        if (!supabase) {
            return;
        }
        let cancelled = false;
        async function load() {
            const { data: { session } } = await supabase!.auth.getSession();
            if (!session) {
                if (!cancelled) setLoading(false);
                return;
            }
            const response = await fetch("/api/cook/language", { headers: { Authorization: `Bearer ${session.access_token}` } });
            if (!cancelled && response.ok) {
                const result = await response.json();
                setLanguage(parseCookLanguage(result.language));
            } else if (!cancelled) {
                const result = await response.json().catch(() => null);
                setError(result?.error || "Unable to load language preference.");
            }
            if (!cancelled) setLoading(false);
        }
        void load().catch(() => { if (!cancelled) { setError("Unable to load language preference."); setLoading(false); } });
        const onChange = (event: Event) => setLanguage((event as CustomEvent<CookLanguage>).detail);
        window.addEventListener(languageChanged, onChange);
        return () => { cancelled = true; window.removeEventListener(languageChanged, onChange); };
    }, [supabase]);

    async function saveLanguage(next: CookLanguage) {
        if (!supabase) throw new Error("Please sign in to change language.");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Please sign in to change language.");
        const response = await fetch("/api/cook/language", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ language: next }),
        });
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || "Unable to save language preference.");
        }
        setLanguage(next);
        setError("");
        window.dispatchEvent(new CustomEvent(languageChanged, { detail: next }));
    }

    return { language, saveLanguage, loading, error, t: (text: string) => translateCook(language, text) };
}