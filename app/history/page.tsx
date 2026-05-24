"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function HistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setEmail("Not logged in");
      return;
    }

    setEmail(userData.user.email || "");

    const { data, error } = await supabase
      .from("triage_history")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setRecords(data);
  }

  return (
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>Patient History</h1>
      <p>{email}</p>

      {records.length === 0 && <p>No triage history found yet.</p>}

      {records.map((r) => (
        <div
          key={r.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <h3 style={{ marginBottom: 10 }}>
  {new Date(r.created_at).toLocaleString()}
</h3>

<p>
  <b>Symptoms:</b>{" "}
  {Array.isArray(r.symptoms)
    ? r.symptoms.join(", ")
    : "No symptoms recorded"}
</p>

<p>
  <b>Recommendation:</b>{" "}
  {r.recommendation || "No recommendation"}
</p>

<p>
  <b>Pharmacist Notes:</b>{" "}
  {r.pharmacist_notes || "None"}
</p>

<p>
  <b>Gender:</b>{" "}
  {r.gender || "Not captured"}
</p>

<p>
  <b>Duration:</b>{" "}
  {r.symptom_duration || "Not captured"}
</p>

<p>
  <b>Height:</b>{" "}
  {r.height_cm || "-"} cm
</p>

<p>
  <b>Weight:</b>{" "}
  {r.weight_kg || "-"} kg
</p>
        </div>
      ))}
    </main>
  );
}
