"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChefHat,
  ChevronRight,
  Edit3,
  FileText,
  LogOut,
  MapPin,
  UserRound,
} from "lucide-react";

type ProfileSectionProps = {
  icon: typeof UserRound;
  title: string;
  children: React.ReactNode;
  action?: "Edit" | "View";
};

export default function CookProfilePage() {
  const router = useRouter();

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

      <ProfileSection icon={FileText} title="Documents" action="View">
        <ProfileRows rows={[["Identity Proof (Aadhaar)", "Uploaded"], ["PAN Card", "Uploaded"], ["Profile Photo", "Uploaded"]]} />
      </ProfileSection>

      <button className="cook-profile-logout"><LogOut /> Logout</button>
    </main>
  );
}

function ProfileSection({ icon: Icon, title, children, action }: ProfileSectionProps) {
  return (
    <section className="cook-profile-section">
      <header>
        <span className="cook-profile-section-icon"><Icon /></span>
        <h2>{title}</h2>
        {action && <button className="cook-profile-section-action"><>{action === "Edit" ? <Edit3 /> : <ChevronRight />}</><span>{action}</span></button>}
      </header>
      <div className="cook-profile-section-body">{children}</div>
    </section>
  );
}

function ProfileRows({ rows }: { rows: string[][] }) {
  return <dl className="cook-profile-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
