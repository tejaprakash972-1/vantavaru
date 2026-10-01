import type { SupabaseClient } from "@supabase/supabase-js";

export async function setCookAvailability(supabase: SupabaseClient, online: boolean) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error("Please sign in again to change availability.");

    const response = await fetch("/api/cook/availability", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ online }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to change availability.");
    return result.online === true;
}