"use client";

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "https://symptomai.digital",
      },
    });

    if (error) setMessage(error.message);
    else setMessage("Check your email for the login link.");
  }

  return (
    <main style={{ minHeight: "100vh", padding: 30, fontFamily: "Arial" }}>
      <h1>SymptomAI Login</h1>
      <p>Enter your email to receive a secure login link.</p>

      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 14, width: "100%", maxWidth: 400 }}
      />

      <br /><br />

      <button
        onClick={login}
        style={{
          padding: "14px 24px",
          background: "#16b8aa",
          color: "white",
          border: "none",
          borderRadius: 12,
          fontWeight: 700,
        }}
      >
        Send login link
      </button>

      <p>{message}</p>
    </main>
  );
}
