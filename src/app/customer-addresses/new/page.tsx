"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, ChevronDown, House, MapPin, Navigation, Plus, ShieldCheck } from "lucide-react";
import RequestLoader from "@/components/RequestLoader";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type City = { id: string; name: string; sort_order: number };
type Area = { id: string; city_id: string; name: string; sort_order: number };
type Society = { id: string; area_id: string; name: string; pincode: string | null; address: string | null; sort_order: number };

const addressTypes = ["Home", "Parents", "Office", "Other"];

export default function AddCustomerAddressPage() {
    const router = useRouter();
    const supabase = getSupabaseBrowserClient();
    const [cities, setCities] = useState<City[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [societies, setSocieties] = useState<Society[]>([]);
    const [cityId, setCityId] = useState("");
    const [areaId, setAreaId] = useState("");
    const [societyId, setSocietyId] = useState("");
    const [label, setLabel] = useState("Home");
    const [flatNumber, setFlatNumber] = useState("");
    const [towerBlock, setTowerBlock] = useState("");
    const [addressLine, setAddressLine] = useState("");
    const [landmark, setLandmark] = useState("");
    const [isDefault, setIsDefault] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function loadLocations() {
            if (!supabase) {
                setError("Address setup is unavailable because Supabase is not configured.");
                setLoading(false);
                return;
            }
            const [cityResult, areaResult, societyResult] = await Promise.all([
                supabase.from("cities").select("id, name, sort_order").eq("is_active", true).order("sort_order").order("name"),
                supabase.from("areas").select("id, city_id, name, sort_order").eq("is_active", true).order("sort_order").order("name"),
                supabase.from("societies").select("id, area_id, name, pincode, address, sort_order").eq("is_active", true).order("sort_order").order("name"),
            ]);
            if (cancelled) return;
            const firstError = cityResult.error || areaResult.error || societyResult.error;
            if (firstError) setError(firstError.message);
            const loadedCities = (cityResult.data ?? []) as City[];
            setCities(loadedCities);
            setAreas((areaResult.data ?? []) as Area[]);
            setSocieties((societyResult.data ?? []) as Society[]);
            setCityId(loadedCities[0]?.id ?? "");
            setLoading(false);
        }
        void loadLocations();
        return () => { cancelled = true; };
    }, [supabase]);

    const availableAreas = useMemo(() => areas.filter((area) => area.city_id === cityId), [areas, cityId]);
    const availableSocieties = useMemo(() => societies.filter((society) => society.area_id === areaId), [areaId, societies]);

    function changeCity(value: string) {
        setCityId(value);
        const firstArea = areas.filter((area) => area.city_id === value).sort((a, b) => a.sort_order - b.sort_order)[0];
        const firstSociety = societies.filter((society) => society.area_id === firstArea?.id).sort((a, b) => a.sort_order - b.sort_order)[0];
        setAreaId(firstArea?.id ?? "");
        setSocietyId(firstSociety?.id ?? "");
    }

    function changeArea(value: string) {
        setAreaId(value);
        const firstSociety = societies.filter((society) => society.area_id === value).sort((a, b) => a.sort_order - b.sort_order)[0];
        setSocietyId(firstSociety?.id ?? "");
    }

    async function saveAddress(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (!supabase) {
            setError("Address setup is unavailable because Supabase is not configured.");
            return;
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            setError("Please sign in again to save your address.");
            return;
        }
        if (!societyId) {
            setError("Choose the society for this address.");
            return;
        }

        setSaving(true);
        const { data: savedAddress, error: insertError } = await supabase.from("customer_addresses").insert({
            user_id: user.id,
            society_id: societyId,
            label,
            flat_number: flatNumber.trim(),
            tower_block: towerBlock.trim(),
            address_line: addressLine.trim(),
            landmark: landmark.trim() || null,
            is_default: false,
            is_active: true,
        }).select("id").single();

        if (insertError || !savedAddress) {
            setError(insertError?.message || "Unable to save this address.");
            setSaving(false);
            return;
        }

        if (isDefault) {
            const { error: clearDefaultError } = await supabase.from("customer_addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true).eq("is_active", true);
            if (clearDefaultError) {
                await supabase.from("customer_addresses").delete().eq("id", savedAddress.id).eq("user_id", user.id);
                setError(clearDefaultError.message);
                setSaving(false);
                return;
            }
            const { error: setDefaultError } = await supabase.from("customer_addresses").update({ is_default: true }).eq("id", savedAddress.id).eq("user_id", user.id);
            if (setDefaultError) {
                setError(setDefaultError.message);
                setSaving(false);
                return;
            }
        }

        setSaving(false);
        router.replace("/");
    }

    if (loading) return <RequestLoader message="Loading address locations..." />;

    return <main className="customer-address-page">
        <header className="customer-address-header">
            <button className="customer-back-button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>
            <div className="customer-brand"><div className="customer-brand-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div>
            <span aria-hidden="true" />
        </header>

        <section className="customer-address-intro"><span><MapPin /></span><div><p className="customer-address-eyebrow">DELIVERY LOCATION</p><h1>Add an address</h1><p>Save the place where you want your cook to arrive.</p></div></section>

        <form className="customer-address-form" onSubmit={saveAddress}>
            <fieldset className="address-type-field"><legend>Address type <em>*</em></legend><div>{addressTypes.map((type) => <button type="button" key={type} className={label === type ? "selected" : ""} onClick={() => setLabel(type)}>{type}</button>)}</div></fieldset>

            <section className="customer-address-group"><h2>Location</h2>
                <AddressSelect label="City" required value={cityId} onChange={changeCity} options={cities.map((city) => ({ value: city.id, label: city.name }))} placeholder="Select city" icon="city" />
                <AddressSelect label="Area" required value={areaId} onChange={changeArea} options={availableAreas.map((area) => ({ value: area.id, label: area.name }))} placeholder="Select area" icon="area" disabled={!cityId} />
                <AddressSelect label="Society" required value={societyId} onChange={setSocietyId} options={availableSocieties.map((society) => ({ value: society.id, label: society.name }))} placeholder="Select society" icon="society" disabled={!areaId} />
                {societyId && <small className="customer-address-location-note">{[availableSocieties.find((society) => society.id === societyId)?.address, availableSocieties.find((society) => society.id === societyId)?.pincode].filter(Boolean).join(" · ")}</small>}
            </section>

            <section className="customer-address-group"><h2>Address details</h2>
                <label className="customer-address-label">Flat number <em>*</em><span className="customer-address-input"><Building2 /><input required maxLength={40} value={flatNumber} onChange={(event) => setFlatNumber(event.target.value)} placeholder="e.g. Flat 1204" /></span></label>
                <label className="customer-address-label">Block / Tower <em>*</em><span className="customer-address-input"><Building2 /><input required maxLength={60} value={towerBlock} onChange={(event) => setTowerBlock(event.target.value)} placeholder="e.g. Block B or Tower 2" /></span></label>
                <label className="customer-address-label">Address line <em>*</em><span className="customer-address-input customer-address-textarea"><MapPin /><textarea required rows={3} maxLength={300} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} placeholder="Street, entrance, or directions within the society" /></span></label>
                <label className="customer-address-label">Landmark <small>(Optional)</small><span className="customer-address-input"><Navigation /><input maxLength={120} value={landmark} onChange={(event) => setLandmark(event.target.value)} placeholder="Nearby landmark" /></span></label>
            </section>

            <label className="customer-default-address"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><span className="customer-default-switch" aria-hidden="true" /><span><strong>Set as default address</strong><small>Use this address first for future bookings</small></span></label>
            {error && <p className="customer-address-error" role="alert">{error}</p>}
            <button className="customer-address-save" type="submit" disabled={saving || !cities.length || !availableAreas.length || !availableSocieties.length}>{saving ? "Saving address..." : <><Check /> Save Address</>}</button>
        </form>
        {saving && <RequestLoader message="Saving your address..." />}
    </main>;
}

function AddressSelect({ label, required, value, onChange, options, placeholder, disabled = false, icon }: { label: string; required: boolean; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder: string; disabled?: boolean; icon: "city" | "area" | "society" }) {
    const Icon = icon === "city" ? Building2 : icon === "area" ? MapPin : House;
    return <label className="customer-address-label">{label}{required && <em> *</em>}<span className="customer-address-input"><Icon /><select required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{options.length ? placeholder : `No ${label.toLowerCase()}s available`}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown /></span></label>;
}
