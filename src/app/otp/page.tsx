"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, House } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthenticatedRoute } from "@/lib/auth/routing";

export default function OtpPage() {
  return <Suspense fallback={<main className="otp-page" />}><OtpPageContent /></Suspense>;
}

function OtpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(["", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const phone = searchParams.get("phone") || "+91 98765 43210";

  useEffect(() => {
    void getAuthenticatedRoute().then((destination) => {
      if (destination) router.replace(destination);
    });
  }, [router]);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = window.setInterval(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    setMessage("");
    if (digit && index < inputs.current.length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, key: string) {
    if (key === "Backspace" && !code[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("");
    if (!pasted.length) return;
    setCode((current) => current.map((item, index) => pasted[index] || item));
    inputs.current[Math.min(pasted.length, 4) - 1]?.focus();
  }

  async function resendOtp() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({ phone: phone.replace(/\s/g, "") });
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    setCode(["", "", "", ""]);
    setSecondsLeft(45);
    setMessage("A new OTP has been sent.");
    inputs.current[0]?.focus();
  }

  async function verifyOtp() {
    if (code.join("").length !== 4) {
      setMessage("Enter the 4-digit OTP to continue.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      setIsVerifying(true);
      const { error } = await supabase.auth.verifyOtp({ phone: phone.replace(/\s/g, ""), token: code.join(""), type: "sms" });
      setIsVerifying(false);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    const destination = await getAuthenticatedRoute();
    router.replace(destination ?? "/choose-role");
  }

  return (
    <main className="otp-page">
      <header className="otp-header">
        <button className="otp-back-button" aria-label="Go back" onClick={() => router.replace("/login")}><ArrowLeft /></button>
        <div className="otp-brand"><span className="otp-brand-mark"><House /><i>♥</i></span><strong>Vantavaru</strong></div>
        <span aria-hidden="true" />
      </header>

      <section className="otp-content" aria-labelledby="otp-title">
        <h1 id="otp-title">Enter OTP</h1>
        <p>We&apos;ve sent a 4-digit code to<br /><strong>{phone}</strong></p>

        <div className="otp-inputs" aria-label="One-time password">
          {code.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} aria-label={`OTP digit ${index + 1}`} inputMode="numeric" maxLength={1} value={digit} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event.key)} onPaste={handlePaste} />)}
        </div>

        <div className="otp-resend">
          <span>Didn&apos;t receive the code?</span>
          <button disabled={secondsLeft > 0} onClick={resendOtp}>Resend OTP in <strong>00:{String(secondsLeft).padStart(2, "0")}</strong></button>
        </div>

        {message && <p className="otp-message" role="status">{message}</p>}
        <button className="otp-verify-button" onClick={verifyOtp} disabled={isVerifying}>{isVerifying ? "Verifying..." : "Verify OTP"}</button>
      </section>
    </main>
  );
}
