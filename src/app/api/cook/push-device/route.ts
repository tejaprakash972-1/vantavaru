import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return NextResponse.json({ error: "Please sign in again to enable notifications." }, { status: 401 });
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !publicKey || !serviceKey) return NextResponse.json({ error: "Notifications are not configured." }, { status: 500 });
        const options = { auth: { autoRefreshToken: false, persistSession: false } };
        const auth = createClient(url, publicKey, options);
        const { data: { user }, error: authError } = await auth.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: "Please sign in again to enable notifications." }, { status: 401 });
        let body;
        try { body = await request.json(); } catch {
            return NextResponse.json({ error: "Invalid notification request." }, { status: 400 });
        }
        if (!body || typeof body.push_token !== "string" || !body.push_token.trim() || body.push_token.length > 4096 || (body.platform !== "web" && body.platform !== "android")) {
            return NextResponse.json({ error: "Invalid notification request." }, { status: 400 });
        }
        const database = createClient(url, serviceKey, options);
        const { data: cook, error: cookError } = await database.from("cook_profiles").select("id").eq("user_id", user.id).maybeSingle();
        if (cookError) return NextResponse.json({ error: "Unable to load cook profile." }, { status: 500 });
        if (!cook) return NextResponse.json({ error: "Cook profile not found." }, { status: 403 });
        const { error } = await database.from("cook_devices").upsert({
            cook_profile_id: cook.id,
            push_token: body.push_token.trim(),
            platform: body.platform,
            is_active: true,
            last_seen_at: new Date().toISOString(),
        }, { onConflict: "push_token" });
        if (error) return NextResponse.json({ error: "Unable to save notification device." }, { status: 500 });
        return NextResponse.json({ enabled: true });
    } catch {
        return NextResponse.json({ error: "Unable to save notification device." }, { status: 500 });
    }
}