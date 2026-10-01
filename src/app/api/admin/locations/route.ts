import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LocationKind = "city" | "area" | "society";

type LocationRequest = {
    kind?: LocationKind;
    id?: string;
    values?: Record<string, unknown>;
};

function getTable(kind: unknown) {
    if (kind === "city") return "cities";
    if (kind === "area") return "areas";
    if (kind === "society") return "societies";
    return null;
}

async function getAdminDatabase(request: Request) {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!accessToken) {
        return { error: NextResponse.json({ error: "Please sign in to manage locations." }, { status: 401 }) };
    }
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
        return { error: NextResponse.json({ error: "Location management is not configured on the server." }, { status: 500 }) };
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user) {
        return { error: NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 }) };
    }

    const database = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await database
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        return { error: NextResponse.json({ error: "Unable to verify admin permissions." }, { status: 500 }) };
    }
    if (profile?.role !== "admin") {
        return { error: NextResponse.json({ error: "Admin access is required to manage locations." }, { status: 403 }) };
    }

    return { database };
}

export async function GET(request: Request) {
    const auth = await getAdminDatabase(request);
    if (auth.error) return auth.error;
    const { database } = auth;

    const [cities, areas, societies] = await Promise.all([
        database.from("cities").select("id, name, is_active, sort_order").order("sort_order").order("name"),
        database.from("areas").select("id, city_id, name, is_active, sort_order").order("sort_order").order("name"),
        database.from("societies").select("id, area_id, name, pincode, address, is_active, sort_order").order("sort_order").order("name"),
    ]);

    const queryError = cities.error || areas.error || societies.error;
    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    return NextResponse.json({ cities: cities.data ?? [], areas: areas.data ?? [], societies: societies.data ?? [] });
}

export async function POST(request: Request) {
    return mutateLocation(request, "insert");
}

export async function PATCH(request: Request) {
    return mutateLocation(request, "update");
}

export async function DELETE(request: Request) {
    return mutateLocation(request, "delete");
}

async function mutateLocation(request: Request, operation: "insert" | "update" | "delete") {
    const auth = await getAdminDatabase(request);
    if (auth.error) return auth.error;
    const { database } = auth;

    let body: LocationRequest;
    try {
        body = await request.json() as LocationRequest;
    } catch {
        return NextResponse.json({ error: "Invalid location request." }, { status: 400 });
    }

    const table = getTable(body.kind);
    if (!table || ((operation === "update" || operation === "delete") && !body.id)) {
        return NextResponse.json({ error: "A valid location type and record ID are required." }, { status: 400 });
    }

    if (operation === "delete") {
        const { error } = await database.from(table).delete().eq("id", body.id!);
        if (error) return NextResponse.json({ error: error.message }, { status: 409 });
        return NextResponse.json({ success: true });
    }

    if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
        return NextResponse.json({ error: "Location fields are required." }, { status: 400 });
    }

    const allowedFields: Record<LocationKind, string[]> = {
        city: ["name", "sort_order", "is_active"],
        area: ["city_id", "name", "sort_order", "is_active"],
        society: ["area_id", "name", "pincode", "address", "sort_order", "is_active"],
    };
    const values = Object.fromEntries(Object.entries(body.values).filter(([key]) => allowedFields[body.kind!].includes(key)));
    if (!Object.keys(values).length) return NextResponse.json({ error: "No valid location fields provided." }, { status: 400 });

    const query = operation === "insert"
        ? await database.from(table).insert(values).select("id").single()
        : await database.from(table).update(values).eq("id", body.id!).select("id").maybeSingle();
    if (query.error) return NextResponse.json({ error: query.error.message }, { status: 409 });
    if (operation === "update" && !query.data) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    return NextResponse.json({ success: true, id: query.data?.id ?? body.id });
}