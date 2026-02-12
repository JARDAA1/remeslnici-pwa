"use client";

import { useEffect, useState, useCallback } from "react";
import * as workEntryRepository from "@/lib/repositories/workEntryRepository";
import * as jobRepository from "@/lib/repositories/jobRepository";
import * as expenseRepository from "@/lib/repositories/expenseRepository";
import { deleteWorkEntry, updateWorkEntry } from "@/lib/services/workEntryService";
import { calculateDurationInHours } from "@/lib/calculations";
import { toLocalISO, toLocalDate } from "@/lib/utils/time";
import type { WorkEntry, Job, ExpenseInput } from "@/types";

interface ExpenseRow {
  amount: string;
  category: string;
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
  expenses: ExpenseRow[];
}

export default function EntriesPage() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [jobMap, setJobMap] = useState<Record<string, Job>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allEntries, allJobs] = await Promise.all([
        workEntryRepository.getAll(),
        jobRepository.getAll(),
      ]);

      allEntries.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return b.startTime.localeCompare(a.startTime);
      });

      setEntries(allEntries);
      setJobs(allJobs);

      const map: Record<string, Job> = {};
      for (const j of allJobs) {
        map[j.id] = j;
      }
      setJobMap(map);
    } catch (e) {
      console.error("Failed to load entries", e);
      setError("Nepodařilo se načíst záznamy.");
    }
  }, []);

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
      setError("Nepodařilo se smazat záznam.");
    }
  }

  async function startEdit(entry: WorkEntry) {
    setError("");
    try {
      // Load existing expenses for this entry
      const entryExpenses = await expenseRepository.getByWorkEntryId(entry.id);

      // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
      const toLocalInput = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setEditing({
        id: entry.id,
        date: entry.date,
        startTime: toLocalInput(entry.startTime),
        endTime: toLocalInput(entry.endTime),
        jobId: entry.jobId,
        hourlyRate: String(entry.hourlyRateUsed),
        kilometers: String(entry.kilometers),
        kmRate: String(entry.kmRateUsed),
        expenses: entryExpenses.map((exp) => ({
          amount: String(exp.amount),
          category: exp.category,
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
      expenses: [...editing.expenses, { amount: "", category: "" }],
    });
  }

  function updateEditExpense(index: number, field: keyof ExpenseRow, value: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      expenses: editing.expenses.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
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
    if (!editing || saving) return;
    setError("");

    // Validate
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

    // datetime-local → ISO string with local timezone offset
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
    const expenseInputs: ExpenseInput[] = [];
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
      expenseInputs.push({
        amount,
        category: row.category.trim(),
        receiptImageUrl: "",
      });
    }

    const date = toLocalDate(startDate);

    setSaving(true);
    try {
      await updateWorkEntry({
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
      setError("Nepodařilo se uložit změny.");
    } finally {
      setSaving(false);
    }
  }

  // --- Helpers ---

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("cs-CZ");
  }

  function getHours(entry: WorkEntry): string {
    try {
      return calculateDurationInHours(entry.startTime, entry.endTime).toFixed(2);
    } catch {
      return "–";
    }
  }

  // --- Render ---

  return (
    <div>
      <h1>Záznamy</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Edit form */}
      {editing && (
        <div style={{ border: "1px solid #999", padding: 16, marginBottom: 24, maxWidth: 500 }}>
          <h2>Upravit záznam</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label>
              Zakázka:
              <select
                value={editing.jobId}
                onChange={(e) => updateEditField("jobId", e.target.value)}
                style={{ display: "block", width: "100%" }}
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
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <label>
              Konec:
              <input
                type="datetime-local"
                value={editing.endTime}
                onChange={(e) => updateEditField("endTime", e.target.value)}
                style={{ display: "block", width: "100%" }}
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
                style={{ display: "block", width: "100%" }}
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
                style={{ display: "block", width: "100%" }}
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
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <h3 style={{ marginBottom: 0 }}>Výdaje</h3>
            {editing.expenses.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "end" }}>
                <label style={{ flex: 1 }}>
                  Částka:
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.amount}
                    onChange={(e) => updateEditExpense(i, "amount", e.target.value)}
                    style={{ display: "block", width: "100%" }}
                  />
                </label>
                <label style={{ flex: 1 }}>
                  Kategorie:
                  <input
                    type="text"
                    value={row.category}
                    onChange={(e) => updateEditExpense(i, "category", e.target.value)}
                    style={{ display: "block", width: "100%" }}
                  />
                </label>
                <button type="button" onClick={() => removeEditExpense(i)}>X</button>
              </div>
            ))}
            <button type="button" onClick={addEditExpense}>+ Přidat výdaj</button>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleEditSave} disabled={saving} style={{ padding: "8px 16px" }}>
                {saving ? "Ukládám…" : "Uložit změny"}
              </button>
              <button onClick={cancelEdit} disabled={saving}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <p>Žádné záznamy.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Datum</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 4 }}>Zakázka</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Hodiny</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Km</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 4 }}>Celkem</th>
              <th style={{ borderBottom: "1px solid #ccc", padding: 4 }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                style={{
                  backgroundColor: editing?.id === entry.id ? "#eef" : undefined,
                }}
              >
                <td style={{ padding: 4 }}>{formatDate(entry.date)}</td>
                <td style={{ padding: 4 }}>{jobMap[entry.jobId]?.name ?? "–"}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{getHours(entry)}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{entry.kilometers}</td>
                <td style={{ padding: 4, textAlign: "right" }}>{entry.grandTotal.toFixed(2)} Kč</td>
                <td style={{ padding: 4, display: "flex", gap: 4 }}>
                  <button
                    onClick={() => startEdit(entry)}
                    disabled={editing !== null}
                  >
                    Upravit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={editing !== null}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
