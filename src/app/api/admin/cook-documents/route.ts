import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const documentId = new URL(request.url).searchParams.get("documentId");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!accessToken) return NextResponse.json({ error: "Sign in to view cook documents." }, { status: 401 });
    if (!documentId) return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
        return NextResponse.json({ error: "Document preview is not configured on the server." }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Sign in again." }, { status: 401 });

    const database = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await database
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    if (profileError) return NextResponse.json({ error: "Unable to verify admin permissions." }, { status: 500 });
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access is required to view cook documents." }, { status: 403 });

    const { data: document, error: documentError } = await database
        .from("cook_documents")
        .select("id, document_type, file_path, status")
        .eq("id", documentId)
        .maybeSingle();
    if (documentError || !document) {
        return NextResponse.json({ error: documentError?.message || "Document not found." }, { status: 404 });
    }

    const { data: signedFile, error: signedUrlError } = await database.storage
        .from("cookDocuments")
        .createSignedUrl(document.file_path, 300);
    if (signedUrlError || !signedFile?.signedUrl) {
        return NextResponse.json({ error: signedUrlError?.message || "Unable to create a document preview." }, { status: 500 });
    }

    return NextResponse.json({ document, signedUrl: signedFile.signedUrl });
}