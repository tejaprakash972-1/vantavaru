"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IngredientsPanel } from "../../components/IngredientsPanel";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    Clock3,
    FileText,
    Moon,
    ShoppingBasket,
    Sun,
    Sunrise,
    UsersRound,
} from "lucide-react";

type MealKey = "Breakfast" | "Lunch" | "Dinner";

const dishes: Record<MealKey, string[]> = {
    Breakfast: ["Idli", "Dosa", "Upma", "Poha", "Puri", "Paratha", "Pongal", "Other"],
    Lunch: ["Dal", "Paneer Curry", "Veg Biryani", "Curd Rice", "Sambar", "Rasam", "Chapati", "Other"],
    Dinner: ["Chapati", "Veg Curry", "Chicken Curry", "Egg Curry", "Tomato Rice", "Lemon Rice", "Sambar", "Other"],
};

const mealIcons: Record<MealKey, typeof Sunrise> = {
    Breakfast: Sunrise,
    Lunch: Sun,
    Dinner: Moon,
};

export default function BookPage() {
    return <Suspense fallback={<div className="booking-loading">Loading booking options...</div>}><BookPageContent /></Suspense>;
}

function BookPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialDuration = searchParams.get("duration") === "2 Hours" ? "2 Hours" : "1 Hour";
    const [duration, setDuration] = useState(initialDuration);
    const [bookingDate, setBookingDate] = useState("2026-09-16");
    const [bookingTime, setBookingTime] = useState("10:00");
    const [people, setPeople] = useState(4);
    const [selectedMeals, setSelectedMeals] = useState<MealKey[]>(["Breakfast", "Lunch", "Dinner"]);
    const [selectedDishes, setSelectedDishes] = useState<Record<MealKey, string[]>>({
        Breakfast: ["Idli", "Dosa"],
        Lunch: ["Dal"],
        Dinner: ["Chapati"],
    });
    const [expandedMeals, setExpandedMeals] = useState<MealKey[]>(["Breakfast", "Lunch", "Dinner"]);
    const [notes, setNotes] = useState("");
    const [ingredientsOpen, setIngredientsOpen] = useState(false);

    const price = useMemo(() => {
        const mealCount = selectedMeals.length;
        return 400 + (duration === "2 Hours" ? 250 : 0) + Math.max(0, people - 2) * 50 + mealCount * 50;
    }, [duration, people, selectedMeals.length]);

    function toggleMeal(meal: MealKey) {
        setSelectedMeals((current) => current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal]);
    }

    function toggleDish(meal: MealKey, dish: string) {
        setSelectedDishes((current) => ({
            ...current,
            [meal]: current[meal].includes(dish) ? current[meal].filter((item) => item !== dish) : [...current[meal], dish],
        }));
    }

    function toggleExpanded(meal: MealKey) {
        setExpandedMeals((current) => current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal]);
    }

    function continueToReview() {
        const params = new URLSearchParams({
            date: bookingDate,
            time: bookingTime,
            duration,
            people: String(people),
            meals: selectedMeals.join(","),
            dishes: JSON.stringify(selectedDishes),
            notes,
            price: String(price),
        });
        router.push(`/reviewBooking?${params.toString()}`);
    }

    return (
        <div className="booking-background">
            <main className="booking-page">
                <header className="booking-header">
                    <button className="back-button" onClick={() => window.history.back()} aria-label="Go back"><ArrowLeft /></button>
                    <h1>Book a Cook</h1>
                    <span className="header-spacer" aria-hidden="true" />
                </header>

                <div className="booking-form">
                    <section className="form-step">
                        <StepNumber number={1} />
                        <div className="form-content"><h2>Select date &amp; time</h2><div className="datetime-fields"><label className="field-button input-field"><CalendarDays /><input aria-label="Select date" type="date" value={bookingDate} min="2026-09-09" onChange={(event) => setBookingDate(event.target.value)} /></label><label className="field-button input-field"><Clock3 /><input aria-label="Select time" type="time" value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} /></label></div></div>
                    </section>

                    <section className="form-step">
                        <StepNumber number={2} />
                        <div className="form-content"><h2>Select duration</h2><div className="duration-options">{["1 Hour", "2 Hours"].map((item) => <button key={item} className={`choice-button ${duration === item ? "choice-selected" : ""}`} onClick={() => setDuration(item)}><Clock3 /><span>{item}</span></button>)}</div></div>
                    </section>

                    <section className="form-step">
                        <StepNumber number={3} />
                        <div className="form-content"><h2>Number of people</h2><label className="field-button select-field"><UsersRound /><select aria-label="Number of people" value={people} onChange={(event) => setPeople(Number(event.target.value))}>{Array.from({ length: 15 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "person" : "people"}</option>)}</select><ChevronDown aria-hidden="true" /></label></div>
                    </section>

                    <section className="form-step">
                        <StepNumber number={4} />
                        <div className="form-content"><div className="step-heading-row"><h2>Select meal time(s)</h2><span>You can select multiple</span></div><div className="meal-options">{(Object.keys(mealIcons) as MealKey[]).map((meal) => { const MealIcon = mealIcons[meal]; return <button key={meal} className={`meal-button ${selectedMeals.includes(meal) ? "meal-selected" : ""}`} onClick={() => toggleMeal(meal)}><MealIcon /><span>{meal}</span>{selectedMeals.includes(meal) && <span className="check-mark">✓</span>}</button>; })}</div></div>
                    </section>

                    <section className="form-step dishes-step">
                        <StepNumber number={5} />
                        <div className="form-content"><h2>Select dishes</h2><p className="form-hint">Choose dishes for each selected meal time</p>{selectedMeals.length === 0 && <p className="empty-meals">Select at least one meal time above.</p>}{selectedMeals.map((meal) => { const MealIcon = mealIcons[meal]; const isExpanded = expandedMeals.includes(meal); return <div className="dish-group" key={meal}><button className="dish-group-header" onClick={() => toggleExpanded(meal)}><span className="dish-title"><MealIcon /><strong>{meal}</strong></span><span className="dish-count">{selectedDishes[meal].length} selected</span>{isExpanded ? <ChevronUp /> : <ChevronDown />}</button>{isExpanded && <div className="dish-grid">{dishes[meal].map((dish) => <button key={dish} className={`dish-choice ${selectedDishes[meal].includes(dish) ? "dish-selected" : ""}`} onClick={() => toggleDish(meal, dish)}><span className="checkbox">{selectedDishes[meal].includes(dish) ? "✓" : ""}</span>{dish}</button>)}</div>}</div>; })}</div>
                    </section>

                    <section className="form-step notes-step">
                        <StepNumber number={6} />
                        <div className="form-content"><h2>Additional notes <small>(optional)</small></h2><label className="notes-field"><FileText /><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any special requests, dietary preferences, or other notes..." rows={1} /></label></div>
                    </section>

                    <button className="view-ingredients-button" onClick={() => setIngredientsOpen(true)}><span><ShoppingBasket /></span><div><strong>View Ingredients</strong><small>See ingredients for your selected dishes</small></div><ArrowRight /></button>
                </div>

                <footer className="review-bar"><div className="price-display"><span>Estimated Price</span><strong>₹{price}</strong><i>i</i></div><button className="review-button" onClick={continueToReview}>Continue to Review <ArrowRight /></button></footer>
            </main>
            <IngredientsPanel people={people} selectedMeals={selectedMeals} selectedDishes={selectedDishes} open={ingredientsOpen} onClose={() => setIngredientsOpen(false)} />
        </div>
    );
}

function StepNumber({ number }: { number: number }) {
    return <span className="step-number" aria-hidden="true">{number}</span>;
}
