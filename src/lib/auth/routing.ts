import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppRole = "cook" | "customer";

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const role = value.toLowerCase();
  if (role === "cook" || role === "customer") return role;
  return null;
}

async function getRoleFromUser(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {};
  const metadataRole = normalizeRole(metadata.role ?? metadata.user_type ?? metadata.account_type);
  if (metadataRole) return metadataRole;

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return normalizeRole(data?.role);
}

export async function getAuthenticatedRoute() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const role = await getRoleFromUser(supabase, session.user);
  if (role === "cook") return "/cook-home";
  if (role === "customer") return "/";
  return "/choose-role";
}
