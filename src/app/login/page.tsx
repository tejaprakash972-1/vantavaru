"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChefHat, ChevronDown, House, ShieldCheck, UserRound, Utensils } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthenticatedRoute } from "@/lib/auth/routing";

export default function LoginPage() {
    const router = useRouter();
    const supabase = getSupabaseBrowserClient();
    const [authResolved, setAuthResolved] = useState(() => !supabase);
    const [countryCode, setCountryCode] = useState("+91");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");
    const [signupType, setSignupType] = useState<"customer" | "cook" | "">("");
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        void getAuthenticatedRoute().then((destination) => {
            if (destination) {
                router.replace(destination);
            } else {
                setAuthResolved(true);
            }
        });
    }, [router]);

    if (!authResolved) {
        return <main className="auth-route-loading" aria-label="Checking your account" />;
    }

    async function sendOtp() {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10) {
            setMessage("Enter a valid 10-digit phone number.");
            return;
        }

        const formattedPhone = `${countryCode}${digits}`;
        const supabase = getSupabaseBrowserClient();

        if (supabase) {
            setIsSending(true);
            const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
            setIsSending(false);
            if (error) {
                setMessage(error.message);
                return;
            }
        }

        router.replace(`/otp?phone=${encodeURIComponent(`${countryCode} ${digits}`)}`);
    }

    return (
        <main className="login-page">
            <div className="login-content">
                <div className="login-brand" aria-label="Vantavaru">
                    <div className="login-brand-mark" aria-hidden="true">
                        <House />
                        <span>♥</span>
                    </div>
                    <strong>Vantavaru</strong>
                </div>

                <section className="login-panel" aria-labelledby="login-title">
                    <h1 id="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Log in with your phone number<br />to continue</p>

                    <div className="phone-field">
                        <label className="country-code">
                            <select aria-label="Country code" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                                <option value="+91">+91</option>
                                <option value="+1">+1</option>
                                <option value="+44">+44</option>
                                <option value="+61">+61</option>
                            </select>
                            <ChevronDown aria-hidden="true" />
                        </label>
                        <span className="phone-divider" aria-hidden="true" />
                        <input aria-label="Phone number" type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(event) => { setPhone(event.target.value.replace(/\D/g, "")); setMessage(""); }} placeholder="Enter your phone number" />
                    </div>

                    <button className="otp-button" onClick={sendOtp} disabled={isSending}>{isSending ? "Sending OTP..." : <>Send OTP <ArrowRight aria-hidden="true" /></>}</button>
                    <p className={`login-message ${message.startsWith("OTP") ? "success" : ""}`} role="status">{message || <><ShieldCheck aria-hidden="true" /> We&apos;ll send a one-time password (OTP) to your phone number</>}</p>
                </section>
            </div>

            <div className="login-food-art" aria-hidden="true">
                <span className="food-leaf food-leaf-one" />
                <span className="food-leaf food-leaf-two" />
                <span className="food-tomato" />
                <span className="food-bowl"><Utensils /></span>
                <span className="food-wave" />
            </div>

            <section className="signup-prompt">
                <div className="signup-divider"><span /> <strong>New to Vantavaru?</strong> <span /></div>
                <div className="signup-actions">
                    <button className={`signup-button ${signupType === "customer" ? "signup-selected" : ""}`} onClick={() => { setSignupType("customer"); router.push("/register-customer"); }}><UserRound aria-hidden="true" /><span>As a Customer</span></button>
                    <button className={`signup-button ${signupType === "cook" ? "signup-selected" : ""}`} onClick={() => { setSignupType("cook"); router.push("/register-cook"); }}><ChefHat aria-hidden="true" /><span>Register as a Cook</span></button>
                </div>
                {signupType && <p className="signup-status" role="status">{signupType === "customer" ? "Customer account registration selected." : "Cook registration selected."}</p>}
            </section>
        </main>
    );
}
