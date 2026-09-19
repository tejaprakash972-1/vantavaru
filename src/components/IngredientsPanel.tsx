"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Info,
    ShoppingBasket,
    Sunrise,
    Sun,
    Moon,
    X,
    Utensils,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type MealKey = string;
type DishSelections = Record<string, string[]>;
type DishRow = { id: string; name: string };
type IngredientRow = { id: string; name: string; defaultUnit: string };
type DishIngredientRow = { dishId: string; ingredientId: string; quantityPerPerson: number | null; unit: string; notes: string };
type IngredientTotal = { id: string; name: string; quantity: number | null; unit: string; notes: string };

type IngredientsPanelProps = {
    people: number;
    selectedMeals: MealKey[];
    mealNames?: Record<string, string>;
    selectedDishes: DishSelections;
    open: boolean;
    onClose: () => void;
};

const mealIcons: Record<string, typeof Sunrise> = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon };

export function IngredientsPanel({ people, selectedMeals, mealNames = {}, selectedDishes, open, onClose }: IngredientsPanelProps) {
    const supabase = getSupabaseBrowserClient();
    const [view, setView] = useState<"combined" | "meal">("combined");
    const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
    const [dishes, setDishes] = useState<DishRow[]>([]);
    const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
    const [dishIngredients, setDishIngredients] = useState<DishIngredientRow[]>([]);
    const [loadedMealNames, setLoadedMealNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || !supabase) return;
        const client = supabase;
        let cancelled = false;

        async function loadIngredients() {
            setLoading(true);
            setError("");
            const [mealTypeResult, dishResult, ingredientResult, relationResult] = await Promise.all([
                client.from("meal_types").select("id, name"),
                client.from("dishes").select("id, name"),
                client.from("ingredients").select("id, name, default_unit").eq("is_active", true),
                client.from("dish_ingredients").select("dish_id, ingredient_id, quantity_per_person, unit, notes"),
            ]);
            const firstError = mealTypeResult.error || dishResult.error || ingredientResult.error || relationResult.error;
            if (firstError) {
                if (!cancelled) { setError(firstError.message); setLoading(false); }
                return;
            }
            if (!cancelled) {
                setLoadedMealNames(Object.fromEntries((mealTypeResult.data ?? []).map((row) => [row.id, row.name])));
                setDishes((dishResult.data ?? []).map((row) => ({ id: row.id, name: row.name })));
                setIngredients((ingredientResult.data ?? []).map((row) => ({ id: row.id, name: row.name, defaultUnit: row.default_unit ?? "" })));
                setDishIngredients((relationResult.data ?? []).map((row) => ({ dishId: row.dish_id, ingredientId: row.ingredient_id, quantityPerPerson: row.quantity_per_person === null ? null : Number(row.quantity_per_person), unit: row.unit ?? "", notes: row.notes ?? "" })));
                setLoading(false);
            }
        }

        void loadIngredients();
        return () => { cancelled = true; };
    }, [open, supabase]);

    const dishIdsByName = useMemo(() => new Map(dishes.map((dish) => [dish.name, dish.id])), [dishes]);
    const ingredientById = useMemo(() => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])), [ingredients]);
    const resolvedMealNames = useMemo(() => ({ ...loadedMealNames, ...mealNames }), [loadedMealNames, mealNames]);
    const mealIngredients = useMemo(() => {
        return selectedMeals.reduce<Record<string, IngredientTotal[]>>((result, meal) => {
            const totals = new Map<string, IngredientTotal>();
            (selectedDishes[meal] ?? []).forEach((dishName) => {
                const dishId = dishIdsByName.get(dishName);
                if (!dishId) return;
                dishIngredients.filter((relation) => relation.dishId === dishId).forEach((relation) => {
                    const ingredient = ingredientById.get(relation.ingredientId);
                    if (!ingredient) return;
                    const unit = relation.unit || ingredient.defaultUnit || "";
                    const key = `${ingredient.id}:${unit}`;
                    const existing = totals.get(key);
                    if (existing) {
                        existing.quantity = existing.quantity === null || relation.quantityPerPerson === null ? null : existing.quantity + relation.quantityPerPerson * people;
                    } else {
                        totals.set(key, { id: ingredient.id, name: ingredient.name, quantity: relation.quantityPerPerson === null ? null : relation.quantityPerPerson * people, unit, notes: relation.notes });
                    }
                });
            });
            result[meal] = [...totals.values()];
            return result;
        }, {});
    }, [dishIdsByName, dishIngredients, ingredientById, people, selectedDishes, selectedMeals]);

    const combinedIngredients = useMemo(() => {
        const totals = new Map<string, IngredientTotal>();
        Object.values(mealIngredients).flat().forEach((ingredient) => {
            const key = `${ingredient.id}:${ingredient.unit}`;
            const existing = totals.get(key);
            if (existing) {
                existing.quantity = existing.quantity === null || ingredient.quantity === null ? null : existing.quantity + ingredient.quantity;
            } else {
                totals.set(key, { ...ingredient });
            }
        });
        return [...totals.values()];
    }, [mealIngredients]);
    if (!open) return null;

    return (
        <div className="ingredients-backdrop" role="presentation" onMouseDown={onClose}>
            <aside className="ingredients-panel" role="dialog" aria-modal="true" aria-labelledby="ingredients-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className="ingredients-header"><div><h2 id="ingredients-title">Ingredients for {people} {people === 1 ? "person" : "people"}</h2><p>Ingredients calculated for all selected dishes.</p></div><button className="ingredients-close" onClick={onClose} aria-label="Close ingredients"><X /></button></header>
                <div className="ingredients-tabs"><button className={view === "meal" ? "" : "active"} onClick={() => setView("combined")}>Combined</button><button className={view === "meal" ? "active" : ""} onClick={() => setView("meal")}>By Meal</button></div>
                {loading ? <p className="ingredients-loading">Loading ingredients...</p> : error ? <p className="ingredients-error" role="alert">{error}</p> : selectedMeals.length === 0 ? <p className="ingredients-loading">Select a meal and dishes to see ingredients.</p> : view === "combined" ? <>
                    <section className="ingredients-summary"><div className="ingredients-summary-icon"><ShoppingBasket /></div><div><strong>Total Ingredients (Combined)</strong><span>All selected dishes · {people} {people === 1 ? "person" : "people"}</span></div><div className="ingredient-stats"><span><b>{combinedIngredients.length}</b>Items</span><span><b>{selectedMeals.length}</b>Meals</span><span><b>{people}</b>People</span></div></section>
                    <IngredientTable ingredients={combinedIngredients} />
                    <DishBreakdown meals={selectedMeals} mealNames={resolvedMealNames} selectedDishes={selectedDishes} mealIngredients={mealIngredients} expandedMeal={expandedMeal} onToggle={(meal) => setExpandedMeal(expandedMeal === meal ? null : meal)} />
                </> : <div className="meal-ingredient-list">{selectedMeals.map((meal) => <section key={meal} className="meal-ingredient-card"><MealHeading meal={resolvedMealNames[meal] ?? meal} count={selectedDishes[meal]?.length || 0} /><IngredientTable ingredients={mealIngredients[meal] || []} /></section>)}</div>}
                <div className="ingredients-note"><Info /><span>Quantities use the database&apos;s per-person values multiplied by your number of people.</span></div>
            </aside>
        </div>
    );
}

function IngredientTable({ ingredients }: { ingredients: IngredientTotal[] }) {
    return <div className="ingredient-table">{ingredients.length === 0 ? <p className="ingredients-loading">No ingredient rows found.</p> : <><div className="ingredient-table-head"><span>Ingredient</span><span>Total Quantity</span></div>{ingredients.map((ingredient) => <div className="ingredient-row" key={`${ingredient.id}-${ingredient.unit}`}><span>{ingredient.name}</span><span>{formatQuantity(ingredient.quantity, ingredient.unit)}</span></div>)}</>}</div>;
}

function DishBreakdown({ meals, mealNames, selectedDishes, mealIngredients, expandedMeal, onToggle }: { meals: MealKey[]; mealNames: Record<string, string>; selectedDishes: DishSelections; mealIngredients: Record<string, IngredientTotal[]>; expandedMeal: MealKey | null; onToggle: (meal: MealKey) => void }) {
    return <section className="dish-breakdown"><h3>Breakdown by Meal <ChevronDown /></h3>{meals.map((meal) => <div className="breakdown-item" key={meal}><button onClick={() => onToggle(meal)}><MealHeading meal={mealNames[meal] ?? meal} count={selectedDishes[meal]?.length || 0} /><span className="breakdown-meta">{mealIngredients[meal]?.length || 0} ingredients</span>{expandedMeal === meal ? <ChevronUp /> : <ChevronDown />}</button>{expandedMeal === meal && <div className="breakdown-dishes">{(selectedDishes[meal] || []).map((dish) => <span key={dish}>{dish}</span>)}</div>}</div>)}</section>;
}

function MealHeading({ meal, count }: { meal: MealKey; count: number }) {
    const Icon = mealIcons[meal] ?? Utensils;
    return <span className="meal-heading"><Icon /><strong>{meal}</strong>{count > 0 && <small>({count} {count === 1 ? "dish" : "dishes"})</small>}</span>;
}

function formatQuantity(quantity: number | null, unit: string) {
    if (quantity === null) return "As needed";
    const rounded = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.00$/, "");
    return unit ? `${rounded} ${unit}` : rounded;
}
