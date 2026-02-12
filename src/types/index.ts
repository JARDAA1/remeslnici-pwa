/**
 * Core data model for the Řemeslníci PWA.
 *
 * Design decisions:
 * - All monetary amounts are stored as numbers (CZK). Precision is handled at display time.
 * - Rates are snapshotted into WorkEntry at creation time so that changing a Job's
 *   default rate doesn't retroactively alter historical records.
 * - Dates use ISO 8601 strings for IndexedDB compatibility and easy serialization.
 * - IDs are crypto.randomUUID() strings — no server dependency.
 */

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

export interface Job {
  id: string;
  name: string;
  client: string;
  /** Default hourly rate in CZK, snapshotted into each WorkEntry at creation */
  defaultHourlyRate: number;
  active: boolean;
  createdAt: Date;
}

/** Fields required when creating a new Job (id and createdAt are generated) */
export type JobCreate = Omit<Job, "id" | "createdAt">;

// ---------------------------------------------------------------------------
// WorkEntry
// ---------------------------------------------------------------------------

export interface WorkEntry {
  id: string;
  /** ISO date string (YYYY-MM-DD) for indexing/filtering by day */
  date: string;
  /** ISO datetime string — start of work */
  startTime: string;
  /** ISO datetime string — end of work */
  endTime: string;
  jobId: string;
  /** Snapshot of the hourly rate at the time this entry was created */
  hourlyRateUsed: number;
  kilometers: number;
  /** Snapshot of the km rate at the time this entry was created */
  kmRateUsed: number;
  /** Computed: hours * hourlyRateUsed */
  laborTotal: number;
  /** Computed: kilometers * kmRateUsed */
  kmTotal: number;
  /** Sum of associated Expense amounts */
  expensesTotal: number;
  /** laborTotal + kmTotal + expensesTotal */
  grandTotal: number;
  createdAt: Date;
}

/** Fields supplied when creating a new WorkEntry */
export type WorkEntryCreate = Omit<WorkEntry, "id" | "createdAt">;

/**
 * Raw user input for a work entry — before totals are computed.
 * The service layer calculates laborTotal, kmTotal, expensesTotal,
 * and grandTotal from these fields + the associated expenses.
 */
export interface WorkEntryInput {
  date: string;
  startTime: string;
  endTime: string;
  jobId: string;
  hourlyRateUsed: number;
  kilometers: number;
  kmRateUsed: number;
}

// ---------------------------------------------------------------------------
// Expense
// ---------------------------------------------------------------------------

export interface Expense {
  id: string;
  workEntryId: string;
  amount: number;
  category: string;
  /** URL or data-URI of a receipt photo; empty string if none */
  receiptImageUrl: string;
  createdAt: Date;
}

/** Fields supplied when creating a new Expense */
export type ExpenseCreate = Omit<Expense, "id" | "createdAt">;

/**
 * Expense data as provided by the UI — no workEntryId yet because
 * it doesn't exist until the parent WorkEntry is created.
 * The service layer assigns workEntryId inside the transaction.
 */
export type ExpenseInput = Omit<ExpenseCreate, "workEntryId">;

// ---------------------------------------------------------------------------
// Database schema (used by idb to type the DB)
// ---------------------------------------------------------------------------

import type { DBSchema } from "idb";

export interface RemeslniciDB extends DBSchema {
  jobs: {
    key: string;
    value: Job;
    indexes: {
      "by-active": number; // 0 | 1 — IndexedDB can't index booleans directly
    };
  };
  workEntries: {
    key: string;
    value: WorkEntry;
    indexes: {
      "by-date": string;
      "by-jobId": string;
    };
  };
  expenses: {
    key: string;
    value: Expense;
    indexes: {
      "by-workEntryId": string;
    };
  };
}
