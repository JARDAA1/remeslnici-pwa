"use client";

import { useEffect, useState, useCallback } from "react";
import * as workEntryRepository from "@/lib/repositories/workEntryRepository";
import * as jobRepository from "@/lib/repositories/jobRepository";
import { calculateDurationInHours } from "@/lib/calculations";
import type { WorkEntry, Job } from "@/types";

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
  const [month, setMonth] = useState(getCurrentMonth);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [jobMap, setJobMap] = useState<Record<string, Job>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // month is "YYYY-MM", derive date range
      const from = `${month}-01`;
      // Last day: go to first day of next month, subtract 1 day
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;

      const [monthEntries, allJobs] = await Promise.all([
        workEntryRepository.getByDateRange(from, to),
        jobRepository.getAll(),
      ]);

      setEntries(monthEntries);

      const map: Record<string, Job> = {};
      for (const j of allJobs) {
        map[j.id] = j;
      }
      setJobMap(map);
    } catch (e) {
      console.error("Failed to load summary", e);
      setError("Nepodařilo se načíst přehled.");
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute per-job summaries
  const byJob = new Map<string, JobSummary>();

  for (const entry of entries) {
    let summary = byJob.get(entry.jobId);
    if (!summary) {
      summary = {
        jobId: entry.jobId,
        jobName: jobMap[entry.jobId]?.name ?? "–",
        hours: 0,
        km: 0,
        labor: 0,
        expenses: 0,
        grand: 0,
      };
      byJob.set(entry.jobId, summary);
    }

    let hours = 0;
    try {
      hours = calculateDurationInHours(entry.startTime, entry.endTime);
    } catch {
      // skip invalid
    }

    summary.hours += hours;
    summary.km += entry.kilometers;
    summary.labor += entry.laborTotal;
    summary.expenses += entry.expensesTotal;
    summary.grand += entry.grandTotal;
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
