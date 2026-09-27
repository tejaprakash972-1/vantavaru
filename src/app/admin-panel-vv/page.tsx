"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Bell, Check, ChevronDown, ChevronRight, ChefHat, CircleHelp, Coffee, Edit3,
    FileText, Filter, MoreHorizontal, Plus, Search, ShoppingBasket, Soup,
    Trash2, Utensils, UsersRound, X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import RequestLoader from "@/components/RequestLoader";

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
type CookStatus = "pending" | "approved" | "rejected";
type Cook = {
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    experience: string;
    cuisines: string[];
    languages: string[];
    city: string;
    address: string;
    pincode: string;
    landmark: string;
    serviceRadius: number;
    status: CookStatus;
    submittedAt: string;
    rejectionReason: string;
};
type CookDocument = { id: string; cookId: string; documentType: string; filePath: string; status: string };
type CookRpcRow = {
    id: string; user_id: string; phone: string | null; full_name: string | null; date_of_birth: string | null; gender: string | null; cooking_experience: string | null; cuisines: unknown; languages: unknown; house_flat_no: string | null; street_area: string | null; city: string | null; pincode: string | null; landmark: string | null; service_radius_km: number | null; status: CookStatus | null; submitted_at: string | null; rejection_reason: string | null;
};

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
    const [activeSection, setActiveSection] = useState<"dishes" | "cooks">("dishes");
    const [cooks, setCooks] = useState<Cook[]>([]);
    const [cookDocuments, setCookDocuments] = useState<CookDocument[]>([]);
    const [selectedCookId, setSelectedCookId] = useState<string | null>(null);
    const [openCookMenu, setOpenCookMenu] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadAdminData() {
            if (!supabase) {
                setError("Supabase is not configured for this environment.");
                setLoading(false);
                return;
            }

            const [mealTypeResult, dishResult, ingredientResult, dishIngredientResult, cookResult, documentResult] = await Promise.all([
                supabase.from("meal_types").select("id, name, sort_order").order("sort_order", { ascending: true }),
                supabase.from("dishes").select("id, name, description, category, meal_type_id, preparation_cost_per_person, is_active").order("sort_order", { ascending: true }),
                supabase.from("ingredients").select("id, name, default_unit").order("name", { ascending: true }),
                supabase.from("dish_ingredients").select("id, dish_id, ingredient_id, quantity_per_person, unit, notes"),
                supabase.rpc("admin_get_cooks"),
                supabase.from("cook_documents").select("id, cook_id, document_type, file_path, status").order("uploaded_at", { ascending: false }),
            ]);

            let firstError = mealTypeResult.error || dishResult.error || ingredientResult.error || dishIngredientResult.error || documentResult.error;

            const loadedMealTypes = (mealTypeResult.data ?? []).map((row) => ({ id: row.id, name: row.name, sortOrder: row.sort_order ?? 0 }));
            const mealTypeNames = new Map(loadedMealTypes.map((mealType) => [mealType.id, mealType.name]));
            let cookRows = (cookResult.data ?? []) as CookRpcRow[];
            let profilePhones = new Map<string, string>();
            if (cookResult.error?.code === "PGRST202") {
                const [fallbackCookResult, profileResult] = await Promise.all([
                    supabase.from("cook_profiles").select("id, user_id, full_name, date_of_birth, gender, cooking_experience, cuisines, languages, house_flat_no, street_area, city, pincode, landmark, service_radius_km, status, submitted_at, rejection_reason").order("submitted_at", { ascending: false }),
                    supabase.from("profiles").select("id, phone"),
                ]);
                cookRows = (fallbackCookResult.data ?? []).map((row) => ({ ...row, phone: null })) as CookRpcRow[];
                profilePhones = new Map((profileResult.data ?? []).map((row) => [row.id, row.phone ?? ""]));
                if (fallbackCookResult.error) firstError = fallbackCookResult.error;
            }
            if (cookResult.error && cookResult.error.code !== "PGRST202") firstError = cookResult.error;
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
                if (firstError) setError(firstError.message);
                setMealTypes(loadedMealTypes);
                setDishes(loadedDishes);
                setIngredients((ingredientResult.data ?? []).map((row) => ({ id: row.id, name: row.name, defaultUnit: row.default_unit ?? "" })));
                setDishIngredients((dishIngredientResult.data ?? []).map((row) => ({ id: row.id, dishId: row.dish_id, ingredientId: row.ingredient_id, quantity: row.quantity_per_person === null ? null : Number(row.quantity_per_person), unit: row.unit ?? "", notes: row.notes ?? "" })));
                setCooks(cookRows.map((row) => ({
                    id: row.id, userId: row.user_id, fullName: row.full_name ?? "Unnamed cook", phone: row.phone ?? profilePhones.get(row.user_id) ?? "", dateOfBirth: row.date_of_birth ?? "", gender: row.gender ?? "", experience: row.cooking_experience ?? "", cuisines: Array.isArray(row.cuisines) ? row.cuisines : [], languages: Array.isArray(row.languages) ? row.languages : [], city: row.city ?? "", address: [row.house_flat_no, row.street_area].filter(Boolean).join(", "), pincode: row.pincode ?? "", landmark: row.landmark ?? "", serviceRadius: Number(row.service_radius_km ?? 0), status: row.status ?? "pending", submittedAt: row.submitted_at ?? "", rejectionReason: row.rejection_reason ?? "",
                })));
                setCookDocuments((documentResult.data ?? []).map((row) => ({ id: row.id, cookId: row.cook_id, documentType: row.document_type ?? "Document", filePath: row.file_path ?? "", status: row.status ?? "pending" })));
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
    const selectedCook = cooks.find((cook) => cook.id === selectedCookId) ?? cooks[0] ?? null;
    const cookCounts = { all: cooks.length, pending: cooks.filter((cook) => cook.status === "pending").length, approved: cooks.filter((cook) => cook.status === "approved").length, rejected: cooks.filter((cook) => cook.status === "rejected").length };

    async function saveSelectedDish(draft: DishDraft) {
        if (!supabase || !selectedDish) return;
        setActionLoading(true);
        try {
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
        } finally {
            setActionLoading(false);
        }
    }

    async function updateCookStatus(cookId: string, status: CookStatus) {
        if (!supabase) return;
        setActionLoading(true);
        try {
            const payload = status === "rejected" ? { status, rejection_reason: rejectionReason || "Rejected by admin", rejected_at: new Date().toISOString() } : { status, approved_at: new Date().toISOString(), rejection_reason: null };
            const { error: updateError } = await supabase.from("cook_profiles").update(payload).eq("id", cookId);
            if (updateError) { setError(updateError.message); return; }
            setCooks((current) => current.map((cook) => cook.id === cookId ? { ...cook, status, rejectionReason: status === "rejected" ? rejectionReason || "Rejected by admin" : "" } : cook));
            setNotice(status === "approved" ? "Cook approved successfully" : "Cook rejected successfully");
            setOpenCookMenu(null);
            window.setTimeout(() => setNotice(""), 2600);
        } finally {
            setActionLoading(false);
        }
    }

    return (
        <main className="admin-panel-page">
            <aside className="admin-sidebar">
                <div className="admin-brand"><span className="admin-brand-mark"><ChefHat /></span><span><strong>Vantavaru</strong><small>Admin Panel</small></span></div>
                <nav className="admin-nav" aria-label="Admin navigation"><button className={`admin-nav-item ${activeSection === "dishes" ? "active" : ""}`} onClick={() => setActiveSection("dishes")}><Utensils /> Dishes</button><button className={`admin-nav-item ${activeSection === "cooks" ? "active" : ""}`} onClick={() => setActiveSection("cooks")}><ChefHat /> Cooks</button></nav>
                <div className="admin-sidebar-footer"><CircleHelp /><span><strong>Good food</strong><small>brings people together</small></span></div>
            </aside>
            <section className="admin-workspace">
                <header className="admin-topbar"><div /><div className="admin-account"><button aria-label="Notifications"><Bell /></button><span className="admin-avatar">A</span><strong>Admin</strong><ChevronDown /></div></header>
                <div className="admin-content">
                    {error && <p className="admin-data-error" role="alert">{error}</p>}
                    {activeSection === "dishes" ? <><div className="admin-heading-row"><div><div className="admin-breadcrumb">Dishes <ChevronRight /> <strong>Manage Dishes</strong></div><h1>Manage Dishes</h1><p>View and manage all dishes by meal type. Update details, ingredients, and pricing.</p></div><button className="admin-primary-button"><Plus /> Add New Dish</button></div>
                        <div className="admin-dish-layout">
                            <aside className="meal-type-panel"><h2>Meal Types</h2><div className="meal-type-list"><MealTypeButton label="All Dishes" count={dishes.length} index={0} active={activeMealType} onSelect={setActiveMealType} />{mealTypes.map((mealType, index) => <MealTypeButton key={mealType.id} label={mealType.name} count={dishes.filter((dish) => dish.mealTypeId === mealType.id).length} index={index + 1} active={activeMealType} onSelect={setActiveMealType} />)}</div></aside>
                            <div className="admin-main-column">
                                <section className="dish-table-panel"><div className="dish-table-heading"><h2>Dishes in {activeMealType} <span>({filteredDishes.length})</span></h2><div className="dish-tools"><label><Search /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search dishes..." />{searchTerm && <button onClick={() => setSearchTerm("")} aria-label="Clear search"><X /></button>}</label><button className="filter-button"><Filter /> Filter</button></div></div><div className="dish-table-wrap">{loading ? <p className="admin-table-message">Loading dishes...</p> : <table><thead><tr><th>#</th><th>Dish Name</th><th>Description</th><th>Category</th><th>Preparation Cost<br />(₹/person)</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredDishes.map((dish, index) => <tr key={dish.id} className={selectedDish?.id === dish.id ? "selected-row" : ""} onClick={() => setSelectedDishId(dish.id)}><td>{index + 1}</td><td><strong>{dish.name}</strong></td><td>{dish.description}</td><td>{dish.category || "-"}</td><td>₹{dish.preparationCost}</td><td><span className={`status-pill ${dish.isActive ? "" : "inactive"}`}>{dish.isActive ? "Active" : "Inactive"}</span></td><td><div className="table-actions"><button aria-label={`Edit ${dish.name}`}><Edit3 /></button><button aria-label={`More actions for ${dish.name}`}><MoreHorizontal /></button></div></td></tr>)}</tbody></table>}</div></section>
                                {selectedDish && <EditDish key={selectedDish.id} dish={selectedDish} mealTypes={mealTypes} ingredients={ingredients} dishIngredients={selectedIngredients} onSave={saveSelectedDish} />}
                            </div>
                        </div></> : <CooksSection cooks={cooks} documents={cookDocuments} counts={cookCounts} selectedCook={selectedCook} selectedCookId={selectedCookId} openMenu={openCookMenu} rejectionReason={rejectionReason} onSelect={setSelectedCookId} onMenu={setOpenCookMenu} onReason={setRejectionReason} onStatus={updateCookStatus} />}
                </div>
            </section>
            {notice && <div className="admin-toast" role="status">{notice}</div>}
            {(loading || actionLoading) && <RequestLoader message={loading ? "Loading admin data..." : "Saving changes..."} />}
        </main>
    );
}

function MealTypeButton({ label, count, index, active, onSelect }: { label: string; count: number; index: number; active: string; onSelect: (label: string) => void }) {
    const Icon = mealIcons[index % mealIcons.length];
    return <button className={`meal-type-item ${active === label ? "selected" : ""}`} onClick={() => onSelect(label)}><Icon /><span>{label}</span><b>{count}</b></button>;
}

function CooksSection({ cooks, documents, counts, selectedCook, selectedCookId, openMenu, rejectionReason, onSelect, onMenu, onReason, onStatus }: { cooks: Cook[]; documents: CookDocument[]; counts: { all: number; pending: number; approved: number; rejected: number }; selectedCook: Cook | null; selectedCookId: string | null; openMenu: string | null; rejectionReason: string; onSelect: (id: string) => void; onMenu: (id: string | null) => void; onReason: (value: string) => void; onStatus: (id: string, status: CookStatus) => Promise<void> }) {
    const selectedDocuments = selectedCook ? documents.filter((document) => document.cookId === selectedCook.id) : [];
    return <div className="cooks-workspace">
        <div className="admin-heading-row"><div><div className="admin-breadcrumb">Cooks <ChevronRight /> <strong>Manage Cooks</strong></div><h1>Manage Cooks</h1><p>Review registrations, verify documents and manage cook approvals.</p></div><button className="admin-primary-button"><Plus /> Add Cook</button></div>
        <div className="cook-stat-cards"><CookStat icon={UsersRound} label="Total Cooks" value={counts.all} tone="blue" /><CookStat icon={Soup} label="Pending Review" value={counts.pending} tone="amber" /><CookStat icon={Check} label="Approved" value={counts.approved} tone="green" /><CookStat icon={X} label="Rejected" value={counts.rejected} tone="red" /></div>
        <div className="cook-management-layout"><section className="cook-list-panel"><div className="cook-list-tabs"><button className="active">All ({counts.all})</button><button>Pending ({counts.pending})</button><button>Approved ({counts.approved})</button><button>Rejected ({counts.rejected})</button><label><Search /><input placeholder="Search cooks..." /></label><button className="filter-button"><Filter /> Filter</button></div><div className="cook-table-wrap"><table><thead><tr><th>Cook</th><th>Phone</th><th>Location</th><th>Experience</th><th>Submitted</th><th>Status</th><th>Documents</th><th>Actions</th></tr></thead><tbody>{cooks.map((cook) => { const cookDocs = documents.filter((document) => document.cookId === cook.id); return <tr key={cook.id} className={selectedCookId === cook.id ? "selected-row" : ""} onClick={() => onSelect(cook.id)}><td><strong>{cook.fullName}</strong></td><td>{cook.phone || "-"}</td><td>{cook.city || "-"}</td><td>{cook.experience || "-"}</td><td>{formatDate(cook.submittedAt)}</td><td><span className={`cook-status-pill ${cook.status}`}>{capitalize(cook.status)}</span></td><td>{cookDocs.length} uploaded</td><td><div className="cook-row-actions"><button className="cook-review-button" onClick={(event) => { event.stopPropagation(); onSelect(cook.id); }}>Review</button><button aria-label={`Actions for ${cook.fullName}`} onClick={(event) => { event.stopPropagation(); onMenu(openMenu === cook.id ? null : cook.id); }}><MoreHorizontal /></button>{openMenu === cook.id && <div className="cook-action-menu"><button onClick={() => void onStatus(cook.id, "approved")}><Check /> Approve Cook</button><button onClick={() => void onStatus(cook.id, "rejected")}><X /> Reject Cook</button></div>}</div></td></tr>; })}</tbody></table>{cooks.length === 0 && <p className="admin-table-message">No cooks found.</p>}</div></section>
            {selectedCook && <aside className="cook-review-panel"><div className="cook-review-header"><div><h2>Cook Review</h2><p>Review cook details and documents.</p></div><button aria-label="Close cook review" onClick={() => onSelect("")}><X /></button></div><ReviewBlock title="Profile Information"><Detail label="Full Name" value={selectedCook.fullName} /><Detail label="Phone" value={selectedCook.phone || "-"} /><Detail label="Date of Birth" value={selectedCook.dateOfBirth || "-"} /><Detail label="Gender" value={selectedCook.gender || "-"} /><Detail label="Cooking Experience" value={selectedCook.experience || "-"} /><Detail label="Cuisines" value={selectedCook.cuisines.join(", ") || "-"} /><Detail label="Languages" value={selectedCook.languages.join(", ") || "-"} /><Detail label="Service Radius" value={`${selectedCook.serviceRadius} km`} /></ReviewBlock><ReviewBlock title="Address"><Detail label="Flat / House No." value={selectedCook.address || "-"} /><Detail label="City" value={selectedCook.city || "-"} /><Detail label="Pincode" value={selectedCook.pincode || "-"} /><Detail label="Landmark" value={selectedCook.landmark || "-"} /></ReviewBlock><ReviewBlock title="Documents"><div className="cook-document-list">{selectedDocuments.length ? selectedDocuments.map((document) => <div key={document.id}><FileText /><span>{document.documentType.replace(/_/g, " ")}</span><b>{capitalize(document.status)}</b></div>) : <p>No documents uploaded.</p>}</div></ReviewBlock><div className="cook-review-reason"><label>Rejection Reason <small>(required if rejecting)</small><textarea value={rejectionReason} onChange={(event) => onReason(event.target.value)} placeholder="Enter reason for rejection..." /></label></div><div className="cook-review-actions"><button className="cook-reject-button" onClick={() => void onStatus(selectedCook.id, "rejected")}><X /> Reject</button><button className="cook-approve-button" onClick={() => void onStatus(selectedCook.id, "approved")}><Check /> Approve Cook</button></div></aside>}
        </div>
    </div>;
}

function CookStat({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: number; tone: string }) { return <div className={`cook-stat-card ${tone}`}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="cook-review-block"><h3>{title}</h3><div>{children}</div></section>; }
function Detail({ label, value }: { label: string; value: string }) { return <p className="cook-detail"><span>{label}</span><strong>{value}</strong></p>; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatDate(value: string) { return value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "-"; }

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
