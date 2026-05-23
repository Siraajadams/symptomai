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
      .from("triage_records")
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
          <h3>{r.patient_name || "Unnamed patient"}</h3>
          <p><b>Symptoms:</b> {r.symptoms?.join(", ")}</p>
          <p><b>Urgency:</b> {r.urgency}</p>
          <p><b>Outcome:</b> {r.outcome_destination}</p>
          <p><b>Date:</b> {new Date(r.created_at).toLocaleString()}</p>
        </div>
      ))}
    </main>
  );
}
