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

type AnyRow = Record<string, any>;

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

function normalise(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function getAge(date?: string | null) {
  if (!date) return null;

  const dob = new Date(date);

  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const now = new Date();

  let age = now.getFullYear() - dob.getFullYear();

  const monthDifference = now.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      now.getDate() < dob.getDate())
  ) {
    age--;
  }

  return age;
}

function displayText(value: any) {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getPatientName(patient: AnyRow, referral: AnyRow) {
  if (referral.patient_name) {
    return referral.patient_name;
  }

  if (patient.patient_name) {
    return patient.patient_name;
  }

  if (patient.full_name) {
    return patient.full_name;
  }

  const combined = [
    patient.first_name,
    patient.surname,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (combined) {
    return combined;
  }

  return "Patient";
}

function getConsultationReason(
  referral: AnyRow,
  triage: AnyRow
) {
  return (
    referral.consultation_reason ||
    triage.consultation_reason ||
    triage.consultationReason ||
    triage.reason ||
    triage.referral_reason ||
    triage.reason_for_consultation ||
    "Not recorded"
  );
}

function getTriageOutcome(
  referral: AnyRow,
  triage: AnyRow
) {
  return (
    referral.triage_outcome ||
    triage.triage_outcome ||
    triage.outcome ||
    triage.recommendation ||
    triage.disposition ||
    triage.triage_result ||
    triage.final_recommendation ||
    ""
  );
}

function getSymptoms(triage: AnyRow) {
  return (
    triage.symptoms ||
    triage.selected_symptoms ||
    triage.symptom_list ||
    triage.symptom ||
    []
  );
}

function getRedFlags(triage: AnyRow) {
  return (
    triage.red_flags ||
    triage.redFlags ||
    triage.red_flag ||
    []
  );
}

export default async function AdminDashboardPage() {
  const [
    referralsResult,
    patientsResult,
    triageResult,
  ] = await Promise.all([
    supabase
      .from("symptomai_referrals")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("patients")
      .select("*"),

    supabase
      .from("symptomai_triage")
      .select("*")
      .order("created_at", {
        ascending: false,
      }),
  ]);

  const referrals: AnyRow[] =
    referralsResult.data || [];

  const patients: AnyRow[] =
    patientsResult.data || [];

  const triages: AnyRow[] =
    triageResult.data || [];

  const errors = [
    referralsResult.error,
    patientsResult.error,
    triageResult.error,
  ].filter(Boolean);

  if (referralsResult.error) {
    console.error(
      "symptomai_referrals error:",
      referralsResult.error
    );
  }

  if (patientsResult.error) {
    console.error(
      "patients error:",
      patientsResult.error
    );
  }

  if (triageResult.error) {
    console.error(
      "symptomai_triage error:",
      triageResult.error
    );
  }

  /*
   * ------------------------------------
   * BUILD PATIENT LOOKUP
   * ------------------------------------
   */

  const patientMap = new Map<string, AnyRow>();

  patients.forEach((patient) => {
    if (patient.id) {
      patientMap.set(
        String(patient.id),
        patient
      );
    }

    if (patient.patient_id) {
      patientMap.set(
        String(patient.patient_id),
        patient
      );
    }

    if (patient.id_number) {
      patientMap.set(
        String(patient.id_number),
        patient
      );
    }

    if (patient.national_id) {
      patientMap.set(
        String(patient.national_id),
        patient
      );
    }
  });

  /*
   * ------------------------------------
   * BUILD TRIAGE LOOKUP
   * ------------------------------------
   */

  const triageMap = new Map<string, AnyRow>();

  triages.forEach((triage) => {
    if (triage.id) {
      triageMap.set(
        String(triage.id),
        triage
      );
    }

    if (triage.triage_id) {
      triageMap.set(
        String(triage.triage_id),
        triage
      );
    }
  });

  /*
   * ------------------------------------
   * NORMALISE REFERRALS
   * ------------------------------------
   */

  const rows = referrals.map((referral) => {
    const patient =
      patientMap.get(
        String(referral.patient_id || "")
      ) || {};

    const triage =
      triageMap.get(
        String(referral.triage_id || "")
      ) || {};

    const patientName =
      getPatientName(patient, referral);

    const gender =
      patient.gender ||
      referral.gender ||
      "";

    const dateOfBirth =
      patient.date_of_birth ||
      patient.dob ||
      referral.date_of_birth ||
      null;

    const patientEmail =
      referral.patient_email ||
      patient.email ||
      "";

    const patientMobile =
      referral.patient_mobile ||
      patient.mobile ||
      patient.phone ||
      "";

    const consultationReason =
      getConsultationReason(
        referral,
        triage
      );

    const triageOutcome =
      getTriageOutcome(
        referral,
        triage
      );

    const symptoms =
      getSymptoms(triage);

    const redFlags =
      getRedFlags(triage);

    return {
      ...referral,

      patientName,
      patientEmail,
      patientMobile,

      gender,
      dateOfBirth,

      consultationReason,
      triageOutcome,

      symptoms,
      redFlags,

      doctorName:
        referral.assigned_doctor_name ||
        "Not accepted",

      doctorId:
        referral.assigned_doctor_id ||
        null,

      paymentStatus:
        referral.payment_status ||
        "pending",

      referralStatus:
        referral.referral_status ||
        "pending",

      paymentAmount:
        Number(
          referral.payment_amount || 0
        ),
    };
  });

  /*
   * ------------------------------------
   * DATE FILTERS
   * ------------------------------------
   */

  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const todayString =
    now.toISOString().slice(0, 10);

  const todayReferrals =
    rows.filter((item) =>
      item.created_at?.startsWith(
        todayString
      )
    );

  const monthlyReferrals =
    rows.filter((item) => {
      if (!item.created_at) {
        return false;
      }

      return (
        new Date(item.created_at) >=
        monthStart
      );
    });

  /*
   * ------------------------------------
   * PAYMENT METRICS
   * ------------------------------------
   */

  const paid = rows.filter(
    (item) =>
      normalise(item.paymentStatus) ===
      "paid"
  );

  const pendingPayment =
    rows.filter((item) => {
      const payment =
        normalise(item.paymentStatus);

      const status =
        normalise(item.referralStatus);

      return (
        payment === "pending" ||
        payment === "not_started" ||
        payment === "verifying" ||
        status ===
          "awaiting_payment"
      );
    });

  /*
   * ------------------------------------
   * ACCEPTED / COMPLETED
   * ------------------------------------
   */

  const accepted = rows.filter(
    (item) =>
      Boolean(item.accepted_at) ||
      Boolean(item.doctorId) ||
      Boolean(
        item.assigned_doctor_name
      ) ||
      normalise(
        item.referralStatus
      ) === "accepted" ||
      normalise(
        item.referralStatus
      ) === "completed"
  );

  const completed = rows.filter(
    (item) =>
      normalise(
        item.referralStatus
      ) === "completed" ||
      Boolean(item.completed_at)
  );

  /*
   * ------------------------------------
   * REVENUE
   * ------------------------------------
   */

  const monthPaid = paid.filter(
    (item) => {
      if (!item.created_at) {
        return false;
      }

      return (
        new Date(item.created_at) >=
        monthStart
      );
    });

  const revenue =
    monthPaid.reduce(
      (sum, item) => {
        const amount =
          Number(
            item.paymentAmount
          );

        return (
          sum +
          (amount > 0
            ? amount
            : 250)
        );
      },
      0
    );

  /*
   * ------------------------------------
   * UNIQUE PATIENTS
   * ------------------------------------
   */

  const uniquePatients =
    new Set(
      rows
        .map(
          (item) =>
            item.patient_id ||
            item.patientEmail ||
            item.patientName
        )
        .filter(Boolean)
    ).size;

  /*
   * ------------------------------------
   * DEMOGRAPHICS
   * ------------------------------------
   */

  const female = rows.filter(
    (item) =>
      normalise(item.gender) ===
      "female"
  );

  const male = rows.filter(
    (item) =>
      normalise(item.gender) ===
      "male"
  );

  const demographicsTotal =
    female.length +
    male.length;

  const ageGroups = {
    under18: 0,
    age18to30: 0,
    age31to45: 0,
    age46to60: 0,
    over60: 0,
  };

  rows.forEach((item) => {
    const age =
      getAge(item.dateOfBirth);

    if (age === null) {
      return;
    }

    if (age < 18) {
      ageGroups.under18++;
    } else if (age <= 30) {
      ageGroups.age18to30++;
    } else if (age <= 45) {
      ageGroups.age31to45++;
    } else if (age <= 60) {
      ageGroups.age46to60++;
    } else {
      ageGroups.over60++;
    }
  });

  /*
   * ------------------------------------
   * CONSULTATION REASONS
   * ------------------------------------
   */

  const reasons:
    Record<string, number> = {};

  rows.forEach((item) => {
    const reason =
      item.consultationReason ||
      "Not recorded";

    reasons[reason] =
      (reasons[reason] || 0) + 1;
  });

  const reasonRows =
    Object.entries(reasons)
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 8);

  /*
   * ------------------------------------
   * TRIAGE OUTCOMES
   * ------------------------------------
   */

  const outcomeCounts:
    Record<string, number> = {};

  triages.forEach((triage) => {
    const outcome =
      getTriageOutcome({}, triage) ||
      "Not recorded";

    outcomeCounts[outcome] =
      (outcomeCounts[outcome] || 0) +
      1;
  });

  const outcomeRows =
    Object.entries(outcomeCounts)
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 8);

  /*
   * ------------------------------------
   * EMERGENCY
   * ------------------------------------
   */

  const emergencyTriages =
    triages.filter((triage) => {
      const outcome =
        normalise(
          getTriageOutcome(
            {},
            triage
          )
        );

      return (
        outcome.includes(
          "emergency"
        ) ||
        outcome.includes("urgent")
      );
    });

  /*
   * ------------------------------------
   * RED FLAGS
   * ------------------------------------
   */

  const redFlagCases =
    triages.filter((triage) => {
      const flags =
        getRedFlags(triage);

      if (Array.isArray(flags)) {
        return flags.length > 0;
      }

      if (
        typeof flags === "string"
      ) {
        return flags.trim() !== "";
      }

      if (
        typeof flags === "object" &&
        flags !== null
      ) {
        return (
          Object.keys(flags).length >
          0
        );
      }

      return false;
    });

  /*
   * ------------------------------------
   * SYMPTOMS
   * ------------------------------------
   */

  const symptomCounts:
    Record<string, number> = {};

  triages.forEach((triage) => {
    const symptoms =
      getSymptoms(triage);

    if (Array.isArray(symptoms)) {
      symptoms.forEach(
        (symptom) => {
          const label =
            displayText(
              symptom
            ).trim();

          if (!label) return;

          symptomCounts[label] =
            (symptomCounts[
              label
            ] || 0) + 1;
        }
      );
    } else if (
      typeof symptoms ===
      "string"
    ) {
      symptoms
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
        .forEach(
          (symptom) => {
            symptomCounts[
              symptom
            ] =
              (symptomCounts[
                symptom
              ] || 0) + 1;
          }
        );
    }
  });

  const topSymptoms =
    Object.entries(
      symptomCounts
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 10);

  /*
   * ------------------------------------
   * DOCTOR PERFORMANCE
   * ------------------------------------
   */

  const doctorCounts:
    Record<string, number> = {};

  accepted.forEach((item) => {
    const doctor =
      item.doctorName ||
      "Unknown";

    if (
      doctor === "Not accepted"
    ) {
      return;
    }

    doctorCounts[doctor] =
      (doctorCounts[doctor] ||
        0) + 1;
  });

  const doctorRows =
    Object.entries(
      doctorCounts
    )
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 10);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logo}>
              S
            </div>

            <div>
              <h1 style={styles.title}>
                SymptomAI Admin
              </h1>

              <p
                style={
                  styles.subtitle
                }
              >
                Clinical triage,
                referral and virtual
                consultation analytics
              </p>
            </div>
          </div>

          <div
            style={
              styles.liveBadge
            }
          >
            <span
              style={
                styles.liveDot
              }
            />
            LIVE
          </div>
        </header>

        {errors.length > 0 && (
          <div
            style={
              styles.warning
            }
          >
            Some dashboard
            datasets could not be
            loaded. Check the
            Vercel server logs for
            the Supabase query
            error.
          </div>
        )}

        {/* PRIMARY KPIs */}

        <section
          style={styles.grid4}
        >
          <StatCard
            label="Total Triages"
            value={triages.length}
            note="All SymptomAI triage records"
          />

          <StatCard
            label="Virtual Consult Referrals"
            value={rows.length}
            note={`${todayReferrals.length} today`}
          />

          <StatCard
            label="Paid Consults"
            value={paid.length}
            note={`${percentage(
              paid.length,
              rows.length
            )} referral conversion`}
          />

          <StatCard
            label="Revenue This Month"
            value={formatMoney(
              revenue
            )}
            note={`${monthPaid.length} paid consultations`}
          />
        </section>

        <section
          style={styles.grid4}
        >
          <StatCard
            label="Unique Patients"
            value={
              uniquePatients
            }
            note="Referral patients"
          />

          <StatCard
            label="Doctor Accepted"
            value={
              accepted.length
            }
            note={`${percentage(
              accepted.length,
              rows.length
            )} of referrals`}
          />

          <StatCard
            label="Completed"
            value={
              completed.length
            }
            note={`${percentage(
              completed.length,
              rows.length
            )} completion`}
          />

          <StatCard
            label="Emergency / Urgent"
            value={
              emergencyTriages.length
            }
            note="Clinical escalation"
            danger
          />
        </section>

        {/* FUNNEL + DEMOGRAPHICS */}

        <section
          style={
            styles.twoColumn
          }
        >
          <DashboardCard title="Virtual Consultation Funnel">
            <ProgressRow
              label="Referral created"
              value={rows.length}
              total={rows.length}
            />

            <ProgressRow
              label="Payment confirmed"
              value={paid.length}
              total={rows.length}
            />

            <ProgressRow
              label="Doctor accepted"
              value={
                accepted.length
              }
              total={rows.length}
            />

            <ProgressRow
              label="Consultation completed"
              value={
                completed.length
              }
              total={rows.length}
            />

            <div
              style={
                styles.conversionBox
              }
            >
              <span>
                Paid conversion
              </span>

              <strong>
                {percentage(
                  paid.length,
                  rows.length
                )}
              </strong>
            </div>
          </DashboardCard>

          <DashboardCard title="Patient Demographics">
            <ProgressRow
              label="Female"
              value={
                female.length
              }
              total={
                demographicsTotal
              }
            />

            <ProgressRow
              label="Male"
              value={
                male.length
              }
              total={
                demographicsTotal
              }
            />

            <div
              style={
                styles.ageGrid
              }
            >
              <MiniStat
                label="<18"
                value={
                  ageGroups.under18
                }
              />

              <MiniStat
                label="18–30"
                value={
                  ageGroups.age18to30
                }
              />

              <MiniStat
                label="31–45"
                value={
                  ageGroups.age31to45
                }
              />

              <MiniStat
                label="46–60"
                value={
                  ageGroups.age46to60
                }
              />

              <MiniStat
                label="60+"
                value={
                  ageGroups.over60
                }
              />
            </div>
          </DashboardCard>
        </section>

        {/* TRIAGE */}

        <section
          style={
            styles.twoColumn
          }
        >
          <DashboardCard title="Triage Outcomes">
            {outcomeRows.length ===
            0 ? (
              <p
                style={
                  styles.muted
                }
              >
                No triage outcome
                data found.
              </p>
            ) : (
              outcomeRows.map(
                ([
                  outcome,
                  count,
                ]) => (
                  <ProgressRow
                    key={
                      outcome
                    }
                    label={
                      outcome
                    }
                    value={
                      count
                    }
                    total={
                      triages.length
                    }
                  />
                )
              )
            )}
          </DashboardCard>

          <DashboardCard title="Clinical Safety">
            <div
              style={
                styles.statusGrid
              }
            >
              <StatusBox
                label="Total Triages"
                value={
                  triages.length
                }
              />

              <StatusBox
                label="Red Flag Cases"
                value={
                  redFlagCases.length
                }
              />

              <StatusBox
                label="Emergency / Urgent"
                value={
                  emergencyTriages.length
                }
              />

              <StatusBox
                label="VC Referrals"
                value={rows.length}
              />
            </div>
          </DashboardCard>
        </section>

        {/* REASONS + STATUS */}

        <section
          style={
            styles.twoColumn
          }
        >
          <DashboardCard title="Consultation Reasons">
            {reasonRows.length ===
            0 ? (
              <p
                style={
                  styles.muted
                }
              >
                No consultation
                reason data found.
              </p>
            ) : (
              reasonRows.map(
                ([
                  reason,
                  count,
                ]) => (
                  <ProgressRow
                    key={reason}
                    label={reason}
                    value={count}
                    total={
                      rows.length
                    }
                  />
                )
              )
            )}
          </DashboardCard>

          <DashboardCard title="Operational Status">
            <div
              style={
                styles.statusGrid
              }
            >
              <StatusBox
                label="Pending Payment"
                value={
                  pendingPayment.length
                }
              />

              <StatusBox
                label="Paid"
                value={
                  paid.length
                }
              />

              <StatusBox
                label="Accepted"
                value={
                  accepted.length
                }
              />

              <StatusBox
                label="Completed"
                value={
                  completed.length
                }
              />
            </div>
          </DashboardCard>
        </section>

        {/* SYMPTOMS + DOCTORS */}

        <section
          style={
            styles.twoColumn
          }
        >
          <DashboardCard title="Top Symptoms">
            {topSymptoms.length ===
            0 ? (
              <p
                style={
                  styles.muted
                }
              >
                No symptom data
                found in
                symptomai_triage.
              </p>
            ) : (
              topSymptoms.map(
                ([
                  symptom,
                  count,
                ]) => (
                  <ProgressRow
                    key={
                      symptom
                    }
                    label={
                      symptom
                    }
                    value={
                      count
                    }
                    total={
                      triages.length
                    }
                  />
                )
              )
            )}
          </DashboardCard>

          <DashboardCard title="Doctor Activity">
            {doctorRows.length ===
            0 ? (
              <p
                style={
                  styles.muted
                }
              >
                No assigned doctor
                data found.
              </p>
            ) : (
              doctorRows.map(
                ([
                  doctor,
                  count,
                ]) => (
                  <ProgressRow
                    key={doctor}
                    label={doctor}
                    value={count}
                    total={
                      accepted.length
                    }
                  />
                )
              )
            )}
          </DashboardCard>
        </section>

        {/* RECENT REFERRALS */}

        <DashboardCard title="Recent Virtual Consult Referrals">
          <div
            style={
              styles.tableWrapper
            }
          >
            <table
              style={styles.table}
            >
              <thead>
                <tr>
                  <th
                    style={
                      styles.th
                    }
                  >
                    Patient
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Referral
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Reason
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Payment
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Doctor
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows
                  .slice(0, 30)
                  .map(
                    (
                      item,
                      index
                    ) => (
                      <tr
                        key={
                          item.id ||
                          index
                        }
                      >
                        <td
                          style={
                            styles.td
                          }
                        >
                          <strong>
                            {
                              item.patientName
                            }
                          </strong>

                          <div
                            style={
                              styles.smallText
                            }
                          >
                            {item.patientEmail ||
                              item.patient_id ||
                              ""}
                          </div>
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {item.referral_code ||
                            "—"}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {
                            item.consultationReason
                          }
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <StatusPill
                            text={
                              item.paymentStatus
                            }
                          />
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {
                            item.doctorName
                          }
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <StatusPill
                            text={
                              item.referralStatus
                            }
                          />
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {item.created_at
                            ? new Date(
                                item.created_at
                              ).toLocaleDateString(
                                "en-ZA"
                              )
                            : "—"}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <footer
          style={styles.footer}
        >
          SymptomAI • Clinical
          Triage & Virtual Consult
          Analytics • Supabase
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
    <div
      style={styles.statCard}
    >
      <p
        style={
          styles.statLabel
        }
      >
        {label}
      </p>

      <h2
        style={{
          ...styles.statValue,
          ...(danger
            ? styles.dangerValue
            : {}),
        }}
      >
        {value}
      </h2>

      <p
        style={styles.statNote}
      >
        {note}
      </p>
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
      <h3
        style={
          styles.cardTitle
        }
      >
        {title}
      </h3>

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
      ? Math.min(
          (value / total) * 100,
          100
        )
      : 0;

  return (
    <div
      style={
        styles.progressBlock
      }
    >
      <div
        style={
          styles.progressHeader
        }
      >
        <span>{label}</span>

        <strong>
          {value}
        </strong>
      </div>

      <div
        style={
          styles.progressTrack
        }
      >
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
    <div
      style={
        styles.miniStat
      }
    >
      <strong
        style={
          styles.miniValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.miniLabel
        }
      >
        {label}
      </span>
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
    <div
      style={
        styles.statusBox
      }
    >
      <span
        style={
          styles.statusValue
        }
      >
        {value}
      </span>

      <span
        style={
          styles.statusLabel
        }
      >
        {label}
      </span>
    </div>
  );
}

function StatusPill({
  text,
}: {
  text: string;
}) {
  const value =
    normalise(text);

  let background =
    "#263348";

  let color =
    "#dce4ee";

  if (
    value === "paid" ||
    value === "completed" ||
    value === "complete" ||
    value === "accepted"
  ) {
    background =
      "rgba(80, 255, 154, 0.14)";

    color = "#50ff9a";
  }

  if (
    value ===
      "awaiting_payment" ||
    value === "pending"
  ) {
    background =
      "rgba(255, 190, 70, 0.14)";

    color = "#ffcf6e";
  }

  if (
    value === "failed" ||
    value === "emergency"
  ) {
    background =
      "rgba(255, 87, 87, 0.14)";

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
      {text.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #06131d 0%, #081c28 50%, #092634 100%)",
    color: "#ffffff",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    padding: "32px 20px",
  },

  container: {
    maxWidth: "1450px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
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
    justifyContent:
      "center",
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
    background:
      "rgba(255,176,32,0.13)",
    border:
      "1px solid rgba(255,176,32,0.35)",
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
    background:
      "rgba(13, 34, 47, 0.95)",
    border:
      "1px solid #183b4f",
    borderRadius: "18px",
    padding: "22px",
  },

  statLabel: {
    color: "#8ea5b5",
    fontSize: "13px",
    margin: 0,
    textTransform:
      "uppercase",
    letterSpacing:
      "0.6px",
  },

  statValue: {
    fontSize: "33px",
    margin:
      "10px 0 5px",
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
    background:
      "rgba(13, 34, 47, 0.95)",
    border:
      "1px solid #183b4f",
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
    justifyContent:
      "space-between",
    marginBottom: "8px",
    fontSize: "14px",
  },

  progressTrack: {
    height: "8px",
    background: "#183546",
    borderRadius:
      "100px",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    background: "#50ff9a",
    borderRadius:
      "100px",
  },

  conversionBox: {
    marginTop: "24px",
    display: "flex",
    justifyContent:
      "space-between",
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
    gridTemplateColumns:
      "1fr 1fr",
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
    borderCollapse:
      "collapse",
    minWidth: "1100px",
  },

  th: {
    color: "#7791a3",
    padding: "12px",
    borderBottom:
      "1px solid #1a3b4c",
    textAlign: "left",
    fontSize: "12px",
    textTransform:
      "uppercase",
  },

  td: {
    padding:
      "14px 12px",
    borderBottom:
      "1px solid #153344",
    fontSize: "13px",
  },

  smallText: {
    color: "#708a99",
    marginTop: "4px",
    fontSize: "11px",
  },

  pill: {
    padding: "5px 9px",
    borderRadius:
      "999px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform:
      "capitalize",
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
