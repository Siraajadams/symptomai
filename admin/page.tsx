'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default function AdminPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRecords() {
    const supabase = getSupabase();

    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('triage_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setRecords(data);
    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const stats = useMemo(() => {
    return {
      total: records.length,
      emergency: records.filter((r) => r.outcome_level === 'EMERGENCY').length,
      doctor: records.filter((r) => r.outcome_level === 'DOCTOR_IN_PHARMACY').length,
      pharmacy: records.filter(
        (r) => r.outcome_level === 'PHARMACIST_CARE' || r.outcome_level === 'SELF_CARE'
      ).length,
    };
  }, [records]);

  return (
    <main className="container">
      <div className="logo">
        <div className="logoMark" />
        <div>
          SymptomAI Admin
          <div className="small">Referral and triage analytics</div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 24 }}>
        <div className="card"><h2>{stats.total}</h2><p>Total triages</p></div>
        <div className="card"><h2>{stats.emergency}</h2><p>Emergency referrals</p></div>
        <div className="card"><h2>{stats.doctor}</h2><p>Doctor in pharmacy</p></div>
        <div className="card"><h2>{stats.pharmacy}</h2><p>Pharmacy/self-care</p></div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Recent triages</h2>
        <button className="button" onClick={loadRecords}>Refresh</button>

        {loading ? (
          <p>Loading records...</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Country</th>
                <th>Location</th>
                <th>Symptom</th>
                <th>Outcome</th>
              </tr>
            </thead>

            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
                  <td>{r.name}</td>
                  <td>{r.dial_code}{r.phone}</td>
                  <td>{r.country}</td>
                  <td>{r.location}</td>
                  <td>{r.symptom || r.symptoms}</td>
                  <td><b>{r.outcome_title || r.outcome}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small"><a href="/">Back to triage</a></p>
    </main>
  );
}
