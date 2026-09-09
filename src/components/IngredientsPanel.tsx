"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Info,
    ShoppingBasket,
    Sunrise,
    Sun,
    Moon,
    X,
} from "lucide-react";

type MealKey = "Breakfast" | "Lunch" | "Dinner";
type DishSelections = Record<MealKey, string[]>;
type Ingredient = { name: string; quantity: string; grams: number };

type IngredientsPanelProps = {
    people: number;
    selectedMeals: MealKey[];
    selectedDishes: DishSelections;
    open: boolean;
    onClose: () => void;
};

const mealIcons = { Breakfast: Sunrise, Lunch: Sun, Dinner: Moon };

const ingredientLibrary: Record<string, Ingredient[]> = {
    Idli: [{ name: "Rice", quantity: "125 g", grams: 125 }, { name: "Urad dal", quantity: "50 g", grams: 50 }],
    Dosa: [{ name: "Rice", quantity: "150 g", grams: 150 }, { name: "Urad dal", quantity: "50 g", grams: 50 }],
    Upma: [{ name: "Semolina", quantity: "150 g", grams: 150 }, { name: "Onion", quantity: "1 pc", grams: 80 }],
    Poha: [{ name: "Poha", quantity: "150 g", grams: 150 }, { name: "Peanuts", quantity: "30 g", grams: 30 }],
    Puri: [{ name: "Wheat flour (Atta)", quantity: "180 g", grams: 180 }, { name: "Oil / Ghee", quantity: "30 ml", grams: 30 }],
    Paratha: [{ name: "Wheat flour (Atta)", quantity: "180 g", grams: 180 }, { name: "Oil / Ghee", quantity: "25 ml", grams: 25 }],
    Pongal: [{ name: "Rice", quantity: "125 g", grams: 125 }, { name: "Moong dal", quantity: "50 g", grams: 50 }],
    Dal: [{ name: "Toor dal", quantity: "150 g", grams: 150 }, { name: "Tomato", quantity: "2 pcs", grams: 160 }, { name: "Onion", quantity: "1 pc", grams: 80 }],
    "Paneer Curry": [{ name: "Paneer", quantity: "250 g", grams: 250 }, { name: "Tomato", quantity: "3 pcs", grams: 240 }],
    "Veg Biryani": [{ name: "Basmati rice", quantity: "250 g", grams: 250 }, { name: "Mixed vegetables", quantity: "300 g", grams: 300 }],
    "Curd Rice": [{ name: "Rice", quantity: "200 g", grams: 200 }, { name: "Curd", quantity: "250 g", grams: 250 }],
    Sambar: [{ name: "Toor dal", quantity: "150 g", grams: 150 }, { name: "Mixed vegetables", quantity: "250 g", grams: 250 }],
    Rasam: [{ name: "Tomato", quantity: "4 pcs", grams: 320 }, { name: "Rasam powder", quantity: "20 g", grams: 20 }],
    Chapati: [{ name: "Wheat flour (Atta)", quantity: "200 g", grams: 200 }, { name: "Oil / Ghee", quantity: "15 ml", grams: 15 }],
    "Veg Curry": [{ name: "Mixed vegetables", quantity: "300 g", grams: 300 }, { name: "Onion", quantity: "1 pc", grams: 80 }],
    "Chicken Curry": [{ name: "Chicken", quantity: "400 g", grams: 400 }, { name: "Onion", quantity: "2 pcs", grams: 160 }, { name: "Tomato", quantity: "2 pcs", grams: 160 }],
    "Egg Curry": [{ name: "Eggs", quantity: "6 pcs", grams: 300 }, { name: "Tomato", quantity: "2 pcs", grams: 160 }],
    "Tomato Rice": [{ name: "Rice", quantity: "250 g", grams: 250 }, { name: "Tomato", quantity: "4 pcs", grams: 320 }],
    "Lemon Rice": [{ name: "Rice", quantity: "250 g", grams: 250 }, { name: "Lemon", quantity: "2 pcs", grams: 120 }],
    Other: [{ name: "Seasonal ingredients", quantity: "As needed", grams: 0 }],
};

export function IngredientsPanel({ people, selectedMeals, selectedDishes, open, onClose }: IngredientsPanelProps) {
    const [view, setView] = useState<"combined" | "meal">("combined");
    const [expandedMeal, setExpandedMeal] = useState<MealKey | null>(null);

    const mealIngredients = useMemo(() => {
        return selectedMeals.reduce<Record<MealKey, Ingredient[]>>((result, meal) => {
            result[meal] = (selectedDishes[meal] || []).flatMap((dish) => ingredientLibrary[dish] || ingredientLibrary.Other);
            return result;
        }, {} as Record<MealKey, Ingredient[]>);
    }, [selectedDishes, selectedMeals]);

    const combinedIngredients = useMemo(() => {
        const totals = new Map<string, Ingredient>();
        Object.values(mealIngredients).flat().forEach((ingredient) => {
            const existing = totals.get(ingredient.name);
            if (existing) {
                existing.grams += ingredient.grams;
                existing.quantity = formatQuantity(existing.grams, ingredient.quantity);
            } else {
                totals.set(ingredient.name, { ...ingredient, grams: ingredient.grams, quantity: ingredient.quantity });
            }
        });
        return [...totals.values()];
    }, [mealIngredients]);

    const scaledIngredients = combinedIngredients.map((ingredient) => ({
        ...ingredient,
        quantity: scaleQuantity(ingredient, people),
        grams: ingredient.grams * people / 4,
    }));
    const totalWeight = Math.round(scaledIngredients.reduce((total, ingredient) => total + ingredient.grams, 0));
    const dishCount = selectedMeals.reduce((total, meal) => total + (selectedDishes[meal]?.length || 0), 0);

    if (!open) return null;

    return (
        <div className="ingredients-backdrop" role="presentation" onMouseDown={onClose}>
            <aside className="ingredients-panel" role="dialog" aria-modal="true" aria-labelledby="ingredients-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className="ingredients-header"><div><h2 id="ingredients-title">Ingredients for {people} {people === 1 ? "person" : "people"}</h2><p>Ingredients calculated for all selected dishes.</p></div><button className="ingredients-close" onClick={onClose} aria-label="Close ingredients"><X /></button></header>
                <div className="ingredients-tabs"><button className={view === "meal" ? "" : "active"} onClick={() => setView("combined")}>Combined</button><button className={view === "meal" ? "active" : ""} onClick={() => setView("meal")}>By Meal</button></div>
                {view === "combined" ? <>
                    <section className="ingredients-summary"><div className="ingredients-summary-icon"><ShoppingBasket /></div><div><strong>Total Ingredients (Combined)</strong><span>All dishes · {people} {people === 1 ? "person" : "people"}</span></div><div className="ingredient-stats"><span><b>{scaledIngredients.length}</b>Items</span><span><b>{(totalWeight / 1000).toFixed(1)} kg</b>Total (approx.)</span><span><b>{people}</b>People</span></div></section>
                    <IngredientTable ingredients={scaledIngredients} />
                    <DishBreakdown meals={selectedMeals} selectedDishes={selectedDishes} mealIngredients={mealIngredients} expandedMeal={expandedMeal} onToggle={(meal) => setExpandedMeal(expandedMeal === meal ? null : meal)} />
                </> : <div className="meal-ingredient-list">{selectedMeals.map((meal) => <section key={meal} className="meal-ingredient-card"><MealHeading meal={meal} count={selectedDishes[meal]?.length || 0} /><IngredientTable ingredients={scaleIngredients(mealIngredients[meal] || [], people)} /></section>)}</div>}
                <div className="ingredients-note"><Info /><span>Quantities are approximate and may vary based on preparation style.</span></div>
            </aside>
        </div>
    );
}

function IngredientTable({ ingredients }: { ingredients: Ingredient[] }) {
    return <div className="ingredient-table"><div className="ingredient-table-head"><span>Ingredient</span><span>Total Quantity</span></div>{ingredients.map((ingredient) => <div className="ingredient-row" key={`${ingredient.name}-${ingredient.quantity}`}><span>{ingredient.name}</span><span>{ingredient.quantity}</span></div>)}</div>;
}

function DishBreakdown({ meals, selectedDishes, mealIngredients, expandedMeal, onToggle }: { meals: MealKey[]; selectedDishes: DishSelections; mealIngredients: Record<MealKey, Ingredient[]>; expandedMeal: MealKey | null; onToggle: (meal: MealKey) => void }) {
    return <section className="dish-breakdown"><h3>Breakdown by Dish <ChevronDown /></h3>{meals.map((meal) => <div className="breakdown-item" key={meal}><button onClick={() => onToggle(meal)}><MealHeading meal={meal} count={selectedDishes[meal]?.length || 0} /><span className="breakdown-meta">{mealIngredients[meal]?.length || 0} ingredients</span>{expandedMeal === meal ? <ChevronUp /> : <ChevronDown />}</button>{expandedMeal === meal && <div className="breakdown-dishes">{selectedDishes[meal].map((dish) => <span key={dish}>{dish}</span>)}</div>}</div>)}</section>;
}

function MealHeading({ meal, count }: { meal: MealKey; count: number }) {
    const Icon = mealIcons[meal];
    return <span className="meal-heading"><Icon /><strong>{meal}</strong>{count > 0 && <small>({count} {count === 1 ? "dish" : "dishes"})</small>}</span>;
}

function scaleIngredients(ingredients: Ingredient[], people: number) {
    return ingredients.map((ingredient) => ({ ...ingredient, grams: ingredient.grams * people / 4, quantity: scaleQuantity(ingredient, people) }));
}

function scaleQuantity(ingredient: Ingredient, people: number) {
    if (ingredient.grams === 0) return ingredient.quantity;
    const scaled = ingredient.grams * people / 4;
    if (ingredient.quantity.includes("pcs")) return `${Math.max(1, Math.round(scaled / 80))} pcs`;
    if (ingredient.quantity.includes("pc")) return `${Math.max(1, Math.round(scaled / 80))} pc${scaled >= 160 ? "s" : ""}`;
    if (ingredient.quantity.includes("ml")) return `${Math.round(scaled)} ml`;
    return `${Math.round(scaled)} g`;
}

function formatQuantity(grams: number, original: string) {
    if (original.includes("ml")) return `${grams} ml`;
    if (original.includes("pc")) return `${Math.max(1, Math.round(grams / 80))} pcs`;
    return `${grams} g`;
}
