import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type Referral = {
  id?: string;
  referral_code?: string;
  patient_name?: string;
  patient_email?: string;
  patient_id?: string;
  gender?: string;
  date_of_birth?: string;
  consultation_reason?: string;
  consultationReason?: string;
  payment_status?: string;
  status?: string;
  triage_outcome?: string;
  accepted_by_name?: string;
  doctor_name?: string;
  created_at?: string;
  accepted_at?: string;
  completed_at?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function getAge(date?: string) {
  if (!date) return null;

  const dob = new Date(date);

  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();

  let age = now.getFullYear() - dob.getFullYear();

  const monthDifference = now.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age;
}

function normalise(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export default async function AdminDashboardPage() {
  const { data, error } = await supabase
    .from("symptomai_referrals")
    .select("*")
    .order("created_at", { ascending: false });

  const referrals: Referral[] = data || [];

  if (error) {
    console.error("Dashboard query error:", error);
  }

  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const todayString = now.toISOString().slice(0, 10);

  const todayReferrals = referrals.filter((item) =>
    item.created_at?.startsWith(todayString)
  );

  const monthlyReferrals = referrals.filter((item) => {
    if (!item.created_at) return false;

    return new Date(item.created_at) >= monthStart;
  });

  const paid = referrals.filter((item) =>
    ["paid", "confirmed", "complete", "completed"].includes(
      normalise(item.payment_status)
    )
  );

  const pending = referrals.filter((item) =>
    ["pending", "not_started", "verifying", ""].includes(
      normalise(item.payment_status)
    )
  );

  const completed = referrals.filter((item) => {
    const status = normalise(item.status);

    return (
      Boolean(item.completed_at) ||
      status === "completed" ||
      status === "complete"
    );
  });

  const accepted = referrals.filter(
    (item) =>
      Boolean(item.accepted_at) ||
      Boolean(item.accepted_by_name) ||
      Boolean(item.doctor_name)
  );

  const emergency = referrals.filter((item) =>
    normalise(item.triage_outcome).includes("emergency")
  );

  const male = referrals.filter(
    (item) => normalise(item.gender) === "male"
  );

  const female = referrals.filter(
    (item) => normalise(item.gender) === "female"
  );

  const uniquePatients = new Set(
    referrals
      .map(
        (item) =>
          item.patient_id ||
          item.patient_email ||
          item.patient_name
      )
      .filter(Boolean)
  ).size;

  const monthPaid = monthlyReferrals.filter((item) =>
    ["paid", "confirmed", "complete", "completed"].includes(
      normalise(item.payment_status)
    )
  );

  const revenue = monthPaid.length * 250;

  const ageGroups = {
    under18: 0,
    age18to30: 0,
    age31to45: 0,
    age46to60: 0,
    over60: 0,
  };

  referrals.forEach((item) => {
    const age = getAge(item.date_of_birth);

    if (age === null) return;

    if (age < 18) ageGroups.under18++;
    else if (age <= 30) ageGroups.age18to30++;
    else if (age <= 45) ageGroups.age31to45++;
    else if (age <= 60) ageGroups.age46to60++;
    else ageGroups.over60++;
  });

  const reasons: Record<string, number> = {};

  referrals.forEach((item) => {
    const reason =
      item.consultation_reason ||
      item.consultationReason ||
      "Other";

    reasons[reason] = (reasons[reason] || 0) + 1;
  });

  const reasonRows = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.brandRow}>
              <div style={styles.logo}>S</div>

              <div>
                <h1 style={styles.title}>SymptomAI Admin</h1>
                <p style={styles.subtitle}>
                  Clinical triage & virtual consultation analytics
                </p>
              </div>
            </div>
          </div>

          <div style={styles.liveBadge}>
            <span style={styles.liveDot} />
            LIVE
          </div>
        </header>

        {error && (
          <div style={styles.warning}>
            Dashboard could not retrieve all Supabase data.
            Check the server logs and database columns.
          </div>
        )}

        <section style={styles.grid4}>
          <StatCard
            label="Total Triages"
            value={referrals.length}
            note={`${todayReferrals.length} today`}
          />

          <StatCard
            label="Unique Patients"
            value={uniquePatients}
            note="All time"
          />

          <StatCard
            label="Paid Consults"
            value={paid.length}
            note={`${percentage(paid.length, referrals.length)} conversion`}
          />

          <StatCard
            label="Revenue This Month"
            value={formatMoney(revenue)}
            note={`${monthPaid.length} paid consultations`}
          />
        </section>

        <section style={styles.grid4}>
          <StatCard
            label="Referrals This Month"
            value={monthlyReferrals.length}
            note="Current month"
          />

          <StatCard
            label="Doctor Accepted"
            value={accepted.length}
            note={`${percentage(accepted.length, referrals.length)} of referrals`}
          />

          <StatCard
            label="Completed"
            value={completed.length}
            note={`${percentage(completed.length, referrals.length)} completion`}
          />

          <StatCard
            label="Emergency"
            value={emergency.length}
            note="Clinical escalation"
            danger
          />
        </section>

        <section style={styles.twoColumn}>
          <DashboardCard title="Virtual Consultation Funnel">
            <ProgressRow
              label="Referral created"
              value={referrals.length}
              total={referrals.length}
            />

            <ProgressRow
              label="Payment confirmed"
              value={paid.length}
              total={referrals.length}
            />

            <ProgressRow
              label="Doctor accepted"
              value={accepted.length}
              total={referrals.length}
            />

            <ProgressRow
              label="Consultation completed"
              value={completed.length}
              total={referrals.length}
            />

            <div style={styles.conversionBox}>
              <span>Paid conversion</span>

              <strong>
                {percentage(paid.length, referrals.length)}
              </strong>
            </div>
          </DashboardCard>

          <DashboardCard title="Patient Demographics">
            <ProgressRow
              label="Female"
              value={female.length}
              total={male.length + female.length}
            />

            <ProgressRow
              label="Male"
              value={male.length}
              total={male.length + female.length}
            />

            <div style={styles.ageGrid}>
              <MiniStat
                label="<18"
                value={ageGroups.under18}
              />

              <MiniStat
                label="18–30"
                value={ageGroups.age18to30}
              />

              <MiniStat
                label="31–45"
                value={ageGroups.age31to45}
              />

              <MiniStat
                label="46–60"
                value={ageGroups.age46to60}
              />

              <MiniStat
                label="60+"
                value={ageGroups.over60}
              />
            </div>
          </DashboardCard>
        </section>

        <section style={styles.twoColumn}>
          <DashboardCard title="Consultation Reasons">
            {reasonRows.length === 0 ? (
              <p style={styles.muted}>
                No consultation reason data yet.
              </p>
            ) : (
              reasonRows.map(([reason, count]) => (
                <ProgressRow
                  key={reason}
                  label={reason}
                  value={count}
                  total={referrals.length}
                />
              ))
            )}
          </DashboardCard>

          <DashboardCard title="Operational Status">
            <div style={styles.statusGrid}>
              <StatusBox
                label="Pending Payment"
                value={pending.length}
              />

              <StatusBox
                label="Paid"
                value={paid.length}
              />

              <StatusBox
                label="Accepted"
                value={accepted.length}
              />

              <StatusBox
                label="Completed"
                value={completed.length}
              />
            </div>
          </DashboardCard>
        </section>

        <DashboardCard title="Recent Virtual Consult Referrals">
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Patient</th>
                  <th style={styles.th}>Referral</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Payment</th>
                  <th style={styles.th}>Doctor</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Date</th>
                </tr>
              </thead>

              <tbody>
                {referrals.slice(0, 20).map((item, index) => (
                  <tr key={item.id || index}>
                    <td style={styles.td}>
                      <strong>
                        {item.patient_name || "Patient"}
                      </strong>

                      <div style={styles.smallText}>
                        {item.patient_email || item.patient_id || ""}
                      </div>
                    </td>

                    <td style={styles.td}>
                      {item.referral_code || "—"}
                    </td>

                    <td style={styles.td}>
                      {item.consultation_reason ||
                        item.consultationReason ||
                        "—"}
                    </td>

                    <td style={styles.td}>
                      <StatusPill
                        text={item.payment_status || "Pending"}
                      />
                    </td>

                    <td style={styles.td}>
                      {item.accepted_by_name ||
                        item.doctor_name ||
                        "Not accepted"}
                    </td>

                    <td style={styles.td}>
                      <StatusPill
                        text={
                          item.completed_at
                            ? "Completed"
                            : item.status || "Pending"
                        }
                      />
                    </td>

                    <td style={styles.td}>
                      {item.created_at
                        ? new Date(
                            item.created_at
                          ).toLocaleDateString("en-ZA")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <footer style={styles.footer}>
          SymptomAI • Admin Analytics • Data from Supabase
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  note,
  danger = false,
}: {
  label: string;
  value: string | number;
  note: string;
  danger?: boolean;
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>

      <h2
        style={{
          ...styles.statValue,
          ...(danger ? styles.dangerValue : {}),
        }}
      >
        {value}
      </h2>

      <p style={styles.statNote}>{note}</p>
    </div>
  );
}

function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const width =
    total > 0
      ? Math.min((value / total) * 100, 100)
      : 0;

  return (
    <div style={styles.progressBlock}>
      <div style={styles.progressHeader}>
        <span>{label}</span>

        <strong>{value}</strong>
      </div>

      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressBar,
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.miniStat}>
      <strong style={styles.miniValue}>{value}</strong>
      <span style={styles.miniLabel}>{label}</span>
    </div>
  );
}

function StatusBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.statusBox}>
      <span style={styles.statusValue}>{value}</span>
      <span style={styles.statusLabel}>{label}</span>
    </div>
  );
}

function StatusPill({ text }: { text: string }) {
  const value = normalise(text);

  let background = "#263348";
  let color = "#dce4ee";

  if (
    value === "paid" ||
    value === "completed" ||
    value === "complete" ||
    value === "accepted"
  ) {
    background = "rgba(80, 255, 154, 0.14)";
    color = "#50ff9a";
  }

  if (
    value === "failed" ||
    value === "emergency"
  ) {
    background = "rgba(255, 87, 87, 0.14)";
    color = "#ff7777";
  }

  return (
    <span
      style={{
        ...styles.pill,
        background,
        color,
      }}
    >
      {text}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #06131d 0%, #081c28 50%, #092634 100%)",
    color: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "32px 20px",
  },

  container: {
    maxWidth: "1450px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  logo: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    background: "#50ff9a",
    color: "#052018",
    fontWeight: 900,
    fontSize: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: "30px",
    margin: 0,
    fontWeight: 800,
  },

  subtitle: {
    color: "#8ea5b5",
    margin: "5px 0 0",
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    background: "#102735",
    padding: "9px 14px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
  },

  liveDot: {
    width: "8px",
    height: "8px",
    background: "#50ff9a",
    borderRadius: "50%",
  },

  warning: {
    background: "rgba(255,176,32,0.13)",
    border: "1px solid rgba(255,176,32,0.35)",
    padding: "14px 16px",
    borderRadius: "12px",
    marginBottom: "20px",
  },

  grid4: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginBottom: "18px",
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "18px",
    marginBottom: "18px",
  },

  statCard: {
    background: "rgba(13, 34, 47, 0.95)",
    border: "1px solid #183b4f",
    borderRadius: "18px",
    padding: "22px",
  },

  statLabel: {
    color: "#8ea5b5",
    fontSize: "13px",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },

  statValue: {
    fontSize: "33px",
    margin: "10px 0 5px",
    color: "#50ff9a",
  },

  dangerValue: {
    color: "#ff7777",
  },

  statNote: {
    color: "#8499a8",
    fontSize: "13px",
    margin: 0,
  },

  card: {
    background: "rgba(13, 34, 47, 0.95)",
    border: "1px solid #183b4f",
    borderRadius: "18px",
    padding: "22px",
    marginBottom: "18px",
  },

  cardTitle: {
    marginTop: 0,
    fontSize: "18px",
    marginBottom: "22px",
  },

  progressBlock: {
    marginBottom: "19px",
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    fontSize: "14px",
  },

  progressTrack: {
    height: "8px",
    background: "#183546",
    borderRadius: "100px",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    background: "#50ff9a",
    borderRadius: "100px",
  },

  conversionBox: {
    marginTop: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "17px",
    background: "#102b36",
    borderRadius: "13px",
    color: "#50ff9a",
  },

  ageGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(85px, 1fr))",
    gap: "10px",
    marginTop: "24px",
  },

  miniStat: {
    background: "#102b36",
    padding: "13px",
    borderRadius: "12px",
    textAlign: "center",
  },

  miniValue: {
    display: "block",
    fontSize: "19px",
    color: "#50ff9a",
  },

  miniLabel: {
    fontSize: "12px",
    color: "#8ea5b5",
  },

  statusGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },

  statusBox: {
    background: "#102b36",
    borderRadius: "14px",
    padding: "20px",
  },

  statusValue: {
    display: "block",
    fontSize: "27px",
    fontWeight: 800,
    color: "#50ff9a",
  },

  statusLabel: {
    color: "#8ea5b5",
    fontSize: "13px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1000px",
  },

  th: {
    color: "#7791a3",
    padding: "12px",
    borderBottom: "1px solid #1a3b4c",
    textAlign: "left",
    fontSize: "12px",
    textTransform: "uppercase",
  },

  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #153344",
    fontSize: "13px",
  },

  smallText: {
    color: "#708a99",
    marginTop: "4px",
    fontSize: "11px",
  },

  pill: {
    padding: "5px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
  },

  muted: {
    color: "#8097a6",
  },

  footer: {
    color: "#557080",
    fontSize: "12px",
    textAlign: "center",
    padding: "15px",
  },
};
