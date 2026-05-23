"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function loginWithMagicLink() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://symptomai.digital",
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for your secure login link.");
    }
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://symptomai.digital",
      },
    });

    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#edf3f3",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          padding: "40px",
          borderRadius: "24px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "42px",
            fontWeight: 800,
            color: "#0b1b4d",
            marginBottom: "16px",
          }}
        >
          Create your SymptomAI profile
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.5,
            color: "#23314d",
            marginBottom: "30px",
          }}
        >
          Enter your email address to securely create or access your account.
        </p>

        <button
          onClick={loginWithGoogle}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #ddd",
            background: "white",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          Continue with Google
        </button>

        <div
          style={{
            textAlign: "center",
            marginBottom: "20px",
            color: "#666",
          }}
        >
          or
        </div>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "1px solid #ccc",
            fontSize: "16px",
            marginBottom: "20px",
          }}
        />

        <button
          onClick={loginWithMagicLink}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "14px",
            border: "none",
            background: "#20b7ae",
            color: "white",
            fontSize: "18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Create / Login
        </button>

        {message && (
          <p
            style={{
              marginTop: "20px",
              color: "#0b1b4d",
              fontSize: "14px",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
