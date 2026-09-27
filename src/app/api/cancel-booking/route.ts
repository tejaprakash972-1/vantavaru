import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: Request) {
    let bookingId: string | undefined;
    try {
        ({ bookingId } = await request.json() as { bookingId?: string });
    } catch {
        return NextResponse.json({ success: false, error: "Invalid cancellation request." }, { status: 400 });
    }

    if (!bookingId) {
        return NextResponse.json({ success: false, error: "Booking ID is required." }, { status: 400 });
    }

    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
        return NextResponse.json({ success: false, error: "Please sign in to cancel this booking." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
        return NextResponse.json({ success: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user) {
        return NextResponse.json({ success: false, error: "Please sign in to cancel this booking." }, { status: 401 });
    }

    const database = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: booking, error: bookingError } = await database
        .from("bookings")
        .select("id, status, cook_profile_id")
        .eq("id", bookingId)
        .eq("customer_id", user.id)
        .maybeSingle();

    if (bookingError || !booking) {
        return NextResponse.json({ success: false, error: bookingError?.message || "Booking not found." }, { status: 404 });
    }
    if (booking.status !== "searching_cook" || booking.cook_profile_id) {
        return NextResponse.json({ success: false, error: "This booking can no longer be cancelled from the app." }, { status: 409 });
    }

    const { error: updateError } = await database
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .eq("customer_id", user.id)
        .eq("status", "searching_cook")
        .is("cook_profile_id", null);

    if (updateError) {
        return NextResponse.json({ success: false, error: "Unable to cancel this booking." }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookingId });
}