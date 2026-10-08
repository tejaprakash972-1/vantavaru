import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getCook(request: Request) {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publicKey || !serviceKey) return { error: NextResponse.json({ error: "Language preferences are not configured." }, { status: 500 }) };

    const auth = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return { error: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) };
    const database = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    return { database, userId: user.id };
}

export async function GET(request: Request) {
    const context = await getCook(request);
    if (context.error) return context.error;
    const { data, error } = await context.database!.from("cook_profiles")
        .select("preferred_language").eq("user_id", context.userId!).maybeSingle();
    if (error) return NextResponse.json({ error: error.code === "42703" ? "Apply the cook language database migration first." : "Unable to load language preference." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Cook profile not found." }, { status: 404 });
    return NextResponse.json({ language: data.preferred_language ?? "en" });
}

export async function PUT(request: Request) {
    const context = await getCook(request);
    if (context.error) return context.error;
    let language: unknown;
    try {
        ({ language } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid language request." }, { status: 400 });
    }
    if (language !== "en" && language !== "hi" && language !== "te") {
        return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
    }
    const { data, error } = await context.database!.from("cook_profiles")
        .update({ preferred_language: language })
        .eq("user_id", context.userId!)
        .select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.code === "42703" ? "Apply the cook language database migration first." : "Unable to save language preference." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Cook profile not found." }, { status: 404 });
    return NextResponse.json({ language });
}