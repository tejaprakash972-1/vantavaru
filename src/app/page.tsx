"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppEntryRoute } from "@/lib/auth/routing";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  CookingPot,
  Heart,
  House,
  Leaf,
  LifeBuoy,
  LoaderCircle,
  MapPin,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";

const timeSlots = [
  { label: "1 Hour", detail: "Perfect for small meals" },
  { label: "2 Hours", detail: "For larger meals" },
];
const bookingDraftStorageKey = "vantavaru-review-return-draft";

const steps: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: CalendarDays, title: "Choose date & time", detail: "Pick a convenient slot" },
  { icon: UserRound, title: "We assign a cook", detail: "A verified cook comes to your home" },
  { icon: CookingPot, title: "Enjoy home-cooked meals", detail: "Fresh, tasty and hassle-free" },
];

type UpcomingBooking = {
  id: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  cook_profile_id: string | null;
  mealNames: string[];
  cookName: string | null;
};

export default function Home() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [authResolved, setAuthResolved] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedTime, setSelectedTime] = useState("1 Hour");
  const [locationOpen, setLocationOpen] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  const [upcomingBooking, setUpcomingBooking] = useState<UpcomingBooking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    router.prefetch(`/book?duration=${encodeURIComponent(selectedTime)}`);
  }, [router, selectedTime]);

  useEffect(() => {
    void getAppEntryRoute().then((destination) => {
      if (destination === "/") {
        setAuthResolved(true);
      } else {
        router.replace(destination);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!supabase) {
      setBookingLoading(false);
      return;
    }

    let cancelled = false;
    const client = supabase;

    async function loadUpcomingBooking() {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        if (!cancelled) setBookingLoading(false);
        return;
      }

      const { data: booking, error: bookingError } = await client
        .from("bookings")
        .select("id, booking_date, booking_time, duration_minutes, status, cook_profile_id, completed_at, created_at")
        .eq("customer_id", user.id)
        .is("completed_at", null)
        .not("status", "in", "(completed,complete,done)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bookingError) {
        if (!cancelled) {
          setBookingError("Upcoming booking details are temporarily unavailable.");
          setBookingLoading(false);
        }
        return;
      }

      if (!booking) {
        if (!cancelled) {
          setUpcomingBooking(null);
          setBookingLoading(false);
        }
        return;
      }

      const [mealLinksResult, cookResult] = await Promise.all([
        client.from("booking_meals").select("meal_type_id").eq("booking_id", booking.id),
        booking.cook_profile_id
          ? client.from("cook_profiles").select("full_name").eq("id", booking.cook_profile_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      const mealTypeIds = (mealLinksResult.data ?? []).map((meal) => meal.meal_type_id);
      const mealTypesResult = mealTypeIds.length > 0
        ? await client.from("meal_types").select("name").in("id", mealTypeIds)
        : { data: [], error: null };

      if (!cancelled) {
        if (mealLinksResult.error || cookResult.error || mealTypesResult.error) {
          setBookingError("Some upcoming booking details could not be loaded.");
        }
        setUpcomingBooking({
          ...booking,
          mealNames: (mealTypesResult.data ?? []).map((meal) => meal.name),
          cookName: cookResult.data?.full_name ?? null,
        });
        setBookingLoading(false);
      }
    }

    void loadUpcomingBooking();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!authResolved) {
    return <main className="auth-route-loading" aria-label="Checking your account" />;
  }

  function bookCook() {
    window.sessionStorage.removeItem(bookingDraftStorageKey);
    setIsNavigating(true);
    router.push(`/book?duration=${encodeURIComponent(selectedTime)}`);
  }

  function chooseCookingTime(duration: string) {
    window.sessionStorage.removeItem(bookingDraftStorageKey);
    setSelectedTime(duration);
    setIsNavigating(true);
    router.push(`/book?duration=${encodeURIComponent(duration)}`);
  }

  return (
    <div className="app-background">
      <main className="app-shell">
        <header className="topbar">
          <div className="brand-lockup" aria-label="Vantavaru home">
            <div className="brand-mark" aria-hidden="true"><House /><Heart className="brand-heart" /></div>
            <div><div className="brand-name">Vantavaru</div><div className="brand-tagline">Home Cooked. For Your Home.</div></div>
          </div>
          <button className="profile-button" aria-label="Open profile"><UserRound /></button>
        </header>

        <button className={`location-bar ${locationOpen ? "location-bar-open" : ""}`} onClick={() => setLocationOpen(!locationOpen)} aria-expanded={locationOpen}>
          <MapPin className="location-icon" aria-hidden="true" /><span>{locationOpen ? "Choose your neighbourhood" : "Hitech City, Hyderabad"}</span>{locationOpen ? <ChevronDown className="location-arrow location-arrow-open" aria-hidden="true" /> : <ChevronRight className="location-arrow" aria-hidden="true" />}
        </button>

        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">COOKING, MADE PERSONAL</p>
            <h1>Delicious<br />home-cooked meals<br />at your doorstep</h1>
            <p className="hero-description">Book a professional cook for<br className="desktop-break" /> fresh, healthy and homemade meals.</p>
            <button className="primary-button" onClick={bookCook} disabled={isNavigating}>{isNavigating ? <><LoaderCircle className="button-spinner" aria-hidden="true" /> Opening booking</> : <>Book a Cook</>}</button>
          </div>
        </section>

        <section className="section-block time-section">
          <div className="section-heading"><h2>Choose your cooking time</h2></div>
          <div className="time-grid">{timeSlots.map((slot) => <button key={slot.label} className={`time-card ${selectedTime === slot.label ? "time-card-selected" : ""}`} onClick={() => chooseCookingTime(slot.label)} disabled={isNavigating}><span className="clock-icon"><Clock3 aria-hidden="true" /></span><span className="time-copy"><strong>{slot.label}</strong><small>{slot.detail}</small></span><ChevronRight className="card-arrow" aria-hidden="true" /></button>)}</div>
          {bookingMessage && <p className="booking-message" role="status">{bookingMessage}</p>}
        </section>

        <section className="section-block how-section">
          <div className="section-heading"><h2>How it works</h2></div>
          <div className="steps-grid">{steps.map((step, index) => { const StepIcon = step.icon; return <div className="step" key={step.title}><div className={`step-icon step-icon-${index}`}><StepIcon aria-hidden="true" /><b>{index + 1}</b></div><h3>{step.title}</h3><p>{step.detail}</p></div>; })}</div>
        </section>

        <section className="section-block booking-section">
          <div className="section-heading"><h2>Upcoming Booking</h2><button className="text-link" onClick={() => router.push("/bookings")}>View all <ChevronRight aria-hidden="true" /></button></div>
          {bookingLoading ? <div className="home-booking-state" role="status"><LoaderCircle className="booking-loading-spinner" aria-hidden="true" /><span>Loading your upcoming booking...</span></div> : bookingError ? <div className="home-booking-state" role="status"><span>{bookingError}</span><button className="text-link" onClick={() => router.push("/bookings")}>View bookings <ChevronRight aria-hidden="true" /></button></div> : upcomingBooking ? <button className="booking-card home-upcoming-card" onClick={() => router.push(`/booking-confirmed?bookingId=${upcomingBooking.id}`)} aria-label="Open upcoming booking details"><div className="booking-summary"><div className="date-icon"><CalendarDays aria-hidden="true" /></div><div className="home-booking-copy"><strong>{formatBookingDate(upcomingBooking.booking_date)}</strong><p>{formatBookingTime(upcomingBooking.booking_time)} - {formatBookingTime(addBookingMinutes(upcomingBooking.booking_time, upcomingBooking.duration_minutes))}</p><small>{upcomingBooking.mealNames.join(", ") || "Meal booking"}</small></div><span className={`confirmed-pill booking-status-${upcomingBooking.status}`}>{formatBookingStatus(upcomingBooking.status)}</span></div><div className="home-booking-footer"><span>{upcomingBooking.cookName || "Cook not assigned yet"}</span><span>Booking details <ChevronRight aria-hidden="true" /></span></div></button> : <div className="home-booking-state"><span>No upcoming bookings yet.</span><button className="text-link" onClick={bookCook}>Book a Cook <ChevronRight aria-hidden="true" /></button></div>}
        </section>

        <BottomNav
          items={[{ label: "Home", icon: House }, { label: "My Bookings", icon: CalendarDays }, { label: "Settings", icon: Settings }]}
          activeLabel={activeTab}
          onSelect={(label) => { setActiveTab(label); if (label === "My Bookings") router.push("/bookings"); }}
        />
      </main>
      {isNavigating && <div className="navigation-overlay" role="status" aria-live="polite"><div className="navigation-card"><LoaderCircle className="navigation-spinner" aria-hidden="true" /><span>Preparing your booking</span></div></div>}
    </div>
  );
}

function formatBookingStatus(status: string) {
  return status.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatBookingTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${value}`));
}

function addBookingMinutes(value: string, minutes: number) {
  const [hours = "0", mins = "0"] = value.split(":");
  const time = new Date("2026-01-01T00:00:00");
  time.setHours(Number(hours), Number(mins) + minutes, 0, 0);
  return time.toTimeString().slice(0, 8);
}
