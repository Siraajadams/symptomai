"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

function PaymentCompleteContent() {
  const searchParams = useSearchParams();

  const referralCode =
    searchParams.get("referral")?.trim().toUpperCase() || "";

  const paymentReference =
    searchParams.get("reference")?.trim() || "";

  const careScriberUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (referralCode) {
      params.set("referral", referralCode);
    }

    if (paymentReference) {
      params.set("paymentReference", paymentReference);
    }

    return `https://carescriber.yourdomain.com/referral-open?${params.toString()}`;
  }, [referralCode, paymentReference]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px",
        background:
          "linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)",
        fontFamily:
          'Arial, Helvetica, system-ui, -apple-system, sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "#ffffff",
          borderRadius: "22px",
          padding: "32px",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "76px",
            height: "76px",
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "#dcfce7",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: 700,
          }}
        >
          ✓
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "30px",
            color: "#0f172a",
          }}
        >
          Payment confirmed
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          Your payment was successful. Your referral is ready for the next
          step.
        </p>

        {referralCode ? (
          <div
            style={{
              padding: "16px",
              marginBottom: "14px",
              background: "#eff6ff",
              borderRadius: "12px",
              color: "#1e3a8a",
            }}
          >
            <strong>Referral code</strong>
            <br />
            <span style={{ fontSize: "20px", fontWeight: 700 }}>
              {referralCode}
            </span>
          </div>
        ) : (
          <div
            style={{
              padding: "16px",
              marginBottom: "14px",
              background: "#fff7ed",
              borderRadius: "12px",
              color: "#9a3412",
            }}
          >
            No referral code was received.
          </div>
        )}

        {paymentReference && (
          <div
            style={{
              padding: "14px",
              marginBottom: "20px",
              background: "#f8fafc",
              borderRadius: "12px",
              color: "#334155",
              wordBreak: "break-word",
            }}
          >
            <strong>Payment reference</strong>
            <br />
            {paymentReference}
          </div>
        )}

        <p
          style={{
            margin: "0 0 20px",
            color: "#64748b",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          Please keep your referral code safe. It will be used to open your
          referral in CareScriber.
        </p>

        {referralCode && (
          <a
            href={careScriberUrl}
            style={{
              display: "inline-block",
              width: "100%",
              boxSizing: "border-box",
              padding: "15px 20px",
              marginBottom: "12px",
              borderRadius: "12px",
              background: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Continue to CareScriber
          </a>
        )}

        <a
          href="/"
          style={{
            display: "inline-block",
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 20px",
            borderRadius: "12px",
            background: "#e2e8f0",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Return to SymptomAI
        </a>
      </section>
    </main>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Loading payment confirmation...
        </main>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}
