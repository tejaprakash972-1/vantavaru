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
  Languages,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setCookAvailability } from "@/lib/cook/availability";
import CookServiceAreas from "@/components/CookServiceAreas";
import { cookLanguageNames, type CookLanguage } from "@/lib/cook/language";
import { useCookLanguage } from "@/lib/cook/use-language";

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
  const { language, saveLanguage, loading: languageLoading, error: languageLoadError, t } = useCookLanguage();
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState("");
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

  async function changeLanguage(next: CookLanguage) {
    setLanguageSaving(true);
    setLanguageError("");
    try {
      await saveLanguage(next);
    } catch (error) {
      setLanguageError(error instanceof Error ? error.message : "Unable to save language preference.");
    } finally {
      setLanguageSaving(false);
    }
  }

  return (
    <main className="cook-profile-page" lang={language}>
      <header className="cook-profile-header">
        <button className="cook-profile-back" aria-label={t("Go back")} onClick={() => router.back()}><ArrowLeft /></button>
        <div className="cook-profile-brand"><span className="cook-profile-brand-mark"><ChefHat /></span><strong>Vantavaru</strong></div>
      </header>

      <section className="cook-profile-intro">
        <h1>{t("My Profile")}</h1>
        <p>{t("Manage your personal details and preferences.")}</p>
      </section>

      <div className="cook-profile-view-pills" aria-label="Cook profile views">
        <button type="button" className={activeView === "profile" ? "active" : ""} aria-pressed={activeView === "profile"} onClick={() => setActiveView("profile")}><UserRound /> {t("Profile")}</button>
        <button type="button" className={activeView === "service-areas" ? "active" : ""} aria-pressed={activeView === "service-areas"} onClick={() => setActiveView("service-areas")}><MapPin /> {t("Service Areas")}</button>
      </div>

      {activeView === "profile" ? <>

        <section className="cook-profile-section" aria-labelledby="cook-language-title">
          <header><span className="cook-profile-section-icon"><Languages /></span><h2 id="cook-language-title">{t("App Language")}</h2></header>
          <div className="cook-profile-section-body">
            <label className="cook-language-setting">{t("Language")}
              <select value={language} disabled={!cookProfileId || languageLoading || languageSaving} onChange={(event) => void changeLanguage(event.target.value as CookLanguage)}>
                {(Object.keys(cookLanguageNames) as CookLanguage[]).map((code) => <option key={code} value={code}>{cookLanguageNames[code]}</option>)}
              </select>
            </label>
            {(languageError || languageLoadError) && <p role="alert" className="cook-profile-availability-error">{t(languageError || languageLoadError)}</p>}
          </div>
        </section>

        <section className={`cook-profile-availability ${isOnline ? "online" : "offline"}`} aria-label={t("Your availability")}>
          <div><strong>{cookProfileId ? t(isOnline ? "You're online" : "You're offline") : t("Availability unavailable")}</strong><small>{documentsLoading ? t("Checking your availability...") : cookProfileId ? t(isOnline ? "You can receive booking requests." : "Go online to receive booking requests.") : documentsError || t("Cook profile not found.")}</small></div>
          <label className="cook-availability-toggle"><span className="sr-only">{t(isOnline ? "Go offline" : "Be online")}</span><input type="checkbox" checked={isOnline} disabled={!cookProfileId || availabilitySaving} onChange={(event) => void changeAvailability(event.target.checked)} /><span className="cook-toggle-track" aria-hidden="true"><i /></span></label>
        </section>
        {availabilityError && <p className="cook-profile-availability-error" role="alert">{t(availabilityError)}</p>}

        <section className="profile-approved-banner">
          <span><Check /></span>
          <div><strong>{t("Profile Approved")}</strong><p>{t("Your profile has been verified and is visible to customers.")}</p></div>
          <b>{t("Approved")}</b>
        </section>

        <ProfileSection icon={UserRound} title={t("Personal Information")} action="Edit" t={t}>
          <ProfileRows rows={[
            [t("Full Name"), "Lakshmi Narayanan"],
            [t("Phone Number"), "+91 98765 43210"],
            [t("Email Address"), "lakshmi.cook@gmail.com"],
            [t("Date of Birth"), "12 Mar 1985"],
            [t("Gender"), t("Female")],
            [t("Languages Spoken"), ["Tamil", "English", "Hindi"].map(t).join(", ")],
          ]} />
        </ProfileSection>

        <ProfileSection icon={ChefHat} title={t("Cooking Details")} action="Edit" t={t}>
          <ProfileRows rows={[
            [t("Cooking Experience"), t("5+ years")],
            [t("Cuisines"), ["South Indian", "North Indian", "Snacks", "Continental"].map(t).join(", ")],
            [t("Special Dishes"), ["Idli", "Sambar", "Chapati", "Vegetable Curry", "Snacks"].map(t).join(", ")],
            [t("Preferred Meal Types"), ["Breakfast", "Lunch", "Dinner"].map(t).join(", ")],
            [t("About Me"), t("I love cooking healthy and tasty home-style meals with fresh ingredients.")],
          ]} />
        </ProfileSection>

        <ProfileSection icon={MapPin} title={t("Address")} action="Edit" t={t}>
          <ProfileRows rows={[
            [t("House / Flat No."), "B-204"],
            [t("Street / Area / Locality"), "Green Park Layout, 3rd Cross"],
            [t("City"), "Bengaluru"],
            [t("Pincode"), "560102"],
            [t("Landmark"), "Near FreshMart Supermarket"],
            [t("Service Area"), t("Within 5 km")],
          ]} />
        </ProfileSection>

        <ProfileSection icon={FileText} title={t("Documents")} action="View" t={t} onAction={() => setDocumentsOpen(true)}>
          {documentsLoading ? <p className="cook-document-state">{t("Loading uploaded documents...")}</p> : documentsError && !documentsOpen ? <p className="cook-document-state cook-document-error" role="alert">{t(documentsError)}</p> : documents.length === 0 ? <p className="cook-document-state">{t("No documents uploaded.")}</p> : <div className="cook-document-summary">{documents.map((document) => <span key={document.id}>{t(formatDocumentType(document.document_type))}</span>)}</div>}
        </ProfileSection>

        <button className="cook-profile-logout" onClick={() => router.replace("/logout")}><LogOut /> {t("Logout")}</button>
      </> : <CookServiceAreas />}

      {documentsOpen && <div className="cook-document-modal-backdrop" role="presentation" onMouseDown={closeDocuments}><section className="cook-document-modal" role="dialog" aria-modal="true" aria-labelledby="cook-documents-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="cook-document-modal-header">{preview ? <button className="cook-document-back" aria-label={t("Back to documents")} onClick={() => setPreview(null)}><ArrowUpLeft /></button> : <span className="cook-document-modal-icon"><FileText /></span>}<div><h2 id="cook-documents-title">{preview ? t(formatDocumentType(preview.document.document_type)) : t("Uploaded Documents")}</h2><p>{preview ? `${t("Status")}: ${t(capitalize(preview.document.status))}` : `${documents.length} ${t(documents.length === 1 ? "document" : "documents")}`}</p></div><button className="cook-document-close" aria-label={t("Close documents")} onClick={closeDocuments}><X /></button></header>
        {documentsError && <p className="cook-document-error cook-document-modal-error" role="alert">{t(documentsError)}</p>}
        {preview ? <DocumentPreviewContent preview={preview} t={t} /> : documentsLoading ? <p className="cook-document-state">{t("Loading uploaded documents...")}</p> : documents.length === 0 ? <p className="cook-document-state">{t("No documents have been uploaded.")}</p> : <div className="cook-document-list">{documents.map((document) => <div className="cook-document-row" key={document.id}><span className="cook-document-file-icon"><FileText /></span><div className="cook-document-row-copy"><strong>{t(formatDocumentType(document.document_type))}</strong><small>{t(capitalize(document.status))}{document.uploaded_at ? ` · ${formatUploadDate(document.uploaded_at, language)}` : ""}</small></div><button className="cook-document-view-button" disabled={previewLoadingId === document.id} onClick={() => void openDocument(document)}>{t(previewLoadingId === document.id ? "Opening..." : "View")}</button></div>)}</div>}
      </section></div>}
    </main>
  );
}

function ProfileSection({ icon: Icon, title, children, action, onAction, t }: ProfileSectionProps & { onAction?: () => void; t: (text: string) => string }) {
  return (
    <section className="cook-profile-section">
      <header>
        <span className="cook-profile-section-icon"><Icon /></span>
        <h2>{title}</h2>
        {action && <button className="cook-profile-section-action" onClick={onAction}><>{action === "Edit" ? <Edit3 /> : <ChevronRight />}</><span>{t(action)}</span></button>}
      </header>
      <div className="cook-profile-section-body">{children}</div>
    </section>
  );
}

function ProfileRows({ rows }: { rows: string[][] }) {
  return <dl className="cook-profile-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function DocumentPreviewContent({ preview, t }: { preview: DocumentPreview; t: (text: string) => string }) {
  const path = preview.document.file_path.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/.test(path)) {
    return <div className="cook-document-preview-image"><img src={preview.url} alt={t(formatDocumentType(preview.document.document_type))} /></div>;
  }
  if (/\.pdf(\?|$)/.test(path)) {
    return <iframe className="cook-document-preview-frame" title={t(formatDocumentType(preview.document.document_type))} src={preview.url} />;
  }
  return <div className="cook-document-preview-fallback"><FileText /><p>{t("Preview is not available for this file type.")}</p><a href={preview.url} target="_blank" rel="noreferrer"><ExternalLink /> {t("Open document")}</a><a href={preview.url} download><Download /> {t("Download document")}</a></div>;
}

function formatDocumentType(value: string) {
  return value.split(/[_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatUploadDate(value: string, language: CookLanguage) {
  return new Intl.DateTimeFormat(`${language}-IN`, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
