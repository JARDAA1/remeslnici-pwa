/**
 * Service layer for WorkEntry operations.
 *
 * This is the ONLY module UI code should call for creating/updating/deleting work entries.
 * It guarantees:
 * 1. Totals (expensesTotal, laborTotal, kmTotal, grandTotal) are computed from
 *    the actual expense data being saved — never caller-supplied.
 * 2. WorkEntry + Expenses are persisted in a single IndexedDB transaction.
 *
 * Do NOT call workEntryRepository.create() or expenseRepository.create()
 * directly from UI code — that bypasses both guarantees above.
 */

import { getDB } from "@/lib/db";
import {
  calculateDurationInHours,
  calculateLaborTotal,
  calculateKmTotal,
  calculateGrandTotal,
} from "@/lib/calculations";
import type {
  WorkEntry,
  WorkEntryInput,
  Expense,
  ExpenseInput,
} from "@/types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateWorkEntryParams {
  input: WorkEntryInput;
  expenses: ExpenseInput[];
}

/**
 * Compute totals from the raw input + expenses, then atomically persist
 * the WorkEntry and all its Expenses in one IndexedDB transaction.
 */
export async function createWorkEntry(
  params: CreateWorkEntryParams
): Promise<{ entry: WorkEntry; expenses: Expense[] }> {
  const { input, expenses } = params;

  // 1. Compute totals from the source data
  const hours = calculateDurationInHours(input.startTime, input.endTime);
  const laborTotal = calculateLaborTotal(hours, input.hourlyRateUsed);
  const kmTotal = calculateKmTotal(input.kilometers, input.kmRateUsed);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = calculateGrandTotal(laborTotal, kmTotal, expensesTotal);

  const now = new Date();

  const entry: WorkEntry = {
    id: crypto.randomUUID(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    jobId: input.jobId,
    hourlyRateUsed: input.hourlyRateUsed,
    kilometers: input.kilometers,
    kmRateUsed: input.kmRateUsed,
    laborTotal,
    kmTotal,
    expensesTotal,
    grandTotal,
    createdAt: now,
  };

  const expenseRecords: Expense[] = expenses.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    workEntryId: entry.id,
    createdAt: now,
  }));

  // 2. Open tx → write entry → write expenses → commit
  const db = await getDB();
  const tx = db.transaction(["workEntries", "expenses"], "readwrite");

  tx.objectStore("workEntries").put(entry);
  for (const expense of expenseRecords) {
    tx.objectStore("expenses").put(expense);
  }

  await tx.done;

  return { entry, expenses: expenseRecords };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export interface UpdateWorkEntryParams {
  id: string;
  input: WorkEntryInput;
  expenses: ExpenseInput[];
}

/**
 * Atomically update a WorkEntry: recompute totals, replace all expenses.
 *
 * Strategy: delete old expenses → write new expenses → overwrite entry.
 * All in one transaction — if anything fails, nothing changes.
 */
export async function updateWorkEntry(
  params: UpdateWorkEntryParams
): Promise<{ entry: WorkEntry; expenses: Expense[] }> {
  const { id, input, expenses } = params;

  const db = await getDB();

  // Verify the entry exists before doing anything
  const existing = await db.get("workEntries", id);
  if (!existing) {
    throw new Error(`WorkEntry not found: ${id}`);
  }

  // 1. Compute totals from the new data
  const hours = calculateDurationInHours(input.startTime, input.endTime);
  const laborTotal = calculateLaborTotal(hours, input.hourlyRateUsed);
  const kmTotal = calculateKmTotal(input.kilometers, input.kmRateUsed);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = calculateGrandTotal(laborTotal, kmTotal, expensesTotal);

  const now = new Date();

  const entry: WorkEntry = {
    id,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    jobId: input.jobId,
    hourlyRateUsed: input.hourlyRateUsed,
    kilometers: input.kilometers,
    kmRateUsed: input.kmRateUsed,
    laborTotal,
    kmTotal,
    expensesTotal,
    grandTotal,
    createdAt: existing.createdAt, // preserve original creation time
  };

  const expenseRecords: Expense[] = expenses.map((e) => ({
    ...e,
    id: crypto.randomUUID(),
    workEntryId: id,
    createdAt: now,
  }));

  // 2. Single transaction: delete old expenses → write new expenses → overwrite entry
  const tx = db.transaction(["workEntries", "expenses"], "readwrite");

  const oldExpenses = await tx
    .objectStore("expenses")
    .index("by-workEntryId")
    .getAll(id);

  for (const old of oldExpenses) {
    tx.objectStore("expenses").delete(old.id);
  }
  for (const expense of expenseRecords) {
    tx.objectStore("expenses").put(expense);
  }
  tx.objectStore("workEntries").put(entry);

  await tx.done;

  return { entry, expenses: expenseRecords };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Atomically delete a WorkEntry and all its associated Expenses.
 */
export async function deleteWorkEntry(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["workEntries", "expenses"], "readwrite");

  const expenses = await tx
    .objectStore("expenses")
    .index("by-workEntryId")
    .getAll(id);

  for (const expense of expenses) {
    tx.objectStore("expenses").delete(expense.id);
  }
  tx.objectStore("workEntries").delete(id);

  await tx.done;
}
