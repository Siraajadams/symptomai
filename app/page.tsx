'use client';

import { useEffect, useMemo, useState } from 'react';

export default function AdminPage() {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    setRecords(JSON.parse(localStorage.getItem('symptomai_triages') || '[]'));
  }, []);

  const stats = useMemo(() => {
    const base: any = { total: records.length, EMERGENCY: 0, DOCTOR_IN_PHARMACY: 0, PHARMACIST_CARE: 0, SELF_CARE: 0 };
    records.forEach(r => { base[r.decision.level] = (base[r.decision.level] || 0) + 1; });
    return base;
  }, [records]);

  function clearData() {
    if (!confirm('Clear local demo data?')) return;
    localStorage.removeItem('symptomai_triages');
    setRecords([]);
  }

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
        <div className="card"><h2>{stats.EMERGENCY}</h2><p>Emergency referrals</p></div>
        <div className="card"><h2>{stats.DOCTOR_IN_PHARMACY}</h2><p>Doctor in pharmacy</p></div>
        <div className="card"><h2>{stats.PHARMACIST_CARE + stats.SELF_CARE}</h2><p>Pharmacy/self-care</p></div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Recent triages</h2>
        <button className="button danger" onClick={clearData}>Clear demo data</button>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Symptom</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.form.name}</td>
                <td>{r.form.phone}</td>
                <td>{r.form.location}</td>
                <td>{r.form.symptom}</td>
                <td><b>{r.decision.level.replaceAll('_', ' ')}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small"><a href="/">Back to triage</a></p>
    </main>
  );
}
