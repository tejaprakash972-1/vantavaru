import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

type BookingDetails = {
    addressId: string;
    date: string;
    time: string;
    duration: string;
    people: number;
    price: number;
    platformFee: number;
    cookFee: number;
    meals: string[];
    dishes: Record<string, string[]>;
};

export async function POST(request: Request) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking } = await request.json() as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
        booking?: BookingDetails;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ success: false, error: "Missing payment details." }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        return NextResponse.json({ success: false, error: "Razorpay is not configured." }, { status: 500 });
    }

    const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

    const isValid = expectedSignature === razorpay_signature;
    if (!isValid) {
        return NextResponse.json({ success: false, error: "Payment verification failed." }, { status: 400 });
    }

    if (typeof booking?.addressId !== "string" || !booking.addressId || !booking.date || !booking.time || !booking.duration || !Number.isFinite(booking.people) || !Number.isFinite(booking.price) || !Number.isFinite(booking.platformFee) || !Number.isFinite(booking.cookFee) || !Array.isArray(booking.meals) || !booking.dishes || typeof booking.dishes !== "object") {
        return NextResponse.json({ success: false, error: "Missing booking details." }, { status: 400 });
    }

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!accessToken || !supabaseUrl || !supabaseKey) {
        return NextResponse.json({ success: false, error: "Supabase is not configured." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
        return NextResponse.json({ success: false, error: "You must be signed in to create a booking." }, { status: 401 });
    }

    const { data: address, error: addressError } = await supabase.from("customer_addresses")
        .select("id")
        .eq("id", booking.addressId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
    if (addressError || !address) {
        return NextResponse.json({ success: false, error: "The selected address is no longer available. Please choose a saved address." }, { status: 400 });
    }

    const { data: createdBooking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
            customer_id: user.id,
            customer_address_id: address.id,
            booking_date: booking.date,
            booking_time: booking.time,
            people_count: booking.people,
            duration_minutes: booking.duration === "2 Hours" ? 120 : 60,
            status: "searching_cook",
            payment_status: "paid",
            platform_fee: booking.platformFee,
            cook_fee: booking.cookFee,
            razorpay_order_id,
            razorpay_order_status: "paid",
            razorpay_amount: Math.round(booking.price * 100),
        })
        .select("id")
        .single();

    if (bookingError) {
        console.error("Booking creation failed after payment:", bookingError);
        return NextResponse.json({ success: false, error: "Payment succeeded, but the booking could not be created." }, { status: 500 });
    }

    const { error: mealError } = await supabase.from("booking_meals").insert(
        booking.meals.map((mealTypeId) => ({ booking_id: createdBooking.id, meal_type_id: mealTypeId }))
    );
    if (mealError) {
        console.error("Booking meal creation failed after payment:", mealError);
        return NextResponse.json({ success: false, error: "Payment succeeded, but the booking meals could not be created." }, { status: 500 });
    }

    const selectedDishNames = Object.values(booking.dishes).flat();
    if (selectedDishNames.length > 0) {
        const { data: dishes, error: dishLookupError } = await supabase
            .from("dishes")
            .select("id, name, meal_type_id")
            .in("name", selectedDishNames);
        if (dishLookupError) {
            console.error("Dish lookup failed after payment:", dishLookupError);
            return NextResponse.json({ success: false, error: "Payment succeeded, but the booking dishes could not be found." }, { status: 500 });
        }

        const dishRows = Object.entries(booking.dishes).flatMap(([mealTypeId, dishNames]) => dishNames.map((dishName) => {
            const dish = dishes?.find((item) => item.meal_type_id === mealTypeId && item.name === dishName);
            return dish ? { booking_id: createdBooking.id, meal_type_id: mealTypeId, dish_id: dish.id } : null;
        }).filter((row): row is { booking_id: string; meal_type_id: string; dish_id: string } => row !== null));

        if (dishRows.length !== selectedDishNames.length) {
            return NextResponse.json({ success: false, error: "Payment succeeded, but one or more selected dishes could not be found." }, { status: 500 });
        }

        const { error: dishError } = await supabase.from("booking_dishes").insert(dishRows);
        if (dishError) {
            console.error("Booking dish creation failed after payment:", dishError);
            return NextResponse.json({ success: false, error: "Payment succeeded, but the booking dishes could not be created." }, { status: 500 });
        }
    }

    try {
        const { error: notificationError } = await supabase.functions.invoke("notify-new-booking", {
            body: { booking_id: createdBooking.id },
        });
        if (notificationError) {
            console.error("New booking notification failed:", notificationError);
        }
    } catch (notificationError) {
        console.error("New booking notification failed:", notificationError);
    }

    console.log("Booking created after payment:", createdBooking);
    return NextResponse.json({ success: true, booking: createdBooking });
}
