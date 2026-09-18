"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChefHat, House, ShieldCheck, UserRound } from "lucide-react";
import { getAuthenticatedRoute } from "@/lib/auth/routing";

export default function ChooseRolePage() {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveRoute() {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const destination = await getAuthenticatedRoute();
        if (cancelled) return;

        if (destination && destination !== "/choose-role") {
          router.replace(destination);
          return;
        }

        if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 350));
      }

      if (!cancelled) setAuthResolved(true);
    }

    void resolveRoute();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authResolved) {
    return <main className="auth-route-loading" aria-label="Checking your account" />;
  }

  return (
    <main className="choose-role-page">
      <header className="choose-role-header">
        <button className="choose-role-back" aria-label="Go back" onClick={() => router.back()}><ArrowLeft /></button>
        <div className="choose-role-brand"><span><House /><i>♥</i></span><strong>Vantavaru</strong></div>
        <span aria-hidden="true" />
      </header>

      <section className="choose-role-content" aria-labelledby="choose-role-title">
        <div className="choose-role-hero" aria-hidden="true">
          <span><UserRound /></span>
          <i><ShieldCheck /></i>
          <b><ChefHat /></b>
        </div>
        <p className="choose-role-eyebrow">Welcome to Vantavaru</p>
        <h1 id="choose-role-title">Choose your role</h1>
        <p>Pick how you want to use Vantavaru today. You can finish setup in the next step.</p>

        <div className="choose-role-options">
          <button className="choose-role-card" onClick={() => router.push("/register-customer")}>
            <span className="choose-role-icon"><UserRound /></span>
            <span className="choose-role-copy"><small>Customer</small><strong>I want to book meals</strong><em>Find trusted home cooks near you.</em></span>
            <ArrowRight className="choose-role-arrow" />
          </button>

          <button className="choose-role-card" onClick={() => router.push("/register-cook")}>
            <span className="choose-role-icon"><ChefHat /></span>
            <span className="choose-role-copy"><small>Cook</small><strong>I want to be a cook</strong><em>Earn by sharing your cooking skills.</em></span>
            <ArrowRight className="choose-role-arrow" />
          </button>
        </div>
      </section>
    </main>
  );
}
