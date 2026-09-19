"use client";

import { startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IngredientsPanel } from "../../components/IngredientsPanel";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    ChevronDown,
    Clock3,
    FileText,
    ShoppingBasket,
    UsersRound,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MealType = { id: string; name: string; sortOrder: number };
type Dish = { id: string; name: string; mealTypeId: string; preparationCostPerPerson: number };
type SelectedDishes = Record<string, string[]>;
type BookingFees = { cookFee: number; platformFee: number };
type BookingDraft = { duration: string; bookingDate: string; bookingTime: string; people: number; selectedMeals: string[]; selectedDishes: SelectedDishes; notes: string };

const bookingDraftStorageKey = "vantavaru-booking-draft";

export default function BookPage() {
    return <Suspense fallback={<div className="booking-loading">Loading booking options...</div>}><BookPageContent /></Suspense>;
}

function BookPageContent() {
    const supabase = getSupabaseBrowserClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialDuration = searchParams.get("duration") === "2 Hours" ? "2 Hours" : "1 Hour";
    const [duration, setDuration] = useState(initialDuration);
    const [bookingDate, setBookingDate] = useState("2026-09-16");
    const [bookingTime, setBookingTime] = useState("10:00");
    const [people, setPeople] = useState(4);
    const [mealTypes, setMealTypes] = useState<MealType[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [bookingFees, setBookingFees] = useState<BookingFees>({ cookFee: 0, platformFee: 0 });
    const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
    const [selectedDishes, setSelectedDishes] = useState<SelectedDishes>({});
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [mealDataLoading, setMealDataLoading] = useState(true);
    const [mealDataError, setMealDataError] = useState("");
    const [notes, setNotes] = useState("");
    const [ingredientsOpen, setIngredientsOpen] = useState(false);
    const skipInitialPersist = useRef(true);

    useEffect(() => {
        const storedDraft = window.sessionStorage.getItem(bookingDraftStorageKey);
        if (!storedDraft) {
            return;
        }

        try {
            const draft = JSON.parse(storedDraft) as Partial<BookingDraft>;
            startTransition(() => {
                if (draft.duration === "1 Hour" || draft.duration === "2 Hours") setDuration(draft.duration);
                if (typeof draft.bookingDate === "string") setBookingDate(draft.bookingDate);
                if (typeof draft.bookingTime === "string") setBookingTime(draft.bookingTime);
                if (typeof draft.people === "number") setPeople(draft.people);
                if (Array.isArray(draft.selectedMeals)) setSelectedMeals(draft.selectedMeals);
                if (draft.selectedDishes && typeof draft.selectedDishes === "object") setSelectedDishes(draft.selectedDishes);
                if (typeof draft.notes === "string") setNotes(draft.notes);
            });
        } catch {
            window.sessionStorage.removeItem(bookingDraftStorageKey);
        }
    }, []);

    useEffect(() => {
        if (skipInitialPersist.current) {
            skipInitialPersist.current = false;
            return;
        }
        const draft: BookingDraft = { duration, bookingDate, bookingTime, people, selectedMeals, selectedDishes, notes };
        window.sessionStorage.setItem(bookingDraftStorageKey, JSON.stringify(draft));
    }, [bookingDate, bookingTime, duration, notes, people, selectedDishes, selectedMeals]);

    const price = useMemo(() => {
        const selectedDishCount = Object.values(selectedDishes).reduce((count, selected) => count + selected.length, 0);
        if (selectedDishCount === 0) return 0;

        const preparationCostPerPerson = Object.entries(selectedDishes).reduce((total, [mealId, selectedDishNames]) => total + selectedDishNames.reduce((mealTotal, dishName) => {
            const dish = dishes.find((item) => item.mealTypeId === mealId && item.name === dishName);
            return mealTotal + (dish?.preparationCostPerPerson ?? 0);
        }, 0), 0);
        return preparationCostPerPerson * people + bookingFees.cookFee + bookingFees.platformFee;
    }, [bookingFees, dishes, people, selectedDishes]);
    const mealNames = useMemo(() => Object.fromEntries(mealTypes.map((meal) => [meal.id, meal.name])), [mealTypes]);

    useEffect(() => {
        let cancelled = false;

        async function loadMealData() {
            if (!supabase) {
                setMealDataError("Meal options are unavailable because Supabase is not configured.");
                setMealDataLoading(false);
                return;
            }

            const [mealTypeResult, dishResult, settingsResult] = await Promise.all([
                supabase.from("meal_types").select("id, name, sort_order").order("sort_order", { ascending: true }),
                supabase.from("dishes").select("id, name, meal_type_id, preparation_cost_per_person").eq("is_active", true).order("sort_order", { ascending: true }),
                supabase.from("app_settings").select("key, value").in("key", ["cook_fee", "platform_fee"]),
            ]);
            const firstError = mealTypeResult.error || dishResult.error || settingsResult.error;
            if (firstError) {
                if (!cancelled) {
                    setMealDataError(firstError.message);
                    setMealDataLoading(false);
                }
                return;
            }

            if (!cancelled) {
                setMealTypes((mealTypeResult.data ?? []).map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order ?? 0 })));
                setDishes((dishResult.data ?? []).map((row) => ({ id: row.id, name: row.name, mealTypeId: row.meal_type_id, preparationCostPerPerson: Number(row.preparation_cost_per_person ?? 0) })));
                const settings = new Map((settingsResult.data ?? []).map((row) => [row.key, Number(row.value ?? 0)]));
                setBookingFees({ cookFee: settings.get("cook_fee") ?? 0, platformFee: settings.get("platform_fee") ?? 0 });
                setMealDataLoading(false);
            }
        }

        void loadMealData();
        return () => { cancelled = true; };
    }, [supabase]);

    function toggleMeal(meal: string) {
        const isSelected = selectedMeals.includes(meal);
        setSelectedMeals((current) => isSelected ? current.filter((item) => item !== meal) : [...current, meal]);
        if (isSelected) {
            setSelectedDishes((current) => {
                const next = { ...current };
                delete next[meal];
                return next;
            });
        }
    }

    function toggleDish(meal: string, dish: string) {
        setSelectedDishes((current) => {
            const selected = current[meal] ?? [];
            const nextSelected = selected.includes(dish) ? selected.filter((item) => item !== dish) : [...selected, dish];
            const next = { ...current };
            if (nextSelected.length === 0) delete next[meal];
            else next[meal] = nextSelected;
            return next;
        });
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
                <div className="booking-scroll-content">
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
                            <div className="form-content"><div className="step-heading-row"><h2>Select meal time(s)</h2><span>You can select multiple</span></div>{mealDataError && <p className="form-error" role="alert">{mealDataError}</p>}{mealDataLoading ? <p className="form-hint">Loading meal times...</p> : <MultiSelectDropdown id="meal-times" label="Choose meal times" options={mealTypes.map((meal) => ({ id: meal.id, label: meal.name }))} selected={selectedMeals} open={openDropdown === "meal-times"} onToggle={() => setOpenDropdown((current) => current === "meal-times" ? null : "meal-times")} onSelect={toggleMeal} />}</div>
                        </section>

                        <section className="form-step dishes-step">
                            <StepNumber number={5} />
                            <div className="form-content"><h2>Select dishes</h2><p className="form-hint">Choose dishes for each selected meal time</p>{selectedMeals.length === 0 && <p className="empty-meals">Select at least one meal time above.</p>}{selectedMeals.map((mealId) => { const meal = mealTypes.find((item) => item.id === mealId); if (!meal) return null; const mealDishes = dishes.filter((dish) => dish.mealTypeId === meal.id); const selectedForMeal = selectedDishes[meal.id] ?? []; return <div className="dish-meal-select" key={meal.id}><strong className="dish-meal-label">{meal.name}</strong><MultiSelectDropdown id={`dishes-${meal.id}`} label={`Choose ${meal.name} dishes`} options={mealDishes.map((dish) => ({ id: dish.name, label: dish.name }))} selected={selectedForMeal} open={openDropdown === `dishes-${meal.id}`} onToggle={() => setOpenDropdown((current) => current === `dishes-${meal.id}` ? null : `dishes-${meal.id}`)} onSelect={(dishName) => toggleDish(meal.id, dishName)} /></div>; })}</div>
                        </section>

                        <section className="form-step notes-step">
                            <StepNumber number={6} />
                            <div className="form-content"><h2>Additional notes <small>(optional)</small></h2><label className="notes-field"><FileText /><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any special requests, dietary preferences, or other notes..." rows={1} /></label></div>
                        </section>

                        <button className="view-ingredients-button" onClick={() => setIngredientsOpen(true)}><span><ShoppingBasket /></span><div><strong>View Ingredients</strong><small>See ingredients for your selected dishes</small></div><ArrowRight /></button>
                    </div>
                </div>

                <footer className="review-bar"><div className="price-display"><span>Estimated Price</span><strong>₹{price}</strong><i>i</i></div><button className="review-button" onClick={continueToReview}>Continue to Review <ArrowRight /></button></footer>
            </main>
            <IngredientsPanel people={people} selectedMeals={selectedMeals} mealNames={mealNames} selectedDishes={selectedDishes} open={ingredientsOpen} onClose={() => setIngredientsOpen(false)} />
        </div>
    );
}

function StepNumber({ number }: { number: number }) {
    return <span className="step-number" aria-hidden="true">{number}</span>;
}

function MultiSelectDropdown({ id, label, options, selected, open, onToggle, onSelect }: { id: string; label: string; options: { id: string; label: string }[]; selected: string[]; open: boolean; onToggle: () => void; onSelect: (id: string) => void }) {
    const selectedLabels = options.filter((option) => selected.includes(option.id)).map((option) => option.label);
    const summary = selectedLabels.length === 0 ? label : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;
    return <div className={`multi-select ${open ? "multi-select-open" : ""}`} id={id}><button className="multi-select-trigger" type="button" onClick={onToggle} aria-expanded={open}><span>{summary}</span><ChevronDown /></button>{open && <div className="multi-select-menu" role="listbox" aria-multiselectable="true">{options.length === 0 ? <p className="multi-select-empty">No options available</p> : options.map((option) => <button key={option.id} className={`multi-select-option ${selected.includes(option.id) ? "selected" : ""}`} type="button" role="option" aria-selected={selected.includes(option.id)} onClick={() => onSelect(option.id)}><span className="multi-select-checkbox">{selected.includes(option.id) ? "✓" : ""}</span><span>{option.label}</span></button>)}</div>}</div>;
}
