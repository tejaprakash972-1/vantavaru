import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return NextResponse.json({ error: "Please sign in to enable notifications." }, { status: 401 });

    let pushToken: unknown;
    let platform: unknown;
    try {
        ({ pushToken, platform } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid notification request." }, { status: 400 });
    }
    if (typeof pushToken !== "string" || !pushToken.trim() || pushToken.length > 4096) {
        return NextResponse.json({ error: "A valid device token is required." }, { status: 400 });
    }
    if (platform !== undefined && platform !== "web" && platform !== "android") {
        return NextResponse.json({ error: "Invalid device platform." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publishableKey || !serviceKey) {
        return NextResponse.json({ error: "Notifications are not configured." }, { status: 500 });
    }

    const auth = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(bearer);
    if (authError || !user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const database = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cook, error: profileError } = await database.from("cook_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
    if (profileError) return NextResponse.json({ error: "Unable to find cook profile." }, { status: 500 });
    if (!cook) return NextResponse.json({ error: "Cook profile not found." }, { status: 403 });

    const values = { cook_profile_id: cook.id, push_token: pushToken.trim(), platform: platform ?? "web", is_active: true, last_seen_at: new Date().toISOString() };
    const { error } = await database.from("cook_devices").upsert(values, { onConflict: "push_token" });
    if (error) {
        console.error("Cook device registration failed", { code: error.code, message: error.message });
        return NextResponse.json({ error: error.code === "23505" ? "Device registration conflicts with a database constraint." : "Unable to register this device." }, { status: 500 });
    }

    return NextResponse.json({ enabled: true });
}