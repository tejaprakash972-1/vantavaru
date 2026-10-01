"use client";

import { startTransition, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IngredientsPanel } from "../../components/IngredientsPanel";
import RequestLoader from "@/components/RequestLoader";
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
type BookingDraft = { bookingId?: string | null; addressId?: string; duration: string; bookingDate: string; bookingTime: string; people: number; selectedMeals: string[]; selectedDishes: SelectedDishes; notes: string };

const bookingDraftStorageKey = "vantavaru-review-return-draft";

export default function BookPage() {
    return <Suspense fallback={<div className="booking-loading">Loading booking options...</div>}><BookPageContent /></Suspense>;
}

function BookPageContent() {
    const supabase = getSupabaseBrowserClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const bookingId = searchParams.get("bookingId");
    const [addressId, setAddressId] = useState(searchParams.get("addressId") ?? "");
    const requestedDuration = searchParams.get("duration");
    const hasRequestedDuration = requestedDuration === "1 Hour" || requestedDuration === "2 Hours";
    const initialDuration = hasRequestedDuration ? requestedDuration : "1 Hour";
    const [initialDateTime] = useState(getNextBookingDateTime);
    const [duration, setDuration] = useState(initialDuration);
    const [bookingDate, setBookingDate] = useState(initialDateTime.date);
    const [bookingTime, setBookingTime] = useState(initialDateTime.time);
    const [people, setPeople] = useState(1);
    const [mealTypes, setMealTypes] = useState<MealType[]>([]);
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [bookingFees, setBookingFees] = useState<BookingFees>({ cookFee: 0, platformFee: 0 });
    const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
    const [selectedDishes, setSelectedDishes] = useState<SelectedDishes>({});
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [mealDataLoading, setMealDataLoading] = useState(true);
    const [editLoading, setEditLoading] = useState(Boolean(bookingId));
    const [editError, setEditError] = useState("");
    const [mealDataError, setMealDataError] = useState("");
    const [dateTimeError, setDateTimeError] = useState("");
    const [dateTimeNotice, setDateTimeNotice] = useState("");
    const [notes, setNotes] = useState("");
    const [ingredientsOpen, setIngredientsOpen] = useState(false);
    useEffect(() => {
        if (!supabase || bookingId || addressId) return;
        let cancelled = false;
        async function loadDefaultAddress() {
            const { data: { user } } = await supabase!.auth.getUser();
            if (!user) return;
            const { data: addresses } = await supabase!.from("customer_addresses")
                .select("id")
                .eq("user_id", user.id)
                .eq("is_active", true)
                .order("is_default", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1);
            if (!cancelled && addresses?.[0]) setAddressId(addresses[0].id);
        }
        void loadDefaultAddress();
        return () => { cancelled = true; };
    }, [supabase, bookingId, addressId]);

    useEffect(() => {
        const storedDraft = window.sessionStorage.getItem(bookingDraftStorageKey);
        if (!storedDraft) {
            return;
        }

        if (bookingId) return;
        window.sessionStorage.removeItem(bookingDraftStorageKey);
        try {
            const draft = JSON.parse(storedDraft) as Partial<BookingDraft>;
            if (draft.bookingId) return;
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
        if (!bookingId) {
            setEditLoading(false);
            return;
        }
        if (!supabase) {
            setEditError("Booking editing is unavailable because Supabase is not configured.");
            setEditLoading(false);
            return;
        }

        const client = supabase;
        let cancelled = false;
        async function loadBookingForEdit() {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) {
                if (!cancelled) {
                    setEditError("Please log in again to edit this booking.");
                    setEditLoading(false);
                }
                return;
            }

            const { data: booking, error: bookingError } = await client
                .from("bookings")
                .select("id, customer_id, customer_address_id, booking_date, booking_time, duration_minutes, people_count, status, cook_profile_id, customer_notes")
                .eq("id", bookingId)
                .eq("customer_id", user.id)
                .maybeSingle();

            if (bookingError || !booking) {
                if (!cancelled) {
                    setEditError(bookingError?.message || "This booking could not be found.");
                    setEditLoading(false);
                }
                return;
            }

            if (booking.status !== "searching_cook" || booking.cook_profile_id) {
                if (!cancelled) {
                    setEditError("This booking can no longer be edited because a cook has been assigned or the service has started.");
                    setEditLoading(false);
                }
                return;
            }

            setAddressId(booking.customer_address_id ?? "");

            const storedDraft = window.sessionStorage.getItem(bookingDraftStorageKey);
            if (storedDraft) {
                window.sessionStorage.removeItem(bookingDraftStorageKey);
                try {
                    const draft = JSON.parse(storedDraft) as Partial<BookingDraft>;
                    if (draft.bookingId === bookingId) {
                        const normalizedDateTime = normalizeBookingDateTime(draft.bookingDate ?? booking.booking_date, draft.bookingTime ?? booking.booking_time.slice(0, 5));
                        if (draft.duration === "1 Hour" || draft.duration === "2 Hours") setDuration(draft.duration);
                        setBookingDate(normalizedDateTime.date);
                        setBookingTime(normalizedDateTime.time);
                        if (normalizedDateTime.adjusted) setDateTimeNotice("The saved date or time has passed or is outside booking hours. It was moved to the next available slot; please review it.");
                        if (typeof draft.people === "number") setPeople(draft.people);
                        if (Array.isArray(draft.selectedMeals)) setSelectedMeals(draft.selectedMeals);
                        if (draft.selectedDishes && typeof draft.selectedDishes === "object") setSelectedDishes(draft.selectedDishes);
                        if (typeof draft.notes === "string") setNotes(draft.notes);
                        if (!cancelled) setEditLoading(false);
                        return;
                    }
                } catch {
                    window.sessionStorage.removeItem(bookingDraftStorageKey);
                }
            }

            const [mealLinks, dishLinks] = await Promise.all([
                client.from("booking_meals").select("meal_type_id").eq("booking_id", bookingId),
                client.from("booking_dishes").select("meal_type_id, dish_id").eq("booking_id", bookingId),
            ]);
            const dishIds = (dishLinks.data ?? []).map((link) => link.dish_id);
            const dishesResult = dishIds.length > 0
                ? await client.from("dishes").select("id, name, meal_type_id").in("id", dishIds)
                : { data: [], error: null };

            if (mealLinks.error || dishLinks.error || dishesResult.error) {
                if (!cancelled) {
                    setEditError("Unable to load the selected meals and dishes for this booking.");
                    setEditLoading(false);
                }
                return;
            }

            const dishesById = new Map((dishesResult.data ?? []).map((dish) => [dish.id, dish]));
            const selectedByMeal: SelectedDishes = {};
            (dishLinks.data ?? []).forEach((link) => {
                const dish = dishesById.get(link.dish_id);
                if (!dish || !link.meal_type_id) return;
                selectedByMeal[link.meal_type_id] = [...(selectedByMeal[link.meal_type_id] ?? []), dish.name];
            });

            if (!cancelled) {
                const normalizedDateTime = normalizeBookingDateTime(booking.booking_date, booking.booking_time.slice(0, 5));
                setDuration(booking.duration_minutes === 120 ? "2 Hours" : "1 Hour");
                setBookingDate(normalizedDateTime.date);
                setBookingTime(normalizedDateTime.time);
                if (normalizedDateTime.adjusted) setDateTimeNotice("The saved date or time has passed or is outside booking hours. It was moved to the next available slot; please review it.");
                setPeople(booking.people_count);
                setNotes(booking.customer_notes ?? "");
                setSelectedMeals((mealLinks.data ?? []).map((link) => link.meal_type_id));
                setSelectedDishes(selectedByMeal);
                setEditLoading(false);
            }
        }

        void loadBookingForEdit();
        return () => { cancelled = true; };
    }, [bookingId, supabase]);

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
    const earliestBooking = getNextBookingDateTime();
    const minimumBookingDate = earliestBooking.date;
    const minimumBookingTime = bookingDate === minimumBookingDate ? earliestBooking.time : undefined;
    const timeOptions = getTimeOptions(minimumBookingTime);
    const selectedTimeIsAvailable = timeOptions.some((option) => option.value === bookingTime);

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

    if (mealDataLoading || editLoading) return <RequestLoader message={bookingId ? "Loading your booking..." : "Loading booking options..."} />;
    if (editError) return <main className="booking-confirmed-error"><strong>{editError}</strong><button onClick={() => router.push(`/booking-confirmed?bookingId=${encodeURIComponent(bookingId || "")}`)}>Back to booking details</button></main>;

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
        if (!bookingId && !addressId) {
            setDateTimeError("Add a saved address before continuing. Return to Home to select one.");
            return;
        }
        if (!bookingDate || bookingDate < minimumBookingDate) {
            setDateTimeError(`Choose ${minimumBookingDate} or a later date.`);
            return;
        }
        if (!isAllowedBookingTime(bookingTime) || (bookingDate === minimumBookingDate && bookingTime < earliestBooking.time)) {
            setDateTimeError("Choose a time between 6:00 AM and 8:00 PM in 30-minute intervals.");
            return;
        }
        setDateTimeError("");
        const draft: BookingDraft = { bookingId, addressId, duration, bookingDate, bookingTime, people, selectedMeals, selectedDishes, notes };
        window.sessionStorage.setItem(bookingDraftStorageKey, JSON.stringify(draft));
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
        if (bookingId) params.set("bookingId", bookingId);
        if (addressId) params.set("addressId", addressId);
        router.push(`/reviewBooking?${params.toString()}`);
    }

    return (
        <div className="booking-background">
            <main className="booking-page">
                <div className="booking-scroll-content">
                    <header className="booking-header">
                        <button className="back-button" onClick={() => window.history.back()} aria-label="Go back"><ArrowLeft /></button>
                        <h1>{bookingId ? "Edit Booking" : "Book a Cook"}</h1>
                        <span className="header-spacer" aria-hidden="true" />
                    </header>

                    <div className="booking-form">
                        <section className="form-step">
                            <StepNumber number={1} />
                            <div className="form-content"><h2>Select date &amp; time</h2><div className="datetime-fields"><label className="field-button input-field"><CalendarDays /><input aria-label="Select date" type="date" value={bookingDate} min={minimumBookingDate} onChange={(event) => { const nextDate = event.target.value; if (nextDate && nextDate < minimumBookingDate) { setDateTimeError(`Past dates are unavailable. Choose ${minimumBookingDate} or later.`); return; } setBookingDate(nextDate); setDateTimeError(""); setDateTimeNotice(""); const nextMinimum = nextDate === minimumBookingDate ? earliestBooking.time : undefined; const nextOptions = getTimeOptions(nextMinimum); if (!nextOptions.some((option) => option.value === bookingTime)) setBookingTime(nextOptions[0]?.value ?? ""); }} /></label><label className="field-button input-field"><Clock3 /><select aria-label="Select time" value={selectedTimeIsAvailable ? bookingTime : ""} onChange={(event) => { setBookingTime(event.target.value); setDateTimeError(""); setDateTimeNotice(""); }}><option value="" disabled>Select a time</option>{!selectedTimeIsAvailable && bookingTime && <option value={bookingTime} disabled>{formatTimeOption(bookingTime)} · choose a 30-minute slot</option>}{timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown aria-hidden="true" /></label></div>{dateTimeNotice && <p className="form-hint" role="status">{dateTimeNotice}</p>}{dateTimeError && <p className="form-error" role="alert">{dateTimeError}</p>}</div>
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

function getNextBookingDateTime() {
    const now = new Date();
    const nextSlot = new Date(now);
    nextSlot.setSeconds(0, 0);
    nextSlot.setMinutes(Math.ceil((now.getMinutes() + 1) / 30) * 30);
    if (nextSlot.getHours() < 6) nextSlot.setHours(6, 0, 0, 0);
    if (nextSlot.getHours() > 20 || (nextSlot.getHours() === 20 && nextSlot.getMinutes() > 0)) {
        nextSlot.setDate(nextSlot.getDate() + 1);
        nextSlot.setHours(6, 0, 0, 0);
    }
    const localDate = new Date(nextSlot.getTime() - nextSlot.getTimezoneOffset() * 60_000);
    return {
        date: localDate.toISOString().slice(0, 10),
        time: `${String(nextSlot.getHours()).padStart(2, "0")}:${String(nextSlot.getMinutes()).padStart(2, "0")}`,
    };
}

function normalizeBookingDateTime(date: string, time: string) {
    const earliest = getNextBookingDateTime();
    const normalizedDate = date < earliest.date ? earliest.date : date;
    const options = getTimeOptions(normalizedDate === earliest.date ? earliest.time : undefined);
    if (!isAllowedBookingTime(time) || (normalizedDate === earliest.date && time < earliest.time)) {
        return { date: normalizedDate, time: options[0]?.value ?? earliest.time, adjusted: true };
    }
    return { date: normalizedDate, time, adjusted: normalizedDate !== date };
}

function isAllowedBookingTime(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 6 && hours <= 20 && (minutes === 0 || minutes === 30);
}

function getTimeOptions(minimumTime?: string) {
    return Array.from({ length: 29 }, (_, index) => {
        const totalMinutes = 6 * 60 + index * 30;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        return { value, label: formatTimeOption(value) };
    }).filter((option) => !minimumTime || option.value >= minimumTime);
}

function formatTimeOption(value: string) {
    return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${value}`));
}

function MultiSelectDropdown({ id, label, options, selected, open, onToggle, onSelect }: { id: string; label: string; options: { id: string; label: string }[]; selected: string[]; open: boolean; onToggle: () => void; onSelect: (id: string) => void }) {
    const selectedLabels = options.filter((option) => selected.includes(option.id)).map((option) => option.label);
    const summary = selectedLabels.length === 0 ? label : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;
    return <div className={`multi-select ${open ? "multi-select-open" : ""}`} id={id}><button className="multi-select-trigger" type="button" onClick={onToggle} aria-expanded={open}><span>{summary}</span><ChevronDown /></button>{open && <div className="multi-select-menu" role="listbox" aria-multiselectable="true">{options.length === 0 ? <p className="multi-select-empty">No options available</p> : options.map((option) => <button key={option.id} className={`multi-select-option ${selected.includes(option.id) ? "selected" : ""}`} type="button" role="option" aria-selected={selected.includes(option.id)} onClick={() => onSelect(option.id)}><span className="multi-select-checkbox">{selected.includes(option.id) ? "✓" : ""}</span><span>{option.label}</span></button>)}</div>}</div>;
}
