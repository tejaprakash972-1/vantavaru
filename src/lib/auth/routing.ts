import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppRole = "cook" | "customer";
type AuthenticatedRoute = "/" | "/cook-home" | "/choose-role";
export type AppEntryRoute = "/login" | AuthenticatedRoute;

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase().replace(/[ _-]+/g, "");
  if (role === "cook" || role === "homecook") return "cook";
  if (role === "customer" || role === "user") return "customer";
  return null;
}

async function getRoleFromUser(supabase: SupabaseClient, user: User) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const profileRole = normalizeRole(profile?.role);
  if (profileRole) return profileRole;

  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const metadataRole = normalizeRole(
    metadata.role ??
    metadata.user_type ??
    metadata.account_type ??
    appMetadata.role ??
    appMetadata.user_type ??
    appMetadata.account_type
  );
  if (metadataRole) return metadataRole;

  const { data: cookProfile } = await supabase.from("cook_profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (cookProfile) return "cook";

  return null;
}

function getRouteFromRole(role: AppRole | null): AuthenticatedRoute {
  if (role === "cook") return "/cook-home";
  if (role === "customer") return "/";
  return "/choose-role";
}

export async function getAuthenticatedRouteForUser(supabase: SupabaseClient, user: User) {
  const role = await getRoleFromUser(supabase, user);
  return getRouteFromRole(role);
}

export async function getAuthenticatedRoute() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return getAuthenticatedRouteForUser(supabase, user ?? session.user);
}

export async function getAppEntryRoute() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "/login" as const;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return "/login" as const;

  return getAuthenticatedRouteForUser(supabase, session.user);
}
