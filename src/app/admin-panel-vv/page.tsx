"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Bell, ChevronDown, ChevronRight, ChefHat, CircleHelp, Coffee, Edit3,
    Filter, MoreHorizontal, Plus, Search, ShoppingBasket, Soup, Trash2,
    Utensils, X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Dish = {
    id: string;
    name: string;
    description: string;
    category: string;
    mealTypeId: string;
    mealTypeName: string;
    preparationCost: number;
    isActive: boolean;
};

type MealType = { id: string; name: string; sortOrder: number };
type Ingredient = { id: string; name: string; defaultUnit: string };
type DishIngredient = { id: string; dishId: string; ingredientId: string; quantity: number | null; unit: string; notes: string };
type DishDraft = Pick<Dish, "name" | "description" | "category" | "mealTypeId" | "preparationCost" | "isActive">;

const mealIcons = [Coffee, Soup, Utensils, ShoppingBasket, Coffee, Soup];

export default function AdminPanelPage() {
    const supabase = getSupabaseBrowserClient();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [mealTypes, setMealTypes] = useState<MealType[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [dishIngredients, setDishIngredients] = useState<DishIngredient[]>([]);
    const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
    const [activeMealType, setActiveMealType] = useState("All Dishes");
    const [searchTerm, setSearchTerm] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadAdminData() {
            if (!supabase) {
                setError("Supabase is not configured for this environment.");
                setLoading(false);
                return;
            }

            const [mealTypeResult, dishResult, ingredientResult, dishIngredientResult] = await Promise.all([
                supabase.from("meal_types").select("id, name, sort_order").order("sort_order", { ascending: true }),
                supabase.from("dishes").select("id, name, description, category, meal_type_id, preparation_cost_per_person, is_active").order("sort_order", { ascending: true }),
                supabase.from("ingredients").select("id, name, default_unit").order("name", { ascending: true }),
                supabase.from("dish_ingredients").select("id, dish_id, ingredient_id, quantity_per_person, unit, notes"),
            ]);

            const firstError = mealTypeResult.error || dishResult.error || ingredientResult.error || dishIngredientResult.error;
            if (firstError) {
                if (!cancelled) {
                    setError(firstError.message);
                    setLoading(false);
                }
                return;
            }

            const loadedMealTypes = (mealTypeResult.data ?? []).map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order ?? 0 }));
            const mealTypeNames = new Map(loadedMealTypes.map((mealType) => [mealType.id, mealType.name]));
            const loadedDishes = (dishResult.data ?? []).map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description ?? "",
                category: row.category ?? "",
                mealTypeId: row.meal_type_id,
                mealTypeName: mealTypeNames.get(row.meal_type_id) ?? "Uncategorized",
                preparationCost: Number(row.preparation_cost_per_person ?? 0),
                isActive: Boolean(row.is_active),
            }));

            if (!cancelled) {
                setMealTypes(loadedMealTypes);
                setDishes(loadedDishes);
                setIngredients((ingredientResult.data ?? []).map((row) => ({ id: row.id, name: row.name, defaultUnit: row.default_unit ?? "" })));
                setDishIngredients((dishIngredientResult.data ?? []).map((row) => ({ id: row.id, dishId: row.dish_id, ingredientId: row.ingredient_id, quantity: row.quantity_per_person === null ? null : Number(row.quantity_per_person), unit: row.unit ?? "", notes: row.notes ?? "" })));
                setSelectedDishId((current) => current ?? loadedDishes[0]?.id ?? null);
                setLoading(false);
            }
        }

        void loadAdminData();
        return () => { cancelled = true; };
    }, [supabase]);

    const filteredDishes = useMemo(() => dishes.filter((dish) => {
        const matchesMealType = activeMealType === "All Dishes" || dish.mealTypeName === activeMealType;
        const matchesSearch = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesMealType && matchesSearch;
    }), [activeMealType, dishes, searchTerm]);
    const selectedDish = dishes.find((dish) => dish.id === selectedDishId) ?? filteredDishes[0] ?? null;
    const selectedIngredients = selectedDish ? dishIngredients.filter((item) => item.dishId === selectedDish.id) : [];

    async function saveSelectedDish(draft: DishDraft) {
        if (!supabase || !selectedDish) return;
        const { error: updateError } = await supabase.from("dishes").update({
            name: draft.name,
            description: draft.description,
            category: draft.category,
            meal_type_id: draft.mealTypeId,
            preparation_cost_per_person: draft.preparationCost,
            is_active: draft.isActive,
        }).eq("id", selectedDish.id);
        if (updateError) {
            setError(updateError.message);
            return;
        }
        const updatedMealType = mealTypes.find((mealType) => mealType.id === draft.mealTypeId);
        setDishes((current) => current.map((dish) => dish.id === selectedDish.id ? { ...dish, ...draft, mealTypeName: updatedMealType?.name ?? "Uncategorized" } : dish));
        setNotice("Dish updated successfully");
        window.setTimeout(() => setNotice(""), 2600);
    }

    return (
        <main className="admin-panel-page">
            <aside className="admin-sidebar">
                <div className="admin-brand"><span className="admin-brand-mark"><ChefHat /></span><span><strong>Vantavaru</strong><small>Admin Panel</small></span></div>
                <nav className="admin-nav" aria-label="Admin navigation"><button className="admin-nav-item active"><Utensils /> Dishes</button></nav>
                <div className="admin-sidebar-footer"><CircleHelp /><span><strong>Good food</strong><small>brings people together</small></span></div>
            </aside>
            <section className="admin-workspace">
                <header className="admin-topbar"><div /><div className="admin-account"><button aria-label="Notifications"><Bell /></button><span className="admin-avatar">A</span><strong>Admin</strong><ChevronDown /></div></header>
                <div className="admin-content">
                    <div className="admin-heading-row"><div><div className="admin-breadcrumb">Dishes <ChevronRight /> <strong>Manage Dishes</strong></div><h1>Manage Dishes</h1><p>View and manage all dishes by meal type. Update details, ingredients, and pricing.</p></div><button className="admin-primary-button"><Plus /> Add New Dish</button></div>
                    {error && <p className="admin-data-error" role="alert">{error}</p>}
                    <div className="admin-dish-layout">
                        <aside className="meal-type-panel"><h2>Meal Types</h2><div className="meal-type-list"><MealTypeButton label="All Dishes" count={dishes.length} index={0} active={activeMealType} onSelect={setActiveMealType} />{mealTypes.map((mealType, index) => <MealTypeButton key={mealType.id} label={mealType.name} count={dishes.filter((dish) => dish.mealTypeId === mealType.id).length} index={index + 1} active={activeMealType} onSelect={setActiveMealType} />)}</div></aside>
                        <div className="admin-main-column">
                            <section className="dish-table-panel"><div className="dish-table-heading"><h2>Dishes in {activeMealType} <span>({filteredDishes.length})</span></h2><div className="dish-tools"><label><Search /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search dishes..." />{searchTerm && <button onClick={() => setSearchTerm("")} aria-label="Clear search"><X /></button>}</label><button className="filter-button"><Filter /> Filter</button></div></div><div className="dish-table-wrap">{loading ? <p className="admin-table-message">Loading dishes...</p> : <table><thead><tr><th>#</th><th>Dish Name</th><th>Description</th><th>Category</th><th>Preparation Cost<br />(₹/person)</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredDishes.map((dish, index) => <tr key={dish.id} className={selectedDish?.id === dish.id ? "selected-row" : ""} onClick={() => setSelectedDishId(dish.id)}><td>{index + 1}</td><td><strong>{dish.name}</strong></td><td>{dish.description}</td><td>{dish.category || "-"}</td><td>₹{dish.preparationCost}</td><td><span className={`status-pill ${dish.isActive ? "" : "inactive"}`}>{dish.isActive ? "Active" : "Inactive"}</span></td><td><div className="table-actions"><button aria-label={`Edit ${dish.name}`}><Edit3 /></button><button aria-label={`More actions for ${dish.name}`}><MoreHorizontal /></button></div></td></tr>)}</tbody></table>}</div></section>
                            {selectedDish && <EditDish key={selectedDish.id} dish={selectedDish} mealTypes={mealTypes} ingredients={ingredients} dishIngredients={selectedIngredients} onSave={saveSelectedDish} />}
                        </div>
                    </div>
                </div>
            </section>
            {notice && <div className="admin-toast" role="status">{notice}</div>}
        </main>
    );
}

function MealTypeButton({ label, count, index, active, onSelect }: { label: string; count: number; index: number; active: string; onSelect: (label: string) => void }) {
    const Icon = mealIcons[index % mealIcons.length];
    return <button className={`meal-type-item ${active === label ? "selected" : ""}`} onClick={() => onSelect(label)}><Icon /><span>{label}</span><b>{count}</b></button>;
}

function EditDish({ dish, mealTypes, ingredients, dishIngredients, onSave }: { dish: Dish; mealTypes: MealType[]; ingredients: Ingredient[]; dishIngredients: DishIngredient[]; onSave: (draft: DishDraft) => Promise<void> }) {
    const [draft, setDraft] = useState<DishDraft>(() => toDishDraft(dish));

    function updateDraft(field: keyof DishDraft, value: string | number | boolean) {
        setDraft((current) => ({ ...current, [field]: value }));
    }

    return <section className="edit-dish-panel"><div className="edit-panel-heading"><div><h2>Edit Dish</h2><p>Update dish details, costs and ingredients.</p></div><button aria-label="Close edit panel"><X /></button></div><div className="edit-dish-body"><div className="edit-fields"><label><div>Dish Name <em>*</em></div><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label><label><div>Preparation Cost per Person (₹) <em>*</em></div><input type="number" value={draft.preparationCost} onChange={(event) => updateDraft("preparationCost", Number(event.target.value))} /></label><label><div>Meal Type <em>*</em></div><select value={draft.mealTypeId} onChange={(event) => updateDraft("mealTypeId", event.target.value)}>{mealTypes.map((mealType) => <option key={mealType.id} value={mealType.id}>{mealType.name}</option>)}</select></label><label><div>Category</div><input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label><label><div>Status</div> <select value={draft.isActive ? "active" : "inactive"} onChange={(event) => updateDraft("isActive", event.target.value === "active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label className="description-field"><div>Description</div><textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label></div><Ingredients ingredients={ingredients} dishIngredients={dishIngredients} /></div><div className="edit-panel-actions"><button className="delete-button"><Trash2 /> Delete Dish</button><div><button className="cancel-button" onClick={() => setDraft(toDishDraft(dish))}>Cancel</button><button className="save-button" onClick={() => void onSave(draft)}>Save Changes</button></div></div></section>;
}

function toDishDraft(dish: Dish): DishDraft {
    return { name: dish.name, description: dish.description, category: dish.category, mealTypeId: dish.mealTypeId, preparationCost: dish.preparationCost, isActive: dish.isActive };
}

function Ingredients({ ingredients, dishIngredients }: { ingredients: Ingredient[]; dishIngredients: DishIngredient[] }) {
    return <div className="ingredients-panel"><div className="ingredients-heading"><h3>Ingredients <small>(per person)</small></h3><button><Plus /> Add Ingredient</button></div><table><thead><tr><th>#</th><th>Ingredient</th><th>Quantity</th><th>Unit</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{dishIngredients.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{ingredients.find((ingredient) => ingredient.id === item.ingredientId)?.name ?? "Unknown"}</td><td>{item.quantity ?? "-"}</td><td>{item.unit || ingredients.find((ingredient) => ingredient.id === item.ingredientId)?.defaultUnit || "-"}</td><td>{item.notes || "-"}</td><td><button aria-label="Delete ingredient"><Trash2 /></button></td></tr>)}</tbody></table></div>;
}
