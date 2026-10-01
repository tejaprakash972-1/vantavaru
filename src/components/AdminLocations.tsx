"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronRight, MapPin, MoreHorizontal, Plus, Search, UsersRound, X } from "lucide-react";
import RequestLoader from "@/components/RequestLoader";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type City = { id: string; name: string; is_active: boolean; sort_order: number };
type Area = { id: string; city_id: string; name: string; is_active: boolean; sort_order: number };
type Society = { id: string; area_id: string; name: string; pincode: string | null; address: string | null; is_active: boolean; sort_order: number };
type LocationKind = "city" | "area" | "society";
type Draft = { kind: LocationKind; id: string | null; cityId: string; areaId: string; name: string; pincode: string; address: string; sortOrder: number; isActive: boolean };
type RowMenu = { kind: LocationKind; id: string; top: number; left: number } | null;

function newDraft(kind: LocationKind, cityId: string, areaId: string): Draft {
    return { kind, id: null, cityId, areaId, name: "", pincode: "", address: "", sortOrder: 0, isActive: true };
}

export default function AdminLocations() {
    const supabase = getSupabaseBrowserClient();
    const [cities, setCities] = useState<City[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [societies, setSocieties] = useState<Society[]>([]);
    const [selectedCityId, setSelectedCityId] = useState("");
    const [selectedAreaId, setSelectedAreaId] = useState("");
    const [citySearch, setCitySearch] = useState("");
    const [areaSearch, setAreaSearch] = useState("");
    const [societySearch, setSocietySearch] = useState("");
    const [rowMenu, setRowMenu] = useState<RowMenu>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!supabase) {
                setError("Supabase is not configured.");
                setLoading(false);
                return;
            }
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                if (!cancelled) {
                    setError("Please sign in again to manage locations.");
                    setLoading(false);
                }
                return;
            }
            const result = await fetchLocations(session.access_token);
            if (cancelled) return;
            if (result.error) setError(result.error);
            setCities(result.cities);
            setAreas(result.areas);
            setSocieties(result.societies);
            setSelectedCityId(result.cities[0]?.id ?? "");
            setSelectedAreaId(result.areas.find((area) => area.city_id === result.cities[0]?.id)?.id ?? "");
            setLoading(false);
        }
        void load();
        return () => { cancelled = true; };
    }, [supabase]);

    const selectedCity = cities.find((city) => city.id === selectedCityId) ?? null;
    const cityAreas = areas.filter((area) => area.city_id === selectedCityId);
    const selectedArea = cityAreas.find((area) => area.id === selectedAreaId) ?? null;
    const filteredCities = useMemo(() => cities.filter((city) => city.name.toLowerCase().includes(citySearch.trim().toLowerCase())), [cities, citySearch]);
    const filteredAreas = useMemo(() => cityAreas.filter((area) => area.name.toLowerCase().includes(areaSearch.trim().toLowerCase())), [areaSearch, cityAreas]);
    const filteredSocieties = useMemo(() => societies.filter((society) => society.area_id === selectedAreaId && `${society.name} ${society.pincode ?? ""} ${society.address ?? ""}`.toLowerCase().includes(societySearch.trim().toLowerCase())), [societies, selectedAreaId, societySearch]);

    function create(kind: LocationKind) {
        setError("");
        setRowMenu(null);
        setDraft(newDraft(kind, selectedCityId, selectedAreaId));
    }

    function edit(kind: LocationKind, id: string) {
        const item = kind === "city" ? cities.find((city) => city.id === id) : kind === "area" ? areas.find((area) => area.id === id) : societies.find((society) => society.id === id);
        if (!item) return;
        const cityId = kind === "area" ? (item as Area).city_id : selectedCityId;
        const areaId = kind === "society" ? (item as Society).area_id : selectedAreaId;
        const base = newDraft(kind, kind === "city" ? "" : cityId, areaId);
        setDraft({ ...base, id, name: item.name, sortOrder: item.sort_order, isActive: item.is_active, ...(kind === "society" ? { pincode: (item as Society).pincode ?? "", address: (item as Society).address ?? "" } : {}) });
        setRowMenu(null);
        setError("");
    }

    async function reload() {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError("Please sign in again to manage locations.");
            return;
        }
        const result = await fetchLocations(session.access_token);
        if (result.error) {
            setError(result.error);
            return;
        }
        setCities(result.cities);
        setAreas(result.areas);
        setSocieties(result.societies);
        const cityId = result.cities.some((city) => city.id === selectedCityId) ? selectedCityId : result.cities[0]?.id ?? "";
        setSelectedCityId(cityId);
        setSelectedAreaId(result.areas.some((area) => area.id === selectedAreaId && area.city_id === cityId) ? selectedAreaId : result.areas.find((area) => area.city_id === cityId)?.id ?? "");
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!supabase || !draft) return;
        setSaving(true);
        setError("");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError("Please sign in again to manage locations.");
            setSaving(false);
            return;
        }
        const base = { name: draft.name.trim(), sort_order: draft.sortOrder, is_active: draft.isActive };
        const values = draft.kind === "city" ? base : draft.kind === "area" ? { ...base, city_id: draft.cityId } : { ...base, area_id: draft.areaId, pincode: draft.pincode.trim() || null, address: draft.address.trim() || null };
        const result = await fetch("/api/admin/locations", {
            method: draft.id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ kind: draft.kind, id: draft.id, values }),
        });
        const responseBody = await result.json();
        if (!result.ok) {
            setError(responseBody.error || "Unable to save location.");
            setSaving(false);
            return;
        }
        const message = `${capitalize(draft.kind)} ${draft.id ? "updated" : "added"}.`;
        setDraft(null);
        setNotice(message);
        await reload();
        setSaving(false);
    }

    async function setActive(kind: LocationKind, id: string, isActive: boolean) {
        if (!supabase) return;
        setSaving(true);
        setError("");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError("Please sign in again to manage locations.");
            setSaving(false);
            return;
        }
        const response = await fetch("/api/admin/locations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ kind, id, values: { is_active: !isActive } }),
        });
        const responseBody = await response.json();
        setRowMenu(null);
        if (!response.ok) {
            setError(responseBody.error || "Unable to update location status.");
            setSaving(false);
            return;
        }
        setNotice(`${capitalize(kind)} ${isActive ? "deactivated" : "activated"}.`);
        await reload();
        setSaving(false);
    }

    async function remove(kind: LocationKind, id: string) {
        if (!supabase || !window.confirm(`Delete this ${kind}? Linked records may prevent deletion.`)) return;
        setSaving(true);
        setError("");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError("Please sign in again to manage locations.");
            setSaving(false);
            return;
        }
        const response = await fetch("/api/admin/locations", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ kind, id }),
        });
        const responseBody = await response.json();
        setRowMenu(null);
        if (!response.ok) {
            setError(responseBody.error || "Unable to delete location.");
            setSaving(false);
            return;
        }
        setNotice(`${capitalize(kind)} deleted.`);
        await reload();
        setSaving(false);
    }

    function menu(kind: LocationKind, id: string, isActive: boolean) {
        const opened = rowMenu?.kind === kind && rowMenu.id === id;
        return <div className="location-row-menu"><button type="button" aria-label={`${capitalize(kind)} actions`} aria-expanded={opened} onClick={(event) => {
            event.stopPropagation();
            if (opened) {
                setRowMenu(null);
                return;
            }
            const bounds = event.currentTarget.getBoundingClientRect();
            const menuHeight = 104;
            const menuWidth = 148;
            const top = window.innerHeight - bounds.bottom >= menuHeight + 8 ? bounds.bottom + 4 : Math.max(8, bounds.top - menuHeight - 4);
            const left = Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8));
            setRowMenu({ kind, id, top, left });
        }}><MoreHorizontal /></button>{opened && createPortal(<div className="location-action-menu" style={{ top: rowMenu.top, left: rowMenu.left }} onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => edit(kind, id)}>Edit details</button><button type="button" onClick={() => void setActive(kind, id, isActive)}>{isActive ? "Deactivate" : "Activate"}</button><button type="button" className="location-delete-action" onClick={() => void remove(kind, id)}>Delete</button></div>, document.body)}</div>;
    }

    return <div className="locations-workspace">
        <div className="admin-heading-row locations-heading"><div><div className="admin-breadcrumb">Locations <ChevronRight /><strong>Manage Locations</strong></div><h1>Manage Locations</h1><p>Add and manage cities, areas, and societies used for booking and cook assignment.</p></div><div className="location-add-actions"><button className="admin-primary-button" onClick={() => create("city")}><Plus /> Add City</button><button className="location-secondary-add" onClick={() => create("area")} disabled={!selectedCityId}><Plus /> Area</button><button className="location-secondary-add" onClick={() => create("society")} disabled={!selectedAreaId}><Plus /> Society</button></div></div>

        <div className="location-stats"><LocationStat icon={Building2} label="Active Cities" value={cities.filter((city) => city.is_active).length} tone="blue" /><LocationStat icon={MapPin} label="Active Areas" value={areas.filter((area) => area.is_active).length} tone="green" /><LocationStat icon={UsersRound} label="Active Societies" value={societies.filter((society) => society.is_active).length} tone="purple" /></div>
        {error && <p className="location-error" role="alert">{error}</p>}
        {notice && <p className="location-notice" role="status">{notice}</p>}

        <div className="location-management-grid">
            <LocationList title={`Cities (${filteredCities.length})`} search={citySearch} onSearch={setCitySearch} placeholder="Search cities..." onAdd={() => create("city")} addLabel="Add City">
                {filteredCities.length === 0 ? <LocationEmpty label={citySearch ? "No matching cities." : "No cities added yet."} /> : <table><thead><tr><th>Name</th><th>Areas</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredCities.map((city) => <tr key={city.id} className={city.id === selectedCityId ? "location-selected-row" : ""} onClick={() => { setSelectedCityId(city.id); setSelectedAreaId(areas.find((area) => area.city_id === city.id)?.id ?? ""); }}><td><button type="button" className="location-name-button" onClick={(event) => { event.stopPropagation(); setSelectedCityId(city.id); setSelectedAreaId(areas.find((area) => area.city_id === city.id)?.id ?? ""); }}>{city.name}</button></td><td>{areas.filter((area) => area.city_id === city.id).length}</td><td><LocationStatus active={city.is_active} /></td><td>{menu("city", city.id, city.is_active)}</td></tr>)}</tbody></table>}
            </LocationList>
            <LocationList title={`Areas in ${selectedCity?.name ?? "City"} (${filteredAreas.length})`} search={areaSearch} onSearch={setAreaSearch} placeholder="Search areas..." onAdd={() => create("area")} addLabel="Add Area" disabled={!selectedCityId}>
                {filteredAreas.length === 0 ? <LocationEmpty label={areaSearch ? "No matching areas." : "No areas for this city yet."} /> : <table><thead><tr><th>Name</th><th>Societies</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredAreas.map((area) => <tr key={area.id} className={area.id === selectedAreaId ? "location-selected-row" : ""} onClick={() => setSelectedAreaId(area.id)}><td><button type="button" className="location-name-button" onClick={(event) => { event.stopPropagation(); setSelectedAreaId(area.id); }}>{area.name}</button></td><td>{societies.filter((society) => society.area_id === area.id).length}</td><td><LocationStatus active={area.is_active} /></td><td>{menu("area", area.id, area.is_active)}</td></tr>)}</tbody></table>}
            </LocationList>
            <LocationList title={`Societies in ${selectedArea?.name ?? "Area"} (${filteredSocieties.length})`} search={societySearch} onSearch={setSocietySearch} placeholder="Search societies..." onAdd={() => create("society")} addLabel="Add Society" disabled={!selectedAreaId}>
                {filteredSocieties.length === 0 ? <LocationEmpty label={societySearch ? "No matching societies." : "No societies for this area yet."} /> : <table><thead><tr><th>Name</th><th>Pincode</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredSocieties.map((society) => <tr key={society.id}><td><span className="location-table-name">{society.name}</span>{society.address && <small className="location-table-address">{society.address}</small>}</td><td>{society.pincode || "-"}</td><td><LocationStatus active={society.is_active} /></td><td>{menu("society", society.id, society.is_active)}</td></tr>)}</tbody></table>}
            </LocationList>
        </div>

        {draft && <div className="location-drawer-backdrop" role="presentation" onMouseDown={() => !saving && setDraft(null)}><form className="location-drawer" role="dialog" aria-modal="true" aria-labelledby="location-drawer-title" onSubmit={(event) => void save(event)} onMouseDown={(event) => event.stopPropagation()}>
            <header><h2 id="location-drawer-title">{draft.id ? "Edit" : "Add"} {capitalize(draft.kind)}</h2><button type="button" aria-label="Close" onClick={() => setDraft(null)}><X /></button></header>
            {draft.kind !== "city" && <label>City <em>*</em><select required value={draft.cityId} onChange={(event) => setDraft((current) => current ? { ...current, cityId: event.target.value, areaId: "" } : current)}><option value="">Select city</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>}
            {draft.kind === "society" && <label>Area <em>*</em><select required value={draft.areaId} onChange={(event) => setDraft((current) => current ? { ...current, areaId: event.target.value } : current)}><option value="">Select area</option>{areas.filter((area) => area.city_id === draft.cityId).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}
            <label>{draft.kind === "city" ? "City Name" : draft.kind === "area" ? "Area Name" : "Society Name"} <em>*</em><input required maxLength={120} value={draft.name} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} placeholder={`Enter ${draft.kind} name`} /></label>
            {draft.kind === "society" && <><label>Pincode<input inputMode="numeric" maxLength={10} value={draft.pincode} onChange={(event) => setDraft((current) => current ? { ...current, pincode: event.target.value.replace(/[^0-9-]/g, "") } : current)} placeholder="Enter pincode" /></label><label>Full Address<textarea rows={3} maxLength={500} value={draft.address} onChange={(event) => setDraft((current) => current ? { ...current, address: event.target.value } : current)} placeholder="Enter complete address" /></label></>}
            <label>Sort Order<input type="number" min={0} step={1} value={draft.sortOrder} onChange={(event) => setDraft((current) => current ? { ...current, sortOrder: Number(event.target.value) } : current)} /></label>
            <label className="location-active-toggle"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => current ? { ...current, isActive: event.target.checked } : current)} /><span><strong>Active</strong><small>Show this {draft.kind} to customers</small></span></label>
            {error && <p className="location-error" role="alert">{error}</p>}
            <footer><button type="button" className="location-cancel-button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button><button className="admin-primary-button" disabled={saving || (draft.kind === "area" && !draft.cityId) || (draft.kind === "society" && (!draft.cityId || !draft.areaId))} type="submit">{saving ? "Saving..." : `Save ${capitalize(draft.kind)}`}</button></footer>
        </form></div>}
        {(loading || saving) && <RequestLoader message={loading ? "Loading locations..." : "Saving location..."} />}
    </div>;
}

async function fetchLocations(accessToken: string) {
    const response = await fetch("/api/admin/locations", { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();
    return {
        cities: (body.cities ?? []) as City[],
        areas: (body.areas ?? []) as Area[],
        societies: (body.societies ?? []) as Society[],
        error: response.ok ? "" : body.error || "Unable to load locations.",
    };
}

function LocationList({ title, search, onSearch, placeholder, onAdd, addLabel, disabled = false, children }: { title: string; search: string; onSearch: (value: string) => void; placeholder: string; onAdd: () => void; addLabel: string; disabled?: boolean; children: ReactNode }) {
    return <section className="location-list-panel"><header><h2>{title}</h2><button className="location-panel-add" disabled={disabled} onClick={onAdd}><Plus /> {addLabel}</button></header><label className="location-search"><Search /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />{search && <button type="button" aria-label="Clear search" onClick={() => onSearch("")}><X /></button>}</label><div className="location-table-wrap">{children}</div></section>;
}

function LocationStat({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: number; tone: string }) {
    return <article className={`location-stat ${tone}`}><span><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function LocationStatus({ active }: { active: boolean }) {
    return <span className={`location-status ${active ? "active" : "inactive"}`}>{active ? "Active" : "Inactive"}</span>;
}

function LocationEmpty({ label }: { label: string }) {
    return <div className="location-empty"><MapPin /><span>{label}</span></div>;
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}