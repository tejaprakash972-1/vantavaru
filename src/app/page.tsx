"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAppEntryRoute } from "@/lib/auth/routing";
import {
  CalendarDays,
  Check,
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
  Plus,
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

type CustomerAddress = {
  id: string;
  society_id: string;
  label: string | null;
  flat_number: string | null;
  tower_block: string | null;
  address_line: string | null;
  landmark: string | null;
  is_default: boolean;
  society: string;
  area: string;
  city: string;
  pincode: string | null;
};

export default function Home() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [authResolved, setAuthResolved] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedTime, setSelectedTime] = useState("1 Hour");
  const [locationOpen, setLocationOpen] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState("");
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
      setAddressLoading(false);
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

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const client = supabase;

    async function loadCustomerAddresses() {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) {
        if (!cancelled) setAddressLoading(false);
        return;
      }

      const { data: addressRows, error: addressQueryError } = await client
        .from("customer_addresses")
        .select("id, society_id, label, flat_number, tower_block, address_line, landmark, is_default")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (addressQueryError) {
        if (!cancelled) {
          setAddressError("Saved addresses could not be loaded.");
          setAddressLoading(false);
        }
        return;
      }

      const rows = addressRows ?? [];
      const societyIds = [...new Set(rows.map((row) => row.society_id))];
      const { data: societyRows, error: societyError } = societyIds.length
        ? await client.from("societies").select("id, name, pincode, area_id").in("id", societyIds)
        : { data: [], error: null };
      const areaIds = [...new Set((societyRows ?? []).map((row) => row.area_id))];
      const { data: areaRows, error: areaError } = areaIds.length
        ? await client.from("areas").select("id, name, city_id").in("id", areaIds)
        : { data: [], error: null };
      const cityIds = [...new Set((areaRows ?? []).map((row) => row.city_id))];
      const { data: cityRows, error: cityError } = cityIds.length
        ? await client.from("cities").select("id, name").in("id", cityIds)
        : { data: [], error: null };

      if (cancelled) return;
      if (societyError || areaError || cityError) setAddressError("Some saved address details could not be loaded.");
      const societyById = new Map((societyRows ?? []).map((row) => [row.id, row]));
      const areaById = new Map((areaRows ?? []).map((row) => [row.id, row]));
      const cityById = new Map((cityRows ?? []).map((row) => [row.id, row]));
      const mapped = rows.map((row) => {
        const society = societyById.get(row.society_id);
        const area = society ? areaById.get(society.area_id) : null;
        const city = area ? cityById.get(area.city_id) : null;
        return {
          ...row,
          society: society?.name ?? "Society",
          area: area?.name ?? "Area",
          city: city?.name ?? "City",
          pincode: society?.pincode ?? null,
        };
      }) as CustomerAddress[];
      setCustomerAddresses(mapped);
      setSelectedAddressId((current) => current && mapped.some((address) => address.id === current) ? current : mapped.find((address) => address.is_default)?.id ?? mapped[0]?.id ?? "");
      setAddressLoading(false);
    }

    void loadCustomerAddresses();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!authResolved) {
    return <main className="auth-route-loading" aria-label="Checking your account" />;
  }

  const selectedAddress = customerAddresses.find((address) => address.id === selectedAddressId) ?? null;

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

        <div className="home-address-picker">
          <button className={`location-bar ${locationOpen ? "location-bar-open" : ""}`} onClick={() => setLocationOpen(!locationOpen)} aria-expanded={locationOpen}>
            <MapPin className="location-icon" aria-hidden="true" />
            <span className="home-address-label">{addressLoading ? "Loading saved addresses..." : selectedAddress ? <><strong>{selectedAddress.label || "Home"}</strong><small>{addressSummary(selectedAddress)}</small></> : addressError || "Add your delivery address"}</span>
            {locationOpen ? <ChevronDown className="location-arrow location-arrow-open" aria-hidden="true" /> : <ChevronRight className="location-arrow" aria-hidden="true" />}
          </button>
          {locationOpen && <div className="home-address-menu" role="listbox" aria-label="Saved addresses">
            {customerAddresses.map((address) => <button type="button" role="option" aria-selected={selectedAddressId === address.id} className={selectedAddressId === address.id ? "selected" : ""} key={address.id} onClick={() => { setSelectedAddressId(address.id); setLocationOpen(false); }}><span className="home-address-menu-label"><strong>{address.label || "Home"}</strong>{selectedAddressId === address.id && <Check />}</span><small>{addressSummary(address)}</small></button>)}
            <button type="button" className="home-address-add" onClick={() => router.push("/customer-addresses/new")}><Plus /> Add new address</button>
          </div>}
        </div>

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

function addressSummary(address: CustomerAddress) {
  return [address.flat_number, address.tower_block, address.society, address.area, address.city, address.pincode].filter(Boolean).join(", ");
}
