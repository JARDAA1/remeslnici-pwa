"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthProvider";
import { createWorkEntry } from "@/lib/services/workEntryService";
import { calculateDurationInHours } from "@/lib/calculations";
import { nowLocalISO, toLocalDate } from "@/lib/utils/time";
import type { Database } from "@/lib/supabase/types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

const DEFAULT_KM_RATE = 5;
const SESSION_STORAGE_KEY = "remeslnici-active-session";

interface ActiveSession {
  jobId: string;
  jobName: string;
  hourlyRate: number;
  startTime: string;
}

interface ExpenseRow {
  amount: string;
  category: string;
  file: File | null;
}

type Phase = "idle" | "running" | "saving";

// --- localStorage helpers ---

function persistSession(session: ActiveSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // best-effort
  }
}

function loadPersistedSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.jobId === "string" &&
      typeof parsed.jobName === "string" &&
      typeof parsed.hourlyRate === "number" &&
      typeof parsed.startTime === "string"
    ) {
      return parsed as ActiveSession;
    }
  } catch {
    // corrupt or unavailable
  }
  return null;
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export default function WorkPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  // Idle phase
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [rateOverride, setRateOverride] = useState("");

  // Running phase
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Saving phase
  const [kilometers, setKilometers] = useState("");
  const [kmRate, setKmRate] = useState(String(DEFAULT_KM_RATE));
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Restore session on mount ---
  useEffect(() => {
    const restored = loadPersistedSession();
    if (restored) {
      setSession(restored);
      setPhase("running");
    }
  }, []);

  async function loadJobs() {
    if (!user) return;
    try {
      const { data, error: err } = await getSupabase()
        .from("jobs")
        .select("*")
        .eq("active", true)
        .order("name");
      if (err) throw err;
      const active = data ?? [];
      setJobs(active);
      if (active.length > 0 && !selectedJobId) {
        setSelectedJobId(active[0].id);
      }
    } catch (e) {
      console.error("Failed to load jobs", e);
      setError("Nepodařilo se načíst zakázky.");
    }
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Timer tick
  const updateElapsed = useCallback(() => {
    if (!session) return;
    const diffMs = Date.now() - new Date(session.startTime).getTime();
    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    setElapsed(`${h}:${m}:${s}`);
  }, [session]);

  useEffect(() => {
    if (phase === "running" && session) {
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase, session, updateElapsed]);

  // --- Actions ---

  function handleStart() {
    setError("");
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job) {
      setError("Vyberte zakázku.");
      return;
    }

    const rate = rateOverride.trim()
      ? parseFloat(rateOverride)
      : Number(job.default_hourly_rate);

    if (isNaN(rate) || rate < 0) {
      setError("Neplatná hodinová sazba.");
      return;
    }

    const newSession: ActiveSession = {
      jobId: job.id,
      jobName: job.name,
      hourlyRate: rate,
      startTime: nowLocalISO(),
    };
    setSession(newSession);
    persistSession(newSession);
    setPhase("running");
  }

  function handleStop() {
    if (timerRef.current) clearInterval(timerRef.current);
    setEndTime(nowLocalISO());
    setKilometers("");
    setKmRate(String(DEFAULT_KM_RATE));
    setExpenses([]);
    setPhase("saving");
  }

  function addExpenseRow() {
    setExpenses((prev) => [...prev, { amount: "", category: "", file: null }]);
  }

  function updateExpense(index: number, field: "amount" | "category", value: string) {
    setExpenses((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function updateExpenseFile(index: number, file: File | null) {
    setExpenses((prev) =>
      prev.map((row, i) => (i === index ? { ...row, file } : row))
    );
  }

  function removeExpense(index: number) {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!session || saving || !user) return;
    setError("");

    const km = parseFloat(kilometers) || 0;
    const kmRateNum = parseFloat(kmRate) || 0;

    if (km < 0) {
      setError("Kilometry nemohou být záporné.");
      return;
    }
    if (kmRateNum < 0) {
      setError("Sazba za km nemůže být záporná.");
      return;
    }

    // Validate expenses
    const expenseInputs: { amount: number; category: string; file: File | null }[] = [];
    for (let i = 0; i < expenses.length; i++) {
      const row = expenses[i];
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

    const date = toLocalDate(session.startTime);

    setSaving(true);
    try {
      await createWorkEntry({
        userId: user.id,
        input: {
          date,
          startTime: session.startTime,
          endTime,
          jobId: session.jobId,
          hourlyRateUsed: session.hourlyRate,
          kilometers: km,
          kmRateUsed: kmRateNum,
        },
        expenses: expenseInputs,
      });

      clearPersistedSession();
      setSession(null);
      setPhase("idle");
      setRateOverride("");
    } catch (e) {
      console.error("Failed to save work entry", e);
      setError("Nepodařilo se uložit záznam. Pro uložení je potřeba připojení k internetu.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    clearPersistedSession();
    setSession(null);
    setPhase("idle");
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // --- Render ---

  if (phase === "idle") {
    return (
      <div>
        <h1>Práce</h1>
        {error && <p className="error-message">{error}</p>}

        {jobs.length === 0 ? (
          <p>Žádné aktivní zakázky. Přidejte zakázku v sekci Zakázky.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Zakázka:
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.client}) – {Number(j.default_hourly_rate)} Kč/h
                  </option>
                ))}
              </select>
            </label>

            <label>
              Hodinová sazba (přepsat):
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={
                  jobs.find((j) => j.id === selectedJobId)?.default_hourly_rate.toString() ?? ""
                }
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
              />
            </label>

            <button onClick={handleStart} data-primary="">
              START
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div>
        <h1>Práce běží</h1>
        {error && <p className="error-message">{error}</p>}

        <p><strong>Zakázka:</strong> {session?.jobName}</p>
        <p
          style={{
            fontSize: 48,
            fontFamily: "monospace",
            margin: "16px 0",
            textAlign: "center",
          }}
        >
          {elapsed}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={handleStop} data-primary="">
            STOP
          </button>
          <button onClick={handleCancel}>
            Zrušit
          </button>
        </div>
      </div>
    );
  }

  // phase === "saving"
  const hours = session ? calculateDurationInHours(session.startTime, endTime) : 0;

  return (
    <div>
      <h1>Uložit záznam</h1>
      {error && <p className="error-message">{error}</p>}

      <p><strong>Zakázka:</strong> {session?.jobName}</p>
      <p><strong>Odpracováno:</strong> {hours.toFixed(2)} h</p>
      <p><strong>Sazba:</strong> {session?.hourlyRate.toFixed(2)} Kč/h</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <label>
          Kilometry:
          <input
            type="number"
            step="0.1"
            min="0"
            value={kilometers}
            onChange={(e) => setKilometers(e.target.value)}
          />
        </label>

        <label>
          Sazba za km (Kč):
          <input
            type="number"
            step="0.01"
            min="0"
            value={kmRate}
            onChange={(e) => setKmRate(e.target.value)}
          />
        </label>

        <h3>Výdaje</h3>
        {expenses.map((row, i) => (
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
                onChange={(e) => updateExpense(i, "amount", e.target.value)}
              />
            </label>
            <label>
              Kategorie:
              <input
                type="text"
                value={row.category}
                onChange={(e) => updateExpense(i, "category", e.target.value)}
              />
            </label>
            <label>
              Účtenka:
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => updateExpenseFile(i, e.target.files?.[0] ?? null)}
              />
            </label>
            {row.file && <span style={{ fontSize: 12, color: "#666" }}>{row.file.name}</span>}
            <button type="button" onClick={() => removeExpense(i)} data-compact="">
              Odebrat výdaj
            </button>
          </div>
        ))}
        <button type="button" onClick={addExpenseRow}>
          + Přidat výdaj
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            data-primary=""
          >
            {saving ? "Ukládám…" : "ULOŽIT"}
          </button>
          <button onClick={handleCancel} disabled={saving}>
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
