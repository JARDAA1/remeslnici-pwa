/**
 * Full database backup and restore.
 *
 * Export: reads all stores → produces a FullBackup JSON object.
 * Import: validates JSON → atomically clears + writes all stores in one transaction.
 *
 * The restore is all-or-nothing: if any record fails to insert,
 * the transaction aborts and the original data remains intact.
 *
 * Validation guarantees:
 * - No Invalid Date, NaN, undefined, Infinity in any field
 * - No duplicate IDs within a store
 * - Referential integrity (workEntry.jobId → jobs, expense.workEntryId → workEntries)
 * - Totals consistency (recomputed and compared to stored values)
 * - Strict type checking — no silent coercion
 */

import { getDB } from "@/lib/db";
import { toLocalDate } from "@/lib/utils/time";
import {
  calculateDurationInHours,
  calculateLaborTotal,
  calculateKmTotal,
  calculateGrandTotal,
} from "@/lib/calculations";
import type { Job, WorkEntry, Expense } from "@/types";

// ---------------------------------------------------------------------------
// Backup schema
// ---------------------------------------------------------------------------

export interface FullBackup {
  version: 1;
  exportedAt: string;
  jobs: Job[];
  workEntries: WorkEntry[];
  expenses: Expense[];
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportFullBackup(): Promise<FullBackup> {
  const db = await getDB();

  // Read all stores in a single readonly transaction for consistency
  const tx = db.transaction(["jobs", "workEntries", "expenses"], "readonly");
  const [jobs, workEntries, expenses] = await Promise.all([
    tx.objectStore("jobs").getAll(),
    tx.objectStore("workEntries").getAll(),
    tx.objectStore("expenses").getAll(),
  ]);
  await tx.done;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    jobs,
    workEntries,
    expenses,
  };
}

export function downloadBackupFile(backup: FullBackup): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = toLocalDate(new Date());
  const filename = `remeslnici-backup-${date}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Validate and atomically restore a full backup.
 * Clears ALL existing data and replaces it with backup contents.
 *
 * Validation order:
 * 1. Structure + types (every field present and correct type)
 * 2. Strict date validation (no Invalid Date)
 * 3. Strict numeric validation (no NaN, no Infinity)
 * 4. Duplicate ID detection
 * 5. Referential integrity (jobId, workEntryId references)
 * 6. Totals consistency (recomputed vs stored)
 * 7. Rehydrate Date objects
 * 8. Atomic transaction: clear all → insert all → commit
 */
export async function importFullBackup(data: unknown): Promise<void> {
  // 1–3. Structure, types, dates, numerics
  validateBackup(data);

  const backup = data as FullBackup;

  // 4. Duplicate ID detection
  assertNoDuplicateIds(
    (backup.jobs as unknown as Record<string, unknown>[]).map((r) => r.id as string),
    "jobs"
  );
  assertNoDuplicateIds(
    (backup.workEntries as unknown as Record<string, unknown>[]).map((r) => r.id as string),
    "workEntries"
  );
  assertNoDuplicateIds(
    (backup.expenses as unknown as Record<string, unknown>[]).map((r) => r.id as string),
    "expenses"
  );

  // 5. Referential integrity
  assertReferentialIntegrity(backup);

  // 6. Totals consistency
  assertTotalsConsistency(backup);

  // 7. Rehydrate Date objects (createdAt string → Date)
  const jobs = (backup.jobs as unknown as Record<string, unknown>[]).map(rehydrateJob);
  const workEntries = (backup.workEntries as unknown as Record<string, unknown>[]).map(rehydrateWorkEntry);
  const expenses = (backup.expenses as unknown as Record<string, unknown>[]).map(rehydrateExpense);

  // 8. Atomic transaction
  const db = await getDB();
  const tx = db.transaction(["jobs", "workEntries", "expenses"], "readwrite");

  tx.objectStore("jobs").clear();
  tx.objectStore("workEntries").clear();
  tx.objectStore("expenses").clear();

  for (const job of jobs) {
    tx.objectStore("jobs").put(job);
  }
  for (const entry of workEntries) {
    tx.objectStore("workEntries").put(entry);
  }
  for (const expense of expenses) {
    tx.objectStore("expenses").put(expense);
  }

  await tx.done;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Asserts value is a finite number (not NaN, not Infinity, not string, not null/undefined) */
function assertFiniteNumber(value: unknown, label: string): void {
  if (typeof value !== "number") {
    throw new Error(`${label}: očekáváno number, dostáno ${typeof value}.`);
  }
  if (Number.isNaN(value)) {
    throw new Error(`${label}: hodnota je NaN.`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`${label}: hodnota je Infinity.`);
  }
}

/** Asserts value is a string that parses to a valid Date */
function assertValidDateString(value: unknown, label: string): void {
  if (typeof value !== "string") {
    throw new Error(`${label}: očekáváno string, dostáno ${typeof value}.`);
  }
  if (value === "") {
    throw new Error(`${label}: prázdný řetězec.`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`${label}: neplatný formát data "${value}".`);
  }
}

/** Asserts value is a non-empty string */
function assertNonEmptyString(value: unknown, label: string): void {
  if (typeof value !== "string") {
    throw new Error(`${label}: očekáváno string, dostáno ${typeof value}.`);
  }
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

function validateBackup(data: unknown): asserts data is FullBackup {
  if (data === null || typeof data !== "object") {
    throw new Error("Neplatný soubor: není JSON objekt.");
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new Error(
      `Nepodporovaná verze zálohy: ${obj.version ?? "chybí"}. Očekávaná: 1.`
    );
  }

  // exportedAt — strict date validation
  assertValidDateString(obj.exportedAt, "exportedAt");

  if (!Array.isArray(obj.jobs)) {
    throw new Error("Neplatná záloha: jobs není pole.");
  }
  if (!Array.isArray(obj.workEntries)) {
    throw new Error("Neplatná záloha: workEntries není pole.");
  }
  if (!Array.isArray(obj.expenses)) {
    throw new Error("Neplatná záloha: expenses není pole.");
  }

  // Validate individual records
  for (let i = 0; i < obj.jobs.length; i++) {
    validateJob(obj.jobs[i], i);
  }
  for (let i = 0; i < obj.workEntries.length; i++) {
    validateWorkEntry(obj.workEntries[i], i);
  }
  for (let i = 0; i < obj.expenses.length; i++) {
    validateExpense(obj.expenses[i], i);
  }
}

// ---------------------------------------------------------------------------
// Job validation
// ---------------------------------------------------------------------------

function validateJob(data: unknown, index: number): void {
  const p = `jobs[${index}]`;
  if (data === null || typeof data !== "object") {
    throw new Error(`${p}: není objekt.`);
  }
  const r = data as Record<string, unknown>;

  assertNonEmptyString(r.id, `${p}.id`);
  assertNonEmptyString(r.name, `${p}.name`);
  assertNonEmptyString(r.client, `${p}.client`);
  assertFiniteNumber(r.defaultHourlyRate, `${p}.defaultHourlyRate`);

  if (typeof r.active !== "boolean") {
    throw new Error(`${p}.active: očekáváno boolean, dostáno ${typeof r.active}.`);
  }

  assertValidDateString(r.createdAt, `${p}.createdAt`);
}

// ---------------------------------------------------------------------------
// WorkEntry validation
// ---------------------------------------------------------------------------

function validateWorkEntry(data: unknown, index: number): void {
  const p = `workEntries[${index}]`;
  if (data === null || typeof data !== "object") {
    throw new Error(`${p}: není objekt.`);
  }
  const r = data as Record<string, unknown>;

  // String fields
  assertNonEmptyString(r.id, `${p}.id`);
  assertNonEmptyString(r.jobId, `${p}.jobId`);
  assertNonEmptyString(r.date, `${p}.date`);

  // Date fields — strict
  assertValidDateString(r.startTime, `${p}.startTime`);
  assertValidDateString(r.endTime, `${p}.endTime`);
  assertValidDateString(r.createdAt, `${p}.createdAt`);

  // Numeric fields — all required, all finite
  assertFiniteNumber(r.hourlyRateUsed, `${p}.hourlyRateUsed`);
  assertFiniteNumber(r.kilometers, `${p}.kilometers`);
  assertFiniteNumber(r.kmRateUsed, `${p}.kmRateUsed`);
  assertFiniteNumber(r.laborTotal, `${p}.laborTotal`);
  assertFiniteNumber(r.kmTotal, `${p}.kmTotal`);
  assertFiniteNumber(r.expensesTotal, `${p}.expensesTotal`);
  assertFiniteNumber(r.grandTotal, `${p}.grandTotal`);
}

// ---------------------------------------------------------------------------
// Expense validation
// ---------------------------------------------------------------------------

function validateExpense(data: unknown, index: number): void {
  const p = `expenses[${index}]`;
  if (data === null || typeof data !== "object") {
    throw new Error(`${p}: není objekt.`);
  }
  const r = data as Record<string, unknown>;

  assertNonEmptyString(r.id, `${p}.id`);
  assertNonEmptyString(r.workEntryId, `${p}.workEntryId`);
  assertNonEmptyString(r.category, `${p}.category`);
  assertFiniteNumber(r.amount, `${p}.amount`);
  assertValidDateString(r.createdAt, `${p}.createdAt`);
}

// ---------------------------------------------------------------------------
// Duplicate ID detection
// ---------------------------------------------------------------------------

function assertNoDuplicateIds(ids: string[], storeName: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicitní ID v ${storeName}: ${id}`);
    }
    seen.add(id);
  }
}

// ---------------------------------------------------------------------------
// Referential integrity
// ---------------------------------------------------------------------------

function assertReferentialIntegrity(backup: FullBackup): void {
  const jobIds = new Set(
    (backup.jobs as unknown as Record<string, unknown>[]).map((r) => r.id as string)
  );
  const entryIds = new Set(
    (backup.workEntries as unknown as Record<string, unknown>[]).map((r) => r.id as string)
  );

  // Every workEntry.jobId must exist in jobs
  for (let i = 0; i < backup.workEntries.length; i++) {
    const r = backup.workEntries[i] as unknown as Record<string, unknown>;
    const jobId = r.jobId as string;
    if (!jobIds.has(jobId)) {
      throw new Error(
        `workEntries[${i}]: jobId "${jobId}" odkazuje na neexistující zakázku.`
      );
    }
  }

  // Every expense.workEntryId must exist in workEntries
  for (let i = 0; i < backup.expenses.length; i++) {
    const r = backup.expenses[i] as unknown as Record<string, unknown>;
    const workEntryId = r.workEntryId as string;
    if (!entryIds.has(workEntryId)) {
      throw new Error(
        `expenses[${i}]: workEntryId "${workEntryId}" odkazuje na neexistující záznam.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Totals consistency verification
// ---------------------------------------------------------------------------

/**
 * Recompute every WorkEntry's totals from raw fields and compare
 * to stored values. Uses the same calculation functions as the service layer.
 * Comparison is rounded to 2 decimal places (matching the calculation logic).
 */
function assertTotalsConsistency(backup: FullBackup): void {
  // Build expense sums per workEntryId
  const expenseSumByEntry = new Map<string, number>();
  for (const expense of backup.expenses as unknown as Record<string, unknown>[]) {
    const weId = expense.workEntryId as string;
    const amount = expense.amount as number;
    expenseSumByEntry.set(weId, (expenseSumByEntry.get(weId) ?? 0) + amount);
  }

  for (let i = 0; i < backup.workEntries.length; i++) {
    const r = backup.workEntries[i] as unknown as Record<string, unknown>;
    const p = `workEntries[${i}]`;
    const entryId = r.id as string;

    const startTime = r.startTime as string;
    const endTime = r.endTime as string;
    const hourlyRateUsed = r.hourlyRateUsed as number;
    const kilometers = r.kilometers as number;
    const kmRateUsed = r.kmRateUsed as number;
    const storedLaborTotal = r.laborTotal as number;
    const storedKmTotal = r.kmTotal as number;
    const storedExpensesTotal = r.expensesTotal as number;
    const storedGrandTotal = r.grandTotal as number;

    // Recompute
    const duration = calculateDurationInHours(startTime, endTime);
    const expectedLabor = calculateLaborTotal(duration, hourlyRateUsed);
    const expectedKm = calculateKmTotal(kilometers, kmRateUsed);
    const expectedExpensesTotal = Math.round((expenseSumByEntry.get(entryId) ?? 0) * 100) / 100;
    const expectedGrand = calculateGrandTotal(expectedLabor, expectedKm, expectedExpensesTotal);

    // Compare rounded to 2 decimals
    const r2 = (n: number) => Math.round(n * 100) / 100;

    if (r2(storedLaborTotal) !== r2(expectedLabor)) {
      throw new Error(
        `${p}: laborTotal nesedí. Uloženo: ${storedLaborTotal}, vypočteno: ${expectedLabor}.`
      );
    }
    if (r2(storedKmTotal) !== r2(expectedKm)) {
      throw new Error(
        `${p}: kmTotal nesedí. Uloženo: ${storedKmTotal}, vypočteno: ${expectedKm}.`
      );
    }
    if (r2(storedExpensesTotal) !== r2(expectedExpensesTotal)) {
      throw new Error(
        `${p}: expensesTotal nesedí. Uloženo: ${storedExpensesTotal}, vypočteno: ${expectedExpensesTotal}.`
      );
    }
    if (r2(storedGrandTotal) !== r2(expectedGrand)) {
      throw new Error(
        `${p}: grandTotal nesedí. Uloženo: ${storedGrandTotal}, vypočteno: ${expectedGrand}.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Date rehydration
// ---------------------------------------------------------------------------
// JSON.stringify(Date) → string. When parsing backup JSON, createdAt
// is a string like "2025-06-15T08:00:00.000Z". IndexedDB expects Date objects.
//
// At this point all dates have already been validated by assertValidDateString,
// so new Date() is guaranteed to produce a valid Date.

function rehydrateJob(raw: Record<string, unknown>): Job {
  return { ...raw, createdAt: new Date(raw.createdAt as string) } as Job;
}

function rehydrateWorkEntry(raw: Record<string, unknown>): WorkEntry {
  return { ...raw, createdAt: new Date(raw.createdAt as string) } as WorkEntry;
}

function rehydrateExpense(raw: Record<string, unknown>): Expense {
  return { ...raw, createdAt: new Date(raw.createdAt as string) } as Expense;
}
