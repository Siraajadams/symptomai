"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentCompleteContent() {
  const searchParams = useSearchParams();

  const [copied, setCopied] = useState(false);

  const referralCode =
    searchParams.get("referral")?.trim().toUpperCase() || "";

  const paymentReference =
    searchParams.get("reference")?.trim() || "";

  const homeUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (referralCode) {
      params.set("referral", referralCode);
    }

    if (paymentReference) {
      params.set("paymentReference", paymentReference);
    }

    params.set("payment", "success");

    return `/?${params.toString()}`;
  }, [referralCode, paymentReference]);

  async function copyReferralCode() {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

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
          maxWidth: "620px",
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
            fontSize: "32px",
            color: "#0f172a",
          }}
        >
          Payment confirmed
        </h1>

        <p
          style={{
            margin: "0 auto 24px",
            maxWidth: "500px",
            color: "#475569",
            lineHeight: 1.6,
          }}
        >
          Your payment was successful and your consultation request has been
          submitted for review by a registered doctor.
        </p>

        {referralCode ? (
          <div
            style={{
              padding: "18px",
              marginBottom: "16px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "14px",
              color: "#1e3a8a",
            }}
          >
            <div
              style={{
                marginBottom: "6px",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Your referral code
            </div>

            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                letterSpacing: "1px",
                wordBreak: "break-word",
              }}
            >
              {referralCode}
            </div>

            <button
              type="button"
              onClick={copyReferralCode}
              style={{
                marginTop: "12px",
                padding: "9px 14px",
                border: "1px solid #93c5fd",
                borderRadius: "9px",
                background: "#ffffff",
                color: "#1d4ed8",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {copied ? "Referral code copied" : "Copy referral code"}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: "16px",
              marginBottom: "16px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: "12px",
              color: "#9a3412",
            }}
          >
            Your payment was received, but no referral code was included.
            Please keep your payment reference for assistance.
          </div>
        )}

        {paymentReference && (
          <div
            style={{
              padding: "14px",
              marginBottom: "24px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              color: "#334155",
              wordBreak: "break-word",
            }}
          >
            <strong>Payment reference</strong>
            <br />
            <span style={{ fontSize: "14px" }}>{paymentReference}</span>
          </div>
        )}

        <div
          style={{
            marginBottom: "24px",
            padding: "20px",
            borderRadius: "16px",
            background: "#f8fafc",
            textAlign: "left",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px",
              fontSize: "19px",
              color: "#0f172a",
              textAlign: "center",
            }}
          >
            What happens next?
          </h2>

          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <StatusItem
              number="1"
              title="Payment received"
              description="Your payment has been securely verified."
              complete
            />

            <StatusItem
              number="2"
              title="Doctor review"
              description="A registered doctor will review your assessment and referral information."
            />

            <StatusItem
              number="3"
              title="Consultation or clinical response"
              description="You may be contacted if the doctor needs more information before making a clinical decision."
            />

            <StatusItem
              number="4"
              title="Prescription outcome"
              description="Where clinically appropriate, your prescription or next-step instructions will be provided."
            />
          </div>
        </div>

        <div
          style={{
            padding: "14px",
            marginBottom: "22px",
            borderRadius: "12px",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          Please keep your referral code available. It may be used to locate
          your consultation request.
        </div>

        <a
          href={homeUrl}
          style={{
            display: "inline-block",
            width: "100%",
            boxSizing: "border-box",
            padding: "15px 20px",
            borderRadius: "12px",
            background: "#2563eb",
            color: "#ffffff",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: "16px",
          }}
        >
          Return to SymptomAI
        </a>
      </section>
    </main>
  );
}

type StatusItemProps = {
  number: string;
  title: string;
  description: string;
  complete?: boolean;
};

function StatusItem({
  number,
  title,
  description,
  complete = false,
}: StatusItemProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          flexShrink: 0,
          borderRadius: "50%",
          background: complete ? "#dcfce7" : "#dbeafe",
          color: complete ? "#15803d" : "#1d4ed8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
        }}
      >
        {complete ? "✓" : number}
      </div>

      <div>
        <div
          style={{
            marginBottom: "3px",
            color: "#0f172a",
            fontWeight: 700,
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#64748b",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </div>
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
            background:
              "linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)",
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
