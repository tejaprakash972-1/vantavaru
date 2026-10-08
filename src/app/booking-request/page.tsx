"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock3,
  MapPin,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";
import { useCookLanguage } from "@/lib/cook/use-language";

type RequestStatus = "Pending" | "Accepted" | "Rejected";

export default function BookingRequestPage() {
  const router = useRouter();
  const { t } = useCookLanguage();
  const [status, setStatus] = useState<RequestStatus>("Pending");

  return (
    <main className="booking-request-page">
      <header className="booking-request-header">
        <button className="booking-request-back" aria-label={t("Go back")} onClick={() => router.back()}>
          <ArrowLeft />
        </button>
        <h1>{t("Booking Request")}</h1>
        <span aria-hidden="true" />
      </header>

      <section className="request-alert" aria-live="polite">
        <Clock3 />
        <div>
          <strong>{t("This booking is waiting for your response")}</strong>
          <span>{t("Please accept or reject within 12 hours.")}</span>
        </div>
      </section>

      <section className="request-summary" aria-label={t("Booking summary")}>
        <div className="request-date-box"><strong>16</strong><span>Nov</span><small>2024</small></div>
        <div className="request-summary-main">
          <div className="request-summary-title"><strong>{t("Breakfast")}</strong><span>{t("Pending")}</span></div>
          <span><Clock3 /> 8:00 AM – 9:00 AM</span>
          <span><MapPin /> HSR Layout, Bengaluru</span>
          <span><UserRound /> 4 {t("people")}</span>
        </div>
        <button className="request-map-link"><MapPin /> {t("View on map")}</button>
      </section>

      <section className="request-detail-panel">
        <h2><UserRound /> {t("Customer Details")}</h2>
        <dl>
          <div><dt>{t("Name")}</dt><dd>Priya Sharma</dd></div>
          <div><dt>{t("Phone Number")}</dt><dd><a href="tel:+919876543210">+91 98765 43210</a></dd></div>
          <div><dt>{t("Address")}</dt><dd>B-204, Green Park Layout,<br />HSR Layout, Bengaluru – 560102</dd></div>
        </dl>
      </section>

      <section className="request-detail-panel">
        <h2><Utensils /> {t("Meal Details")}</h2>
        <dl>
          <div><dt>{t("Menu")}</dt><dd>Idli, Sambar, Coconut Chutney</dd></div>
          <div><dt>{t("Special Instructions")}</dt><dd>Less spicy, no onion, no garlic</dd></div>
        </dl>
      </section>

      <section className="request-detail-panel request-earnings-panel">
        <h2><span className="request-rupee">₹</span> {t("Estimated Earnings")}</h2>
        <dl>
          <div><dt>{t("Total Amount")}</dt><dd className="request-amount">₹200</dd></div>
          <div><dt>{t("Payment Method")}</dt><dd>{t("Online (via app)")}</dd></div>
        </dl>
      </section>

      {status !== "Pending" && <p className="request-status" role="status">{t(status === "Accepted" ? "Booking accepted." : "Booking rejected.")}</p>}

      <div className="booking-request-actions">
        <button className="request-reject" onClick={() => setStatus("Rejected")}><X /> {t("Reject")}</button>
        <button className="request-accept" onClick={() => setStatus("Accepted")}><Check /> {t("Accept")}</button>
      </div>
    </main>
  );
}
