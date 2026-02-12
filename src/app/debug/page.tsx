"use client";

/**
 * Debug page for manual stress testing.
 * Temporary — remove before production.
 *
 * - Generate 100 or 500 test entries (with expenses)
 * - Clear entire database
 * - Log DB record counts
 */

import { useState } from "react";
import { getDB } from "@/lib/db";
import * as jobRepository from "@/lib/repositories/jobRepository";
import { toLocalISO, toLocalDate } from "@/lib/utils/time";

interface Counts {
  jobs: number;
  entries: number;
  expenses: number;
}

export default function DebugPage() {
  const [status, setStatus] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Count records ---
  async function handleCount() {
    setBusy(true);
    setStatus("Počítám…");
    try {
      const db = await getDB();
      const tx = db.transaction(["jobs", "workEntries", "expenses"], "readonly");
      const [jobs, entries, expenses] = await Promise.all([
        tx.objectStore("jobs").count(),
        tx.objectStore("workEntries").count(),
        tx.objectStore("expenses").count(),
      ]);
      await tx.done;
      setCounts({ jobs, entries, expenses });
      setStatus("Hotovo.");
    } catch (e: unknown) {
      setStatus(`Chyba: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // --- Clear database ---
  async function handleClear() {
    if (!window.confirm("Opravdu smazat VŠECHNA data z databáze?")) return;
    setBusy(true);
    setStatus("Mažu…");
    try {
      const db = await getDB();
      const tx = db.transaction(["jobs", "workEntries", "expenses"], "readwrite");
      tx.objectStore("jobs").clear();
      tx.objectStore("workEntries").clear();
      tx.objectStore("expenses").clear();
      await tx.done;
      setCounts({ jobs: 0, entries: 0, expenses: 0 });
      setStatus("Databáze vymazána.");
    } catch (e: unknown) {
      setStatus(`Chyba: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // --- Generate test entries ---
  async function handleGenerate(count: number) {
    setBusy(true);
    setStatus(`Generuji ${count} záznamů…`);
    try {
      // Ensure at least one job exists
      let jobs = await jobRepository.getAll();
      if (jobs.length === 0) {
        await jobRepository.create({
          name: "Testovací zakázka",
          client: "Testovací klient",
          defaultHourlyRate: 500,
          active: true,
        });
        jobs = await jobRepository.getAll();
      }
      const jobId = jobs[0].id;

      const db = await getDB();

      // Write all in one transaction for speed
      const tx = db.transaction(["workEntries", "expenses"], "readwrite");
      const entryStore = tx.objectStore("workEntries");
      const expenseStore = tx.objectStore("expenses");

      const now = Date.now();

      for (let i = 0; i < count; i++) {
        const entryId = crypto.randomUUID();
        const dayOffset = i % 365;
        const day = new Date(2025, 0, 1 + dayOffset);
        const start = new Date(day.getTime() + 8 * 3600_000);
        const end = new Date(start.getTime() + (4 + Math.random() * 6) * 3600_000);

        const hours = (end.getTime() - start.getTime()) / 3600_000;
        const laborTotal = Math.round(hours * 500 * 100) / 100;
        const km = Math.round(Math.random() * 80);
        const kmTotal = km * 5;
        const expenseAmount1 = Math.round(Math.random() * 500 * 100) / 100;
        const expenseAmount2 = Math.round(Math.random() * 300 * 100) / 100;
        const expensesTotal = expenseAmount1 + expenseAmount2;
        const grandTotal = Math.round((laborTotal + kmTotal + expensesTotal) * 100) / 100;

        entryStore.put({
          id: entryId,
          date: toLocalDate(start),
          startTime: toLocalISO(start),
          endTime: toLocalISO(end),
          jobId,
          hourlyRateUsed: 500,
          kilometers: km,
          kmRateUsed: 5,
          laborTotal,
          kmTotal,
          expensesTotal,
          grandTotal,
          createdAt: new Date(now + i),
        });

        // 2 expenses per entry
        expenseStore.put({
          id: crypto.randomUUID(),
          workEntryId: entryId,
          amount: expenseAmount1,
          category: "Materiál",
          receiptImageUrl: "",
          createdAt: new Date(now + i),
        });
        expenseStore.put({
          id: crypto.randomUUID(),
          workEntryId: entryId,
          amount: expenseAmount2,
          category: "Doprava",
          receiptImageUrl: "",
          createdAt: new Date(now + i),
        });
      }

      await tx.done;

      setStatus(`Vygenerováno ${count} záznamů + ${count * 2} výdajů.`);
      // Refresh counts
      await handleCount();
    } catch (e: unknown) {
      setStatus(`Chyba: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 600, fontFamily: "monospace" }}>
      <h1>Debug</h1>
      <p style={{ color: "#999", fontSize: 13 }}>
        Dočasná stránka pro manuální testování. Odstranit před produkčním nasazením.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {/* Counts */}
        <button onClick={handleCount} disabled={busy} style={{ padding: "10px 16px" }}>
          Vypsat počty
        </button>

        {counts && (
          <table style={{ borderCollapse: "collapse", maxWidth: 300 }}>
            <tbody>
              <tr>
                <td style={{ padding: 4, fontWeight: "bold" }}>Jobs:</td>
                <td style={{ padding: 4, textAlign: "right" }}>{counts.jobs}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, fontWeight: "bold" }}>WorkEntries:</td>
                <td style={{ padding: 4, textAlign: "right" }}>{counts.entries}</td>
              </tr>
              <tr>
                <td style={{ padding: 4, fontWeight: "bold" }}>Expenses:</td>
                <td style={{ padding: 4, textAlign: "right" }}>{counts.expenses}</td>
              </tr>
            </tbody>
          </table>
        )}

        <hr />

        {/* Generate */}
        <button
          onClick={() => handleGenerate(100)}
          disabled={busy}
          style={{ padding: "10px 16px" }}
        >
          Generovat 100 záznamů
        </button>

        <button
          onClick={() => handleGenerate(500)}
          disabled={busy}
          style={{ padding: "10px 16px" }}
        >
          Generovat 500 záznamů
        </button>

        <hr />

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={busy}
          style={{ padding: "10px 16px", color: "red" }}
        >
          Vymazat databázi
        </button>
      </div>

      {/* Status */}
      {status && (
        <p style={{ marginTop: 16, padding: 8, background: "#f5f5f5", borderRadius: 4 }}>
          {status}
        </p>
      )}
    </div>
  );
}
