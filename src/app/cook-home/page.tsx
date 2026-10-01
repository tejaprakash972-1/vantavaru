"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import BottomNav from "@/components/BottomNav";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setCookAvailability } from "@/lib/cook/availability";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  House,
  MapPin,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  X,
  Check,
} from "lucide-react";

type BookingStatus = "Pending" | "Confirmed";
type CookStatus = "pending" | "approved" | "rejected";

type CookBooking = {
  id: number;
  day: string;
  month: string;
  meal: string;
  time: string;
  location: string;
  people: string;
  status: BookingStatus;
};

const upcomingBookings: CookBooking[] = [
  { id: 1, day: "16", month: "Nov 2024", meal: "Breakfast", time: "8:00 AM – 9:00 AM", location: "HSR Layout, Bengaluru", people: "4 people", status: "Pending" },
  { id: 2, day: "18", month: "Nov 2024", meal: "Lunch", time: "12:00 PM – 1:00 PM", location: "Koramangala, Bengaluru", people: "3 people", status: "Confirmed" },
  { id: 3, day: "20", month: "Nov 2024", meal: "Dinner", time: "7:00 PM – 8:30 PM", location: "Indiranagar, Bengaluru", people: "5 people", status: "Pending" },
];

export default function CookHomePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [bookings, setBookings] = useState(upcomingBookings);
  const [activeTab, setActiveTab] = useState("Home");
  const [notice, setNotice] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [cookProfileId, setCookProfileId] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [cookStatus, setCookStatus] = useState<CookStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatusError("Profile status unavailable");
      setStatusLoading(false);
      return;
    }

    let cancelled = false;
    const client = supabase;
    async function loadCookStatus() {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (cancelled) return;
      if (authError || !user) {
        setStatusError("Sign in to check status");
        setStatusLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await client.from("cook_profiles")
        .select("id, status, is_online")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profileError || !profile) {
        setStatusError(profileError ? "Profile status unavailable" : "Cook profile not found");
      } else {
        setCookProfileId(profile.id);
        setIsOnline(profile.is_online === true);
        if (profile.status === "pending" || profile.status === "approved" || profile.status === "rejected") {
          setCookStatus(profile.status);
        } else {
          setStatusError("Unknown profile status");
        }
      }
      setStatusLoading(false);
    }

    void loadCookStatus();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  function respondToBooking(id: number, response: BookingStatus) {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status: response } : booking));
    setNotice(response === "Confirmed" ? "Booking accepted successfully." : "Booking declined.");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice("");
      noticeTimer.current = null;
    }, 5000);
  }

  async function changeAvailability(nextOnline: boolean) {
    if (!supabase || !cookProfileId || availabilitySaving) return;
    setAvailabilitySaving(true);
    try {
      const online = await setCookAvailability(supabase, nextOnline);
      setIsOnline(online);
      setNotice(online ? "You are online." : "You are offline.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function enableNotifications() {
    if (!supabase || !cookProfileId || pushSaving) return;
    setPushSaving(true);
    setPushError("");
    try {
      const { getFCMToken } = await import("@/lib/firebase-messaging");
      const token = await getFCMToken();
      if (!token) throw new Error(typeof Notification !== "undefined" && Notification.permission === "denied" ? "Notifications are blocked. Enable them in your browser settings." : "Unable to enable notifications on this device.");

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Please sign in again to enable notifications.");
      const response = await fetch("/api/cook/push-device", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ pushToken: token, platform: Capacitor.getPlatform() === "android" ? "android" : "web" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to register this device.");
      setPushEnabled(true);
      setPushPromptOpen(false);
      setNotice("Notifications enabled on this device.");
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Unable to enable notifications.");
    } finally {
      setPushSaving(false);
    }
  }

  return (
    <>
      <main className="cook-home-page">
        <header className="cook-home-header"><div className="cook-home-brand"><div className="cook-home-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div><button className="cook-notification" aria-label="Notifications" aria-expanded={pushPromptOpen} onClick={() => setPushPromptOpen((open) => !open)}><Bell />{!pushEnabled && <i />}</button></header>

        {pushPromptOpen && <section className="cook-push-opt-in" aria-label="Push notifications"><div><strong>{pushEnabled ? "Notifications enabled" : "Stay updated"}</strong><p>{pushEnabled ? "This device is registered for cook notifications." : "Get alerts for new booking requests on this device."}</p></div>{!pushEnabled && <button type="button" disabled={!cookProfileId || pushSaving} onClick={() => void enableNotifications()}>{pushSaving ? "Enabling..." : "Enable notifications"}</button>}{pushError && <p role="alert">{pushError}</p>}</section>}

        <section className="cook-welcome"><div><h1>Hello, Lakshmi!</h1><p>Here&apos;s your cooking journey at a glance.</p></div><span className={`approval-pill ${cookStatus ?? "unavailable"}`} role="status"><ShieldCheck /> {statusLoading ? "Checking..." : cookStatus ? cookStatus.charAt(0).toUpperCase() + cookStatus.slice(1) : "Unavailable"}<small>{statusLoading ? "Loading profile status" : cookStatus === "approved" ? "Your profile is verified" : cookStatus === "pending" ? "Awaiting admin review" : cookStatus === "rejected" ? "Review your application" : statusError}</small></span></section>

        <section className={`cook-availability ${isOnline ? "online" : "offline"}`} aria-label="Cook availability">
          <div className="cook-availability-copy"><span className="cook-availability-dot" /><div><strong>{isOnline ? "You're online" : "You're offline"}</strong><small>{isOnline ? "You can receive new booking requests." : "Go online to receive new booking requests."}</small></div></div>
          <button className="cook-online-button" disabled={!cookProfileId || availabilitySaving} onClick={() => void changeAvailability(!isOnline)}>{availabilitySaving ? "Saving..." : isOnline ? "Go offline" : "Be online"}</button>
          <label className="cook-availability-toggle"><span className="sr-only">{isOnline ? "Go offline" : "Be online"}</span><input type="checkbox" checked={isOnline} disabled={!cookProfileId || availabilitySaving} onChange={(event) => void changeAvailability(event.target.checked)} /><span className="cook-toggle-track" aria-hidden="true"><i /></span></label>
        </section>

        <section className="earnings-card"><div className="earnings-heading"><span>Total Earnings</span><button>This Month <ChevronRight /></button></div><strong>₹8,460</strong><div className="earnings-stats"><span><b>12</b>Completed Bookings</span><span><b>₹705</b>Avg. per Booking</span><span><b>₹2,340</b>Pending Payout</span></div></section>

        <div className="cook-stat-grid"><StatCard icon={CalendarDays} tone="green" label="Upcoming Bookings" value="3" onClick={() => setActiveTab("Bookings")} /><StatCard icon={Clock3} tone="blue" label="Past Bookings" value="18" onClick={() => setActiveTab("Bookings")} /></div>

        <section className="cook-section"><div className="cook-section-title"><h2>Upcoming Bookings</h2><button>View all <ChevronRight /></button></div><div className="cook-booking-list">{bookings.map((booking) => <CookBookingCard key={booking.id} booking={booking} onRespond={respondToBooking} />)}</div></section>

        <section className="cook-section recent-section"><div className="cook-section-title"><h2>Recent Earnings</h2><button>View all <ChevronRight /></button></div><div className="recent-earning"><span>12 Nov 2024</span><span>Lunch (4 people)</span><strong>₹320</strong><small>Completed</small></div></section>
        {notice && <p className="cook-notice" role="status">{notice}</p>}

      </main>

      <BottomNav
        items={[{ label: "Home", icon: House }, { label: "Bookings", icon: CalendarDays }, { label: "Earnings", icon: Wallet }, { label: "Profile", icon: UserRound }]}
        activeLabel={activeTab}
        onSelect={(label) => {
          setActiveTab(label);
          if (label === "Profile") router.push("/cook-profile");
        }}
      />
    </>
  );
}

function StatCard({ icon: Icon, tone, label, value, onClick }: { icon: typeof CalendarDays; tone: "green" | "blue"; label: string; value: string; onClick: () => void }) {
  return <button className={`cook-stat-card ${tone}`} onClick={onClick}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div><ChevronRight /></button>;
}

function CookBookingCard({ booking, onRespond }: { booking: CookBooking; onRespond: (id: number, response: BookingStatus) => void }) {
  return <article className="cook-booking-card"><div className="cook-date-box"><strong>{booking.day}</strong><span>{booking.month}</span></div><div className="cook-booking-main"><div className="cook-booking-title"><strong>{booking.meal}</strong><span className={booking.status.toLowerCase()}>{booking.status}</span></div><span><Clock3 />{booking.time}</span><span><MapPin />{booking.location}</span><span><UsersRound />{booking.people}</span></div><ChevronRight className="cook-card-arrow" />{booking.status === "Pending" ? <div className="cook-booking-actions"><button className="cook-reject" onClick={() => onRespond(booking.id, "Pending")}><X /> Reject</button><button className="cook-accept" onClick={() => onRespond(booking.id, "Confirmed")}><Check /> Accept</button></div> : null}</article>;
}
