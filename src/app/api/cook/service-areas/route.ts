import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getContext(request: Request) {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { error: NextResponse.json({ error: "Please sign in to manage service areas." }, { status: 401 }) };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !publicKey || !serviceKey) {
        console.error("Cook service areas missing configuration", [!url && "NEXT_PUBLIC_SUPABASE_URL", !publicKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean));
        return { error: NextResponse.json({ error: "Service areas are not configured." }, { status: 500 }) };
    }

    const auth = createClient(url, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return { error: NextResponse.json({ error: "Please sign in again." }, { status: 401 }) };
    const database = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cook, error: cookError } = await database.from("cook_profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (cookError) {
        console.error("Cook service areas profile lookup failed", cookError);
        return { error: NextResponse.json({ error: "Unable to load your cook profile." }, { status: 500 }) };
    }
    if (!cook) return { error: NextResponse.json({ error: "Cook profile not found." }, { status: 403 }) };
    return { database, cookId: cook.id };
}

export async function GET(request: Request) {
    const context = await getContext(request);
    if (context.error) return context.error;
    const { database, cookId } = context;
    const [cities, areas, societies, links] = await Promise.all([
        database.from("cities").select("id, name").eq("is_active", true).order("sort_order").order("name"),
        database.from("areas").select("id, city_id, name").eq("is_active", true).order("sort_order").order("name"),
        database.from("societies").select("id, area_id, name").eq("is_active", true).order("sort_order").order("name"),
        database.from("cook_service_societies").select("society_id, is_active").eq("cook_profile_id", cookId),
    ]);
    const failedQuery = Object.entries({ cities: cities.error, areas: areas.error, societies: societies.error, cook_service_societies: links.error }).find(([, error]) => error);
    if (failedQuery) {
        console.error(`Cook service areas ${failedQuery[0]} query failed`, failedQuery[1]);
        return NextResponse.json({ error: `Unable to load service areas (${failedQuery[0]}).` }, { status: 500 });
    }
    return NextResponse.json({ cities: cities.data, areas: areas.data, societies: societies.data, selectedIds: links.data?.filter((link) => link.is_active).map((link) => link.society_id) ?? [] });
}

export async function PUT(request: Request) {
    const context = await getContext(request);
    if (context.error) return context.error;
    const { database, cookId } = context;
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid service area request." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !Array.isArray((body as { societyIds?: unknown }).societyIds) || !(body as { societyIds: unknown[] }).societyIds.every((id) => typeof id === "string")) {
        return NextResponse.json({ error: "Select valid societies." }, { status: 400 });
    }
    const ids = [...new Set((body as { societyIds: string[] }).societyIds)];
    const [societies, areas, cities, links] = await Promise.all([
        database.from("societies").select("id, area_id").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).eq("is_active", true),
        database.from("areas").select("id, city_id").eq("is_active", true),
        database.from("cities").select("id").eq("is_active", true),
        database.from("cook_service_societies").select("society_id, is_active").eq("cook_profile_id", cookId),
    ]);
    const failedQuery = Object.entries({ societies: societies.error, areas: areas.error, cities: cities.error, cook_service_societies: links.error }).find(([, error]) => error);
    if (failedQuery) {
        console.error(`Cook service areas validation ${failedQuery[0]} query failed`, failedQuery[1]);
        return NextResponse.json({ error: `Unable to validate service areas (${failedQuery[0]}).` }, { status: 500 });
    }
    const activeCities = new Set(cities.data?.map((city) => city.id));
    const activeAreas = new Set(areas.data?.filter((area) => activeCities.has(area.city_id)).map((area) => area.id));
    if (societies.data?.length !== ids.length || societies.data.some((society) => !activeAreas.has(society.area_id))) {
        return NextResponse.json({ error: "One or more societies are no longer available." }, { status: 400 });
    }

    const existingIds = new Set(links.data?.map((link) => link.society_id));
    const additions = ids.filter((id) => !existingIds.has(id));
    if (additions.length) {
        const { error } = await database.from("cook_service_societies").insert(additions.map((societyId) => ({ cook_profile_id: cookId, society_id: societyId, is_active: true })));
        if (error) {
            console.error("Cook service areas insert failed", error);
            return NextResponse.json({ error: "Unable to add selected societies." }, { status: 500 });
        }
    }
    const disabledIds = links.data?.filter((link) => link.is_active && !ids.includes(link.society_id)).map((link) => link.society_id) ?? [];
    if (disabledIds.length) {
        const { error } = await database.from("cook_service_societies").update({ is_active: false }).eq("cook_profile_id", cookId).in("society_id", disabledIds);
        if (error) {
            console.error("Cook service areas deactivate failed", error);
            return NextResponse.json({ error: "Unable to remove previous service areas." }, { status: 500 });
        }
    }
    const reactivatedIds = links.data?.filter((link) => !link.is_active && ids.includes(link.society_id)).map((link) => link.society_id) ?? [];
    if (reactivatedIds.length) {
        const { error } = await database.from("cook_service_societies").update({ is_active: true }).eq("cook_profile_id", cookId).in("society_id", reactivatedIds);
        if (error) {
            console.error("Cook service areas reactivate failed", error);
            return NextResponse.json({ error: "Unable to reactivate service areas." }, { status: 500 });
        }
    }
    return NextResponse.json({ selectedIds: ids });
}