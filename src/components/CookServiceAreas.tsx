"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type City = { id: string; name: string };
type Area = { id: string; city_id: string; name: string };
type Society = { id: string; area_id: string; name: string };

export default function CookServiceAreas() {
    const supabase = getSupabaseBrowserClient();
    const [cities, setCities] = useState<City[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [societies, setSocieties] = useState<Society[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [cityId, setCityId] = useState("");
    const [areaId, setAreaId] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!supabase) {
                setError("Service areas are unavailable.");
                setLoading(false);
                return;
            }
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error("Please sign in to manage service areas.");
                const response = await fetch("/api/cook/service-areas", { headers: { Authorization: `Bearer ${session.access_token}` } });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Unable to load service areas.");
                if (!cancelled) {
                    setCities(result.cities ?? []);
                    setAreas(result.areas ?? []);
                    setSocieties(result.societies ?? []);
                    setSelectedIds(result.selectedIds ?? []);
                    setSavedIds(result.selectedIds ?? []);
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load service areas.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [supabase]);

    const areaById = new Map(areas.map((area) => [area.id, area]));
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const visible = societies.filter((society) => {
        const area = areaById.get(society.area_id);
        const city = area ? cityById.get(area.city_id) : undefined;
        return Boolean(area && city) && (!cityId || city?.id === cityId) && (!areaId || area?.id === areaId)
            && `${society.name} ${area?.name} ${city?.name}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    const selectedSet = new Set(selectedIds);
    const savedSet = new Set(savedIds);
    const hasChanges = selectedIds.length !== savedIds.length || selectedIds.some((id) => !savedSet.has(id));

    function toggle(id: string) {
        setNotice("");
        setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    }

    function toggleVisible() {
        setNotice("");
        const allSelected = visible.length > 0 && visible.every((society) => selectedSet.has(society.id));
        setSelectedIds((current) => allSelected ? current.filter((id) => !visible.some((society) => society.id === id)) : [...new Set([...current, ...visible.map((society) => society.id)])]);
    }

    async function save() {
        if (!supabase || saving) return;
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Please sign in again to save service areas.");
            const response = await fetch("/api/cook/service-areas", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ societyIds: selectedIds }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to save service areas.");
            setSavedIds(result.selectedIds);
            setNotice("Service areas saved.");
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Unable to save service areas.");
        } finally {
            setSaving(false);
        }
    }

    return <section className="cook-service-areas" aria-labelledby="cook-service-areas-title">
        <div className="cook-service-heading"><div><h2 id="cook-service-areas-title">Service Areas</h2><p>Select the societies where you can accept cooking requests.</p></div><span>{selectedIds.length} selected</span></div>
        {loading ? <div className="cook-service-state" role="status"><LoaderCircle className="booking-loading-spinner" /> Loading service areas...</div> : <>
            <div className="cook-service-saved"><strong>Selected service areas</strong>{selectedIds.length ? <div>{selectedIds.map((id) => { const society = societies.find((item) => item.id === id); const area = society ? areaById.get(society.area_id) : undefined; return <span key={id}><MapPin /> {society ? `${society.name}${area ? `, ${area.name}` : ""}` : "Unavailable society"}<button type="button" onClick={() => toggle(id)} aria-label={`Remove ${society?.name ?? "unavailable society"}`}><X /></button></span>; })}</div> : <p>No service areas selected yet.</p>}</div>
            <div className="cook-service-filters"><label><Search /><input aria-label="Search societies" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search societies or areas" /></label><select aria-label="Filter by city" value={cityId} onChange={(event) => { setCityId(event.target.value); setAreaId(""); }}><option value="">All cities</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select><select aria-label="Filter by area" value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">All areas</option>{areas.filter((area) => !cityId || area.city_id === cityId).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
            <div className="cook-service-select-all"><button type="button" onClick={toggleVisible} disabled={!visible.length}>{visible.length && visible.every((society) => selectedSet.has(society.id)) ? "Clear visible" : "Select all visible"}</button><span>{visible.length} available</span></div>
            <div className="cook-service-list">{visible.length ? visible.map((society) => { const area = areaById.get(society.area_id); const city = area ? cityById.get(area.city_id) : undefined; return <label key={society.id} className={selectedSet.has(society.id) ? "selected" : ""}><input type="checkbox" checked={selectedSet.has(society.id)} onChange={() => toggle(society.id)} /><span><strong>{society.name}</strong><small>{area?.name}, {city?.name}</small></span>{selectedSet.has(society.id) && <Check aria-hidden="true" />}</label>; }) : <p>No societies match these filters.</p>}</div>
            {error && <p className="cook-service-error" role="alert">{error}</p>}{notice && <p className="cook-service-success" role="status">{notice}</p>}
            <div className="cook-service-actions"><button type="button" onClick={() => void save()} disabled={!hasChanges || saving}>{saving ? "Saving..." : "Save service areas"}</button></div>
        </>}
    </section>;
}