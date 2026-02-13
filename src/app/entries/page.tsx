"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthProvider";
import {
  deleteWorkEntry,
  updateWorkEntry,
} from "@/lib/services/workEntryService";
import { calculateDurationInHours } from "@/lib/calculations";
import { toLocalISO, toLocalDate } from "@/lib/utils/time";
import type { Database } from "@/lib/supabase/types";

type WorkEntryRow = Database["public"]["Tables"]["work_entries"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

interface ExpenseFormRow {
  amount: string;
  category: string;
  file: File | null;
  existingReceiptUrl: string;
}

interface EditState {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  jobId: string;
  hourlyRate: string;
  kilometers: string;
  kmRate: string;
  expenses: ExpenseFormRow[];
}

export default function EntriesPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WorkEntryRow[]>([]);
  const [jobMap, setJobMap] = useState<Record<string, JobRow>>({});
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data: allEntries, error: e1 } = await getSupabase()
        .from("work_entries")
        .select("*")
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (e1) throw e1;

      const { data: allJobs, error: e2 } = await getSupabase()
        .from("jobs")
        .select("*");

      if (e2) throw e2;

      setEntries(allEntries ?? []);
      setJobs(allJobs ?? []);

      const map: Record<string, JobRow> = {};
      for (const j of allJobs ?? []) {
        map[j.id] = j;
      }
      setJobMap(map);
    } catch (e) {
      console.error("Failed to load entries", e);
      setError("Nepodařilo se načíst záznamy.");
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    setError("");
    try {
      await deleteWorkEntry(id);
      await load();
    } catch (e) {
      console.error("Failed to delete entry", e);
      setError("Nepodařilo se smazat záznam. Pro uložení je potřeba připojení k internetu.");
    }
  }

  async function startEdit(entry: WorkEntryRow) {
    setError("");
    try {
      const { data: entryExpenses, error: expErr } = await getSupabase()
        .from("expenses")
        .select("*")
        .eq("work_entry_id", entry.id);

      if (expErr) throw expErr;

      const toLocalInput = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setEditing({
        id: entry.id,
        date: entry.date,
        startTime: toLocalInput(entry.start_time),
        endTime: toLocalInput(entry.end_time),
        jobId: entry.job_id,
        hourlyRate: String(entry.hourly_rate_used),
        kilometers: String(entry.kilometers),
        kmRate: String(entry.km_rate_used),
        expenses: (entryExpenses ?? []).map((exp: ExpenseRow) => ({
          amount: String(exp.amount),
          category: exp.category,
          file: null,
          existingReceiptUrl: exp.receipt_url ?? "",
        })),
      });
    } catch (e) {
      console.error("Failed to load entry for editing", e);
      setError("Nepodařilo se načíst záznam pro úpravu.");
    }
  }

  function cancelEdit() {
    setEditing(null);
    setError("");
  }

  function updateEditField(field: keyof EditState, value: string) {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  }

  function addEditExpense() {
    if (!editing) return;
    setEditing({
      ...editing,
      expenses: [...editing.expenses, { amount: "", category: "", file: null, existingReceiptUrl: "" }],
    });
  }

  function updateEditExpense(index: number, field: "amount" | "category", value: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      expenses: editing.expenses.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    });
  }

  function updateEditExpenseFile(index: number, file: File | null) {
    if (!editing) return;
    setEditing({
      ...editing,
      expenses: editing.expenses.map((row, i) =>
        i === index ? { ...row, file } : row
      ),
    });
  }

  function removeEditExpense(index: number) {
    if (!editing) return;
    setEditing({
      ...editing,
      expenses: editing.expenses.filter((_, i) => i !== index),
    });
  }

  async function handleEditSave() {
    if (!editing || saving || !user) return;
    setError("");

    const hourlyRate = parseFloat(editing.hourlyRate);
    const km = parseFloat(editing.kilometers) || 0;
    const kmRateNum = parseFloat(editing.kmRate) || 0;

    if (isNaN(hourlyRate) || hourlyRate < 0) {
      setError("Neplatná hodinová sazba.");
      return;
    }
    if (km < 0) {
      setError("Kilometry nemohou být záporné.");
      return;
    }
    if (kmRateNum < 0) {
      setError("Sazba za km nemůže být záporná.");
      return;
    }

    const startDate = new Date(editing.startTime);
    const endDate = new Date(editing.endTime);

    if (isNaN(startDate.getTime())) {
      setError("Neplatný čas začátku.");
      return;
    }
    if (isNaN(endDate.getTime())) {
      setError("Neplatný čas konce.");
      return;
    }
    if (endDate <= startDate) {
      setError("Konec musí být po začátku.");
      return;
    }

    const startISO = toLocalISO(startDate);
    const endISO = toLocalISO(endDate);

    // Validate expenses
    const expenseInputs: { amount: number; category: string; file: File | null }[] = [];
    for (let i = 0; i < editing.expenses.length; i++) {
      const row = editing.expenses[i];
      const amount = parseFloat(row.amount);
      if (isNaN(amount) || amount < 0) {
        setError(`Výdaj #${i + 1}: neplatná částka.`);
        return;
      }
      if (!row.category.trim()) {
        setError(`Výdaj #${i + 1}: kategorie je povinná.`);
        return;
      }
      expenseInputs.push({ amount, category: row.category.trim(), file: row.file });
    }

    const date = toLocalDate(startDate);

    setSaving(true);
    try {
      await updateWorkEntry({
        userId: user.id,
        id: editing.id,
        input: {
          date,
          startTime: startISO,
          endTime: endISO,
          jobId: editing.jobId,
          hourlyRateUsed: hourlyRate,
          kilometers: km,
          kmRateUsed: kmRateNum,
        },
        expenses: expenseInputs,
      });

      setEditing(null);
      await load();
    } catch (e) {
      console.error("Failed to update entry", e);
      setError("Nepodařilo se uložit změny. Pro uložení je potřeba připojení k internetu.");
    } finally {
      setSaving(false);
    }
  }

  // --- Helpers ---

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("cs-CZ");
  }

  function getHours(entry: WorkEntryRow): string {
    try {
      return calculateDurationInHours(entry.start_time, entry.end_time).toFixed(2);
    } catch {
      return "–";
    }
  }

  // --- Render ---

  return (
    <div>
      <h1>Záznamy</h1>
      {error && <p className="error-message">{error}</p>}

      {/* Edit form */}
      {editing && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: 16,
            marginBottom: 24,
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <h2>Upravit záznam</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Zakázka:
              <select
                value={editing.jobId}
                onChange={(e) => updateEditField("jobId", e.target.value)}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.client})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Začátek:
              <input
                type="datetime-local"
                value={editing.startTime}
                onChange={(e) => updateEditField("startTime", e.target.value)}
              />
            </label>

            <label>
              Konec:
              <input
                type="datetime-local"
                value={editing.endTime}
                onChange={(e) => updateEditField("endTime", e.target.value)}
              />
            </label>

            <label>
              Hodinová sazba (Kč):
              <input
                type="number"
                step="0.01"
                min="0"
                value={editing.hourlyRate}
                onChange={(e) => updateEditField("hourlyRate", e.target.value)}
              />
            </label>

            <label>
              Kilometry:
              <input
                type="number"
                step="0.1"
                min="0"
                value={editing.kilometers}
                onChange={(e) => updateEditField("kilometers", e.target.value)}
              />
            </label>

            <label>
              Sazba za km (Kč):
              <input
                type="number"
                step="0.01"
                min="0"
                value={editing.kmRate}
                onChange={(e) => updateEditField("kmRate", e.target.value)}
              />
            </label>

            <h3>Výdaje</h3>
            {editing.expenses.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              >
                <label>
                  Částka:
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount}
                    onChange={(e) => updateEditExpense(i, "amount", e.target.value)}
                  />
                </label>
                <label>
                  Kategorie:
                  <input
                    type="text"
                    value={row.category}
                    onChange={(e) => updateEditExpense(i, "category", e.target.value)}
                  />
                </label>
                <label>
                  Účtenka:
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => updateEditExpenseFile(i, e.target.files?.[0] ?? null)}
                  />
                </label>
                {row.file && <span style={{ fontSize: 12, color: "#666" }}>Nový: {row.file.name}</span>}
                {!row.file && row.existingReceiptUrl && (
                  <span style={{ fontSize: 12, color: "#666" }}>Existující účtenka</span>
                )}
                <button type="button" onClick={() => removeEditExpense(i)} data-compact="">
                  Odebrat výdaj
                </button>
              </div>
            ))}
            <button type="button" onClick={addEditExpense}>
              + Přidat výdaj
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              <button onClick={handleEditSave} disabled={saving} data-primary="">
                {saving ? "Ukládám…" : "Uložit změny"}
              </button>
              <button onClick={cancelEdit} disabled={saving}>
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry list — mobile cards */}
      {entries.length === 0 ? (
        <p>Žádné záznamy.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 8,
                background: editing?.id === entry.id ? "#eef6ff" : "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <strong>{formatDate(entry.date)}</strong>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {Number(entry.grand_total).toFixed(0)} Kč
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
                <div>{jobMap[entry.job_id]?.name ?? "–"}</div>
                <div>
                  {getHours(entry)} h · {Number(entry.kilometers)} km
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => startEdit(entry)}
                  disabled={editing !== null}
                  data-compact=""
                  style={{ flex: 1 }}
                >
                  Upravit
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={editing !== null}
                  data-compact=""
                  style={{ flex: 1 }}
                >
                  Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
