import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function PUT(request: Request) {
    let online: unknown;
    try {
        ({ online } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid availability request." }, { status: 400 });
    }
    if (typeof online !== "boolean") {
        return NextResponse.json({ error: "Online status must be true or false." }, { status: 400 });
    }

    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: "Please sign in to update availability." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publishableKey || !serviceKey) {
        return NextResponse.json({ error: "Availability is not configured." }, { status: 500 });
    }

    const auth = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const database = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cook, error: cookError } = await database.from("cook_profiles")
        .select("id, is_online")
        .eq("user_id", user.id)
        .maybeSingle();
    if (cookError) return NextResponse.json({ error: "Unable to load cook profile." }, { status: 500 });
    if (!cook) return NextResponse.json({ error: "Cook profile not found." }, { status: 404 });

    const { data: openSessions, error: sessionsError } = await database.from("cook_online_sessions")
        .select("id")
        .eq("cook_profile_id", cook.id)
        .is("ended_at", null);
    if (sessionsError) return NextResponse.json({ error: "Unable to load online sessions." }, { status: 500 });

    const now = new Date().toISOString();
    if (online) {
        let createdSessionId: string | null = null;
        if (!openSessions?.length) {
            const { data: session, error: insertError } = await database.from("cook_online_sessions")
                .insert({ cook_profile_id: cook.id, started_at: now })
                .select("id")
                .single();
            if (insertError || !session) return NextResponse.json({ error: "Unable to start an online session." }, { status: 500 });
            createdSessionId = session.id;
        }
        if (cook.is_online !== true) {
            const { data: updated, error: updateError } = await database.from("cook_profiles")
                .update({ is_online: true })
                .eq("id", cook.id)
                .eq("user_id", user.id)
                .select("id")
                .maybeSingle();
            if (updateError || !updated) {
                if (createdSessionId) await database.from("cook_online_sessions").delete().eq("id", createdSessionId);
                return NextResponse.json({ error: "Unable to go online." }, { status: 500 });
            }
        }
    } else {
        if (cook.is_online === true) {
            const { data: updated, error: updateError } = await database.from("cook_profiles")
                .update({ is_online: false })
                .eq("id", cook.id)
                .eq("user_id", user.id)
                .select("id")
                .maybeSingle();
            if (updateError || !updated) return NextResponse.json({ error: "Unable to go offline." }, { status: 500 });
        }
        if (openSessions?.length) {
            const { error: closeError } = await database.from("cook_online_sessions")
                .update({ ended_at: now })
                .eq("cook_profile_id", cook.id)
                .is("ended_at", null);
            if (closeError) {
                if (cook.is_online === true) await database.from("cook_profiles").update({ is_online: true }).eq("id", cook.id);
                return NextResponse.json({ error: "Unable to close the online session." }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ online });
}