"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Gift, Heart, House, Mail, MapPin, Phone, ShieldCheck, UserRound, Utensils } from "lucide-react";

const cities = ["Hyderabad", "Bengaluru", "Chennai", "Mumbai", "Pune"];

export default function RegisterCustomerPage() {
    const router = useRouter();
    const [countryCode, setCountryCode] = useState("+91");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [created, setCreated] = useState(false);

    function createAccount(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCreated(true);
    }

    return (
        <main className="customer-register-page">
            <header className="customer-register-header">
                <button className="customer-back-button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>
                <div className="customer-brand"><div className="customer-brand-mark"><House /><span>♥</span></div><strong>Vantavaru</strong></div>
                <span aria-hidden="true" />
            </header>

            <section className="customer-intro"><h1>Create Your Account</h1><p>Join Vantavaru to discover home-cooked meals<br />from trusted cooks near you</p></section>

            <section className="customer-benefits" aria-label="Vantavaru benefits"><Benefit icon={Utensils} title="Authentic" detail="home-cooked meals" /><Benefit icon={ShieldCheck} title="Trusted" detail="home cooks" /><Benefit icon={Heart} title="Support" detail="local talent" /></section>

            <form className="customer-form" onSubmit={createAccount}>
                <label className="customer-field-label">Full Name <em>*</em><span className="customer-input"><UserRound /><input required placeholder="Enter your full name" /></span></label>
                <label className="customer-field-label">Phone Number <em>*</em><span className="customer-input"><Phone /><span className="customer-country"><select aria-label="Country code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}><option>+91</option><option>+1</option><option>+44</option></select><ChevronDown /></span><i /><input required aria-label="Phone number" type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="Enter your phone number" /></span><small>We will send a one-time password (OTP) to verify your number.</small></label>
                <label className="customer-field-label">Email <small>(Optional)</small><span className="customer-input"><Mail /><input type="email" placeholder="Enter your email address" /></span><small>We&apos;ll use this for important updates about your orders.</small></label>
                <label className="customer-field-label">City <em>*</em><span className="customer-input"><MapPin /><select required value={city} onChange={(event) => setCity(event.target.value)}><option value="">Select your city</option>{cities.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown /></span></label>
                <label className="terms-checkbox"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>{termsAccepted ? <Check /> : null}</span><p>I agree to the <u>Terms &amp; Conditions</u> and <u>Privacy Policy</u></p></label>
                <button className="customer-create-button" disabled={!termsAccepted}>{created ? "Account Created" : "Create Account"}</button>
                {created && <p className="customer-success" role="status">Welcome to Vantavaru. Your account is ready.</p>}
            </form>
            <p className="customer-login-link">Already have an account? <button onClick={() => router.push("/login")}>Log In</button></p>
        </main>
    );
}

function Benefit({ icon: Icon, title, detail }: { icon: typeof Utensils; title: string; detail: string }) {
    return <div className="customer-benefit"><span><Icon /></span><p><strong>{title}</strong><small>{detail}</small></p></div>;
}
