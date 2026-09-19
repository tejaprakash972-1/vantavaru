"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import BottomNav from "@/components/BottomNav";
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

const steps: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: CalendarDays, title: "Choose date & time", detail: "Pick a convenient slot" },
  { icon: UserRound, title: "We assign a cook", detail: "A verified cook comes to your home" },
  { icon: CookingPot, title: "Enjoy home-cooked meals", detail: "Fresh, tasty and hassle-free" },
];

export default function Home() {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedTime, setSelectedTime] = useState("1 Hour");
  const [locationOpen, setLocationOpen] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

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

  if (!authResolved) {
    return <main className="auth-route-loading" aria-label="Checking your account" />;
  }

  function bookCook() {
    setIsNavigating(true);
    router.push(`/book?duration=${encodeURIComponent(selectedTime)}`);
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
          <div className="time-grid">{timeSlots.map((slot) => <button key={slot.label} className={`time-card ${selectedTime === slot.label ? "time-card-selected" : ""}`} onClick={() => setSelectedTime(slot.label)}><span className="clock-icon"><Clock3 aria-hidden="true" /></span><span className="time-copy"><strong>{slot.label}</strong><small>{slot.detail}</small></span><ChevronRight className="card-arrow" aria-hidden="true" /></button>)}</div>
          {bookingMessage && <p className="booking-message" role="status">{bookingMessage}</p>}
        </section>

        <section className="section-block how-section">
          <div className="section-heading"><h2>How it works</h2><button className="text-link">See all <ChevronRight aria-hidden="true" /></button></div>
          <div className="steps-grid">{steps.map((step, index) => { const StepIcon = step.icon; return <div className="step" key={step.title}><div className={`step-icon step-icon-${index}`}><StepIcon aria-hidden="true" /><b>{index + 1}</b></div><h3>{step.title}</h3><p>{step.detail}</p></div>; })}</div>
        </section>

        <section className="section-block booking-section">
          <div className="section-heading"><h2>Upcoming Booking</h2><button className="text-link">View all <ChevronRight aria-hidden="true" /></button></div>
          <article className="booking-card"><div className="booking-summary"><div className="date-icon"><CalendarDays aria-hidden="true" /></div><div><strong>Sat, 16 Nov 2024</strong><p>10:00 AM – 12:00 PM</p></div><span className="confirmed-pill">Confirmed</span></div><div className="cook-summary"><div className="cook-avatar">PS</div><div><strong>Priya S.</strong><p><span className="star">★</span> 4.8</p></div></div><div className="booking-actions"><button className="secondary-button">View Details</button><button className="green-button">Reschedule</button></div></article>
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
