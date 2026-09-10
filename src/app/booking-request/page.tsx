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

type RequestStatus = "Pending" | "Accepted" | "Rejected";

export default function BookingRequestPage() {
  const router = useRouter();
  const [status, setStatus] = useState<RequestStatus>("Pending");

  return (
    <main className="booking-request-page">
      <header className="booking-request-header">
        <button className="booking-request-back" aria-label="Go back" onClick={() => router.back()}>
          <ArrowLeft />
        </button>
        <h1>Booking Request</h1>
        <span aria-hidden="true" />
      </header>

      <section className="request-alert" aria-live="polite">
        <Clock3 />
        <div>
          <strong>This booking is waiting for your response</strong>
          <span>Please accept or reject within 12 hours.</span>
        </div>
      </section>

      <section className="request-summary" aria-label="Booking summary">
        <div className="request-date-box"><strong>16</strong><span>Nov</span><small>2024</small></div>
        <div className="request-summary-main">
          <div className="request-summary-title"><strong>Breakfast</strong><span>Pending</span></div>
          <span><Clock3 /> 8:00 AM – 9:00 AM</span>
          <span><MapPin /> HSR Layout, Bengaluru</span>
          <span><UserRound /> 4 people</span>
        </div>
        <button className="request-map-link"><MapPin /> View on map</button>
      </section>

      <section className="request-detail-panel">
        <h2><UserRound /> Customer Details</h2>
        <dl>
          <div><dt>Name</dt><dd>Priya Sharma</dd></div>
          <div><dt>Phone Number</dt><dd><a href="tel:+919876543210">+91 98765 43210</a></dd></div>
          <div><dt>Address</dt><dd>B-204, Green Park Layout,<br />HSR Layout, Bengaluru – 560102</dd></div>
        </dl>
      </section>

      <section className="request-detail-panel">
        <h2><Utensils /> Meal Details</h2>
        <dl>
          <div><dt>Menu</dt><dd>Idli, Sambar, Coconut Chutney</dd></div>
          <div><dt>Special Instructions</dt><dd>Less spicy, no onion, no garlic</dd></div>
        </dl>
      </section>

      <section className="request-detail-panel request-earnings-panel">
        <h2><span className="request-rupee">₹</span> Estimated Earnings</h2>
        <dl>
          <div><dt>Total Amount</dt><dd className="request-amount">₹200</dd></div>
          <div><dt>Payment Method</dt><dd>Online (via app)</dd></div>
        </dl>
      </section>

      {status !== "Pending" && <p className="request-status" role="status">Booking {status.toLowerCase()}.</p>}

      <div className="booking-request-actions">
        <button className="request-reject" onClick={() => setStatus("Rejected")}><X /> Reject</button>
        <button className="request-accept" onClick={() => setStatus("Accepted")}><Check /> Accept</button>
      </div>
    </main>
  );
}
