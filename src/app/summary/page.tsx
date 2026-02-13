"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthProvider";
import { calculateDurationInHours } from "@/lib/calculations";
import type { Database } from "@/lib/supabase/types";

type WorkEntryRow = Database["public"]["Tables"]["work_entries"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

interface JobSummary {
  jobId: string;
  jobName: string;
  hours: number;
  km: number;
  labor: number;
  expenses: number;
  grand: number;
}

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function SummaryPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth);
  const [entries, setEntries] = useState<WorkEntryRow[]>([]);
  const [jobMap, setJobMap] = useState<Record<string, JobRow>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const from = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;

      const { data: monthEntries, error: e1 } = await getSupabase()
        .from("work_entries")
        .select("*")
        .gte("date", from)
        .lte("date", to);

      if (e1) throw e1;

      const { data: allJobs, error: e2 } = await getSupabase()
        .from("jobs")
        .select("*");

      if (e2) throw e2;

      setEntries(monthEntries ?? []);

      const map: Record<string, JobRow> = {};
      for (const j of allJobs ?? []) {
        map[j.id] = j;
      }
      setJobMap(map);
    } catch (e) {
      console.error("Failed to load summary", e);
      setError("Nepodařilo se načíst přehled.");
    }
  }, [month, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute per-job summaries
  const byJob = new Map<string, JobSummary>();

  for (const entry of entries) {
    let summary = byJob.get(entry.job_id);
    if (!summary) {
      summary = {
        jobId: entry.job_id,
        jobName: jobMap[entry.job_id]?.name ?? "–",
        hours: 0,
        km: 0,
        labor: 0,
        expenses: 0,
        grand: 0,
      };
      byJob.set(entry.job_id, summary);
    }

    let hours = 0;
    try {
      hours = calculateDurationInHours(entry.start_time, entry.end_time);
    } catch {
      // skip invalid
    }

    summary.hours += hours;
    summary.km += Number(entry.kilometers);
    summary.labor += Number(entry.labor_total);
    summary.expenses += Number(entry.expenses_total);
    summary.grand += Number(entry.grand_total);
  }

  const summaries = Array.from(byJob.values());

  const totals = summaries.reduce(
    (acc, s) => ({
      hours: acc.hours + s.hours,
      km: acc.km + s.km,
      labor: acc.labor + s.labor,
      expenses: acc.expenses + s.expenses,
      grand: acc.grand + s.grand,
    }),
    { hours: 0, km: 0, labor: 0, expenses: 0, grand: 0 }
  );

  return (
    <div>
      <h1>Měsíční přehled</h1>
      {error && <p className="error-message">{error}</p>}

      <label>
        Měsíc:
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>

      {entries.length === 0 ? (
        <p style={{ marginTop: 16 }}>Žádné záznamy pro tento měsíc.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {summaries.map((s) => (
            <div
              key={s.jobId}
              style={{
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 8,
              }}
            >
              <strong style={{ fontSize: 16 }}>{s.jobName}</strong>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 16px",
                  marginTop: 8,
                  fontSize: 14,
                  color: "#555",
                }}
              >
                <span>Hodiny:</span>
                <span style={{ textAlign: "right" }}>{s.hours.toFixed(2)}</span>
                <span>Km:</span>
                <span style={{ textAlign: "right" }}>{s.km.toFixed(1)}</span>
                <span>Práce:</span>
                <span style={{ textAlign: "right" }}>{s.labor.toFixed(0)} Kč</span>
                <span>Výdaje:</span>
                <span style={{ textAlign: "right" }}>{s.expenses.toFixed(0)} Kč</span>
                <span style={{ fontWeight: 600, color: "#111" }}>Celkem:</span>
                <span style={{ textAlign: "right", fontWeight: 600, color: "#111" }}>{s.grand.toFixed(0)} Kč</span>
              </div>
            </div>
          ))}

          {/* Totals card */}
          <div
            style={{
              padding: 12,
              border: "2px solid #333",
              borderRadius: 8,
              background: "#f8f8f8",
            }}
          >
            <strong style={{ fontSize: 16 }}>Celkem</strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 16px",
                marginTop: 8,
                fontSize: 14,
              }}
            >
              <span>Hodiny:</span>
              <span style={{ textAlign: "right" }}>{totals.hours.toFixed(2)}</span>
              <span>Km:</span>
              <span style={{ textAlign: "right" }}>{totals.km.toFixed(1)}</span>
              <span>Práce:</span>
              <span style={{ textAlign: "right" }}>{totals.labor.toFixed(0)} Kč</span>
              <span>Výdaje:</span>
              <span style={{ textAlign: "right" }}>{totals.expenses.toFixed(0)} Kč</span>
              <span style={{ fontWeight: 700 }}>Celkem:</span>
              <span style={{ textAlign: "right", fontWeight: 700 }}>{totals.grand.toFixed(0)} Kč</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
