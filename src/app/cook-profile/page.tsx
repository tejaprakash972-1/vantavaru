"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  ChefHat,
  ChevronRight,
  Download,
  ExternalLink,
  Edit3,
  FileText,
  LogOut,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setCookAvailability } from "@/lib/cook/availability";
import CookServiceAreas from "@/components/CookServiceAreas";

type CookDocument = { id: string; document_type: string; file_path: string; status: string; uploaded_at: string | null };
type DocumentPreview = { document: CookDocument; url: string };

type ProfileSectionProps = {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
  action?: "Edit" | "View";
};

export default function CookProfilePage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [activeView, setActiveView] = useState<"profile" | "service-areas">("profile");
  const [documents, setDocuments] = useState<CookDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [cookProfileId, setCookProfileId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCookDocuments() {
      if (!supabase) {
        setDocumentsError("Documents are unavailable because Supabase is not configured.");
        setDocumentsLoading(false);
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (!cancelled) {
          setDocumentsError("Please sign in again to view your documents.");
          setDocumentsLoading(false);
        }
        return;
      }

      const { data: cookProfile, error: cookError } = await supabase
        .from("cook_profiles")
        .select("id, is_online")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cookError || !cookProfile) {
        if (!cancelled) {
          setDocumentsError(cookError?.message || "Cook profile not found.");
          setDocumentsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setCookProfileId(cookProfile.id);
        setIsOnline(cookProfile.is_online === true);
      }

      const { data: rows, error: documentsQueryError } = await supabase
        .from("cook_documents")
        .select("id, document_type, file_path, status, uploaded_at")
        .eq("cook_id", cookProfile.id)
        .order("uploaded_at", { ascending: false });

      if (!cancelled) {
        if (documentsQueryError) setDocumentsError(documentsQueryError.message);
        setDocuments((rows ?? []) as CookDocument[]);
        setDocumentsLoading(false);
      }
    }

    void loadCookDocuments();
    return () => { cancelled = true; };
  }, [supabase]);

  async function changeAvailability(nextOnline: boolean) {
    if (!supabase || !cookProfileId || availabilitySaving) return;
    setAvailabilitySaving(true);
    setAvailabilityError("");
    try {
      setIsOnline(await setCookAvailability(supabase, nextOnline));
    } catch (error) {
      setAvailabilityError(error instanceof Error ? error.message : "Unable to update availability.");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function openDocument(document: CookDocument) {
    if (!supabase) return;
    setPreviewLoadingId(document.id);
    setDocumentsError("");
    const { data, error } = await supabase.storage.from("cookDocuments").createSignedUrl(document.file_path, 300);
    setPreviewLoadingId(null);
    if (error || !data?.signedUrl) {
      setDocumentsError(error?.message || "Unable to open this document.");
      return;
    }
    setPreview({ document, url: data.signedUrl });
  }

  function closeDocuments() {
    setDocumentsOpen(false);
    setPreview(null);
    setDocumentsError("");
  }

  return (
    <main className="cook-profile-page">
      <header className="cook-profile-header">
        <button className="cook-profile-back" aria-label="Go back" onClick={() => router.back()}><ArrowLeft /></button>
        <div className="cook-profile-brand"><span className="cook-profile-brand-mark"><ChefHat /></span><strong>Vantavaru</strong></div>
      </header>

      <section className="cook-profile-intro">
        <h1>My Profile</h1>
        <p>Manage your personal details and preferences.</p>
      </section>

      <div className="cook-profile-view-pills" aria-label="Cook profile views">
        <button type="button" className={activeView === "profile" ? "active" : ""} aria-pressed={activeView === "profile"} onClick={() => setActiveView("profile")}><UserRound /> Profile</button>
        <button type="button" className={activeView === "service-areas" ? "active" : ""} aria-pressed={activeView === "service-areas"} onClick={() => setActiveView("service-areas")}><MapPin /> Service Areas</button>
      </div>

      {activeView === "profile" ? <>

        <section className={`cook-profile-availability ${isOnline ? "online" : "offline"}`} aria-label="Your availability">
          <div><strong>{cookProfileId ? (isOnline ? "You're online" : "You're offline") : "Availability unavailable"}</strong><small>{documentsLoading ? "Checking your availability..." : cookProfileId ? (isOnline ? "You can receive booking requests." : "Go online to receive booking requests.") : documentsError || "Cook profile not found."}</small></div>
          <label className="cook-availability-toggle"><span className="sr-only">{isOnline ? "Go offline" : "Go online"}</span><input type="checkbox" checked={isOnline} disabled={!cookProfileId || availabilitySaving} onChange={(event) => void changeAvailability(event.target.checked)} /><span className="cook-toggle-track" aria-hidden="true"><i /></span></label>
        </section>
        {availabilityError && <p className="cook-profile-availability-error" role="alert">{availabilityError}</p>}

        <section className="profile-approved-banner">
          <span><Check /></span>
          <div><strong>Profile Approved</strong><p>Your profile has been verified and is visible to customers.</p></div>
          <b>Approved</b>
        </section>

        <ProfileSection icon={UserRound} title="Personal Information" action="Edit">
          <ProfileRows rows={[
            ["Full Name", "Lakshmi Narayanan"],
            ["Phone Number", "+91 98765 43210"],
            ["Email Address", "lakshmi.cook@gmail.com"],
            ["Date of Birth", "12 Mar 1985"],
            ["Gender", "Female"],
            ["Languages Spoken", "Tamil, English, Hindi"],
          ]} />
        </ProfileSection>

        <ProfileSection icon={ChefHat} title="Cooking Details" action="Edit">
          <ProfileRows rows={[
            ["Cooking Experience", "5+ years"],
            ["Cuisines", "South Indian, North Indian, Snacks, Continental"],
            ["Special Dishes", "Idli, Sambar, Chapati, Vegetable Curry, Snacks"],
            ["Preferred Meal Types", "Breakfast, Lunch, Dinner"],
            ["About Me", "I love cooking healthy and tasty home-style meals with fresh ingredients."],
          ]} />
        </ProfileSection>

        <ProfileSection icon={MapPin} title="Address" action="Edit">
          <ProfileRows rows={[
            ["House / Flat No.", "B-204"],
            ["Street / Area / Locality", "Green Park Layout, 3rd Cross"],
            ["City", "Bengaluru"],
            ["Pincode", "560102"],
            ["Landmark", "Near FreshMart Supermarket"],
            ["Service Area", "Within 5 km"],
          ]} />
        </ProfileSection>

        <ProfileSection icon={FileText} title="Documents" action="View" onAction={() => setDocumentsOpen(true)}>
          {documentsLoading ? <p className="cook-document-state">Loading uploaded documents...</p> : documentsError && !documentsOpen ? <p className="cook-document-state cook-document-error" role="alert">{documentsError}</p> : documents.length === 0 ? <p className="cook-document-state">No documents uploaded.</p> : <div className="cook-document-summary">{documents.map((document) => <span key={document.id}>{formatDocumentType(document.document_type)}</span>)}</div>}
        </ProfileSection>

        <button className="cook-profile-logout" onClick={() => router.replace("/logout")}><LogOut /> Logout</button>
      </> : <CookServiceAreas />}

      {documentsOpen && <div className="cook-document-modal-backdrop" role="presentation" onMouseDown={closeDocuments}><section className="cook-document-modal" role="dialog" aria-modal="true" aria-labelledby="cook-documents-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="cook-document-modal-header">{preview ? <button className="cook-document-back" aria-label="Back to documents" onClick={() => setPreview(null)}><ArrowUpLeft /></button> : <span className="cook-document-modal-icon"><FileText /></span>}<div><h2 id="cook-documents-title">{preview ? formatDocumentType(preview.document.document_type) : "Uploaded Documents"}</h2><p>{preview ? `Status: ${capitalize(preview.document.status)}` : `${documents.length} ${documents.length === 1 ? "document" : "documents"}`}</p></div><button className="cook-document-close" aria-label="Close documents" onClick={closeDocuments}><X /></button></header>
        {documentsError && <p className="cook-document-error cook-document-modal-error" role="alert">{documentsError}</p>}
        {preview ? <DocumentPreviewContent preview={preview} /> : documentsLoading ? <p className="cook-document-state">Loading uploaded documents...</p> : documents.length === 0 ? <p className="cook-document-state">No documents have been uploaded.</p> : <div className="cook-document-list">{documents.map((document) => <div className="cook-document-row" key={document.id}><span className="cook-document-file-icon"><FileText /></span><div className="cook-document-row-copy"><strong>{formatDocumentType(document.document_type)}</strong><small>{capitalize(document.status)}{document.uploaded_at ? ` · ${formatUploadDate(document.uploaded_at)}` : ""}</small></div><button className="cook-document-view-button" disabled={previewLoadingId === document.id} onClick={() => void openDocument(document)}>{previewLoadingId === document.id ? "Opening..." : "View"}</button></div>)}</div>}
      </section></div>}
    </main>
  );
}

function ProfileSection({ icon: Icon, title, children, action, onAction }: ProfileSectionProps & { onAction?: () => void }) {
  return (
    <section className="cook-profile-section">
      <header>
        <span className="cook-profile-section-icon"><Icon /></span>
        <h2>{title}</h2>
        {action && <button className="cook-profile-section-action" onClick={onAction}><>{action === "Edit" ? <Edit3 /> : <ChevronRight />}</><span>{action}</span></button>}
      </header>
      <div className="cook-profile-section-body">{children}</div>
    </section>
  );
}

function ProfileRows({ rows }: { rows: string[][] }) {
  return <dl className="cook-profile-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function DocumentPreviewContent({ preview }: { preview: DocumentPreview }) {
  const path = preview.document.file_path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/.test(path)) {
    return <div className="cook-document-preview-image"><img src={preview.url} alt={formatDocumentType(preview.document.document_type)} /></div>;
  }
  if (/\.pdf(\?|$)/.test(path)) {
    return <iframe className="cook-document-preview-frame" title={formatDocumentType(preview.document.document_type)} src={preview.url} />;
  }
  return <div className="cook-document-preview-fallback"><FileText /><p>Preview is not available for this file type.</p><a href={preview.url} target="_blank" rel="noreferrer"><ExternalLink /> Open document</a><a href={preview.url} download><Download /> Download document</a></div>;
}

function formatDocumentType(value: string) {
  return value.split(/[_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
