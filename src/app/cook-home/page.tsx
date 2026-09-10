"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
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
  const [bookings, setBookings] = useState(upcomingBookings);
  const [activeTab, setActiveTab] = useState("Home");
  const [notice, setNotice] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <>
      <main className="cook-home-page">
      <header className="cook-home-header"><div className="cook-home-brand"><div className="cook-home-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div><button className="cook-notification" aria-label="Notifications"><Bell /><i /></button></header>

      <section className="cook-welcome"><div><h1>Hello, Lakshmi!</h1><p>Here&apos;s your cooking journey at a glance.</p></div><span className="approval-pill"><ShieldCheck /> Approved<small>Your profile is verified</small></span></section>

      <section className={`cook-availability ${isOnline ? "online" : "offline"}`} aria-label="Cook availability">
        <div className="cook-availability-copy"><span className="cook-availability-dot" /><div><strong>{isOnline ? "You're online" : "You're offline"}</strong><small>{isOnline ? "You can receive new booking requests." : "Go online to receive new booking requests."}</small></div></div>
        <button className="cook-online-button" onClick={() => setIsOnline((current) => !current)}>{isOnline ? "Go offline" : "Be online"}</button>
        <label className="cook-availability-toggle"><span className="sr-only">{isOnline ? "Go offline" : "Be online"}</span><input type="checkbox" checked={isOnline} onChange={(event) => setIsOnline(event.target.checked)} /><span className="cook-toggle-track" aria-hidden="true"><i /></span></label>
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
