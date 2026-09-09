"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    CalendarDays,
    Clock3,
    House,
    MapPin,
    Settings,
    UsersRound,
} from "lucide-react";

type BookingStatus = "upcoming" | "completed";

type Booking = {
    id: number;
    meal: string;
    dishes: string;
    date: string;
    time: string;
    people: string;
    location: string;
    price: string;
    status: BookingStatus;
};

const bookings: Booking[] = [
    { id: 1, meal: "Breakfast", dishes: "Idli, Sambar, Coconut Chutney", date: "Sat, 16 Nov 2024", time: "8:00 AM – 9:00 AM", people: "4 people", location: "HSR Layout, Bengaluru", price: "₹200", status: "upcoming" },
    { id: 2, meal: "Lunch", dishes: "Dal, Vegetable Curry, Chapati, Salad", date: "Sun, 17 Nov 2024", time: "12:30 PM – 1:30 PM", people: "4 people", location: "Koramangala, Bengaluru", price: "₹320", status: "upcoming" },
    { id: 3, meal: "Dinner", dishes: "Paneer Curry, Jeera Rice, Raita", date: "Thu, 14 Nov 2024", time: "7:30 PM – 8:30 PM", people: "3 people", location: "Indiranagar, Bengaluru", price: "₹280", status: "completed" },
    { id: 4, meal: "Breakfast", dishes: "Dosa, Chutney, Filter Coffee", date: "Wed, 13 Nov 2024", time: "8:30 AM – 9:30 AM", people: "2 people", location: "Whitefield, Bengaluru", price: "₹180", status: "completed" },
];

export default function BookingsPage() {
    const router = useRouter();
    const [tab, setTab] = useState<BookingStatus>("upcoming");
    const [cancelled, setCancelled] = useState<number[]>([]);
    const [activeNav, setActiveNav] = useState("My Bookings");

    const visibleBookings = bookings.filter((booking) => booking.status === tab && !cancelled.includes(booking.id));

    return (
        <main className="bookings-page">
            <header className="bookings-header">
                <div className="bookings-brand"><div className="bookings-brand-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div>
            </header>

            <section className="bookings-intro"><h1>Booking History</h1><p>View and manage all your meal bookings</p></section>

            <div className="booking-tabs" role="tablist" aria-label="Booking status"><button role="tab" aria-selected={tab === "upcoming"} className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming (2)</button><button role="tab" aria-selected={tab === "completed"} className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed (5)</button></div>

            <section className="booking-history-list" aria-live="polite">
                {visibleBookings.length === 0 ? <div className="empty-bookings"><CalendarDays /><strong>No {tab} bookings</strong><span>Your meal bookings will appear here.</span></div> : visibleBookings.map((booking) => <BookingCard key={booking.id} booking={booking} onCancel={() => setCancelled((current) => [...current, booking.id])} />)}
            </section>

            <nav className="bottom-nav" aria-label="Main navigation">
                {[{ label: "Home", icon: House }, { label: "My Bookings", icon: CalendarDays }, { label: "Settings", icon: Settings }].map((item) => { const NavIcon = item.icon; return <button key={item.label} className={activeNav === item.label ? "nav-item active" : "nav-item"} onClick={() => { setActiveNav(item.label); if (item.label === "Home") router.push("/"); }}><NavIcon aria-hidden="true" /><small>{item.label}</small></button>; })}
            </nav>
        </main>
    );
}

function BookingCard({ booking, onCancel }: { booking: Booking; onCancel: () => void }) {
    const [cancelConfirm, setCancelConfirm] = useState(false);

    return <article className="history-card"><div className="history-card-top"><div className="meal-icon"><CalendarDays /></div><div className="meal-heading-copy"><h2>{booking.meal}</h2><p>{booking.dishes}</p></div><div className="history-price"><span className="history-status">{booking.status === "upcoming" ? "Upcoming" : "Completed"}</span><strong>{booking.price}</strong><small>(Total)</small></div></div><div className="history-details"><span><CalendarDays />{booking.date}</span><span><Clock3 />{booking.time}</span><span><UsersRound />{booking.people}</span><span><MapPin />{booking.location}</span></div>{booking.status === "upcoming" && <div className="history-actions"><button className="modify-button">Modify</button>{cancelConfirm ? <><button className="cancel-button" onClick={onCancel}>Confirm Cancel</button><button className="keep-button" onClick={() => setCancelConfirm(false)}>Keep</button></> : <button className="cancel-button" onClick={() => setCancelConfirm(true)}>Cancel</button>}</div>}</article>;
}
