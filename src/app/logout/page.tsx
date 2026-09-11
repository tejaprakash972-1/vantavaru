"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function invalidateSession() {
      const supabase = getSupabaseBrowserClient();
      if (supabase) await supabase.auth.signOut({ scope: "local" });
      if (active) router.replace("/login");
    }

    void invalidateSession();
    return () => {
      active = false;
    };
  }, [router]);

  return <main className="auth-route-loading" aria-label="Signing you out" />;
}
