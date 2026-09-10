"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Camera,
    ChefHat,
    Building2,
    ChevronDown,
    CheckCircle2,
    Edit3,
    FileText,
    IdCard,
    Info,
    Languages,
    MapPin,
    Navigation,
    Phone,
    UserRound,
    Route,
    Utensils,
} from "lucide-react";

const cuisines = ["South Indian", "North Indian", "Chinese", "Continental", "Baking"];
const languages = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];

export default function RegisterCookPage() {
    const router = useRouter();
    const [cuisinesSelected, setCuisinesSelected] = useState<string[]>([]);
    const [languagesSelected, setLanguagesSelected] = useState<string[]>([]);
    const [experience, setExperience] = useState("");
    const [gender, setGender] = useState("Female");
    const [phoneNumber, setPhoneNumber] = useState("9876543210");
    const [photoName, setPhotoName] = useState("");
    const [saved, setSaved] = useState(false);
    const [step, setStep] = useState(1);
    const [address, setAddress] = useState({ house: "", street: "", city: "", pincode: "", landmark: "" });
    const [documents, setDocuments] = useState({ profile: "", aadhaarFront: "", aadhaarBack: "", additional: "" });

    return (
        <main className="cook-register-page">
            <header className="cook-register-header">
                <button className="cook-back-button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>
                <div className="cook-register-brand"><div className="cook-register-mark"><HouseMark /><span>♥</span></div><strong>Vantavaru</strong></div>
                <span className="cook-header-spacer" aria-hidden="true" />
            </header>

            <section className="cook-register-intro"><h1>Register as a Cook</h1><p>Tell us about yourself and start cooking with Vantavaru.</p></section>

            <nav className="cook-progress" aria-label="Registration progress">
                {["Basic Details", "Address", "Documents", "Review"].map((label, index) => <div className={index <= step - 1 ? "progress-step active" : "progress-step"} key={label}><span>{index < step - 1 ? "✓" : index + 1}</span><strong>{label}</strong></div>)}
            </nav>

            <form className="cook-form" onSubmit={(event) => { event.preventDefault(); if (step < 4) setStep((current) => current + 1); else router.push("/cook-home"); }}>
                {step === 1 ? <>
                    <div className="cook-section-heading"><h2>Basic Details</h2><span>Step 1 of 4</span></div>

                    <label className="cook-field-label">Full Name <em>*</em><span className="cook-input"><UserRound /><input required placeholder="Enter your full name" /></span></label>
                    <label className="cook-field-label">Phone Number <em>*</em><span className="cook-input cook-input-muted"><Phone /><span className="phone-prefix">+91</span><input required aria-label="Phone number" type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, ""))} /></span><small>This will be used for login and communication.</small></label>
                    <label className="cook-field-label">Date of Birth <em>*</em><span className="cook-input"><CalendarDays /><input required type="date" aria-label="Date of birth" /></span></label>

                    <fieldset className="gender-field"><legend>Gender <em>*</em></legend><div className="gender-options">{["Female", "Male", "Other"].map((item) => <label key={item}><input type="radio" name="gender" checked={gender === item} onChange={() => setGender(item)} /><span className="radio-dot" />{item}</label>)}</div></fieldset>

                    <div className="cook-two-column">
                        <label className="cook-field-label">Cooking Experience <em>*</em><span className="cook-input select-input"><ChefHat /><select required value={experience} onChange={(event) => setExperience(event.target.value)}><option value="">Select experience</option><option>Less than 1 year</option><option>1–3 years</option><option>3–5 years</option><option>5+ years</option></select><ChevronDown /></span></label>
                        <MultiSelect label="Cuisines You Cook" icon={Utensils} placeholder="Select cuisines" options={cuisines} selected={cuisinesSelected} onChange={setCuisinesSelected} />
                    </div>

                    <MultiSelect label="Languages Spoken" icon={Languages} placeholder="Select languages" options={languages} selected={languagesSelected} onChange={setLanguagesSelected} />

                    <div className="photo-section"><label className="cook-field-label">Profile Photo <em>*</em></label><div className="photo-row"><label className="upload-photo"><Camera /><strong>{photoName || "Upload Photo"}</strong><small>JPG, PNG (Max 5 MB)</small><input type="file" accept="image/png,image/jpeg" required={!photoName} onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")} /></label><div className="photo-tips"><strong>Use a clear photo</strong><span>✓ &nbsp; Your face should be clearly visible</span><span>✓ &nbsp; Good lighting helps build trust</span><span>✓ &nbsp; This photo will be visible to customers</span></div></div></div>

                    <button className="cook-continue-button" type="submit">{saved ? "Details Saved" : "Save & Continue"} <ArrowRight /></button>
                    {saved && <p className="cook-saved-message" role="status">Your basic details are saved. Next: address.</p>}
                </> : step === 2 ? <AddressStep address={address} setAddress={setAddress} onBack={() => setStep(1)} /> : step === 3 ? <DocumentsStep documents={documents} setDocuments={setDocuments} onBack={() => setStep(2)} saved={saved} /> : <CookReview address={address} documents={documents} cuisines={cuisinesSelected} languages={languagesSelected} onBack={() => setStep(3)} onEdit={(section) => setStep(section)} saved={saved} />}
            </form>
        </main>
    );
}

function HouseMark() {
    return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 22 24 7l18 15M11 20v21h26V20M18 41V28h12v13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /><path d="M20 18c0-3 4-4 4-1 0-3 4-2 4 1 0 3-4 6-4 6s-4-3-4-6Z" fill="#eb5725" stroke="#eb5725" /></svg>;
}

function AddressStep({ address, setAddress, onBack }: { address: { house: string; street: string; city: string; pincode: string; landmark: string }; setAddress: (value: { house: string; street: string; city: string; pincode: string; landmark: string }) => void; onBack: () => void }) {
    const update = (key: keyof typeof address, value: string) => setAddress({ ...address, [key]: value });

    return <>
        <div className="address-callout"><span><MapPin /></span><div><strong>Your Address</strong><p>This helps us show you to nearby customers.</p></div></div>
        <div className="cook-section-heading"><h2>Address Details</h2><span>Step 2 of 4</span></div>
        <label className="cook-field-label">House / Flat No. <em>*</em><span className="cook-input"><Building2 /><input required value={address.house} onChange={(event) => update("house", event.target.value)} placeholder="Enter house or flat number" /></span></label>
        <label className="cook-field-label">Street / Area / Locality <em>*</em><span className="cook-input"><Route /><input required value={address.street} onChange={(event) => update("street", event.target.value)} placeholder="Enter street, area or locality" /></span></label>
        <div className="address-two-column"><label className="cook-field-label">City <em>*</em><span className="cook-input select-input"><Building2 /><select required value={address.city} onChange={(event) => update("city", event.target.value)}><option value="">Select city</option><option>Hyderabad</option><option>Bengaluru</option><option>Chennai</option><option>Mumbai</option></select><ChevronDown /></span></label><label className="cook-field-label">Pincode <em>*</em><span className="cook-input"><MapPin /><input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" value={address.pincode} onChange={(event) => update("pincode", event.target.value.replace(/\D/g, ""))} placeholder="Enter pincode" /></span></label></div>
        <label className="cook-field-label">Landmark <small>(Optional)</small><span className="cook-input"><Navigation /><input value={address.landmark} onChange={(event) => update("landmark", event.target.value)} placeholder="e.g. Near Metro Station, City Mall" /></span></label>
        <div className="service-area-callout"><span><Navigation /></span><div><strong>Service Area</strong><p>We will show your profile to customers in and around this location.</p></div></div>
        <div className="address-actions"><button type="button" className="address-back-button" onClick={onBack}><ArrowLeft /> Back</button><button className="cook-continue-button" type="submit">Save &amp; Continue <ArrowRight /></button></div>
    </>;
}

function DocumentsStep({ documents, setDocuments, onBack, saved }: { documents: { profile: string; aadhaarFront: string; aadhaarBack: string; additional: string }; setDocuments: (value: { profile: string; aadhaarFront: string; aadhaarBack: string; additional: string }) => void; onBack: () => void; saved: boolean }) {
    const updateFile = (key: keyof typeof documents, file: File | undefined) => setDocuments({ ...documents, [key]: file?.name || "" });

    return <>
        <div className="cook-section-heading"><div><h2>Upload Documents</h2><p className="documents-subtitle">These documents help us verify your identity and keep our community safe.</p></div><span>Step 3 of 4</span></div>
        <DocumentCard title="Profile Photo" description="Upload a clear photo of yourself" required fileName={documents.profile} icon={Camera} accept="image/png,image/jpeg" onChange={(file) => updateFile("profile", file)} tipsTitle="Photo Guidelines" tips={["Your face should be clearly visible", "Use good lighting", "Avoid blurred or cropped photos", "This photo will be visible to customers"]} />
        <DocumentCard title="Aadhaar Card" description="Upload a clear copy of your Aadhaar card (front and back)" required fileName={documents.aadhaarFront && documents.aadhaarBack ? "2 files selected" : ""} icon={IdCard} accept="image/png,image/jpeg,application/pdf" onChange={(file) => updateFile("aadhaarFront", file)} secondaryFileName={documents.aadhaarBack} onSecondaryChange={(file) => updateFile("aadhaarBack", file)} tipsTitle="Aadhaar Guidelines" tips={["Image should be clear and readable", "All corners should be visible", "File size should be less than 5 MB", "We use this only for verification purposes"]} />
        <DocumentCard title="Additional ID" description="You can upload PAN card, Driving license or Voter ID" fileName={documents.additional} icon={FileText} accept="image/png,image/jpeg,application/pdf" onChange={(file) => updateFile("additional", file)} tipsTitle="Accepted Documents" tips={["PAN Card", "Driving License", "Voter ID", "This helps us with additional verification (optional)."]} />
        <div className="address-actions"><button type="button" className="address-back-button" onClick={onBack}><ArrowLeft /> Back</button><button className="cook-continue-button" type="submit">{saved ? "Documents Saved" : "Save & Continue"} <ArrowRight /></button></div>
    </>;
}

function CookReview({ address, documents, cuisines, languages, onBack, onEdit, saved }: { address: { house: string; street: string; city: string; pincode: string; landmark: string }; documents: { profile: string; aadhaarFront: string; aadhaarBack: string; additional: string }; cuisines: string[]; languages: string[]; onBack: () => void; onEdit: (section: 1 | 2 | 3) => void; saved: boolean }) {
    const edit = (section: 1 | 2 | 3) => (event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); onEdit(section); };
    return <>
        <div className="review-step-heading"><div><h2>Review your details</h2><p>Review your details before submitting your application.</p></div><span>Step 4 of 4</span></div>
        <ReviewSection icon={UserRound} title="Basic Details" onEdit={edit(1)}><ReviewRow label="Name" value="Your full name" /><ReviewRow label="Phone Number" value={`+91 ${"98765 43210"}`} /><ReviewRow label="Date of Birth" value="Not provided" /><ReviewRow label="Gender" value="Female" /><ReviewRow label="Cooking Experience" value="Selected experience" /><ReviewRow label="Cuisines" value={cuisines.length ? cuisines.join(", ") : "Not selected"} /><ReviewRow label="Languages Spoken" value={languages.length ? languages.join(", ") : "Not selected"} /></ReviewSection>
        <ReviewSection icon={MapPin} title="Address" onEdit={edit(2)}><ReviewRow label="House / Flat No." value={address.house || "Not provided"} /><ReviewRow label="Street / Area / Locality" value={address.street || "Not provided"} /><ReviewRow label="City" value={address.city || "Not selected"} /><ReviewRow label="Pincode" value={address.pincode || "Not provided"} /><ReviewRow label="Landmark" value={address.landmark || "Not provided"} /><ReviewRow label="Service Area" value="Within 5 km" /></ReviewSection>
        <ReviewSection icon={FileText} title="Documents" onEdit={edit(3)}><div className="review-document-grid"><ReviewDocument title="Profile Photo" value={documents.profile || "Not uploaded"} icon={Camera} /><ReviewDocument title="Aadhaar Card" value={documents.aadhaarFront && documents.aadhaarBack ? "Front & Back Uploaded" : "Not uploaded"} icon={IdCard} /><ReviewDocument title="Additional ID" value={documents.additional ? "Uploaded" : "Optional"} icon={FileText} /></div></ReviewSection>
        <div className="review-verification-note"><Info /><span>Your details will be verified by our team. We&apos;ll notify you once your account is approved.</span></div>
        <div className="address-actions"><button type="button" className="address-back-button" onClick={onBack}><ArrowLeft /> Back</button><button className="cook-continue-button" type="submit">{saved ? "Application Submitted" : "Submit Application"} <ArrowRight /></button></div>
        <p className="terms-note">By submitting, you agree to our <u>Terms &amp; Conditions</u></p>
    </>;
}

function ReviewSection({ icon: Icon, title, onEdit, children }: { icon: ComponentType<{ size?: number; className?: string }>; title: string; onEdit: (event: MouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
    return <section className="review-register-card"><header><span className="review-section-icon"><Icon /></span><h3>{title}</h3><button type="button" onClick={onEdit}><Edit3 /> Edit</button></header><div className="review-register-content">{children}</div></section>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return <div className="review-register-row"><span>{label}</span><strong>{value}</strong></div>;
}

function ReviewDocument({ title, value, icon: Icon }: { title: string; value: string; icon: ComponentType<{ size?: number; className?: string }> }) {
    return <div className="review-document"><span><Icon /></span><strong>{title}</strong><small>{value}</small></div>;
}

function DocumentCard({ title, description, required: requiredField = false, fileName, secondaryFileName, icon: Icon, accept, onChange, onSecondaryChange, tipsTitle, tips }: { title: string; description: string; required?: boolean; fileName: string; secondaryFileName?: string; icon: ComponentType<{ size?: number; className?: string }>; accept: string; onChange: (file: File | undefined) => void; onSecondaryChange?: (file: File | undefined) => void; tipsTitle: string; tips: string[] }) {
    return <section className="document-card"><div className="document-card-heading"><h3>{title} {requiredField && <em>*</em>}</h3><p>{description}</p></div><div className={secondaryFileName !== undefined ? "document-upload-row document-upload-row-aadhaar" : "document-upload-row"}><UploadBox title={secondaryFileName !== undefined ? "Upload Front Side" : "Tap to upload photo"} fileName={fileName} icon={Icon} accept={accept} required={requiredField} onChange={onChange} /><>{secondaryFileName !== undefined && onSecondaryChange && <UploadBox title="Upload Back Side" fileName={secondaryFileName} icon={IdCard} accept={accept} required onChange={onSecondaryChange} />}</><div className="document-tips"><strong>{tipsTitle}</strong>{tips.map((tip) => <span key={tip}><CheckCircle2 /> {tip}</span>)}</div></div></section>;
}

function UploadBox({ title, fileName, icon: Icon, accept, required = false, onChange }: { title: string; fileName: string; icon: ComponentType<{ size?: number; className?: string }>; accept: string; required?: boolean; onChange: (file: File | undefined) => void }) {
    return <label className="document-upload-box"><Icon /><strong>{fileName || title}</strong><small>{fileName ? "File selected" : "JPG, PNG, PDF (Max 5 MB)"}</small><input type="file" accept={accept} required={required && !fileName} onChange={(event) => onChange(event.target.files?.[0])} /></label>;
}

function MultiSelect({ label, icon: Icon, placeholder, options, selected, onChange }: { label: string; icon: ComponentType<{ size?: number; className?: string }>; placeholder: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
    const [open, setOpen] = useState(false);
    const summary = selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selected`;

    function toggleOption(option: string) {
        onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
    }

    return <div className="cook-field-label multi-select-field"><span>{label} <em>*</em></span><button type="button" className={`cook-input select-input multi-select-trigger ${open ? "multi-select-open" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}><Icon /><span className={selected.length === 0 ? "select-placeholder" : ""}>{summary}</span><ChevronDown /></button>{open && <div className="multi-select-menu">{options.map((option) => <label className="multi-select-option" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggleOption(option)} /><span className="multi-select-check">{selected.includes(option) ? "✓" : ""}</span>{option}</label>)}<button type="button" className="multi-select-done" onClick={() => setOpen(false)}>Done</button></div>}<small>You can select multiple</small></div>;
}
