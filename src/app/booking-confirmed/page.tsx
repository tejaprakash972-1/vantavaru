"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCustomerAddressSummary } from "@/lib/customer-address";
import RequestLoader from "@/components/RequestLoader";
import {
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronRight,
    ClipboardList,
    Clock3,
    Copy,
    CreditCard,
    Edit3,
    House,
    Hourglass,
    MapPin,
    MessageSquareText,
    MoreHorizontal,
    ShieldCheck,
    Utensils,
    UsersRound,
    X,
} from "lucide-react";

type Booking = {
    id: string;
    customer_address_id: string | null;
    cook_profile_id: string | null;
    booking_date: string;
    booking_time: string;
    duration_minutes: number;
    people_count: number;
    status: string;
    payment_status: string;
    platform_fee: number;
    cook_fee: number;
    total_amount: number | null;
    customer_notes: string | null;
    razorpay_payment_id: string | null;
    start_otp: string | null;
    completion_otp: string | null;
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
    const [serviceAddress, setServiceAddress] = useState("");
    const [mealGroups, setMealGroups] = useState<MealGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelError, setCancelError] = useState("");

    useEffect(() => {
        if (!bookingId || !supabase) return;

        let cancelled = false;
        const client = supabase;
        const id = bookingId;
        async function loadBooking() {
            const { data: bookingData, error: bookingError } = await client
                .from("bookings")
                .select("id, customer_address_id, cook_profile_id, booking_date, booking_time, duration_minutes, people_count, status, payment_status, platform_fee, cook_fee, total_amount, customer_notes, razorpay_payment_id, start_otp, completion_otp")
                .eq("id", id)
                .maybeSingle();
            if (bookingError || !bookingData) {
                if (!cancelled) { setError(bookingError?.message || "This booking could not be found."); setLoading(false); }
                return;
            }

            if (bookingData.customer_address_id) {
                const summary = await getCustomerAddressSummary(client, bookingData.customer_address_id).catch(() => null);
                if (!cancelled) setServiceAddress(summary ?? "");
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
    if (loading) return <RequestLoader message="Loading booking details..." />;
    if (!booking) return <main className="booking-confirmed-error"><strong>{error || "Booking unavailable"}</strong><button onClick={() => router.push("/bookings")}>View My Bookings</button></main>;

    const date = booking.booking_date;
    const time = booking.booking_time;
    const duration = `${booking.duration_minutes / 60} ${booking.duration_minutes === 60 ? "Hour" : "Hours"}`;
    const people = booking.people_count;
    const platformFee = Number(booking.platform_fee || 0);
    const cookFee = Number(booking.cook_fee || 0);
    const displayBookingId = `#BK-${bookingId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const totalAmount = Number(booking.total_amount ?? platformFee + cookFee);
    const startOtp = booking.start_otp || createOtp(bookingId, "start");
    const completionOtp = booking.completion_otp || createOtp(bookingId, "completion");
    const statusTitle = getStatusTitle(booking.status);
    const statusDescription = getStatusDescription(booking.status);
    const canCancelBooking = booking.status === "searching_cook" && !booking.cook_profile_id;

    async function cancelBooking() {
        if (!supabase || !canCancelBooking) return;
        setIsCancelling(true);
        setCancelError("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Please sign in again to cancel this booking.");

            const response = await fetch("/api/cancel-booking", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ bookingId }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || "Unable to cancel booking.");

            setBooking((current) => current ? { ...current, status: "cancelled" } : current);
            setCancelConfirmOpen(false);
            setOptionsOpen(false);
        } catch (cancelRequestError) {
            setCancelError(cancelRequestError instanceof Error ? cancelRequestError.message : "Unable to cancel booking.");
        } finally {
            setIsCancelling(false);
        }
    }

    return (
        <main className="booking-confirmed-page">
            <header className="booking-confirmed-header">
                <button className="confirmed-icon-button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>
                <h1>Booking Details</h1>
                <div className="booking-options-wrap">
                    <button className="confirmed-icon-button" aria-label="More options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><MoreHorizontal /></button>
                    {optionsOpen && <div className="booking-options-menu" role="menu">{canCancelBooking ? <button role="menuitem" className="booking-cancel-option" onClick={() => { setOptionsOpen(false); setCancelConfirmOpen(true); }}><X /> Cancel Booking</button> : <span className="booking-options-disabled">No actions available</span>}</div>}
                </div>
            </header>

            <section className="confirmed-hero">
                <div className="confirmed-hero-copy"><button className="booking-id-copy" onClick={() => void navigator.clipboard?.writeText(displayBookingId)}>Booking {displayBookingId}<Copy /></button><h2>{statusTitle}</h2><p>{statusDescription}</p></div>
                <div className="confirmed-home-art" aria-hidden="true"><House /><span>Good food brings people together</span></div>
            </section>

            <section className="confirmed-card booking-summary-card">
                <div className="confirmed-card-heading"><div className="confirmed-section-title"><ClipboardList /><h2>Booking Information</h2></div>{booking.status === "searching_cook" && !booking.cook_profile_id && <button className="confirmed-edit-button" onClick={() => router.push(`/book?bookingId=${encodeURIComponent(bookingId)}`)}><Edit3 /> Edit</button>}</div>
                <DetailRow icon={CalendarDays} label="Date" value={formatDate(date)} />
                <DetailRow icon={Clock3} label="Time" value={formatTime(time)} />
                <DetailRow icon={UsersRound} label="People" value={`${people} ${people === 1 ? "person" : "people"}`} />
                {booking.customer_address_id && <DetailRow icon={MapPin} label="Service Address" value={serviceAddress || "Address unavailable"} />}
                <DetailRow icon={Clock3} label="Duration" value={duration} />
                <DetailRow icon={MessageSquareText} label="Your Notes" value={booking.customer_notes || "No additional notes"} />
                <div className="confirmed-status"><span className="status-dot" /><div><strong>Status</strong><small>{statusDescription}</small></div><b>{formatStatus(booking.status)}</b></div>
            </section>

            <section className="confirmed-card meals-card">
                <div className="confirmed-section-title"><Utensils /><h2>Meals &amp; Dishes</h2><span className="confirmed-dish-count">{mealGroups.reduce((sum, meal) => sum + meal.dishes.length, 0)} dishes</span></div>
                {mealGroups.length === 0 ? <p className="confirmed-empty">Your selected meals will appear here.</p> : mealGroups.map((meal) => <div className="confirmed-meal" key={meal.id}><div className="confirmed-meal-heading"><strong>{meal.name}</strong><span>{meal.dishes.length} {meal.dishes.length === 1 ? "dish" : "dishes"}</span></div><ul>{meal.dishes.map((dish) => <li key={dish}><span>{dish}</span><small>1 portion</small></li>)}</ul></div>)}
            </section>

            <section className="confirmed-card ingredients-card">
                <div className="confirmed-section-title"><House /><h2>Ingredients</h2><span className="ingredients-pill"><Check /> Please ensure availability</span></div>
                <p>Please ensure all the ingredients are available at your home before the cook arrives.</p>
                {/* <div className="ingredients-note"><Hourglass /><div><strong>Fresh ingredients, quality assured</strong><small>Your cook will source and bring fresh ingredients on the day of cooking.</small></div></div> */}
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
                <div className="payment-success"><span><Check /></span><div><strong>₹{platformFee.toFixed(2)} Paid Successfully</strong><small>{booking.razorpay_payment_id ? `Transaction ID: ${booking.razorpay_payment_id}` : `Payment status: ${booking.payment_status}`}</small></div><button>View Receipt <ChevronRight /></button></div>
            </section>

            <div className="confirmed-actions"><button className="confirmed-home-button" onClick={() => router.push("/")}><House /> Go to Home</button><button className="confirmed-bookings-button" onClick={() => router.push("/bookings")}><ClipboardList /> View My Bookings</button></div>
            {cancelError && <p className="booking-cancel-error" role="alert">{cancelError}</p>}
            {cancelConfirmOpen && <div className="booking-cancel-backdrop" role="presentation" onMouseDown={() => !isCancelling && setCancelConfirmOpen(false)}><section className="booking-cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-booking-title" aria-describedby="cancel-booking-description" onMouseDown={(event) => event.stopPropagation()}><h2 id="cancel-booking-title">Cancel this booking?</h2><p id="cancel-booking-description">This booking will be marked as cancelled. This action can&apos;t be undone.</p><div><button className="booking-cancel-keep" disabled={isCancelling} onClick={() => setCancelConfirmOpen(false)}>Keep Booking</button><button className="booking-cancel-confirm" disabled={isCancelling} onClick={() => void cancelBooking()}>{isCancelling ? "Cancelling..." : "Cancel Booking"}</button></div></section></div>}
            {isCancelling && <RequestLoader message="Cancelling booking..." />}
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

function getStatusTitle(status: string) {
    if (isCompletedStatus(status)) return "Booking completed";
    if (status === "cancelled") return "Booking cancelled";
    if (status === "searching_cook") return "Searching for a cook";
    return formatStatus(status);
}

function getStatusDescription(status: string) {
    if (isCompletedStatus(status)) return "Your booking has been completed.";
    if (status === "cancelled") return "This booking has been cancelled.";
    return "We'll notify you once a cook is assigned.";
}

function isCompletedStatus(status: string) {
    return ["completed", "complete", "done"].includes(status.toLowerCase());
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
