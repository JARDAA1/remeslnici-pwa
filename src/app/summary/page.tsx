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
      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>
        Měsíc:
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ marginLeft: 8 }}
        />
      </label>

      {entries.length === 0 ? (
        <p style={{ marginTop: 16 }}>Žádné záznamy pro tento měsíc.</p>
      ) : (
        <>
          <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Zakázka</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Hodiny</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Km</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Práce</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Výdaje</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Celkem</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.jobId}>
                  <td style={{ padding: 4 }}>{s.jobName}</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{s.hours.toFixed(2)}</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{s.km.toFixed(1)}</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{s.labor.toFixed(2)} Kč</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{s.expenses.toFixed(2)} Kč</td>
                  <td style={{ padding: 4, textAlign: "right" }}>{s.grand.toFixed(2)} Kč</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
                <td style={{ padding: 4 }}>Celkem</td>
                <td style={{ padding: 4, textAlign: "right" }}>{totals.hours.toFixed(2)}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{totals.km.toFixed(1)}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{totals.labor.toFixed(2)} Kč</td>
                <td style={{ padding: 4, textAlign: "right" }}>{totals.expenses.toFixed(2)} Kč</td>
                <td style={{ padding: 4, textAlign: "right" }}>{totals.grand.toFixed(2)} Kč</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}
