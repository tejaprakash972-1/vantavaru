"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
    CalendarDays,
    Check,
    ChevronRight,
    ClipboardList,
    Clock3,
    Copy,
    CreditCard,
    House,
    ShieldCheck,
    UsersRound,
} from "lucide-react";

type Booking = {
    id: string;
    booking_date: string;
    booking_time: string;
    duration_minutes: number;
    people_count: number;
    status: string;
    payment_status: string;
    platform_fee: number;
    cook_fee: number;
};

type MealGroup = { id: string; name: string; dishes: string[] };

export default function BookingConfirmedPage() {
    return <Suspense fallback={<div className="booking-confirmed-loading">Loading confirmation...</div>}><BookingConfirmedContent /></Suspense>;
}

function BookingConfirmedContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = getSupabaseBrowserClient();
    const bookingId = searchParams.get("bookingId");
    const [booking, setBooking] = useState<Booking | null>(null);
    const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!bookingId || !supabase) return;

        let cancelled = false;
        const client = supabase;
        const id = bookingId;
        async function loadBooking() {
            const { data: bookingData, error: bookingError } = await client
                .from("bookings")
                .select("id, booking_date, booking_time, duration_minutes, people_count, status, payment_status, platform_fee, cook_fee")
                .eq("id", id)
                .maybeSingle();
            if (bookingError || !bookingData) {
                if (!cancelled) { setError(bookingError?.message || "This booking could not be found."); setLoading(false); }
                return;
            }

            const { data: mealLinks, error: mealError } = await client.from("booking_meals").select("meal_type_id").eq("booking_id", id);
            const mealTypeIds = (mealLinks ?? []).map((row) => row.meal_type_id);
            const { data: mealTypes, error: mealTypeError } = mealTypeIds.length > 0
                ? await client.from("meal_types").select("id, name").in("id", mealTypeIds)
                : { data: [], error: null };
            const { data: dishLinks, error: dishError } = await client.from("booking_dishes").select("meal_type_id, dish_id").eq("booking_id", id);
            const dishIds = (dishLinks ?? []).map((row) => row.dish_id);
            const { data: dishRows, error: dishLookupError } = dishIds.length > 0
                ? await client.from("dishes").select("id, name").in("id", dishIds)
                : { data: [], error: null };

            if (!cancelled) {
                if (mealError || mealTypeError || dishError || dishLookupError) setError("Some booking details could not be loaded.");
                const names = new Map((mealTypes ?? []).map((row) => [row.id, row.name]));
                const dishNames = new Map((dishRows ?? []).map((row) => [row.id, row.name]));
                setBooking(bookingData as Booking);
                setMealGroups(mealTypeIds.map((mealTypeId) => ({
                    id: mealTypeId,
                    name: names.get(mealTypeId) || "Selected meal",
                    dishes: (dishLinks ?? []).filter((row) => row.meal_type_id === mealTypeId).map((row) => dishNames.get(row.dish_id) || "Selected dish"),
                })));
                setLoading(false);
            }
        }

        void loadBooking();
        return () => { cancelled = true; };
    }, [bookingId, supabase]);

    if (!bookingId || !supabase) return <main className="booking-confirmed-error"><strong>This booking could not be found.</strong><button onClick={() => router.push("/bookings")}>View My Bookings</button></main>;
    if (loading) return <div className="booking-confirmed-loading">Loading confirmation...</div>;
    if (!booking) return <main className="booking-confirmed-error"><strong>{error || "Booking unavailable"}</strong><button onClick={() => router.push("/bookings")}>View My Bookings</button></main>;

    const date = booking.booking_date;
    const time = booking.booking_time;
    const duration = `${booking.duration_minutes / 60} ${booking.duration_minutes === 60 ? "Hour" : "Hours"}`;
    const people = booking.people_count;
    const platformFee = Number(booking.platform_fee || 0);
    const cookFee = Number(booking.cook_fee || 0);
    const displayBookingId = `#BK-${bookingId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const totalAmount = platformFee + cookFee;
    const startOtp = createOtp(bookingId, "start");
    const completionOtp = createOtp(bookingId, "completion");

    return (
        <main className="booking-confirmed-page">
            <header className="booking-confirmed-header">
                <button className="confirmed-brand" onClick={() => router.push("/")} aria-label="Go to home">
                    <span className="confirmed-brand-mark"><House /></span>
                    <span><strong>Vantavaru</strong><small>Good Food. Happy Homes.</small></span>
                </button>
            </header>

            <section className="confirmed-hero">
                <div className="confirmed-check"><Check /></div>
                <div className="confetti confetti-one" /><div className="confetti confetti-two" /><div className="confetti confetti-three" />
                <h1>Booking Confirmed!</h1>
                <p>Your booking has been successfully created.</p>
                <span>We&apos;ll soon assign the best cook for your home.</span>
            </section>

            <section className="confirmed-card booking-summary-card">
                <div className="confirmed-card-heading"><h2>Booking Details</h2><button className="booking-id-copy" onClick={() => void navigator.clipboard?.writeText(displayBookingId)}>{displayBookingId}<Copy /></button></div>
                <DetailRow icon={CalendarDays} label="Date" value={formatDate(date)} />
                <DetailRow icon={Clock3} label="Time" value={formatTime(time)} />
                <DetailRow icon={UsersRound} label="People" value={`${people} ${people === 1 ? "person" : "people"}`} />
                <DetailRow icon={Clock3} label="Duration" value={duration} />
                <div className="confirmed-status"><span className="status-dot" /><div><strong>Status</strong><small>We&apos;ll notify you once a cook is assigned.</small></div><b>{formatStatus(booking.status)}</b></div>
            </section>

            <section className="confirmed-card meals-card">
                <div className="confirmed-section-title"><ClipboardList /><h2>Meals &amp; Dishes</h2></div>
                {mealGroups.length === 0 ? <p className="confirmed-empty">Your selected meals will appear here.</p> : mealGroups.map((meal) => <div className="confirmed-meal" key={meal.id}><div className="confirmed-meal-heading"><strong>{meal.name}</strong><span>{meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</span></div><ul>{meal.dishes.map((dish) => <li key={dish}><span>{dish}</span><small>1 portion</small></li>)}</ul></div>)}
            </section>

            <section className="confirmed-otp-card">
                <div className="confirmed-section-title"><ShieldCheck /><h2>Your Booking OTPs</h2></div>
                <div className="otp-columns"><Otp label="Start OTP" value={startOtp} caption="Share this with the cook when they arrive at your home." /><Otp label="Completion OTP" value={completionOtp} caption="Share this with the cook once the cooking is done." /></div>
            </section>

            <section className="confirmed-payment-card">
                <div className="confirmed-section-title"><CreditCard /><h2>Payment Summary</h2></div>
                <div className="payment-line"><span>Cook&apos;s Fee <small>(to be paid directly to cook)</small></span><strong>₹{cookFee.toFixed(2)}</strong></div>
                <div className="payment-line"><span>Platform Fee <small>(paid online)</small></span><strong>₹{platformFee.toFixed(2)}</strong></div>
                <hr />
                <div className="payment-total"><strong>Total Booking Amount</strong><strong>₹{totalAmount.toFixed(2)}</strong></div>
                <div className="payment-success"><span><Check /></span><div><strong>₹{platformFee.toFixed(2)} Paid Successfully</strong><small>Payment status: {booking.payment_status}</small></div><button>View Receipt <ChevronRight /></button></div>
            </section>

            <div className="confirmed-actions"><button className="confirmed-home-button" onClick={() => router.push("/")}><House /> Go to Home</button><button className="confirmed-bookings-button" onClick={() => router.push("/bookings")}><ClipboardList /> View My Bookings</button></div>
        </main>
    );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return <div className="confirmed-detail-row"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

function Otp({ label, value, caption }: { label: string; value: string; caption: string }) {
    return <div className="otp-item"><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>;
}

function createOtp(seed: string, salt: string) {
    let hash = 0;
    for (const character of `${seed}-${salt}`) hash = (hash * 31 + character.charCodeAt(0)) % 10000;
    return String(hash).padStart(4, "0");
}

function formatStatus(status: string) {
    return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${value}`));
}
