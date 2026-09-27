import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type UpdateBookingRequest = {
    bookingId?: string;
    date?: string;
    time?: string;
    duration?: string;
    people?: number;
    cookFee?: number;
    meals?: string[];
    dishes?: Record<string, string[]>;
    notes?: string;
};

export async function PATCH(request: Request) {
    let body: UpdateBookingRequest;
    try {
        body = await request.json() as UpdateBookingRequest;
    } catch {
        return NextResponse.json({ success: false, error: "Invalid booking update request." }, { status: 400 });
    }

    if (!body.bookingId || !body.date || !body.time || !["1 Hour", "2 Hours"].includes(body.duration || "") || !Number.isInteger(body.people) || !Number.isFinite(body.cookFee) || !Array.isArray(body.meals) || !body.dishes || typeof body.dishes !== "object") {
        return NextResponse.json({ success: false, error: "Missing or invalid booking details." }, { status: 400 });
    }

    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!accessToken) {
        return NextResponse.json({ success: false, error: "Please sign in to update this booking." }, { status: 401 });
    }
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
        return NextResponse.json({ success: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
    if (userError || !user) {
        return NextResponse.json({ success: false, error: "Please sign in to update this booking." }, { status: 401 });
    }

    const database = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: booking, error: bookingError } = await database
        .from("bookings")
        .select("id, customer_id, status, cook_profile_id, platform_fee")
        .eq("id", body.bookingId)
        .eq("customer_id", user.id)
        .maybeSingle();
    if (bookingError || !booking) {
        return NextResponse.json({ success: false, error: bookingError?.message || "Booking not found." }, { status: 404 });
    }
    if (booking.status !== "searching_cook" || booking.cook_profile_id) {
        return NextResponse.json({ success: false, error: "This booking can no longer be edited because a cook has been assigned or the service has started." }, { status: 409 });
    }

    const mealIds = [...new Set(body.meals)];
    const { data: validMeals, error: mealsError } = mealIds.length > 0
        ? await database.from("meal_types").select("id").in("id", mealIds)
        : { data: [], error: null };
    if (mealsError || (validMeals ?? []).length !== mealIds.length) {
        return NextResponse.json({ success: false, error: "One or more selected meal types are invalid." }, { status: 400 });
    }

    const selectedDishNames = Object.values(body.dishes).flat();
    const { data: dishCatalog, error: dishesError } = selectedDishNames.length > 0
        ? await database.from("dishes").select("id, name, meal_type_id").in("name", [...new Set(selectedDishNames)])
        : { data: [], error: null };
    if (dishesError) {
        return NextResponse.json({ success: false, error: "Unable to validate the selected dishes." }, { status: 500 });
    }

    const dishRows = Object.entries(body.dishes).flatMap(([mealTypeId, names]) => names.map((name) => {
        const dish = dishCatalog?.find((item) => item.meal_type_id === mealTypeId && item.name === name);
        return dish ? { booking_id: body.bookingId!, meal_type_id: mealTypeId, dish_id: dish.id } : null;
    }).filter((row): row is { booking_id: string; meal_type_id: string; dish_id: string } => row !== null));
    if (dishRows.length !== selectedDishNames.length || Object.keys(body.dishes).some((mealId) => !mealIds.includes(mealId))) {
        return NextResponse.json({ success: false, error: "One or more selected dishes do not match the selected meals." }, { status: 400 });
    }

    const { error: deleteDishesError } = await database.from("booking_dishes").delete().eq("booking_id", body.bookingId);
    if (deleteDishesError) return NextResponse.json({ success: false, error: "Unable to replace the booking dishes." }, { status: 500 });
    if (dishRows.length > 0) {
        const { error } = await database.from("booking_dishes").insert(dishRows);
        if (error) return NextResponse.json({ success: false, error: "Unable to save the updated booking dishes." }, { status: 500 });
    }

    const { error: deleteMealsError } = await database.from("booking_meals").delete().eq("booking_id", body.bookingId);
    if (deleteMealsError) return NextResponse.json({ success: false, error: "Unable to replace the booking meals." }, { status: 500 });
    if (mealIds.length > 0) {
        const { error } = await database.from("booking_meals").insert(mealIds.map((mealTypeId) => ({ booking_id: body.bookingId, meal_type_id: mealTypeId })));
        if (error) return NextResponse.json({ success: false, error: "Unable to save the updated booking meals." }, { status: 500 });
    }

    const platformFee = Number(booking.platform_fee || 0);
    const { error: updateError } = await database.from("bookings").update({
        booking_date: body.date,
        booking_time: body.time,
        duration_minutes: body.duration === "2 Hours" ? 120 : 60,
        people_count: body.people,
        customer_notes: body.notes?.trim() || null,
        cook_fee: body.cookFee,
        total_amount: platformFee + body.cookFee!,
    }).eq("id", body.bookingId).eq("customer_id", user.id);
    if (updateError) {
        return NextResponse.json({ success: false, error: "The selected meals were updated, but booking details could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookingId: body.bookingId });
}