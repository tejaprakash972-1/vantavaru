"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IngredientsPanel } from "../../components/IngredientsPanel";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ChefHat,
    Clock3,
    Edit3,
    FileText,
    Info,
    List,
    ShieldCheck,
    UsersRound,
} from "lucide-react";

type MealKey = "Breakfast" | "Lunch" | "Dinner";
type DishSelections = Record<MealKey, string[]>;

const defaultDishes: DishSelections = {
    Breakfast: ["Idli", "Dosa"],
    Lunch: ["Dal"],
    Dinner: ["Chapati"],
};

export default function ReviewBookingPage() {
    return <Suspense fallback={<div className="review-loading">Loading review...</div>}><ReviewBookingContent /></Suspense>;
}

function ReviewBookingContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [confirmed, setConfirmed] = useState(false);
    const [ingredientsOpen, setIngredientsOpen] = useState(false);

    const date = searchParams.get("date") || "2026-09-16";
    const time = searchParams.get("time") || "10:00";
    const duration = searchParams.get("duration") || "1 Hour";
    const people = Number(searchParams.get("people") || 4);
    const meals = (searchParams.get("meals") || "Breakfast,Lunch,Dinner").split(",").filter(Boolean) as MealKey[];
    const notes = searchParams.get("notes") || "";
    const price = Number(searchParams.get("price") || 650);
    const selectedDishes = useMemo(() => {
        try {
            return { ...defaultDishes, ...JSON.parse(searchParams.get("dishes") || "{}") } as DishSelections;
        } catch {
            return defaultDishes;
        }
    }, [searchParams]);

    const formattedDate = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
    const formattedTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${time}`));
    const endTime = addHours(time, duration === "2 Hours" ? 2 : 1);

    return (
        <div className="review-background">
            <main className="review-page">
                <header className="review-header">
                    <button className="review-back" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>
                    <div className="review-brand"><div className="review-brand-mark"><ChefHat /><span>♥</span></div><strong>Vantavaru</strong></div>
                    <button className="edit-button" onClick={() => router.back()}><Edit3 /> Edit</button>
                </header>

                <section className="review-intro"><h1>Review Booking</h1><p>Please review your details before confirming.</p></section>

                <div className="review-details">
                    <ReviewCard icon={CalendarDays} label="Date"><strong>{formattedDate}</strong></ReviewCard>
                    <ReviewCard icon={Clock3} label="Time & Duration"><strong>{formattedTime} – {endTime} ({duration})</strong></ReviewCard>
                    <ReviewCard icon={UsersRound} label="Number of People"><strong>{people} {people === 1 ? "person" : "people"}</strong></ReviewCard>
                    <ReviewCard icon={ChefHat} label="Meal Time(s)"><div className="meal-pills">{meals.map((meal) => <span key={meal}>{meal}</span>)}</div></ReviewCard>
                    <ReviewCard icon={List} label="Selected Dishes"><div className="selected-dishes">{meals.map((meal) => <div key={meal}><strong>{meal}</strong><span>{selectedDishes[meal]?.join(", ") || "No dishes selected"}</span></div>)}</div></ReviewCard>
                    <ReviewCard icon={FileText} label="Additional Notes"><span>{notes || "No additional notes"}</span></ReviewCard>
                </div>

                <button className="review-ingredients-button" onClick={() => setIngredientsOpen(true)}><span><ChefHat /></span><div><strong>View Ingredients</strong><small>See ingredients for each dish and total required</small></div><ArrowRight /></button>

                <section className="price-breakdown"><div className="total-price"><span>Estimated Price</span><strong>₹{price}</strong><Info /></div><div className="price-lines"><div><span>Base Fee ({duration})</span><b>₹{duration === "2 Hours" ? 600 : 400}</b></div><div><span>Extra People ({Math.max(0, people - 2)} × ₹50)</span><b>₹{Math.max(0, people - 2) * 50}</b></div><div><span>Meals ({meals.length} × ₹50)</span><b>₹{meals.length * 50}</b></div><hr /><div className="price-total-line"><strong>Total (Estimated)</strong><strong>₹{price}</strong></div></div></section>

                <aside className="confirmation-note"><span><ShieldCheck /></span><div><strong>You’ll be charged after the cook is confirmed.</strong><p>You can cancel anytime before confirmation.</p></div></aside>
                <button className="confirm-button" onClick={() => setConfirmed(true)}>{confirmed ? <><Check /> Booking Confirmed</> : "Confirm Booking"}</button>
                {confirmed && <p className="confirmation-status" role="status">Your booking request has been sent.</p>}
            </main>
            <IngredientsPanel people={people} selectedMeals={meals} selectedDishes={selectedDishes} open={ingredientsOpen} onClose={() => setIngredientsOpen(false)} />
        </div>
    );
}

function ReviewCard({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: ReactNode }) {
    return <article className="review-card"><div className="review-card-icon"><Icon /></div><div className="review-card-content"><span>{label}</span>{children}</div></article>;
}

function addHours(time: string, hours: number) {
    const [hour, minute] = time.split(":").map(Number);
    const date = new Date(2026, 0, 1, hour, minute);
    date.setHours(date.getHours() + hours);
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}
