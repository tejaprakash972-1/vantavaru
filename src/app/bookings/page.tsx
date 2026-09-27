"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
    CalendarDays,
    ChevronRight,
    Clock3,
    House,
    MapPin,
    Settings,
    UsersRound,
} from "lucide-react";

type BookingTab = "upcoming" | "completed";

type BookingRow = {
    id: string;
    cook_profile_id: string | null;
    booking_date: string;
    booking_time: string;
    people_count: number;
    duration_minutes: number;
    status: string;
    payment_status: string;
    platform_fee: number | null;
    cook_fee: number | null;
    total_amount: number | null;
    completed_at: string | null;
};

type BookingMealRow = { booking_id: string; meal_type_id: string };
type BookingDishRow = { booking_id: string; dish_id: string; meal_type_id: string | null };
type NamedRow = { id: string; name: string };
type CookProfileRow = { id: string; full_name: string | null };

type BookingCardData = {
    id: string;
    meal: string;
    dishes: string;
    date: string;
    time: string;
    people: string;
    location: string;
    price: string;
    status: BookingTab;
    statusLabel: string;
};

export default function BookingsPage() {
    const router = useRouter();
    const supabase = getSupabaseBrowserClient();
    const [tab, setTab] = useState<BookingTab>("upcoming");
    const [activeNav, setActiveNav] = useState("My Bookings");
    const [bookings, setBookings] = useState<BookingCardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!supabase) {
            setError("Supabase is not configured.");
            setLoading(false);
            return;
        }

        let cancelled = false;
        const client = supabase;

        async function loadBookings() {
            setLoading(true);
            setError("");

            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError || !user) {
                if (!cancelled) {
                    setBookings([]);
                    setError("Please log in to view your bookings.");
                    setLoading(false);
                }
                return;
            }

            const { data: bookingRows, error: bookingError } = await client
                .from("bookings")
                .select("id, cook_profile_id, booking_date, booking_time, people_count, duration_minutes, status, payment_status, platform_fee, cook_fee, total_amount, completed_at")
                .eq("customer_id", user.id)
                .order("booking_date", { ascending: true })
                .order("booking_time", { ascending: true });

            if (bookingError) {
                if (!cancelled) {
                    setError(bookingError.message || "Unable to load bookings.");
                    setBookings([]);
                    setLoading(false);
                }
                return;
            }

            const rows = (bookingRows ?? []) as BookingRow[];
            const bookingIds = rows.map((booking) => booking.id);
            const cookProfileIds = rows.map((booking) => booking.cook_profile_id).filter((id): id is string => Boolean(id));

            const [mealResult, dishLinkResult, cookResult] = await Promise.all([
                bookingIds.length > 0 ? client.from("booking_meals").select("booking_id, meal_type_id").in("booking_id", bookingIds) : Promise.resolve({ data: [], error: null }),
                bookingIds.length > 0 ? client.from("booking_dishes").select("booking_id, dish_id, meal_type_id").in("booking_id", bookingIds) : Promise.resolve({ data: [], error: null }),
                cookProfileIds.length > 0 ? client.from("cook_profiles").select("id, full_name").in("id", cookProfileIds) : Promise.resolve({ data: [], error: null }),
            ]);

            if (mealResult.error || dishLinkResult.error || cookResult.error) {
                if (!cancelled) {
                    setError("Some booking details could not be loaded.");
                    setBookings(rows.map((booking) => mapBooking(booking, new Map(), new Map(), [], new Map())));
                    setLoading(false);
                }
                return;
            }

            const mealRows = (mealResult.data ?? []) as BookingMealRow[];
            const dishLinks = (dishLinkResult.data ?? []) as BookingDishRow[];
            const mealTypeIds = Array.from(new Set(mealRows.map((row) => row.meal_type_id).concat(dishLinks.map((row) => row.meal_type_id || "")).filter(Boolean)));
            const dishIds = Array.from(new Set(dishLinks.map((row) => row.dish_id)));

            const [mealTypeResult, dishResult] = await Promise.all([
                mealTypeIds.length > 0 ? client.from("meal_types").select("id, name").in("id", mealTypeIds) : Promise.resolve({ data: [], error: null }),
                dishIds.length > 0 ? client.from("dishes").select("id, name").in("id", dishIds) : Promise.resolve({ data: [], error: null }),
            ]);

            const mealNames = new Map(((mealTypeResult.data ?? []) as NamedRow[]).map((meal) => [meal.id, meal.name]));
            const dishNames = new Map(((dishResult.data ?? []) as NamedRow[]).map((dish) => [dish.id, dish.name]));
            const cooks = new Map(((cookResult.data ?? []) as CookProfileRow[]).map((cook) => [cook.id, cook.full_name || "Assigned cook"]));

            if (!cancelled) {
                if (mealTypeResult.error || dishResult.error) setError("Some meal details could not be loaded.");
                setBookings(rows.map((booking) => mapBooking(booking, mealNames, dishNames, dishLinks, cooks, mealRows)));
                setLoading(false);
            }
        }

        void loadBookings();
        return () => { cancelled = true; };
    }, [supabase]);

    const upcomingCount = bookings.filter((booking) => booking.status === "upcoming").length;
    const completedCount = bookings.filter((booking) => booking.status === "completed").length;
    const visibleBookings = bookings.filter((booking) => booking.status === tab);

    return (
        <>
            <main className="bookings-page">
                <header className="bookings-header">
                    <div className="bookings-brand"><div className="bookings-brand-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div>
                </header>

                <section className="bookings-intro"><h1>Booking History</h1><p>View and manage all your meal bookings</p></section>

                <div className="booking-tabs" role="tablist" aria-label="Booking status"><button role="tab" aria-selected={tab === "upcoming"} className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming ({upcomingCount})</button><button role="tab" aria-selected={tab === "completed"} className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed ({completedCount})</button></div>

                <section className="booking-history-list" aria-live="polite">
                    {loading ? <div className="empty-bookings"><CalendarDays /><strong>Loading bookings</strong><span>Please wait while we fetch your bookings.</span></div> : error ? <div className="empty-bookings"><CalendarDays /><strong>{error}</strong><span>Your bookings will appear here once available.</span></div> : visibleBookings.length === 0 ? <div className="empty-bookings"><CalendarDays /><strong>No {tab} bookings</strong><span>Your meal bookings will appear here.</span></div> : visibleBookings.map((booking) => <BookingCard key={booking.id} booking={booking} onOpen={() => router.push(`/booking-confirmed?bookingId=${booking.id}`)} />)}
                </section>

            </main>

            <BottomNav
                items={[{ label: "Home", icon: House }, { label: "My Bookings", icon: CalendarDays }, { label: "Settings", icon: Settings }]}
                activeLabel={activeNav}
                onSelect={(label) => { setActiveNav(label); if (label === "Home") router.push("/"); }}
            />
        </>
    );
}

function BookingCard({ booking, onOpen }: { booking: BookingCardData; onOpen: () => void }) {
    function openFromKeyboard(event: React.KeyboardEvent<HTMLElement>) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
        }
    }

    return <article className="history-card history-card-clickable" role="button" tabIndex={0} onClick={onOpen} onKeyDown={openFromKeyboard} aria-label={`Open booking details for ${booking.meal}`}><div className="history-card-top"><div className="meal-icon"><CalendarDays /></div><div className="meal-heading-copy"><h2>{booking.meal}</h2><p>{booking.dishes}</p></div><div className="history-price"><span className="history-status">{booking.statusLabel}</span><strong>{booking.price}</strong><small>(Total)</small></div></div><div className="history-details"><span><CalendarDays />{booking.date}</span><span><Clock3 />{booking.time}</span><span><UsersRound />{booking.people}</span><span><MapPin />{booking.location}</span></div><div className="history-card-footer"><span>Tap to view details</span><ChevronRight /></div></article>;
}

function mapBooking(booking: BookingRow, mealNames: Map<string, string>, dishNames: Map<string, string>, dishLinks: BookingDishRow[], cooks: Map<string, string>, mealRows: BookingMealRow[] = []): BookingCardData {
    const status = isCompletedBooking(booking) ? "completed" : "upcoming";
    const linkedMeals = mealRows.filter((row) => row.booking_id === booking.id).map((row) => mealNames.get(row.meal_type_id)).filter((name): name is string => Boolean(name));
    const linkedDishes = dishLinks.filter((row) => row.booking_id === booking.id).map((row) => dishNames.get(row.dish_id)).filter((name): name is string => Boolean(name));
    const total = Number(booking.total_amount ?? Number(booking.platform_fee || 0) + Number(booking.cook_fee || 0));

    return {
        id: booking.id,
        meal: linkedMeals.length > 0 ? linkedMeals.join(", ") : "Meal booking",
        dishes: linkedDishes.length > 0 ? linkedDishes.join(", ") : "Selected dishes will appear after confirmation.",
        date: formatDate(booking.booking_date),
        time: `${formatTime(booking.booking_time)} - ${formatTime(addMinutes(booking.booking_time, booking.duration_minutes))}`,
        people: `${booking.people_count} ${booking.people_count === 1 ? "person" : "people"}`,
        location: booking.cook_profile_id ? cooks.get(booking.cook_profile_id) || "Cook assigned" : "Cook not assigned yet",
        price: `₹${total.toFixed(2)}`,
        status,
        statusLabel: formatStatus(booking.status),
    };
}

function isCompletedBooking(booking: BookingRow) {
    return Boolean(booking.completed_at) || ["completed", "complete", "done"].includes(booking.status.toLowerCase());
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

function addMinutes(time: string, minutes: number) {
    const [hours = "0", mins = "0"] = time.split(":");
    const date = new Date("2026-01-01T00:00:00");
    date.setHours(Number(hours), Number(mins) + minutes, 0, 0);
    return date.toTimeString().slice(0, 8);
}